// api/cron/pending-actions-digest.js
// End-of-day summary: pushes each user a count of AI actions still awaiting
// approval. Email and call actions both live in email_actions with
// status = "pending", so this is a single count per user. Only users who
// actually have pending actions are notified.
import { withSentry } from "../lib/sentry.js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function handler(req, res) {
  // Vercel cron jobs call with the CRON_SECRET bearer; reject anything else.
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorised" });
  }

  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/email_actions?status=eq.pending&select=user_id`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const rows = await r.json();
    if (!Array.isArray(rows)) {
      console.error("pending-actions-digest: unexpected response", rows);
      return res.status(500).json({ error: "Failed to load pending actions" });
    }

    const counts = {};
    for (const row of rows) {
      if (!row || !row.user_id) continue;
      counts[row.user_id] = (counts[row.user_id] || 0) + 1;
    }

    const userIds = Object.keys(counts);
    let sent = 0;

    await Promise.all(userIds.map(async (userId) => {
      const n = counts[userId];
      const noun = n === 1 ? "action" : "actions";
      try {
        await fetch(`${process.env.APP_URL}/api/push/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            title: `🔔 ${n} ${noun} waiting for approval`,
            body: `You have ${n} AI ${noun} to review in Trade PA.`,
            url: "/",
            type: "ai_action_digest",
            tag: "actions-digest",
          }),
        });
        sent++;
      } catch (e) {
        console.error(`pending-actions-digest: push failed for ${userId}:`, e.message);
      }
    }));

    console.log(`pending-actions-digest: ${userIds.length} users, ${sent} sent`);
    return res.status(200).json({ users: userIds.length, sent });
  } catch (err) {
    console.error("pending-actions-digest error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}

export default withSentry(handler, { routeName: "cron/pending-actions-digest" });
