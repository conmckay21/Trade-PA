// ─── writeQueue.js ─────────────────────────────────────────────────────
//
// Offline write handling.
//
// Session 4: core implementation.
// Session 4.2 (NOW): respect spec.single / spec.maybeSingle when building
//   the return response. Callers using .insert(x).select().single() need
//   `data` to be a single object, not an array of one — otherwise they
//   destructure `data.hours` and get `undefined`.

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

const TEXT_ID_TABLES = new Set(["jobs", "invoices", "quotes"]);
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
//
// Supabase's .single() returns { data: object, error }.
// Supabase's .maybeSingle() returns { data: object|null, error }.
// Default (neither called) returns { data: array, error, count }.
// The offline handler must match this or callers that destructure
// `data.somefield` will see `undefined` when `data` is actually an array.

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

    // Delete doesn't return rows — preserve Supabase's shape.
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
    const res = await q.insert(data).select();
    if (res.error) throw res.error;
    if (res.data) {
      const confirmed = Array.isArray(res.data) ? res.data : [res.data];
      await cacheRows(table, confirmed);
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
    return;
  }

  throw new Error(`[writeQueue] unknown operation '${operation}'`);
}

export async function listAllPending() {
  return await listPendingWrites(null);
}
