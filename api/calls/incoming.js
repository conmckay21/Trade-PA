// api/calls/incoming.js
// Conference bridge approach — Twilio stays in the middle of EVERY call
// Whether answered on app or mobile, the call is always recorded and transcribed
// Call flow:
// 1. Caller rings Twilio number
// 2. Twilio creates a named conference room
// 3. Twilio dials app client into conference (push notification fires simultaneously)
// 4. If app doesn't answer in 20s, Twilio dials mobile into conference too
// 5. Recording happens at conference level — always captured regardless of answer method

import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  const { userId } = req.query;
  const callerNumber = req.body?.From || '';
  const normalised = callerNumber.replace(/\s/g, '');

  if (!userId) {
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>This number is not configured.</Say><Hangup/></Response>`);
  }

  const appUrl = process.env.APP_URL;
  const identity = userId.replace(/[^a-zA-Z0-9_-]/g, '_');

  try {
    // Fetch call_tracking settings (forward_to mobile)
    const ctRes = await fetch(
      `${process.env.VITE_SUPABASE_URL}/rest/v1/call_tracking?user_id=eq.${userId}&select=forward_to&limit=1`,
      { headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` } }
    );
    const ctData = await ctRes.json();
    const forwardTo = ctData?.[0]?.forward_to || '';

    // Look up caller name from customers
    const last10 = normalised.slice(-10);
    const custRes = await fetch(
      `${process.env.VITE_SUPABASE_URL}/rest/v1/customers?user_id=eq.${userId}&select=id,name,phone&limit=200`,
      { headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` } }
    );
    const customers = await custRes.json() || [];
    const matched = customers.find(c => c.phone && c.phone.replace(/\s/g, '').slice(-10) === last10);
    const customerName = matched?.name || 'Unknown caller';

    // Create a unique conference room name for this call
    // Use timestamp + callerNumber to make it unique
    const confName = `tradpa_${userId.slice(0,8)}_${Date.now()}`;

    // Fire push notification immediately to wake app
    fetch(`${appUrl}/api/push/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        title: `📞 Incoming call — ${customerName}`,
        body: `${normalised} · Tap to answer in Trade PA`,
        url: '/', type: 'call',
        tag: `incoming-${normalised}`,
        requireInteraction: true,
      }),
    }).catch(() => {});

    // Build conference status callback URLs (& must be &amp; in XML)
    const confStatusCallback = [
      `${appUrl}/api/calls/conf-status`,
      `?userId=${encodeURIComponent(userId)}`,
      `&callerNumber=${encodeURIComponent(normalised)}`,
      `&customerName=${encodeURIComponent(customerName)}`,
      `&confName=${encodeURIComponent(confName)}`,
      `&forwardTo=${encodeURIComponent(forwardTo)}`,
    ].join('').replace(/&/g, '&amp;');

    const recordingCallback = [
      `${appUrl}/api/calls/recording`,
      `?userId=${encodeURIComponent(userId)}`,
      `&callerNumber=${encodeURIComponent(normalised)}`,
      `&customerName=${encodeURIComponent(customerName)}`,
    ].join('').replace(/&/g, '&amp;');

    console.log(`Conference bridge: ${normalised} (${customerName}) → conf: ${confName}`);

    // Put caller into conference room first (they hear hold music while we connect the other party)
    // The conference is set to start recording immediately
    // conf-status webhook fires when participant count changes — that's when we dial mobile fallback
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference
      statusCallback="${confStatusCallback}"
      statusCallbackMethod="POST"
      statusCallbackEvent="start end join leave"
      record="record-from-start"
      recordingStatusCallback="${recordingCallback}"
      recordingStatusCallbackMethod="POST"
      startConferenceOnEnter="true"
      endConferenceOnExit="true"
      waitUrl="http://twimlets.com/holdmusic?Bucket=com.twilio.music.classical"
      maxParticipants="3"
      beep="false">
      ${confName}
    </Conference>
  </Dial>
</Response>`);

  } catch (err) {
    console.error('Incoming call error:', err.message);
    // Fallback — direct dial to app client if conference setup fails
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="45">
    <Client>
      <Identity>${identity}</Identity>
      <Parameter name="callerName" value="Incoming call"/>
      <Parameter name="callerNumber" value="${normalised}"/>
    </Client>
  </Dial>
</Response>`);
  }
}
