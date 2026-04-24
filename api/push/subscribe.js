// api/push/subscribe.js
// Saves or removes a push subscription for a user

import { withSentry } from "../lib/sentry.js";

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { userId, subscription, action } = req.body;
  if (!userId || !subscription) return res.status(400).json({ error: "userId and subscription required" });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const headers = {
    "apikey": supabaseKey,
    "Authorization": `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
  };

  try {
    if (action === "unsubscribe") {
      await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?user_id=eq.${userId}&endpoint=eq.${encodeURIComponent(subscription.endpoint)}`, {
        method: "DELETE",
        headers,
      });
      return res.json({ success: true });
    }

    // Upsert subscription
    await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?on_conflict=user_id,endpoint`, {
      method: "POST",
      headers: { ...headers, "Prefer": "resolution=merge-duplicates" },
      body: JSON.stringify({
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys?.p256dh || "",
        auth: subscription.keys?.auth || "",
        updated_at: new Date().toISOString(),
      }),
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("Push subscribe error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}

export default withSentry(handler, { routeName: "push/subscribe" });
