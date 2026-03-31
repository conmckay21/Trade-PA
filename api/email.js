async function upsertEmailConnection(userId, data) {
  const res = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/email_connections`, {
    method: "POST",
    headers: {
      "apikey": process.env.SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates",
    },
    body: JSON.stringify({ user_id: userId, ...data }),
  });
  if (!res.ok) throw new Error(await res.text());
}

async function getToken(userId, provider) {
  const res = await fetch(
    `${process.env.VITE_SUPABASE_URL}/rest/v1/email_connections?user_id=eq.${userId}&provider=eq.${provider}&select=*`,
    { headers: { "apikey": process.env.SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}` } }
  );
  const rows = await res.json();
  const data = rows?.[0];
  if (!data) throw new Error(`No ${provider} connection found`);

  const isExpired = new Date(data.expires_at) < new Date(Date.now() + 60000);
  if (!isExpired) return data.access_token;

  const tokenUrl = provider === "gmail"
    ? "https://oauth2.googleapis.com/token"
    : "https://login.microsoftonline.com/common/oauth2/v2.0/token";

  const body = provider === "gmail"
    ? new URLSearchParams({ client_id: process.env.GMAIL_CLIENT_ID, client_secret: process.env.GMAIL_CLIENT_SECRET, refresh_token: data.refresh_token, grant_type: "refresh_token" })
    : new URLSearchParams({ client_id: process.env.OUTLOOK_CLIENT_ID, client_secret: process.env.OUTLOOK_CLIENT_SECRET, refresh_token: data.refresh_token, grant_type: "refresh_token", scope: "offline_access Mail.ReadWrite Mail.Send User.Read" });

  const tokenRes = await fetch(tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const tokens = await tokenRes.json();
  if (tokens.error) throw new Error(tokens.error_description || tokens.error);

  await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/email_connections?user_id=eq.${userId}&provider=eq.${provider}`, {
    method: "PATCH",
    headers: { "apikey": process.env.SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: tokens.access_token, expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(), updated_at: new Date().toISOString() }),
  });

  return tokens.access_token;
}

function decodeBody(data) {
  if (!data) return "";
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function extractParts(payload, parts = [], attachments = []) {
  if (payload.mimeType === "text/plain" || payload.mimeType === "text/html") {
    parts.push({ type: payload.mimeType, body: decodeBody(payload.body?.data) });
  }
  if (payload.filename && payload.body?.attachmentId) {
    attachments.push({ id: payload.body.attachmentId, filename: payload.filename, mimeType: payload.mimeType, size: payload.body.size });
  }
  if (payload.parts) payload.parts.forEach((p) => extractParts(p, parts, attachments));
  return { parts, attachments };
}

function makeGmailRaw({ to, from, subject, body, attachmentBase64, attachmentName }) {
  const boundary = `boundary_${Date.now()}`;
  let raw;
  if (attachmentBase64) {
    raw = [`From: ${from}`, `To: ${to}`, `Subject: ${subject}`, "MIME-Version: 1.0", `Content-Type: multipart/mixed; boundary="${boundary}"`, "", `--${boundary}`, "Content-Type: text/html; charset=utf-8", "", body, "", `--${boundary}`, `Content-Type: application/pdf; name="${attachmentName || "invoice.pdf"}"`, "Content-Transfer-Encoding: base64", `Content-Disposition: attachment; filename="${attachmentName || "invoice.pdf"}"`, "", attachmentBase64, "", `--${boundary}--`].join("\r\n");
  } else {
    raw = [`From: ${from}`, `To: ${to}`, `Subject: ${subject}`, "MIME-Version: 1.0", "Content-Type: text/html; charset=utf-8", "", body].join("\r\n");
  }
  return Buffer.from(raw).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export default async function handler(req, res) {
  const path = req.url.split("?")[0];

  // ── Gmail Connect ──────────────────────────────────────────────────────────
  if (path === "/api/auth/gmail/connect") {
    const { userId } = req.query;
    const scopes = ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/gmail.modify"].join(" ");
    const params = new URLSearchParams({ client_id: process.env.GMAIL_CLIENT_ID, redirect_uri: process.env.GMAIL_REDIRECT_URI, response_type: "code", scope: scopes, access_type: "offline", prompt: "consent", state: userId || "" });
    return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  }

  // ── Gmail Callback ─────────────────────────────────────────────────────────
  if (path === "/api/auth/gmail/callback") {
    const { code, state: userId, error } = req.query;
    if (error) return res.redirect(`${process.env.APP_URL}?email_error=${error}`);
    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: process.env.GMAIL_CLIENT_ID, client_secret: process.env.GMAIL_CLIENT_SECRET, redirect_uri: process.env.GMAIL_REDIRECT_URI, grant_type: "authorization_code" }) });
      const tokens = await tokenRes.json();
      if (tokens.error) throw new Error(tokens.error_description || tokens.error);
      const profile = await (await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` } })).json();
      await upsertEmailConnection(userId, { provider: "gmail", email: profile.email, access_token: tokens.access_token, refresh_token: tokens.refresh_token, expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(), updated_at: new Date().toISOString() });
      return res.redirect(`${process.env.APP_URL}?email_connected=gmail`);
    } catch (err) {
      return res.redirect(`${process.env.APP_URL}?email_error=${encodeURIComponent(err.message)}`);
    }
  }

  // ── Outlook Connect ────────────────────────────────────────────────────────
  if (path === "/api/auth/outlook/connect") {
    const { userId } = req.query;
    const params = new URLSearchParams({ client_id: process.env.OUTLOOK_CLIENT_ID, redirect_uri: process.env.OUTLOOK_REDIRECT_URI, response_type: "code", scope: "offline_access Mail.ReadWrite Mail.Send User.Read", response_mode: "query", state: userId || "" });
    return res.redirect(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`);
  }

  // ── Outlook Callback ───────────────────────────────────────────────────────
  if (path === "/api/auth/outlook/callback") {
    const { code, state: userId, error } = req.query;
    if (error) return res.redirect(`${process.env.APP_URL}?email_error=${error}`);
    try {
      const tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: process.env.OUTLOOK_CLIENT_ID, client_secret: process.env.OUTLOOK_CLIENT_SECRET, redirect_uri: process.env.OUTLOOK_REDIRECT_URI, grant_type: "authorization_code", scope: "offline_access Mail.ReadWrite Mail.Send User.Read" }) });
      const tokens = await tokenRes.json();
      if (tokens.error) throw new Error(tokens.error_description || tokens.error);
      const profile = await (await fetch("https://graph.microsoft.com/v1.0/me", { headers: { Authorization: `Bearer ${tokens.access_token}` } })).json();
      await upsertEmailConnection(userId, { provider: "outlook", email: profile.mail || profile.userPrincipalName, access_token: tokens.access_token, refresh_token: tokens.refresh_token, expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(), updated_at: new Date().toISOString() });
      return res.redirect(`${process.env.APP_URL}?email_connected=outlook`);
    } catch (err) {
      return res.redirect(`${process.env.APP_URL}?email_error=${encodeURIComponent(err.message)}`);
    }
  }

  // ── Gmail Inbox ────────────────────────────────────────────────────────────
  if (path === "/api/gmail/inbox") {
    const { userId, pageToken, label = "INBOX" } = req.query;
    try {
      const token = await getToken(userId, "gmail");
      const params = new URLSearchParams({ maxResults: "20", labelIds: label });
      if (pageToken) params.set("pageToken", pageToken);
      const list = await (await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads?${params}`, { headers: { Authorization: `Bearer ${token}` } })).json();
      if (!list.threads?.length) return res.json({ threads: [], nextPageToken: null });
      const threads = await Promise.all(list.threads.map(async (t) => {
        const thread = await (await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${t.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`, { headers: { Authorization: `Bearer ${token}` } })).json();
        const msg = thread.messages?.[thread.messages.length - 1];
        const headers = msg?.payload?.headers || [];
        const get = (n) => headers.find((h) => h.name === n)?.value || "";
        return { id: t.id, messageCount: thread.messages?.length || 1, subject: get("Subject") || "(no subject)", from: get("From"), to: get("To"), date: get("Date"), snippet: msg?.snippet || "", unread: msg?.labelIds?.includes("UNREAD") || false, hasAttachment: msg?.payload?.parts?.some((p) => p.filename) || false };
      }));
      return res.json({ threads, nextPageToken: list.nextPageToken || null });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  // ── Gmail Thread ───────────────────────────────────────────────────────────
  if (path === "/api/gmail/thread") {
    const { userId, threadId } = req.query;
    try {
      const token = await getToken(userId, "gmail");
      const thread = await (await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`, { headers: { Authorization: `Bearer ${token}` } })).json();
      const messages = (thread.messages || []).map((msg) => {
        const headers = msg.payload?.headers || [];
        const get = (n) => headers.find((h) => h.name === n)?.value || "";
        const { parts, attachments } = extractParts(msg.payload);
        const body = parts.find((p) => p.type === "text/html")?.body || parts.find((p) => p.type === "text/plain")?.body || msg.snippet || "";
        return { id: msg.id, from: get("From"), to: get("To"), subject: get("Subject"), date: get("Date"), body, isHtml: parts.some((p) => p.type === "text/html"), attachments, unread: msg.labelIds?.includes("UNREAD") };
      });
      await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}/modify`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ removeLabelIds: ["UNREAD"] }) });
      return res.json({ messages });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  // ── Gmail Send ─────────────────────────────────────────────────────────────
  if (path === "/api/gmail/send") {
    const { userId, to, subject, body, attachmentBase64, attachmentName, threadId } = req.body;
    try {
      const token = await getToken(userId, "gmail");
      const profile = await (await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers: { Authorization: `Bearer ${token}` } })).json();
      const raw = makeGmailRaw({ to, from: profile.emailAddress, subject, body, attachmentBase64, attachmentName });
      const payload = { raw };
      if (threadId) payload.threadId = threadId;
      const result = await (await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) })).json();
      if (result.error) throw new Error(result.error.message);
      return res.json({ success: true, messageId: result.id });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  // ── Gmail Parse Supplier ───────────────────────────────────────────────────
  if (path === "/api/gmail/parse-supplier") {
    const { userId, messageId, attachmentId } = req.body;
    try {
      const token = await getToken(userId, "gmail");
      const attData = await (await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`, { headers: { Authorization: `Bearer ${token}` } })).json();
      const pdfBase64 = attData.data.replace(/-/g, "+").replace(/_/g, "/");
      const aiData = await (await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": process.env.VITE_ANTHROPIC_KEY, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } }, { type: "text", text: `Extract all line items and return ONLY a JSON array.\nFormat: [{"item": "name", "qty": number, "unit": "each", "unitPrice": number, "total": number}]` }] }] }) })).json();
      let items = [];
      try { items = JSON.parse(aiData.content?.[0]?.text?.trim().replace(/```json|```/g, "") || "[]"); } catch {}
      return res.json({ success: true, items });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  // ── Outlook Inbox ──────────────────────────────────────────────────────────
  if (path === "/api/outlook/inbox") {
    const { userId, skipToken } = req.query;
    try {
      const token = await getToken(userId, "outlook");
      let url = "https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages?$top=20&$orderby=receivedDateTime desc&$select=id,subject,from,toRecipients,receivedDateTime,bodyPreview,isRead,hasAttachments,conversationId";
      if (skipToken) url += `&$skiptoken=${encodeURIComponent(skipToken)}`;
      const data = await (await fetch(url, { headers: { Authorization: `Bearer ${token}` } })).json();
      if (data.error) throw new Error(data.error.message);
      const threads = (data.value || []).map((msg) => ({ id: msg.conversationId, messageId: msg.id, subject: msg.subject || "(no subject)", from: msg.from?.emailAddress ? `${msg.from.emailAddress.name} <${msg.from.emailAddress.address}>` : "", to: msg.toRecipients?.[0]?.emailAddress?.address || "", date: msg.receivedDateTime, snippet: msg.bodyPreview || "", unread: !msg.isRead, hasAttachment: msg.hasAttachments || false, messageCount: 1 }));
      let nextSkipToken = null;
      const nextLink = data["@odata.nextLink"] || null;
      if (nextLink) { const match = nextLink.match(/\$skiptoken=([^&]+)/); if (match) nextSkipToken = decodeURIComponent(match[1]); }
      return res.json({ threads, nextPageToken: nextSkipToken });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  // ── Outlook Thread ─────────────────────────────────────────────────────────
  if (path === "/api/outlook/thread") {
    const { userId, messageId } = req.query;
    try {
      const token = await getToken(userId, "outlook");
      const msg = await (await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}?$select=id,subject,from,toRecipients,receivedDateTime,body,hasAttachments`, { headers: { Authorization: `Bearer ${token}` } })).json();
      if (msg.error) throw new Error(msg.error.message);
      let attachments = [];
      if (msg.hasAttachments) {
        const attData = await (await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments?$select=id,name,contentType,size`, { headers: { Authorization: `Bearer ${token}` } })).json();
        attachments = (attData.value || []).map((a) => ({ id: a.id, filename: a.name, mimeType: a.contentType, size: a.size }));
      }
      await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ isRead: true }) });
      return res.json({ messages: [{ id: msg.id, from: msg.from?.emailAddress ? `${msg.from.emailAddress.name} <${msg.from.emailAddress.address}>` : "", to: msg.toRecipients?.map((r) => r.emailAddress?.address).join(", ") || "", subject: msg.subject, date: msg.receivedDateTime, body: msg.body?.content || "", isHtml: msg.body?.contentType === "html", attachments, unread: false }] });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  // ── Outlook Send ───────────────────────────────────────────────────────────
  if (path === "/api/outlook/send") {
    const { userId, to, subject, body, attachmentBase64, attachmentName, replyToId } = req.body;
    try {
      const token = await getToken(userId, "outlook");
      const message = { subject, body: { contentType: "HTML", content: body }, toRecipients: [{ emailAddress: { address: to } }] };
      if (attachmentBase64) message.attachments = [{ "@odata.type": "#microsoft.graph.fileAttachment", name: attachmentName || "invoice.pdf", contentType: "application/pdf", contentBytes: attachmentBase64 }];
      const url = replyToId ? `https://graph.microsoft.com/v1.0/me/messages/${replyToId}/reply` : "https://graph.microsoft.com/v1.0/me/sendMail";
      const payload = replyToId ? { message, comment: "" } : { message, saveToSentItems: true };
      const sendRes = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!sendRes.ok) { const e = await sendRes.json(); throw new Error(e.error?.message || "Send failed"); }
      return res.json({ success: true });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  // ── Outlook Parse Supplier ─────────────────────────────────────────────────
  if (path === "/api/outlook/parse-supplier") {
    const { userId, messageId, attachmentId } = req.body;
    try {
      const token = await getToken(userId, "outlook");
      const att = await (await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments/${attachmentId}`, { headers: { Authorization: `Bearer ${token}` } })).json();
      if (att.error) throw new Error(att.error.message);
      const aiData = await (await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": process.env.VITE_ANTHROPIC_KEY, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: att.contentBytes } }, { type: "text", text: `Extract all line items and return ONLY a JSON array.\nFormat: [{"item": "name", "qty": number, "unit": "each", "unitPrice": number, "total": number}]` }] }] }) })).json();
      let items = [];
      try { items = JSON.parse(aiData.content?.[0]?.text?.trim().replace(/```json|```/g, "") || "[]"); } catch {}
      return res.json({ success: true, items });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  return res.status(404).json({ error: "Not found" });
}
