// api/email-check.js
// User-triggered manual "↻ Check Now" handler.
//
// Cost model (23 Apr 2026 rewrite):
//   - Only scans emails since `conn.last_checked` (48h fallback on first click
//     after OAuth connect, when last_checked is still null).
//   - One batched Haiku 4.5 call for all emails in the window, not N Sonnet calls.
//   - 30s cooldown — rapid double-taps silently no-op instead of re-billing.
//   - Returns early with 0/0 if no new emails — no Claude call at all.
//
// The hourly cron (email-cron.js) already covers everything within the hour,
// so a steady-state click here almost always finds 0 new emails and costs £0.
// First click after connect finds up to ~48h of inbox and costs one Haiku call.

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId required" });

  try {
    // Get connection
    const connRes = await fetch(
      `${process.env.VITE_SUPABASE_URL}/rest/v1/email_connections?user_id=eq.${userId}&select=*`,
      { headers: { "apikey": process.env.SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}` } }
    );
    const conns = await connRes.json();
    if (!conns?.length) return res.status(404).json({ error: "No email connection found" });

    const conn = conns[0];

    // ── Cooldown ──────────────────────────────────────────────────────────
    // If we checked in the last 30s, silently no-op. Returns success (not error)
    // so the client doesn't show a "Check failed" toast for a harmless retry.
    if (conn.last_checked) {
      const msSinceLast = Date.now() - new Date(conn.last_checked).getTime();
      if (msSinceLast < 30000) {
        return res.json({
          success: true,
          emailsChecked: 0,
          actionsCreated: 0,
          debug: ["Cooldown — checked in the last 30s, skipping"],
        });
      }
    }

    // Refresh token if needed
    let accessToken = conn.access_token;
    const isExpired = new Date(conn.expires_at) < new Date(Date.now() + 60000);
    if (isExpired) {
      const isGmail = conn.provider === "gmail";
      const tokenUrl = isGmail
        ? "https://oauth2.googleapis.com/token"
        : "https://login.microsoftonline.com/common/oauth2/v2.0/token";
      const body = isGmail
        ? new URLSearchParams({ client_id: process.env.GMAIL_CLIENT_ID, client_secret: process.env.GMAIL_CLIENT_SECRET, refresh_token: conn.refresh_token, grant_type: "refresh_token" })
        : new URLSearchParams({ client_id: process.env.OUTLOOK_CLIENT_ID, client_secret: process.env.OUTLOOK_CLIENT_SECRET, refresh_token: conn.refresh_token, grant_type: "refresh_token", scope: "offline_access Mail.ReadWrite Mail.Send User.Read" });
      const tRes = await fetch(tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
      const tokens = await tRes.json();
      if (!tokens.error) {
        accessToken = tokens.access_token;
        await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/email_connections?user_id=eq.${userId}&provider=eq.${conn.provider}`, {
          method: "PATCH",
          headers: { "apikey": process.env.SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: tokens.access_token, expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString() }),
        });
      }
    }

    // Helpers
    function decodeB64(data) {
      if (!data) return "";
      try { return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8"); } catch { return ""; }
    }
    function extractText(payload) {
      if (!payload) return "";
      if (payload.mimeType === "text/plain" && payload.body?.data) return decodeB64(payload.body.data);
      if (payload.mimeType === "text/html" && payload.body?.data) return decodeB64(payload.body.data).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (payload.parts) {
        const t = payload.parts.find(p => p.mimeType === "text/plain");
        if (t) return extractText(t);
        const h = payload.parts.find(p => p.mimeType === "text/html");
        if (h) return extractText(h);
        for (const p of payload.parts) { const r = extractText(p); if (r) return r; }
      }
      return "";
    }
    function getAtts(payload) {
      const a = [];
      if (!payload) return a;
      if (payload.filename && payload.body?.attachmentId) a.push({ id: payload.body.attachmentId, filename: payload.filename, mimeType: payload.mimeType });
      if (payload.parts) payload.parts.forEach(p => a.push(...getAtts(p)));
      return a;
    }

    // ── Scan window ───────────────────────────────────────────────────────
    // Only look at emails received since the last check. First-ever click
    // after OAuth connect has last_checked=null → 48h backfill. Every click
    // after uses the stored value (set by this handler OR by the hourly cron).
    // Steady state: cron runs hourly, so this window is usually <60 min.
    const since = conn.last_checked
      ? new Date(conn.last_checked)
      : new Date(Date.now() - 48 * 60 * 60 * 1000);

    let emails = [];
    const debugLog = [];
    debugLog.push(`Window: since ${since.toISOString()} (${conn.last_checked ? "incremental" : "first-run 48h backfill"})`);

    if (conn.provider === "gmail") {
      const afterSeconds = Math.floor(since.getTime() / 1000);
      const listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=after:${afterSeconds} -from:me`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const list = await listRes.json();
      if (list.error) {
        // Don't advance last_checked — a transient Gmail error shouldn't cause us
        // to skip emails forever. Surface the error so the user sees it.
        return res.status(500).json({ error: list.error.message || "Gmail query failed", debug: debugLog });
      }
      debugLog.push(`Gmail query returned ${list.messages?.length || 0} messages`);
      if (list.messages?.length) {
        const fetched = await Promise.all(list.messages.slice(0, 15).map(async (m) => {
          try {
            const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`, { headers: { Authorization: `Bearer ${accessToken}` } });
            const msg = await msgRes.json();
            const headers = msg.payload?.headers || [];
            const get = (n) => headers.find((h) => h.name === n)?.value || "";
            const bodyText = extractText(msg.payload) || msg.snippet || "";
            const atts = getAtts(msg.payload);
            const pdfAtts = atts.filter(a => a.mimeType?.includes("pdf") || a.filename?.toLowerCase().endsWith(".pdf"));
            return { id: m.id, from: get("From"), subject: get("Subject") || "(no subject)", snippet: msg.snippet || "", body: bodyText.slice(0, 1500), hasPdfAttachment: pdfAtts.length > 0, pdfAttachments: pdfAtts };
          } catch { return null; }
        }));
        emails = fetched.filter(Boolean);
      }
    } else {
      const url = `https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages?$top=15&$filter=receivedDateTime ge ${since.toISOString()}&$select=id,subject,from,receivedDateTime,body,bodyPreview,hasAttachments&$expand=attachments($select=id,name,contentType)`;
      const msgRes = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await msgRes.json();
      if (data.error) {
        return res.status(500).json({ error: data.error.message || "Outlook query failed", debug: debugLog });
      }
      debugLog.push(`Outlook query returned ${data.value?.length || 0} messages`);
      if (data.value?.length) {
        emails = data.value.map((msg) => {
          const bodyText = msg.body?.contentType === "html"
            ? (msg.body.content || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
            : (msg.body?.content || msg.bodyPreview || "");
          const atts = (msg.attachments || []).map(a => ({ id: a.id, filename: a.name, mimeType: a.contentType }));
          const pdfAtts = atts.filter(a => a.mimeType?.includes("pdf") || a.filename?.toLowerCase().endsWith(".pdf"));
          return { id: msg.id, from: msg.from?.emailAddress ? `${msg.from.emailAddress.name} <${msg.from.emailAddress.address}>` : "", subject: msg.subject || "(no subject)", snippet: msg.bodyPreview || "", body: bodyText.slice(0, 1500), hasPdfAttachment: pdfAtts.length > 0, pdfAttachments: pdfAtts };
        });
      }
    }

    // ── No new emails — advance last_checked and exit, no Claude call ─────
    if (!emails.length) {
      await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/email_connections?user_id=eq.${userId}&provider=eq.${conn.provider}`, {
        method: "PATCH",
        headers: { "apikey": process.env.SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ last_checked: new Date().toISOString() }),
      });
      return res.json({ success: true, emailsChecked: 0, actionsCreated: 0, debug: debugLog });
    }

    // Load AI feedback (recent dismissal reasons) and learned context — shared
    // across every email in the batch so we only fetch these once.
    const [feedbackRes, contextRes] = await Promise.all([
      fetch(
        `${process.env.VITE_SUPABASE_URL}/rest/v1/ai_feedback?user_id=eq.${userId}&order=created_at.desc&limit=20`,
        { headers: { "apikey": process.env.SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}` } }
      ),
      fetch(
        `${process.env.VITE_SUPABASE_URL}/rest/v1/ai_context?user_id=eq.${userId}`,
        { headers: { "apikey": process.env.SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}` } }
      ),
    ]);
    const feedbackData = await feedbackRes.json();
    const contextData = await contextRes.json();
    const recentFeedback = Array.isArray(feedbackData) ? feedbackData : [];
    const aiCtx = Array.isArray(contextData) && contextData.length > 0 ? contextData[0] : null;

    const feedbackSection = recentFeedback.length > 0
      ? `\nPAST MISTAKES TO AVOID:\n${recentFeedback.map(f => `- Email from "${f.email_from}" with subject "${f.email_subject}" was suggested as "${f.action_suggested}" but was dismissed because: ${f.reason}`).join("\n")}\n`
      : "";

    const contextSection = aiCtx
      ? `\nKNOWN BUSINESS CONTEXT (use this to improve accuracy):\n${aiCtx.suppliers?.length > 0 ? `- Known material suppliers: ${aiCtx.suppliers.map(s => `${s.name} (${s.from || "email"})`).join(", ")}` : ""}\n${aiCtx.contractors?.length > 0 ? `- Known CIS contractors: ${aiCtx.contractors.map(c => `${c.name} (${c.from || "email"})`).join(", ")}` : ""}\n${aiCtx.customers?.length > 0 ? `- Known customers: ${aiCtx.customers.map(c => c.name).join(", ")}` : ""}\n${aiCtx.job_types?.length > 0 ? `- Common job types: ${aiCtx.job_types.join(", ")}` : ""}\n`
      : "";

    // ── Batched Haiku call — one API request for ALL emails in the window ─
    // Same rich prompt as before (11 action types + feedback + context) but
    // run once with a JSON array response instead of N times with single objects.
    // Mirrors the proven pattern in email-cron.js.
    const emailList = emails.map((e, i) =>
      `Email ${i}:\nFrom: ${e.from}\nSubject: ${e.subject}\nBody: ${e.body}\nHas PDF attachment: ${e.hasPdfAttachment}${e.pdfAttachments?.length > 0 ? `\nPDF files: ${e.pdfAttachments.map(a => a.filename).join(", ")}` : ""}`
    ).join("\n\n---\n\n");

    const prompt = `You are an AI assistant for a UK sole-trader tradesperson. Analyse these ${emails.length} incoming email${emails.length === 1 ? "" : "s"} and identify the business action for each. Be AGGRESSIVE — when in doubt, suggest an action rather than ignoring.
${feedbackSection}${contextSection}
${emailList}

ACTION RULES:
1. BOOKING REQUEST — customer asking to book/schedule work (no prior quote mentioned) → "create_job"
2. PAYMENT CONFIRMATION — customer says they have paid, bank transfer sent, payment made → "mark_invoice_paid"
3. QUOTE ACCEPTANCE — customer saying yes to a quote, wants to proceed, going ahead with work → "accept_quote"
4. RESCHEDULE REQUEST — customer asking to move/change/postpone an existing appointment to a different date → "reschedule_job"
5. CANCELLATION REQUEST — customer cancelling a job, no longer needs the work, pulling out → "cancel_job"
6. JOB COMPLETION CONFIRMATION — customer confirming work is finished, happy with results, signing off on completed work → "update_job"
7. SUPPLIER MATERIAL INVOICE — supplier (Screwfix, Toolstation, City Plumbing, Travis Perkins, Wolseley, BSS, Plumb Center etc) sending material invoice/receipt with PDF → "add_materials"
8. CIS MONTHLY STATEMENT — main contractor sending a CIS monthly statement or deduction statement PDF showing gross pay, CIS deduction, net amount → "add_cis_statement"
9. NEW ENQUIRY — potential customer asking about work/prices → "create_enquiry"
10. SAVE CONTACT — someone providing their contact details → "save_customer"
11. IGNORE — newsletters, marketing, automated system emails, Google/Microsoft alerts, promotional offers, social media notifications → "ignore"

IMPORTANT DISTINCTIONS:
- "reschedule_job" = customer wants to MOVE an existing booking to a different date (not cancel, not a new booking)
- "cancel_job" = customer wants to CANCEL entirely — no longer wants the work done
- "update_job" = customer confirms the job IS DONE — only use when customer explicitly confirms completion or satisfaction
- "add_materials" = supplier invoice for physical goods/materials with a PDF
- "add_cis_statement" = monthly CIS deduction statement from a main contractor (shows gross, deduction, net)
- If unsure between materials and CIS statement, look at: is it from a building/construction contractor (CIS) or a merchant/supplier (materials)?

For accept_quote, create_job, create_enquiry, reschedule_job, cancel_job, and update_job — always set reply_to to the sender's email address.

Respond with ONLY a JSON array, one object per email, using the email_index to map back. Format:
[
  {
    "email_index": 0,
    "action_type": "create_job" | "accept_quote" | "create_enquiry" | "mark_invoice_paid" | "add_materials" | "add_cis_statement" | "save_customer" | "reschedule_job" | "cancel_job" | "update_job" | "ignore",
    "action_description": "One sentence describing what will happen",
    "action_data": {
      "customer": "name from email",
      "type": "job type",
      "date_text": "date/time mentioned",
      "new_date": "new requested date for reschedules",
      "address": "address if mentioned",
      "notes": "key details",
      "source": "Email",
      "message": "summary for enquiry",
      "urgent": false,
      "supplier": "supplier name for materials",
      "contractor_name": "contractor company name for CIS",
      "tax_month": "YYYY-MM format for CIS",
      "gross_amount": "gross amount as number for CIS",
      "deduction_amount": "deduction as number for CIS",
      "name": "name for contact",
      "email": "email for contact",
      "reply_to": "sender email address",
      "sender_name": "first name of sender"
    }
  }
]

Use "ignore" and empty action_data {} for spam, newsletters, promotions, or anything with no clear business action. Include an entry for every email — do not skip any.`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.VITE_ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2500,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const aiData = await aiRes.json();
    const text = aiData.content?.[0]?.text?.trim() || "[]";
    let analyses = [];
    try {
      const clean = text.replace(/```json|```/g, "").trim();
      const match = clean.match(/\[[\s\S]*\]/);
      analyses = JSON.parse(match ? match[0] : clean);
      if (!Array.isArray(analyses)) analyses = [];
    } catch (err) {
      debugLog.push(`JSON parse failed: ${err.message}`);
    }

    // Save actions — preserves per-email attachment enrichment for add_materials / add_cis_statement
    let actionsCreated = 0;
    for (const analysis of analyses) {
      if (!analysis || analysis.action_type === "ignore") continue;
      const email = emails[analysis.email_index];
      if (!email) continue;

      // For add_materials and add_cis_statement, store the attachment info so
      // we can parse the PDF on approval.
      if ((analysis.action_type === "add_materials" || analysis.action_type === "add_cis_statement") && email.pdfAttachments?.length > 0) {
        analysis.action_data = {
          ...analysis.action_data,
          message_id: email.id,
          attachment_id: email.pdfAttachments[0].id,
          attachment_filename: email.pdfAttachments[0].filename,
        };
      }

      debugLog.push(`"${email.subject}" → ${analysis.action_type}: ${analysis.action_description || "no description"}`);

      const saveRes = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/email_actions?on_conflict=user_id,email_id`, {
        method: "POST",
        headers: { "apikey": process.env.SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json", "Prefer": "resolution=ignore-duplicates" },
        body: JSON.stringify({ user_id: userId, email_id: email.id, email_from: email.from, email_subject: email.subject, email_snippet: (email.snippet || "").slice(0, 300), action_type: analysis.action_type, action_data: analysis.action_data || {}, action_description: analysis.action_description || "", status: "pending" }),
      });
      if (saveRes.ok) actionsCreated++;
    }

    // Send push notification if new actions were created
    if (actionsCreated > 0) {
      fetch(`${process.env.APP_URL}/api/push/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          title: `Trade PA — ${actionsCreated} new action${actionsCreated > 1 ? "s" : ""}`,
          body: actionsCreated === 1 ? `${debugLog[debugLog.length - 1]?.split(" → ")[1] || "Review in your Inbox"}` : `${actionsCreated} emails processed and ready to approve`,
          url: "/",
          type: "ai_action",
          tag: "ai-action",
        }),
      }).catch(() => {});
    }

    // Update last_checked — both success and Claude-parse-failure advance the
    // pointer so we don't re-bill on the next click. A transient Gmail/Outlook
    // API failure already returned 500 above without reaching here.
    await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/email_connections?user_id=eq.${userId}&provider=eq.${conn.provider}`, {
      method: "PATCH",
      headers: { "apikey": process.env.SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ last_checked: new Date().toISOString() }),
    });

    return res.json({ success: true, emailsChecked: emails.length, actionsCreated, debug: debugLog });
  } catch (err) {
    console.error("Email check error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
