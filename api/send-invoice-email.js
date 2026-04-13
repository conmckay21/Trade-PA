// api/send-invoice-email.js
// Sends invoice/quote/chase emails via Gmail or Outlook.
// Attempts to attach a real PDF using chromium-min (lightweight, ~7MB vs 70MB).
// Gracefully falls back to HTML-only email if PDF generation fails.
//
// Required npm packages (add to package.json if not already there):
//   @sparticuz/chromium-min  (NOT @sparticuz/chromium — too large for Vercel)
//   puppeteer-core
//   @supabase/supabase-js

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function generatePDF(html) {
  try {
    const chromium = await import("@sparticuz/chromium-min")
      .then(m => m.default)
      .catch(() => null);
    const puppeteer = await import("puppeteer-core")
      .then(m => m.default)
      .catch(() => null);

    if (!chromium || !puppeteer) {
      console.warn("PDF packages missing — sending without attachment");
      return null;
    }

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(
        // chromium-min requires a remote URL or local path for the binary
        // Falls back to local path if env not set
        process.env.CHROMIUM_EXECUTABLE_PATH ||
        "https://github.com/Sparticuz/chromium/releases/download/v121.0.0/chromium-v121.0.0-pack.tar"
      ),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    // Strip the app navigation bar from the invoice before rendering
    const cleanHtml = html
      .replace(/<div class="back-bar"[\s\S]*?<\/div>/i, "")
      .replace(/<div class="no-print"[\s\S]*?<\/div>/i, "");
    await page.setContent(cleanHtml, { waitUntil: "networkidle0", timeout: 8000 });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    await browser.close();
    return Buffer.from(pdfBuffer).toString("base64");
  } catch (e) {
    console.error("PDF generation failed:", e.message);
    return null;
  }
}

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

  const { data: conns } = await supabase
    .from("email_connections")
    .select("provider, access_token, refresh_token, email")
    .eq("user_id", userId)
    .limit(1);

  if (!conns?.length) {
    return res.status(400).json({ error: "No email account connected. Connect Gmail or Outlook in the Inbox tab." });
  }

  const { provider, access_token } = conns[0];

  // Attempt PDF generation — null if packages missing or generation fails
  let pdfBase64 = null;
  if (pdfHtml) {
    pdfBase64 = await generatePDF(pdfHtml);
    if (!pdfBase64) {
      console.log("PDF unavailable — sending HTML-only email");
    }
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
        const err = await gmailRes.json().catch(() => ({}));
        throw new Error(err.error?.message || `Gmail API error ${gmailRes.status}`);
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
