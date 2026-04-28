// ─── Calendar date helpers ────────────────────────────────────────────────
// Hoisted from App.jsx during P7 prelude (28 Apr 2026). Verbatim move —
// no behavioural changes. Used by Dashboard, Schedule and DiaryHub. Lives
// alongside lib/time.js (which holds localDate/Month/Year, weekBounds,
// groupByRecency); kept as a separate file to avoid touching the existing
// time.js exports surface during the refactor. Can be merged in a later
// cleanup pass.

export function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
