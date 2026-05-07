// api/calls/conf-status.js
// Conference status webhook — fires on conference + participant events.
//
// Architecture:
//   - Caller rings Twilio number → /api/calls/incoming returns TwiML that
//     puts caller into a conference, with this URL as the status callback.
//   - When caller joins (participant-join, count=1) → we dial the app
//     client into the conference. If that fails → mobile fallback.
//
// Two correctness gotchas this file fixes:
//   1. Twilio does NOT send ParticipantCount in participant-* events
//      (only in conference-* events). We check the count via Twilio's
//      REST API instead — authoritative, also gives us idempotency.
//   2. On Vercel serverless, calling res.send() finalises the request and
//      the runtime tears the function down — any in-flight async work
//      (like client.calls.create()) gets killed mid-flight. So we do all
//      the work first, then respond.

import twilio from 'twilio';

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;

export default async function handler(req, res) {
  const { userId, callerNumber, customerName, confName, forwardTo } = req.query;
  const event = req.body?.StatusCallbackEvent;
  const conferenceSid = req.body?.ConferenceSid;
  const callSid = req.body?.CallSid;

  console.log(
    `[conf-status] event=${event} conf=${confName} confSid=${conferenceSid} callSid=${callSid} userId=${userId}`
  );

  // Exit early for any non-join event — we only act when someone joins
  if (event !== 'participant-join') {
    return res.status(200).send('OK');
  }

  // Validate env
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const appUrl = process.env.APP_URL;

  const missing = [];
  if (!accountSid) missing.push('TWILIO_ACCOUNT_SID');
  if (!authToken) missing.push('TWILIO_AUTH_TOKEN');
  if (!appUrl) missing.push('APP_URL');
  if (!SUPABASE_URL) missing.push('VITE_SUPABASE_URL');
  if (!SUPABASE_KEY) missing.push('SUPABASE_SERVICE_KEY');
  if (missing.length) {
    console.error(`[conf-status] Missing env vars: ${missing.join(', ')}`);
    return res.status(200).send('OK');
  }

  if (!userId) {
    console.error('[conf-status] No userId in query');
    return res.status(200).send('OK');
  }

  if (!conferenceSid) {
    console.error('[conf-status] No ConferenceSid in body');
    return res.status(200).send('OK');
  }

  const client = twilio(accountSid, authToken);

  // Idempotency check: how many participants are currently in the conference?
  // - 1 participant (the caller alone) → first join → we should dial the app/mobile in
  // - 2+ participants → app/mobile already joined a previous trigger → skip
  let participantCount = 0;
  try {
    const participants = await client
      .conferences(conferenceSid)
      .participants.list({ limit: 5 });
    participantCount = participants.length;
    console.log(
      `[conf-status] Conference ${conferenceSid} currently has ${participantCount} participants`
    );
  } catch (err) {
    console.error(
      '[conf-status] Failed to list participants:',
      err.message,
      err.code || ''
    );
    return res.status(200).send('OK');
  }

  if (participantCount !== 1) {
    console.log(
      `[conf-status] Skipping dial — count=${participantCount} (expected 1 for caller-alone state)`
    );
    return res.status(200).send('OK');
  }

  // Look up THIS user's Twilio number from call_tracking (multi-tenant)
  let userTwilioNumber = null;
  let userForwardTo = forwardTo || null;
  try {
    const ctRes = await fetch(
      `${SUPABASE_URL}/rest/v1/call_tracking?user_id=eq.${userId}&select=twilio_number,forward_to,active&limit=1`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    const ctData = await ctRes.json();
    const row = Array.isArray(ctData) ? ctData[0] : null;
    if (!row) {
      console.error(`[conf-status] No call_tracking row for userId=${userId}`);
      return res.status(200).send('OK');
    }
    if (row.active === false) {
      console.log(`[conf-status] call_tracking inactive for userId=${userId}`);
      return res.status(200).send('OK');
    }
    userTwilioNumber = row.twilio_number;
    if (!userForwardTo) userForwardTo = row.forward_to;

    if (!userTwilioNumber) {
      console.error(`[conf-status] No twilio_number for userId=${userId}`);
      return res.status(200).send('OK');
    }
  } catch (err) {
    console.error('[conf-status] Failed to fetch call_tracking:', err.message);
    return res.status(200).send('OK');
  }

  const identity = userId.replace(/[^a-zA-Z0-9_-]/g, '_');

  const joinConferenceTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference startConferenceOnEnter="true" endConferenceOnExit="false" beep="false">${confName}</Conference>
  </Dial>
</Response>`;

  // 1. Dial the app client. 20s timeout — if no answer, app-status triggers mobile fallback.
  let appDialedOk = false;
  try {
    const appCall = await client.calls.create({
      to: `client:${identity}`,
      from: userTwilioNumber,
      twiml: joinConferenceTwiml,
      statusCallback:
        `${appUrl}/api/calls/app-status` +
        `?userId=${encodeURIComponent(userId)}` +
        `&confName=${encodeURIComponent(confName)}` +
        `&forwardTo=${encodeURIComponent(userForwardTo || '')}` +
        `&callerNumber=${encodeURIComponent(callerNumber || '')}` +
        `&customerName=${encodeURIComponent(customerName || '')}` +
        `&twilioNumber=${encodeURIComponent(userTwilioNumber)}`,
      statusCallbackMethod: 'POST',
      statusCallbackEvent: ['completed', 'no-answer', 'busy', 'failed'],
      timeout: 20,
    });
    appDialedOk = true;
    console.log(
      `[conf-status] DIAL app client=${identity} from=${userTwilioNumber} conf=${confName} sid=${appCall.sid}`
    );
  } catch (err) {
    console.error(
      `[conf-status] DIAL APP FAILED client=${identity}:`,
      err.message,
      err.code || ''
    );
  }

  // 2. If app dial failed and mobile is set, dial mobile immediately as fallback
  if (!appDialedOk && userForwardTo) {
    try {
      const mobileCall = await client.calls.create({
        to: userForwardTo,
        from: userTwilioNumber,
        twiml: joinConferenceTwiml,
        timeout: 30,
      });
      console.log(
        `[conf-status] DIAL mobile=${userForwardTo} from=${userTwilioNumber} conf=${confName} sid=${mobileCall.sid}`
      );
    } catch (mobileErr) {
      console.error(
        `[conf-status] DIAL MOBILE FAILED to=${userForwardTo}:`,
        mobileErr.message,
        mobileErr.code || ''
      );
    }
  }

  // All async work done — safe to respond now
  return res.status(200).send('OK');
}
