import { useEffect } from "react";
import { C } from "../theme/colors.js";

// ─── Detail Page (Phase 4) ────────────────────────────────────────────────────
// Unified full-screen wrapper for detail views (Job, Invoice, and any future
// detail surface). Replaces the old "centred card on dimmed backdrop" modal
// pattern per the audit: opaque background, back button top-left in the
// easy-reach zone, no list bleed-through, ESC to close.
// API:
//   title       — main heading (required)
//   subtitle    — eyebrow line (optional)
//   onBack      — close/back handler (required)
//   rightHeader — optional React node shown right of the header (e.g. Edit btn)
//   maxWidth    — optional numeric cap on content column (default: full width)
//   heroStrip   — optional node rendered immediately below the app bar, inside
//                 the scroll container — good for status-pill rows, summary
//                 bands, or warning banners that want full-width background.
export function DetailPage({ title, subtitle, onBack, rightHeader, maxWidth, heroStrip, children }) {
  // ESC closes — matches desktop/tablet expectation
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onBack && onBack(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onBack]);

  return (
    <div style={{
      position: "fixed", inset: 0,
      zIndex: 300,
      background: C.bg,
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* App bar — back chevron top-left, title centred by flex, optional right slot */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 12px",
        paddingTop: "max(10px, env(safe-area-inset-top, 10px))",
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          aria-label="Back"
          style={{
            width: 40, height: 40, flexShrink: 0,
            display: "grid", placeItems: "center",
            background: "transparent", border: "none",
            color: C.text, cursor: "pointer",
            borderRadius: 8, padding: 0,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          {subtitle && (
            <div style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {subtitle}
            </div>
          )}
          {title && (
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {title}
            </div>
          )}
        </div>
        {rightHeader && <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>{rightHeader}</div>}
      </div>

      {/* Optional hero strip (full width, under app bar, inside scroll container) */}
      {heroStrip && (
        <div style={{ flexShrink: 0 }}>{heroStrip}</div>
      )}

      {/* Scrollable content column */}
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{
          maxWidth: maxWidth || 640,
          margin: "0 auto",
          width: "100%",
          padding: "14px 12px 28px",
          boxSizing: "border-box",
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}
