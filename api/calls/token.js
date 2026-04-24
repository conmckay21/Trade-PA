// api/calls/token.js
import twilio from "twilio";
import { withSentry } from "../lib/sentry.js";

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: "userId required" });

  const { AccessToken } = twilio.jwt;
  const { VoiceGrant } = AccessToken;

  const identity = userId.replace(/[^a-zA-Z0-9_-]/g, "_");

  try {
    const token = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_API_KEY,
      process.env.TWILIO_API_SECRET,
      { identity, ttl: 3600, region: "ie1" }
    );

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID,
      incomingAllow: true,
    });

    token.addGrant(voiceGrant);

    console.log(`✓ Token generated for identity: ${identity} region: ie1`);
    return res.status(200).json({ token: token.toJwt(), identity });
  } catch (err) {
    console.error("Token generation error:", err.message);
    return res.status(500).json({ error: "Failed to generate token" });
  }
}

export default withSentry(handler, { routeName: "calls/token" });
