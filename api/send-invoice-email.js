// api/send-invoice-email.js
// Sends invoice/quote/chase emails via Gmail or Outlook with PDF attachment.
// PDF is fetched from a Supabase Storage signed URL — avoids Vercel body size limits.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function buildMimeMessage({ to, subject, htmlBody, pdfBase64, filename }) {
  const boundary = "TPboundary" + Date.now();
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;

  const parts = [
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
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
      pdfBase64.match(/.{1,76}/g).join("\n"),
      `--${boundary}--`
    );
  } else {
    parts.push(`--${boundary}--`);
  }

  return parts.join("\r\n");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userId, to, subject, body: htmlBody, pdfUrl = null, filename = "Invoice.pdf" } = req.body || {};

    if (!userId || !to || !subject || !htmlBody) {
      return res.status(400).json({ error: "userId, to, subject and body are required" });
    }

    // Fetch connection
    const { data: conns, error: connErr } = await supabase
      .from("email_connections")
      .select("provider, access_token")
      .eq("user_id", userId)
      .limit(1);

    if (connErr || !conns?.length) {
      return res.status(400).json({
        error: "No email account connected. Connect Gmail or Outlook in the Inbox tab.",
      });
    }

    const { provider, access_token } = conns[0];

    // Fetch PDF from Supabase Storage signed URL (small URL in body, fetch happens server-side)
    let pdfBase64 = null;
    if (pdfUrl) {
      try {
        const pdfRes = await fetch(pdfUrl);
        if (pdfRes.ok) {
          const buffer = await pdfRes.arrayBuffer();
          pdfBase64 = Buffer.from(buffer).toString("base64");
          console.log(`PDF fetched: ${Math.round(buffer.byteLength / 1024)}KB`);
        }
      } catch (pdfErr) {
        console.warn("PDF fetch failed, sending without attachment:", pdfErr.message);
      }
    }

    if (provider === "gmail") {
      const mime = buildMimeMessage({ to, subject, htmlBody, pdfBase64, filename });
      const gmailRes = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw: Buffer.from(mime).toString("base64url") }),
        }
      );

      if (!gmailRes.ok) {
        const err = await gmailRes.json().catch(() => ({}));
        return res.status(500).json({ error: err.error?.message || `Gmail error ${gmailRes.status}` });
      }

      return res.json({ success: true, provider: "gmail", hasAttachment: !!pdfBase64 });

    } else if (provider === "outlook") {
      const attachments = pdfBase64 ? [{
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: filename,
        contentType: "application/pdf",
        contentBytes: pdfBase64,
      }] : [];

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
        return res.status(500).json({ error: err.error?.message || `Outlook error ${graphRes.status}` });
      }

      return res.json({ success: true, provider: "outlook", hasAttachment: !!pdfBase64 });

    } else {
      return res.status(400).json({ error: `Unknown provider: ${provider}` });
    }

  } catch (e) {
    console.error("send-invoice-email error:", e);
    return res.status(500).json({ error: e.message || "Unexpected server error" });
  }
}
