// api/trial/payment-method-status.js
//
// Returns whether the authenticated user has a payment method
// attached to their Stripe subscription. Used by TrialBanner to
// decide whether to show the "add payment method" nag.
//
// Auth: Bearer access token in Authorization header.
//
// Response: { has_payment_method: true | false }

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

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    const { data: userData, error: userErr } = await supabaseAnon.auth.getUser(token);
    if (userErr || !userData?.user) {
      return res.status(401).json({ error: "Invalid token" });
    }
    const userId = userData.user.id;

    const { data: sub, error: subErr } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_subscription_id, stripe_customer_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subErr) {
      console.error("[pm-status] DB error:", subErr);
      return res.status(500).json({ error: "Lookup failed" });
    }

    if (!sub?.stripe_subscription_id) {
      // No stripe subscription at all means there is no card to check.
      return res.status(200).json({ has_payment_method: false });
    }

    try {
      const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id, {
        expand: ["customer"],
      });
      const subPm = stripeSub.default_payment_method;
      const custPm = stripeSub.customer && typeof stripeSub.customer === "object"
        ? stripeSub.customer.invoice_settings?.default_payment_method
        : null;
      const hasPaymentMethod = !!subPm || !!custPm;
      return res.status(200).json({ has_payment_method: hasPaymentMethod });
    } catch (e) {
      console.warn("[pm-status] Stripe error:", e?.message);
      // Default to showing banner if we can't tell
      return res.status(200).json({ has_payment_method: false });
    }
  } catch (err) {
    console.error("[pm-status] error:", err);
    return res.status(500).json({ error: err?.message || "Unknown error" });
  }
}

export default withSentry(handler, { routeName: "trial/payment-method-status" });
