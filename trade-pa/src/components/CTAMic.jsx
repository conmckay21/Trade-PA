// ─── CTAMic.jsx ────────────────────────────────────────────────────────
// Record-level voice button. Sits in the CTA bar of every detail screen
// (Job Card, Customer Detail, Invoice Detail, etc.) next to the primary
// action button. Tap to open the VoicePanel with the current record in
// scope.
//
// Visually distinct from the primary CTA: amber-soft tint with amber
// border, instead of the solid amber primary. The two don't compete.
//
// Animated subtle ring pulse signals "live affordance, not static icon".
//
// Usage:
//   <CTAMic onTap={() => openVoicePanel({ recordId: job.id })} />
//
// Props:
//   onTap     — fn. Called when user taps the mic.
//   active    — boolean. If true, show solid amber (mid-conversation).
//   ariaLabel — optional string.
//   size      — "md" (default 46px) | "lg" (52px). For different layouts.

import React from "react";
import { C, TINT, BORDER_COLOR, FONT, injectKeyframes } from "./tokens.js";

injectKeyframes(
  "tradepa-cta-mic",
  `@keyframes tradepa-cta-ring {
     0% { opacity: 0; transform: scale(0.95); }
     50% { opacity: 0.4; transform: scale(1.05); }
     100% { opacity: 0; transform: scale(1.15); }
   }`
);

export default function CTAMic({
  onTap,
  active = false,
  ariaLabel = "Voice action",
  size = "md",
}) {
  const dim = size === "lg" ? 52 : 46;
  const radius = size === "lg" ? 13 : 11;

  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={ariaLabel}
      style={{
        width: dim,
        height: dim,
        borderRadius: radius,
        background: active ? C.amber : TINT.amber,
        border: active ? `1.5px solid ${C.amber}` : `1.5px solid ${BORDER_COLOR.amber}`,
        color: active ? "#000" : C.amber,
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        flexShrink: 0,
        position: "relative",
        fontFamily: FONT.sans,
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
        <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
      </svg>
      {/* Ring pulse — subtle, signals live control */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: -3,
          borderRadius: radius + 3,
          border: `1.5px solid ${C.amber}`,
          opacity: 0,
          pointerEvents: "none",
          animation: "tradepa-cta-ring 2.2s ease-out infinite",
        }}
      />
    </button>
  );
}
