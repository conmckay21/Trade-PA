// /api/delete-account.js — Vercel serverless function
//
// Apple App Store Review Guideline 5.1.1(v) compliance: any app that supports
// account creation must support account deletion in-app. Hard delete with
// type-to-confirm — no grace period, no soft delete.
//
// Flow:
//   1. Verify the user's JWT (requireAuth)
//   2. Verify the email in the request body matches the authenticated user's
//      email — server-side type-to-confirm guard against any client-side bypass
//   3. Cancel any active Stripe subscription (so billing stops immediately)
//   4. Delete from every user_id-scoped table
//   5. Handle companies/company_members carefully — only delete the company
//      if the deleting user is its only member, otherwise just remove them
//   6. Delete the auth.users row (this signs them out everywhere and removes
//      the login record)
//
// Rate limit: 1 attempt per hour per user. This is irreversible; we don't
// want a buggy retry to hit it twice.
//
// Returns 200 { ok: true } on success. Client should then sign out + redirect
// to login. The auth.users row is gone, so the existing session token is
// already invalid.

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { withSentry, captureNonFatal } from "./lib/sentry.js";
import { requireAuth, checkInMemoryRateLimit } from "./lib/auth.js";

// Service-role client for cross-table deletes that bypass RLS.
// We need this because RLS would block deletion of the auth.users row.
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
  : null;

// Tables with a user_id column (from information_schema query 30 Apr 2026).
// Order isn't critical because all are independent rows scoped to user_id —
// no cross-table FKs to worry about within this list.
const USER_SCOPED_TABLES = [
  "accounting_connections", "addon_purchases", "ai_context", "ai_feedback",
  "anomaly_events", "call_logs", "call_tracking", "cis_statements",
  "compliance_docs", "customer_contacts", "customers", "daywork_sheets",
  "documents", "email_actions", "email_connections", "enquiries", "expenses",
  "in_app_notifications", "invoices", "job_cards", "job_drawings", "job_notes",
  "job_photos", "job_workers", "jobs", "materials", "mileage_logs",
  "pa_error_log", "pa_memories", "purchase_orders", "push_subscriptions",
  "rams_documents", "rate_limit_counters", "reminders", "review_requests",
  "stock_items", "subcontractor_payments", "subscriptions", "team_members",
  "time_logs", "trade_certificates", "usage_events", "usage_tracking",
  "user_abuse_state", "user_commands", "user_onboarding", "user_settings",
  "variation_orders", "worker_documents",
];

async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const userId = await requireAuth(req, res);
  if (!userId) return;

  // Rate limit: 1 attempt per hour. Account deletion is irreversible.
  const rl = checkInMemoryRateLimit(userId, "delete_account", { maxRequests: 1, windowMs: 60 * 60_000 });
  if (!rl.allowed) {
    return res.status(429).json({
      error: "Account deletion is rate-limited to one attempt per hour. If you tried recently, please wait.",
    });
  }

  try {
    const { confirmEmail } = req.body || {};
    if (!confirmEmail || typeof confirmEmail !== "string") {
      return res.status(400).json({ error: "confirmEmail is required" });
    }

    // Verify the email matches the authenticated user. This is a server-side
    // safeguard on top of client-side type-to-confirm.
    const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userErr || !userData?.user) {
      return res.status(404).json({ error: "User not found" });
    }
    const realEmail = (userData.user.email || "").toLowerCase().trim();
    const submittedEmail = confirmEmail.toLowerCase().trim();
    if (realEmail !== submittedEmail) {
      return res.status(400).json({ error: "Confirmation email does not match account email" });
    }

    // STEP 1: Cancel any active Stripe subscription. We do this first so
    // that even if a later step fails, billing has already stopped.
    if (stripe) {
      try {
        const { data: subs } = await supabaseAdmin
          .from("subscriptions")
          .select("stripe_subscription_id, status")
          .eq("user_id", userId);
        for (const sub of subs || []) {
          if (sub.stripe_subscription_id && sub.status !== "canceled") {
            try {
              await stripe.subscriptions.cancel(sub.stripe_subscription_id);
            } catch (cancelErr) {
              // Non-fatal — log and continue. The subscription row will be
              // deleted in the cascade anyway, and Stripe records remain
              // for our financial audit trail.
              captureNonFatal(cancelErr, { tags: { stage: "stripe_cancel" }, extra: { userId, subId: sub.stripe_subscription_id } });
            }
          }
        }
      } catch (stripeErr) {
        captureNonFatal(stripeErr, { tags: { stage: "stripe_lookup" }, extra: { userId } });
      }
    }

    // STEP 2: Handle company membership carefully.
    //   - If the user is in a company AND they are the only member: delete the company
    //   - If they are in a company with other members: just remove their membership
    //     (this preserves the team's data — jobs, invoices, etc — for the remaining members)
    let companyToDelete = null;
    try {
      const { data: memberships } = await supabaseAdmin
        .from("company_members")
        .select("company_id")
        .eq("user_id", userId);
      for (const m of memberships || []) {
        const { data: siblings, count } = await supabaseAdmin
          .from("company_members")
          .select("user_id", { count: "exact", head: true })
          .eq("company_id", m.company_id);
        if ((count ?? 0) <= 1) {
          // Sole member of this company — mark for deletion after we delete
          // their membership row in the cascade below.
          companyToDelete = m.company_id;
        }
      }
    } catch (memberErr) {
      captureNonFatal(memberErr, { tags: { stage: "membership_lookup" }, extra: { userId } });
    }

    // STEP 3: Delete from all user_id-scoped tables.
    // We don't bail out on individual table failures — log them and keep going.
    // Better to over-delete from one table than to leave a half-deleted account.
    const failedTables = [];
    for (const table of USER_SCOPED_TABLES) {
      try {
        const { error } = await supabaseAdmin.from(table).delete().eq("user_id", userId);
        if (error) {
          failedTables.push({ table, error: error.message });
        }
      } catch (e) {
        failedTables.push({ table, error: e.message });
      }
    }

    // STEP 4: Delete the company itself if the user was its sole member.
    if (companyToDelete) {
      try {
        await supabaseAdmin.from("companies").delete().eq("id", companyToDelete);
      } catch (companyErr) {
        captureNonFatal(companyErr, { tags: { stage: "company_delete" }, extra: { userId, companyId: companyToDelete } });
      }
    }

    // STEP 5: Delete the auth.users row. This invalidates all sessions
    // and removes the login record. After this point, the user truly
    // no longer exists.
    const { error: authDeleteErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authDeleteErr) {
      // This is the only failure mode that's actually fatal — if we can't
      // delete the auth row, the user can still log in, which is bad.
      // Surface it so the client knows to retry.
      return res.status(500).json({
        error: "Account data deleted but auth record could not be removed. Please contact support.",
        detail: authDeleteErr.message,
      });
    }

    return res.status(200).json({
      ok: true,
      tablesFailed: failedTables.length,
      failedTablesDetail: failedTables.length ? failedTables : undefined,
    });
  } catch (e) {
    console.error("Delete account handler error:", e);
    return res.status(500).json({
      error: "Account deletion failed: " + (e.message || "unknown error") + ". Please contact support at thetradepa@gmail.com.",
    });
  }
}

export default withSentry(handler, { routeName: "delete-account" });
