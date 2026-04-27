// api/calls/token.js
//
// Mints a Twilio Voice access token for the authenticated user.
//
// SECURITY (forensic audit Finding 2.1, fixed 27 Apr 2026):
// Previously this endpoint accepted `userId` from the request body without
// verifying it matched the calling user. Anyone with API access could
// request a token for ANY user — receive their incoming calls, initiate
// outgoing calls billed to their Twilio account.
// Now: identity is derived from the verified JWT only. Body is ignored.

import twilio from "twilio";
import { withSentry } from "../lib/sentry.js";
import { requireAuth } from "../lib/auth.js";

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const userId = await requireAuth(req, res);
  if (!userId) return; // 401 already sent

  const { AccessToken } = twilio.jwt;
  const { VoiceGrant } = AccessToken;

  // Sanitize the verified userId for use as a Twilio identity (alnum + _ -)
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

    return res.status(200).json({ token: token.toJwt(), identity });
  } catch (err) {
    console.error("Token generation error:", err.message);
    return res.status(500).json({ error: "Failed to generate token" });
  }
}

export default withSentry(handler, { routeName: "calls/token" });
