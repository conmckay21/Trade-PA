// api/admin/send-support-reply.js
//
// Admin endpoint for sending a reply back to a ticket's user.
// POST { ticket_id, body } with Authorization: Bearer <admin-session-jwt>.
//
// Flow:
//   1. requireAuth → user_id
//   2. admin_is_admin RPC via user-scoped client
//   3. Validate input
//   4. Call admin_reply_to_ticket RPC — creates the message row (trigger
//      handles status transition + last_message_at)
//   5. Look up the ticket subject + user_email
//   6. Send the email via Resend FROM support@tradespa.co.uk

import { createClient } from "@supabase/supabase-js";
import { withSentry, captureNonFatal } from "../lib/sentry.js";
import { requireAuth } from "../lib/auth.js";
import { sendSupportReply } from "../lib/resend.js";

const ADMIN_ORIGIN = "https://admin.tradespa.co.uk";

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin",  ADMIN_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age",       "86400");
}

async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ---- Auth ----
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const userDb = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: isAdmin, error: adminErr } = await userDb.rpc("admin_is_admin");
  if (adminErr) {
    captureNonFatal(adminErr, { tags: { route: "admin-send-support-reply/admin-check" } });
    return res.status(500).json({ error: adminErr.message });
  }
  if (!isAdmin) return res.status(403).json({ error: "Not authorised" });

  // ---- Input ----
  const { ticket_id, body } = req.body || {};
  if (typeof ticket_id !== "string" || ticket_id.length < 8) {
    return res.status(400).json({ error: "ticket_id required" });
  }
  if (typeof body !== "string" || body.trim().length < 1 || body.length > 10000) {
    return res.status(400).json({ error: "Reply body required (1–10,000 chars)" });
  }

  // ---- Create the message via RPC (executes as the admin) ----
  const { data: messageId, error: rpcErr } = await userDb.rpc("admin_reply_to_ticket", {
    p_ticket_id: ticket_id,
    p_body:      body,
  });
  if (rpcErr) {
    captureNonFatal(rpcErr, { tags: { route: "admin-send-support-reply/rpc" }, extra: { ticket_id } });
    return res.status(500).json({ error: rpcErr.message || "Failed to save reply" });
  }

  // ---- Look up the ticket for the email payload (service-role read) ----
  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data: ticketRows, error: lookupErr } = await supabaseAdmin
    .from("support_tickets")
    .select("subject, user_email")
    .eq("id", ticket_id)
    .limit(1);

  if (lookupErr || !ticketRows?.[0]) {
    captureNonFatal(lookupErr || new Error("ticket not found"), {
      tags: { route: "admin-send-support-reply/lookup" },
      extra: { ticket_id },
    });
    return res.status(200).json({
      message_id: messageId,
      email_sent: false,
      warning: "Reply saved but ticket lookup failed; email not sent.",
    });
  }
  const { subject, user_email } = ticketRows[0];

  // ---- Send the email ----
  try {
    const ok = await sendSupportReply({
      to:              user_email,
      ticketId:        ticket_id,
      originalSubject: subject,
      body,
    });
    return res.status(200).json({ message_id: messageId, email_sent: !!ok });
  } catch (e) {
    captureNonFatal(e, { tags: { route: "admin-send-support-reply/email" }, extra: { ticket_id } });
    return res.status(200).json({
      message_id: messageId,
      email_sent: false,
      warning: "Reply saved but email failed; check Resend logs.",
    });
  }
}

export default withSentry(handler, { routeName: "admin-send-support-reply" });
