import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Helper to update subscription status in Supabase
async function updateSubscriptionStatus(stripeSubscriptionId, status, periodEnd = null) {
  const updates = { status };
  if (periodEnd) updates.current_period_end = periodEnd;

  await fetch(
    `${process.env.VITE_SUPABASE_URL}/rest/v1/subscriptions?stripe_subscription_id=eq.${stripeSubscriptionId}`,
    {
      method: "PATCH",
      headers: {
        "apikey": process.env.SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    }
  );
}

// Helper to get user email from Supabase by subscription ID
async function getUserEmailBySubscription(stripeSubscriptionId) {
  const res = await fetch(
    `${process.env.VITE_SUPABASE_URL}/rest/v1/subscriptions?stripe_subscription_id=eq.${stripeSubscriptionId}&select=user_id`,
    {
      headers: {
        "apikey": process.env.SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      },
    }
  );
  const data = await res.json();
  return data?.[0]?.user_id;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    // Verify webhook signature
    const rawBody = await new Promise((resolve, reject) => {
      let data = "";
      req.on("data", chunk => data += chunk);
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  console.log(`Stripe webhook: ${event.type}`);

  switch (event.type) {

    // ── Payment succeeded — restore/confirm access ──
    case "invoice.payment_succeeded": {
      const invoice = event.data.object;
      const subscriptionId = invoice.subscription;
      if (subscriptionId) {
        await updateSubscriptionStatus(subscriptionId, "active",
          invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null
        );
        console.log(`✓ Access confirmed for subscription ${subscriptionId}`);
      }
      break;
    }

    // ── Payment failed — warn but don't immediately revoke (Stripe retries) ──
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const subscriptionId = invoice.subscription;
      if (subscriptionId) {
        await updateSubscriptionStatus(subscriptionId, "past_due");
        console.log(`⚠ Payment failed for subscription ${subscriptionId} — marked past_due`);
        // Could send a warning email here
      }
      break;
    }

    // ── Subscription cancelled or deleted — revoke access ──
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      await updateSubscriptionStatus(subscription.id, "cancelled");
      console.log(`✗ Access revoked for subscription ${subscription.id}`);
      break;
    }

    // ── Subscription updated (e.g. plan change, renewal) ──
    case "customer.subscription.updated": {
      const subscription = event.data.object;
      await updateSubscriptionStatus(
        subscription.id,
        subscription.status,
        new Date(subscription.current_period_end * 1000).toISOString()
      );
      break;
    }

    // ── Trial ended ──
    case "customer.subscription.trial_will_end": {
      // Could send a reminder email here
      console.log("Trial ending soon:", event.data.object.id);
      break;
    }

    default:
      console.log(`Unhandled event: ${event.type}`);
  }

  return res.json({ received: true });
}

// Disable body parsing for webhook (needs raw body for signature verification)
export const config = {
  api: { bodyParser: false },
};
