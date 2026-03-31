async function getEmailConnections() {
  const res = await fetch(
    `${process.env.VITE_SUPABASE_URL}/rest/v1/email_connections?select=*`,
    {
      headers: {
        "apikey": process.env.SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      },
    }
  );
  return await res.json();
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

  await fetch(
    `${process.env.VITE_SUPABASE_URL}/rest/v1/email_connections?user_id=eq.${conn.user_id}&provider=eq.${conn.provider}`,
    {
      method: "PATCH",
      headers: { "apikey": process.env.SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: tokens.access_token, expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(), updated_at: new Date().toISOString() }),
    }
  );
  return tokens.access_token;
}

async function getValidToken(conn) {
  const isExpired = new Date(conn.expires_at) < new Date(Date.now() + 60000);
  if (!isExpired) return conn.access_token;
  return await refreshToken(conn);
}

async function fetchNewEmails(conn, token) {
  const since = conn.last_checked
    ? new Date(conn.last_checked)
    : new Date(Date.now() - 24 * 60 * 60 * 1000);

  if (conn.provider === "gmail") {
    const afterSeconds = Math.floor(since.getTime() / 1000);
    const params = new URLSearchParams({ maxResults: "20", q: `after:${afterSeconds} -from:me` });
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const list = await listRes.json();
    if (!list.messages?.length) return [];

    const emails = await Promise.all(
      list.messages.slice(0, 10).map(async (m) => {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const msg = await msgRes.json();
        const headers = msg.payload?.headers || [];
        const get = (n) => headers.find((h) => h.name === n)?.value || "";
        let body = msg.snippet || "";
        const hasPdf = msg.payload?.parts?.some((p) => p.mimeType === "application/pdf" && p.body?.attachmentId);
        return {
          id: m.id,
          from: get("From"),
          subject: get("Subject") || "(no subject)",
          date: get("Date"),
          snippet: msg.snippet || "",
          body: body.slice(0, 500),
          hasPdfAttachment: hasPdf || false,
        };
      })
    );
    return emails;
  } else {
    const sinceIso = since.toISOString();
    const url = `https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages?$top=10&$filter=receivedDateTime ge ${sinceIso} and from/emailAddress/address ne me&$select=id,subject,from,receivedDateTime,bodyPreview,hasAttachments`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.error || !data.value?.length) return [];
    return data.value.map((msg) => ({
      id: msg.id,
      from: msg.from?.emailAddress ? `${msg.from.emailAddress.name} <${msg.from.emailAddress.address}>` : "",
      subject: msg.subject || "(no subject)",
      date: msg.receivedDateTime,
      snippet: msg.bodyPreview || "",
      body: (msg.bodyPreview || "").slice(0, 500),
      hasPdfAttachment: msg.hasAttachments || false,
    }));
  }
}

async function analyseEmailWithClaude(email) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.VITE_ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: `You are an assistant for a UK sole-trader tradesperson. Analyse this incoming email and decide what business action should be taken, if any.

Email from: ${email.from}
Subject: ${email.subject}
Content: ${email.body}
Has PDF attachment: ${email.hasPdfAttachment}

Respond with ONLY a JSON object in this exact format:
{
  "action_type": one of: "create_job" | "create_enquiry" | "mark_invoice_paid" | "add_materials" | "save_customer" | "ignore",
  "action_description": "A clear one-sentence description of what will be done",
  "action_data": {
    For create_job: { "customer": "name", "type": "job type", "address": "", "notes": "details from email" }
    For create_enquiry: { "name": "customer name", "source": "Email", "message": "what they want", "urgent": false }
    For mark_invoice_paid: { "customer": "name", "notes": "payment details from email" }
    For add_materials: { "supplier": "supplier name", "notes": "parse PDF attachment for items" }
    For save_customer: { "name": "name", "email": "email address", "phone": "", "notes": "" }
    For ignore: {}
  }
}

Only suggest meaningful actions. If the email is spam, a newsletter, or irrelevant, use "ignore".`,
      }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text?.trim() || "{}";
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return { action_type: "ignore", action_description: "Could not parse email", action_data: {} };
  }
}

async function saveAction(userId, email, analysis) {
  if (analysis.action_type === "ignore") return;

  const res = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/email_actions`, {
    method: "POST",
    headers: {
      "apikey": process.env.SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "resolution=ignore-duplicates",
    },
    body: JSON.stringify({
      user_id: userId,
      email_id: email.id,
      email_from: email.from,
      email_subject: email.subject,
      email_snippet: email.snippet,
      action_type: analysis.action_type,
      action_data: analysis.action_data,
      action_description: analysis.action_description,
      status: "pending",
    }),
  });
  return res.ok;
}

async function updateLastChecked(userId, provider) {
  await fetch(
    `${process.env.VITE_SUPABASE_URL}/rest/v1/email_connections?user_id=eq.${userId}&provider=eq.${provider}`,
    {
      method: "PATCH",
      headers: {
        "apikey": process.env.SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ last_checked: new Date().toISOString() }),
    }
  );
}

export default async function handler(req, res) {
  // Verify this is a legitimate cron call
  const authHeader = req.headers["authorization"];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const connections = await getEmailConnections();
    if (!connections?.length) return res.json({ processed: 0 });

    let totalProcessed = 0;
    let totalActions = 0;

    for (const conn of connections) {
      try {
        const token = await getValidToken(conn);
        const emails = await fetchNewEmails(conn, token);

        for (const email of emails) {
          const analysis = await analyseEmailWithClaude(email);
          const saved = await saveAction(conn.user_id, email, analysis);
          if (saved) totalActions++;
          totalProcessed++;
        }

        await updateLastChecked(conn.user_id, conn.provider);
      } catch (err) {
        console.error(`Error processing ${conn.provider} for user ${conn.user_id}:`, err.message);
      }
    }

    res.json({ success: true, processed: totalProcessed, actions: totalActions });
  } catch (err) {
    console.error("Cron error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
// file saved
