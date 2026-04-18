// api/stripe/create-phone-subscription.js
// Atomic: Stripe sub + Twilio number + call_tracking row. Rolls back Twilio if Stripe fails.

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const PHONE_PLAN_CATALOGUE = {
  phone_100: {
    priceEnv: "STRIPE_PRICE_PHONE_100",
    display_name: "Business Phone — 100 mins",
    monthly_minute_quota: 100, hard_cap_minutes: 120, price_pence: 2000,
  },
  phone_300: {
    priceEnv: "STRIPE_PRICE_PHONE_300",
    display_name: "Business Phone — 300 mins",
    monthly_minute_quota: 300, hard_cap_minutes: 360, price_pence: 4000,
  },
  phone_600: {
    priceEnv: "STRIPE_PRICE_PHONE_600",
    display_name: "Business Phone — 600 mins",
    monthly_minute_quota: 600, hard_cap_minutes: 720, price_pence: 6500,
  },
  phone_unlimited: {
    priceEnv: "STRIPE_PRICE_PHONE_UNLIMITED",
    display_name: "Business Phone — Unlimited (fair use)",
    monthly_minute_quota: 3000, hard_cap_minutes: 3000, price_pence: 10400,
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

async function twilioBuyNumber(userId) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const appUrl = process.env.APP_URL;
  const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
  const twilioBase = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}`;

  const searchRes = await fetch(
    `${twilioBase}/AvailablePhoneNumbers/GB/Local.json?VoiceEnabled=true&SmsEnabled=false&PageSize=5`,
    { headers: { Authorization: authHeader } }
  );
  if (!searchRes.ok) throw new Error("twilio_search_failed");
  const searchData = await searchRes.json();
  const available = searchData.available_phone_numbers || [];
  if (available.length === 0) throw new Error("twilio_no_numbers_available");
  const chosenNumber = available[0].phone_number;

  const webhookUrl = `${appUrl}/api/calls/incoming?userId=${userId}`;
  const purchaseRes = await fetch(`${twilioBase}/IncomingPhoneNumbers.json`, {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      PhoneNumber: chosenNumber, VoiceUrl: webhookUrl, VoiceMethod: "POST",
    }).toString(),
  });
  if (!purchaseRes.ok) {
    const errText = await purchaseRes.text();
    throw new Error(`twilio_purchase_failed: ${errText.slice(0, 120)}`);
  }
  const purchaseData = await purchaseRes.json();
  return { twilio_number: purchaseData.phone_number, twilio_number_sid: purchaseData.sid };
}

async function twilioReleaseNumber(numberSid) {
  if (!numberSid) return;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
  try {
    await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers/${numberSid}.json`,
      { method: "DELETE", headers: { Authorization: authHeader } }
    );
  } catch (err) {
    console.error(`[create-phone-sub] Failed to release Twilio number ${numberSid}:`, err.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: "unauthorised", message: "Valid auth token required." });

  const { phone_plan, forward_to } = req.body || {};
  const planConfig = PHONE_PLAN_CATALOGUE[phone_plan];
  if (!planConfig) return res.status(400).json({ error: "invalid_phone_plan", message: "Unknown phone plan." });
  if (!forward_to || typeof forward_to !== "string" || forward_to.trim().length < 6) {
    return res.status(400).json({ error: "invalid_forward_to", message: "Fallback mobile number required." });
  }

  const priceId = process.env[planConfig.priceEnv];
  if (!priceId) {
    console.error(`[create-phone-sub] Env var ${planConfig.priceEnv} missing`);
    return res.status(500).json({ error: "plan_not_configured" });
  }

  const forwardToClean = forward_to.replace(/\s/g, "");
  let purchasedNumber = null;

  try {
    const { data: mainSubs, error: mainErr } = await supabaseAdmin
      .from("subscriptions")
      .select("id, stripe_customer_id, status")
      .eq("user_id", userId)
      .in("status", ["active", "trialing", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1);
    if (mainErr || !mainSubs?.[0]) {
      return res.status(402).json({
        error: "no_main_subscription",
        message: "An active Trade PA subscription is required before adding Business Phone.",
      });
    }
    const mainSub = mainSubs[0];

    const { data: existingCt } = await supabaseAdmin
      .from("call_tracking")
      .select("id, twilio_number, stripe_subscription_id, phone_plan")
      .eq("user_id", userId)
      .maybeSingle();
    if (existingCt?.stripe_subscription_id) {
      return res.status(409).json({
        error: "phone_subscription_exists",
        message: "You already have an active Business Phone subscription.",
      });
    }

    const customer = await stripe.customers.retrieve(mainSub.stripe_customer_id);
    const paymentMethodId = customer.invoice_settings?.default_payment_method;
    if (!paymentMethodId) {
      return res.status(402).json({
        error: "no_payment_method",
        message: "No payment method on file. Please update billing details.",
      });
    }

    purchasedNumber = await twilioBuyNumber(userId);
    console.log(`[create-phone-sub] Bought ${purchasedNumber.twilio_number} for user ${userId}`);

    let subscription;
    try {
      subscription = await stripe.subscriptions.create({
        customer: mainSub.stripe_customer_id,
        items: [{ price: priceId }],
        default_payment_method: paymentMethodId,
        payment_behavior: "error_if_incomplete",
        metadata: {
          type: "phone_subscription",
          supabase_user_id: userId,
          phone_plan,
          twilio_number: purchasedNumber.twilio_number,
          twilio_number_sid: purchasedNumber.twilio_number_sid,
        },
      });
    } catch (stripeErr) {
      console.error(`[create-phone-sub] Stripe sub failed, releasing Twilio number:`, stripeErr.message);
      await twilioReleaseNumber(purchasedNumber.twilio_number_sid);
      return res.status(402).json({
        error: "payment_failed",
        message: stripeErr.message || "Payment could not be processed.",
      });
    }

    const intlNumber = purchasedNumber.twilio_number.replace("+", "");
    const forwardingCode = `**21*${intlNumber}#`;
    const disableCode = `##21#`;
    const currentPeriodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString() : null;

    const { error: upsertErr } = await supabaseAdmin
      .from("call_tracking")
      .upsert({
        user_id: userId,
        twilio_number: purchasedNumber.twilio_number,
        twilio_number_sid: purchasedNumber.twilio_number_sid,
        forwarding_code: forwardingCode,
        disable_code: disableCode,
        forward_to: forwardToClean,
        active: true,
        phone_plan,
        monthly_minute_quota: planConfig.monthly_minute_quota,
        hard_cap_minutes: planConfig.hard_cap_minutes,
        minutes_used_month: 0,
        minutes_month_reset_at: new Date().toISOString(),
        stripe_subscription_id: subscription.id,
        stripe_price_id: priceId,
        stripe_customer_id: mainSub.stripe_customer_id,
      }, { onConflict: "user_id" });

    if (upsertErr) {
      console.error(`[create-phone-sub] CRITICAL: Payment + number OK but DB upsert failed:`, upsertErr);
    }

    return res.status(200).json({
      success: true,
      subscription_id: subscription.id,
      phone_plan,
      twilio_number: purchasedNumber.twilio_number,
      forwarding_code: forwardingCode,
      disable_code: disableCode,
      monthly_minute_quota: planConfig.monthly_minute_quota,
      current_period_end: currentPeriodEnd,
    });

  } catch (err) {
    if (purchasedNumber?.twilio_number_sid) {
      await twilioReleaseNumber(purchasedNumber.twilio_number_sid);
    }
    console.error("[create-phone-sub] error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
