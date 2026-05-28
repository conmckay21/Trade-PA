// api/cron/check-trial-status.js
//
// Daily cron at 09:00 UTC. Sends trial reminder emails to users without
// a payment method attached.
//
// Logic:
//   1. Fetch all subscriptions where status is trialing/canceled or
//      is_in_trial is true, AND a stripe_subscription_id exists.
//   2. For trialing subs:
//        a. Compute days left until trial_ends_at.
//        b. Determine which reminder window matches (5-day or 1-day).
//        c. Skip if the reminder was already sent (tracking column).
//        d. Check Stripe: skip if user has a payment method attached.
//        e. Send email via shared resend.js helper, mark tracking column.
//   3. For canceled subs (trial just expired without payment):
//        Send expired email once, mark tracking column.
//
// Auth: Bearer CRON_SECRET in Authorization header.

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import {
  sendTrial5DayReminder,
  sendTrial1DayReminder,
  sendTrialExpired,
} from "../lib/resend.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export default async function handler(req, res) {
  // Auth check
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const now = new Date();
  const stats = { fiveDay: 0, oneDay: 0, expired: 0, skipped: 0, errors: 0 };

  try {
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

    console.log("[trial-cron] done", { finishedAt: new Date().toISOString(), stats });
    return res.status(200).json({ ok: true, stats });
  } catch (err) {
    console.error("[trial-cron] fatal:", err);
    return res.status(500).json({ error: err?.message || "Unknown error" });
  }
}

// ---------- Per-subscription handler ----------
async function processSubscription(sub, now, stats) {
  // -- Branch 1: trialing user, possibly needing reminder --
  if ((sub.status === "trialing" || sub.is_in_trial) && sub.trial_ends_at) {
    const trialEnd = new Date(sub.trial_ends_at);
    const daysLeft = (trialEnd - now) / MS_PER_DAY;

    if (daysLeft < 0 || daysLeft >= 6) {
      stats.skipped += 1;
      return;
    }

    const window5d = daysLeft >= 4 && daysLeft < 6 && !sub.trial_reminder_5d_sent_at;
    const window1d = daysLeft > 0 && daysLeft < 2 && !sub.trial_reminder_1d_sent_at;

    if (!window5d && !window1d) {
      stats.skipped += 1;
      return;
    }

    // Stripe check: skip users who already added a card
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
      stats.skipped += 1;
      return;
    }

    if (hasPaymentMethod) {
      stats.skipped += 1;
      return;
    }

    // Fetch user email + first name
    const userInfo = await fetchUserInfo(sub.user_id);
    if (!userInfo?.email) {
      console.warn("[trial-cron] No email for user", sub.user_id);
      stats.skipped += 1;
      return;
    }

    // Send the right reminder (prefer 1-day if both windows match)
    if (window1d) {
      const ok = await sendTrial1DayReminder({
        to: userInfo.email,
        firstName: userInfo.firstName,
        trialEndsAt: sub.trial_ends_at,
      });
      if (ok) {
        await markSent(sub.user_id, "trial_reminder_1d_sent_at");
        stats.oneDay += 1;
      } else {
        stats.errors += 1;
      }
    } else if (window5d) {
      const ok = await sendTrial5DayReminder({
        to: userInfo.email,
        firstName: userInfo.firstName,
        trialEndsAt: sub.trial_ends_at,
      });
      if (ok) {
        await markSent(sub.user_id, "trial_reminder_5d_sent_at");
        stats.fiveDay += 1;
      } else {
        stats.errors += 1;
      }
    }
    return;
  }

  // -- Branch 2: canceled user, possibly needing expired email --
  if (sub.status === "canceled" && !sub.trial_expired_email_sent_at && sub.trial_ends_at) {
    const trialEnd = new Date(sub.trial_ends_at);
    const daysSince = (now - trialEnd) / MS_PER_DAY;
    if (daysSince >= 0 && daysSince <= 7) {
      const userInfo = await fetchUserInfo(sub.user_id);
      if (userInfo?.email) {
        const ok = await sendTrialExpired({
          to: userInfo.email,
          firstName: userInfo.firstName,
        });
        if (ok) {
          await markSent(sub.user_id, "trial_expired_email_sent_at");
          stats.expired += 1;
        } else {
          stats.errors += 1;
        }
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

// ---------- Fetch user email + first name ----------
async function fetchUserInfo(userId) {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error || !data?.user) return null;
    const meta = data.user.user_metadata || {};
    const firstName = meta.first_name || meta.firstName || meta.full_name?.split(" ")?.[0] || "";
    return { email: data.user.email, firstName };
  } catch (e) {
    console.warn("[trial-cron] getUserById failed:", e?.message);
    return null;
  }
}

// ---------- Mark a reminder column as sent ----------
async function markSent(userId, column) {
  const { error } = await supabaseAdmin
    .from("subscriptions")
    .update({ [column]: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) {
    console.warn("[trial-cron] failed to mark", column, "for", userId, error.message);
  }
}
