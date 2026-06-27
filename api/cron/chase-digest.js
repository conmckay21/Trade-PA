// api/cron/chase-digest.js
// Daily morning email to the TRADESPERSON (not their customers) listing the
// overdue invoices Trade PA is about to chase automatically today, plus any that
// have reached final notice and are ready for a letter before action. Gives them
// a window to mark anything already paid, or pause chasing on an invoice, before
// the chaser runs. The safety net that makes automatic chasing safe even when a
// "paid" mark is a little stale (cash and bank transfer).
//
// Scheduled in vercel.json at "0 5 * * *" (05:00 UTC), ahead of check-overdue
// (06:00) and the hourly chaser, so same-day chases are previewed before sending.
//
// Dormant until automatic chasing is enabled: gated on AUTO_CHASE_SEND === "true"
// and, per user, companies.settings.autoChase === true, exactly like the chaser.
// Sends via Resend from hello@tradespa.co.uk to the user's connected inbox.
//
// Security: Vercel Cron sends Authorization: Bearer <CRON_SECRET>.

import { withSentry } from "../lib/sentry.js";

const SB_URL = () => process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SB_KEY = () => process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

async function sbGet(path) {
  const r = await fetch(`${SB_URL()}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY(), Authorization: `Bearer ${SB_KEY()}` },
  });
  if (!r.ok) return [];
  return r.json();
}

function gbp(n) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(n) || 0);
}
function ukToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}
function daysOverdue(dueDateStr) {
  if (!dueDateStr) return null;
  const today = new Date(ukToday() + "T00:00:00Z").getTime();
  const due = new Date(dueDateStr + "T00:00:00Z").getTime();
  if (isNaN(due)) return null;
  return Math.max(0, Math.floor((today - due) / 86400000));
}

async function handler(req, res) {
  const auth = req.headers.authorization;
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (process.env.AUTO_CHASE_SEND !== "true") {
    return res.status(200).json({ skipped: "auto-chase disabled" });
  }
  if (!process.env.RESEND_API_KEY) {
    return res.status(200).json({ skipped: "resend not configured" });
  }
  if (!SB_URL() || !SB_KEY()) {
    return res.status(500).json({ error: "Server not configured" });
  }

  const today = ukToday();
  const conns = (await sbGet(`email_connections?select=user_id,email&refresh_token=not.is.null`)) || [];
  let digestsSent = 0;

  for (const conn of conns) {
    if (!conn.email) continue;

    const brands = await sbGet(`companies?owner_id=eq.${conn.user_id}&select=settings&limit=1`);
    const brand = brands?.[0]?.settings || {};
    if (brand.autoChase !== true) continue;

    // Invoices that are overdue or fall due today, not quotes, not deleted.
    const invoices = (await sbGet(
      `invoices?user_id=eq.${conn.user_id}&is_quote=eq.false&deleted_at=is.null&due_date=lte.${today}&select=*&or=(status.eq.sent,status.eq.overdue)`
    )) || [];
    if (!invoices.length) continue;

    const customers = (await sbGet(`customers?user_id=eq.${conn.user_id}&select=name,email`)) || [];
    const emailFor = (inv) => {
      const c = customers.find((x) => (x.name || "").toLowerCase() === (inv.customer || "").toLowerCase());
      return c?.email || inv.email || "";
    };

    const queued = [];
    const readyForLetter = [];
    for (const inv of invoices) {
      if (inv.chase_paused) continue;
      const count = inv.chase_count || 0;
      if (count >= 3) { readyForLetter.push(inv); continue; }
      // 7-day dedup, mirrors the chaser.
      if (inv.last_chased_at && (Date.now() - new Date(inv.last_chased_at)) / 86400000 < 7) continue;
      if (!emailFor(inv)) continue; // chaser would skip — no recipient
      queued.push(inv);
    }

    if (!queued.length && !readyForLetter.length) continue;

    const tradingName = brand.tradingName || "Trade PA";
    const accent = brand.accentColor || "#f59e0b";
    const nextLabel = (count) => (count >= 2 ? "Final notice" : count === 1 ? "Second reminder" : "First reminder");
    const row = (inv, extra) => `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:14px;">${inv.customer || "Customer"}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:14px;">${inv.id}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:14px;text-align:right;">${gbp(inv.gross_amount ?? inv.amount)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:#666;">${extra}</td>
    </tr>`;

    const queuedTable = queued.length
      ? `<p style="font-size:15px;font-weight:700;margin:18px 0 6px;">Being chased today (${queued.length})</p>
         <table style="width:100%;border-collapse:collapse;">${queued
           .map((inv) => row(inv, `${nextLabel(inv.chase_count || 0)}${daysOverdue(inv.due_date) != null ? ` &middot; ${daysOverdue(inv.due_date)} days overdue` : ""}`))
           .join("")}</table>`
      : "";

    const letterTable = readyForLetter.length
      ? `<p style="font-size:15px;font-weight:700;margin:18px 0 6px;">Ready for a letter before action (${readyForLetter.length})</p>
         <table style="width:100%;border-collapse:collapse;">${readyForLetter.map((inv) => row(inv, "Final notice already sent")).join("")}</table>`
      : "";

    const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
      <div style="background:${accent};padding:18px 22px;border-radius:8px 8px 0 0;"><h2 style="color:#fff;margin:0;font-size:18px;">Your chasing for today</h2></div>
      <div style="padding:18px 22px;background:#fff;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px;">
        <p style="font-size:15px;">Morning. Here is what Trade PA is about to do on your overdue invoices today.</p>
        ${queuedTable}
        ${letterTable}
        <p style="font-size:13px;color:#555;margin-top:18px;background:#fdf6e7;border-left:3px solid ${accent};padding:10px 12px;border-radius:5px;">Already been paid? Mark the invoice as paid in the app and it drops out of chasing straight away. To hold off on one without marking it paid, open it and tap Pause chasing.</p>
        <p style="font-size:12px;color:#999;margin-top:16px;">You are receiving this because automatic chasing is switched on for ${tradingName}.</p>
      </div>
    </div>`;

    const subject = queued.length
      ? `${queued.length} invoice${queued.length === 1 ? "" : "s"} to be chased today`
      : `${readyForLetter.length} invoice${readyForLetter.length === 1 ? "" : "s"} ready for a letter before action`;

    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: "Trade PA <hello@tradespa.co.uk>", to: conn.email, subject, html }),
      });
      if (r.ok) digestsSent++;
      else console.error(`[chase-digest] resend HTTP ${r.status} to ${conn.email}`);
    } catch (e) {
      console.error("[chase-digest] send failed:", e.message);
    }
  }

  return res.status(200).json({ ok: true, digestsSent });
}

export default withSentry(handler, { routeName: "cron/chase-digest" });
