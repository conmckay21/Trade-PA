// api/push/send.js
// Sends a push notification to all of a user's registered devices.
// Routes Web Push subscriptions through web-push, FCM tokens through firebase-admin.
// Stale endpoints/tokens are removed automatically.

import webpush from "web-push";
import { withSentry } from "../lib/sentry.js";
import { sendFcm } from "../lib/fcm.js";
import { sendApns } from "../lib/apns.js";

webpush.setVapidDetails(
  "mailto:hello@tradespa.co.uk",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function deleteRow({ userId, type, endpoint, fcmToken }) {
  const filter =
    type === "web"
      ? `endpoint=eq.${encodeURIComponent(endpoint)}`
      : `fcm_token=eq.${encodeURIComponent(fcmToken)}`;
  await fetch(
    `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${userId}&type=eq.${type}&${filter}`,
    {
      method: "DELETE",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    }
  );
}

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { userId, title, body, url, type, tag } = req.body;
  if (!userId || !title) return res.status(400).json({ error: "userId and title required" });

  const payload = { title, body: body || "", url: url || "/", type: type || "general", tag: tag || "trade-pa" };

  try {
    const subRes = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${userId}&select=*`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const subscriptions = await subRes.json();
    if (!subscriptions?.length) return res.json({ success: true, sent: 0, web: 0, fcm: 0 });

    let webSent = 0;
    let fcmSent = 0;
    let apnsSent = 0;
    const stale = []; // { type, endpoint?, fcmToken? }
    const errors = [];

    await Promise.all(
      subscriptions.map(async (sub) => {
        // Default to 'web' for legacy rows that pre-date the type column
        const subType = sub.type || "web";

        if (subType === "web") {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              JSON.stringify(payload)
            );
            webSent++;
          } catch (err) {
            if (err.statusCode === 410 || err.statusCode === 404) {
              stale.push({ type: "web", endpoint: sub.endpoint });
            } else {
              errors.push(`web: ${err.message}`);
              console.error("Web push error:", err.message);
            }
          }
        } else if (subType === "fcm") {
          const result = await sendFcm(sub.fcm_token, payload);
          if (result.success) {
            fcmSent++;
          } else if (result.stale) {
            stale.push({ type: "fcm", fcmToken: sub.fcm_token });
          } else {
            errors.push(`fcm: ${result.error}`);
            console.error("FCM push error:", result.error, result.code || "");
          }
        } else if (subType === "apns") {
          const result = await sendApns(sub.fcm_token, payload);
          if (result.success) {
            apnsSent++;
          } else if (result.stale) {
            stale.push({ type: "apns", fcmToken: sub.fcm_token });
          } else {
            errors.push(`apns: ${result.error}`);
            console.error("APNs push error:", result.error, result.code || "");
          }
        }
      })
    );

    // Clean up stale endpoints/tokens
    if (stale.length) {
      await Promise.all(stale.map((s) => deleteRow({ userId, ...s }).catch(() => {})));
    }

    return res.json({
      success: true,
      sent: webSent + fcmSent + apnsSent,
      web: webSent,
      fcm: fcmSent,
      apns: apnsSent,
      stale: stale.length,
      errors: errors.length ? errors : undefined,
    });
  } catch (err) {
    console.error("Push send error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}

export default withSentry(handler, { routeName: "push/send" });
