// api/stripe/connect-callback.js
// Return URL after Stripe hosted onboarding.
//
// Stripe redirects here when the user finishes (or exits) Connect onboarding.
// Unlike OAuth, there's no code to exchange — the connected account was
// already created in connect-onboard. We just need to:
//   1. Verify the account's current onboarding status via Stripe API.
//   2. If complete (charges_enabled + details_submitted), mark it connected
//      in brand_data so the UI shows "✓ Connected".
//   3. Redirect to the app with a success/partial/error flag so the UI can
//      show the right message.
//
// Note: return_url is hit even if onboarding is incomplete (user hit Back,
// closed browser mid-flow, has pending verifications, etc.). We treat it
// as "they came back" not "they finished" — always re-check the account.

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

function redirectToApp(res, host, proto, params) {
  const qs = new URLSearchParams(params).toString();
  res.writeHead(302, { Location: `${proto}://${host}/?${qs}` });
  res.end();
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("GET only.");
  }

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";

  const userId = req.query.userId;
  if (!userId || typeof userId !== "string") {
    return redirectToApp(res, host, proto, { stripe_connect: "error", reason: "missing_user" });
  }

  try {
    const brand = await readBrandData(userId);
    const stripeAccountId = brand.stripeAccountId;
    if (!stripeAccountId) {
      // No account on file — shouldn't normally hit this unless someone calls
      // the callback URL directly without going through connect-onboard first.
      return redirectToApp(res, host, proto, { stripe_connect: "error", reason: "no_account" });
    }

    // Ask Stripe the current state of the account.
    const account = await stripe.accounts.retrieve(stripeAccountId);

    // charges_enabled = can accept payments. details_submitted = user clicked
    // "Done" at the end of the onboarding form (may still have pending
    // verifications but the tradesperson has given us enough).
    const fullyReady = account.charges_enabled === true && account.details_submitted === true;

    if (fullyReady) {
      brand.stripeConnectedAt = new Date().toISOString();
      await writeBrandData(userId, brand);
      return redirectToApp(res, host, proto, { stripe_connect: "success" });
    }

    // User came back but onboarding isn't fully complete. Could be: they
    // skipped steps, are waiting on document verification, or just closed
    // the tab. Tell the UI so it can show "continue where you left off".
    return redirectToApp(res, host, proto, { stripe_connect: "pending" });
  } catch (err) {
    console.error("[connect-callback] error:", err.message);
    return redirectToApp(res, host, proto, { stripe_connect: "error", reason: (err.message || "retrieve_failed").slice(0, 80) });
  }
}
