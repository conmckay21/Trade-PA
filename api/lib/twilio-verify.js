// api/lib/twilio-verify.js
// MONITOR MODE helper. Logs whether a request carries a valid Twilio signature,
// without rejecting anything. Twilio signs each webhook over the exact public
// URL it called; behind Vercel that URL can be reconstructed more than one way,
// so we try a couple and log which validates. Once logs show valid=true for
// real traffic, switch callers to reject when this returns false.
import twilio from "twilio";

export function checkTwilioSignature(req, routeName) {
  try {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const sig = req.headers["x-twilio-signature"];
    if (!authToken || !sig) {
      console.warn(`[twilio-verify:${routeName}] missing ${!authToken ? "auth token" : "signature header"}`);
      return false;
    }
    const params =
      req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body) ? req.body : {};
    const host = req.headers["x-forwarded-host"] || req.headers.host || "";
    const url = req.url || "";
    const candidates = [
      `https://${host}${url}`,
      `${process.env.APP_URL || ""}${url}`,
    ];
    let anyValid = false;
    for (const candidate of candidates) {
      let ok = false;
      try {
        ok = twilio.validateRequest(authToken, sig, candidate, params);
      } catch (e) {
        /* ignore a single candidate failing to parse */
      }
      console.log(`[twilio-verify:${routeName}] valid=${ok} url=${candidate}`);
      if (ok) anyValid = true;
    }
    return anyValid;
  } catch (e) {
    console.error(`[twilio-verify:${routeName}] error: ${e.message}`);
    return false;
  }
}
