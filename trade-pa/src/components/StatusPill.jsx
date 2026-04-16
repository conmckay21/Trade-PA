// ─── StatusPill.jsx ────────────────────────────────────────────────────
// One pill component for every status across the app. Replaces the
// inconsistent treatment of "BACS ONLY", "SENT", "ACCEPTED", "to order"
// etc. with a single colour-coded pill system.
//
// Usage:
//   <StatusPill status="overdue" />              → red "● Overdue" pill
//   <StatusPill status="paid" />                 → green "● Paid" pill
//   <StatusPill status="invoiced" label="Sent" /> → amber "● Sent" pill
//   <StatusPill variant="amber">14 days</StatusPill> → custom amber pill
//
// Props:
//   status   — string. Looked up in STATUS_COLOR map (see tokens.js).
//   label    — optional string. Override what's displayed (status drives colour).
//   variant  — optional string. Force a colour family ("amber" | "green" |
//              "red" | "blue" | "purple" | "muted"). Used when content
//              isn't a recognised status.
//   children — optional. Custom pill content.
//   dot      — boolean (default true). Show the leading "●" indicator.
//   size     — "sm" (default) | "md". Larger pill for more prominent contexts.
//   icon     — optional ReactNode. Replaces the leading dot (e.g. ✓ or !).

import React from "react";
import { C, TINT, BORDER_COLOR, FONT, statusColor } from "./tokens.js";

export default function StatusPill({
  status,
  label,
  variant,
  children,
  dot = true,
  size = "sm",
  icon = null,
}) {
  // Resolve colour family: explicit variant > status lookup > muted
  const family = variant || statusColor(status);

  // Resolve display text: children > label > formatted status
  const text = children !== undefined && children !== null
    ? children
    : (label || formatStatus(status));

  const colour = family === "muted" ? C.muted : C[family];
  const bg = family === "muted" ? TINT.muted : TINT[family];
  const border = family === "muted" ? C.border : BORDER_COLOR[family];

  const sizes = {
    sm: { fontSize: 9.5, padding: "3px 7px", radius: 5, gap: 3, dotSize: 5 },
    md: { fontSize: 11, padding: "4px 9px", radius: 6, gap: 4, dotSize: 6 },
  };
  const sz = sizes[size] || sizes.sm;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: sz.gap,
        fontFamily: FONT.mono,
        fontSize: sz.fontSize,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        padding: sz.padding,
        borderRadius: sz.radius,
        color: colour,
        background: bg,
        border: `1px solid ${border}`,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {icon ? (
        <span style={{ display: "inline-flex", alignItems: "center" }}>{icon}</span>
      ) : dot ? (
        <span
          style={{
            width: sz.dotSize,
            height: sz.dotSize,
            borderRadius: "50%",
            background: colour,
            display: "inline-block",
            flexShrink: 0,
          }}
        />
      ) : null}
      {text}
    </span>
  );
}

// Pretty-print a raw status string for display.
//   "in_progress" → "In progress"
//   "to_order"    → "To order"
//   "OVERDUE"     → "Overdue"
function formatStatus(s) {
  if (!s) return "";
  const cleaned = String(s).toLowerCase().replace(/[_-]/g, " ").trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
