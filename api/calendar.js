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
// PostgREST API rather than @supabase/supabase-js. Matches the pattern used
// by other Trade PA serverless functions (api/tts.js etc) and avoids the
// need for a root-level package.json install step.
//
// Required env vars on Vercel:
//   SUPABASE_URL                 — Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY    — service role key (bypasses RLS for read)
//                                  ⚠ Server-only, never expose to client.
//
// Output: VCALENDAR with one VEVENT per scheduled job. Times in UTC (Z suffix).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ─── Supabase REST helpers ──────────────────────────────────────────────────
// Thin wrapper around PostgREST. We use the service_role key to bypass RLS
// because the request has no authenticated user — only a calendar token.
async function supabaseSelect(table, query) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Supabase ${res.status}: ${errText.slice(0, 200)}`);
  }
  return res.json();
}

// ─── ICS generator (mirrors the client-side one in App.jsx) ─────────────────
// Kept in sync with the client version; if you edit one, edit the other.
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
    const dateSrc = job.scheduled_date || job.date_obj || job.dateObj || job.date;
    const startD = dateSrc ? new Date(dateSrc) : null;
    if (!startD || isNaN(startD.getTime())) return;
    const durationMin = parseInt(job.duration_minutes || job.duration || 60, 10) || 60;
    const endD = new Date(startD.getTime() + durationMin * 60 * 1000);
    const summary = `${job.type || job.title || "Job"} — ${job.customer || "Unknown"}`;
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

// ─── Handler ────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).end();
  }

  let token = req.query.token || "";
  if (token.endsWith(".ics")) token = token.slice(0, -4);
  if (!/^[a-z0-9]{20,64}$/i.test(token)) {
    return res.status(404).type("text/plain").send("Calendar not found.");
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[calendar] missing env vars");
    return res.status(500).type("text/plain").send("Calendar service unavailable.");
  }

  try {
    // PostgREST JSON path equality: brand_data->>calendarToken=eq.<token>
    // URL-encode the token just in case (it's always alphanumeric but defensive anyway).
    const settingsRows = await supabaseSelect(
      "user_settings",
      `select=user_id,brand_data&brand_data->>calendarToken=eq.${encodeURIComponent(token)}&limit=1`
    );

    if (!Array.isArray(settingsRows) || settingsRows.length === 0) {
      return res.status(404).type("text/plain").send("Calendar not found.");
    }

    const settings = settingsRows[0];
    const brandName = settings.brand_data?.tradingName || "Trade PA";

    const jobs = await supabaseSelect(
      "jobs",
      `select=id,customer,address,type,title,scheduled_date,date,status,value,notes,duration_minutes&user_id=eq.${encodeURIComponent(settings.user_id)}&order=scheduled_date.asc&limit=500`
    );

    const ics = buildICS(jobs || [], brandName);

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `inline; filename="trade-pa-schedule.ics"`);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(200).send(ics);
  } catch (err) {
    console.error("[calendar] error:", err.message);
    return res.status(500).type("text/plain").send("Calendar error.");
  }
}
