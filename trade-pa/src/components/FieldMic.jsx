// ─── FieldMic.jsx ──────────────────────────────────────────────────────
// Per-field voice input button. Three visual states: idle, listening,
// populated. Designed to attach to any text input as the right-edge
// affordance.
//
// IMPORTANT: This component is the visual control only. It does not
// transcribe audio itself — the parent screen's existing useWhisper /
// AI normalisation logic handles that. FieldMic just renders the button
// and reports tap events.
//
// Usage:
//   const [phone, setPhone] = useState("");
//   const [micState, setMicState] = useState("idle");
//
//   <FieldMic
//     state={micState}
//     onTap={() => {
//       setMicState("listening");
//       startVoiceCapture("phone").then((normalised) => {
//         setPhone(normalised);
//         setMicState("populated");
//         setTimeout(() => setMicState("idle"), 2000);  // revert after 2s
//       });
//     }}
//   />
//
// Two layout modes:
//   variant="standalone" (default) — square button, can sit anywhere
//   variant="attached"             — flush right edge of an input wrapper
//
// Props:
//   state    — "idle" | "listening" | "populated"
//   onTap    — fn. Called when user taps the mic.
//   variant  — "standalone" | "attached"
//   size     — "sm" (default 30px) | "md" (44px). For attached, height
//              auto-fills the parent.
//   ariaLabel — optional. Accessibility label.

import React from "react";
import { C, TINT, BORDER_COLOR, FONT, injectKeyframes } from "./tokens.js";

injectKeyframes(
  "tradepa-field-mic",
  `@keyframes tradepa-mic-pulse {
     0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.5); }
     50% { box-shadow: 0 0 0 6px rgba(245,158,11,0); }
   }`
);

const MIC_ICON = (
  <svg
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
    width="13"
    height="13"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"
    />
  </svg>
);

const STOP_ICON = (
  <svg fill="currentColor" viewBox="0 0 24 24" width="12" height="12">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

const CHECK_ICON = (
  <svg
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    viewBox="0 0 24 24"
    width="13"
    height="13"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export default function FieldMic({
  state = "idle",
  onTap,
  variant = "standalone",
  size = "sm",
  ariaLabel,
}) {
  const dim = size === "md" ? 44 : 30;

  // Resolve colour scheme by state
  const styles = {
    idle: {
      background: variant === "attached" ? "transparent" : "transparent",
      color: C.muted,
      borderColor: variant === "attached" ? "transparent" : C.border,
      icon: MIC_ICON,
      animation: "none",
    },
    listening: {
      background: C.amber,
      color: "#000",
      borderColor: C.amber,
      icon: STOP_ICON,
      animation: "tradepa-mic-pulse 1.2s ease-in-out infinite",
    },
    populated: {
      background: TINT.green,
      color: C.green,
      borderColor: BORDER_COLOR.green,
      icon: CHECK_ICON,
      animation: "none",
    },
  };
  const s = styles[state] || styles.idle;

  // Attached variant: render with no border on three sides, fills parent height
  if (variant === "attached") {
    return (
      <button
        type="button"
        onClick={onTap}
        aria-label={ariaLabel || "Dictate"}
        style={{
          width: 44,
          background: s.background,
          border: "none",
          borderLeft: `1px solid ${C.border}`,
          color: s.color,
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          transition: "all 0.15s",
          fontFamily: FONT.sans,
          animation: s.animation,
          ...(state === "listening" ? { borderLeftColor: C.amber } : {}),
          ...(state === "populated" ? { borderLeftColor: BORDER_COLOR.green } : {}),
        }}
      >
        {s.icon}
      </button>
    );
  }

  // Standalone variant: square button
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={ariaLabel || "Dictate"}
      style={{
        width: dim,
        height: dim,
        borderRadius: 8,
        background: s.background,
        border: `1px solid ${s.borderColor}`,
        color: s.color,
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        flexShrink: 0,
        transition: "all 0.15s",
        animation: s.animation,
      }}
    >
      {s.icon}
    </button>
  );
}
