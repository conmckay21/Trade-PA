// api/calls/conf-status.js
// Conference status webhook — fires on participant join/leave events
// When caller joins (1 participant) → dial app client into conference
// If app doesn't answer after 20s → dial mobile into conference instead
// This keeps Twilio as the bridge so recording always works

import twilio from 'twilio';
import { withSentry } from "../lib/sentry.js";

async function handler(req, res) {
  const { userId, callerNumber, customerName, confName, forwardTo } = req.query;
  const event = req.body?.StatusCallbackEvent;
  const participantCount = parseInt(req.body?.ParticipantCount || '0');

  res.status(200).send('OK'); // Always ACK quickly

  // Only act when caller first joins (count goes to 1)
  if (event !== 'participant-join' || participantCount !== 1) return;

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  const appUrl = process.env.APP_URL;
  const identity = userId.replace(/[^a-zA-Z0-9_-]/g, '_');

  // TwiML to put app client into the same conference
  const appClientTwiml = `<?xml version="1.0" encoding="UTF-8"?>
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

  // TwiML to put mobile into the conference (used as fallback)
  const mobileTwiml = forwardTo ? `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference
      startConferenceOnEnter="true"
      endConferenceOnExit="false"
      beep="false">
      ${confName}
    </Conference>
  </Dial>
</Response>` : null;

  try {
    // 1. Dial the app client into the conference immediately
    const appCall = await client.calls.create({
      to: `client:${identity}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      twiml: appClientTwiml,
      // Pass caller info to the app client
      statusCallback: `${appUrl}/api/calls/app-status?userId=${encodeURIComponent(userId)}&confName=${encodeURIComponent(confName)}&forwardTo=${encodeURIComponent(forwardTo || '')}&callerNumber=${encodeURIComponent(callerNumber)}&customerName=${encodeURIComponent(customerName)}`,
      statusCallbackMethod: 'POST',
      statusCallbackEvent: ['completed', 'no-answer', 'busy', 'failed'],
      timeout: 20, // 20 seconds for app to answer before mobile fallback fires
    });

    console.log(`Dialled app client ${identity} into conf ${confName} — SID: ${appCall.sid}`);
  } catch (err) {
    console.error('Failed to dial app client:', err.message);
    // If dialling app fails, go straight to mobile if available
    if (forwardTo && mobileTwiml) {
      try {
        await client.calls.create({
          to: forwardTo,
          from: process.env.TWILIO_PHONE_NUMBER,
          twiml: mobileTwiml,
          timeout: 30,
        });
        console.log(`Fallback: dialled mobile ${forwardTo} into conf ${confName}`);
      } catch (mobileErr) {
        console.error('Mobile fallback failed:', mobileErr.message);
      }
    }
  }
}

export default withSentry(handler, { routeName: "calls/conf-status" });
