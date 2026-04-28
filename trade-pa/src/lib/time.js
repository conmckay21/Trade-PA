// ─── Local-date & time helpers ───────────────────────────────────────────────
// Timezone-safe wall-clock dates (UK-local) + week-bound + recency-grouping.
// Pure functions, no dependencies.

// THE BUG WE'RE FIXING: `localDate()` returns the
// UTC date, NOT the user's local date. For UK users in BST (summer) this
// means anything logged after midnight local time (23:00–23:59 UTC) gets
// stored as the *previous* day. Worst case: a CIS statement logged on
// 1 November at 00:15 BST gets filed as 31 October — wrong tax month.
//
// These helpers return the user's wall-clock date as a string. They use
// `Intl.DateTimeFormat("en-GB", ...)` which respects the runtime's timezone
// (browser-local on the client, UTC inside server functions). For our app
// the call sites are all client-side, so "browser local" is effectively
// UK time for our UK-only product.
//
// Use these everywhere we'd previously have written `new Date().toISOString().slice(0, X)`:
//   localDate(d?)      → "YYYY-MM-DD"     (replaces .slice(0,10))
//   localMonth(d?)     → "YYYY-MM"        (replaces .slice(0,7))
//   localYear(d?)      → "YYYY"           (replaces .slice(0,4))
//
// Optional `d` argument lets you pass a specific Date — defaults to now.
export function localDate(d = new Date()) {
  // en-CA gives ISO-style YYYY-MM-DD output in any locale's calendar.
  // Same numeric output as toISOString().slice(0,10) but timezone-respecting.
  return d.toLocaleDateString("en-CA");
}
export function localMonth(d = new Date()) {
  return localDate(d).slice(0, 7);
}
export function localYear(d = new Date()) {
  return localDate(d).slice(0, 4);
}

// Millisecond timestamps for TODAY / THIS WEEK windows in local time.
// Week starts Monday. Safe to call per-render (a few Date operations).
export function weekBounds() {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  const today0 = d.getTime();
  const dow = d.getDay() || 7; // Sun=0 → 7 so Mon=1..Sun=7
  const weekStart = today0 - (dow - 1) * 86400000;
  return {
    today0,
    todayEnd: today0 + 86400000,
    weekStart,
    weekEnd: weekStart + 7 * 86400000,
  };
}

// Partitions pre-sorted items into TODAY / THIS WEEK / EARLIER groups.
// `timeGetter(item)` must return a millisecond timestamp. Items with no parseable
// time fall into EARLIER. Empty groups are dropped from the output.
export function groupByRecency(sortedItems, timeGetter, bounds) {
  const { today0, weekStart } = bounds;
  const today = [], thisWeek = [], earlier = [];
  for (const item of sortedItems) {
    const t = timeGetter(item);
    if (!t)                  earlier.push(item);
    else if (t >= today0)    today.push(item);
    else if (t >= weekStart) thisWeek.push(item);
    else                     earlier.push(item);
  }
  return [
    { key: "today",    label: "TODAY",     items: today    },
    { key: "thisWeek", label: "THIS WEEK", items: thisWeek },
    { key: "earlier",  label: "EARLIER",   items: earlier  },
  ].filter(g => g.items.length > 0);
}
