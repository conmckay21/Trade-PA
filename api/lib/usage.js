// /api/lib/usage.js
// Trade PA — usage enforcement + rate limiting helper.
// Call these from every API route that does billable work (Claude, Deepgram, OpenAI).
//
// Dependencies: @supabase/supabase-js (already in project).
// Env vars required: VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY (falls back to SUPABASE_SERVICE_ROLE_KEY).

import { createClient } from '@supabase/supabase-js';

// Singleton admin client (module-scope = persists across warm invocations).
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------
export class UsageError extends Error {
  constructor(code, statusCode, details = {}) {
    super(details.message || code);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

// ---------------------------------------------------------------------------
// Low-level primitives — direct wrappers around the Postgres RPC functions
// ---------------------------------------------------------------------------

/**
 * Check rate limit for a metric. Atomically increments the counter if allowed.
 * @param {string} userId
 * @param {'conversations'|'handsfree_starts'|'api_calls'} rateLimitMetric
 * @returns {Promise<object>} { allowed: bool, minute_count?, hour_count?, day_count?, reason?, retry_after_seconds? }
 */
export async function checkRateLimit(userId, rateLimitMetric) {
  const { data, error } = await supabaseAdmin.rpc('check_rate_limit', {
    user_uuid: userId,
    metric_name: rateLimitMetric
  });
  if (error) {
    throw new UsageError('rate_limit_check_failed', 500, { message: error.message });
  }
  return data;
}

/**
 * Check monthly allowance for a metric. Does NOT increment — read-only.
 * @param {string} userId
 * @param {'conversations'|'handsfree_seconds'} metric
 * @returns {Promise<object>} { allowed, remaining, limit, used, addon_remaining, plan_code, unlimited }
 */
export async function checkAllowance(userId, metric) {
  const { data, error } = await supabaseAdmin.rpc('check_usage_allowance', {
    user_uuid: userId,
    metric_name: metric
  });
  if (error) {
    throw new UsageError('allowance_check_failed', 500, { message: error.message });
  }
  return data;
}

/**
 * Increment usage counter after a successful billable operation.
 * Call AFTER the Claude/Deepgram/OpenAI call returns successfully.
 * Failures are logged but not thrown — usage tracking should never fail a request.
 * @param {string} userId
 * @param {'conversations'|'handsfree_seconds'} metric
 * @param {number} amount — defaults to 1 for conversations, should be seconds count for handsfree
 */
export async function recordUsage(userId, metric, amount = 1) {
  if (!userId || amount <= 0) return null;
  const { data, error } = await supabaseAdmin.rpc('increment_usage', {
    user_uuid: userId,
    metric_name: metric,
    increment_by: amount
  });
  if (error) {
    console.error('[usage] recordUsage failed:', error.message, { userId, metric, amount });
    return null;
  }
  return data;
}

// ---------------------------------------------------------------------------
// High-level convenience functions
// ---------------------------------------------------------------------------

/**
 * All-in-one enforcement for conversation-style routes.
 * Runs rate limit check + allowance check. Throws UsageError on failure.
 * Call this at the top of every Claude/Deepgram/OpenAI route.
 * @param {string} userId
 * @returns {Promise<object>} allowance info (plan, remaining, etc.)
 */
export async function enforceConversation(userId) {
  if (!userId) {
    throw new UsageError('missing_user', 401, { message: 'User not authenticated' });
  }

  // 1. Rate limit first (also increments the rate counters).
  const rate = await checkRateLimit(userId, 'conversations');
  if (!rate.allowed) {
    const statusCode = rate.reason === 'account_locked' ? 403
                     : rate.reason === 'no_subscription' ? 402
                     : 429;
    throw new UsageError(rate.reason, statusCode, rate);
  }

  // 2. Allowance (monthly quota).
  const allow = await checkAllowance(userId, 'conversations');
  if (!allow.allowed) {
    const statusCode = allow.error === 'account_locked' ? 403
                     : allow.error === 'no_subscription' ? 402
                     : 402; // limit_reached
    throw new UsageError(allow.error || 'limit_reached', statusCode, allow);
  }

  return allow;
}

/**
 * Rate-limit check for starting a hands-free session.
 * Prevents "start session → stop → start again" script abuse.
 * Does NOT check monthly allowance — that is checked per-heartbeat instead.
 * @param {string} userId
 */
export async function enforceHandsfreeStart(userId) {
  if (!userId) {
    throw new UsageError('missing_user', 401, { message: 'User not authenticated' });
  }

  const rate = await checkRateLimit(userId, 'handsfree_starts');
  if (!rate.allowed) {
    const statusCode = rate.reason === 'account_locked' ? 403
                     : rate.reason === 'no_subscription' ? 402
                     : 429;
    throw new UsageError(rate.reason, statusCode, rate);
  }

  // Also check monthly allowance — reject session start if they're already over quota.
  const allow = await checkAllowance(userId, 'handsfree_seconds');
  if (!allow.allowed) {
    const statusCode = allow.error === 'account_locked' ? 403
                     : allow.error === 'no_subscription' ? 402
                     : 402;
    throw new UsageError(allow.error || 'limit_reached', statusCode, allow);
  }

  return allow;
}

/**
 * Check + record hands-free seconds during an active session.
 * Call this from the handsfree-heartbeat endpoint every ~30 seconds.
 * If allowance is exceeded, client should stop after current utterance (Option B).
 * @param {string} userId
 * @param {number} seconds — number of seconds to add since last heartbeat
 * @returns {Promise<object>} { allowed, remaining, used, ... }
 */
export async function trackHandsfreeSeconds(userId, seconds) {
  if (!userId) {
    throw new UsageError('missing_user', 401, { message: 'User not authenticated' });
  }
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 300) {
    throw new UsageError('invalid_heartbeat', 400, { message: 'seconds must be 1-300' });
  }

  // Check first.
  const allow = await checkAllowance(userId, 'handsfree_seconds');
  if (!allow.allowed) {
    const statusCode = allow.error === 'account_locked' ? 403
                     : allow.error === 'no_subscription' ? 402
                     : 402;
    throw new UsageError(allow.error || 'limit_reached', statusCode, allow);
  }

  // Record seconds, clamped so we never overshoot.
  const secondsToRecord = Math.min(seconds, allow.remaining || seconds);
  await recordUsage(userId, 'handsfree_seconds', secondsToRecord);

  // Re-check remaining after increment.
  const after = await checkAllowance(userId, 'handsfree_seconds');
  return {
    allowed: after.allowed,
    remaining: after.remaining,
    used: after.used,
    limit: after.limit,
    should_stop: !after.allowed
  };
}

// ---------------------------------------------------------------------------
// Response helper — converts UsageError to a clean HTTP response
// ---------------------------------------------------------------------------

/**
 * Send a UsageError (or generic Error) as an HTTP response.
 * Sets Retry-After header for rate limits.
 * Standardised JSON body so frontend can handle all enforcement errors identically.
 */
export function sendUsageError(res, err) {
  if (!(err instanceof UsageError)) {
    console.error('[usage] unexpected error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Something went wrong.' });
  }

  if (err.details?.retry_after_seconds) {
    res.setHeader('Retry-After', String(err.details.retry_after_seconds));
  }

  return res.status(err.statusCode).json({
    error: err.code,
    message: err.details?.message || err.message,
    // Pass through useful details for the frontend limit-reached UI
    ...('remaining' in (err.details || {}) && { remaining: err.details.remaining }),
    ...('limit' in (err.details || {}) && { limit: err.details.limit }),
    ...('used' in (err.details || {}) && { used: err.details.used }),
    ...('plan_code' in (err.details || {}) && { plan_code: err.details.plan_code }),
    ...('retry_after_seconds' in (err.details || {}) && { retry_after_seconds: err.details.retry_after_seconds }),
    ...('reason' in (err.details || {}) && { reason: err.details.reason })
  });
}

// ---------------------------------------------------------------------------
// Auth helper — extract user ID from the incoming request
// ---------------------------------------------------------------------------
// Adjust this to match how your existing /api/ routes identify the user.
// If you currently use a Supabase auth token in a header, use the first form.
// If you pass userId in the body, use the second form.
//
// The safe/correct version verifies the JWT. The quick version trusts the client.
// Production routes should use the JWT-verifying version.

/**
 * Verifies a Supabase JWT from the Authorization header and returns user ID.
 * @returns {Promise<string|null>} user ID or null if unauthenticated
 */
export async function getUserIdFromRequest(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) return null;

  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch (e) {
    console.error('[usage] getUserIdFromRequest failed:', e);
    return null;
  }
}
