// ─── db.js ─────────────────────────────────────────────────────────────
//
// Smart database client wrapper.
//
// Session 1: pass-through.
// Session 2: read caching.
// Session 2.1: Proxy re-wrap fix.
// Session 4: offline write queue.
// Session 4.1: network-failure detection (status:0 + 'Failed to fetch').
// Session 4.2: .single() / .maybeSingle() response-shape fix.
// Session 4b: no changes in this file — BIGINT temp-id handling lives
//   entirely in writeQueue.js. db.js just routes writes there; writeQueue
//   now accepts customers/materials inserts and handles them.
// Session 5 (26 Apr 2026): soft-delete holding bay integration.
//   - Reads against any SOFT_DELETE_TABLE auto-inject `.is("deleted_at", null)`
//     so callers can't accidentally see deleted rows. Zero-touch from
//     consumer code.
//   - Writes via .delete() are auto-rewritten to .update({ deleted_at,
//     deleted_cascade_id }) for soft-delete tables. Hard-delete escape
//     hatch: .hardDelete().
//   - CASCADE_MAP defines parent → children relationships; when a parent
//     is soft-deleted, children inherit the same cascade_id so a future
//     restore can bring back exactly that set.

import { supabase } from "../supabase.js";
import {
  isCached,
  cacheRows,
  readCachedRows,
  deleteCachedRows,
} from "./offlineDb.js";
import { handleOfflineWrite } from "./writeQueue.js";

// ─── Soft-delete configuration ────────────────────────────────────────
//
// Tables in this set have `deleted_at` + `deleted_cascade_id` columns and
// participate in the holding bay (14-day buffer, then permanent purge by
// pg_cron). Reads auto-filter out deleted rows; .delete() rewrites to
// .update({ deleted_at, deleted_cascade_id }).
//
// Must match the migration `soft_delete_holding_bay_columns` exactly.
// Adding a table here without the migration → reads break (column not
// found). Adding the column without listing it here → reads see deleted
// rows (no auto-filter).
const SOFT_DELETE_TABLES = new Set([
  "customers", "enquiries", "jobs", "job_cards", "job_notes",
  "job_photos", "job_drawings", "job_workers",
  "invoices", "expenses", "mileage_logs", "time_logs", "materials",
  "stock_items",
  "cis_statements", "subcontractor_payments", "daywork_sheets",
  "variation_orders", "purchase_orders", "purchase_order_items",
  "compliance_docs", "trade_certificates", "worker_documents",
  "rams_documents", "documents",
  "reminders", "customer_contacts", "call_logs", "user_commands",
]);

// Cascade map: when a row in `parent` is soft-deleted, the listed children
// (table + foreign-key column) are also soft-deleted with the same
// cascade_id. Restoring the parent restores everything that shares the id.
//
// Conservative: only cascades that match real domain semantics. Deleting
// a customer cascades to invoices/jobs/enquiries/contacts, but NOT to
// call_logs (you might still want call records even after the customer's
// gone for compliance/accounting reasons).
const CASCADE_MAP = {
  customers: [
    { table: "invoices", fk: "customer_id" },
    { table: "jobs", fk: "customer_id" },
    { table: "job_cards", fk: "customer_id" },
    { table: "enquiries", fk: "customer_id" },
    { table: "customer_contacts", fk: "customer_id" },
    { table: "reminders", fk: "customer_id" },
  ],
  jobs: [
    { table: "job_workers", fk: "job_id" },
    { table: "time_logs", fk: "job_id" },
    { table: "mileage_logs", fk: "job_id" },
    { table: "job_drawings", fk: "job_id" },
  ],
  job_cards: [
    { table: "job_notes", fk: "job_card_id" },
    { table: "job_photos", fk: "job_card_id" },
    { table: "job_drawings", fk: "job_card_id" },
    { table: "compliance_docs", fk: "job_card_id" },
    { table: "trade_certificates", fk: "job_id" },
    { table: "variation_orders", fk: "job_card_id" },
    { table: "daywork_sheets", fk: "job_card_id" },
  ],
  purchase_orders: [
    { table: "purchase_order_items", fk: "purchase_order_id" },
  ],
};

// UUID generator — uses crypto.randomUUID where available (modern browsers,
// Node 14+), falls back to a Math.random impl with v4 shape.
function newCascadeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function cacheDisabled() {
  try {
    return (
      typeof localStorage !== "undefined" &&
      localStorage.getItem("tradepa_disable_cache") === "1"
    );
  } catch {
    return false;
  }
}

function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function isNetworkFailure(result) {
  if (!result) return false;
  if (result.status === 0) return true;
  const msg = result.error?.message || "";
  if (/Failed to fetch/i.test(msg)) return true;
  if (/Network\s*Error/i.test(msg)) return true;
  if (/TypeError.*fetch/i.test(msg)) return true;
  return false;
}

function makeSpec(table) {
  return {
    table,
    operation: null,
    data: null,
    filters: [],
    order: null,
    limit: null,
    range: null,
    single: false,
    maybeSingle: false,
    // Soft-delete state — set by the proxy from SOFT_DELETE_TABLES /
    // .hardDelete() / .withDeleted() escape hatches.
    isSoftDelete: SOFT_DELETE_TABLES.has(table),
    bypassSoftDeleteFilter: false,
    bypassSoftDelete: false,
    cascadeId: null,
  };
}

const FILTER_METHODS = new Set([
  "eq", "neq", "gt", "gte", "lt", "lte",
  "like", "ilike", "is", "in",
]);

function matchValue(row, col, op, val) {
  const cell = row?.[col];
  switch (op) {
    case "eq": return cell === val || String(cell) === String(val);
    case "neq": return cell !== val && String(cell) !== String(val);
    case "gt": return cell > val;
    case "gte": return cell >= val;
    case "lt": return cell < val;
    case "lte": return cell <= val;
    case "is":
      if (val === null) return cell === null || cell === undefined;
      return cell === val;
    case "in":
      return Array.isArray(val) && val.some(v => v === cell || String(v) === String(cell));
    case "like":
    case "ilike": {
      const pattern = String(val)
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/%/g, ".*")
        .replace(/_/g, ".");
      const flags = op === "ilike" ? "i" : "";
      try {
        return new RegExp(`^${pattern}$`, flags).test(String(cell ?? ""));
      } catch {
        return false;
      }
    }
    default:
      return true;
  }
}

function applyQuerySpec(rows, spec) {
  let out = rows.filter(row =>
    spec.filters.every(f => matchValue(row, f.col, f.op, f.val))
  );

  // For cached reads on soft-delete tables: also hide deleted rows so
  // offline behaviour matches online (the auto-injected filter is in
  // spec.filters for online; this catches it for cache).
  if (spec.isSoftDelete && !spec.bypassSoftDeleteFilter && spec.operation === "select") {
    out = out.filter(r => r.deleted_at == null);
  }

  if (spec.order) {
    const { col, ascending } = spec.order;
    out = [...out].sort((a, b) => {
      const av = a?.[col];
      const bv = b?.[col];
      if (av === bv) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return ascending ? -1 : 1;
      return ascending ? 1 : -1;
    });
  }

  if (spec.range) {
    out = out.slice(spec.range.from, spec.range.to + 1);
  } else if (spec.limit != null) {
    out = out.slice(0, spec.limit);
  }

  return out;
}

function buildOfflineSpec(spec) {
  return {
    table: spec.table,
    operation: spec.operation,
    data: spec.data,
    filters: spec.filters,
    single: spec.single,
    maybeSingle: spec.maybeSingle,
  };
}

// ─── Soft-delete cascade execution ────────────────────────────────────
//
// Called after a soft-delete on a parent table. Looks up children via
// CASCADE_MAP and soft-deletes them with the same cascade_id so a future
// restore can bring back exactly the set deleted together. Best-effort:
// failures are logged but don't roll back the parent.
async function cascadeSoftDelete(parentTable, parentIds, cascadeId, userId) {
  const children = CASCADE_MAP[parentTable];
  if (!children || !children.length || !parentIds.length) return;

  for (const { table, fk } of children) {
    try {
      const updates = {
        deleted_at: new Date().toISOString(),
        deleted_cascade_id: cascadeId,
      };
      // Use raw supabase here — we already are the cascade, no need to
      // recurse through the proxy. .is(deleted_at,null) prevents
      // re-stamping rows already in the holding bay.
      let q = supabase.from(table).update(updates).in(fk, parentIds).is("deleted_at", null);
      if (userId) q = q.eq("user_id", userId);
      const result = await q;
      if (result.error) {
        console.warn(`[soft-delete cascade] ${parentTable} → ${table} failed:`, result.error.message);
      }
    } catch (err) {
      console.warn(`[soft-delete cascade] ${parentTable} → ${table} threw:`, err.message);
    }
  }
}

// ─── Soft-delete operation rewriter ──────────────────────────────────
//
// Intercepts .delete() on a soft-delete table and rewrites it to an
// equivalent .update({ deleted_at, deleted_cascade_id }) with the same
// filters. Triggers cascade. Returns a Supabase-shape result object.
async function executeSoftDelete(spec) {
  const cascadeId = spec.cascadeId || newCascadeId();
  const updates = {
    deleted_at: new Date().toISOString(),
    deleted_cascade_id: cascadeId,
  };

  // Rebuild update query with the original filters
  let q = supabase.from(spec.table).update(updates);
  for (const f of spec.filters) {
    q = q[f.op](f.col, f.val);
  }
  // .select() so we get affected rows back — needed for cascade lookup.
  q = q.select();
  const result = await q;

  if (result.error) {
    return result;
  }

  const hitIds = (result.data || []).map(r => r.id);
  const userId = result.data?.[0]?.user_id || null;
  if (hitIds.length) {
    await cascadeSoftDelete(spec.table, hitIds, cascadeId, userId);
  }

  // Mirror Supabase delete() shape so caller code expecting { data, error }
  // works unchanged.
  return { data: result.data, error: null, count: result.data?.length || 0 };
}

async function executeWithCache(realBuilder, spec) {
  // ─── Soft-delete rewrite ────────────────────────────────────────────
  // Intercept delete() on soft-delete tables → rewrite to update().
  // bypassSoftDelete is set when caller used .hardDelete() escape hatch
  // (e.g. the React-state-sync deletes that should stay hard).
  if (spec.operation === "delete" && spec.isSoftDelete && !spec.bypassSoftDelete) {
    return await executeSoftDelete(spec);
  }

  if (spec.operation !== "select") {
    if (cacheDisabled()) return await realBuilder;

    if (isOnline()) {
      let result;
      try {
        result = await realBuilder;
      } catch (err) {
        if (isCached(spec.table)) {
          return await handleOfflineWrite(buildOfflineSpec(spec));
        }
        throw err;
      }

      if (isNetworkFailure(result)) {
        if (isCached(spec.table)) {
          console.log(
            `[db] network unreachable — queueing ${spec.operation} on ${spec.table}`
          );
          return await handleOfflineWrite(buildOfflineSpec(spec));
        }
        return result;
      }

      if (!result.error && isCached(spec.table)) {
        if (spec.operation === "insert" || spec.operation === "upsert" || spec.operation === "update") {
          if (result.data) {
            const rows = Array.isArray(result.data) ? result.data : [result.data];
            await cacheRows(spec.table, rows);
          }
        } else if (spec.operation === "delete") {
          const idFilter = spec.filters.find(
            f => f.op === "eq" && (f.col === "id" || f.col.endsWith("_id"))
          );
          if (idFilter) await deleteCachedRows(spec.table, [idFilter.val]);
        }
      }
      return result;
    }

    return await handleOfflineWrite(buildOfflineSpec(spec));
  }

  if (!isCached(spec.table) || cacheDisabled()) {
    return await realBuilder;
  }

  if (isOnline()) {
    try {
      const result = await realBuilder;

      if (isNetworkFailure(result)) {
        console.log(
          `[db] network unreachable — serving ${spec.table} from cache`
        );
        return await readFromCache(spec);
      }

      if (!result.error && result.data) {
        const rows = Array.isArray(result.data) ? result.data : [result.data];
        cacheRows(spec.table, rows);
      }
      return result;
    } catch (err) {
      return await readFromCache(spec);
    }
  }

  return await readFromCache(spec);
}

async function readFromCache(spec) {
  const all = await readCachedRows(spec.table);
  const filtered = applyQuerySpec(all, spec);

  if (spec.single) {
    if (filtered.length === 0) {
      return {
        data: null,
        error: {
          code: "PGRST116",
          message: "JSON object requested, multiple (or no) rows returned",
          details: "Results contain 0 rows",
        },
      };
    }
    return { data: filtered[0], error: null };
  }
  if (spec.maybeSingle) {
    return { data: filtered[0] ?? null, error: null };
  }
  return { data: filtered, error: null, count: filtered.length };
}

function wrapBuilder(realBuilder, spec) {
  const proxy = new Proxy(realBuilder, {
    get(target, prop) {
      if (prop === "then") {
        return (onFulfilled, onRejected) =>
          executeWithCache(target, spec).then(onFulfilled, onRejected);
      }

      // ─── Soft-delete escape hatches ─────────────────────────────────
      // Not on the real Supabase builder — handled here before falling
      // through to the real proxy methods.
      //
      // .hardDelete() — bypass soft-delete rewrite, do a real DELETE.
      //   Used for React-state-sync deletes (line 30487+) where the row
      //   has already been removed in-memory and we're just reconciling.
      //
      // .withDeleted() — include soft-deleted rows in a SELECT. Used
      //   by the Recently Deleted UI to show what's in the holding bay.
      if (prop === "hardDelete") {
        return () => {
          spec.operation = "delete";
          spec.bypassSoftDelete = true;
          // Return a wrapped real-delete builder so callers can chain
          // .eq() etc. on it.
          const realDel = supabase.from(spec.table).delete();
          return wrapBuilder(realDel, spec);
        };
      }
      if (prop === "withDeleted") {
        return () => {
          spec.bypassSoftDeleteFilter = true;
          return proxy;
        };
      }

      const value = target[prop];
      if (typeof value !== "function") return value;

      return (...args) => {
        if (prop === "select") {
          spec.operation = spec.operation ?? "select";
          // ─── Auto-inject soft-delete filter ──────────────────────────
          // SELECT against a soft-delete table → hide deleted rows by
          // default. Skipped if .withDeleted() was called first.
          if (spec.isSoftDelete && !spec.bypassSoftDeleteFilter && !spec.softDeleteFilterApplied) {
            spec.filters.push({ op: "is", col: "deleted_at", val: null });
            spec.softDeleteFilterApplied = true;
            const selectResult = value.apply(target, args);
            // Chain .is(deleted_at, null) onto the real builder
            const filteredResult = (selectResult && typeof selectResult.is === "function")
              ? selectResult.is("deleted_at", null)
              : selectResult;
            if (filteredResult === target) return proxy;
            if (filteredResult && typeof filteredResult === "object" && typeof filteredResult.then === "function") {
              return wrapBuilder(filteredResult, spec);
            }
            return filteredResult;
          }
        } else if (prop === "insert") {
          spec.operation = "insert";
          spec.data = args[0];
        } else if (prop === "update") {
          spec.operation = "update";
          spec.data = args[0];
        } else if (prop === "upsert") {
          spec.operation = "upsert";
          spec.data = args[0];
        } else if (prop === "delete") {
          spec.operation = "delete";
        } else if (FILTER_METHODS.has(prop)) {
          spec.filters.push({ op: prop, col: args[0], val: args[1] });
        } else if (prop === "match") {
          const obj = args[0] || {};
          for (const [col, val] of Object.entries(obj)) {
            spec.filters.push({ op: "eq", col, val });
          }
        } else if (prop === "order") {
          spec.order = {
            col: args[0],
            ascending: args[1]?.ascending !== false,
          };
        } else if (prop === "limit") {
          spec.limit = args[0];
        } else if (prop === "range") {
          spec.range = { from: args[0], to: args[1] };
        } else if (prop === "single") {
          spec.single = true;
        } else if (prop === "maybeSingle") {
          spec.maybeSingle = true;
        }

        const result = value.apply(target, args);

        if (result === target) return proxy;

        if (result && typeof result === "object" && typeof result.then === "function") {
          return wrapBuilder(result, spec);
        }

        return result;
      };
    },
  });

  return proxy;
}

export const db = new Proxy(supabase, {
  get(target, prop) {
    if (prop === "from") {
      return (tableName) => {
        const real = target.from(tableName);
        return wrapBuilder(real, makeSpec(tableName));
      };
    }
    return target[prop];
  },
});

export { supabase };
