// ─── Client-side auth helpers ────────────────────────────────────────────────
// authHeaders: bearer-token headers for /api fetch calls.
// setOwnerCookie: drops the owner cookie used by the un-authenticated portal
// to suppress self-view notifications.
//
// authHeaders previously read window._supabase (a global hack populated near
// the top of App.jsx). It now imports `db` directly from ./db.js — the value
// is identical (App.jsx still sets window._supabase = db for legacy callers
// that haven't been migrated yet).

import { db } from "./db.js";

// ─── Auth header helper for all /api fetch calls ──────────────────────────────
// Returns the headers object with Authorization: Bearer <token> attached.
// All /api/claude and /api/transcribe routes require this.
export async function authHeaders(extra = {}) {
  const { data: { session } } = await db.auth.getSession();
  const token = session?.access_token || '';
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
    ...extra,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// setOwnerCookie — drops a cookie on the tradesperson's device containing
// their user_id. The server-side portal endpoint (/api/portal) reads this
// cookie on incoming requests and suppresses the "customer viewed your
// quote" push notification when the viewer's cookie matches the invoice's
// owner.
//
// Why a cookie: the portal is un-authenticated (anyone with the link can
// view) but we still need to distinguish the tradesperson previewing their
// own link from a genuine customer view. A cookie is set on any device the
// tradesperson has logged into, and gets sent automatically on every portal
// request — no extra plumbing needed on the link-sharing side.
//
// Security properties:
//   - Value is just the user_id UUID (not secret — it's in every JWT already)
//   - SameSite=Lax means cookie IS sent when opening /quote/<token> from
//     inside the app (same-site nav), but NOT on arbitrary cross-site POSTs
//   - httpOnly=false because we need to set it from client-side JS
//   - Secure=true in production (always HTTPS)
//   - 90 day lifetime
// ─────────────────────────────────────────────────────────────────────────
export function setOwnerCookie(userId) {
  if (!userId || typeof document === "undefined") return;
  try {
    const maxAge = 60 * 60 * 24 * 90; // 90 days
    const secure = (typeof window !== "undefined" && window.location?.protocol === "https:") ? "; Secure" : "";
    document.cookie = `tp_owner=${encodeURIComponent(userId)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
  } catch {
    // Some browser contexts (e.g. embedded webviews) block cookie writes.
    // Fall back silently — the worst case is the tradesperson gets pushes
    // for their own portal previews, which is annoying but not broken.
  }
}
