// ─── writeQueue.js ─────────────────────────────────────────────────────
//
// Offline write handling.
//
// Session 4: core implementation.
// Session 4.2: .single() / .maybeSingle() response-shape fix.
// Session 4b (NOW):
//   - BIGINT temp-id handling for customers and materials. Generates a
//     negative integer temp id client-side, queues the insert, then on
//     drain replays WITHOUT the id (server assigns). Reconciles the
//     returned real id back into the cache and any pending FK references.
//   - retryFailedWrite / discardFailedWrite for the Settings UI.

import {
  isCached,
  cacheRows,
  readCachedRows,
  deleteCachedRows,
  clearPendingFlag,
  addPendingWrite,
  listPendingWrites,
  updatePendingWrite,
  deletePendingWrite,
  putPendingWrite,
  countPendingWrites,
} from "./offlineDb.js";

// ─── Id-type classification ──────────────────────────────────────────

const UUID_ID_TABLES = new Set([
  "job_cards", "job_notes", "job_photos", "stock_items",
  "time_logs", "mileage_logs", "daywork_sheets", "variation_orders",
  "rams_documents", "trade_certificates", "customer_contacts",
  "compliance_docs", "documents", "subcontractors",
  "subcontractor_payments", "workers", "worker_documents", "purchase_orders",
]);

// Caller-supplied TEXT ids. App.jsx generates these (e.g. "job_<ts>")
// before calling .insert().
const TEXT_ID_TABLES = new Set(["jobs", "invoices", "quotes"]);

// Server-assigned BIGINT identity. We generate a NEGATIVE client-side
// placeholder, queue the insert, and reconcile on drain.
const BIGINT_ID_TABLES = new Set(["customers", "materials"]);

// Foreign keys pointing AT the BIGINT tables. When a temp id is
// reconciled to its real value, these columns in child rows / pending
// writes need to be rewritten from temp → real.
const FK_MAP = {
  customers: [
    { childTable: "customer_contacts", childColumn: "customer_id" },
  ],
  // materials: no inbound FK references
};

export function canInsertOffline(table) {
  return UUID_ID_TABLES.has(table)
      || TEXT_ID_TABLES.has(table)
      || BIGINT_ID_TABLES.has(table);
}

function needsClientUuid(table) {
  return UUID_ID_TABLES.has(table);
}

function isBigintTable(table) {
  return BIGINT_ID_TABLES.has(table);
}

function generateUuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Temp bigint: negative integer guaranteed unique within the session.
// Real identity values are positive, so negatives never collide.
// Date.now() * 1000 + counter stays well within JS safe-integer range
// (~9e15) for decades.
let _tempBigintCounter = 0;
function generateTempBigint() {
  _tempBigintCounter++;
  return -(Date.now() * 1000 + _tempBigintCounter);
}

export function isTempId(id) {
  return typeof id === "number" && id < 0;
}

// ─── Pub/sub for UI updates ──────────────────────────────────────────

const listeners = new Set();
export function onQueueChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  for (const fn of listeners) {
    try { fn(); } catch { /* listener errors shouldn't break us */ }
  }
}

export { countPendingWrites as getPendingCount };

// ─── Filter evaluation ───────────────────────────────────────────────

function matchRow(row, f) {
  const cell = row?.[f.col];
  switch (f.op) {
    case "eq": return cell === f.val || String(cell) === String(f.val);
    case "neq": return cell !== f.val && String(cell) !== String(f.val);
    case "in":
      return Array.isArray(f.val) &&
             f.val.some((v) => v === cell || String(v) === String(cell));
    case "is":
      if (f.val === null) return cell === null || cell === undefined;
      return cell === f.val;
    default:
      return true;
  }
}

// ─── Response-shape helpers ──────────────────────────────────────────

function buildResponse(rows, { single, maybeSingle }) {
  if (single) {
    if (!rows || rows.length === 0) {
      return {
        data: null,
        error: {
          code: "PGRST116",
          message: "JSON object requested, multiple (or no) rows returned",
          details: "Results contain 0 rows",
        },
      };
    }
    return { data: rows[0], error: null };
  }
  if (maybeSingle) {
    return { data: rows?.[0] ?? null, error: null };
  }
  return {
    data: rows ?? [],
    error: null,
    count: rows?.length ?? 0,
  };
}

// ─── The main offline write handler ──────────────────────────────────

export async function handleOfflineWrite(spec) {
  const {
    table,
    operation,
    data,
    filters = [],
    single = false,
    maybeSingle = false,
  } = spec;

  if (!isCached(table)) {
    return {
      data: null,
      error: {
        code: "OFFLINE_UNSUPPORTED_TABLE",
        message: `Offline writes not supported for table '${table}' — reconnect and try again.`,
      },
    };
  }

  if ((operation === "insert" || operation === "upsert") &&
      !canInsertOffline(table)) {
    return {
      data: null,
      error: {
        code: "OFFLINE_UNSUPPORTED_INSERT",
        message: `New ${table} records can't be created offline — reconnect and try again.`,
      },
    };
  }

  try {
    let preparedData = data;

    if (operation === "insert" || operation === "upsert") {
      const asArray = Array.isArray(data) ? data : [data];
      const prepared = asArray.map((row) => {
        const r = { ...(row || {}) };
        if (needsClientUuid(table) && r.id == null) {
          r.id = generateUuid();
        } else if (isBigintTable(table) && r.id == null) {
          r.id = generateTempBigint();
          r._tempId = true;
        }
        if (r.created_at == null) r.created_at = new Date().toISOString();
        return r;
      });
      preparedData = Array.isArray(data) ? prepared : prepared[0];
    }

    await applyOptimisticCacheUpdate({
      table, operation, data: preparedData, filters,
    });

    await addPendingWrite({
      table,
      operation,
      data: preparedData,
      filters,
    });

    notify();

    const returnRows = await computeReturnRows({
      table, operation, data: preparedData, filters,
    });

    if (operation === "delete") {
      return { data: null, error: null };
    }

    return buildResponse(returnRows, { single, maybeSingle });
  } catch (err) {
    console.error("[writeQueue] handleOfflineWrite failed:", err);
    return {
      data: null,
      error: {
        code: "OFFLINE_WRITE_FAILED",
        message: err?.message || "Failed to queue offline write",
      },
    };
  }
}

async function applyOptimisticCacheUpdate({ table, operation, data, filters }) {
  if (operation === "insert" || operation === "upsert") {
    const rows = Array.isArray(data) ? data : [data];
    const withMarker = rows
      .filter((r) => r && r.id != null)
      .map((r) => ({ ...r, _pendingSync: true }));
    if (withMarker.length > 0) await cacheRows(table, withMarker);
    return;
  }

  if (operation === "update") {
    const all = await readCachedRows(table);
    const matching = all.filter((row) => filters.every((f) => matchRow(row, f)));
    if (matching.length === 0) return;
    const updated = matching.map((row) => ({
      ...row,
      ...data,
      _pendingSync: true,
    }));
    await cacheRows(table, updated);
    return;
  }

  if (operation === "delete") {
    const all = await readCachedRows(table);
    const matching = all.filter((row) => filters.every((f) => matchRow(row, f)));
    if (matching.length > 0) {
      await deleteCachedRows(table, matching.map((r) => r.id));
    }
  }
}

async function computeReturnRows({ table, operation, data, filters }) {
  if (operation === "insert" || operation === "upsert") {
    const rows = Array.isArray(data) ? data : [data];
    return rows;
  }
  if (operation === "update") {
    const all = await readCachedRows(table);
    return all.filter((row) => filters.every((f) => matchRow(row, f)));
  }
  return [];
}

// ─── Temp-id reconciliation ──────────────────────────────────────────
//
// Called after a BIGINT insert successfully replays. Walks the cache
// and pending queue, replacing every reference to the temp id with
// the server-assigned real id.

async function reconcileTempId(table, tempId, realRow) {
  if (!realRow || realRow.id == null) return;
  const realId = realRow.id;

  // 1. Replace the temp cache row with the real one
  await deleteCachedRows(table, [tempId]);
  const cleanRow = { ...realRow };
  delete cleanRow._tempId;
  delete cleanRow._pendingSync;
  await cacheRows(table, [cleanRow]);

  const fkEntries = FK_MAP[table] || [];

  // 2. Walk the pending queue
  const allPending = await listPendingWrites(null);
  for (const entry of allPending) {
    let changed = false;
    const updated = { ...entry };

    // 2a. If this entry targets the SAME table, rewrite filters that
    //     reference the temp id as the row key (e.g. update or delete
    //     of the just-inserted customer).
    if (updated.table === table && Array.isArray(updated.filters)) {
      updated.filters = updated.filters.map((f) => {
        if ((f.col === "id") && f.val === tempId) {
          changed = true;
          return { ...f, val: realId };
        }
        return f;
      });
    }

    // 2b. If this entry targets a CHILD table, rewrite its data and
    //     filters for any FK column pointing at the temp id.
    for (const fk of fkEntries) {
      if (updated.table !== fk.childTable) continue;

      if (updated.data) {
        const asArray = Array.isArray(updated.data) ? updated.data : [updated.data];
        const rewritten = asArray.map((row) => {
          if (row && row[fk.childColumn] === tempId) {
            changed = true;
            return { ...row, [fk.childColumn]: realId };
          }
          return row;
        });
        updated.data = Array.isArray(updated.data) ? rewritten : rewritten[0];
      }

      if (Array.isArray(updated.filters)) {
        updated.filters = updated.filters.map((f) => {
          if (f.col === fk.childColumn && f.val === tempId) {
            changed = true;
            return { ...f, val: realId };
          }
          return f;
        });
      }
    }

    if (changed) {
      await putPendingWrite(updated.id, updated);
    }
  }

  // 3. Walk cached rows of child tables and rewrite FK columns
  for (const fk of fkEntries) {
    const rows = await readCachedRows(fk.childTable);
    const toUpdate = [];
    for (const row of rows) {
      if (row[fk.childColumn] === tempId) {
        const replacement = { ...row, [fk.childColumn]: realId };
        toUpdate.push(replacement);
      }
    }
    if (toUpdate.length > 0) {
      await cacheRows(fk.childTable, toUpdate);
    }
  }
}

// ─── The drain ───────────────────────────────────────────────────────

const MAX_ATTEMPTS = 3;
let draining = false;

export async function drainQueue() {
  if (draining) return { drained: 0, failed: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { drained: 0, failed: 0 };
  }

  draining = true;
  let drained = 0;
  let failed = 0;

  try {
    const { supabase } = await import("./db.js");

    while (true) {
      const pending = await listPendingWrites("pending");
      if (pending.length === 0) break;

      const entry = pending[0];

      try {
        await replayEntry(entry, supabase);
        await deletePendingWrite(entry.id);
        drained++;
        notify();
      } catch (err) {
        const attempts = (entry.attempts || 0) + 1;
        if (attempts >= MAX_ATTEMPTS) {
          await updatePendingWrite(entry.id, {
            status: "failed",
            attempts,
            last_error: err?.message || String(err),
          });
          failed++;
        } else {
          await updatePendingWrite(entry.id, {
            attempts,
            last_error: err?.message || String(err),
          });
        }
        notify();
        break;
      }
    }
  } finally {
    draining = false;
  }

  return { drained, failed };
}

async function replayEntry(entry, supabase) {
  const { table, operation, data, filters = [] } = entry;
  const q = supabase.from(table);

  if (operation === "insert") {
    // Detect BIGINT temp-id insert
    const asArray = Array.isArray(data) ? data : [data];
    const firstRow = asArray[0];
    const tempId = firstRow?._tempId ? firstRow.id : null;

    // Strip temp markers + id before sending (identity-always columns
    // refuse explicit values).
    const dataToSend = asArray.map((row) => {
      const r = { ...(row || {}) };
      if (r._tempId) {
        delete r.id;
        delete r._tempId;
      }
      delete r._pendingSync;
      return r;
    });
    const payload = Array.isArray(data) ? dataToSend : dataToSend[0];

    const res = await q.insert(payload).select();
    if (res.error) throw res.error;

    if (res.data) {
      const confirmed = Array.isArray(res.data) ? res.data : [res.data];
      if (tempId != null && confirmed[0]) {
        await reconcileTempId(table, tempId, confirmed[0]);
      } else {
        await cacheRows(table, confirmed);
        await clearPendingFlag(table, confirmed.map((r) => r.id));
      }
    }
    return;
  }

  if (operation === "upsert") {
    // Upserts go through as-is (they're not used for net-new records
    // in this codebase, typically updating known rows).
    const cleanData = Array.isArray(data)
      ? data.map((r) => stripMarkers(r))
      : stripMarkers(data);
    const res = await q.upsert(cleanData).select();
    if (res.error) throw res.error;
    if (res.data) {
      const confirmed = Array.isArray(res.data) ? res.data : [res.data];
      await cacheRows(table, confirmed);
      await clearPendingFlag(table, confirmed.map((r) => r.id));
    }
    return;
  }

  if (operation === "update") {
    const cleanData = stripMarkers(data);
    let builder = q.update(cleanData);
    for (const f of filters) {
      if (typeof builder[f.op] === "function") {
        builder = builder[f.op](f.col, f.val);
      }
    }
    const res = await builder.select();
    if (res.error) throw res.error;
    if (res.data) {
      const confirmed = Array.isArray(res.data) ? res.data : [res.data];
      await cacheRows(table, confirmed);
      await clearPendingFlag(table, confirmed.map((r) => r.id));
    }
    return;
  }

  if (operation === "delete") {
    let builder = q.delete();
    for (const f of filters) {
      if (typeof builder[f.op] === "function") {
        builder = builder[f.op](f.col, f.val);
      }
    }
    const res = await builder;
    if (res.error) throw res.error;
    return;
  }

  throw new Error(`[writeQueue] unknown operation '${operation}'`);
}

function stripMarkers(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const r = { ...obj };
  delete r._tempId;
  delete r._pendingSync;
  return r;
}

// ─── Failed-write management (for Settings UI) ───────────────────────

/**
 * Flip a failed write back to pending and kick the drain. Returns the
 * drain result so the caller can surface "retried, synced" toasts.
 */
export async function retryFailedWrite(queueId) {
  await updatePendingWrite(queueId, {
    status: "pending",
    attempts: 0,
    last_error: null,
  });
  notify();
  return await drainQueue();
}

/**
 * Remove a failed (or pending) entry from the queue without replaying.
 *
 * For inserts — also removes the optimistic row from the cache so the
 *   UI stops showing a phantom that will never sync.
 * For updates — clears the _pendingSync flag on matching cache rows
 *   (we have no pre-change snapshot to revert to; the local value will
 *   be overwritten on next online fetch anyway).
 * For deletes — nothing to undo in cache (row already gone). A server
 *   refresh will bring it back.
 */
export async function discardFailedWrite(queueId) {
  const all = await listPendingWrites(null);
  const entry = all.find((e) => e.id === queueId);
  if (!entry) return;

  try {
    if (entry.operation === "insert" || entry.operation === "upsert") {
      const rows = Array.isArray(entry.data) ? entry.data : [entry.data];
      const ids = rows.map((r) => r?.id).filter((id) => id != null);
      if (ids.length) await deleteCachedRows(entry.table, ids);
    } else if (entry.operation === "update") {
      const all = await readCachedRows(entry.table);
      const matching = all.filter((row) =>
        (entry.filters || []).every((f) => matchRow(row, f))
      );
      if (matching.length) {
        await clearPendingFlag(entry.table, matching.map((r) => r.id));
      }
    }
  } catch (err) {
    console.warn("[writeQueue] discardFailedWrite cleanup failed:", err);
  }

  await deletePendingWrite(queueId);
  notify();
}

export async function retryAllFailed() {
  const failed = await listPendingWrites("failed");
  for (const f of failed) {
    await updatePendingWrite(f.id, {
      status: "pending",
      attempts: 0,
      last_error: null,
    });
  }
  notify();
  return await drainQueue();
}

export async function discardAllFailed() {
  const failed = await listPendingWrites("failed");
  for (const f of failed) {
    await discardFailedWrite(f.id);
  }
}

export async function listAllPending() {
  return await listPendingWrites(null);
}
