// /api/auth/verify.js
//
// Domain-aligned redirect wrapper for Supabase auth email links.
//
// Why this exists: Supabase's default confirmation link points at the bare
// project URL (xgygnthsjihrrqwscjbf.supabase.co), which does NOT match the
// sender domain (tradespa.co.uk). A sender/link domain mismatch is a textbook
// phishing signal and was getting password-reset emails content-filtered to
// Junk by Microsoft (observed SCL 5, dest:J). This endpoint lets the email link
// live on tradespa.co.uk (same domain as the sender) and then forwards to
// Supabase's /auth/v1/verify, which performs the actual token verification
// exactly as before. The user-facing flow is unchanged: one extra invisible hop.

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://xgygnthsjihrrqwscjbf.supabase.co";
const SITE_URL = "https://www.tradespa.co.uk";

// Auth verification types we accept. Guards against junk values in the URL.
const ALLOWED_TYPES = new Set([
  "recovery",
  "signup",
  "email",
  "email_change",
  "magiclink",
  "invite",
]);

// Where to land the user after verification, per type. Mirrors the redirect_to
// values the app already relies on (e.g. ?recovery=1 drives the reset UI).
function defaultRedirect(type) {
  if (type === "recovery") return SITE_URL + "/?recovery=1";
  return SITE_URL + "/";
}

// Only allow redirect targets on our own domain. Prevents this public endpoint
// from being abused as an open redirect.
function safeRedirect(candidate, type) {
  if (!candidate) return defaultRedirect(type);
  try {
    const host = new URL(candidate).hostname.toLowerCase();
    if (host === "www.tradespa.co.uk" || host === "tradespa.co.uk") {
      return candidate;
    }
  } catch (_) {
    // not a valid URL, fall through to the safe default
  }
  return defaultRedirect(type);
}

export default function handler(req, res) {
  try {
    const q = req.query || {};
    const token = q.token;
    const type = q.type ? String(q.type) : "";
    const redirectTo = q.redirect_to;

    // Bad or incomplete link: send them to the app rather than showing an error.
    if (!token || !type || !ALLOWED_TYPES.has(type)) {
      res.writeHead(302, { Location: SITE_URL + "/" });
      res.end();
      return;
    }

    const redirect = safeRedirect(redirectTo, type);

    const target =
      SUPABASE_URL +
      "/auth/v1/verify" +
      "?token=" + encodeURIComponent(String(token)) +
      "&type=" + encodeURIComponent(type) +
      "&redirect_to=" + encodeURIComponent(redirect);

    res.writeHead(302, {
      Location: target,
      "Cache-Control": "no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
    });
    res.end();
  } catch (_) {
    res.writeHead(302, { Location: SITE_URL + "/" });
    res.end();
  }
}
