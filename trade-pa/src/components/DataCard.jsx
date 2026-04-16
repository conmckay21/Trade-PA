// ─── DataCard.jsx ──────────────────────────────────────────────────────
// The Profit-card pattern, generalised. One card structure for every
// domain: Materials, Jobs, Invoices, Profit, Time, Customer history.
//
// Structure (top to bottom):
//   eyebrow        — small caps label ("MATERIALS", "JOBS")
//   title          — entity name ("Lisa Kinsman", "Q3 2026")
//   subtitle       — context line ("Single Storey Extension · 40 Blakemere")
//   summary stats  — 1-4 stats in a row (label + value, optionally coloured)
//   rows           — itemised list (name + meta + right-aligned value/pill)
//   actions        — primary + secondary action buttons in a footer
//
// Every section is optional. Use what you need.
//
// Usage:
//   <DataCard
//     eyebrow="MATERIALS"
//     title="Lisa Kinsman"
//     subtitle="Single Storey Extension · 40 Blakemere"
//     stats={[
//       { label: "ITEMS", value: "4" },
//       { label: "TO ORDER", value: "1", color: "red" },
//       { label: "SPEND", value: "£2,140", color: "amber" },
//     ]}
//     rows={[
//       {
//         name: "Stelrad K2 Radiators",
//         meta: "Plumbase · ×5 · £185",
//         right: <StatusPill status="delivered" />,
//         onClick: () => openMaterial(id),
//       },
//     ]}
//     actions={[
//       { label: "Open job", onClick: () => goToJob() },
//       { label: "Order remaining", onClick: () => order(), primary: true,
//         icon: <SomeIcon /> },
//     ]}
//   />
//
// Props:
//   eyebrow      — optional string. Small uppercase label above title.
//   title        — optional string. Main heading.
//   subtitle     — optional string. One-line context below title.
//   stats        — optional array of { label, value, color?, sub? }.
//                  color: "amber" | "green" | "red" | undefined (text colour).
//   rows         — optional array of { name, meta?, right?, onClick? }.
//                  right: any ReactNode (e.g. <StatusPill> or formatted £).
//   actions      — optional array of { label, onClick, primary?, icon? }.
//                  primary buttons get amber background, others are dark.
//   footerNote   — optional string. Small italic note below rows, before actions.
//   children     — optional. Custom content rendered inside the card body.

import React from "react";
import { C, FONT } from "./tokens.js";

export default function DataCard({
  eyebrow,
  title,
  subtitle,
  stats,
  rows,
  actions,
  footerNote,
  children,
}) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        overflow: "hidden",
        fontFamily: FONT.sans,
      }}
    >
      {/* HEAD */}
      {(eyebrow || title || subtitle) && (
        <div
          style={{
            padding: "12px 14px 10px",
            borderBottom: stats || rows || children ? `1px solid ${C.border}` : "none",
          }}
        >
          {eyebrow && (
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 9.5,
                color: C.muted,
                letterSpacing: "0.12em",
                fontWeight: 600,
                marginBottom: 4,
                textTransform: "uppercase",
              }}
            >
              {eyebrow}
            </div>
          )}
          {title && (
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: C.text,
                lineHeight: 1.25,
                letterSpacing: "-0.01em",
              }}
            >
              {title}
            </div>
          )}
          {subtitle && (
            <div
              style={{
                fontSize: 11,
                color: C.textDim,
                marginTop: 2,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
      )}

      {/* SUMMARY STATS */}
      {stats && stats.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
            gap: 8,
            padding: "10px 14px",
            borderBottom: rows || children ? `1px solid ${C.border}` : "none",
            background: "rgba(0, 0, 0, 0.15)",
          }}
        >
          {stats.map((stat, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 9,
                  color: C.muted,
                  letterSpacing: "0.08em",
                  fontWeight: 600,
                }}
              >
                {stat.label}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  marginTop: 2,
                  fontFamily: FONT.mono,
                  letterSpacing: "-0.02em",
                  color: stat.color === "amber" ? C.amber
                       : stat.color === "green" ? C.green
                       : stat.color === "red"   ? C.red
                       : stat.color === "blue"  ? C.blue
                       : C.text,
                }}
              >
                {stat.value}
              </div>
              {stat.sub && (
                <div style={{ fontSize: 9.5, color: C.muted, marginTop: 2 }}>
                  {stat.sub}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ROWS */}
      {rows && rows.length > 0 && rows.map((row, i) => (
        <div
          key={i}
          onClick={row.onClick}
          style={{
            padding: "10px 14px",
            borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : "none",
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: row.onClick ? "pointer" : "default",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: C.text,
                lineHeight: 1.25,
                marginBottom: row.meta ? 2 : 0,
              }}
            >
              {row.name}
            </div>
            {row.meta && (
              <div
                style={{
                  fontSize: 10.5,
                  color: C.muted,
                  fontFamily: FONT.mono,
                }}
              >
                {row.meta}
              </div>
            )}
          </div>
          {row.right && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexShrink: 0,
              }}
            >
              {row.right}
            </div>
          )}
        </div>
      ))}

      {/* CHILDREN (escape hatch) */}
      {children}

      {/* FOOTER NOTE */}
      {footerNote && (
        <div
          style={{
            padding: "10px 14px",
            fontSize: 11,
            color: C.muted,
            fontStyle: "italic",
            textAlign: "center",
            borderTop: `1px solid ${C.border}`,
            lineHeight: 1.4,
          }}
        >
          {footerNote}
        </div>
      )}

      {/* ACTIONS FOOTER */}
      {actions && actions.length > 0 && (
        <div
          style={{
            padding: "8px 12px",
            background: "rgba(0, 0, 0, 0.2)",
            display: "flex",
            gap: 6,
            borderTop: `1px solid ${C.border}`,
          }}
        >
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={action.onClick}
              style={{
                flex: 1,
                padding: "7px 10px",
                background: action.primary ? C.amber : C.surfaceHigh,
                color: action.primary ? "#000" : C.text,
                border: action.primary ? `1px solid ${C.amber}` : `1px solid ${C.border}`,
                borderRadius: 8,
                fontSize: 11,
                fontWeight: action.primary ? 700 : 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                fontFamily: FONT.sans,
              }}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
