import { C } from "../theme/colors.js";

// ─── HubPage — reusable hub layout for Session C (Pattern A navigation) ────
// Takes a title, optional sub, and an array of rows. Each row has icon, name,
// meta (status text), optional tint ("urgent" | "warn" | default), and onClick.
export function HubPage({ title, sub, rows }) {
  const iconTint = {
    urgent: { bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)", color: C.red },
    warn:   { bg: `${C.amber}1a`, border: `${C.amber}40`, color: C.amber },
    ok:     { bg: `${C.green}1a`, border: `${C.green}40`, color: C.green },
  };
  const metaColor = { urgent: C.red, warn: C.amber, ok: C.green };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Page header */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 4 }}>
        <div style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 10,
          color: C.amber,
          letterSpacing: "0.14em",
          fontWeight: 700,
          textTransform: "uppercase",
          marginBottom: 2,
        }}>{title}</div>
        <div style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: C.text,
          lineHeight: 1.1,
        }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>{sub}</div>}
      </div>

      {/* Rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((row, i) => {
          const tint = row.tint ? iconTint[row.tint] : null;
          return (
            <div
              key={i}
              onClick={row.onClick}
              style={{
                background: C.surfaceHigh,
                border: `1px solid ${C.border}`,
                borderRadius: 14,
                padding: 12,
                display: "grid",
                gridTemplateColumns: "40px 1fr auto",
                gap: 12,
                alignItems: "center",
                cursor: "pointer",
                transition: "background 150ms ease",
              }}
            >
              {/* Icon */}
              <div style={{
                width: 40, height: 40,
                borderRadius: 10,
                background: tint ? tint.bg : C.surface,
                border: `1px solid ${tint ? tint.border : C.border}`,
                color: tint ? tint.color : C.textDim,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}>
                <div style={{ width: 20, height: 20 }}>{row.icon}</div>
              </div>
              {/* Body */}
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  color: C.text,
                  marginBottom: 3,
                }}>{row.name}</div>
                <div style={{
                  fontSize: 11.5,
                  color: row.tint ? metaColor[row.tint] : C.textDim,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>{row.meta}</div>
              </div>
              {/* Chevron */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </div>
          );
        })}
      </div>
    </div>
  );
}
