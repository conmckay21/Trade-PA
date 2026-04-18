// api/stripe/webhook.js
// Handles Stripe webhooks for main subscriptions, phone subscriptions, and add-on payments.

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function supabaseFetch(path, options = {}) {
  return fetch(`${process.env.VITE_SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      "apikey": process.env.SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
}

async function patchSubscription(stripeSubscriptionId, updates) {
  return supabaseFetch(
    `/rest/v1/subscriptions?stripe_subscription_id=eq.${stripeSubscriptionId}`,
    { method: "PATCH", body: JSON.stringify(updates) }
  );
}

async function getSubscriptionRow(stripeSubscriptionId) {
  const res = await supabaseFetch(
    `/rest/v1/subscriptions?stripe_subscription_id=eq.${stripeSubscriptionId}&select=*`,
    { method: "GET" }
  );
  const data = await res.json();
  return Array.isArray(data) ? data[0] : null;
}

function isPhoneSubscription(subscription) {
  return subscription.metadata?.type === "phone_subscription";
}

async function releaseTwilioNumber(numberSid) {
  if (!numberSid) return;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers/${numberSid}.json`,
      { method: "DELETE", headers: { Authorization: authHeader } }
    );
    if (!res.ok && res.status !== 404) {
      console.error(`[webhook] Twilio release returned ${res.status} for ${numberSid}`);
    }
  } catch (err) {
    console.error(`[webhook] Failed to release Twilio number ${numberSid}:`, err.message);
  }
}

async function handlePhoneInvoiceSucceeded(subscription) {
  await supabaseFetch("/rest/v1/rpc/reset_phone_minutes", {
    method: "POST",
    body: JSON.stringify({ p_stripe_subscription_id: subscription.id }),
  });
  console.log(`[webhook] ✓ phone sub ${subscription.id} — minutes reset`);
}

async function handlePhoneSubscriptionDeleted(subscription) {
  const metaSid = subscription.metadata?.twilio_number_sid;
  const ctRes = await supabaseFetch(
    `/rest/v1/call_tracking?stripe_subscription_id=eq.${subscription.id}&select=twilio_number_sid,user_id`,
    { method: "GET" }
  );
  const ctRows = await ctRes.json();
  const ctRow = Array.isArray(ctRows) ? ctRows[0] : null;
  const sidToRelease = ctRow?.twilio_number_sid || metaSid;

  if (sidToRelease) {
    await releaseTwilioNumber(sidToRelease);
    console.log(`[webhook] ✓ Released Twilio number ${sidToRelease}`);
  }

  await supabaseFetch(
    `/rest/v1/call_tracking?stripe_subscription_id=eq.${subscription.id}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        active: false,
        stripe_subscription_id: null,
        phone_plan: null,
        monthly_minute_quota: null,
        hard_cap_minutes: null,
        twilio_number: null,
        twilio_number_sid: null,
        forwarding_code: null,
        disable_code: null,
      }),
    }
  );
  console.log(`[webhook] ✗ phone sub ${subscription.id} deactivated`);
}

async function handlePhoneSubscriptionUpdated(subscription) {
  const newPriceId = subscription.items?.data?.[0]?.price?.id;
  const ctRes = await supabaseFetch(
    `/rest/v1/call_tracking?stripe_subscription_id=eq.${subscription.id}&select=stripe_price_id`,
    { method: "GET" }
  );
  const ctRows = await ctRes.json();
  const ctRow = Array.isArray(ctRows) ? ctRows[0] : null;
  if (!ctRow) {
    console.warn(`[webhook] phone sub ${subscription.id} updated but no call_tracking row found`);
    return;
  }
  if (ctRow.stripe_price_id === newPriceId) {
    console.log(`[webhook] phone sub ${subscription.id} updated (no price change)`);
    return;
  }
  const priceToPlan = {
    [process.env.STRIPE_PRICE_PHONE_100]:       { phone_plan: "phone_100",       quota: 100,  hard_cap: 120 },
    [process.env.STRIPE_PRICE_PHONE_300]:       { phone_plan: "phone_300",       quota: 300,  hard_cap: 360 },
    [process.env.STRIPE_PRICE_PHONE_600]:       { phone_plan: "phone_600",       quota: 600,  hard_cap: 720 },
    [process.env.STRIPE_PRICE_PHONE_UNLIMITED]: { phone_plan: "phone_unlimited", quota: 3000, hard_cap: 3000 },
  };
  const newPlan = priceToPlan[newPriceId];
  if (!newPlan) {
    console.error(`[webhook] phone sub ${subscription.id} changed to unknown price ${newPriceId}`);
    return;
  }
  await supabaseFetch(
    `/rest/v1/call_tracking?stripe_subscription_id=eq.${subscription.id}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        phone_plan: newPlan.phone_plan,
        monthly_minute_quota: newPlan.quota,
        hard_cap_minutes: newPlan.hard_cap,
        stripe_price_id: newPriceId,
      }),
    }
  );
  console.log(`[webhook] ✓ phone sub ${subscription.id} tier → ${newPlan.phone_plan}`);
}

function deriveTrialState(subscription) {
  const isInTrial = subscription.status === "trialing";
  const trialEndsAt = subscription.trial_end
    ? new Date(subscription.trial_end * 1000).toISOString()
    : null;
  return { isInTrial, trialEndsAt };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const sig = req.headers["stripe-signature"];
  let event;
  try {
    const rawBody = await new Promise((resolve, reject) => {
      let data = "";
      req.on("data", chunk => data += chunk);
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[webhook] signature failed:", err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  console.log(`[webhook] ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;
        if (!subscriptionId) break;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        if (isPhoneSubscription(subscription)) {
          await handlePhoneInvoiceSucceeded(subscription);
        } else {
          const { isInTrial, trialEndsAt } = deriveTrialState(subscription);
          await patchSubscription(subscriptionId, {
            status: subscription.status,
            current_period_end: subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000).toISOString() : null,
            is_in_trial: isInTrial,
            trial_ends_at: trialEndsAt,
          });
          console.log(`[webhook] ✓ main sub ${subscriptionId} status=${subscription.status}`);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;
        if (!subscriptionId) break;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        if (isPhoneSubscription(subscription)) {
          console.log(`[webhook] ⚠ phone sub ${subscriptionId} past_due`);
        } else {
          await patchSubscription(subscriptionId, { status: "past_due" });
          console.log(`[webhook] ⚠ main sub ${subscriptionId} marked past_due`);
        }
        break;
      }

      case "customer.subscription.created": {
        const subscription = event.data.object;
        if (isPhoneSubscription(subscription)) {
          const ctRes = await supabaseFetch(
            `/rest/v1/call_tracking?stripe_subscription_id=eq.${subscription.id}&select=id`,
            { method: "GET" }
          );
          const ctRows = await ctRes.json();
          if (!Array.isArray(ctRows) || ctRows.length === 0) {
            console.error(`[webhook] phone sub ${subscription.id} created but call_tracking row missing`);
          }
          break;
        }
        const existing = await getSubscriptionRow(subscription.id);
        if (existing) break;
        const { isInTrial, trialEndsAt } = deriveTrialState(subscription);
        const userId = subscription.metadata?.supabase_user_id;
        if (!userId) {
          console.warn(`[webhook] main sub.created without supabase_user_id: ${subscription.id}`);
          break;
        }
        await supabaseFetch("/rest/v1/subscriptions", {
          method: "POST",
          body: JSON.stringify({
            user_id: userId,
            stripe_customer_id: subscription.customer,
            stripe_subscription_id: subscription.id,
            stripe_price_id: subscription.items?.data?.[0]?.price?.id,
            plan: subscription.metadata?.plan_code || "solo",
            status: subscription.status,
            current_period_end: subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000).toISOString() : null,
            is_in_trial: isInTrial,
            trial_ends_at: trialEndsAt,
            trial_started_at: new Date().toISOString(),
            is_founding_member: subscription.metadata?.is_founding_member === "true",
            founding_member_slot_number: subscription.metadata?.founding_slot_number
              ? parseInt(subscription.metadata.founding_slot_number) : null,
          }),
        });
        console.log(`[webhook] ✓ main sub ${subscription.id} backfilled`);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        if (isPhoneSubscription(subscription)) {
          await handlePhoneSubscriptionUpdated(subscription);
        } else {
          const { isInTrial, trialEndsAt } = deriveTrialState(subscription);
          await patchSubscription(subscription.id, {
            status: subscription.status,
            current_period_end: subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000).toISOString() : null,
            is_in_trial: isInTrial,
            trial_ends_at: trialEndsAt,
          });
          console.log(`[webhook] ✓ main sub ${subscription.id} updated status=${subscription.status} trial=${isInTrial}`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        if (isPhoneSubscription(subscription)) {
          await handlePhoneSubscriptionDeleted(subscription);
        } else {
          await patchSubscription(subscription.id, {
            status: "cancelled",
            is_in_trial: false,
          });
          console.log(`[webhook] ✗ main sub ${subscription.id} cancelled`);
        }
        break;
      }

      case "customer.subscription.trial_will_end": {
        console.log(`[webhook] ⏰ trial ending soon — sub ${event.data.object.id}`);
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        if (paymentIntent.metadata?.type !== "addon") break;
        const updateRes = await supabaseFetch(
          `/rest/v1/addon_purchases?stripe_payment_intent_id=eq.${paymentIntent.id}&status=eq.pending`,
          {
            method: "PATCH",
            headers: { "Prefer": "return=representation" },
            body: JSON.stringify({ status: "active", activated_at: new Date().toISOString() }),
          }
        );
        if (updateRes.ok) {
          const updated = await updateRes.json();
          console.log(`[webhook] ${Array.isArray(updated) && updated.length > 0 ? '✓ add-on activated' : 'add-on — no pending row (idempotent replay)'} — PI ${paymentIntent.id}`);
        } else {
          console.error(`[webhook] Failed to activate add-on:`, await updateRes.text());
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        if (paymentIntent.metadata?.type !== "addon") break;
        await supabaseFetch(
          `/rest/v1/addon_purchases?stripe_payment_intent_id=eq.${paymentIntent.id}&status=eq.pending`,
          { method: "PATCH", body: JSON.stringify({ status: "failed" }) }
        );
        console.log(`[webhook] ✗ add-on PI ${paymentIntent.id} failed`);
        break;
      }

      default:
        console.log(`[webhook] unhandled event: ${event.type}`);
    }
    return res.json({ received: true });
  } catch (err) {
    console.error(`[webhook] handler error for ${event.type}:`, err);
    return res.status(500).json({ error: err.message });
  }
}

export const config = { api: { bodyParser: false } };
