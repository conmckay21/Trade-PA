// /api/feedback.js — Vercel serverless function
// Receives feedback from the FeedbackModal and emails it to the Trade PA
// team using Gmail SMTP via nodemailer.
//
// SECURITY (forensic audit Finding 2.4, fixed 27 Apr 2026):
// Previously unauthenticated. An attacker could spam thetradepa@gmail.com
// indefinitely, triggering Google's spam-detection and risking inbox
// suspension. Now: requires verified JWT and applies a per-user rate limit
// of 5 messages/hour (real users send 0-2 per session, 5/hour is generous
// for a genuine flurry of bug reports during a single sitting).
//
// Setup (one-time):
//   1. Sign in to thetradepa@gmail.com
//   2. Enable 2-Step Verification (Google Account → Security)
//   3. Generate an App Password (Google Account → Security → App passwords)
//      - Select "Mail" / "Other" → name it "Trade PA Vercel"
//      - Copy the 16-character password Google shows
//   4. On Vercel: Settings → Environment Variables, add:
//        GMAIL_USER = thetradepa@gmail.com
//        GMAIL_APP_PASSWORD = <the 16-char app password>
//   5. Redeploy
//
// Dependencies: nodemailer (add to package.json: "nodemailer": "^6.9.0")

import nodemailer from "nodemailer";
import { withSentry } from "./lib/sentry.js";
import { requireAuth, checkInMemoryRateLimit } from "./lib/auth.js";

const FEEDBACK_TO = "thetradepa@gmail.com";

const TYPE_LABELS = {
  bug: "🐛 Bug",
  improvement: "💡 Improvement",
  idea: "✨ Idea",
};

// Reuse one transporter across warm invocations (faster, fewer SMTP handshakes)
let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
  return transporter;
}

async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const userId = await requireAuth(req, res);
  if (!userId) return;

  const rl = checkInMemoryRateLimit(userId, "feedback", { maxRequests: 5, windowMs: 60 * 60_000 });
  if (!rl.allowed) {
    return res.status(429).json({
      error: "You've sent a lot of feedback in the last hour — try again shortly. We've got plenty to work on already, thank you!",
      resetAt: new Date(rl.resetAt).toISOString(),
    });
  }

  try {
    const { type, message, screenshot, context } = req.body || {};

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }
    if (!["bug", "improvement", "idea"].includes(type)) {
      return res.status(400).json({ error: "Invalid feedback type" });
    }
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.error("GMAIL_USER or GMAIL_APP_PASSWORD not configured");
      return res.status(500).json({ error: "Email service not configured. Please email thetradepa@gmail.com directly." });
    }

    const typeLabel = TYPE_LABELS[type] || type;
    const userEmail = context?.userEmail || "anonymous";
    const tradingName = context?.tradingName ? ` (${context.tradingName})` : "";
    const subject = `[Trade PA] ${typeLabel} — ${userEmail}${tradingName}`;

    const text = [
      `Type: ${typeLabel}`,
      `From: ${userEmail}${tradingName}`,
      `User ID: ${context?.userId || "n/a"}`,
      `Page: ${context?.currentView || "unknown"}`,
      `URL: ${context?.url || "n/a"}`,
      `Screen: ${context?.screenSize || "n/a"}`,
      `Device: ${context?.userAgent || "n/a"}`,
      `Sent: ${context?.timestamp || new Date().toISOString()}`,
      ``,
      `── Message ──`,
      message.trim(),
      ``,
      screenshot ? `Screenshot attached: ${screenshot.filename}` : `(No screenshot)`,
    ].join("\n");

    const escape = (s) => String(s || "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:640px;margin:0 auto;padding:20px;color:#222;">
  <h2 style="margin:0 0 8px;color:#f59e0b;font-size:18px;">${escape(typeLabel)} from ${escape(userEmail)}</h2>
  ${tradingName ? `<div style="font-size:13px;color:#666;margin-bottom:16px;">${escape(tradingName.trim().replace(/^\(|\)$/g, ""))}</div>` : ""}
  <div style="background:#fafafa;border-left:3px solid #f59e0b;padding:12px 16px;margin:12px 0 20px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escape(message.trim())}</div>
  <h3 style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.06em;margin:20px 0 8px;">Context</h3>
  <table style="font-size:12px;color:#444;border-collapse:collapse;width:100%;">
    <tr><td style="padding:4px 12px 4px 0;color:#888;width:90px;">Page</td><td>${escape(context?.currentView || "unknown")}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#888;">URL</td><td style="word-break:break-all;">${escape(context?.url || "n/a")}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#888;">User ID</td><td style="font-family:monospace;font-size:11px;">${escape(context?.userId || "n/a")}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#888;">Device</td><td style="font-size:11px;">${escape(context?.userAgent || "n/a")}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#888;">Screen</td><td>${escape(context?.screenSize || "n/a")}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#888;">Time</td><td>${escape(context?.timestamp || new Date().toISOString())}</td></tr>
  </table>
  ${screenshot ? `<p style="margin-top:20px;font-size:12px;color:#666;">📎 Screenshot attached: <strong>${escape(screenshot.filename)}</strong></p>` : ""}
</div>
    `.trim();

    // Build attachments array
    const attachments = [];
    if (screenshot?.dataUrl && screenshot?.filename) {
      // dataUrl format: "data:image/png;base64,iVBOR..."
      const match = screenshot.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        attachments.push({
          filename: screenshot.filename,
          content: Buffer.from(match[2], "base64"),
          contentType: match[1],
        });
      }
    }

    // Send via Gmail SMTP
    await getTransporter().sendMail({
      from: `Trade PA Feedback <${process.env.GMAIL_USER}>`,
      to: FEEDBACK_TO,
      // Set replyTo so hitting Reply in your inbox messages the user directly
      replyTo: userEmail !== "anonymous" ? userEmail : undefined,
      subject,
      text,
      html,
      attachments: attachments.length ? attachments : undefined,
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Feedback handler error:", e);
    return res.status(500).json({
      error: "Couldn't send feedback: " + (e.message || "unknown error") + ". Please email thetradepa@gmail.com directly.",
    });
  }
}

export default withSentry(handler, { routeName: "feedback" });
