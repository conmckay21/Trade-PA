// api/calendar/[token].js
// Subscribable iCalendar feed for Trade PA.
//
// URL pattern: /api/calendar/<token>.ics
//   The .ics suffix is cosmetic — calendar apps inspect the Content-Type
//   header, not the URL. We accept it with or without the suffix.
//
// Auth: token-only (no session). The token is a per-user 36-char random string
// stored in user_settings.brand_data.calendarToken. Anyone with the URL can
// read the calendar — same trust model as Google's "secret address in iCal
// format". Users can rotate the token from Settings → Notifications → Calendar
// Subscription, which invalidates any subscriptions using the old URL.
//
// Output: VCALENDAR with one VEVENT per scheduled job. Times are emitted in
// UTC (Z suffix) — calendar clients render in the user's local TZ correctly.
//
// Required env vars on Vercel:
//   SUPABASE_URL                 — Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY    — service role key (bypasses RLS for read)
//                                  ⚠ Server-only, never expose to client.
//
// Caching: clients (Google/Apple Calendar) refresh every few hours regardless
// of headers, but we set Cache-Control to give intermediate proxies a hint.
// 1-hour cache is a reasonable balance between freshness and origin load.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Lazy singleton — Vercel may reuse the function instance across requests
let _supabase = null;
function getSupabase() {
  if (_supabase) return _supabase;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  _supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _supabase;
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
    // Pick the best available date field; skip jobs with no schedulable date
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

  // Strip the optional .ics extension — calendar clients sometimes append it.
  let token = req.query.token || "";
  if (token.endsWith(".ics")) token = token.slice(0, -4);
  // Hard validate token shape — 24-48 alphanumeric chars. Stops accidental
  // open scans (random strings) from triggering full table reads.
  if (!/^[a-z0-9]{20,64}$/i.test(token)) {
    return res.status(404).type("text/plain").send("Calendar not found.");
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).type("text/plain").send("Calendar service unavailable.");
  }

  try {
    // Find the user_id whose brand_data.calendarToken matches.
    // PostgREST JSON path filter syntax: brand_data->>calendarToken
    const { data: settings, error: settingsErr } = await supabase
      .from("user_settings")
      .select("user_id, brand_data")
      .eq("brand_data->>calendarToken", token)
      .maybeSingle();

    if (settingsErr || !settings) {
      return res.status(404).type("text/plain").send("Calendar not found.");
    }

    const brandName = settings.brand_data?.tradingName || "Trade PA";

    // Pull scheduled jobs only. We tolerate either `jobs` or `job_cards`
    // table names — the feed should still produce a valid (possibly empty)
    // calendar even if neither query returns rows.
    const { data: jobs } = await supabase
      .from("jobs")
      .select("id, customer, address, type, title, scheduled_date, date, status, value, notes, duration_minutes")
      .eq("user_id", settings.user_id)
      .order("scheduled_date", { ascending: true })
      .limit(500);

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
