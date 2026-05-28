// api/stripe/create-checkout-session.js
//
// Smart endpoint that handles plan changes and new subscriptions.
//
// Logic by user state:
//   1. Active or trialing sub with stripe_subscription_id
//      -> stripe.subscriptions.update with the new price
//      -> Upgrade: proration_behavior='create_prorations' charges diff immediately
//      -> Downgrade: proration_behavior='none' + billing_cycle_anchor='unchanged'
//         so the new (lower) price kicks in on the next cycle, no refund
//   2. Canceled/expired sub OR no sub at all
//      -> stripe.checkout.sessions.create in subscription mode
//      -> Auto-creates customer if missing
//      -> Returns checkout URL for redirect
//
// Body: { plan_key: "solo_monthly" | "pro_solo_monthly" | "team_monthly" | "business_monthly" }
//
// Returns:
//   - { url: "..." }                 -> redirect (new subscription, Stripe Checkout)
//   - { updated: true, message: ".." } -> in-place plan change (no redirect needed)
//
// Auth: Bearer token in Authorization header. Same pattern as portal.js.

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { withSentry } from "../lib/sentry.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const supabaseAnon = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

// Plan catalogue. Must match create-subscription.js so the same env vars
// resolve to the same Stripe Price IDs across both endpoints.
const PLAN_CATALOGUE = {
  solo_monthly:     { priceEnv: "STRIPE_PRICE_SOLO_MONTHLY",     plan_code: "solo",     amount: 3900 },
  pro_solo_monthly: { priceEnv: "STRIPE_PRICE_PRO_SOLO_MONTHLY", plan_code: "pro_solo", amount: 5900 },
  team_monthly:     { priceEnv: "STRIPE_PRICE_TEAM_MONTHLY",     plan_code: "team",     amount: 8900 },
  business_monthly: { priceEnv: "STRIPE_PRICE_BUSINESS_MONTHLY", plan_code: "business", amount: 12900 },
};

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1. Authenticate
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    const { data: userData, error: userErr } = await supabaseAnon.auth.getUser(token);
    if (userErr || !userData?.user) {
      return res.status(401).json({ error: "Invalid token" });
    }
    const user = userData.user;
    const userId = user.id;

    // 2. Validate plan
    const { plan_key } = req.body || {};
    const planConfig = PLAN_CATALOGUE[plan_key];
    if (!planConfig) {
      return res.status(400).json({ error: "Invalid plan_key" });
    }

    const newPriceId = process.env[planConfig.priceEnv];
    if (!newPriceId) {
      console.error("[create-checkout] Missing env var:", planConfig.priceEnv);
      return res.status(500).json({ error: "Plan not configured" });
    }

    // 3. Look up current subscription state
    const { data: sub, error: subErr } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id, stripe_subscription_id, status, is_in_trial, plan")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subErr) {
      console.error("[create-checkout] subscriptions lookup failed:", subErr);
      return res.status(500).json({ error: "Lookup failed" });
    }

    const origin = req.headers.origin
      || (req.headers.referer ? new URL(req.headers.referer).origin : null)
      || "https://www.tradespa.co.uk";

    const successUrl = `${origin}/?settings=subscription`;
    const cancelUrl = `${origin}/upgrade.html`;

    // 4. Branch logic
    const hasActiveSubscription = sub?.stripe_subscription_id
      && (sub.status === "active" || sub.status === "trialing" || sub.is_in_trial);

    if (hasActiveSubscription) {
      // Plan change on existing subscription
      return await handlePlanChange({
        res,
        subscriptionId: sub.stripe_subscription_id,
        newPriceId,
        newPlanCode: planConfig.plan_code,
        newPlanAmount: planConfig.amount,
        userId,
      });
    } else {
      // New subscription via Checkout (canceled/expired/no sub)
      return await handleNewSubscription({
        res,
        user,
        userId,
        existingCustomerId: sub?.stripe_customer_id,
        newPriceId,
        successUrl,
        cancelUrl,
      });
    }
  } catch (err) {
    console.error("[create-checkout] error:", err);
    return res.status(500).json({
      error: "Failed to create checkout",
      detail: err?.message || String(err),
    });
  }
}

// ---------- Plan change on existing subscription ----------
async function handlePlanChange({
  res, subscriptionId, newPriceId, newPlanCode, newPlanAmount, userId,
}) {
  // Retrieve current sub to get the item id and current price
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const currentItem = subscription.items.data[0];
  const currentPriceAmount = currentItem?.price?.unit_amount || 0;

  // Determine direction
  const isUpgrade = newPlanAmount > currentPriceAmount;
  const isDowngrade = newPlanAmount < currentPriceAmount;
  const isSamePrice = newPlanAmount === currentPriceAmount;

  if (isSamePrice) {
    return res.status(400).json({ error: "Already on this plan" });
  }

  // Build update params based on direction
  const updateParams = {
    items: [{ id: currentItem.id, price: newPriceId }],
  };

  let message = "";
  if (isUpgrade) {
    // Upgrade: prorate immediately, charge diff now
    updateParams.proration_behavior = "create_prorations";
    message = "Upgrade effective immediately. You'll be charged the prorated difference on your next invoice.";
  } else {
    // Downgrade: keep current price for the rest of the period.
    // billing_cycle_anchor: 'unchanged' + proration_behavior: 'none' means
    // the new price takes effect on the next billing cycle, no refund for unused portion.
    updateParams.proration_behavior = "none";
    updateParams.billing_cycle_anchor = "unchanged";
    message = "Downgrade scheduled. You'll keep your current plan until the end of this billing period, then switch.";
  }

  const updated = await stripe.subscriptions.update(subscriptionId, updateParams);

  // Update DB to reflect new plan code immediately
  // (Webhook will also handle this but updating eagerly improves UX)
  const { error: dbErr } = await supabaseAdmin
    .from("subscriptions")
    .update({
      plan: newPlanCode,
      stripe_price_id: newPriceId,
      status: updated.status,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (dbErr) {
    console.error("[create-checkout] DB update warning (non-fatal):", dbErr);
  }

  return res.status(200).json({
    updated: true,
    message,
    direction: isUpgrade ? "upgrade" : "downgrade",
    new_plan: newPlanCode,
  });
}

// ---------- New subscription via Stripe Checkout ----------
async function handleNewSubscription({
  res, user, userId, existingCustomerId, newPriceId, successUrl, cancelUrl,
}) {
  let customerId = existingCustomerId;

  // Auto-create customer if missing
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { user_id: userId, source: "upgrade_page" },
    });
    customerId = customer.id;

    // Persist so future calls reuse
    const { error: upsertErr } = await supabaseAdmin
      .from("subscriptions")
      .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (upsertErr) {
      console.error("[create-checkout] failed to persist customer:", upsertErr);
    }
  }

  // Create Checkout Session in subscription mode
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: newPriceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    payment_method_collection: "always",
    subscription_data: {
      metadata: { user_id: userId, source: "upgrade_page" },
    },
  });

  return res.status(200).json({ url: session.url });
}

export default withSentry(handler, { routeName: "stripe/create-checkout-session" });
