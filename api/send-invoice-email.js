// api/send-invoice-email.js
// Generates invoice/quote PDF and sends via Gmail or Outlook with attachment.
// Called by the AI assistant when sending invoices/quotes/chasers.
//
// Expected body:
// {
//   userId: string,
//   to: string,
//   subject: string,
//   body: string (HTML email body),
//   pdfHtml: string (HTML to render as PDF attachment),
//   filename: string (e.g. "Invoice-INV-246.pdf"),
// }
//
// Required env vars (already used by gmail/outlook send endpoints):
//   SUPABASE_URL, SUPABASE_SERVICE_KEY

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Inline PDF generation using Puppeteer + @sparticuz/chromium
async function generatePDF(html) {
  try {
    // These packages must be in package.json — if missing, skip PDF gracefully
    const chromium = await import("@sparticuz/chromium").then(m => m.default).catch(() => null);
    const puppeteer = await import("puppeteer-core").then(m => m.default).catch(() => null);
    if (!chromium || !puppeteer) {
      console.warn("PDF packages not installed — sending email without attachment");
      return null;
    }
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    await browser.close();
    return pdfBuffer.toString("base64");
  } catch (e) {
    console.error("PDF gen failed:", e.message);
    return null;
  }
}

// Build RFC 2822 MIME message with HTML body + PDF attachment
function buildMimeMessage({ to, subject, htmlBody, pdfBase64, filename }) {
  const boundary = "TradePAboundary" + Date.now();
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;

  let mime = [
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
    mime = mime.concat([
      `--${boundary}`,
      `Content-Type: application/pdf; name="${filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${filename}"`,
      "",
      // Split base64 into 76-char lines (RFC 2045)
      pdfBase64.match(/.{1,76}/g).join("\n"),
      `--${boundary}--`,
    ]);
  } else {
    mime.push(`--${boundary}--`);
  }

  return mime.join("\n");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { userId, to, subject, body: htmlBody, pdfHtml, filename = "document.pdf" } = req.body || {};
  if (!userId || !to || !subject) {
    return res.status(400).json({ error: "userId, to, and subject are required" });
  }

  // Look up connected email provider
  const { data: conns } = await supabase
    .from("email_connections")
    .select("provider, access_token, refresh_token, email")
    .eq("user_id", userId)
    .limit(1);

  if (!conns?.length) {
    return res.status(400).json({ error: "No email account connected. Connect Gmail or Outlook in the Inbox tab." });
  }

  const { provider, access_token } = conns[0];

  // Generate PDF if HTML provided
  let pdfBase64 = null;
  if (pdfHtml) {
    pdfBase64 = await generatePDF(pdfHtml);
  }

  try {
    if (provider === "gmail") {
      const raw = buildMimeMessage({ to, subject, htmlBody, pdfBase64, filename });
      const encoded = Buffer.from(raw).toString("base64url");

      const gmailRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: encoded }),
      });

      if (!gmailRes.ok) {
        const err = await gmailRes.json();
        throw new Error(err.error?.message || `Gmail API error ${gmailRes.status}`);
      }

      return res.json({ success: true, provider: "gmail", hasAttachment: !!pdfBase64 });

    } else if (provider === "outlook") {
      // Microsoft Graph API - supports attachments natively
      const attachments = pdfBase64 ? [{
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: filename,
        contentType: "application/pdf",
        contentBytes: pdfBase64,
      }] : [];

      const graphRes = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
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
      });

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
