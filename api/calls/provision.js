// api/calls/provision.js
// Buys a UK Twilio number for a user and saves to call_tracking
// Called from CallTrackingSettings component in App.jsx
// Returns { twilioNumber, forwardingCode, disableCode }

import { withSentry } from "../lib/sentry.js";

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { userId, forwardTo } = req.body || {};

  if (!userId || !forwardTo) {
    return res.status(400).json({ error: "userId and forwardTo are required" });
  }

  const forwardToClean = forwardTo.replace(/\s/g, "");

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const appUrl = process.env.APP_URL;
  const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
  const twilioBase = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}`;

  try {
    // 1. Check if user already has a number
    const existingRes = await fetch(
      `${process.env.VITE_SUPABASE_URL}/rest/v1/call_tracking?user_id=eq.${userId}&select=twilio_number`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    const existing = await existingRes.json();
    if (existing?.[0]?.twilio_number) {
      return res.status(400).json({ error: "Call tracking is already active for this account" });
    }

    // 2. Search for available UK number
    const searchRes = await fetch(
      `${twilioBase}/AvailablePhoneNumbers/GB/Local.json?VoiceEnabled=true&SmsEnabled=false&PageSize=5`,
      { headers: { Authorization: authHeader } }
    );

    if (!searchRes.ok) {
      return res.status(500).json({ error: "Could not search for available numbers" });
    }

    const searchData = await searchRes.json();
    const available = searchData.available_phone_numbers || [];
    if (available.length === 0) {
      return res.status(500).json({ error: "No UK numbers available right now. Please try again shortly." });
    }

    const chosenNumber = available[0].phone_number;

    // 3. Purchase the number — webhook URL only needs userId
    // forwardTo is stored in the DB and looked up at call time
    const webhookUrl = `${appUrl}/api/calls/incoming?userId=${userId}`;

    const purchaseRes = await fetch(`${twilioBase}/IncomingPhoneNumbers.json`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        PhoneNumber: chosenNumber,
        VoiceUrl: webhookUrl,
        VoiceMethod: "POST",
      }).toString(),
    });

    if (!purchaseRes.ok) {
      return res.status(500).json({ error: "Failed to purchase number. Please try again." });
    }

    const purchaseData = await purchaseRes.json();
    const twilioNumber = purchaseData.phone_number;
    const twilioNumberSid = purchaseData.sid;

    // 4. UK forwarding codes
    const intlNumber = twilioNumber.replace("+", "");
    const forwardingCode = `**21*${intlNumber}#`;
    const disableCode = `##21#`;

    // 5. Save to call_tracking
    const saveRes = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/call_tracking`, {
      method: "POST",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        user_id: userId,
        twilio_number: twilioNumber,
        twilio_number_sid: twilioNumberSid,
        forwarding_code: forwardingCode,
        disable_code: disableCode,
        forward_to: forwardToClean,
        created_at: new Date().toISOString(),
      }),
    });

    if (!saveRes.ok) {
      console.error(`CRITICAL: Number ${twilioNumber} (SID: ${twilioNumberSid}) purchased but not saved for userId ${userId}`);
      return res.status(500).json({ error: "Number purchased but failed to save. Please contact support." });
    }

    console.log(`✓ Provisioned ${twilioNumber} for userId ${userId}`);

    return res.status(200).json({ twilioNumber, forwardingCode, disableCode });

  } catch (err) {
    console.error("Provision error:", err.message);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}

export default withSentry(handler, { routeName: "calls/provision" });
