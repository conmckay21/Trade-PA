// api/pdf.js
// Generates a PDF from HTML using Puppeteer + Chromium on Vercel.
// Called by email send endpoints to attach invoice/quote PDFs.
//
// Deploy this alongside the app — add these to package.json dependencies:
//   "@sparticuz/chromium": "^123.0.0"
//   "puppeteer-core": "^22.0.0"

import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { html } = req.body || {};
  if (!html) {
    return res.status(400).json({ error: "html is required" });
  }

  let browser = null;
  try {
    browser = await puppeteer.launch({
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

    const base64 = pdfBuffer.toString("base64");
    return res.json({ pdf: base64 });

  } catch (e) {
    console.error("PDF generation error:", e.message);
    return res.status(500).json({ error: e.message });
  } finally {
    if (browser) await browser.close();
  }
}
