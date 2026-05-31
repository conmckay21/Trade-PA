// api/calls/conf-status.js
// Conference status webhook — fires on conference + participant events.
//
// Architecture:
//   - Caller rings Twilio number → /api/calls/incoming returns TwiML that
//     puts caller into a named conference, with this URL as status callback.
//   - When caller joins (participant-join) → we dial the app client into
//     the conference. If app dial returns no-answer/busy/failed within
//     20 seconds → app-status.js fires the mobile fallback dial.
//
// Idempotency:
//   When app/mobile later joins the conference, that triggers another
//   participant-join event. We use a module-level Set keyed by ConferenceSid
//   to ensure we only dial once per conference.
//
// KNOWN LIMITATION (7 May 2026):
//   In-app PWA inbound ringing currently fails — Twilio Voice JS SDK
//   silently auto-rejects incoming calls with "no-answer" within 1 second,
//   before invoking device.on("incoming") in JavaScript. Root cause not
//   yet identified. The mobile fallback dial activates after the 20s app
//   timeout, so customers DO reach the user — just on their mobile rather
//   than in-app. Tracking for later resolution.

import twilio from 'twilio';

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;

// Module-level idempotency tracking (survives warm function reuse)
if (!global.__tradepa_dialedConferences) {
  global.__tradepa_dialedConferences = new Set();
}
const dialedConferences = global.__tradepa_dialedConferences;

export default async function handler(req, res) {
  const { userId, callerNumber, customerName, confName, forwardTo } = req.query;
  const event = req.body?.StatusCallbackEvent;
  const conferenceSid = req.body?.ConferenceSid;
  const callSid = req.body?.CallSid;

  console.log(
    `[conf-status] >>> event=${event} confSid=${conferenceSid} callSid=${callSid} userId=${userId}`
  );

  // Only act on participant-join events
  if (event !== 'participant-join') {
    return res.status(200).send('OK');
  }

  // Idempotency
  if (!conferenceSid) {
    console.error('[conf-status] missing ConferenceSid');
    return res.status(200).send('OK');
  }
  if (dialedConferences.has(conferenceSid)) {
    console.log(`[conf-status] already dialed conf=${conferenceSid}, skip`);
    return res.status(200).send('OK');
  }
  dialedConferences.add(conferenceSid);
  setTimeout(() => dialedConferences.delete(conferenceSid), 5 * 60 * 1000);

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
    console.error(`[conf-status] !!! ENV MISSING: ${missing.join(', ')}`);
    return res.status(200).send('OK');
  }

  if (!userId) {
    console.error('[conf-status] !!! no userId in query');
    return res.status(200).send('OK');
  }

  // Look up THIS user's Twilio number
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
      console.error(`[conf-status] !!! no call_tracking row for ${userId}`);
      return res.status(200).send('OK');
    }
    if (row.active === false) {
      return res.status(200).send('OK');
    }
    userTwilioNumber = row.twilio_number;
    if (!userForwardTo) userForwardTo = row.forward_to;
    if (!userTwilioNumber) {
      console.error(`[conf-status] !!! no twilio_number for ${userId}`);
      return res.status(200).send('OK');
    }
  } catch (err) {
    console.error('[conf-status] !!! FETCH FAILED:', err.message);
    return res.status(200).send('OK');
  }

  // Match the Device's region. Tokens are minted for ie1 and the number's
  // active region is Ireland, so the inbound call and its conference live in
  // ie1. Creating this dial-in on the default us1 region put the leg in a
  // different region, where it could not reach the ie1-registered client and
  // would have joined a separate us1 conference of the same name, leaving the
  // caller alone on hold. Creating it on ie1 reaches both the client and the
  // same conference.
  const client = twilio(accountSid, authToken);

  const identity = userId.replace(/[^a-zA-Z0-9_-]/g, '_');

  const joinConferenceTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference startConferenceOnEnter="true" endConferenceOnExit="false" beep="false">${confName}</Conference>
  </Dial>
</Response>`;

  // Dial the app client. 20s timeout — if no answer, app-status.js fires mobile fallback.
  let appDialedOk = false;
  try {
    // App leg parameters. We present the REAL caller's number as the caller ID
    // (set below) so the phone and the VoIP push -> CallKit show who is calling
    // instead of our own Twilio number. statusCallbackEvent uses only
    // 'completed' because the Calls API rejects no-answer/busy/failed as event
    // names (error 21626); 'completed' delivers the final CallStatus that
    // app-status.js inspects to decide the mobile fallback.
    const appLegParams = {
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
        `&twilioNumber=${encodeURIComponent(userTwilioNumber)}` +
        `&callerCallSid=${encodeURIComponent(callSid || '')}`,
      statusCallbackMethod: 'POST',
      statusCallbackEvent: ['completed'],
      timeout: 20,
    };
    // Use the caller's number as caller ID when it is a valid E.164-ish value.
    // Twilio normally allows an arbitrary From on a client leg; if it rejects
    // this one we retry with the Twilio number so app dialling never breaks.
    const callerIdDigits = (callerNumber || '').replace(/[^\d+]/g, '');
    const useCallerId = /^\+?\d{7,15}$/.test(callerIdDigits);
    let appCall;
    try {
      appCall = await client.calls.create({ ...appLegParams, from: useCallerId ? callerIdDigits : userTwilioNumber });
    } catch (err) {
      if (useCallerId) {
        console.warn(`[conf-status] app dial with caller ID rejected (code=${err.code || 'none'}); retrying with Twilio number`);
        appCall = await client.calls.create(appLegParams);
      } else {
        throw err;
      }
    }
    appDialedOk = true;
    console.log(`[conf-status] <<< DIAL APP OK sid=${appCall.sid}`);
  } catch (err) {
    console.error(
      `[conf-status] !!! DIAL APP ERROR: ${err.message} code=${err.code || 'none'}`
    );
  }

  // If the app dial could not even be created, send the caller to voicemail now
  // (B: no mobile forward — the app rings, otherwise Trade PA voicemail).
  if (!appDialedOk && callSid) {
    try {
      await client.calls(callSid).update({
        method: 'POST',
        url:
          `${appUrl}/api/calls/voicemail` +
          `?userId=${encodeURIComponent(userId)}` +
          `&callerNumber=${encodeURIComponent(callerNumber || '')}` +
          `&customerName=${encodeURIComponent(customerName || '')}`,
      });
      console.log(`[conf-status] app dial not created — caller ${callSid} sent to voicemail`);
    } catch (vmErr) {
      console.error(`[conf-status] !!! VOICEMAIL REDIRECT ERROR: ${vmErr.message}`);
    }
  }

  return res.status(200).send('OK');
}
