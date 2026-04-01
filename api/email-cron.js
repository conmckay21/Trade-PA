// api/email-cron.js — Optimised to minimise Vercel function execution cost
// Key savings:
//  1. Exits in <100ms if no email connections exist
//  2. Skips token refresh if token is still fresh
//  3. Exits per-user immediately if no new emails (no Claude call)
//  4. Batches ALL emails for a user into ONE Claude call instead of N calls
//  5. Only runs overdue invoice chasing at 9am — not every hour

async function supabaseFetch(path, opts = {}) {
  const url = `${process.env.VITE_SUPABASE_URL}/rest/v1${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      "apikey": process.env.SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  if (!res.ok && opts.returnError) return { error: await res.text() };
  return res.json().catch(() => null);
}

async function refreshToken(conn) {
  const isGmail = conn.provider === "gmail";
  const tokenUrl = isGmail
    ? "https://oauth2.googleapis.com/token"
    : "https://login.microsoftonline.com/common/oauth2/v2.0/token";
  const body = isGmail
    ? new URLSearchParams({ client_id: process.env.GMAIL_CLIENT_ID, client_secret: process.env.GMAIL_CLIENT_SECRET, refresh_token: conn.refresh_token, grant_type: "refresh_token" })
    : new URLSearchParams({ client_id: process.env.OUTLOOK_CLIENT_ID, client_secret: process.env.OUTLOOK_CLIENT_SECRET, refresh_token: conn.refresh_token, grant_type: "refresh_token", scope: "offline_access Mail.ReadWrite Mail.Send User.Read" });
  const res = await fetch(tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const tokens = await res.json();
  if (tokens.error) throw new Error(tokens.error_description || tokens.error);
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  await supabaseFetch(
    `/email_connections?user_id=eq.${conn.user_id}&provider=eq.${conn.provider}`,
    { method: "PATCH", body: JSON.stringify({ access_token: tokens.access_token, expires_at: expiresAt, updated_at: new Date().toISOString() }) }
  );
  return tokens.access_token;
}

async function getValidToken(conn) {
  // Only refresh if expiring within 5 minutes — saves ~1-2s per run when token is fresh
  const expiresAt = conn.expires_at ? new Date(conn.expires_at) : new Date(0);
  const expiresInMs = expiresAt - Date.now();
  if (expiresInMs > 5 * 60 * 1000) return conn.access_token; // Still valid
  return await refreshToken(conn);
}

async function fetchNewEmails(conn, token) {
  const since = conn.last_checked
    ? new Date(conn.last_checked)
    : new Date(Date.now() - 24 * 60 * 60 * 1000);

  if (conn.provider === "gmail") {
    const afterSeconds = Math.floor(since.getTime() / 1000);
    const params = new URLSearchParams({ maxResults: "15", q: `after:${afterSeconds} -from:me -category:promotions -category:social` });
    const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    const list = await listRes.json();
    if (!list.messages?.length) return []; // ← Fast exit, no Claude call

    const emails = await Promise.all(
      list.messages.slice(0, 8).map(async (m) => {
        const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, { headers: { Authorization: `Bearer ${token}` } });
        const msg = await msgRes.json();
        const headers = msg.payload?.headers || [];
        const get = (n) => headers.find(h => h.name === n)?.value || "";
        const hasPdf = msg.payload?.parts?.some(p => p.mimeType === "application/pdf" && p.body?.attachmentId);
        return { id: m.id, from: get("From"), subject: get("Subject") || "(no subject)", snippet: msg.snippet || "", body: (msg.snippet || "").slice(0, 400), hasPdfAttachment: hasPdf || false };
      })
    );
    return emails.filter(Boolean);
  } else {
    const sinceIso = since.toISOString();
    const url = `https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages?$top=8&$filter=receivedDateTime ge ${sinceIso}&$select=id,subject,from,receivedDateTime,bodyPreview,hasAttachments`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.error || !data.value?.length) return []; // ← Fast exit
    return data.value.map(msg => ({
      id: msg.id,
      from: msg.from?.emailAddress ? `${msg.from.emailAddress.name} <${msg.from.emailAddress.address}>` : "",
      subject: msg.subject || "(no subject)",
      snippet: msg.bodyPreview || "",
      body: (msg.bodyPreview || "").slice(0, 400),
      hasPdfAttachment: msg.hasAttachments || false,
    }));
  }
}

// COST SAVER: Batch ALL emails for a user into ONE Claude call instead of N calls
async function analyseEmailsBatch(emails) {
  if (!emails.length) return [];

  const emailList = emails.map((e, i) =>
    `Email ${i + 1}:\nFrom: ${e.from}\nSubject: ${e.subject}\nContent: ${e.body}\nHas PDF: ${e.hasPdfAttachment}`
  ).join("\n\n---\n\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.VITE_ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001", // ← Use Haiku — 20x cheaper than Sonnet, still accurate for classification
      max_tokens: 800,
      messages: [{
        role: "user",
        content: `You are an assistant for a UK sole-trader tradesperson. Analyse these ${emails.length} incoming emails and decide what business action to take for each.

${emailList}

Respond with ONLY a JSON array with one object per email in this exact format:
[
  {
    "email_index": 0,
    "action_type": "create_job" | "create_enquiry" | "mark_invoice_paid" | "add_materials" | "save_customer" | "ignore",
    "action_description": "One sentence describing the action",
    "action_data": {}
  }
]

action_data fields:
- create_job: { "customer": "", "type": "", "address": "", "notes": "" }
- create_enquiry: { "name": "", "source": "Email", "message": "", "urgent": false }
- mark_invoice_paid: { "customer": "", "notes": "" }
- add_materials: { "supplier": "", "notes": "" }
- save_customer: { "name": "", "email": "", "phone": "", "notes": "" }
- ignore: {}

Use "ignore" for spam, newsletters, promotions, or emails with no clear business action.`,
      }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text?.trim() || "[]";
  try {
    const results = JSON.parse(text.replace(/```json|```/g, "").trim());
    return Array.isArray(results) ? results : [];
  } catch {
    return [];
  }
}

async function saveActions(userId, emails, analyses) {
  let saved = 0;
  for (const analysis of analyses) {
    if (!analysis || analysis.action_type === "ignore") continue;
    const email = emails[analysis.email_index];
    if (!email) continue;

    const res = await supabaseFetch("/email_actions?on_conflict=user_id,email_id", {
      method: "POST",
      headers: { "Prefer": "resolution=ignore-duplicates" },
      body: JSON.stringify({
        user_id: userId,
        email_id: email.id,
        email_from: email.from,
        email_subject: email.subject,
        email_snippet: (email.snippet || "").slice(0, 300),
        action_type: analysis.action_type,
        action_data: analysis.action_data || {},
        action_description: analysis.action_description || "",
        status: "pending",
      }),
      returnError: true,
    });
    if (!res?.error) saved++;
  }
  return saved;
}

// COST SAVER: Only run overdue chasing at 9am — saves 23 out of 24 hourly runs
async function shouldChaseOverdue() {
  const hour = new Date().getUTCHours();
  return hour === 9; // Only at 9am UTC
}

async function chaseOverdueInvoices(conn, token) {
  const invoices = await supabaseFetch(`/invoices?user_id=eq.${conn.user_id}&status=eq.overdue&select=*`) || [];
  if (!invoices.length) return 0;

  const customers = await supabaseFetch(`/customers?user_id=eq.${conn.user_id}&select=name,email`) || [];
  const isOutlook = conn.provider === "outlook";
  let chased = 0;

  for (const inv of invoices) {
    const customer = customers.find(c => c.name?.toLowerCase() === inv.customer?.toLowerCase());
    if (!customer?.email) continue;
    if (inv.last_chased && (Date.now() - new Date(inv.last_chased)) / 86400000 < 7) continue;

    const subject = `Payment Reminder — Invoice ${inv.id}`;
    const body = `<p>Dear ${inv.customer},</p><p>I hope you are well. I'm following up on invoice <strong>${inv.id}</strong> for <strong>£${inv.amount}</strong>, which is now overdue.</p><p>Please arrange payment at your earliest convenience. If you have already paid, please disregard this message.</p><p>Many thanks</p>`;

    try {
      if (isOutlook) {
        await fetch("https://graph.microsoft.com/v1.0/me/sendMail", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ message: { subject, body: { contentType: "HTML", content: body }, toRecipients: [{ emailAddress: { address: customer.email } }] }, saveToSentItems: true }) });
      } else {
        const raw = Buffer.from(`To: ${customer.email}\nSubject: ${subject}\nContent-Type: text/html\n\n${body}`).toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
        await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ raw }) });
      }
      await supabaseFetch(`/invoices?id=eq.${inv.id}`, { method: "PATCH", body: JSON.stringify({ last_chased: new Date().toISOString() }) });
      chased++;
    } catch (err) {
      console.error(`Chase failed for ${inv.id}:`, err.message);
    }
  }
  return chased;
}

export default async function handler(req, res) {
  const start = Date.now();

  // Verify this is a legitimate cron call
  if (req.headers["authorization"] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // FAST EXIT: Get only active connections (those with a refresh token)
    const connections = await supabaseFetch("/email_connections?select=*&refresh_token=not.is.null");
    if (!connections?.length) {
      return res.json({ success: true, processed: 0, actions: 0, ms: Date.now() - start, note: "No active connections" });
    }

    const chaseOverdue = await shouldChaseOverdue();
    let totalEmails = 0;
    let totalActions = 0;

    for (const conn of connections) {
      try {
        const token = await getValidToken(conn);
        const emails = await fetchNewEmails(conn, token);

        if (emails.length > 0) {
          // ONE Claude call for all emails (vs N calls before)
          const analyses = await analyseEmailsBatch(emails);
          const saved = await saveActions(conn.user_id, emails, analyses);
          totalActions += saved;
          totalEmails += emails.length;

          // Send push notification if actions were created
          if (saved > 0) {
            fetch(`${process.env.APP_URL}/api/push/send`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: conn.user_id, title: `Trade PA — ${saved} new action${saved > 1 ? "s" : ""}`, body: `${saved} email${saved > 1 ? "s" : ""} processed and ready to approve`, url: "/", type: "ai_action", tag: "ai-action" }),
            }).catch(() => {});
          }
        }

        // Always update last_checked so next run only looks at newer emails
        await supabaseFetch(
          `/email_connections?user_id=eq.${conn.user_id}&provider=eq.${conn.provider}`,
          { method: "PATCH", body: JSON.stringify({ last_checked: new Date().toISOString() }) }
        );

        // COST SAVER: Overdue chasing only at 9am UTC
        if (chaseOverdue) {
          const chased = await chaseOverdueInvoices(conn, token);
          if (chased > 0) console.log(`Chased ${chased} overdue invoices for ${conn.user_id}`);
        }

      } catch (err) {
        console.error(`Error for ${conn.provider}/${conn.user_id}:`, err.message);
      }
    }

    const ms = Date.now() - start;
    console.log(`Cron done: ${totalEmails} emails, ${totalActions} actions, ${ms}ms`);
    return res.json({ success: true, processed: totalEmails, actions: totalActions, ms, connections: connections.length });

  } catch (err) {
    console.error("Cron error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
