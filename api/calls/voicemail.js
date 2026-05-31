// api/calls/voicemail.js
// Trade PA voicemail. Reached when the app leg is not answered (see
// app-status.js / conf-status.js). Plays a greeting, records the caller's
// message, and sends the recording to recording.js — the same transcription +
// action pipeline as a normal call (recording.js reads ?voicemail=true).
import { withSentry } from "../lib/sentry.js";
import { checkTwilioSignature } from "../lib/twilio-verify.js";

async function handler(req, res) {
  checkTwilioSignature(req, "calls/voicemail"); // monitor mode: logs only
  const { userId, callerNumber, customerName } = req.query;
  const appUrl = process.env.APP_URL;

  const recordingCallback = [
    `${appUrl}/api/calls/recording`,
    `?userId=${encodeURIComponent(userId || "")}`,
    `&callerNumber=${encodeURIComponent(callerNumber || "")}`,
    `&customerName=${encodeURIComponent(customerName || "")}`,
    `&voicemail=true`,
  ].join("").replace(/&/g, "&amp;");

  res.setHeader("Content-Type", "text/xml");
  return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-GB">Sorry, we can't take your call right now. Please leave a message after the tone and we'll get back to you as soon as we can.</Say>
  <Record maxLength="120" playBeep="true" timeout="5" recordingStatusCallback="${recordingCallback}" recordingStatusCallbackMethod="POST" transcribe="false"/>
  <Say voice="alice" language="en-GB">Thank you. Goodbye.</Say>
  <Hangup/>
</Response>`);
}

export default withSentry(handler, { routeName: "calls/voicemail" });
