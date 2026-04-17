// ─── offlineDb.js ──────────────────────────────────────────────────────
//
// IndexedDB store for the offline read-cache and pending-writes queue.
//
// Phase 1 Session 1: schema defined and DB is provisioned on first call
// to getOfflineDb(). No reads or writes happen through this layer yet —
// Session 2 wires up read caching, Session 4 wires up the write queue.
//
// Schema:
//   One object store per cached Supabase table (Tier 1 + Tier 2)
//     Keyed on `id`. Indexed on `user_id` and `updated_at`.
//   One `pending_writes` store for the offline write queue
//     Auto-increment key. Indexed on `created_at` and `status`.
//   One `_cache_meta` store for bookkeeping
//     Tracks last-fetch timestamp per table, cache version, etc.
//
// Storage size: IndexedDB quota varies by browser. Safari ~1GB, Chrome
// up to 60% of free disk. Real concern is photos — Session 5 will add
// quota monitoring and eviction for photo blobs specifically.

import { openDB } from "idb";

const DB_NAME = "tradepa-offline";
const DB_VERSION = 1;

// ─── Table tiers (must match the offline architecture plan) ────────────

// Tier 1 — tradesperson on site. MUST work offline.
export const TIER_1_TABLES = [
  "jobs",
  "job_cards",
  "job_notes",
  "job_photos",
  "customers",
  "customer_contacts",
  "materials",
  "stock_items",
  "time_logs",
  "mileage_logs",
  "daywork_sheets",
  "variation_orders",
  "rams_documents",
  "trade_certificates",
];

// Tier 2 — nice to have offline (viewing existing records mostly).
export const TIER_2_TABLES = [
  "invoices",
  "quotes",
  "compliance_docs",
  "documents",
  "subcontractors",
  "subcontractor_payments",
  "workers",
  "worker_documents",
  "purchase_orders",
];

// All tables that get cached locally. Anything not in this list stays
// online-only (config tables, AI infrastructure, phone logs, etc.)
export const CACHED_TABLES = [...TIER_1_TABLES, ...TIER_2_TABLES];

// ─── Database initialisation ──────────────────────────────────────────

let dbPromise = null;

/**
 * Returns a promise for the IndexedDB handle. Lazily initialised on first
 * call. Returns null on environments without IndexedDB (old browsers, SSR).
 */
export function getOfflineDb() {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return null;
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(idb) {
        // One object store per cached table
        for (const table of CACHED_TABLES) {
          if (!idb.objectStoreNames.contains(table)) {
            const store = idb.createObjectStore(table, { keyPath: "id" });
            store.createIndex("user_id", "user_id", { unique: false });
            store.createIndex("updated_at", "updated_at", { unique: false });
          }
        }

        // Pending-writes queue — replayed when connection returns
        if (!idb.objectStoreNames.contains("pending_writes")) {
          const pw = idb.createObjectStore("pending_writes", {
            keyPath: "id",
            autoIncrement: true,
          });
          pw.createIndex("created_at", "created_at", { unique: false });
          pw.createIndex("status", "status", { unique: false });
          pw.createIndex("table", "table", { unique: false });
        }

        // Cache bookkeeping
        if (!idb.objectStoreNames.contains("_cache_meta")) {
          idb.createObjectStore("_cache_meta", { keyPath: "key" });
        }
      },
      blocked() {
        console.warn("[offlineDb] upgrade blocked by an older tab still open");
      },
      blocking() {
        console.warn("[offlineDb] a newer version is trying to upgrade");
      },
    });
  }
  return dbPromise;
}

// ─── Convenience helpers ──────────────────────────────────────────────

/** Is this table cacheable in the offline store? */
export function isCached(table) {
  return CACHED_TABLES.includes(table);
}

/** Clear every cached row (used on logout; preserves schema). */
export async function clearAllCache() {
  const idb = await getOfflineDb();
  if (!idb) return;
  const tx = idb.transaction(
    [...CACHED_TABLES, "pending_writes", "_cache_meta"],
    "readwrite"
  );
  await Promise.all([
    ...CACHED_TABLES.map((t) => tx.objectStore(t).clear()),
    tx.objectStore("pending_writes").clear(),
    tx.objectStore("_cache_meta").clear(),
  ]);
  await tx.done;
}

/** Cheap diagnostic — row counts per store. Used by Settings > Storage. */
export async function getCacheStats() {
  const idb = await getOfflineDb();
  if (!idb) return null;
  const stats = {};
  for (const t of CACHED_TABLES) {
    stats[t] = await idb.count(t);
  }
  stats.pending_writes = await idb.count("pending_writes");
  return stats;
}
