// api/stripe/connect-onboard.js
// Stripe Connect onboarding — Accounts v2 API flow.
//
// Replaces the legacy OAuth flow because modern Stripe platforms use
// server-side Account creation + Account Links. Simpler, no Client ID needed,
// no OAuth state/CSRF plumbing.
//
// Flow:
//   1. App.jsx sends user to /api/stripe/connect-onboard?userId=<uid>
//   2. If the user already has a stripeAccountId in brand_data, reuse it.
//      Otherwise create a fresh Standard-type connected account via Stripe API.
//   3. Persist the stripeAccountId to user_settings.brand_data immediately
//      (even before onboarding completes — lets us check status on return).
//   4. Create an Account Link (type=account_onboarding) — short-lived URL
//      that sends the user into Stripe's hosted onboarding.
//   5. 302 redirect to that URL.
//   6. User fills form on Stripe → Stripe redirects to return_url (our callback).

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function readBrandData(userId) {
  const r = await fetch(
    `${process.env.VITE_SUPABASE_URL}/rest/v1/user_settings?user_id=eq.${encodeURIComponent(userId)}&select=brand_data&limit=1`,
    { headers: {
        apikey: process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    }}
  );
  const rows = await r.json();
  return Array.isArray(rows) && rows[0] ? (rows[0].brand_data || {}) : {};
}

async function writeBrandData(userId, brandData) {
  return fetch(
    `${process.env.VITE_SUPABASE_URL}/rest/v1/user_settings?on_conflict=user_id`,
    {
      method: "POST",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        user_id: userId,
        brand_data: brandData,
        updated_at: new Date().toISOString(),
      }),
    }
  );
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("GET only.");
  }

  const userId = req.query.userId;
  if (!userId || typeof userId !== "string") {
    return res.status(400).send("Missing userId.");
  }

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const returnBase = `${proto}://${host}`;

  try {
    const brand = await readBrandData(userId);
    let stripeAccountId = brand.stripeAccountId;

    // Create the connected account if we don't have one yet. Using type:
    // "standard" so the tradesperson gets a full Stripe dashboard and the
    // tradesperson has a direct relationship with Stripe (matches your
    // Platform profile: Dashboard = Stripe Dashboard, compliance = Stripe).
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: "standard",
        country: "GB",
        // Metadata lets us cross-reference the connected account back to our
        // internal user in webhooks and Stripe dashboard lookups.
        metadata: { supabase_user_id: userId },
      });
      stripeAccountId = account.id;

      // Persist immediately so a user who abandons mid-onboarding can resume
      // next time via the same account (rather than creating a fresh one).
      brand.stripeAccountId = stripeAccountId;
      brand.stripeConnectedAt = null; // set on completion in callback
      await writeBrandData(userId, brand);
    }

    // Create a short-lived Account Link. User fills in business/KYC details,
    // bank account, etc. on Stripe's hosted page then returns via return_url.
    //
    // refresh_url is hit if the link expires (they take too long) — we send
    // them right back through this same endpoint to regenerate a fresh link.
    const link = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${returnBase}/api/stripe/connect-onboard?userId=${encodeURIComponent(userId)}`,
      return_url: `${returnBase}/api/stripe/connect-callback?userId=${encodeURIComponent(userId)}`,
      type: "account_onboarding",
    });

    res.writeHead(302, { Location: link.url });
    res.end();
  } catch (err) {
    console.error("[connect-onboard] error:", err.message);
    // Redirect back to the app with an error param so the UI can show a toast
    res.writeHead(302, {
      Location: `${returnBase}/?stripe_connect=error&reason=${encodeURIComponent((err.message || "").slice(0, 80))}`,
    });
    res.end();
  }
}
