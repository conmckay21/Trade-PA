// ─── db.js ─────────────────────────────────────────────────────────────
//
// Smart database client wrapper.
//
// Session 1: pass-through.
// Session 2: read caching.
// Session 2.1: Proxy re-wrap fix.
// Session 4: offline write queue.
// Session 4.1: network-failure detection (status:0 + 'Failed to fetch').
// Session 4.2 (NOW): pass spec.single / spec.maybeSingle through to the
//   offline handler so .insert(x).select().single() returns the row as
//   an object, not an array. Without this, callers that destructure
//   `data.id` or `data.hours` saw `undefined` for every field because
//   `data` was actually an array.
//
// Kill switch: `localStorage.tradepa_disable_cache = "1"` bypasses the
// entire caching+queue layer.

import { supabase } from "../supabase.js";
import {
  isCached,
  cacheRows,
  readCachedRows,
  deleteCachedRows,
} from "./offlineDb.js";
import { handleOfflineWrite } from "./writeQueue.js";

// ─── Kill switch ─────────────────────────────────────────────────────

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

// ─── Query spec tracking ──────────────────────────────────────────────

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
  };
}

const FILTER_METHODS = new Set([
  "eq", "neq", "gt", "gte", "lt", "lte",
  "like", "ilike", "is", "in",
]);

// ─── Filter application in-memory (for offline reads) ────────────────

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

// Build the full offline-write payload including chain modifiers. Used
// everywhere we route to the offline handler so .single()/.maybeSingle()
// are honoured consistently.
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

// ─── The main execution step ──────────────────────────────────────────

async function executeWithCache(realBuilder, spec) {
  // ── Writes ──────────────────────────────────────────────────────
  if (spec.operation !== "select") {
    if (cacheDisabled()) {
      return await realBuilder;
    }

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

  // ── Reads ───────────────────────────────────────────────────────
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

// ─── Builder proxy ────────────────────────────────────────────────────

function wrapBuilder(realBuilder, spec) {
  const proxy = new Proxy(realBuilder, {
    get(target, prop) {
      if (prop === "then") {
        return (onFulfilled, onRejected) =>
          executeWithCache(target, spec).then(onFulfilled, onRejected);
      }

      const value = target[prop];
      if (typeof value !== "function") return value;

      return (...args) => {
        if (prop === "select") {
          spec.operation = spec.operation ?? "select";
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

// ─── db client ────────────────────────────────────────────────────────

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
