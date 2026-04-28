// ─── Format helpers ─────────────────────────────────────────────────────────
// Currency, VAT label, and relative-time formatters.
// Pure functions, no dependencies.

// Formats an ISO date as "just now" / "3m ago" / "2h ago" / "3d ago" / "2mo ago".
// Returns "" for falsy/unparseable input so callers can render conditionally.
export function relTime(iso) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!t) return "";
  const diff = Date.now() - t;
  if (diff < 60000) return "just now";
  const m = Math.floor(diff / 60000);
  if (m < 60)  return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24)  return h + "h ago";
  const d = Math.floor(h / 24);
  if (d < 7)   return d + "d ago";
  const w = Math.floor(d / 7);
  if (w < 5)   return w + "w ago";
  const mo = Math.floor(d / 30);
  if (mo < 12) return mo + "mo ago";
  return Math.floor(d / 365) + "y ago";
}

// Helper: build the payment reference string for a given invoice
export function vatLabel(inv) {
  if (!inv.vatEnabled) return "";
  if (inv.vatZeroRated) return "Zero Rate 0% — New Build";
  const t = inv.vatType || "income";
  const r = inv.vatRate || 20;
  if (t === "drc_income") return `Domestic Reverse Charge @ ${r}% Income`;
  if (t === "drc_expenses") return `Domestic Reverse Charge @ ${r}% Expenses`;
  if (t === "expenses") return `${r}% Expenses`;
  return `${r}% Income`;
}

// ── Currency formatter ───────────────────────────────────────────────────────
// Always shows 2 decimal places with thousands separators: £30,000.00
export function fmtCurrency(n) {
  const num = parseFloat(n) || 0;
  return "£" + num.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
// Short version for widgets: £30,000 (no decimals for whole numbers)
export function fmtAmount(n) {
  const num = parseFloat(n) || 0;
  const hasDecimals = num % 1 !== 0;
  return "£" + num.toLocaleString("en-GB", { minimumFractionDigits: hasDecimals ? 2 : 0, maximumFractionDigits: 2 });
}
