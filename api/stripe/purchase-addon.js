// api/stripe/purchase-addon.js
// One-off add-on purchase using saved payment method (off-session).
// Add-ons extend current billing period allowances.

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const ADDON_CATALOGUE = {
  conversations: {
    priceEnv: "STRIPE_PRICE_ADDON_CONV_500",
    display_name: "+500 AI conversations",
    amount_pence: 3900,
    extra_conversations: 500,
    extra_handsfree_hours: 0,
  },
  handsfree: {
    priceEnv: "STRIPE_PRICE_ADDON_HF_10",
    display_name: "+10 hands-free hours",
    amount_pence: 1900,
    extra_conversations: 0,
    extra_handsfree_hours: 10,
  },
  combo: {
    priceEnv: "STRIPE_PRICE_ADDON_COMBO",
    display_name: "+500 conversations & +10 hands-free hours",
    amount_pence: 5500,
    extra_conversations: 500,
    extra_handsfree_hours: 10,
  },
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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ error: "unauthorised", message: "Valid auth token required." });
  }

  const { addon_type } = req.body || {};
  const addonConfig = ADDON_CATALOGUE[addon_type];
  if (!addonConfig) {
    return res.status(400).json({ error: "invalid_addon", message: "Unknown add-on type." });
  }

  try {
    // 1. Confirm active subscription
    const { data: subs, error: subErr } = await supabaseAdmin
      .from("subscriptions")
      .select("id, stripe_customer_id, stripe_subscription_id, status, current_period_end")
      .eq("user_id", userId)
      .in("status", ["active", "trialing", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (subErr || !subs?.[0]) {
      return res.status(402).json({
        error: "no_subscription",
        message: "An active Trade PA subscription is required to purchase add-ons.",
      });
    }
    const sub = subs[0];

    // 2. Get saved payment method
    const customer = await stripe.customers.retrieve(sub.stripe_customer_id);
    const paymentMethodId = customer.invoice_settings?.default_payment_method;
    if (!paymentMethodId) {
      return res.status(402).json({
        error: "no_payment_method",
        message: "No payment method on file. Please update billing details.",
      });
    }

    // 3. Create pending addon_purchases row (webhook will flip to active)
    const expiresAt = sub.current_period_end || new Date(Date.now() + 30 * 86400 * 1000).toISOString();

    const { data: pendingRow, error: insertErr } = await supabaseAdmin
      .from("addon_purchases")
      .insert({
        user_id: userId,
        subscription_id: sub.id,
        addon_type,
        amount_pence: addonConfig.amount_pence,
        extra_conversations: addonConfig.extra_conversations,
        extra_handsfree_hours: addonConfig.extra_handsfree_hours,
        expires_at: expiresAt,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("[purchase-addon] DB insert failed:", insertErr);
      return res.status(500).json({ error: "db_error" });
    }

    // 4. Create and confirm PaymentIntent off-session
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: addonConfig.amount_pence,
        currency: "gbp",
        customer: sub.stripe_customer_id,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        description: `Trade PA add-on: ${addonConfig.display_name}`,
        metadata: {
          type: "addon",
          supabase_user_id: userId,
          addon_type,
          addon_purchase_id: pendingRow.id,
        },
      });
    } catch (stripeErr) {
      // Rollback: mark addon_purchase as failed
      await supabaseAdmin
        .from("addon_purchases")
        .update({ status: "failed" })
        .eq("id", pendingRow.id);

      if (stripeErr.code === "authentication_required") {
        return res.status(402).json({
          error: "authentication_required",
          message: "Your card requires authentication. Please update your payment method and try again.",
        });
      }
      return res.status(402).json({
        error: "payment_failed",
        message: stripeErr.message || "Payment could not be processed.",
      });
    }

    // 5. Store payment intent ID on the row so webhook can match
    await supabaseAdmin
      .from("addon_purchases")
      .update({ stripe_payment_intent_id: paymentIntent.id })
      .eq("id", pendingRow.id);

    // 6. If payment succeeded synchronously, activate immediately
    //    (webhook will also fire, but it's idempotent)
    if (paymentIntent.status === "succeeded") {
      await supabaseAdmin
        .from("addon_purchases")
        .update({ status: "active", activated_at: new Date().toISOString() })
        .eq("id", pendingRow.id);
    }

    return res.status(200).json({
      success: true,
      addon_type,
      display_name: addonConfig.display_name,
      amount_pence: addonConfig.amount_pence,
      payment_intent_id: paymentIntent.id,
      payment_status: paymentIntent.status,
      expires_at: expiresAt,
    });

  } catch (err) {
    console.error("[purchase-addon] error:", err);
    return res.status(500).json({
      error: err.code || "internal_error",
      message: err.message || "Add-on purchase failed.",
    });
  }
}
