// api/push/subscribe.js
// Saves or removes a push subscription for a user.
// Supports both Web Push (browser/PWA) and FCM (native Android via Capacitor).
//
// Request body shapes:
//
//   Web Push subscribe:
//     { userId, type: 'web', subscription: { endpoint, keys: { p256dh, auth } } }
//
//   FCM subscribe:
//     { userId, type: 'fcm', fcmToken: '...' }
//
//   Unsubscribe (either type):
//     { userId, type, subscription?, fcmToken?, action: 'unsubscribe' }
//
// For backwards compatibility, requests without a `type` field are treated
// as Web Push (existing PWA installs keep working without code changes).

import { withSentry } from "../lib/sentry.js";

async function handler(req, res) {
  // CORS headers — required for the native Capacitor iOS/Android apps which
  // make cross-origin requests from capacitor://localhost or https://localhost.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept");
  res.setHeader("Access-Control-Max-Age", "86400");

  // Handle CORS preflight. Native apps send OPTIONS first before any JSON POST;
  // this must respond 204 before the browser will issue the real request.
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { userId, subscription, fcmToken, action } = req.body || {};
  const type = req.body?.type || "web"; // default to 'web' for legacy callers

  if (!userId) return res.status(400).json({ error: "userId required" });

  if (type === "web" && !subscription) {
    return res.status(400).json({ error: "subscription required for web type" });
  }
  if (type === "fcm" && !fcmToken) {
    return res.status(400).json({ error: "fcmToken required for fcm type" });
  }
  if (type !== "web" && type !== "fcm") {
    return res.status(400).json({ error: "type must be 'web' or 'fcm'" });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
  };

  try {
    // ── Unsubscribe ──────────────────────────────────────────────
    if (action === "unsubscribe") {
      if (type === "web") {
        await fetch(
          `${supabaseUrl}/rest/v1/push_subscriptions?user_id=eq.${userId}&type=eq.web&endpoint=eq.${encodeURIComponent(subscription.endpoint)}`,
          { method: "DELETE", headers }
        );
      } else {
        await fetch(
          `${supabaseUrl}/rest/v1/push_subscriptions?user_id=eq.${userId}&type=eq.fcm&fcm_token=eq.${encodeURIComponent(fcmToken)}`,
          { method: "DELETE", headers }
        );
      }
      return res.json({ success: true });
    }

    // ── Subscribe / Upsert ───────────────────────────────────────
    let body;
    let conflictTarget;
    if (type === "web") {
      body = {
        user_id: userId,
        type: "web",
        endpoint: subscription.endpoint,
        p256dh: subscription.keys?.p256dh || "",
        auth: subscription.keys?.auth || "",
        fcm_token: null,
        updated_at: new Date().toISOString(),
      };
      conflictTarget = "user_id,endpoint";
    } else {
      body = {
        user_id: userId,
        type: "fcm",
        endpoint: null,
        p256dh: null,
        auth: null,
        fcm_token: fcmToken,
        updated_at: new Date().toISOString(),
      };
      conflictTarget = "user_id,fcm_token";
    }

    const r = await fetch(
      `${supabaseUrl}/rest/v1/push_subscriptions?on_conflict=${conflictTarget}`,
      {
        method: "POST",
        headers: { ...headers, Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify(body),
      }
    );

    if (!r.ok) {
      const errBody = await r.text();
      console.error("Push subscribe upsert failed:", r.status, errBody);
      return res.status(500).json({ error: "Failed to save subscription" });
    }

    return res.json({ success: true, type });
  } catch (err) {
    console.error("Push subscribe error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}

export default withSentry(handler, { routeName: "push/subscribe" });
