// api/cron/check-trial-status.js
//
// Daily cron that sends trial reminder emails. Runs at 09:00 UTC.
//
// Logic:
//   1. Get all subscriptions where status='trialing' OR is_in_trial=true,
//      and a stripe_subscription_id is set (skip comp/legacy users).
//   2. For each, retrieve the Stripe subscription to check if a payment
//      method is attached (default_payment_method on the sub or on the
//      customer's invoice_settings).
//   3. SKIP users who already have a payment method - Stripe will charge
//      them automatically when their trial ends, no reminder needed.
//   4. For users WITHOUT a payment method:
//       - 5-day reminder: if 4 <= days_left < 6 and 5d_sent_at is null
//       - 1-day reminder: if 0 < days_left < 2 and 1d_sent_at is null
//   5. For canceled subs (trial ended without payment): send expired email
//      if expired_sent_at is null and trial_ends_at was in last 7 days.
//   6. Update the tracking column after each successful Resend send.
//
// Auth: Bearer CRON_SECRET in Authorization header (Vercel cron sends this).
//
// Env vars required:
//   CRON_SECRET, STRIPE_SECRET_KEY, RESEND_API_KEY,
//   SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_SERVICE_KEY (or _ROLE_KEY),
//   FROM_EMAIL (default: 'Trade PA <noreply@tradespa.co.uk>')

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import {
  fiveDayReminderHtml, fiveDayReminderSubject,
  oneDayReminderHtml, oneDayReminderSubject,
  trialExpiredHtml, trialExpiredSubject,
} from "../lib/trial-emails.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.FROM_EMAIL || "Trade PA <noreply@tradespa.co.uk>";
const REPLY_TO = process.env.REPLY_TO || "connor@tradespa.co.uk";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export default async function handler(req, res) {
  // Auth check: Vercel cron sends Bearer CRON_SECRET
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const now = new Date();
  const startedAt = now.toISOString();
  const stats = { fiveDay: 0, oneDay: 0, expired: 0, skipped: 0, errors: 0 };

  try {
    // Fetch all candidate subs in one go (small user base, fine for now)
    const { data: subs, error } = await supabaseAdmin
      .from("subscriptions")
      .select(`
        user_id,
        stripe_subscription_id,
        stripe_customer_id,
        status,
        is_in_trial,
        trial_ends_at,
        trial_reminder_5d_sent_at,
        trial_reminder_1d_sent_at,
        trial_expired_email_sent_at
      `)
      .or("status.eq.trialing,status.eq.canceled,is_in_trial.eq.true")
      .not("stripe_subscription_id", "is", null);

    if (error) {
      console.error("[trial-cron] DB error:", error);
      return res.status(500).json({ error: "DB query failed" });
    }

    for (const sub of subs || []) {
      try {
        await processSubscription(sub, now, stats);
      } catch (e) {
        console.error("[trial-cron] per-sub error for", sub.user_id, e?.message);
        stats.errors += 1;
      }
    }

    console.log("[trial-cron] done", { startedAt, finishedAt: new Date().toISOString(), stats });
    return res.status(200).json({ ok: true, stats });
  } catch (err) {
    console.error("[trial-cron] fatal:", err);
    return res.status(500).json({ error: err?.message || "Unknown error" });
  }
}

// ---------- Per-subscription handler ----------
async function processSubscription(sub, now, stats) {
  // ---- Branch 1: trialing user, possibly needing reminder ----
  if ((sub.status === "trialing" || sub.is_in_trial) && sub.trial_ends_at) {
    const trialEnd = new Date(sub.trial_ends_at);
    const msLeft = trialEnd - now;
    const daysLeft = msLeft / MS_PER_DAY;

    // Only interested in 0-6 day window
    if (daysLeft < 0 || daysLeft >= 6) {
      stats.skipped += 1;
      return;
    }

    // Determine if a reminder window matches and which one
    const window5d = daysLeft >= 4 && daysLeft < 6 && !sub.trial_reminder_5d_sent_at;
    const window1d = daysLeft > 0 && daysLeft < 2 && !sub.trial_reminder_1d_sent_at;

    if (!window5d && !window1d) {
      stats.skipped += 1;
      return;
    }

    // Check Stripe: does this user have a payment method attached?
    let hasPaymentMethod = false;
    try {
      const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id, {
        expand: ["customer"],
      });
      const subPm = stripeSub.default_payment_method;
      const custPm = stripeSub.customer && typeof stripeSub.customer === "object"
        ? stripeSub.customer.invoice_settings?.default_payment_method
        : null;
      hasPaymentMethod = !!subPm || !!custPm;
    } catch (e) {
      console.warn("[trial-cron] Stripe lookup failed for", sub.user_id, e?.message);
      // If Stripe lookup fails, err on the side of NOT spamming the user
      stats.skipped += 1;
      return;
    }

    if (hasPaymentMethod) {
      stats.skipped += 1;
      return;
    }

    // Fetch user email + name
    const userInfo = await fetchUserInfo(sub.user_id);
    if (!userInfo?.email) {
      console.warn("[trial-cron] No email for user", sub.user_id);
      stats.skipped += 1;
      return;
    }

    // Send the right reminder. Prefer 1-day if both windows match
    // (e.g. trial start was off by a day and both columns are null)
    if (window1d) {
      await sendReminder({
        to: userInfo.email,
        name: userInfo.name,
        kind: "1d",
        userId: sub.user_id,
      });
      stats.oneDay += 1;
    } else if (window5d) {
      await sendReminder({
        to: userInfo.email,
        name: userInfo.name,
        kind: "5d",
        userId: sub.user_id,
      });
      stats.fiveDay += 1;
    }
    return;
  }

  // ---- Branch 2: canceled user, possibly needing expired email ----
  if (sub.status === "canceled" && !sub.trial_expired_email_sent_at && sub.trial_ends_at) {
    const trialEnd = new Date(sub.trial_ends_at);
    const msSince = now - trialEnd;
    const daysSince = msSince / MS_PER_DAY;
    // Only send if cancellation happened within last 7 days
    if (daysSince >= 0 && daysSince <= 7) {
      const userInfo = await fetchUserInfo(sub.user_id);
      if (userInfo?.email) {
        await sendReminder({
          to: userInfo.email,
          name: userInfo.name,
          kind: "expired",
          userId: sub.user_id,
        });
        stats.expired += 1;
      } else {
        stats.skipped += 1;
      }
    } else {
      stats.skipped += 1;
    }
    return;
  }

  stats.skipped += 1;
}

// ---------- Fetch user email + name from auth.users ----------
async function fetchUserInfo(userId) {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error || !data?.user) return null;
    const meta = data.user.user_metadata || {};
    const first = meta.first_name || meta.firstName || "";
    const last = meta.last_name || meta.lastName || "";
    const fullName = [first, last].filter(Boolean).join(" ") || data.user.email;
    return { email: data.user.email, name: fullName };
  } catch (e) {
    console.warn("[trial-cron] getUserById failed:", e?.message);
    return null;
  }
}

// ---------- Send one reminder + mark the column ----------
async function sendReminder({ to, name, kind, userId }) {
  let subject, html, column;
  if (kind === "5d") {
    subject = fiveDayReminderSubject;
    html = fiveDayReminderHtml(name);
    column = "trial_reminder_5d_sent_at";
  } else if (kind === "1d") {
    subject = oneDayReminderSubject;
    html = oneDayReminderHtml(name);
    column = "trial_reminder_1d_sent_at";
  } else if (kind === "expired") {
    subject = trialExpiredSubject;
    html = trialExpiredHtml(name);
    column = "trial_expired_email_sent_at";
  } else {
    return;
  }

  const { error } = await resend.emails.send({
    from: FROM,
    to,
    reply_to: REPLY_TO,
    subject,
    html,
  });

  if (error) {
    console.error("[trial-cron] Resend send error:", error);
    throw new Error(error.message || "Resend send failed");
  }

  // Mark sent
  const { error: updErr } = await supabaseAdmin
    .from("subscriptions")
    .update({ [column]: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (updErr) {
    console.warn("[trial-cron] failed to mark", column, "for", userId, updErr);
  }
}
