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
// Silent — no UI feedback in Session 2. A diagnostics panel in Settings
// is planned for Session 3.

import { db } from "./db.js";
import { TIER_1_TABLES, TIER_2_TABLES } from "./offlineDb.js";

// Small delay between requests so we don't saturate the network or
// Supabase connection pool. 50ms × 23 tables = ~1.2s total minimum.
const YIELD_MS = 50;

let inFlight = false;

/**
 * Fire read queries for every cached table. Safe to call multiple times
 * — a concurrent call is a no-op. RLS ensures each user only gets their
 * own rows regardless of any filter we set.
 */
export async function prewarmCache() {
  // Don't run if offline — no point, and the wrapper would just read
  // empty cache anyway.
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return;
  }
  // Prevent overlap if called multiple times in quick succession
  if (inFlight) return;
  inFlight = true;

  const startedAt = Date.now();
  let ok = 0;
  let failed = 0;

  try {
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
