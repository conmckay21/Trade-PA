// ─────────────────────────────────────────────────────────────────────────
// trackEvent — fire-and-forget usage analytics.
//
// Writes a row to the usage_events table. Never throws, never blocks,
// never retries. The caller MUST have a valid Supabase session (auth.uid)
// — events are rejected by RLS otherwise.
//
// Usage:
//   trackEvent(dbInstance, user.id, companyId, "tool_call", "create_invoice",
//              { success: true, duration_ms: 420, amount: 1200 });
//
// Event categories (keep vocab stable so dashboards don't drift):
//   - "tool_call"     — AI tool executions (create_invoice, send_quote, ...)
//   - "voice_session" — PTT or hands-free start/end
//   - "email_sent"    — invoice, quote, chase emails
//   - "payment"       — Stripe subscription events
//   - "plan_event"    — cap_hit, upgraded, downgraded
//   - "portal_view"   — customer opened a portal link
//
// Dropped silently if user_id/db missing (e.g. during onboarding before
// a session exists) so callers don't need to null-check.
// ─────────────────────────────────────────────────────────────────────────
export async function trackEvent(dbInstance, userId, companyId, eventType, eventName, metadata = {}) {
  if (!dbInstance || !userId || !eventType || !eventName) return;
  try {
    await dbInstance.from("usage_events").insert({
      user_id: userId,
      company_id: companyId || null,
      event_type: eventType,
      event_name: eventName,
      metadata: metadata || {},
    });
  } catch (err) {
    // Swallow — tracking must never impact UX. Sentry will pick up any
    // schema-level issues via the error boundary if they surface elsewhere.
  }
}
