// ─── writeQueue.js ─────────────────────────────────────────────────────
//
// Offline write handling. Captures insert/update/upsert/delete operations
// that happen while offline, writes an optimistic row to the local cache
// so the UI reflects the change instantly, then queues the write to
// IndexedDB for later replay against Supabase on reconnect.
//
// Id strategy per table:
//   UUID tables — we generate crypto.randomUUID() client-side, so the
//     offline cache row and the eventually-inserted server row share
//     the same primary key. No reconciliation needed.
//   TEXT id tables (jobs, invoices, quotes) — the app is already
//     responsible for generating the id before calling .insert(), so
//     no special handling is required.
//   BIGINT id tables (customers, materials) — the server assigns the
//     id via identity. Not supported for offline insert in v1.
//     Inserts fail with a clear error; user must reconnect first.
//
// Retry policy: when the drain replays a write and Supabase returns an
// error, we keep the write as 'pending' and increment attempts. After
// 3 attempts we mark it 'failed' and stop retrying. A future 4b session
// will add a manual retry UI.

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

// Tables where the caller provides the id as a TEXT string before insert.
// App.jsx generates these itself (job_<timestamp> etc) so we pass through.
const TEXT_ID_TABLES = new Set(["jobs", "invoices", "quotes"]);

// Server-generated BIGINT identity — cannot safely insert offline in v1.
const BIGINT_ID_TABLES = new Set(["customers", "materials"]);

export function canInsertOffline(table) {
  return UUID_ID_TABLES.has(table) || TEXT_ID_TABLES.has(table);
}

function needsClientUuid(table) {
  return UUID_ID_TABLES.has(table);
}

function generateUuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers — simple RFC4122 v4
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Pub/sub for UI updates ──────────────────────────────────────────

const listeners = new Set();
export function onQueueChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  for (const fn of listeners) {
    try { fn(); } catch (err) { /* listener errors shouldn't break us */ }
  }
}

export { countPendingWrites as getPendingCount };

// ─── Filter evaluation (for update/delete offline targeting) ─────────
//
// Mirrors the subset of filter ops db.js's readFromCache handles, but
// scoped to equality-family ops since that's overwhelmingly what writes
// use (mostly .eq('id', x)).

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
      // Non-equality filters (gt/lt/ilike) aren't typical for writes.
      // Conservative: treat as match so we don't drop rows accidentally.
      return true;
  }
}

// ─── The main offline write handler ──────────────────────────────────
//
// Called from db.js when a write executes while navigator.onLine is
// false. Returns a Supabase-shaped response so callers don't need to
// know anything special happened.

export async function handleOfflineWrite(spec) {
  const { table, operation, data, filters = [] } = spec;

  if (!isCached(table)) {
    return {
      data: null,
      error: {
        code: "OFFLINE_UNSUPPORTED_TABLE",
        message: `Offline writes not supported for table '${table}' — reconnect and try again.`,
      },
    };
  }

  // Inserts/upserts to BIGINT-id tables can't be safely queued without
  // temp-id reconciliation, which is v2 territory.
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

    // For inserts, generate a client-side UUID if the table needs one
    // and the caller didn't already provide an id.
    if (operation === "insert" || operation === "upsert") {
      const asArray = Array.isArray(data) ? data : [data];
      const prepared = asArray.map((row) => {
        const r = { ...(row || {}) };
        if (needsClientUuid(table) && r.id == null) {
          r.id = generateUuid();
        }
        if (r.created_at == null) r.created_at = new Date().toISOString();
        return r;
      });
      preparedData = Array.isArray(data) ? prepared : prepared[0];
    }

    // Apply the optimistic change to the local cache so the UI reflects
    // it instantly — the caller awaits this write, then the UI rerenders
    // from cache and sees the change.
    await applyOptimisticCacheUpdate({
      table, operation, data: preparedData, filters,
    });

    // Queue the write for replay on reconnect.
    await addPendingWrite({
      table,
      operation,
      data: preparedData,
      filters,
    });

    notify();

    // Build a Supabase-shaped response. For inserts we return the rows
    // (callers often chain .select() to get them back). Update returns
    // the matched rows. Delete returns null/empty.
    const returnRows = await computeReturnRows({
      table, operation, data: preparedData, filters,
    });
    return { data: returnRows, error: null };
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
    return Array.isArray(data) ? data : [data];
  }
  if (operation === "update") {
    const all = await readCachedRows(table);
    return all.filter((row) => filters.every((f) => matchRow(row, f)));
  }
  // delete
  return null;
}

// ─── The drain ───────────────────────────────────────────────────────

const MAX_ATTEMPTS = 3;
let draining = false;

/**
 * Replay pending writes to Supabase in FIFO order. Stops on the first
 * write that errors (to preserve causal order — a later write might
 * depend on an earlier one) but keeps the queue intact so next drain
 * retries from the same point.
 *
 * Returns { drained, failed } counts. Safe to call concurrently —
 * a second call while already draining is a no-op.
 */
export async function drainQueue() {
  if (draining) return { drained: 0, failed: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { drained: 0, failed: 0 };
  }

  draining = true;
  let drained = 0;
  let failed = 0;

  try {
    // Import the raw client lazily to avoid a circular import with db.js.
    // We use the raw supabase client (not the Proxy) so the replay
    // doesn't bounce back through this same code path.
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
        // Stop the drain to preserve ordering. Next reconnect will retry.
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
    const res = await q.insert(data).select();
    if (res.error) throw res.error;
    if (res.data) {
      // Replace optimistic rows with server-confirmed rows (drops
      // _pendingSync flag because the confirmed row doesn't have it).
      const confirmed = Array.isArray(res.data) ? res.data : [res.data];
      await cacheRows(table, confirmed);
      // Explicitly clear markers for each id in case cacheRows' merge
      // preserves old flags.
      await clearPendingFlag(table, confirmed.map((r) => r.id));
    }
    return;
  }

  if (operation === "upsert") {
    const res = await q.upsert(data).select();
    if (res.error) throw res.error;
    if (res.data) {
      const confirmed = Array.isArray(res.data) ? res.data : [res.data];
      await cacheRows(table, confirmed);
      await clearPendingFlag(table, confirmed.map((r) => r.id));
    }
    return;
  }

  if (operation === "update") {
    let builder = q.update(data);
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
    // Cache removal happened during the optimistic phase already.
    return;
  }

  throw new Error(`[writeQueue] unknown operation '${operation}'`);
}

/**
 * Diagnostic — list all queue entries including failed ones. Used by
 * the offline-banner popover and any future Settings diagnostics.
 */
export async function listAllPending() {
  return await listPendingWrites(null);
}
