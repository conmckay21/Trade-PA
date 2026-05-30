// api/calls/search-numbers.js
// Lists a handful of available UK (GB Local) numbers, optionally filtered to a
// town (InLocality) or dialling code (Contains), so the user can pick a local
// number before subscribing. Read-only: buys nothing.

import { createClient } from "@supabase/supabase-js";
import { withSentry } from "../lib/sentry.js";

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function getUserIdFromRequest(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch { return null; }
}

async function searchTwilio(twilioBase, params, authHeader) {
  const res = await fetch(
    `${twilioBase}/AvailablePhoneNumbers/GB/Local.json?${params.toString()}`,
    { headers: { Authorization: authHeader } }
  );
  if (!res.ok) throw new Error("twilio_search_failed");
  const data = await res.json();
  return data.available_phone_numbers || [];
}

async function handler(req, res) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: "unauthorised", message: "Valid auth token required." });

  const q = ((req.query && req.query.q) || (req.body && req.body.q) || "").toString().trim();

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
  const twilioBase = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}`;

  const params = new URLSearchParams({ VoiceEnabled: "true", SmsEnabled: "false", PageSize: "10" });
  let usedFilter = false;
  if (q) {
    const looksNumeric = /^[0-9+()\s-]+$/.test(q);
    if (looksNumeric) {
      const code = q.replace(/[^0-9]/g, "").replace(/^0+/, "");
      if (code) { params.set("Contains", `44${code}`); usedFilter = true; }
    } else {
      params.set("InLocality", q);
      usedFilter = true;
    }
  }

  try {
    let numbers = await searchTwilio(twilioBase, params, authHeader);
    let fellBack = false;
    if (usedFilter && numbers.length === 0) {
      const fb = new URLSearchParams({ VoiceEnabled: "true", SmsEnabled: "false", PageSize: "5" });
      numbers = await searchTwilio(twilioBase, fb, authHeader);
      fellBack = true;
    }
    return res.status(200).json({
      numbers: numbers.slice(0, 8).map((n) => ({
        phone_number: n.phone_number,
        friendly_name: n.friendly_name,
        locality: n.locality || "",
        region: n.region || "",
      })),
      fell_back: fellBack,
    });
  } catch (err) {
    console.error("[search-numbers] error:", err.message);
    return res.status(500).json({ error: "search_failed", message: "Could not search for numbers right now. Please try again." });
  }
}

export default withSentry(handler, { routeName: "calls/search-numbers" });
