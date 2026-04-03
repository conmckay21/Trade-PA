// api/calls/incoming.js
// Twilio webhook — fires on every inbound call to the user's Trade PA number
// ALL calls recorded — dedicated business number
// Push notification fires immediately to wake app if backgrounded
// Falls back to real mobile after 45s if app doesn't answer

// XML-escape helper — prevents special chars breaking TwiML parsing
function xmlEscape(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export default async function handler(req, res) {
  const { userId } = req.query;

  const callerNumber = req.body?.From || "";
  const normalised = callerNumber.replace(/\s/g, "");

  if (!userId) {
    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>This number is not configured.</Say><Hangup/></Response>`);
  }

  // Sanitise identity to match what token.js generates
  const identity = userId.replace(/[^a-zA-Z0-9_-]/g, "_");

  const appUrl = process.env.APP_URL;

  try {
    // 1. Fetch forward_to mobile for fallback
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

    // 2. Look up caller name
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
    const customerName = matched?.name || "Unknown caller";

    // 3. Fire push notification immediately (fire and forget)
    fetch(`${appUrl}/api/push/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        title: `📞 Incoming call — ${customerName}`,
        body: `${normalised} · Tap to answer in Trade PA`,
        url: "/",
        type: "call",
        tag: `incoming-${normalised}`,
        requireInteraction: true,
      }),
    }).catch(() => {});

    // 4. Build URLs — encode all params for URLs
    const recordingCallback = `${appUrl}/api/calls/recording?userId=${encodeURIComponent(userId)}&callerNumber=${encodeURIComponent(normalised)}&customerName=${encodeURIComponent(customerName)}`;
    const fallbackUrl = `${appUrl}/api/calls/fallback?forwardTo=${encodeURIComponent(forwardTo)}&callerNumber=${encodeURIComponent(normalised)}&customerName=${encodeURIComponent(customerName)}`;

    // 5. XML-escape all values that go inside TwiML attributes
    const safeIdentity = xmlEscape(identity);
    const safeCustomerName = xmlEscape(customerName);
    const safeCallerNumber = xmlEscape(normalised);
    const safeRecordingCallback = xmlEscape(recordingCallback);
    const safeFallbackUrl = xmlEscape(fallbackUrl);

    console.log(`Incoming call from ${normalised} (${customerName}) → client: ${identity}`);

    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="45" record="record-from-answer" recordingStatusCallback="${safeRecordingCallback}" recordingStatusCallbackMethod="POST" action="${safeFallbackUrl}">
    <Client>
      <Identity>${safeIdentity}</Identity>
      <Parameter name="callerName" value="${safeCustomerName}"/>
      <Parameter name="callerNumber" value="${safeCallerNumber}"/>
    </Client>
  </Dial>
</Response>`);

  } catch (err) {
    console.error("Incoming call error:", err.message);
    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="45">
    <Client>
      <Identity>${xmlEscape(identity)}</Identity>
      <Parameter name="callerName" value="Incoming call"/>
      <Parameter name="callerNumber" value="${xmlEscape(normalised)}"/>
    </Client>
  </Dial>
</Response>`);
  }
}
