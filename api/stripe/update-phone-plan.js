// api/stripe/update-phone-plan.js
// In-app phone plan switch for existing phone subscribers.
// Reuses the customer.subscription.updated webhook — no DB changes here.
//
// FLOW:
// 1. Client POSTs { phone_plan: 'phone_600' } with Bearer auth
// 2. We look up the user's existing phone Stripe subscription
// 3. We update the subscription item to the new price (prorated today)
// 4. Webhook customer.subscription.updated fires → handlePhoneSubscriptionUpdated
//    in api/stripe/webhook.js patches call_tracking with new quota / hard_cap / plan
// 5. Next page load on client reflects the new plan.

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { withSentry } from "../lib/sentry.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// phone_plan key → env var containing the live Stripe price ID.
// All four env vars already exist in Vercel.
const PLAN_TO_PRICE_ENV = {
  phone_100:       "STRIPE_PRICE_PHONE_100",
  phone_300:       "STRIPE_PRICE_PHONE_300",
  phone_600:       "STRIPE_PRICE_PHONE_600",
  phone_unlimited: "STRIPE_PRICE_PHONE_UNLIMITED",
};

// Display labels — kept in sync with PHONE_TIERS in App.jsx CallTrackingSettings.
const PLAN_DISPLAY = {
  phone_100:       { mins: "100 mins",  price: "£20"  },
  phone_300:       { mins: "300 mins",  price: "£40"  },
  phone_600:       { mins: "600 mins",  price: "£65"  },
  phone_unlimited: { mins: "Unlimited", price: "£104" },
};

async function getUserIdFromRequest(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch { return null; }
}

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ error: "unauthorised", message: "Valid auth token required." });
  }

  const { phone_plan: targetPlan } = req.body || {};
  if (!PLAN_TO_PRICE_ENV[targetPlan]) {
    return res.status(400).json({ error: "invalid_plan", message: "Unknown phone plan." });
  }

  const newPriceId = process.env[PLAN_TO_PRICE_ENV[targetPlan]];
  if (!newPriceId) {
    console.error(`[update-phone-plan] Missing env var: ${PLAN_TO_PRICE_ENV[targetPlan]}`);
    return res.status(500).json({ error: "price_not_configured" });
  }

  try {
    // 1. Find the user's active phone subscription (via call_tracking)
    const { data: ctRows, error: ctErr } = await supabaseAdmin
      .from("call_tracking")
      .select("stripe_subscription_id, phone_plan, twilio_number")
      .eq("user_id", userId)
      .not("stripe_subscription_id", "is", null)
      .limit(1);

    if (ctErr || !ctRows?.[0]?.stripe_subscription_id) {
      return res.status(402).json({
        error: "no_phone_subscription",
        message: "No active phone subscription found. Please activate a phone plan first.",
      });
    }

    const ct = ctRows[0];

    // 2. Same-plan guard
    if (ct.phone_plan === targetPlan) {
      return res.status(400).json({
        error: "same_plan",
        message: "You're already on this plan.",
      });
    }

    // 3. Fetch Stripe sub to get the item ID to replace
    const stripeSub = await stripe.subscriptions.retrieve(ct.stripe_subscription_id);
    const itemId = stripeSub.items?.data?.[0]?.id;
    if (!itemId) {
      console.error(`[update-phone-plan] no item on sub ${ct.stripe_subscription_id}`);
      return res.status(500).json({ error: "no_subscription_item" });
    }

    // 4. Swap the item to the new price — prorated to today.
    //    Preserve existing metadata (type: 'phone_subscription' etc) so the
    //    webhook's isPhoneSubscription() check still matches.
    await stripe.subscriptions.update(ct.stripe_subscription_id, {
      items: [{ id: itemId, price: newPriceId }],
      proration_behavior: "create_prorations",
      metadata: {
        ...(stripeSub.metadata || {}),
        type: "phone_subscription",
        phone_plan: targetPlan,
      },
    });

    // 5. Webhook customer.subscription.updated will now fire and
    //    handlePhoneSubscriptionUpdated in webhook.js syncs call_tracking
    //    with new plan / quota / hard_cap. Nothing to do here.

    return res.status(200).json({
      success: true,
      phone_plan: targetPlan,
      display: PLAN_DISPLAY[targetPlan],
      message: "Plan updated. New allowance is live immediately; prorated charge applies to your next invoice.",
    });
  } catch (err) {
    console.error("[update-phone-plan] error:", err);
    if (err.code === "card_declined" || err.code === "authentication_required") {
      return res.status(402).json({
        error: err.code,
        message: "Your card couldn't be charged for the prorated amount. Please update your payment method and try again.",
      });
    }
    return res.status(500).json({
      error: err.code || "internal_error",
      message: err.message || "Plan change failed.",
    });
  }
}

export default withSentry(handler, { routeName: "stripe/update-phone-plan" });
