// ─── prewarm.js ────────────────────────────────────────────────────────
//
// Cache pre-warming. Fires read queries for every Tier 1 + Tier 2 table
// shortly after login, so a user who loses signal immediately after
// logging in still has everything they'd expect to see while offline.
//
// The Proxy in db.js auto-caches the responses, so the function doesn't
// need to do anything with the returned data — it just triggers the
// reads. Each query is isolated with its own try/catch so one failure
// doesn't stop the rest.
//
// Runs fire-and-forget after a short delay, so the app's own initial
// data loads (dashboard, etc.) happen first and aren't competing for
// bandwidth. Tier 1 runs ahead of Tier 2 because it's the critical
// path for tradesperson-on-site usage.
//
// Session refresh: we call refreshSession() before the query loop to
// guarantee the JWT is attached to every PostgREST request. Without
// this, a race in Supabase's connection pool after fresh sign-in can
// cause some tables to return 0 rows even when the user has access.
// The symptom was subtle — jobs/customers/invoices would cache fine,
// but time_logs/subcontractors/subcontractor_payments would randomly
// come back empty. One refresh up front fixes it.

import { db } from "./db.js";
import { TIER_1_TABLES, TIER_2_TABLES } from "./offlineDb.js";

const YIELD_MS = 50;

let inFlight = false;

export async function prewarmCache() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return;
  }
  if (inFlight) return;
  inFlight = true;

  const startedAt = Date.now();
  let ok = 0;
  let failed = 0;

  try {
    // Force a fresh JWT before any table queries fire. Without this,
    // the PostgREST connection pool can randomly return 0 rows for some
    // tables even though the user has access. One round-trip up front.
    try {
      await db.auth.refreshSession();
    } catch (err) {
      // If refresh fails (network, already-refreshing, etc.), continue
      // anyway — the loop may still cache the tables that aren't affected.
      console.warn("[prewarm] session refresh skipped:", err?.message || err);
    }

    // Tier 1 — the tables a tradesperson needs on site
    for (const table of TIER_1_TABLES) {
      try {
        const { error } = await db.from(table).select("*");
        if (error) failed++;
        else ok++;
      } catch {
        failed++;
      }
      await new Promise((r) => setTimeout(r, YIELD_MS));
    }

    // Tier 2 — nice to have, fetched after Tier 1 is done
    for (const table of TIER_2_TABLES) {
      try {
        const { error } = await db.from(table).select("*");
        if (error) failed++;
        else ok++;
      } catch {
        failed++;
      }
      await new Promise((r) => setTimeout(r, YIELD_MS));
    }

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`[prewarm] cache warmed in ${elapsed}s — ${ok} ok, ${failed} failed`);
  } finally {
    inFlight = false;
  }
}
