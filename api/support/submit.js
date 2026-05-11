// api/support/submit.js
//
// User-facing endpoint for the in-app Contact Support button.
// POST { subject, body, category } with Authorization: Bearer <user-session-jwt>.
//
// Flow:
//   1. requireAuth → user_id
//   2. Per-user rate limit (10/hour, matches feedback.js mitigation pattern)
//   3. Validate input
//   4. Call submit_support_ticket RPC as the user (user-scoped client)
//   5. Respond to client immediately
//   6. waitUntil() the side effects — notification email + AI triage —
//      so Vercel keeps the function alive past res.end() but the user
//      doesn't wait on them.
//
// Env vars required:
//   VITE_SUPABASE_URL  (falls back to SUPABASE_URL)
//   VITE_SUPABASE_ANON_KEY  (falls back to SUPABASE_ANON_KEY)
//   SUPABASE_SERVICE_KEY  (falls back to SUPABASE_SERVICE_ROLE_KEY)
//   RESEND_API_KEY  (used by resend.js)
//   ANTHROPIC_API_KEY  (used by triage.js)

import { createClient } from "@supabase/supabase-js";
import { waitUntil } from "@vercel/functions";
import { withSentry, captureNonFatal } from "../lib/sentry.js";
import { requireAuth, checkInMemoryRateLimit } from "../lib/auth.js";
import { sendSupportTicketNotification } from "../lib/resend.js";
import { triageTicket } from "../lib/triage.js";

const VALID_CATEGORIES = ["billing", "bug", "feature_request", "account", "other"];

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ---- Auth ----
  const userId = await requireAuth(req, res);
  if (!userId) return;

  // ---- Rate limit (per-instance, generous: 10/hour) ----
  const rl = checkInMemoryRateLimit(userId, "support_submit", { maxRequests: 10, windowMs: 60 * 60_000 });
  if (!rl.allowed) {
    return res.status(429).json({
      error: "You've sent a lot of support tickets in the last hour — give us a moment to catch up. You can always email support@tradespa.co.uk directly.",
      resetAt: new Date(rl.resetAt).toISOString(),
    });
  }

  // ---- Input validation ----
  const { subject, body, category } = req.body || {};
  if (typeof subject !== "string" || subject.trim().length < 3 || subject.length > 200) {
    return res.status(400).json({ error: "Subject must be 3–200 characters" });
  }
  if (typeof body !== "string" || body.trim().length < 10 || body.length > 10000) {
    return res.status(400).json({ error: "Message must be 10–10,000 characters" });
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: "Invalid category" });
  }

  // ---- Look up the user's email (for notification) ----
  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
  const userEmail = authUser?.user?.email || "unknown";

  // ---- Call the RPC as the user (RLS-friendly path via their JWT) ----
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const userDb = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: ticketId, error: rpcErr } = await userDb.rpc("submit_support_ticket", {
    p_subject:  subject,
    p_body:     body,
    p_category: category,
  });
  if (rpcErr) {
    captureNonFatal(rpcErr, { tags: { route: "support-submit" }, extra: { user_id: userId } });
    return res.status(500).json({ error: rpcErr.message || "Failed to create ticket" });
  }

  // ---- Respond to the client ----
  res.status(200).json({ ticket_id: ticketId });

  // ---- Background work: notification email + AI triage ----
  // waitUntil keeps the function alive past res.end() so these complete.
  waitUntil(
    sendSupportTicketNotification({
      ticketId,
      userEmail,
      subject,
      body,
      category,
    }).catch(err => {
      captureNonFatal(err, { tags: { route: "support-submit/notify" }, extra: { ticket_id: ticketId } });
    })
  );

  waitUntil(
    triageTicket(ticketId).catch(err => {
      captureNonFatal(err, { tags: { route: "support-submit/triage" }, extra: { ticket_id: ticketId } });
    })
  );
}

export default withSentry(handler, { routeName: "support-submit" });
