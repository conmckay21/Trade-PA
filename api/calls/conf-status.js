// api/calls/conf-status.js
// Conference status webhook — fires on participant join/leave events.
// When the caller joins (1st participant) → look up the user's own Twilio
// number from call_tracking, then dial app client into the conference.
// On failure → dial mobile (forward_to) into the conference as fallback.
//
// IMPORTANT: do NOT call res.send() before the Twilio API work completes.
// Vercel serverless tears the function down once the response finalises,
// which kills the in-flight `client.calls.create()` call. Twilio waits up
// to 15s for our response, so it's safe to do the work first.

import twilio from 'twilio';

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;

export default async function handler(req, res) {
  const { userId, callerNumber, customerName, confName, forwardTo } = req.query;
  const event = req.body?.StatusCallbackEvent;
  const participantCount = parseInt(req.body?.ParticipantCount || '0', 10);

  console.log(
    `[conf-status] event=${event} participants=${participantCount} conf=${confName} userId=${userId}`
  );

  // Only act when the caller first joins (participant count goes to 1).
  // All other events (leave, conference-start/end) we just ack.
  if (event !== 'participant-join' || participantCount !== 1) {
    return res.status(200).send('OK');
  }

  // Validate Twilio account credentials
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
    return res.status(200).send('OK'); // ack so Twilio doesn't retry forever
  }

  if (!userId) {
    console.error('[conf-status] No userId in query — cannot look up Twilio number');
    return res.status(200).send('OK');
  }

  // Look up THIS user's Twilio number (multi-tenant — every user has their own)
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
      console.log(`[conf-status] call_tracking inactive for userId=${userId} — skipping dial`);
      return res.status(200).send('OK');
    }
    userTwilioNumber = row.twilio_number;
    if (!userForwardTo) userForwardTo = row.forward_to;

    if (!userTwilioNumber) {
      console.error(`[conf-status] call_tracking row has no twilio_number for userId=${userId}`);
      return res.status(200).send('OK');
    }
  } catch (err) {
    console.error('[conf-status] Failed to fetch call_tracking:', err.message);
    return res.status(200).send('OK');
  }

  const client = twilio(accountSid, authToken);
  const identity = userId.replace(/[^a-zA-Z0-9_-]/g, '_');

  // TwiML to put a leg into the same conference room
  const joinConferenceTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference startConferenceOnEnter="true" endConferenceOnExit="false" beep="false">${confName}</Conference>
  </Dial>
</Response>`;

  // 1. Dial the app client into the conference. 20s timeout — if no answer, mobile fallback.
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
      `[conf-status] Dialled app client ${identity} from ${userTwilioNumber} → conf ${confName} (SID: ${appCall.sid})`
    );
  } catch (err) {
    console.error(
      `[conf-status] Failed to dial app client ${identity}:`,
      err.message,
      err.code || ''
    );
  }

  // 2. If app dial failed and we have a mobile, dial that immediately as fallback
  if (!appDialedOk && userForwardTo) {
    try {
      const mobileCall = await client.calls.create({
        to: userForwardTo,
        from: userTwilioNumber,
        twiml: joinConferenceTwiml,
        timeout: 30,
      });
      console.log(
        `[conf-status] Fallback: dialled mobile ${userForwardTo} from ${userTwilioNumber} → conf ${confName} (SID: ${mobileCall.sid})`
      );
    } catch (mobileErr) {
      console.error(
        `[conf-status] Mobile fallback to ${userForwardTo} also failed:`,
        mobileErr.message,
        mobileErr.code || ''
      );
    }
  }

  // Now respond to Twilio. Safe to send because all async work is done.
  return res.status(200).send('OK');
}
