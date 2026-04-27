// api/lib/auth.js
//
// Shared JWT verification for Vercel serverless routes. Extracted from
// the inline pattern that previously lived in claude.js. Now used by:
//   - claude.js
//   - calls/token.js
//   - pdf.js
//   - error-report.js
//   - feedback.js
//   - distance.js
//   - any future authenticated route
//
// Usage:
//   import { requireAuth } from "./lib/auth.js";
//   async function handler(req, res) {
//     const userId = await requireAuth(req, res);
//     if (!userId) return; // requireAuth has already sent 401
//     // ... your logic ...
//   }
//
// requireAuth():
//   - Verifies Authorization: Bearer <jwt> header against Supabase auth
//   - Returns the verified userId on success
//   - Sends a 401 response and returns null on failure (caller just bails)
//
// getUserIdFromRequest():
//   - Lower-level: returns userId or null without sending a response
//   - Use when you want to log unauthenticated access without rejecting
//   - Or when the route allows both authenticated and anonymous callers

import { createClient } from "@supabase/supabase-js";

// Service-role client used solely to verify user-supplied JWTs.
// We don't use this client to read data — RLS-bypass is dangerous and
// every concrete read should use the user's own scoped client.
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export async function getUserIdFromRequest(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

export async function requireAuth(req, res) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  return userId;
}

// In-memory rate limiter for non-DB-backed throttling (small-scale or when
// rate_limit_counters table is overkill). Keyed by `${userId}:${bucket}`.
//
// Limitation: per-instance only. On Vercel, each warm function instance has
// its own memory. So a per-user limit of 5/hour means up to 5/hour PER warm
// instance — typically 1-3 instances at low traffic, more at high traffic.
// Acceptable for spam-mitigation use cases (feedback, error-report). Not
// acceptable for billing-relevant counters — those use the DB-backed
// rate_limit_counters table.
const rateBuckets = new Map();

export function checkInMemoryRateLimit(userId, bucket, opts = {}) {
  const { maxRequests = 10, windowMs = 60_000 } = opts;
  const key = `${userId}:${bucket}`;
  const now = Date.now();
  const entry = rateBuckets.get(key) || { resetAt: now + windowMs, count: 0 };
  if (now > entry.resetAt) {
    entry.resetAt = now + windowMs;
    entry.count = 0;
  }
  entry.count += 1;
  rateBuckets.set(key, entry);
  // Lazy garbage collection — every ~100 inserts, sweep expired entries.
  if (rateBuckets.size > 1000 && Math.random() < 0.01) {
    for (const [k, v] of rateBuckets.entries()) {
      if (v.resetAt < now) rateBuckets.delete(k);
    }
  }
  return {
    allowed: entry.count <= maxRequests,
    remaining: Math.max(0, maxRequests - entry.count),
    resetAt: entry.resetAt,
  };
}
