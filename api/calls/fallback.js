// api/calls/fallback.js
// Called by Twilio via the <Dial> action URL when the app client doesn't answer within 30s
// Falls back to ringing the user's real mobile number

export default async function handler(req, res) {
  const { forwardTo, callerNumber } = req.query;
  const dialStatus = req.body?.DialCallStatus;

  // If the call was somehow answered or completed in the app, just hang up
  if (dialStatus === "completed" || dialStatus === "answered") {
    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`);
  }

  // No mobile fallback configured
  if (!forwardTo) {
    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-GB">Sorry, we cannot take your call right now. Please try again later.</Say>
  <Hangup/>
</Response>`);
  }

  // Ring the real mobile
  res.setHeader("Content-Type", "text/xml");
  return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerNumber || ""}" timeout="30">
    <Number>${forwardTo}</Number>
  </Dial>
</Response>`);
}
