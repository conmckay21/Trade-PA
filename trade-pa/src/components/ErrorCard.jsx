// ─── ErrorCard.jsx ─────────────────────────────────────────────────────
// Red-bordered error card. Replaces inline raw stack traces in the
// AI conversation with plain-language errors plus collapsible technical
// detail.
//
// Important: the AI should NEVER speak the technical detail aloud. The
// `message` prop is what the AI says (and what the user reads); the
// `detail` prop is hidden behind a tap for support purposes.
//
// Usage:
//   <ErrorCard
//     message="Send failed — the email server timed out. Your draft is saved."
//     detail="FUNCTION_INVOCATION_FAILED lhr1::6wnt6-1776..."
//     onRetry={() => retrySend()}
//   />
//
// Props:
//   message     — string. Plain-English explanation. What the AI says aloud.
//   detail      — optional string. Technical detail (stack trace, error code).
//                 Hidden behind "Technical detail" disclosure.
//   onRetry     — optional fn. Shown as primary action if provided.
//   retryLabel  — optional string. Defaults to "Retry now".
//   onDismiss   — optional fn. Shown if no retry. Defaults to no dismiss.

import React, { useState } from "react";
import { C, TINT, BORDER_COLOR, FONT } from "./tokens.js";

export default function ErrorCard({
  message,
  detail,
  onRetry,
  retryLabel = "Retry now",
  onDismiss,
}) {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${BORDER_COLOR.red}`,
        borderLeft: `3px solid ${C.red}`,
        borderRadius: 14,
        overflow: "hidden",
        fontFamily: FONT.sans,
      }}
    >
      {/* Head — message + alert icon */}
      <div
        style={{
          padding: "10px 12px",
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: TINT.red,
            color: C.red,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            border: `1px solid ${BORDER_COLOR.red}`,
            marginTop: 1,
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0L3.16 16.25A2 2 0 005 19z" />
          </svg>
        </div>
        <div
          style={{
            fontSize: 12,
            color: C.text,
            flex: 1,
            lineHeight: 1.4,
          }}
        >
          {message}
        </div>
      </div>

      {/* Actions */}
      {(onRetry || onDismiss || detail) && (
        <div
          style={{
            padding: "0 12px 10px",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          {onRetry && (
            <button
              onClick={onRetry}
              style={{
                padding: "6px 12px",
                background: C.red,
                color: "#fff",
                border: "none",
                borderRadius: 7,
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: FONT.sans,
              }}
            >
              {retryLabel}
            </button>
          )}
          {!onRetry && onDismiss && (
            <button
              onClick={onDismiss}
              style={{
                padding: "6px 12px",
                background: "transparent",
                color: C.muted,
                border: `1px solid ${C.border}`,
                borderRadius: 7,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: FONT.sans,
              }}
            >
              Dismiss
            </button>
          )}
          {detail && (
            <button
              onClick={() => setShowDetail((v) => !v)}
              style={{
                marginLeft: "auto",
                background: "transparent",
                border: "none",
                padding: 0,
                fontSize: 10.5,
                color: C.muted,
                cursor: "pointer",
                fontFamily: FONT.mono,
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                letterSpacing: "0.02em",
              }}
            >
              {showDetail ? "Hide" : "Technical detail"}
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: showDetail ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.15s",
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Technical detail panel */}
      {showDetail && detail && (
        <div
          style={{
            margin: "0 12px 12px",
            padding: "10px 12px",
            background: "rgba(0, 0, 0, 0.3)",
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            fontFamily: FONT.mono,
            fontSize: 10.5,
            color: C.textDim,
            wordBreak: "break-all",
            whiteSpace: "pre-wrap",
            lineHeight: 1.5,
            maxHeight: 200,
            overflowY: "auto",
          }}
        >
          {detail}
        </div>
      )}
    </div>
  );
}
