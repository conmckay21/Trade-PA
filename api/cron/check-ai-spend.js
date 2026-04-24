// api/cron/check-ai-spend.js
// Daily AI-spend canary — runs 09:15 UTC, emails connor@tradespa.co.uk if any
// user's estimated monthly Anthropic/voice/email spend looks out of whack.
//
// NOT a cap. NOT user-facing. The goal is "Connor gets one quick morning email
// if somebody's costing more than expected." Silent on quiet days.
//
// Why not exact spend: we don't track per-call token counts yet. Estimates come
// from the existing usage_tracking table (conversations_used, handsfree_seconds_used)
// plus a flat email-pipeline baseline. Good enough for outlier detection.

import { createClient } from '@supabase/supabase-js';
import { withSentry } from "../lib/sentry.js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// ── Cost assumptions (in pence) ─────────────────────────────────────────────
// Keep these conservative/rough — the canary is about order-of-magnitude, not
// accounting. If reality proves us wrong they can be tuned without breaking
// anything — this file has no user-facing side effects.
const PENCE_PER_CONVERSATION = 1;       // Sonnet 4.6 chat turn blended avg
const PENCE_PER_HF_MINUTE    = 3;       // Grok STT + Grok TTS + Claude mid-session
const PENCE_EMAIL_BASELINE   = 100;     // hourly Haiku cron + occasional Check Now + PDF parses
const ALERT_THRESHOLD_PENCE  = 1000;    // £10/user/month — flag outliers above this
const ALERT_EMAIL            = "connor@tradespa.co.uk";

function currentMonth() {
  // Matches the client's currentMonth format (YYYY-MM)
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function fmt(pence) {
  return `£${(pence / 100).toFixed(2)}`;
}

async function getUserEmail(userId) {
  try {
    const res = await fetch(`${process.env.VITE_SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.email || null;
  } catch { return null; }
}

async function sendAlertEmail(subject, html) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[check-ai-spend] RESEND_API_KEY not set — alert skipped");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Trade PA Ops <hello@tradespa.co.uk>",
        to: ALERT_EMAIL,
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "<no body>");
      console.error(`[check-ai-spend] Resend ${res.status}: ${err.slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[check-ai-spend] Alert email failed: ${err.message}`);
    return false;
  }
}

async function handler(req, res) {
  const start = Date.now();

  if (req.headers["authorization"] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const month = currentMonth();

    // Pull every usage row for the current month. For a small user base this
    // is a trivial query; if the user count ever reaches tens of thousands
    // we'd want pagination, not the case for a while yet.
    const { data: rows, error } = await supabase
      .from("usage_tracking")
      .select("user_id, conversations_used, handsfree_seconds_used")
      .eq("month", month);

    if (error) {
      console.error("[check-ai-spend] usage_tracking query failed:", error.message);
      return res.status(500).json({ error: error.message });
    }

    if (!rows?.length) {
      console.log("[check-ai-spend] No usage rows this month — nothing to check");
      return res.json({ success: true, month, users: 0, flagged: 0, ms: Date.now() - start });
    }

    // Compute estimated monthly spend per user.
    const estimates = rows.map(r => {
      const convs   = r.conversations_used || 0;
      const hfSecs  = r.handsfree_seconds_used || 0;
      const hfMins  = Math.round(hfSecs / 60);
      const pence   = (convs * PENCE_PER_CONVERSATION)
                    + (hfMins * PENCE_PER_HF_MINUTE)
                    + PENCE_EMAIL_BASELINE;
      return { user_id: r.user_id, convs, hfMins, pence };
    }).sort((a, b) => b.pence - a.pence);

    // Filter outliers above threshold.
    const flagged = estimates.filter(e => e.pence >= ALERT_THRESHOLD_PENCE);
    const topFive = estimates.slice(0, 5);
    const totalPence = estimates.reduce((sum, e) => sum + e.pence, 0);

    // Silent-on-quiet-days rule: if nobody's over the threshold, don't send.
    if (flagged.length === 0) {
      console.log(`[check-ai-spend] ${estimates.length} users, total ${fmt(totalPence)}/mo, none above ${fmt(ALERT_THRESHOLD_PENCE)} — no alert`);
      return res.json({
        success: true,
        month,
        users: estimates.length,
        flagged: 0,
        total_pence: totalPence,
        ms: Date.now() - start,
      });
    }

    // Hydrate emails only for the users we're actually reporting (top 5 ∪ flagged)
    const toHydrate = new Set([...flagged.map(e => e.user_id), ...topFive.map(e => e.user_id)]);
    const emails = {};
    for (const id of toHydrate) {
      emails[id] = await getUserEmail(id);
    }

    const renderRow = (e) => `
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:8px 10px;font-family:monospace;font-size:11px;color:#555;">${e.user_id.slice(0, 8)}…</td>
        <td style="padding:8px 10px;font-size:12px;">${emails[e.user_id] || "<no email>"}</td>
        <td style="padding:8px 10px;font-size:12px;text-align:right;">${e.convs}</td>
        <td style="padding:8px 10px;font-size:12px;text-align:right;">${e.hfMins}</td>
        <td style="padding:8px 10px;font-size:12px;text-align:right;font-weight:700;color:${e.pence >= ALERT_THRESHOLD_PENCE ? "#b91c1c" : "#1a1a1a"};">${fmt(e.pence)}</td>
      </tr>
    `;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#1a1a1a;">
        <div style="background:#f59e0b;padding:18px 22px;border-radius:8px 8px 0 0;color:#fff;">
          <div style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;opacity:0.85;">Trade PA Ops</div>
          <div style="font-size:18px;font-weight:700;margin-top:4px;">AI spend canary — ${flagged.length} user${flagged.length > 1 ? "s" : ""} over ${fmt(ALERT_THRESHOLD_PENCE)}</div>
        </div>
        <div style="padding:20px 22px;background:#fff;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px;">
          <p style="margin-top:0;font-size:13px;">Month: <strong>${month}</strong> · Total estimated spend across ${estimates.length} users: <strong>${fmt(totalPence)}</strong></p>

          <h3 style="font-size:14px;margin:20px 0 8px;">Flagged (≥ ${fmt(ALERT_THRESHOLD_PENCE)})</h3>
          <table style="width:100%;border-collapse:collapse;background:#fafafa;border:1px solid #eee;">
            <thead>
              <tr style="background:#f0f0f0;">
                <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#666;">User ID</th>
                <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#666;">Email</th>
                <th style="padding:8px 10px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#666;">Convos</th>
                <th style="padding:8px 10px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#666;">HF min</th>
                <th style="padding:8px 10px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#666;">Est. spend</th>
              </tr>
            </thead>
            <tbody>${flagged.map(renderRow).join("")}</tbody>
          </table>

          <h3 style="font-size:14px;margin:24px 0 8px;">Top 5 by spend this month</h3>
          <table style="width:100%;border-collapse:collapse;background:#fafafa;border:1px solid #eee;">
            <thead>
              <tr style="background:#f0f0f0;">
                <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#666;">User ID</th>
                <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#666;">Email</th>
                <th style="padding:8px 10px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#666;">Convos</th>
                <th style="padding:8px 10px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#666;">HF min</th>
                <th style="padding:8px 10px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#666;">Est. spend</th>
              </tr>
            </thead>
            <tbody>${topFive.map(renderRow).join("")}</tbody>
          </table>

          <p style="font-size:11px;color:#777;margin-top:20px;line-height:1.5;">
            Estimates assume ${PENCE_PER_CONVERSATION}p/conversation + ${PENCE_PER_HF_MINUTE}p/hands-free minute + ${fmt(PENCE_EMAIL_BASELINE)} email baseline per active user. Rough order-of-magnitude, not exact billing. Adjust thresholds in <code>api/cron/check-ai-spend.js</code>.
          </p>
        </div>
      </div>
    `;

    const sent = await sendAlertEmail(
      `[Trade PA Ops] AI spend — ${flagged.length} flagged (${month})`,
      html
    );

    console.log(`[check-ai-spend] ${estimates.length} users, ${flagged.length} flagged, alert sent=${sent}`);
    return res.json({
      success: true,
      month,
      users: estimates.length,
      flagged: flagged.length,
      total_pence: totalPence,
      alert_sent: sent,
      ms: Date.now() - start,
    });

  } catch (err) {
    console.error("[check-ai-spend] error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}

export default withSentry(handler, { routeName: "cron/check-ai-spend" });
