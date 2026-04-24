// api/stripe/create-subscription.js
// Creates a Stripe customer + SetupIntent for 30-day trial signup.
// Subscription is created with trial_period_days=30, no immediate charge.

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { withSentry } from "../lib/sentry.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Plan key → env var mapping + metadata.
//
// Keys here MUST match what the frontend sends as `plan_key`. See the
// pricing page in App.jsx — links are built as `?plan=${p.plan}` where
// `p.plan` is one of the keys below.
//
// `plan_code` is what gets stored in the subscriptions table's `plan`
// column — matches the keys in TIER_CONFIG in App.jsx so the normalizer
// there can read caps/labels correctly.
//
// Monthly-only as of Apr 2026 — annual plans were removed before launch
// to keep the pricing page simple and avoid locking trial customers into
// 12-month commitments before we know the product sticks. Can be added
// back later without any data migration.
const PLAN_CATALOGUE = {
  // Solo — £39/mo
  solo_monthly:       { priceEnv: "STRIPE_PRICE_SOLO_MONTHLY",       plan_code: "solo"     },

  // Pro Solo — £59/mo (new tier as of Apr 2026 migration)
  pro_solo_monthly:   { priceEnv: "STRIPE_PRICE_PRO_SOLO_MONTHLY",   plan_code: "pro_solo" },

  // Team — £89/mo flat
  team_monthly:       { priceEnv: "STRIPE_PRICE_TEAM_MONTHLY",       plan_code: "team"     },

  // Business — £129/mo flat (renamed from "pro" in the tier migration)
  business_monthly:   { priceEnv: "STRIPE_PRICE_BUSINESS_MONTHLY",   plan_code: "business" },
};

// Legacy plan key aliases. Before Apr 2026 the top tier was called "pro"
// and cost the same as the current "business" tier. If a stale signup
// link or cached page sends an old key, we transparently upgrade it to
// the new canonical key so the user never sees a 400.
const LEGACY_PLAN_ALIASES = {
  pro_monthly: "business_monthly",
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

  const { plan_key, email, first_name, last_name, business_name } = req.body || {};

  // Transparent legacy key migration — see LEGACY_PLAN_ALIASES above.
  // If a stale link sends e.g. pro_monthly, we upgrade to business_monthly
  // before lookup so the signup doesn't 400.
  const resolvedPlanKey = LEGACY_PLAN_ALIASES[plan_key] || plan_key;
  const planConfig = PLAN_CATALOGUE[resolvedPlanKey];
  if (!planConfig) {
    return res.status(400).json({ error: "invalid_plan", message: "Unknown plan." });
  }

  const priceId = process.env[planConfig.priceEnv];
  if (!priceId) {
    console.error(`[create-sub] Env var ${planConfig.priceEnv} missing`);
    return res.status(500).json({ error: "plan_not_configured" });
  }

  try {
    // Check for existing subscription (prevent duplicates)
    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("id, status")
      .eq("user_id", userId)
      .in("status", ["active", "trialing", "past_due"])
      .maybeSingle();
    if (existing) {
      return res.status(409).json({
        error: "subscription_exists",
        message: "You already have an active subscription.",
      });
    }

    // Create Stripe customer
    const customer = await stripe.customers.create({
      email,
      name: `${first_name || ""} ${last_name || ""}`.trim(),
      metadata: {
        supabase_user_id: userId,
        business_name: business_name || "",
      },
    });

    // Create subscription with 30-day trial
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      trial_period_days: 30,
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
        payment_method_types: ["card"],
      },
      // Trial settings — if payment method fails at trial end, mark sub as cancelled
      trial_settings: {
        end_behavior: {
          missing_payment_method: "cancel",
        },
      },
      expand: ["pending_setup_intent"],
      metadata: {
        type: "main",
        supabase_user_id: userId,
        plan_code: planConfig.plan_code,
        plan_key: resolvedPlanKey,
      },
    });

    const setupIntent = subscription.pending_setup_intent;
    if (!setupIntent?.client_secret) {
      throw new Error("No SetupIntent returned from Stripe.");
    }

    // Insert subscription row — webhook will keep it in sync from here
    const { error: insertErr } = await supabaseAdmin
      .from("subscriptions")
      .insert({
        user_id: userId,
        stripe_customer_id: customer.id,
        stripe_subscription_id: subscription.id,
        stripe_price_id: priceId,
        plan: planConfig.plan_code,
        status: subscription.status, // will be 'trialing'
        current_period_end: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
        is_in_trial: true,
        trial_started_at: new Date().toISOString(),
        trial_ends_at: subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null,
      });

    if (insertErr) {
      console.error("[create-sub] DB insert error:", insertErr);
      // Don't fail the signup — webhook will backfill
    }

    return res.status(200).json({
      success: true,
      client_secret: setupIntent.client_secret,
      subscription_id: subscription.id,
      customer_id: customer.id,
      trial_ends_at: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
    });

  } catch (err) {
    console.error("[create-sub] error:", err);
    return res.status(500).json({
      error: err.code || "internal_error",
      message: err.message || "Subscription setup failed.",
    });
  }
}

export default withSentry(handler, { routeName: "stripe/create-subscription" });
