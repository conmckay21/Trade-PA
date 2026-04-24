// api/calendar.js
// Subscribable iCalendar feed for Trade PA.
//
// URL pattern: /api/calendar/<token>.ics (via rewrite in vercel.json)
//   Rewrite maps the pretty URL to /api/calendar?token=<token>. Handler reads
//   req.query.token either way so the direct form also works.
//
// Auth: token-only (no session). The token is a per-user 36-char random string
// stored in user_settings.brand_data.calendarToken. Anyone with the URL can
// read the calendar — same trust model as Google's "secret address in iCal
// format". Users rotate the token from Settings → Notifications → Calendar
// Subscription, which invalidates any subscriptions using the old URL.
//
// ⚠ Zero-dependency implementation: uses native fetch() against Supabase's
// PostgREST API, matching the pattern of other Trade PA serverless functions.
//
// Env vars on Vercel (tolerates multiple naming conventions):
//   VITE_SUPABASE_URL (or SUPABASE_URL)                          — project URL
//   SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)          — service role key
//                                                                  ⚠ Server-only.
//
// Schema notes (real column names in Trade PA's `jobs` table):
//   date_obj      — canonical ISO date/datetime used for ordering + calendar events
//   date          — human-readable display string fallback
//   customer, address, type, status, value, notes  — event details

import { withSentry } from "./lib/sentry.js";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;

const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

// ─── Response helper ────────────────────────────────────────────────────────
// Vercel's serverless response object is raw http.ServerResponse — it does NOT
// have Express-style chainable helpers like res.type(). Using setHeader +
// status + send separately is the safe pattern across Vercel Node runtimes.
function sendText(res, status, body) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.status(status).send(body);
}

async function supabaseSelect(table, query) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Supabase ${res.status}: ${errText.slice(0, 200)}`);
  }
  return res.json();
}

function esc(s) {
  return String(s || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// RFC 5545 line folding: max 75 octets per line, fold with CRLF + space
function fold(line) {
  if (line.length <= 75) return line;
  let out = "";
  let remaining = line;
  while (remaining.length > 75) {
    out += remaining.slice(0, 75) + "\r\n ";
    remaining = remaining.slice(75);
  }
  return out + remaining;
}

function dt(d) {
  const x = new Date(d);
  if (isNaN(x.getTime())) return "";
  return x.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function buildICS(jobs, brandName) {
  const now = dt(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Trade PA//Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(brandName || "Trade PA")} — Jobs`,
    "X-WR-TIMEZONE:Europe/London",
  ];

  (jobs || []).forEach((job) => {
    // date_obj is the canonical ISO timestamp; fall back to date (display
    // string) if date_obj is null for any reason.
    const dateSrc = job.date_obj || job.date;
    const startD = dateSrc ? new Date(dateSrc) : null;
    if (!startD || isNaN(startD.getTime())) return;
    // No duration column in the schema — default to 60 min per event.
    // Users can resize in their calendar app if needed.
    const endD = new Date(startD.getTime() + 60 * 60 * 1000);
    const summary = `${job.type || "Job"} — ${job.customer || "Unknown"}`;
    const desc = [
      job.notes ? `Notes: ${job.notes}` : null,
      job.value ? `Value: £${parseFloat(job.value).toFixed(2)}` : null,
      job.status ? `Status: ${job.status}` : null,
    ].filter(Boolean).join("\n");

    lines.push("BEGIN:VEVENT");
    lines.push(fold(`UID:job-${job.id}@tradespa.co.uk`));
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART:${dt(startD)}`);
    lines.push(`DTEND:${dt(endD)}`);
    lines.push(fold(`SUMMARY:${esc(summary)}`));
    if (job.address) lines.push(fold(`LOCATION:${esc(job.address)}`));
    if (desc) lines.push(fold(`DESCRIPTION:${esc(desc)}`));
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).end();
  }

  let token = req.query.token || "";
  if (token.endsWith(".ics")) token = token.slice(0, -4);
  if (!/^[a-z0-9]{20,64}$/i.test(token)) {
    return sendText(res, 404, "Calendar not found.");
  }

  if (!SUPABASE_URL) {
    console.error("[calendar] missing SUPABASE_URL / VITE_SUPABASE_URL");
    return sendText(res, 500, "Calendar service unavailable: no Supabase URL configured.");
  }
  if (!SUPABASE_SERVICE_KEY) {
    console.error("[calendar] missing SUPABASE_SERVICE_KEY / SUPABASE_SERVICE_ROLE_KEY");
    return sendText(res, 500, "Calendar service unavailable: no service key configured.");
  }

  try {
    // PostgREST JSON path equality: brand_data->>calendarToken=eq.<token>
    const settingsRows = await supabaseSelect(
      "user_settings",
      `select=user_id,brand_data&brand_data->>calendarToken=eq.${encodeURIComponent(token)}&limit=1`
    );

    if (!Array.isArray(settingsRows) || settingsRows.length === 0) {
      return sendText(res, 404, "Calendar not found.");
    }

    const settings = settingsRows[0];
    const brandName = settings.brand_data?.tradingName || "Trade PA";

    const jobs = await supabaseSelect(
      "jobs",
      `select=id,customer,address,type,date,date_obj,status,value,notes&user_id=eq.${encodeURIComponent(settings.user_id)}&order=date_obj.asc&limit=500`
    );

    const ics = buildICS(jobs || [], brandName);

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `inline; filename="trade-pa-schedule.ics"`);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(200).send(ics);
  } catch (err) {
    console.error("[calendar] error:", err.message);
    return sendText(res, 500, `Calendar error: ${err.message.slice(0, 200)}`);
  }
}

export default withSentry(handler, { routeName: "calendar" });
