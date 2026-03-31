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

    // Fetch emails
    // Always check last 48 hours - duplicates safely ignored by unique constraint on email_id
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
    let emails = [];
    const debugLog = [];

    if (conn.provider === "gmail") {
      const afterSeconds = Math.floor(since.getTime() / 1000);
      // Removed category filters - they can block valid customer emails
      const listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=after:${afterSeconds} -from:me`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const list = await listRes.json();
      debugLog.push(`Gmail query returned ${list.messages?.length || 0} messages`);
      if (list.error) debugLog.push(`Gmail error: ${JSON.stringify(list.error)}`);
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

    // Analyse with Claude
    let actionsCreated = 0;
    for (const email of emails) {
      const prompt = `You are an AI assistant for a UK sole-trader tradesperson. Analyse this email and identify the business action to take. Be AGGRESSIVE — when in doubt, suggest an action rather than ignoring.

Email from: ${email.from}
Subject: ${email.subject}
Body: ${email.body}
Has PDF attachment: ${email.hasPdfAttachment}
${email.pdfAttachments?.length > 0 ? `PDF files: ${email.pdfAttachments.map(a => a.filename).join(", ")}` : ""}

ACTION RULES:
1. BOOKING REQUEST — customer asking to book/schedule work (no prior quote mentioned) → "create_job"
2. PAYMENT CONFIRMATION — customer says they have paid → "mark_invoice_paid"
3. QUOTE ACCEPTANCE — customer saying yes to a quote, wants to proceed, going ahead with work → "accept_quote" (NOT create_job — this needs the quote converted to invoice AND a reply sent)
4. SUPPLIER PDF INVOICE — supplier sending material invoice/receipt with PDF → "add_materials"
5. NEW ENQUIRY — potential customer asking about work/prices → "create_enquiry"
6. SAVE CONTACT — someone providing contact details → "save_customer"
7. IGNORE — newsletters, marketing, automated system emails only → "ignore"

For accept_quote, extract: customer name, job/address mentioned, the sender's email address so we can reply.
For create_job and create_enquiry, always set reply_to to the sender's email address so we can send a confirmation reply.

Respond ONLY with JSON:
{"action_type":"create_job"|"accept_quote"|"create_enquiry"|"mark_invoice_paid"|"add_materials"|"save_customer"|"ignore","action_description":"One sentence describing what will happen","action_data":{"customer":"name extracted from email signature or body","type":"job type e.g. Boiler Service","date_text":"date/time mentioned","address":"address if mentioned","notes":"key details","source":"Email","message":"summary for enquiry","urgent":false,"supplier":"supplier name for materials","name":"name for contact","email":"email for contact","reply_to":"sender email address","sender_name":"first name of sender"}}`;

      const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": process.env.VITE_ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 500, messages: [{ role: "user", content: prompt }] }),
      });
      const aiData = await aiRes.json();
      const text = aiData.content?.[0]?.text?.trim() || "{}";
      let analysis = { action_type: "ignore" };
      try { const m = text.match(/\{[\s\S]*\}/); if (m) analysis = JSON.parse(m[0]); } catch {}

      debugLog.push(`"${email.subject}" → ${analysis.action_type}: ${analysis.action_description || "no description"}`);

      if (analysis.action_type !== "ignore") {
        // For add_materials, store the attachment info so we can parse the PDF on approval
        if (analysis.action_type === "add_materials" && email.pdfAttachments?.length > 0) {
          analysis.action_data = {
            ...analysis.action_data,
            message_id: email.id,
            attachment_id: email.pdfAttachments[0].id,
            attachment_filename: email.pdfAttachments[0].filename,
          };
        }

        const saveRes = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/email_actions?on_conflict=user_id,email_id`, {
          method: "POST",
          headers: { "apikey": process.env.SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates" },
          body: JSON.stringify({ user_id: userId, email_id: email.id, email_from: email.from, email_subject: email.subject, email_snippet: (email.snippet || "").slice(0, 300), action_type: analysis.action_type, action_data: analysis.action_data || {}, action_description: analysis.action_description || "", status: "pending" }),
        });
        if (saveRes.ok) actionsCreated++;
      }
    }

    // Update last_checked
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
