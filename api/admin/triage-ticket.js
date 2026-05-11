// api/admin/triage-ticket.js
//
// Admin endpoint for the "Re-analyse" button in the support inbox.
// POST { ticket_id } with Authorization: Bearer <admin-session-jwt>.
//
// Auth: requireAuth (JWT verification) + admin_is_admin RPC (via a user-scoped
// client so auth.uid() resolves correctly inside the function).
//
// CORS: this endpoint is called from admin.tradespa.co.uk, a different origin
// from www.tradespa.co.uk where this code runs. Handle OPTIONS preflight +
// Access-Control headers explicitly.

import { createClient } from "@supabase/supabase-js";
import { withSentry, captureNonFatal } from "../lib/sentry.js";
import { requireAuth } from "../lib/auth.js";
import { triageTicket } from "../lib/triage.js";

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

  // ---- Admin check via user-scoped RPC ----
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const userDb = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: isAdmin, error: adminErr } = await userDb.rpc("admin_is_admin");
  if (adminErr) {
    captureNonFatal(adminErr, { tags: { route: "admin-triage-ticket/admin-check" } });
    return res.status(500).json({ error: adminErr.message });
  }
  if (!isAdmin) return res.status(403).json({ error: "Not authorised" });

  // ---- Input ----
  const { ticket_id } = req.body || {};
  if (typeof ticket_id !== "string" || ticket_id.length < 8) {
    return res.status(400).json({ error: "ticket_id required" });
  }

  // ---- Run triage (synchronous — admin is waiting on the result) ----
  try {
    const triage = await triageTicket(ticket_id);
    return res.status(200).json({ triage });
  } catch (e) {
    captureNonFatal(e, { tags: { route: "admin-triage-ticket" }, extra: { ticket_id } });
    return res.status(500).json({ error: e.message || "Triage failed" });
  }
}

export default withSentry(handler, { routeName: "admin-triage-ticket" });
