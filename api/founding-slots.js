// api/founding-slots.js
// Returns the number of Founding Member slots remaining (out of 100).
// Public endpoint — called from pricing.html and index.html.
// Cached at the edge for 60 seconds to avoid hammering Postgres while still
// refreshing fast enough that a slot disappearing shows up on the page quickly.
//
// Counts only 'active' | 'trialing' | 'past_due' founding subscriptions —
// a cancelled founding member frees their slot back to the pool.

import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const FOUNDING_TOTAL = 100;

export default async function handler(req, res) {
  // CORS — this is a public endpoint, allow from anywhere
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  try {
    const { count, error } = await supabaseAdmin
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("is_founding_member", true)
      .in("status", ["active", "trialing", "past_due"]);

    if (error) {
      console.error("[founding-slots] query failed:", error);
      // Fail safe — show the total as if none are claimed yet, never block signup
      res.setHeader("Cache-Control", "public, max-age=10");
      return res.status(200).json({
        total: FOUNDING_TOTAL,
        claimed: 0,
        remaining: FOUNDING_TOTAL,
        available: true,
        fallback: true,
      });
    }

    const claimed = count || 0;
    const remaining = Math.max(0, FOUNDING_TOTAL - claimed);

    // Edge-cache for 60s, allow stale-while-revalidate for 30s more.
    // This means a spot disappearing shows up within ~60s on the page,
    // and Postgres sees at most 1 query/minute regardless of traffic.
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=30");

    return res.status(200).json({
      total: FOUNDING_TOTAL,
      claimed,
      remaining,
      available: remaining > 0,
    });
  } catch (err) {
    console.error("[founding-slots] error:", err);
    // Same fail-safe — never block the page render because of a DB blip
    res.setHeader("Cache-Control", "public, max-age=10");
    return res.status(200).json({
      total: FOUNDING_TOTAL,
      claimed: 0,
      remaining: FOUNDING_TOTAL,
      available: true,
      fallback: true,
    });
  }
}
