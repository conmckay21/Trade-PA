// api/cron/process-reminders.js
// Runs every 5 min via Vercel Cron. Finds reminders due within the next 15 min,
// sends an email via Resend, marks fired=true so we don't double-send.
//
// Scheduled in vercel.json: "*/5 * * * *"
//
// Query window:
//   fire_at <= now + 15min   (emails fire up to 15 min before due)
//   fire_at >= now - 24h     (safety: ignore stale unfired reminders older than a day)
//   fired  = false           (not yet sent)
//   done   = false           (not already marked done)
//
// Security: Vercel Cron includes Authorization: Bearer <CRON_SECRET> header.
// We reject anything else to prevent the URL from being triggered externally.

import { createClient } from "@supabase/supabase-js";
import { sendReminder } from "../lib/resend.js";
import { withSentry } from "../lib/sentry.js";

const QUERY_LOOKAHEAD_MS = 15 * 60 * 1000;       // 15 minutes
const QUERY_LOOKBEHIND_MS = 24 * 60 * 60 * 1000;  // 24 hours
const BATCH_LIMIT = 100;                           // process max 100 per run

async function handler(req, res) {
  // ---- Auth check --------------------------------------------------------
  const auth = req.headers.authorization || "";
  if (!process.env.CRON_SECRET) {
    console.error("[process-reminders] CRON_SECRET env var not set — refusing to run");
    return res.status(500).json({ error: "Cron secret not configured" });
  }
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn("[process-reminders] unauthorized request");
    return res.status(401).json({ error: "Unauthorized" });
  }

  // ---- Supabase client ---------------------------------------------------
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("[process-reminders] Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY");
    return res.status(500).json({ error: "Supabase not configured" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ---- Query due reminders ----------------------------------------------
  const now = Date.now();
  const windowEnd   = new Date(now + QUERY_LOOKAHEAD_MS).toISOString();
  const windowStart = new Date(now - QUERY_LOOKBEHIND_MS).toISOString();

  const { data: reminders, error: qErr } = await supabase
    .from("reminders")
    .select("id, user_id, text, fire_at, created_at")
    .eq("fired", false)
    .eq("done", false)
    .lte("fire_at", windowEnd)
    .gte("fire_at", windowStart)
    .order("fire_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (qErr) {
    console.error("[process-reminders] query error:", qErr.message);
    return res.status(500).json({ error: qErr.message });
  }

  if (!reminders || reminders.length === 0) {
    return res.status(200).json({ processed: 0, sent: 0, failed: 0 });
  }

  console.log(`[process-reminders] found ${reminders.length} due reminders`);

  // ---- Process each reminder --------------------------------------------
  const results = { processed: reminders.length, sent: 0, failed: 0, errors: [] };
  const userEmailCache = {}; // avoid duplicate auth.admin lookups per user

  for (const reminder of reminders) {
    try {
      // Look up user email (cached per-user within this run)
      let email = userEmailCache[reminder.user_id];
      if (!email) {
        const { data: userRes, error: uErr } = await supabase.auth.admin.getUserById(reminder.user_id);
        if (uErr || !userRes?.user?.email) {
          const msg = uErr?.message || "user not found";
          console.error(`[process-reminders] no email for user ${reminder.user_id}: ${msg}`);
          results.failed++;
          results.errors.push(`user ${reminder.user_id}: ${msg}`);
          continue;
        }
        email = userRes.user.email;
        userEmailCache[reminder.user_id] = email;
      }

      // Send email
      const ok = await sendReminder({
        to: email,
        reminderId: reminder.id,
        userId: reminder.user_id,
        text: reminder.text,
        fireAt: reminder.fire_at,
        createdAt: reminder.created_at,
      });

      if (!ok) {
        results.failed++;
        results.errors.push(`reminder ${reminder.id}: send failed`);
        continue;
      }

      // Mark fired=true (prevents re-send on next cron tick)
      const { error: upErr } = await supabase
        .from("reminders")
        .update({ fired: true })
        .eq("id", reminder.id);

      if (upErr) {
        // Email sent but mark failed — will re-send next run. Log but don't fail.
        console.error(`[process-reminders] mark fired error for ${reminder.id}: ${upErr.message}`);
        results.errors.push(`reminder ${reminder.id}: marked-fired failed (will retry)`);
      }

      results.sent++;
    } catch (err) {
      console.error(`[process-reminders] error for reminder ${reminder.id}:`, err.message);
      results.failed++;
      results.errors.push(`reminder ${reminder.id}: ${err.message}`);
    }
  }

  console.log(`[process-reminders] done: sent=${results.sent} failed=${results.failed}`);
  return res.status(200).json(results);
}

export default withSentry(handler, { routeName: "cron/process-reminders" });
