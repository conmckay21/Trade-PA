// ─── offlineDb.js ──────────────────────────────────────────────────────
//
// IndexedDB store for the offline read-cache and pending-writes queue.
//
// Phase 1 Session 1: schema defined, no data flows through yet.
// Phase 1 Session 2 (NOW): cache read/write/merge helpers added, used
//   by db.js when queries hit cached tables.
// Phase 1 Session 4: pending_writes queue wired up.
//
// Schema:
//   One object store per cached Supabase table (Tier 1 + Tier 2).
//     Keyed on `id`. Indexed on `user_id` and `updated_at`.
//   One `pending_writes` store for the offline write queue (dormant).
//   One `_cache_meta` store for bookkeeping.

import { openDB } from "idb";

const DB_NAME = "tradepa-offline";
const DB_VERSION = 1;

// ─── Table tiers ──────────────────────────────────────────────────────

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

export const CACHED_TABLES = [...TIER_1_TABLES, ...TIER_2_TABLES];

// ─── Database initialisation ──────────────────────────────────────────

let dbPromise = null;

export function getOfflineDb() {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return null;
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(idb) {
        for (const table of CACHED_TABLES) {
          if (!idb.objectStoreNames.contains(table)) {
            const store = idb.createObjectStore(table, { keyPath: "id" });
            store.createIndex("user_id", "user_id", { unique: false });
            store.createIndex("updated_at", "updated_at", { unique: false });
          }
        }
        if (!idb.objectStoreNames.contains("pending_writes")) {
          const pw = idb.createObjectStore("pending_writes", {
            keyPath: "id",
            autoIncrement: true,
          });
          pw.createIndex("created_at", "created_at", { unique: false });
          pw.createIndex("status", "status", { unique: false });
          pw.createIndex("table", "table", { unique: false });
        }
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

export function isCached(table) {
  return CACHED_TABLES.includes(table);
}

// ─── Row-level cache helpers ─────────────────────────────────────────
//
// Session 2 uses these from db.js to mirror Supabase reads into IDB
// and to serve reads from IDB when offline.

/**
 * Write rows to the cache. If a row with the same id already exists,
 * merges the columns (new row's fields overwrite old ones, but any
 * columns missing in the new row are preserved from the old row).
 *
 * This merge behaviour matters because different queries select
 * different column subsets. Without merge, cache rows would keep
 * losing columns as narrower queries overwrote them.
 *
 * Silently no-ops for non-cached tables and when IDB is unavailable.
 */
export async function cacheRows(table, rows) {
  if (!isCached(table)) return;
  if (!Array.isArray(rows)) rows = [rows];
  if (rows.length === 0) return;

  const idb = await getOfflineDb();
  if (!idb) return;

  try {
    const tx = idb.transaction(table, "readwrite");
    const store = tx.objectStore(table);
    for (const row of rows) {
      if (!row || row.id == null) continue; // skip rows without id
      const existing = await store.get(row.id);
      const merged = existing ? { ...existing, ...row } : row;
      await store.put(merged);
    }
    await tx.done;
    await writeMeta(`${table}:last_cached`, Date.now());
  } catch (err) {
    // Cache is a performance/reliability layer — a write failure here
    // must never break the caller. Log and move on.
    console.warn(`[offlineDb] cacheRows(${table}) failed:`, err);
  }
}

/**
 * Read every row from a cached table. Caller applies filter/order/limit
 * in-memory afterwards (see applyQuerySpec in db.js).
 */
export async function readCachedRows(table) {
  if (!isCached(table)) return [];
  const idb = await getOfflineDb();
  if (!idb) return [];
  try {
    return await idb.getAll(table);
  } catch (err) {
    console.warn(`[offlineDb] readCachedRows(${table}) failed:`, err);
    return [];
  }
}

/**
 * Delete specific row ids from the cache. Called on successful Supabase
 * deletes, so subsequent offline reads don't return zombie rows.
 */
export async function deleteCachedRows(table, ids) {
  if (!isCached(table)) return;
  if (!Array.isArray(ids)) ids = [ids];
  if (ids.length === 0) return;

  const idb = await getOfflineDb();
  if (!idb) return;
  try {
    const tx = idb.transaction(table, "readwrite");
    await Promise.all(ids.map((id) => tx.objectStore(table).delete(id)));
    await tx.done;
  } catch (err) {
    console.warn(`[offlineDb] deleteCachedRows(${table}) failed:`, err);
  }
}

// ─── Cache bookkeeping ────────────────────────────────────────────────

async function writeMeta(key, value) {
  const idb = await getOfflineDb();
  if (!idb) return;
  try {
    await idb.put("_cache_meta", { key, value, updated_at: Date.now() });
  } catch (err) {
    console.warn(`[offlineDb] writeMeta(${key}) failed:`, err);
  }
}

export async function readMeta(key) {
  const idb = await getOfflineDb();
  if (!idb) return null;
  try {
    const row = await idb.get("_cache_meta", key);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

/** Used on logout — clears every cached row. Preserves schema. */
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

/** Row counts per store — used in diagnostics. */
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
