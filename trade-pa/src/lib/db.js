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
// Design choice: intercepts at .from() only. Supabase's query builder is
// then Proxy-wrapped so chained methods (.select/.eq/.order/...) record
// a spec, and at .then() we decide: execute against Supabase, or replay
// the spec against the IndexedDB cache.
//
// Everything outside .from() — auth, storage, rpc — passes through
// directly on the raw client.
//
// Kill switch: set `localStorage.tradepa_disable_cache = "1"` in DevTools
// to bypass the entire caching layer and revert to raw Supabase behaviour.
// Useful if Session 2 ever causes a production issue — one line, no deploy.

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
//
// As the caller chains methods on the builder, we accumulate a spec
// that describes the query. At .then() time we either execute the real
// query (online) or replay the spec against the local cache (offline).

function makeSpec(table) {
  return {
    table,
    operation: null,   // 'select' | 'insert' | 'update' | 'upsert' | 'delete'
    filters: [],       // [{ op, col, val }]
    order: null,       // { col, ascending }
    limit: null,
    range: null,       // { from, to }
    single: false,
    maybeSingle: false,
  };
}

// Methods that accumulate spec state (for cache replay).
// Everything else is passed straight through to Supabase.
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
      // `.is(col, null)` / `.is(col, true)` / `.is(col, false)`
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
      return true; // unknown op — don't filter out
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
  // Writes always go to Supabase. Offline writes fail for now (Session 4
  // will queue them).
  if (spec.operation !== "select") {
    const result = await realBuilder;
    // After successful writes, keep the cache in sync so subsequent
    // offline reads don't return stale data.
    if (!result.error && isCached(spec.table)) {
      if (spec.operation === "insert" || spec.operation === "upsert" || spec.operation === "update") {
        if (result.data) {
          const rows = Array.isArray(result.data) ? result.data : [result.data];
          await cacheRows(spec.table, rows);
        }
      } else if (spec.operation === "delete") {
        // We don't know the ids that were deleted (Supabase doesn't
        // always return them). Best-effort: if any filter is eq on id,
        // evict that id from the cache.
        const idFilter = spec.filters.find(
          f => f.op === "eq" && (f.col === "id" || f.col.endsWith("_id"))
        );
        if (idFilter) await deleteCachedRows(spec.table, [idFilter.val]);
      }
    }
    return result;
  }

  // Reads of non-cached tables pass through (AI context, subscriptions,
  // email connections, etc.).
  if (!isCached(spec.table) || cacheDisabled()) {
    return await realBuilder;
  }

  // Reads of cached tables: always-fresh-when-online, cache-as-fallback.
  if (isOnline()) {
    try {
      const result = await realBuilder;
      if (!result.error && result.data) {
        const rows = Array.isArray(result.data) ? result.data : [result.data];
        // Fire-and-forget cache write — don't block the caller.
        cacheRows(spec.table, rows);
      }
      return result;
    } catch (err) {
      // Network hiccup even though navigator says online — fall through
      // to cache rather than propagating the failure.
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
      // Match Supabase's "no rows" error shape so callers that branch
      // on error.code still work.
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
      // The await moment — execute against cache or network
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
          // .match({ col: val, ... }) — shorthand for multiple eq
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
        // Supabase builder methods return `this` for chaining. Keep
        // callers on the proxy so chain interception continues.
        return result === target ? proxy : result;
      };
    },
  });

  return proxy;
}

// ─── db client ────────────────────────────────────────────────────────
//
// Proxies the top-level supabase client. `.from()` returns a wrapped
// builder; everything else (.auth, .storage, .rpc, .channel, ...) passes
// through to the raw client unchanged.

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

// Escape hatch for code that must deliberately bypass the wrapper
// (auth listeners, realtime channels, anything that shouldn't be cached).
export { supabase };
