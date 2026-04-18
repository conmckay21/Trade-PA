// api/calls/incoming.js
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

  // ─── Quota check — reject calls over hard_cap to voicemail ────────────────
  try {
    const ctQuotaRes = await fetch(
      `${process.env.VITE_SUPABASE_URL}/rest/v1/call_tracking?user_id=eq.${userId}&select=phone_plan,hard_cap_minutes,minutes_used_month,active&limit=1`,
      { headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` } }
    );
    const ctQuotaData = await ctQuotaRes.json();
    const ctRow = ctQuotaData?.[0];

    if (ctRow) {
      if (ctRow.active === false) {
        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-GB">Sorry, this number is no longer in service.</Say>
  <Hangup/>
</Response>`);
      }

      if (ctRow.phone_plan && ctRow.hard_cap_minutes != null
          && ctRow.minutes_used_month >= ctRow.hard_cap_minutes) {
        console.log(`[incoming] User ${userId} over hard cap (${ctRow.minutes_used_month}/${ctRow.hard_cap_minutes}) — voicemail`);
        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-GB">Thank you for calling. The subscriber has reached their monthly call allowance. Please leave a message after the beep and they will get back to you.</Say>
  <Record maxLength="120" playBeep="true" transcribe="false"/>
  <Hangup/>
</Response>`);
      }
    }
  } catch (quotaErr) {
    console.error('[incoming] Quota check failed, proceeding:', quotaErr.message);
  }

  try {
    const ctRes = await fetch(
      `${process.env.VITE_SUPABASE_URL}/rest/v1/call_tracking?user_id=eq.${userId}&select=forward_to&limit=1`,
      { headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` } }
    );
    const ctData = await ctRes.json();
    const forwardTo = ctData?.[0]?.forward_to || '';

    const last10 = normalised.slice(-10);
    const custRes = await fetch(
      `${process.env.VITE_SUPABASE_URL}/rest/v1/customers?user_id=eq.${userId}&select=id,name,phone&limit=200`,
      { headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` } }
    );
    const customers = await custRes.json() || [];
    const matched = customers.find(c => c.phone && c.phone.replace(/\s/g, '').slice(-10) === last10);
    const customerName = matched?.name || 'Unknown caller';

    const confName = `tradpa_${userId.slice(0,8)}_${Date.now()}`;

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
