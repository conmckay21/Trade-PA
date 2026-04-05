// api/calls/app-status.js
// Fires when the app client call leg completes/fails/times out
// If app didn't answer → dial mobile into conference as fallback
// Twilio stays in the bridge so recording continues regardless

import twilio from 'twilio';

export default async function handler(req, res) {
  const { userId, confName, forwardTo, callerNumber, customerName } = req.query;
  const callStatus = req.body?.CallStatus;

  res.status(200).send('OK');

  // App answered — nothing to do, conference is running
  if (callStatus === 'in-progress' || callStatus === 'completed') return;

  // App didn't answer (no-answer, busy, failed) → ring mobile into conference
  if (!forwardTo) {
    console.log(`App ${callStatus} — no mobile fallback configured for user ${userId}`);
    return;
  }

  console.log(`App client ${callStatus} for conf ${confName} — dialling mobile ${forwardTo}`);

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  const mobileTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference
      startConferenceOnEnter="true"
      endConferenceOnExit="false"
      beep="false">
      ${confName}
    </Conference>
  </Dial>
</Response>`;

  try {
    await client.calls.create({
      to: forwardTo,
      from: process.env.TWILIO_PHONE_NUMBER,
      twiml: mobileTwiml,
      timeout: 30,
    });
    console.log(`Mobile ${forwardTo} dialled into conf ${confName} — recording continues`);
  } catch (err) {
    console.error('Mobile dial failed:', err.message);
  }
}
