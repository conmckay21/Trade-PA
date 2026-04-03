// api/calls/token.js
// Generates a Twilio Access Token with Voice grant for the browser SDK
// Called on login if user has call tracking active — and on token expiry refresh

import twilio from "twilio";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: "userId required" });

  const { AccessToken } = twilio.jwt;
  const { VoiceGrant } = AccessToken;

  try {
    const token = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_API_KEY,
      process.env.TWILIO_API_SECRET,
      { identity: userId, ttl: 3600 }
    );

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID,
      incomingAllow: true,
    });

    token.addGrant(voiceGrant);

    return res.status(200).json({ token: token.toJwt(), identity: userId });
  } catch (err) {
    console.error("Token generation error:", err.message);
    return res.status(500).json({ error: "Failed to generate token" });
  }
}
