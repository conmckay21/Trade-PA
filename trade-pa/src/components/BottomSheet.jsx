// ─── BottomSheet.jsx ───────────────────────────────────────────────────
// Generic bottom sheet with drag handle, dark backdrop, and rounded top
// corners. Replaces the half-modal-with-page-bleed pattern across the
// app (Add Customer, Add Job, Edit flows, Voice Panel).
//
// Lifecycle:
//   open=true  → sheet slides up from bottom, backdrop appears
//   open=false → sheet slides down, backdrop fades out
//
// Dismissal:
//   - Tap backdrop          → onClose()
//   - Tap close button      → onClose() (only shown if onClose provided)
//   - Press Escape (web)    → onClose()
//   - Touch drag down       → not implemented in this primitive; can be
//                             added later via touch handlers
//
// Usage:
//   <BottomSheet
//     open={editingCustomer}
//     onClose={() => setEditingCustomer(null)}
//     title="Edit customer"
//     height="70%"
//   >
//     <CustomerForm ... />
//   </BottomSheet>
//
// Props:
//   open      — boolean. Controls visibility.
//   onClose   — fn. Called when user dismisses (backdrop, Escape, close btn).
//   title     — optional string. Shown in the sheet header.
//   height    — optional string (default "85%"). Max height of the sheet.
//   children  — sheet content. Will scroll if taller than the sheet.
//   footer    — optional ReactNode. Sticky footer (e.g. Save/Cancel buttons).
//   showHandle — boolean (default true). Show the drag handle.
//   showClose  — boolean (default true). Show the X button in the header.

import React, { useEffect } from "react";
import { C, FONT, injectKeyframes } from "./tokens.js";

injectKeyframes(
  "tradepa-bottom-sheet",
  `@keyframes tradepa-sheet-slide-up {
     from { transform: translateY(100%); }
     to   { transform: translateY(0); }
   }
   @keyframes tradepa-sheet-fade-in {
     from { opacity: 0; }
     to   { opacity: 1; }
   }`
);

export default function BottomSheet({
  open,
  onClose,
  title,
  height = "85%",
  children,
  footer,
  showHandle = true,
  showClose = true,
}) {
  // Escape key dismissal
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape" && onClose) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.55)",
          backdropFilter: "blur(3px)",
          WebkitBackdropFilter: "blur(3px)",
          zIndex: 999,
          animation: "tradepa-sheet-fade-in 0.2s ease-out",
        }}
      />
      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: C.surface,
          borderTopLeftRadius: 26,
          borderTopRightRadius: 26,
          borderTop: `1px solid ${C.border}`,
          borderLeft: `1px solid ${C.border}`,
          borderRight: `1px solid ${C.border}`,
          maxHeight: height,
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 -20px 60px rgba(0, 0, 0, 0.5)",
          zIndex: 1000,
          animation: "tradepa-sheet-slide-up 0.25s cubic-bezier(0.32, 0.72, 0, 1)",
          fontFamily: FONT.sans,
        }}
      >
        {/* Drag handle */}
        {showHandle && (
          <div
            style={{
              width: 36,
              height: 4,
              background: C.muted,
              borderRadius: 2,
              margin: "8px auto 4px",
              opacity: 0.5,
              flexShrink: 0,
            }}
          />
        )}

        {/* Header */}
        {(title || showClose) && (
          <div
            style={{
              padding: "8px 18px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
              borderBottom: `1px solid ${C.border}`,
            }}
          >
            {title ? (
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  color: C.text,
                }}
              >
                {title}
              </div>
            ) : <span />}
            {showClose && onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: C.surfaceHigh,
                  border: "none",
                  display: "grid",
                  placeItems: "center",
                  color: C.muted,
                  cursor: "pointer",
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Scrollable body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {children}
        </div>

        {/* Sticky footer */}
        {footer && (
          <div
            style={{
              padding: "11px 14px 22px",
              background: C.surface,
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderTop: `1px solid ${C.border}`,
              flexShrink: 0,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
