// api/cron/check-overdue.js
// Daily sweep that flips sent invoices to overdue once their due_date has passed.
//
// Scheduled in vercel.json: "0 6 * * *" (06:00 UTC, ahead of the 08:00 and 09:00
// jobs so overdue status is set before any downstream chasing runs).
//
// due_date is populated by a DB trigger (trg_set_invoice_due_date) on every
// invoice insert path, so this cron only compares it to today's date in the UK
// timezone. Quotes are excluded (is_quote = false); drafts and paid invoices are
// left alone (status = 'sent' only).
//
// Security: Vercel Cron sends Authorization: Bearer <CRON_SECRET>. Anything else
// is rejected so the URL cannot be triggered externally.

import { createClient } from "@supabase/supabase-js";
import { withSentry } from "../lib/sentry.js";

async function handler(req, res) {
  const auth = req.headers.authorization;
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("[check-overdue] Supabase not configured");
    return res.status(500).json({ error: "Server not configured" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Today in UK time as YYYY-MM-DD (en-CA formats ISO-style).
  const ukToday = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });

  try {
    const { data, error } = await supabase
      .from("invoices")
      .update({ status: "overdue", updated_at: new Date().toISOString() })
      .eq("is_quote", false)
      .eq("status", "sent")
      .is("deleted_at", null)
      .not("due_date", "is", null)
      .lt("due_date", ukToday)
      .select("id, user_id");

    if (error) {
      console.error("[check-overdue] update failed:", error.message);
      return res.status(500).json({ error: error.message });
    }

    const marked = data?.length || 0;
    if (marked > 0) {
      console.log(`[check-overdue] marked ${marked} invoice(s) overdue (UK date ${ukToday})`);
    }
    return res.status(200).json({ ok: true, marked, date: ukToday });
  } catch (err) {
    console.error("[check-overdue] fatal:", err.message);
    return res.status(500).json({ error: "Internal error" });
  }
}

export default withSentry(handler, { routeName: "cron/check-overdue" });
