// api/send-invoice-email.js
// Sends invoice/quote/chase emails via Gmail or Outlook.
// PDF is generated client-side (html2canvas + jsPDF) and passed as base64.
// No Puppeteer, no Chromium, no external PDF services needed.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function buildMimeMessage({ to, subject, htmlBody, pdfBase64, filename }) {
  const boundary = "TradePAboundary" + Date.now();
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;

  const parts = [
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: quoted-printable",
    "",
    htmlBody,
  ];

  if (pdfBase64) {
    parts.push(
      `--${boundary}`,
      `Content-Type: application/pdf; name="${filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${filename}"`,
      "",
      // RFC 2045: base64 lines must be ≤76 chars
      pdfBase64.match(/.{1,76}/g).join("\n"),
      `--${boundary}--`
    );
  } else {
    parts.push(`--${boundary}--`);
  }

  return parts.join("\n");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const {
    userId, to, subject,
    body: htmlBody,
    pdfBase64 = null,   // pre-generated base64 PDF from client
    pdfHtml = null,     // legacy — ignored, kept for back-compat
    filename = "Invoice.pdf",
  } = req.body || {};

  if (!userId || !to || !subject) {
    return res.status(400).json({ error: "userId, to, and subject are required" });
  }

  const { data: conns } = await supabase
    .from("email_connections")
    .select("provider, access_token, email")
    .eq("user_id", userId)
    .limit(1);

  if (!conns?.length) {
    return res.status(400).json({
      error: "No email account connected. Connect Gmail or Outlook in the Inbox tab.",
    });
  }

  const { provider, access_token } = conns[0];

  try {
    if (provider === "gmail") {
      const raw = buildMimeMessage({ to, subject, htmlBody, pdfBase64, filename });
      const encoded = Buffer.from(raw).toString("base64url");

      const gmailRes = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw: encoded }),
        }
      );

      if (!gmailRes.ok) {
        const err = await gmailRes.json().catch(() => ({}));
        throw new Error(err.error?.message || `Gmail API error ${gmailRes.status}`);
      }

      return res.json({ success: true, provider: "gmail", hasAttachment: !!pdfBase64 });

    } else if (provider === "outlook") {
      const attachments = pdfBase64
        ? [{
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: filename,
            contentType: "application/pdf",
            contentBytes: pdfBase64,
          }]
        : [];

      const graphRes = await fetch(
        "https://graph.microsoft.com/v1.0/me/sendMail",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              subject,
              body: { contentType: "HTML", content: htmlBody },
              toRecipients: [{ emailAddress: { address: to } }],
              attachments,
            },
          }),
        }
      );

      if (!graphRes.ok && graphRes.status !== 202) {
        const err = await graphRes.json().catch(() => ({}));
        throw new Error(err.error?.message || `Outlook API error ${graphRes.status}`);
      }

      return res.json({ success: true, provider: "outlook", hasAttachment: !!pdfBase64 });

    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }
  } catch (e) {
    console.error("Email send error:", e.message);
    return res.status(500).json({ error: e.message });
  }
}
