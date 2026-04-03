// api/calls/incoming.js
// Twilio webhook — fires on every inbound call to the user's Trade PA number
// 1. Looks up caller against customer list
// 2. Routes to the Trade PA app (Twilio Client) first
// 3. If no answer in 30s, falls back to user's real mobile
// 4. Recording fires via recording.js after call ends

export default async function handler(req, res) {
  const { userId } = req.query;

  const callerNumber = req.body?.From || "";
  const normalised = callerNumber.replace(/\s/g, "");

  if (!userId) {
    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>This number is not configured.</Say><Hangup/></Response>`);
  }

  const appUrl = process.env.APP_URL;

  try {
    // 1. Fetch user's call_tracking row (for forwardTo fallback mobile)
    const ctRes = await fetch(
      `${process.env.VITE_SUPABASE_URL}/rest/v1/call_tracking?user_id=eq.${userId}&select=forward_to&limit=1`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    const ctData = await ctRes.json();
    const forwardTo = ctData?.[0]?.forward_to || "";

    // 2. Look up caller in customer list
    const last10 = normalised.slice(-10);

    const custRes = await fetch(
      `${process.env.VITE_SUPABASE_URL}/rest/v1/customers?user_id=eq.${userId}&select=id,name,phone&limit=200`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    const customers = await custRes.json() || [];

    const matched = customers.find(c => {
      if (!c.phone) return false;
      return c.phone.replace(/\s/g, "").slice(-10) === last10;
    });

    const isKnown = !!matched;
    const customerName = matched?.name || "Unknown";

    // 3. Build recording callback URL (fires when recording is ready)
    const recordingCallback = `${appUrl}/api/calls/recording?userId=${encodeURIComponent(userId)}&callerNumber=${encodeURIComponent(normalised)}&customerName=${encodeURIComponent(customerName)}`;

    // 4. Build fallback URL (fires if app client doesn't answer in 30s)
    const fallbackUrl = `${appUrl}/api/calls/fallback?forwardTo=${encodeURIComponent(forwardTo)}&callerNumber=${encodeURIComponent(normalised)}&customerName=${encodeURIComponent(customerName)}`;

    res.setHeader("Content-Type", "text/xml");

    if (isKnown) {
      // Known customer — ring the app with caller info as custom params, record call
      return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial
    timeout="30"
    record="record-from-answer"
    recordingStatusCallback="${recordingCallback}"
    recordingStatusCallbackMethod="POST"
    action="${fallbackUrl}"
  >
    <Client>
      <Identity>${userId}</Identity>
      <Parameter name="callerName" value="${customerName}"/>
      <Parameter name="callerNumber" value="${normalised}"/>
      <Parameter name="isKnown" value="true"/>
    </Client>
  </Dial>
</Response>`);
    } else {
      // Unknown caller — ring the app silently, no recording, still with fallback
      return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial
    timeout="30"
    action="${fallbackUrl}"
  >
    <Client>
      <Identity>${userId}</Identity>
      <Parameter name="callerName" value="Unknown caller"/>
      <Parameter name="callerNumber" value="${normalised}"/>
      <Parameter name="isKnown" value="false"/>
    </Client>
  </Dial>
</Response>`);
    }

  } catch (err) {
    console.error("Incoming call error:", err.message);
    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="30">
    <Client>
      <Identity>${userId}</Identity>
      <Parameter name="callerName" value="Incoming call"/>
      <Parameter name="callerNumber" value="${normalised}"/>
    </Client>
  </Dial>
</Response>`);
  }
}
