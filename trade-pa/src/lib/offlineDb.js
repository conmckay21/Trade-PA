// ─── offlineDb.js ──────────────────────────────────────────────────────
//
// IndexedDB store for the offline read-cache and pending-writes queue.
//
// Phase 1 Session 1: schema defined.
// Phase 1 Session 2: cache read/write/merge helpers.
// Phase 1 Session 4: pending_writes helpers activated.
// Phase 1 Session 4b (NOW): retry / discard helpers for failed writes.

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
      if (!row || row.id == null) continue;
      const existing = await store.get(row.id);
      const merged = existing ? { ...existing, ...row } : row;
      await store.put(merged);
    }
    await tx.done;
    await writeMeta(`${table}:last_cached`, Date.now());
  } catch (err) {
    console.warn(`[offlineDb] cacheRows(${table}) failed:`, err);
  }
}

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

export async function clearPendingFlag(table, ids) {
  if (!isCached(table)) return;
  if (!Array.isArray(ids)) ids = [ids];
  if (ids.length === 0) return;

  const idb = await getOfflineDb();
  if (!idb) return;
  try {
    const tx = idb.transaction(table, "readwrite");
    const store = tx.objectStore(table);
    for (const id of ids) {
      const row = await store.get(id);
      if (row && (row._pendingSync || row._tempId)) {
        delete row._pendingSync;
        delete row._tempId;
        await store.put(row);
      }
    }
    await tx.done;
  } catch (err) {
    console.warn(`[offlineDb] clearPendingFlag(${table}) failed:`, err);
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

/**
 * Full stats for the diagnostics panel.
 * Returns { perTable: { <table>: { rows, lastCached }}, pending, failed }.
 */
export async function getCacheStats() {
  const idb = await getOfflineDb();
  if (!idb) return null;

  const perTable = {};
  for (const t of CACHED_TABLES) {
    const rows = await idb.count(t);
    const lastCached = await readMeta(`${t}:last_cached`);
    perTable[t] = { rows, lastCached };
  }
  const allPw = await idb.getAll("pending_writes");
  const pending = allPw.filter((e) => e.status === "pending").length;
  const failed = allPw.filter((e) => e.status === "failed").length;

  return { perTable, pending, failed };
}

// ─── Pending writes queue helpers ─────────────────────────────────────

export async function addPendingWrite(entry) {
  const idb = await getOfflineDb();
  if (!idb) throw new Error("[offlineDb] IndexedDB unavailable");
  const id = await idb.add("pending_writes", {
    ...entry,
    status: entry.status || "pending",
    attempts: entry.attempts || 0,
    created_at: entry.created_at || new Date().toISOString(),
  });
  return id;
}

export async function listPendingWrites(statusFilter = "pending") {
  const idb = await getOfflineDb();
  if (!idb) return [];
  try {
    const all = await idb.getAll("pending_writes");
    const filtered = statusFilter == null
      ? all
      : all.filter((e) => e.status === statusFilter);
    filtered.sort((a, b) => a.created_at.localeCompare(b.created_at));
    return filtered;
  } catch (err) {
    console.warn("[offlineDb] listPendingWrites failed:", err);
    return [];
  }
}

export async function countPendingWrites() {
  const idb = await getOfflineDb();
  if (!idb) return 0;
  try {
    return await idb.countFromIndex("pending_writes", "status", "pending");
  } catch {
    return 0;
  }
}

export async function updatePendingWrite(id, updates) {
  const idb = await getOfflineDb();
  if (!idb) return;
  try {
    const existing = await idb.get("pending_writes", id);
    if (!existing) return;
    await idb.put("pending_writes", { ...existing, ...updates });
  } catch (err) {
    console.warn(`[offlineDb] updatePendingWrite(${id}) failed:`, err);
  }
}

export async function deletePendingWrite(id) {
  const idb = await getOfflineDb();
  if (!idb) return;
  try {
    await idb.delete("pending_writes", id);
  } catch (err) {
    console.warn(`[offlineDb] deletePendingWrite(${id}) failed:`, err);
  }
}

/**
 * Used during temp-id reconciliation — replaces an entry wholesale.
 * Safe to call while iterating listPendingWrites since each call opens
 * its own tx.
 */
export async function putPendingWrite(id, entry) {
  const idb = await getOfflineDb();
  if (!idb) return;
  try {
    await idb.put("pending_writes", { ...entry, id });
  } catch (err) {
    console.warn(`[offlineDb] putPendingWrite(${id}) failed:`, err);
  }
}
