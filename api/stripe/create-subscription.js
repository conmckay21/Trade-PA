import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { email, name, password, paymentMethodId, priceId, userId } = req.body;
  if (!email || !paymentMethodId || !priceId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // 1. Create Supabase user account (if not already created)
    let supabaseUserId = userId;
    if (!supabaseUserId) {
      const signupRes = await fetch(
        `${process.env.VITE_SUPABASE_URL}/auth/v1/signup`,
        {
          method: "POST",
          headers: {
            "apikey": process.env.VITE_SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        }
      );
      const signupData = await signupRes.json();
      if (signupData.error) throw new Error(signupData.error.message || signupData.error);
      supabaseUserId = signupData.user?.id;
      if (!supabaseUserId) throw new Error("Failed to create account");
    }

    // 2. Create Stripe customer
    const customer = await stripe.customers.create({
      email,
      name,
      payment_method: paymentMethodId,
      invoice_settings: { default_payment_method: paymentMethodId },
      metadata: { supabase_user_id: supabaseUserId },
    });

    // 3. Create subscription (charges immediately)
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      payment_settings: {
        payment_method_types: ["card"],
        save_default_payment_method: "on_subscription",
      },
      expand: ["latest_invoice.payment_intent"],
      metadata: { supabase_user_id: supabaseUserId },
    });

    const invoice = subscription.latest_invoice;
    const paymentIntent = invoice?.payment_intent;

    // 4. Save subscription info to Supabase
    await fetch(
      `${process.env.VITE_SUPABASE_URL}/rest/v1/subscriptions`,
      {
        method: "POST",
        headers: {
          "apikey": process.env.SUPABASE_SERVICE_KEY,
          "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: supabaseUserId,
          stripe_customer_id: customer.id,
          stripe_subscription_id: subscription.id,
          stripe_price_id: priceId,
          status: subscription.status,
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        }),
      }
    );

    // 5. Return result
    if (paymentIntent?.status === "requires_action") {
      // 3D Secure required
      return res.json({
        requiresAction: true,
        clientSecret: paymentIntent.client_secret,
        subscriptionId: subscription.id,
        userId: supabaseUserId,
      });
    }

    if (subscription.status === "active") {
      return res.json({
        success: true,
        subscriptionId: subscription.id,
        userId: supabaseUserId,
      });
    }

    throw new Error(`Payment failed: ${invoice?.payment_intent?.last_payment_error?.message || "Unknown error"}`);

  } catch (err) {
    console.error("Subscription error:", err.message);
    return res.status(400).json({ error: err.message });
  }
}
