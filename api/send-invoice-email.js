// api/send-invoice-email.js

import { createClient } from "@supabase/supabase-js";

export const config = {
  maxDuration: 30, // extend to 30s — email + PDF fetch can take time
};

export default async function handler(req, res) {
  // Always return JSON, never let an exception bubble up unhandled
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Validate env vars first — missing vars cause FUNCTION_INVOCATION_FAILED
    if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      console.error("Missing env vars: SUPABASE_URL or SUPABASE_SERVICE_KEY");
      return res.status(500).json({ error: "Server misconfiguration — contact support" });
    }

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { userId, to, subject, body: htmlBody, pdfUrl = null, filename = "Invoice.pdf" } = req.body || {};

    if (!userId || !to || !subject || !htmlBody) {
      return res.status(400).json({ error: "userId, to, subject and body are required" });
    }

    // Look up email connection
    const { data: conns, error: connErr } = await supabase
      .from("email_connections")
      .select("provider, access_token")
      .eq("user_id", userId)
      .limit(1);

    if (connErr) {
      console.error("DB error:", connErr.message);
      return res.status(500).json({ error: "Database error: " + connErr.message });
    }

    if (!conns?.length) {
      return res.status(400).json({ error: "No email account connected. Connect Gmail or Outlook in the Inbox tab." });
    }

    const { provider, access_token } = conns[0];

    // Fetch PDF from Supabase Storage URL if provided
    let pdfBase64 = null;
    if (pdfUrl) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const pdfRes = await fetch(pdfUrl, { signal: controller.signal });
        clearTimeout(timeout);
        if (pdfRes.ok) {
          const buf = await pdfRes.arrayBuffer();
          pdfBase64 = Buffer.from(buf).toString("base64");
        }
      } catch (pdfErr) {
        console.warn("PDF fetch failed, sending without attachment:", pdfErr.message);
      }
    }

    if (provider === "gmail") {
      const boundary = "TradePAboundary" + Date.now();
      const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;

      const parts = [
        `To: ${to}`,
        `Subject: ${encodedSubject}`,
        "MIME-Version: 1.0",
        pdfBase64
          ? `Content-Type: multipart/mixed; boundary="${boundary}"`
          : `Content-Type: text/html; charset="UTF-8"`,
        "",
      ];

      if (pdfBase64) {
        parts.push(
          `--${boundary}`,
          'Content-Type: text/html; charset="UTF-8"',
          "",
          htmlBody,
          `--${boundary}`,
          `Content-Type: application/pdf; name="${filename}"`,
          "Content-Transfer-Encoding: base64",
          `Content-Disposition: attachment; filename="${filename}"`,
          "",
          pdfBase64.match(/.{1,76}/g).join("\n"),
          `--${boundary}--`
        );
      } else {
        parts.push(htmlBody);
      }

      const mime = parts.join("\r\n");
      const gmailRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ raw: Buffer.from(mime).toString("base64url") }),
      });

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

      const graphRes = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
        method: "POST",
        headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            subject,
            body: { contentType: "HTML", content: htmlBody },
            toRecipients: [{ emailAddress: { address: to } }],
            attachments,
          },
        }),
      });

      if (!graphRes.ok && graphRes.status !== 202) {
        const err = await graphRes.json().catch(() => ({}));
        return res.status(500).json({ error: err.error?.message || `Outlook error ${graphRes.status}` });
      }

      return res.json({ success: true, provider: "outlook", hasAttachment: !!pdfBase64 });

    } else {
      return res.status(400).json({ error: `Unknown email provider: ${provider}` });
    }

  } catch (e) {
    // Catch-all — no unhandled exceptions
    console.error("send-invoice-email unhandled error:", e);
    return res.status(500).json({ error: e?.message || "Unexpected error" });
  }
}
