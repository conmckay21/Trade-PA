// api/lib/apns.js
// Apple Push Notification service (APNs) sender for native iOS Capacitor apps.
//
// Uses Apple's HTTP/2 APNs API directly with a JWT signed by our .p8 auth key.
// No external dependencies — Node's built-in `crypto` (ES256 signing) and
// `http2` (the protocol APNs requires) are sufficient.
//
// Why this exists: @capacitor/push-notifications on iOS returns raw APNs
// device tokens, not FCM tokens. firebase-admin cannot send to raw APNs
// tokens. So iOS push goes through this module instead of api/lib/fcm.js.
//
// Required env vars:
//   APNS_AUTH_KEY    — full .p8 file contents (including BEGIN/END markers)
//   APNS_KEY_ID      — 10-char key ID from Apple Developer (e.g. TXF9VF6Y5M)
//   APNS_TEAM_ID     — 10-char team ID from Apple Developer (e.g. FM5UY8KLD6)
//   APNS_BUNDLE_ID   — app bundle ID (e.g. uk.co.tradespa.app)
//   APNS_PRODUCTION  — 'true' for App Store builds, 'false' for sandbox/TestFlight

import { createSign } from "node:crypto";
import { connect } from "node:http2";

// ---------------------------------------------------------------------------
// JWT signing (ES256, cached for 50 minutes per warm function instance)
// ---------------------------------------------------------------------------

let cachedJwt = null;
let cachedJwtExpiresAt = 0;

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

function normalizeKey(raw) {
  if (!raw) return raw;
  let key = raw;
  // Some env UIs convert real newlines to literal "\n" — undo it
  if (key.includes("\\n")) key = key.replace(/\\n/g, "\n");
  // Normalise CRLF/CR → LF
  key = key.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // Strip surrounding quotes if the UI added them
  if ((key.startsWith('"') && key.endsWith('"')) ||
      (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  // Trim leading/trailing whitespace (but preserve internal newlines)
  key = key.replace(/^\s+/, "").replace(/\s+$/, "");
  // Ensure trailing newline — OpenSSL is fussy about this
  if (!key.endsWith("\n")) key += "\n";
  return key;
}

function getPrivateKey() {
  // Prefer the base64-encoded form — single-line values survive every env
  // UI without mangled newlines. Fall back to raw PEM for legacy setups.
  if (process.env.APNS_AUTH_KEY_B64) {
    try {
      return Buffer.from(process.env.APNS_AUTH_KEY_B64.trim(), "base64").toString("utf8");
    } catch (err) {
      throw new Error("APNS_AUTH_KEY_B64 could not be base64-decoded");
    }
  }
  return normalizeKey(process.env.APNS_AUTH_KEY);
}

function buildJwt() {
  const privateKey = getPrivateKey();
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  if (!privateKey || !keyId || !teamId) {
    throw new Error("APNs env vars missing: APNS_AUTH_KEY, APNS_KEY_ID, APNS_TEAM_ID required");
  }
  // Sanity check the PEM structure — fail fast with a useful message if mangled
  if (!privateKey.includes("BEGIN PRIVATE KEY") || !privateKey.includes("END PRIVATE KEY")) {
    throw new Error("APNS_AUTH_KEY missing BEGIN/END PRIVATE KEY markers — check env var formatting on Vercel");
  }

  const header = b64url(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }));
  const payload = b64url(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) }));
  const signingInput = `${header}.${payload}`;

  // Critical: dsaEncoding 'ieee-p1363' produces the raw r||s format JWT/JOSE
  // expects. Node's default is DER which APNs rejects with InvalidProviderToken.
  const signer = createSign("SHA256");
  signer.update(signingInput);
  const signature = signer.sign({ key: privateKey, dsaEncoding: "ieee-p1363" });

  return `${signingInput}.${b64url(signature)}`;
}

function getJwt() {
  const now = Date.now();
  if (cachedJwt && cachedJwtExpiresAt > now) return cachedJwt;
  cachedJwt = buildJwt();
  cachedJwtExpiresAt = now + 50 * 60 * 1000; // 50 min — APNs accepts up to 1 hr
  return cachedJwt;
}

// ---------------------------------------------------------------------------
// Send a single push to APNs
// ---------------------------------------------------------------------------

/**
 * Send a push notification to an iOS device via APNs.
 *
 * @param {string} deviceToken — raw APNs device token (64 hex chars)
 * @param {object} payload — { title, body, url, type, tag }
 * @returns {Promise<object>} { success, stale?, error?, code? }
 */
export async function sendApns(deviceToken, payload) {
  if (!deviceToken) {
    return { success: false, error: "missing device token" };
  }

  const bundleId = process.env.APNS_BUNDLE_ID;
  if (!bundleId) {
    return { success: false, error: "APNS_BUNDLE_ID env var not set" };
  }

  const production = (process.env.APNS_PRODUCTION ?? "true") !== "false";
  const host = production
    ? "https://api.push.apple.com"
    : "https://api.sandbox.push.apple.com";

  let jwt;
  try {
    jwt = getJwt();
  } catch (err) {
    return { success: false, error: `jwt build failed: ${err.message}` };
  }

  // APNs alert payload — `aps` is the standard envelope, custom data goes
  // at top level alongside it (Capacitor surfaces those as notification.data).
  const apnsPayload = {
    aps: {
      alert: {
        title: payload.title || "",
        body: payload.body || "",
      },
      sound: "default",
      "mutable-content": 1,
    },
    url: payload.url || "/",
    type: payload.type || "general",
    tag: payload.tag || "trade-pa",
  };

  return new Promise((resolve) => {
    const client = connect(host);
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      try { client.close(); } catch {}
      resolve(result);
    };

    client.on("error", (err) => {
      finish({ success: false, error: `http2 client error: ${err.message}` });
    });

    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "apns-expiration": "0",
    });

    let status;
    const bodyChunks = [];

    req.on("response", (headers) => {
      status = headers[":status"];
    });

    req.on("data", (chunk) => bodyChunks.push(chunk));

    req.on("end", () => {
      const bodyStr = Buffer.concat(bodyChunks).toString("utf8");
      let parsed = null;
      try { parsed = bodyStr ? JSON.parse(bodyStr) : null; } catch {}

      if (status === 200) {
        return finish({ success: true });
      }

      const reason = parsed?.reason || "Unknown";
      const staleReasons = new Set(["BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic"]);
      const stale = status === 410 || staleReasons.has(reason);

      finish({
        success: false,
        stale,
        error: `${status} ${reason}`,
        code: reason,
      });
    });

    req.on("error", (err) => {
      finish({ success: false, error: `request error: ${err.message}` });
    });

    req.setTimeout(10000, () => {
      finish({ success: false, error: "request timeout (10s)" });
    });

    req.write(JSON.stringify(apnsPayload));
    req.end();
  });
}
