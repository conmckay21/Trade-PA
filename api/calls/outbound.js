// api/calls/outbound.js
// TwiML App URL — Twilio calls this when the in-app Device makes an outbound call
// Params sent from the app via device.connect({ params: { To, userId, customerName } })

import { withSentry } from "../lib/sentry.js";

async function handler(req, res) {
  const { To, userId, customerName } = req.body || {};

  if (!To || !userId) {
    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say voice="alice" language="en-GB">Call failed — missing parameters.</Say><Hangup/></Response>`);
  }

  const appUrl = process.env.APP_URL;
  const toClean = To.replace(/\s/g, "");

  try {
    // Look up user's Twilio number to use as caller ID
    const ctRes = await fetch(
      `${process.env.VITE_SUPABASE_URL}/rest/v1/call_tracking?user_id=eq.${userId}&select=twilio_number&limit=1`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    const ctData = await ctRes.json();
    const callerId = ctData?.[0]?.twilio_number || process.env.TWILIO_PHONE_NUMBER;

    const recordingCallback = `${appUrl}/api/calls/recording?userId=${encodeURIComponent(userId)}&callerNumber=${encodeURIComponent(toClean)}&customerName=${encodeURIComponent(customerName || "Unknown")}&direction=outbound`;

    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial
    callerId="${callerId}"
    record="record-from-answer"
    recordingStatusCallback="${recordingCallback}"
    recordingStatusCallbackMethod="POST"
    timeout="30"
  >
    <Number>${toClean}</Number>
  </Dial>
</Response>`);

  } catch (err) {
    console.error("Outbound TwiML error:", err.message);
    // Still attempt the call even if DB lookup failed
    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="30">
    <Number>${toClean}</Number>
  </Dial>
</Response>`);
  }
}

export default withSentry(handler, { routeName: "calls/outbound" });
