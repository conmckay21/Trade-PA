// api/stripe/connect-checkout.js
// Creates a Stripe Checkout session for a customer paying an invoice via the
// portal. The session runs ON BEHALF of the connected tradesperson (Stripe
// Standard Connect) so funds land directly in their Stripe balance — Trade PA
// never touches the money.
//
// Triggered by the "Pay Now with Card" form POST on the portal page. The
// portal token identifies the invoice; we look it up, find the tradesperson's
// stripe_account_id, create a Checkout session, and redirect (303) to it.
//
// On payment success, Stripe fires checkout.session.completed at the Connect
// webhook (api/stripe/webhook-connect.js), which marks the invoice paid and
// notifies the tradesperson.

import Stripe from "stripe";
import { withSentry } from "../lib/sentry.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function readFormBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => {
      const params = {};
      data.split("&").forEach((pair) => {
        const [k, v] = pair.split("=");
        if (k) params[decodeURIComponent(k)] = decodeURIComponent((v || "").replace(/\+/g, " "));
      });
      resolve(params);
    });
    req.on("error", () => resolve({}));
  });
}

async function supabaseGet(path) {
  const r = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    },
  });
  return r.json();
}

function redirectBack(res, url) {
  res.writeHead(303, { Location: url });
  res.end();
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("POST only.");
  }

  // Token comes from the form POST body (hidden input on the portal page).
  // Also accept query string for direct testing / future flexibility.
  let token = req.query.token || "";
  if (!token) {
    const form = await readFormBody(req);
    token = form.token || "";
  }
  if (!/^[a-z0-9]{20,64}$/i.test(token)) {
    return res.status(400).send("Invalid token.");
  }

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const portalBase = `${proto}://${host}`;

  try {
    // Fetch invoice
    const invoices = await supabaseGet(`invoices?portal_token=eq.${encodeURIComponent(token)}&select=*&limit=1`);
    if (!Array.isArray(invoices) || invoices.length === 0) {
      return res.status(404).send("Invoice not found.");
    }
    const inv = invoices[0];

    // Fetch tradesperson's Stripe account ID from brand_data
    const settings = await supabaseGet(`user_settings?user_id=eq.${encodeURIComponent(inv.user_id)}&select=brand_data&limit=1`);
    const brand = (Array.isArray(settings) && settings[0]?.brand_data) || {};
    const stripeAccountId = brand.stripeAccountId;

    if (!stripeAccountId) {
      return res.status(400).send("This tradesperson hasn't connected card payments yet. Please use the bank transfer details on the previous page.");
    }

    // Already paid? Send them back to the portal which will show the paid status.
    if (inv.status === "paid") {
      return redirectBack(res, `${portalBase}/quote/${token}`);
    }

    const grossAmount = parseFloat(inv.gross_amount || inv.amount || 0);
    if (!(grossAmount > 0)) {
      return res.status(400).send("Invoice amount is zero or invalid.");
    }
    const amountPence = Math.round(grossAmount * 100);

    const tradingName = brand.tradingName || "Trade PA";
    const description = inv.is_quote
      ? `Quote ${inv.id}` // unusual but allowed — paying a quote upfront
      : `Invoice ${inv.id}`;

    // Create Checkout session ON BEHALF of the connected account.
    // Important: passing { stripeAccount } as the second arg routes the call
    // to the connected account, so funds settle directly to the tradie.
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "gbp",
            product_data: {
              name: `${description} — ${tradingName}`,
              description: inv.customer ? `Payment from ${inv.customer}` : undefined,
            },
            unit_amount: amountPence,
          },
          quantity: 1,
        }],
        success_url: `${portalBase}/quote/${token}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${portalBase}/quote/${token}?paid=cancelled`,
        // Pre-fill the customer's email if we have it on the invoice — Stripe
        // uses this for the receipt email it sends after successful payment.
        ...(inv.email ? { customer_email: inv.email } : {}),
        metadata: {
          invoice_id: inv.id,
          portal_token: token,
          user_id: inv.user_id,
        },
        // Stripe sends an emailed receipt by default for one-off Checkout
        // sessions when an email is present (handled by the connected account's
        // customer_email setting). No extra config needed.
      },
      { stripeAccount: stripeAccountId }
    );

    return redirectBack(res, session.url);
  } catch (err) {
    console.error("[connect-checkout] error:", err.message);
    return res.status(500).send(`Couldn't start payment: ${(err.message || "").slice(0, 120)}`);
  }
}

export default withSentry(handler, { routeName: "stripe/connect-checkout" });
