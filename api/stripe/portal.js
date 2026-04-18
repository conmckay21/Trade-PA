// ─── /api/stripe-portal.js ─────────────────────────────────────────────
//
// Creates a Stripe Customer Portal session for the currently-authenticated
// user. The frontend POSTs to this endpoint, gets a URL back, and
// redirects the browser there. The user manages their subscription
// (update card, download invoices, cancel, reactivate) on Stripe's
// hosted portal, then gets sent back to the return_url when they're done.
//
// Auth: reads the user's access token from the Authorization header
// (Bearer). Validates it against Supabase to get the user id.
//
// Data: looks up stripe_customer_id from the subscriptions table. If the
// user has no subscription (shouldn't happen in normal flow since they
// need one to see the "Manage subscription" button), returns a 404.
//
// Platform awareness: frontend is responsible for hiding the button on
// iOS native builds — this endpoint doesn't care what platform it's
// called from. Web PWA + Android are fine. iOS has its own subscription
// management via Apple ID settings.

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

// Supabase admin client — used only to look up the user's stripe id
// after we've validated their JWT. Uses the service role key so it can
// read the subscriptions table without RLS in the way.
// Accepts either SUPABASE_SERVICE_KEY (if that's how you've named it)
// or SUPABASE_SERVICE_ROLE_KEY (Supabase's canonical name).
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Supabase anon client — used only to validate the user's JWT.
const supabaseAnon = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // ── 1. Authenticate ────────────────────────────────────────────
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;
    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { data: userData, error: userErr } = await supabaseAnon.auth.getUser(token);
    if (userErr || !userData?.user) {
      return res.status(401).json({ error: "Invalid token" });
    }
    const userId = userData.user.id;

    // ── 2. Look up their Stripe customer id ────────────────────────
    const { data: sub, error: subErr } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id, status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subErr) {
      console.error("[stripe-portal] subscriptions lookup failed:", subErr);
      return res.status(500).json({ error: "Lookup failed" });
    }

    if (!sub?.stripe_customer_id) {
      return res.status(404).json({
        error: "No subscription found",
        message: "You don't have an active subscription to manage yet.",
      });
    }

    // ── 3. Create a portal session ─────────────────────────────────
    // return_url is where Stripe sends the user back after they're done.
    // We use the app origin from the Referer header so staging and prod
    // both work automatically.
    const origin = req.headers.origin
      || (req.headers.referer ? new URL(req.headers.referer).origin : null)
      || "https://www.tradespa.co.uk";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${origin}/?settings=subscription`,
    });

    return res.status(200).json({ url: portalSession.url });
  } catch (err) {
    console.error("[stripe-portal] failed:", err);
    return res.status(500).json({
      error: "Failed to create portal session",
      detail: err?.message || String(err),
    });
  }
}
