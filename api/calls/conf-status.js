// api/calls/conf-status.js
// Conference status webhook — fires on conference + participant events.
//
// Architecture:
//   - Caller rings Twilio number → /api/calls/incoming returns TwiML that
//     puts caller into a named conference, with this URL as status callback.
//   - When caller joins (participant-join) → we dial the app client into
//     the conference. If app dial fails → mobile fallback.
//
// Idempotency:
//   When app/mobile later joins the conference, that triggers another
//   participant-join event. We use a module-level Set keyed by ConferenceSid
//   to ensure we only dial once per conference.
//
// REGION (added 7 May 2026):
//   The Twilio Node.js client defaults to US1 when no region is specified.
//   Our Devices register to IE1 (per token.js: region: "ie1"). Cross-region
//   call delivery to Voice SDK Clients fails silently with instant no-answer.
//   We MUST specify region: 'ie1' so the call is created in the same region
//   as where the Device is registered.
//
// Vercel gotcha: must NOT call res.send() before async work completes.

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
  const sequenceNumber = req.body?.SequenceNumber;

  console.log(
    `[conf-status] >>> event=${event} confSid=${conferenceSid} callSid=${callSid} seq=${sequenceNumber} userId=${userId}`
  );

  // Only act on participant-join events
  if (event !== 'participant-join') {
    console.log(`[conf-status] not a join event, skip`);
    return res.status(200).send('OK');
  }

  // Idempotency: skip if we've already dialed for this conference
  if (!conferenceSid) {
    console.error('[conf-status] missing ConferenceSid, cannot dedupe');
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

  console.log(`[conf-status] env ok, looking up call_tracking for ${userId}`);

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
      console.log(`[conf-status] call_tracking inactive for ${userId}`);
      return res.status(200).send('OK');
    }
    userTwilioNumber = row.twilio_number;
    if (!userForwardTo) userForwardTo = row.forward_to;
    if (!userTwilioNumber) {
      console.error(`[conf-status] !!! no twilio_number for ${userId}`);
      return res.status(200).send('OK');
    }
    console.log(
      `[conf-status] found number=${userTwilioNumber} forwardTo=${userForwardTo}`
    );
  } catch (err) {
    console.error('[conf-status] !!! FETCH FAILED:', err.message);
    return res.status(200).send('OK');
  }

  // CRITICAL: region must match where the Device is registered.
  // Without { region: 'ie1' }, calls.create() routes via US1 and the call
  // never reaches IE1-registered Devices — instant silent no-answer.
  const client = twilio(accountSid, authToken, {
    region: 'ie1',
    edge: 'dublin',
  });

  const identity = userId.replace(/[^a-zA-Z0-9_-]/g, '_');

  const joinConferenceTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference startConferenceOnEnter="true" endConferenceOnExit="false" beep="false">${confName}</Conference>
  </Dial>
</Response>`;

  // 1. Dial the app client. 20s timeout — if no answer, mobile fallback.
  let appDialedOk = false;
  console.log(
    `[conf-status] >>> DIALING client:${identity} from=${userTwilioNumber} (region=ie1)`
  );
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
    console.log(`[conf-status] <<< DIAL APP OK sid=${appCall.sid}`);
  } catch (err) {
    console.error(
      `[conf-status] !!! DIAL APP ERROR: ${err.message} code=${err.code || 'none'} status=${err.status || 'none'}`
    );
    if (err.moreInfo) console.error(`[conf-status] more info: ${err.moreInfo}`);
  }

  // 2. If app dial failed AND mobile is set, dial mobile immediately
  if (!appDialedOk && userForwardTo) {
    console.log(
      `[conf-status] >>> DIALING mobile=${userForwardTo} from=${userTwilioNumber}`
    );
    try {
      const mobileCall = await client.calls.create({
        to: userForwardTo,
        from: userTwilioNumber,
        twiml: joinConferenceTwiml,
        timeout: 30,
      });
      console.log(`[conf-status] <<< DIAL MOBILE OK sid=${mobileCall.sid}`);
    } catch (mobileErr) {
      console.error(
        `[conf-status] !!! DIAL MOBILE ERROR: ${mobileErr.message} code=${mobileErr.code || 'none'}`
      );
    }
  }

  return res.status(200).send('OK');
}
