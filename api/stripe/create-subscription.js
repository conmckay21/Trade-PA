// api/stripe/create-subscription.js
// Creates a Stripe customer + SetupIntent for 30-day trial signup.
// Subscription is created with trial_period_days=30, no immediate charge.

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Plan key → env var mapping + metadata
const PLAN_CATALOGUE = {
  solo_monthly:   { priceEnv: "STRIPE_PRICE_SOLO_MONTHLY",   plan_code: "solo",  is_founding: false },
  solo_annual:    { priceEnv: "STRIPE_PRICE_SOLO_ANNUAL",    plan_code: "solo",  is_founding: false },
  solo_founding:  { priceEnv: "STRIPE_PRICE_SOLO_FOUNDING",  plan_code: "solo",  is_founding: true  },
  team_monthly:   { priceEnv: "STRIPE_PRICE_TEAM_MONTHLY",   plan_code: "team",  is_founding: false },
  team_annual:    { priceEnv: "STRIPE_PRICE_TEAM_ANNUAL",    plan_code: "team",  is_founding: false },
  pro_monthly:    { priceEnv: "STRIPE_PRICE_PRO_MONTHLY",    plan_code: "pro",   is_founding: false },
  pro_annual:     { priceEnv: "STRIPE_PRICE_PRO_ANNUAL",     plan_code: "pro",   is_founding: false },
};

const FOUNDING_MEMBER_CAP = 100;

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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ error: "unauthorised", message: "Valid auth token required." });
  }

  const { plan_key, email, first_name, last_name, business_name } = req.body || {};
  const planConfig = PLAN_CATALOGUE[plan_key];
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

    // Founding member slot check
    let foundingSlotNumber = null;
    if (planConfig.is_founding) {
      const { count, error: countErr } = await supabaseAdmin
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("is_founding_member", true);
      if (countErr) throw countErr;
      if (count >= FOUNDING_MEMBER_CAP) {
        return res.status(403).json({
          error: "founding_full",
          message: "All 100 Founding Member spots have been claimed. Please choose a standard plan.",
        });
      }
      foundingSlotNumber = (count || 0) + 1;
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
        plan_key: plan_key,
        is_founding_member: planConfig.is_founding ? "true" : "false",
        founding_slot_number: foundingSlotNumber ? String(foundingSlotNumber) : "",
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
        is_founding_member: planConfig.is_founding,
        founding_member_slot_number: foundingSlotNumber,
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
