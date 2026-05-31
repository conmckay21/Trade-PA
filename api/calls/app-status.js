// api/calls/app-status.js
// Fires when the app client call leg completes/fails/times out
// If app didn't answer → dial mobile into conference as fallback
// Twilio stays in the bridge so recording continues regardless

import twilio from 'twilio';
import { withSentry } from "../lib/sentry.js";
import { checkTwilioSignature } from "../lib/twilio-verify.js";

async function handler(req, res) {
  const { userId, confName, forwardTo, callerNumber, customerName, callerCallSid } = req.query;
  checkTwilioSignature(req, "calls/app-status"); // monitor mode: logs only
  const callStatus = req.body?.CallStatus;

  res.status(200).send('OK');

  // App answered — nothing to do, conference is running
  if (callStatus === 'in-progress' || callStatus === 'completed') return;

  // App didn't answer (no-answer, busy, failed) → send the caller to Trade PA
  // voicemail (B: no mobile forward). We pull the caller's leg out of the
  // conference and into /api/calls/voicemail, which records + transcribes.
  if (!callerCallSid) {
    console.log(`App ${callStatus} for conf ${confName} — no callerCallSid, cannot route to voicemail`);
    return;
  }

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  try {
    await client.calls(callerCallSid).update({
      method: 'POST',
      url:
        `${process.env.APP_URL}/api/calls/voicemail` +
        `?userId=${encodeURIComponent(userId || '')}` +
        `&callerNumber=${encodeURIComponent(callerNumber || '')}` +
        `&customerName=${encodeURIComponent(customerName || '')}`,
    });
    console.log(`App ${callStatus} — caller ${callerCallSid} sent to voicemail`);
  } catch (err) {
    console.error(`VMFAIL code=${err.code || 'none'} status=${err.status || 'none'} sid=${callerCallSid} :: ${err.message}`);
  }
}

export default withSentry(handler, { routeName: "calls/app-status" });
