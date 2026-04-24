// api/lib/sentry.js
// Shared Sentry wrapper for Trade PA serverless API routes.
//
// Usage:
//   import { withSentry } from "../lib/sentry.js";
//   async function handler(req, res) { ... }
//   export default withSentry(handler);
//
// What it does:
//   1. Initialises @sentry/node once per cold-start (idempotent — safe to call
//      from many routes that all hit the same warm container).
//   2. Wraps the handler in a try/catch. Any thrown error is captured to
//      Sentry with route + method + user (if extractable) tagged, then
//      re-thrown so Vercel's normal 500 handling still runs.
//   3. Adds breadcrumbs for the request itself so the Sentry timeline shows
//      which route fired before the error.
//
// Environment:
//   SENTRY_DSN — required for backend Sentry to be active. If absent, the
//   wrapper becomes a no-op and routes work normally without instrumentation.
//   Use the same DSN as VITE_SENTRY_DSN (set as a SEPARATE env var because
//   anything VITE_-prefixed gets exposed to the client bundle).
//
// Auth-aware: if the request has an Authorization: Bearer <jwt> header (the
// pattern used by /api/claude.js and others), we attempt to decode the JWT
// payload (no signature check — purely for tagging) so the captured event
// links to the right user. We never store the token itself.

import * as Sentry from "@sentry/node";

let initialised = false;

function ensureInit() {
  if (initialised) return;
  if (!process.env.SENTRY_DSN) {
    // No DSN configured — leave Sentry inactive. Wrapper becomes a no-op.
    initialised = true;
    return;
  }
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV || "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA || undefined,
    // Error monitoring only — matches the frontend Sentry policy of no
    // performance/profiling/replay traffic. Keeps event volume + cost low.
    tracesSampleRate: 0,
    profilesSampleRate: 0,
    // Don't send default PII (IP, headers); we tag user explicitly below
    // when we can identify them.
    sendDefaultPii: false,
  });
  initialised = true;
}

// Best-effort JWT payload decode — purely for `user_id` tagging on events.
// We don't verify the signature because Supabase already verified it
// upstream (or will reject the request). Returns null on any failure.
function decodeJwtPayload(authHeader) {
  try {
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    const token = authHeader.slice(7);
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf-8"));
    return payload;
  } catch { return null; }
}

export function withSentry(handler, opts = {}) {
  const routeName = opts.routeName || handler.name || "unknown";

  return async function sentryWrappedHandler(req, res) {
    ensureInit();

    // No-op fast path when DSN isn't set — preserves identical behaviour
    // to running the handler directly.
    if (!process.env.SENTRY_DSN) {
      return handler(req, res);
    }

    return Sentry.withScope(async (scope) => {
      scope.setTag("route", routeName);
      scope.setTag("method", req.method || "UNKNOWN");
      scope.setContext("request", {
        url: req.url,
        method: req.method,
        // headers intentionally limited — auth header redacted, no cookies
        userAgent: req.headers?.["user-agent"] || null,
      });

      // Tag the user if we can extract one from Bearer auth.
      const jwt = decodeJwtPayload(req.headers?.authorization);
      if (jwt?.sub) {
        scope.setUser({ id: jwt.sub, email: jwt.email });
      }

      Sentry.addBreadcrumb({
        category: "http",
        message: `${req.method} ${routeName}`,
        level: "info",
      });

      try {
        return await handler(req, res);
      } catch (err) {
        Sentry.captureException(err);
        // Flush briefly so the event makes it out before the serverless
        // container is frozen. 2s is a sane upper bound for a single event.
        await Sentry.flush(2000).catch(() => {});
        throw err;
      }
    });
  };
}

// Convenience: capture a non-fatal error from inside a handler without
// propagating it. Use for "we recovered, but Sentry should know" cases.
export function captureNonFatal(err, context = {}) {
  ensureInit();
  if (!process.env.SENTRY_DSN) return;
  Sentry.withScope((scope) => {
    if (context.tags) Object.entries(context.tags).forEach(([k, v]) => scope.setTag(k, v));
    if (context.extra) scope.setContext("extra", context.extra);
    if (context.user) scope.setUser(context.user);
    Sentry.captureException(err);
  });
}

// Convenience: capture a string message (not an Error). Useful for
// "shouldn't happen" code paths that don't throw.
export function captureMessage(msg, level = "warning", context = {}) {
  ensureInit();
  if (!process.env.SENTRY_DSN) return;
  Sentry.withScope((scope) => {
    scope.setLevel(level);
    if (context.tags) Object.entries(context.tags).forEach(([k, v]) => scope.setTag(k, v));
    if (context.extra) scope.setContext("extra", context.extra);
    Sentry.captureMessage(msg);
  });
}
