async function getEmailConnections() {
const res = await fetch(
`${process.env.VITE_SUPABASE_URL}/rest/v1/email_connections?select=*`,
{
headers: {
“apikey”: process.env.SUPABASE_SERVICE_KEY,
“Authorization”: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
},
}
);
return await res.json();
}

async function refreshToken(conn) {
const isGmail = conn.provider === “gmail”;
const tokenUrl = isGmail
? “https://oauth2.googleapis.com/token”
: “https://login.microsoftonline.com/common/oauth2/v2.0/token”;

const body = isGmail
? new URLSearchParams({ client_id: process.env.GMAIL_CLIENT_ID, client_secret: process.env.GMAIL_CLIENT_SECRET, refresh_token: conn.refresh_token, grant_type: “refresh_token” })
: new URLSearchParams({ client_id: process.env.OUTLOOK_CLIENT_ID, client_secret: process.env.OUTLOOK_CLIENT_SECRET, refresh_token: conn.refresh_token, grant_type: “refresh_token”, scope: “offline_access Mail.ReadWrite Mail.Send User.Read” });

const res = await fetch(tokenUrl, { method: “POST”, headers: { “Content-Type”: “application/x-www-form-urlencoded” }, body });
const tokens = await res.json();
if (tokens.error) throw new Error(tokens.error_description || tokens.error);

await fetch(
`${process.env.VITE_SUPABASE_URL}/rest/v1/email_connections?user_id=eq.${conn.user_id}&provider=eq.${conn.provider}`,
{
method: “PATCH”,
headers: { “apikey”: process.env.SUPABASE_SERVICE_KEY, “Authorization”: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`, “Content-Type”: “application/json” },
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

function decodeBase64(data) {
if (!data) return “”;
try {
return Buffer.from(data.replace(/-/g, “+”).replace(/_/g, “/”), “base64”).toString(“utf-8”);
} catch { return “”; }
}

function extractTextFromPayload(payload) {
if (!payload) return “”;

// Direct text content
if (payload.mimeType === “text/plain” && payload.body?.data) {
return decodeBase64(payload.body.data);
}

// HTML - strip tags for plain text
if (payload.mimeType === “text/html” && payload.body?.data) {
const html = decodeBase64(payload.body.data);
return html.replace(/<[^>]+>/g, “ “).replace(/\s+/g, “ “).trim().slice(0, 1000);
}

// Multipart - recurse through parts
if (payload.parts) {
// Prefer text/plain
const textPart = payload.parts.find(p => p.mimeType === “text/plain”);
if (textPart) return extractTextFromPayload(textPart);

```
// Fall back to HTML
const htmlPart = payload.parts.find(p => p.mimeType === "text/html");
if (htmlPart) return extractTextFromPayload(htmlPart);

// Recurse into multipart
for (const part of payload.parts) {
  const text = extractTextFromPayload(part);
  if (text) return text;
}
```

}

return “”;
}

function getAttachments(payload) {
const attachments = [];
if (!payload) return attachments;

if (payload.filename && payload.body?.attachmentId) {
attachments.push({
id: payload.body.attachmentId,
filename: payload.filename,
mimeType: payload.mimeType,
});
}

if (payload.parts) {
for (const part of payload.parts) {
attachments.push(…getAttachments(part));
}
}

return attachments;
}

async function fetchNewEmailsGmail(conn, token) {
const since = conn.last_checked
? new Date(conn.last_checked)
: new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h if first time

const afterSeconds = Math.floor(since.getTime() / 1000);

// Fetch messages received after last check, excluding sent by me
const params = new URLSearchParams({
maxResults: “15”,
q: `after:${afterSeconds} -from:me -category:promotions -category:social`,
});

const listRes = await fetch(
`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
{ headers: { Authorization: `Bearer ${token}` } }
);
const list = await listRes.json();
if (!list.messages?.length) return [];

const emails = await Promise.all(
list.messages.slice(0, 15).map(async (m) => {
try {
const msgRes = await fetch(
`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
{ headers: { Authorization: `Bearer ${token}` } }
);
const msg = await msgRes.json();
const headers = msg.payload?.headers || [];
const get = (n) => headers.find((h) => h.name === n)?.value || “”;

```
    // Extract full email body text
    const bodyText = extractTextFromPayload(msg.payload) || msg.snippet || "";
    const attachments = getAttachments(msg.payload);
    const pdfAttachments = attachments.filter(a => 
      a.mimeType?.includes("pdf") || a.filename?.toLowerCase().endsWith(".pdf")
    );
    
    return {
      id: m.id,
      from: get("From"),
      subject: get("Subject") || "(no subject)",
      date: get("Date"),
      snippet: msg.snippet || "",
      body: bodyText.slice(0, 1500), // More content for better AI analysis
      hasPdfAttachment: pdfAttachments.length > 0,
      pdfAttachments,
      allAttachments: attachments,
    };
  } catch (err) {
    console.error(`Error fetching message ${m.id}:`, err.message);
    return null;
  }
})
```

);

return emails.filter(Boolean);
}

async function fetchNewEmailsOutlook(conn, token) {
const since = conn.last_checked
? new Date(conn.last_checked)
: new Date(Date.now() - 24 * 60 * 60 * 1000);

const sinceIso = since.toISOString();
const url = `https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages?$top=15&$filter=receivedDateTime ge ${sinceIso}&$select=id,subject,from,receivedDateTime,body,bodyPreview,hasAttachments&$expand=attachments($select=id,name,contentType)`;

const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
const data = await res.json();
if (data.error || !data.value?.length) return [];

return data.value.map((msg) => {
const bodyText = msg.body?.contentType === “html”
? (msg.body.content || “”).replace(/<[^>]+>/g, “ “).replace(/\s+/g, “ “).trim()
: (msg.body?.content || msg.bodyPreview || “”);

```
const attachments = (msg.attachments || []).map(a => ({
  id: a.id,
  filename: a.name,
  mimeType: a.contentType,
}));
const pdfAttachments = attachments.filter(a =>
  a.mimeType?.includes("pdf") || a.filename?.toLowerCase().endsWith(".pdf")
);

return {
  id: msg.id,
  from: msg.from?.emailAddress ? `${msg.from.emailAddress.name} <${msg.from.emailAddress.address}>` : "",
  subject: msg.subject || "(no subject)",
  date: msg.receivedDateTime,
  snippet: msg.bodyPreview || "",
  body: bodyText.slice(0, 1500),
  hasPdfAttachment: pdfAttachments.length > 0,
  pdfAttachments,
  allAttachments: attachments,
};
```

});
}

async function analyseEmailWithClaude(email) {
const prompt = `You are an AI assistant for a UK sole-trader tradesperson (plumber, electrician, gas engineer, builder etc).

Analyse this incoming email and identify what business action should be taken. Be AGGRESSIVE about identifying actions — when in doubt, suggest an action rather than ignoring.

Email from: ${email.from}
Subject: ${email.subject}
Body: ${email.body}
Has PDF attachment: ${email.hasPdfAttachment}
${email.pdfAttachments?.length > 0 ? `PDF files: ${email.pdfAttachments.map(a => a.filename).join(", ")}` : “”}

ACTION RULES — apply these in order:

1. BOOKING REQUEST: Customer asking to book, schedule, or arrange work → action_type: “create_job”
   Examples: “can you book me in”, “I need a boiler service”, “can you come and fix”, “available Friday”
1. PAYMENT CONFIRMATION: Customer saying they have paid, transferred money, made payment → action_type: “mark_invoice_paid”  
   Examples: “I have paid”, “payment sent”, “transferred the money”, “paid invoice”, “bank transfer done”
1. QUOTE ACCEPTANCE: Customer saying yes to a quote, wants to proceed, accepts the price → action_type: “mark_invoice_paid”
   Wait - this should be: action_type: “create_job” with notes about quote acceptance
   Examples: “I’d like to go ahead”, “please proceed”, “accept the quote”, “happy with the price”
1. SUPPLIER INVOICE WITH PDF: Email from a supplier/merchant with an attached PDF invoice or receipt → action_type: “add_materials”
   Examples: Screwfix, Toolstation, Travis Perkins, City Plumbing, any supplier sending invoice PDF
1. NEW ENQUIRY: Potential new customer asking about work, prices, availability (not a confirmed booking) → action_type: “create_enquiry”
   Examples: “how much would it cost”, “do you cover my area”, “are you available”, “need a quote for”
1. SAVE CONTACT: Someone providing their contact details → action_type: “save_customer”
1. IGNORE: Newsletters, marketing, automated notifications, spam, Google alerts, Xero/accounting system emails → action_type: “ignore”

Respond with ONLY a JSON object, no other text:
{
“action_type”: “create_job” | “create_enquiry” | “mark_invoice_paid” | “add_materials” | “save_customer” | “ignore”,
“action_description”: “One clear sentence describing exactly what will happen when approved”,
“action_data”: {
“customer”: “customer name extracted from email”,
“type”: “job type e.g. Boiler Service, Leak Repair (for create_job)”,
“date_text”: “date/time mentioned e.g. Friday 3rd April 10:30am (for create_job)”,
“address”: “address if mentioned”,
“notes”: “key details from the email”,
“source”: “Email”,
“message”: “brief summary of what they want (for create_enquiry)”,
“urgent”: false,
“supplier”: “supplier name (for add_materials)”,
“name”: “full name (for save_customer)”,
“email”: “email address (for save_customer)”
}
}`;

const res = await fetch(“https://api.anthropic.com/v1/messages”, {
method: “POST”,
headers: {
“Content-Type”: “application/json”,
“x-api-key”: process.env.VITE_ANTHROPIC_KEY,
“anthropic-version”: “2023-06-01”,
},
body: JSON.stringify({
model: “claude-sonnet-4-6”,
max_tokens: 600,
messages: [{ role: “user”, content: prompt }],
}),
});

const data = await res.json();
const text = data.content?.[0]?.text?.trim() || “{}”;

try {
const jsonMatch = text.match(/{[\s\S]*}/);
if (!jsonMatch) throw new Error(“No JSON found”);
return JSON.parse(jsonMatch[0]);
} catch (err) {
console.error(“Claude parse error:”, err.message, “Raw:”, text.slice(0, 200));
return { action_type: “ignore”, action_description: “Could not parse”, action_data: {} };
}
}

async function saveAction(userId, email, analysis) {
if (analysis.action_type === “ignore”) {
console.log(`Ignored: "${email.subject}" from ${email.from}`);
return false;
}

console.log(`Saving action: ${analysis.action_type} for "${email.subject}"`);

const res = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/email_actions`, {
method: “POST”,
headers: {
“apikey”: process.env.SUPABASE_SERVICE_KEY,
“Authorization”: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
“Content-Type”: “application/json”,
“Prefer”: “resolution=ignore-duplicates”,
},
body: JSON.stringify({
user_id: userId,
email_id: email.id,
email_from: email.from,
email_subject: email.subject,
email_snippet: email.snippet?.slice(0, 300) || “”,
action_type: analysis.action_type,
action_data: analysis.action_data || {},
action_description: analysis.action_description || “”,
status: “pending”,
}),
});

if (!res.ok) {
const err = await res.text();
console.error(“Save action error:”, err);
}

return res.ok;
}

async function updateLastChecked(userId, provider) {
await fetch(
`${process.env.VITE_SUPABASE_URL}/rest/v1/email_connections?user_id=eq.${userId}&provider=eq.${provider}`,
{
method: “PATCH”,
headers: {
“apikey”: process.env.SUPABASE_SERVICE_KEY,
“Authorization”: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
“Content-Type”: “application/json”,
},
body: JSON.stringify({ last_checked: new Date().toISOString() }),
}
);
}

export default async function handler(req, res) {
const authHeader = req.headers[“authorization”];
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
return res.status(401).json({ error: “Unauthorized” });
}

const results = { processed: 0, actions: 0, ignored: 0, errors: 0 };

try {
const connections = await getEmailConnections();
if (!connections?.length) return res.json({ …results, message: “No connections” });

```
for (const conn of connections) {
  try {
    const token = await getValidToken(conn);
    
    const emails = conn.provider === "gmail"
      ? await fetchNewEmailsGmail(conn, token)
      : await fetchNewEmailsOutlook(conn, token);

    console.log(`Processing ${emails.length} emails for user ${conn.user_id} (${conn.provider})`);

    for (const email of emails) {
      try {
        results.processed++;
        const analysis = await analyseEmailWithClaude(email);
        
        if (analysis.action_type === "ignore") {
          results.ignored++;
        } else {
          const saved = await saveAction(conn.user_id, email, analysis);
          if (saved) results.actions++;
        }
      } catch (err) {
        console.error(`Error processing email "${email.subject}":`, err.message);
        results.errors++;
      }
    }

    await updateLastChecked(conn.user_id, conn.provider);
  } catch (err) {
    console.error(`Error processing connection ${conn.user_id}:`, err.message);
    results.errors++;
  }
}

res.json({ success: true, ...results });
```

} catch (err) {
console.error(“Cron error:”, err.message);
res.status(500).json({ error: err.message, …results });
}
}
