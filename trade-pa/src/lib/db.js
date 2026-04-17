// ─── db.js ─────────────────────────────────────────────────────────────
//
// Smart database client wrapper. Every Supabase call in the app flows
// through this file. In Phase 1 Session 1 `db` is a literal alias for
// the raw supabase client — zero behaviour change.
//
// Roadmap:
//   Session 1 (now):  pass-through, mechanical call-site migration
//   Session 2:        read cache for Tier 1 tables (cache-aside pattern)
//   Session 3:        read cache extended to Tier 2, cache invalidation
//   Session 4:        write queue for simple offline writes (time logs,
//                     notes, status updates)
//   Session 5:        write queue for complex inserts with temp-IDs and
//                     foreign-key rewriting; photo upload queue
//   Session 6:        AI degradation surface, offline UI hooks
//   Session 7:        battle-test and polish
//
// Usage is identical to the raw supabase client:
//   import { db } from "./lib/db.js";
//   const { data } = await db.from("jobs").select("*").eq("user_id", uid);
//   const { error } = await db.from("time_logs").insert({ ... });
//   db.auth.getUser();
//   db.storage.from("job-photos").upload(...);
//
// Also re-exports the raw `supabase` client for rare cases that must
// bypass the wrapper (auth state listeners, realtime subscriptions —
// anything that shouldn't be cached or queued).

import { supabase } from "../supabase.js";

// Phase 1 Session 1: db is supabase. Fully transparent.
// This alias is what makes the big-bang mechanical migration safe —
// nothing actually changes at runtime until we opt in to caching below.
export const db = supabase;

// Escape hatch for the rare call that should deliberately skip the
// wrapper. Use sparingly — prefer `db` in all new code.
export { supabase };
