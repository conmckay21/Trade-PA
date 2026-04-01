// api/push/send.js
import webpush from "web-push";

webpush.setVapidDetails(
  "mailto:hello@tradespa.co.uk",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { userId, title, body, url, type, tag } = req.body;
  if (!userId || !title) return res.status(400).json({ error: "userId and title required" });

  try {
    const subRes = await fetch(
      `${process.env.VITE_SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${userId}&select=*`,
      { headers: { "apikey": process.env.SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}` } }
    );
    const subscriptions = await subRes.json();
    if (!subscriptions?.length) return res.json({ success: true, sent: 0 });

    const payload = JSON.stringify({ title, body: body || "", url: url || "/", type: type || "general", tag: tag || "trade-pa" });
    let sent = 0;
    const staleEndpoints = [];

    await Promise.all(subscriptions.map(async sub => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
        sent++;
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) staleEndpoints.push(sub.endpoint);
        else console.error("Push error:", err.message);
      }
    }));

    if (staleEndpoints.length > 0) {
      await Promise.all(staleEndpoints.map(ep =>
        fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${userId}&endpoint=eq.${encodeURIComponent(ep)}`, {
          method: "DELETE",
          headers: { "apikey": process.env.SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}` },
        })
      ));
    }
    return res.json({ success: true, sent });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
