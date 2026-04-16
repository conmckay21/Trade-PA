// ─── ConfirmationCard.jsx ──────────────────────────────────────────────
// Amber-bordered "confirm before sending" card. Triggers when the AI is
// about to take an action that has real-world consequences if wrong:
// external send (email, SMS), references a transcribed proper noun or
// email, references a fuzzy-matched entity, duplicates a recent action.
//
// Voice-friendly: the user can say "confirm", "edit", or "cancel" instead
// of tapping. The voice hint is shown explicitly at the bottom.
//
// Usage:
//   <ConfirmationCard
//     title="Confirm before sending"
//     prompt="I heard this — please check before I send:"
//     rows={[
//       { key: "TO",       value: "connor_mckay777@gmail.com" },
//       { key: "CUSTOMER", value: "Glenn Mackay" },
//       { key: "INVOICE",  value: "INV-246 · £2,000" },
//     ]}
//     onConfirm={() => sendEmail()}
//     onEdit={() => openEditor()}
//     onCancel={() => discardAction()}
//     confirmLabel="Send"
//   />
//
// Props:
//   title         — string. Headline of the confirmation card.
//   prompt        — optional string. Explanatory line above the data block.
//   rows          — array of { key, value }. The data the AI is about to act on.
//   onConfirm     — fn. Required. Called when user confirms.
//   onEdit        — optional fn. Called when user wants to edit the data.
//   onCancel      — fn. Required. Called when user cancels.
//   confirmLabel  — optional string. Button label (defaults to "Confirm").
//   editLabel     — optional string. Button label (defaults to "Edit").
//   cancelLabel   — optional string. Button label (defaults to "Cancel").
//   voiceHint     — optional boolean (default true). Show "OR JUST SAY..." line.

import React from "react";
import { C, TINT, FONT } from "./tokens.js";

export default function ConfirmationCard({
  title = "Confirm before sending",
  prompt,
  rows = [],
  onConfirm,
  onEdit,
  onCancel,
  confirmLabel = "Confirm",
  editLabel = "Edit",
  cancelLabel = "Cancel",
  voiceHint = true,
}) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid rgba(245, 158, 11, 0.4)`,
        borderLeft: `3px solid ${C.amber}`,
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: `0 0 24px rgba(245, 158, 11, 0.08)`,
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
          background: TINT.amber,
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: C.amber,
            color: "#000",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          {/* Alert / question icon */}
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 9v2m0 4h.01" />
          </svg>
        </div>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            color: C.amber,
            flex: 1,
          }}
        >
          {title}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "10px 12px" }}>
        {prompt && (
          <div
            style={{
              fontSize: 12,
              color: C.text,
              lineHeight: 1.4,
              marginBottom: 10,
            }}
          >
            {prompt}
          </div>
        )}

        {rows.length > 0 && (
          <div
            style={{
              background: "rgba(0, 0, 0, 0.25)",
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: "8px 10px",
              marginBottom: 12,
            }}
          >
            {rows.map((row, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  padding: "2px 0",
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
                    flexShrink: 0,
                  }}
                >
                  {row.key}
                </span>
                <span
                  style={{
                    color: C.text,
                    fontWeight: 600,
                    fontFamily: FONT.mono,
                    fontSize: 11,
                    textAlign: "right",
                    wordBreak: "break-all",
                  }}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: "9px 10px",
              border: "none",
              borderRadius: 9,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: FONT.sans,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              background: C.amber,
              color: "#000",
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {confirmLabel}
          </button>
          {onEdit && (
            <button
              onClick={onEdit}
              style={{
                flex: 1,
                padding: "9px 10px",
                borderRadius: 9,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: FONT.sans,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                background: "transparent",
                color: C.text,
                border: `1px solid ${C.border}`,
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
                <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {editLabel}
            </button>
          )}
          <button
            onClick={onCancel}
            style={{
              padding: "9px 14px",
              borderRadius: 9,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: FONT.sans,
              background: "transparent",
              color: C.muted,
              border: `1px solid ${C.border}`,
            }}
          >
            {cancelLabel}
          </button>
        </div>

        {voiceHint && (
          <div
            style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: `1px solid ${C.border}`,
              fontSize: 10,
              color: C.muted,
              textAlign: "center",
              fontFamily: FONT.mono,
              letterSpacing: "0.04em",
            }}
          >
            OR JUST SAY "{confirmLabel.toUpperCase()}" / "{editLabel.toUpperCase()}" / "{cancelLabel.toUpperCase()}"
          </div>
        )}
      </div>
    </div>
  );
}
