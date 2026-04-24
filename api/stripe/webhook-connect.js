// api/stripe/webhook-connect.js
// Stripe webhook receiver for events on CONNECTED accounts (Stripe Connect
// Standard). Separate from api/stripe/webhook.js which handles platform-level
// subscription events. They use different Stripe dashboard endpoints and
// different signing secrets — Stripe best practice.
//
// Setup steps (one-off):
//   1. Stripe dashboard → Webhooks → Add endpoint
//      • URL: https://www.tradespa.co.uk/api/stripe/webhook-connect
//      • Listen to: events on Connected accounts (toggle this on)
//      • Events to send: checkout.session.completed (others optional)
//   2. Copy the Signing secret from the new endpoint
//   3. Add to Vercel env as STRIPE_CONNECT_WEBHOOK_SECRET
//
// Events handled:
//   - checkout.session.completed → mark invoice paid, push notify tradesperson
//
// bodyParser disabled so we get the raw bytes Stripe needs to verify the sig.

import Stripe from "stripe";
import { withSentry } from "../lib/sentry.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const CONNECT_WEBHOOK_SECRET = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

async function supabaseFetch(path, options = {}) {
  return fetch(`${process.env.VITE_SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
}

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function getInvoice(invoiceId, userId) {
  const r = await supabaseFetch(
    `/rest/v1/invoices?id=eq.${encodeURIComponent(invoiceId)}&user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
    { method: "GET" }
  );
  const rows = await r.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function markInvoicePaid(invoiceId, userId) {
  const nowISO = new Date().toISOString();
  return supabaseFetch(
    `/rest/v1/invoices?id=eq.${encodeURIComponent(invoiceId)}&user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status: "paid",
        updated_at: nowISO,
        // We don't store paid_at on this table per current schema.
        // If a paid_at column gets added later, set it here.
      }),
    }
  );
}

async function sendPushToUser(req, userId, title, body, tag) {
  try {
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const proto = req.headers["x-forwarded-proto"] || "https";
    await fetch(`${proto}://${host}/api/push/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, title, body, tag }),
    });
  } catch (e) {
    console.error("[webhook-connect] push failed:", e.message);
  }
}

const fmtGBP = (pence) => `£${(pence / 100).toFixed(2)}`;

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }

  if (!CONNECT_WEBHOOK_SECRET) {
    console.error("[webhook-connect] STRIPE_CONNECT_WEBHOOK_SECRET missing");
    return res.status(500).send("Not configured.");
  }

  const sig = req.headers["stripe-signature"];
  if (!sig) return res.status(400).send("Missing signature.");

  let event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, CONNECT_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[webhook-connect] signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`[webhook-connect] ${event.type} (${event.id}) on account ${event.account || "none"}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        // Only act on PAID sessions (not async pending etc.)
        if (session.payment_status !== "paid") {
          console.log(`[webhook-connect] session ${session.id} not paid yet (${session.payment_status}), skipping`);
          break;
        }

        const invoiceId = session.metadata?.invoice_id;
        const userId = session.metadata?.user_id;
        if (!invoiceId || !userId) {
          console.warn(`[webhook-connect] session ${session.id} missing metadata`);
          break;
        }

        const inv = await getInvoice(invoiceId, userId);
        if (!inv) {
          console.warn(`[webhook-connect] invoice ${invoiceId} not found for user ${userId}`);
          break;
        }

        // Idempotent — if already paid, just notify and skip the update
        if (inv.status === "paid") {
          console.log(`[webhook-connect] invoice ${invoiceId} already paid, skipping update`);
          break;
        }

        await markInvoicePaid(invoiceId, userId);

        const title = "Payment received ✓";
        const body = `${inv.customer || "Customer"} paid ${invoiceId} — ${fmtGBP(session.amount_total)}`;
        await sendPushToUser(req, userId, title, body, `payment-${invoiceId}`);
        break;
      }

      default:
        console.log(`[webhook-connect] unhandled event: ${event.type}`);
    }
  } catch (err) {
    console.error(`[webhook-connect] handler error for ${event.type}:`, err);
    return res.status(500).send("Handler error.");
  }

  return res.status(200).json({ received: true });
}

// Required for stripe.webhooks.constructEvent to work with raw bytes
export const config = { api: { bodyParser: false } };

export default withSentry(handler, { routeName: "stripe/webhook-connect" });
