// /api/promo/redeem.js
// Server-side endpoint to apply a promo code to a freshly-created user.
// Called from signup.html immediately AFTER /api/stripe/create-subscription
// succeeds, so the subscription row already exists for the redeem function
// to extend trial_ends_at on.
//
// Auth: caller must send a valid Supabase JWT in the Authorization header.
// We verify the token server-side (so the body's user_id can't be spoofed)
// and use the verified user_id, not anything the client claims.
//
// The redeem_promo_code SQL function is SECURITY DEFINER and granted only
// to service_role — so we have to call it from the server with the service
// key, never from the browser with the anon key.

import { createClient } from "@supabase/supabase-js";
import { withSentry, captureNonFatal } from "../lib/sentry.js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

export default withSentry(async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return res.status(401).json({ error: "Missing auth token" });
  }

  const code = (req.body?.code || "").trim();
  if (!code) {
    return res.status(400).json({ error: "No code provided" });
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    captureNonFatal(new Error("Supabase env vars missing for /api/promo/redeem"), {
      hasUrl: !!SUPABASE_URL,
      hasKey: !!SERVICE_KEY,
    });
    return res.status(500).json({ error: "Server misconfiguration" });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Verify the Bearer token belongs to a real user
  const { data: userData, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !userData?.user?.id) {
    return res.status(401).json({ error: "Invalid auth token" });
  }

  const userId = userData.user.id;

  // Call the SECURITY DEFINER redeem function
  const { data, error } = await sb.rpc("redeem_promo_code", {
    p_code: code,
    p_user_id: userId,
  });

  if (error) {
    captureNonFatal(error, { route: "/api/promo/redeem", userId, code });
    return res.status(500).json({ success: false, error: "Could not apply code" });
  }

  // `data` is the json the SQL function returned — could be success or error
  // (e.g. code already used, expired, etc.). Pass it through with 200 status
  // either way; the client decides what to show.
  return res.status(200).json(data || { success: false, error: "Unknown error" });
});
