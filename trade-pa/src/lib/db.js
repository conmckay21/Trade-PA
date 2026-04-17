// ─── db.js ─────────────────────────────────────────────────────────────
//
// Smart database client wrapper.
//
// Session 1: pure pass-through (db === supabase).
// Session 2 (NOW): read caching for Tier 1 + Tier 2 tables.
//   - Online reads execute against Supabase and mirror the result to IDB.
//   - Offline reads (or reads that error) serve from IDB using the same
//     filter / order / limit spec the caller requested.
//   - Writes pass through unchanged. Session 4 will queue them offline.
//
// Session 2.1 FIX: re-wrap any new builder returned by a chained call.
// Supabase's .select() returns a different builder class than .from(),
// so `result === target` is false on that boundary. Previous version
// handed control back to the raw builder on this transition, which meant
// the cache code never fired for queries that used .select(). The fix
// re-wraps any thenable builder so the Proxy stays active through the
// entire chain, with the shared spec carrying across.
//
// Kill switch: `localStorage.tradepa_disable_cache = "1"` in DevTools
// bypasses the caching layer entirely.

import { supabase } from "../supabase.js";
import {
  isCached,
  cacheRows,
  readCachedRows,
  deleteCachedRows,
} from "./offlineDb.js";

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

// ─── Query spec tracking ──────────────────────────────────────────────

function makeSpec(table) {
  return {
    table,
    operation: null,
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

// ─── Filter application in-memory ─────────────────────────────────────

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

// ─── The main execution step ──────────────────────────────────────────

async function executeWithCache(realBuilder, spec) {
  if (spec.operation !== "select") {
    const result = await realBuilder;
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

  if (!isCached(spec.table) || cacheDisabled()) {
    return await realBuilder;
  }

  if (isOnline()) {
    try {
      const result = await realBuilder;
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
//
// FIX: re-wrap any thenable builder returned by a chained method.
// Supabase returns a new builder class from .select() etc., so we can't
// just rely on identity check — we have to detect "this is a query
// builder" and keep the Proxy active across the transition.

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
        // Record spec state for cache replay
        if (prop === "select") spec.operation = spec.operation ?? "select";
        else if (prop === "insert") spec.operation = "insert";
        else if (prop === "update") spec.operation = "update";
        else if (prop === "upsert") spec.operation = "upsert";
        else if (prop === "delete") spec.operation = "delete";
        else if (FILTER_METHODS.has(prop)) {
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

        // Same builder returned — stay on the current proxy.
        if (result === target) return proxy;

        // New thenable builder (e.g. .select() returning FilterBuilder).
        // Re-wrap so the Proxy stays active for the rest of the chain,
        // with the same accumulated spec.
        if (result && typeof result === "object" && typeof result.then === "function") {
          return wrapBuilder(result, spec);
        }

        // Anything else (unusual) — return as-is.
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
