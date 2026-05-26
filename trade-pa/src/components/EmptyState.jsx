import React from "react";
import { C } from "../theme/colors.js";

// Reusable empty state for any list/dashboard view.
//
// Usage:
//   <EmptyState
//     icon="customers"
//     title="No customers yet"
//     body="Add your first customer to start tracking jobs and sending them invoices."
//     ctaLabel="+ Add customer"
//     onCta={() => setShowAdd(true)}
//     voiceTip="Or say 'Add John Smith on 07700 900000 as a customer'"
//     helpSlug="customers"
//     onHelp={(slug) => openHelp(slug)}
//   />
//
// All props are optional except `title` and `body`. The component renders
// progressively — pass only what's relevant for the view.

const ICONS = {
  customers: (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  jobs: (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="M9 16l2 2 4-4" />
    </svg>
  ),
  diary: (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4" />
    </svg>
  ),
  invoices: (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  ),
  quotes: (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  ),
  materials: (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M2 13h20" />
    </svg>
  ),
  suppliers: (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" />
    </svg>
  ),
  stock: (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7L12 3 4 7v10l8 4 8-4V7z" />
      <path d="M12 12l8-5M12 12v9M12 12L4 7" />
    </svg>
  ),
  mileage: (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  expenses: (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  inbox: (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  ),
  enquiries: (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  documents: (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  ),
  rams: (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  team: (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  cis: (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  ),
  reminders: (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  generic: (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  ),
};

export default function EmptyState({
  icon = "generic",
  title,
  body,
  ctaLabel,
  onCta,
  secondaryCtaLabel,
  onSecondaryCta,
  voiceTip,
  helpSlug,
  onHelp,
  // Override colours if needed
  iconBg,
  iconColor,
  // Optional dense mode for compact areas
  dense = false,
}) {
  const IconSvg = ICONS[icon] || ICONS.generic;
  const padTop = dense ? 32 : 56;
  const padBottom = dense ? 28 : 48;
  const iconSize = dense ? 64 : 80;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: `${padTop}px 24px ${padBottom}px`,
        maxWidth: 440,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          width: iconSize,
          height: iconSize,
          borderRadius: "50%",
          background: iconBg || `${C.amber}1f`,
          color: iconColor || C.amber,
          display: "grid",
          placeItems: "center",
          marginBottom: 16,
        }}
        aria-hidden="true"
      >
        {IconSvg}
      </div>

      <h3
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: dense ? 16 : 18,
          fontWeight: 700,
          color: C.text,
          margin: 0,
          marginBottom: 6,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h3>

      {body && (
        <p
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 13,
            color: C.muted,
            lineHeight: 1.55,
            margin: 0,
            marginBottom: 18,
            maxWidth: 360,
          }}
        >
          {body}
        </p>
      )}

      {(ctaLabel || secondaryCtaLabel) && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: voiceTip || helpSlug ? 16 : 0 }}>
          {ctaLabel && (
            <button
              onClick={onCta}
              style={{
                background: C.amber,
                color: "#000",
                border: "none",
                borderRadius: 10,
                padding: "11px 18px",
                fontSize: 14,
                fontWeight: 700,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                cursor: "pointer",
                letterSpacing: "-0.01em",
              }}
            >
              {ctaLabel}
            </button>
          )}
          {secondaryCtaLabel && (
            <button
              onClick={onSecondaryCta}
              style={{
                background: "transparent",
                color: C.text,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: "11px 18px",
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                cursor: "pointer",
              }}
            >
              {secondaryCtaLabel}
            </button>
          )}
        </div>
      )}

      {voiceTip && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: `${C.surfaceHigh || "#1f1f1f"}`,
            border: `1px solid ${C.border}`,
            borderRadius: 999,
            padding: "8px 14px",
            marginBottom: 8,
            maxWidth: "100%",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
          </svg>
          <span
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 12,
              color: C.muted,
              letterSpacing: "-0.005em",
            }}
          >
            {voiceTip}
          </span>
        </div>
      )}

      {helpSlug && onHelp && (
        <button
          onClick={() => onHelp(helpSlug)}
          style={{
            background: "transparent",
            border: "none",
            color: C.muted,
            fontSize: 12,
            fontWeight: 600,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            cursor: "pointer",
            padding: "6px 8px",
            marginTop: 4,
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          What can I do here?
        </button>
      )}
    </div>
  );
}
