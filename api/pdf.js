// api/pdf.js
// Generates a PDF from HTML using Puppeteer + Chromium on Vercel.
// Called by email send endpoints to attach invoice/quote PDFs.
//
// SECURITY (forensic audit Finding 2.2, fixed 27 Apr 2026):
// Previously unauthenticated. Anyone could spin up Chromium DoS (each
// invocation eats ~50MB RAM + ~3s CPU). Now requires a verified JWT and
// applies a per-user rate limit (PDFs are reasonable to want at 30/hour
// max for an honest tradie).
//
// Deploy this alongside the app — add these to package.json dependencies:
//   "@sparticuz/chromium": "^123.0.0"
//   "puppeteer-core": "^22.0.0"

import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { withSentry } from "./lib/sentry.js";
import { requireAuth, checkInMemoryRateLimit } from "./lib/auth.js";

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = await requireAuth(req, res);
  if (!userId) return;

  // 30 PDFs/hour/user. Real tradies generate < 5/hour. 30 is a generous
  // cap that absorbs reasonable burst behaviour (e.g. month-end batch
  // invoicing) without enabling DoS.
  const rl = checkInMemoryRateLimit(userId, "pdf", { maxRequests: 30, windowMs: 60 * 60_000 });
  if (!rl.allowed) {
    return res.status(429).json({
      error: "Rate limit exceeded — 30 PDFs/hour. Try again shortly.",
      resetAt: new Date(rl.resetAt).toISOString(),
    });
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

export default withSentry(handler, { routeName: "pdf" });
