// ─── ReceiptCard.jsx ───────────────────────────────────────────────────
// Green-bordered "we did it" action confirmation card. Used whenever the
// AI (or the user) takes an action that needs an inline record:
// invoice sent, material added, time logged, mileage saved, etc.
//
// Replaces three different existing patterns (inline prose, top banner,
// the existing green "Chase sent" card) with one consistent treatment.
//
// Usage:
//   <ReceiptCard
//     title="Chase sent"
//     timestamp="just now"
//     rows={[
//       { key: "To",       value: "connor_mckay777@hotmail.co.uk" },
//       { key: "Customer", value: "Glenn Mackay" },
//       { key: "Invoice",  value: "INV-246 · £2,000" },
//     ]}
//     onView={() => openInvoice("INV-246")}
//     viewLabel="View invoice"
//     onUndo={() => undoChase()}
//   />
//
// Props:
//   title       — string. Headline ("Chase sent", "Material added", etc.)
//   timestamp   — optional string. Right-aligned relative time.
//   rows        — array of { key, value }. Structured proof of what happened.
//   onView      — optional fn. Click handler for the "View →" link.
//   viewLabel   — optional string. Defaults to "View →".
//   onUndo      — optional fn. Click handler for "Undo". Hidden if not provided.
//   undoSeconds — optional number. Hides Undo after N seconds (default: no auto-hide).

import React, { useState, useEffect } from "react";
import { C, TINT, BORDER_COLOR, FONT, relativeTime } from "./tokens.js";

export default function ReceiptCard({
  title,
  timestamp,
  rows = [],
  onView,
  viewLabel = "View →",
  onUndo,
  undoSeconds,
}) {
  const [undoVisible, setUndoVisible] = useState(true);

  // Auto-hide Undo affordance after N seconds (e.g. 30s)
  useEffect(() => {
    if (!undoSeconds || !onUndo) return;
    const t = setTimeout(() => setUndoVisible(false), undoSeconds * 1000);
    return () => clearTimeout(t);
  }, [undoSeconds, onUndo]);

  // Resolve timestamp: if it's a number/Date string, format it; otherwise use as-is.
  const displayTime = typeof timestamp === "string" && !timestamp.match(/^\d/)
    ? timestamp
    : relativeTime(timestamp);

  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${BORDER_COLOR.green}`,
        borderLeft: `3px solid ${C.green}`,
        borderRadius: 14,
        overflow: "hidden",
        fontFamily: FONT.sans,
      }}
    >
      {/* Head */}
      <div
        style={{
          padding: "10px 12px 8px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: TINT.green,
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: C.green,
            color: "#000",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            color: C.green,
            flex: 1,
          }}
        >
          {title}
        </div>
        {displayTime && (
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 9.5,
              color: C.muted,
            }}
          >
            {displayTime}
          </div>
        )}
      </div>

      {/* Body — structured rows */}
      {rows.length > 0 && (
        <div style={{ padding: "8px 12px 10px" }}>
          {rows.map((row, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11.5,
                padding: "3px 0",
                lineHeight: 1.3,
                gap: 8,
              }}
            >
              <span
                style={{
                  color: C.muted,
                  fontFamily: FONT.mono,
                  fontSize: 10,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  flexShrink: 0,
                }}
              >
                {row.key}
              </span>
              <span
                style={{
                  color: C.text,
                  fontWeight: 500,
                  textAlign: "right",
                  wordBreak: "break-word",
                }}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {(onView || (onUndo && undoVisible)) && (
        <div
          style={{
            padding: "6px 12px 10px",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          {onView && (
            <button
              onClick={onView}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                fontSize: 11,
                color: C.green,
                fontWeight: 700,
                fontFamily: FONT.sans,
                cursor: "pointer",
              }}
            >
              {viewLabel}
            </button>
          )}
          {onUndo && undoVisible && (
            <button
              onClick={onUndo}
              style={{
                marginLeft: "auto",
                background: "transparent",
                border: "none",
                padding: 0,
                fontSize: 11,
                color: C.muted,
                fontWeight: 600,
                fontFamily: FONT.sans,
                cursor: "pointer",
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
