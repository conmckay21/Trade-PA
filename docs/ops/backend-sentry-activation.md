# Backend Sentry — activation notes

Status: Code shipped 2026-04-24. **Inactive until `SENTRY_DSN` env var is set on Vercel.**

## What was added

1. `@sentry/node` added to top-level `package.json` dependencies.
2. New shared module `api/lib/sentry.js` with three exports:
   - `withSentry(handler, opts)` — wraps a serverless route handler. Captures any thrown error to Sentry tagged with route name, HTTP method, and (where extractable) the user from the Bearer auth header. Re-throws so Vercel's normal 500 handling still runs.
   - `captureNonFatal(err, context)` — for "we recovered, but Sentry should know" cases inside route logic.
   - `captureMessage(msg, level, context)` — for non-Error string events.
3. **All 52 API route handlers wrapped with `withSentry`** — every path under `api/` except the shared `api/lib/` modules. Includes:
   - **Cron** (3): `process-reminders`, `evening-briefing`, `check-ai-spend`
   - **Stripe** (10): both webhooks plus all subscription/portal/onboard/connect/checkout routes
   - **Voice pipeline** (3): `claude`, `transcribe`, `tts`
   - **Email** (5): `send-invoice-email`, `email`, `email-cron`, `email-check`, `error-report`
   - **Push notifications** (2): `push/send`, `push/subscribe`
   - **Twilio Calls** (9): all `calls/*` handlers
   - **Xero/QuickBooks integrations** (8): all `xero/*` and `quickbooks/*` routes
   - **OAuth callbacks** (4): both `auth/quickbooks/*` and `auth/xero/*` connect+callback
   - **Reminders** (1): `reminders/action`
   - **Misc** (7): `pdf`, `portal`, `calendar`, `distance`, `feedback`, `founding-slots`, `daily-automation`

## What you need to do to turn it on

1. **Set `SENTRY_DSN` env var on Vercel** (project: `trade-pa-id3s`).
   - Value: `https://4bff9ebffc8fb0beddd88fb87d507383@o4511248762273792.ingest.de.sentry.io/4511248766795856` (same DSN as `VITE_SENTRY_DSN` — the project DSN works for both frontend `@sentry/react` and backend `@sentry/node`).
   - **Why a separate var name?** Anything with the `VITE_` prefix gets bundled into the client. Backend env vars must NOT start with `VITE_`.
   - Set it for Production, Preview, and Development environments (or just Production if you'd rather only get prod errors).
2. **Run `npm install`** locally to pick up `@sentry/node`, then push. Vercel will install it automatically on deploy.
3. **Verify** — after the next deploy, deliberately trigger a 500 from a wrapped route (e.g. send a malformed body to `/api/claude` with a valid bearer token) and confirm the event lands in Sentry within ~30 seconds.

## Notes

- **No-op when DSN absent.** If `SENTRY_DSN` is not set, `withSentry` skips Sentry entirely and just runs the handler. Means deploying this code with the env var unset is safe — nothing breaks.
- **Sample rates are 0** for traces and profiles. Error monitoring only, matching the frontend Sentry policy. Keeps event volume low and within the free-tier quota.
- **PII handling.** `sendDefaultPii: false`. We tag the user (id + email) explicitly when the request has a Bearer token we can decode — same pattern as the frontend's `Sentry.setUser` call.
- **Flush before throw.** The wrapper calls `Sentry.flush(2000)` before re-throwing, so the event makes it out before the serverless container is frozen. 2-second timeout is the upper bound — most events flush in under 200ms.
