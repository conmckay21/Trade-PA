// ─── StateStrip.jsx ────────────────────────────────────────────────────
// The persistent state indicator for the hands-free voice loop.
// Always tells the user what the system is doing right now: Listening,
// Thinking, Speaking, or Auto-listening. Replaces the ambiguous current
// "Recording — tap Stop" banner.
//
// The animated waveform IS the state indicator — colour-coded per state.
// Reuse this component in:
//   - The full Hands-Free conversation screen (top of conversation)
//   - The VoicePanel bottom sheet (top of panel)
//   - Anywhere else the system is in a voice state
//
// Usage:
//   <StateStrip state="listening" onToggleHandsFree={() => toggle()} handsFreeOn={true} />
//   <StateStrip state="thinking" />
//   <StateStrip state="speaking" sub="Tap to interrupt" onTap={() => interrupt()} />
//
// Props:
//   state              — "listening" | "thinking" | "speaking" | "auto" | "idle"
//   sub                — optional string. Override the default sub-line.
//   onTap              — optional fn. Called when the strip is tapped.
//                        Useful for "tap to interrupt" while speaking.
//   onToggleHandsFree  — optional fn. Shows the HF toggle on the right.
//   handsFreeOn        — boolean. Required if onToggleHandsFree is provided.

import React from "react";
import { C, TINT, BORDER_COLOR, FONT, injectKeyframes } from "./tokens.js";

// Inject the wave animation keyframes once globally
injectKeyframes(
  "tradepa-state-strip",
  `@keyframes tradepa-wave {
     0%, 100% { transform: scaleY(0.4); }
     50% { transform: scaleY(1); }
   }`
);

const STATE_CONFIG = {
  listening: {
    color: C.green,
    bg: TINT.green,
    border: BORDER_COLOR.green,
    label: "Listening",
    defaultSub: "Pause to send · or say \"cancel\"",
    animate: true,
  },
  thinking: {
    color: C.amber,
    bg: TINT.amber,
    border: BORDER_COLOR.amber,
    label: "Thinking",
    defaultSub: "Working on it…",
    animate: true,
  },
  speaking: {
    color: C.blue,
    bg: TINT.blue,
    border: BORDER_COLOR.blue,
    label: "Speaking",
    defaultSub: "Tap to interrupt",
    animate: true,
  },
  auto: {
    color: C.green,
    bg: TINT.green,
    border: BORDER_COLOR.green,
    label: "Auto-listening",
    defaultSub: "Waiting for your next command",
    animate: true,
  },
  idle: {
    color: C.muted,
    bg: "transparent",
    border: C.border,
    label: "Idle",
    defaultSub: "Hands-free off",
    animate: false,
  },
};

export default function StateStrip({
  state = "idle",
  sub,
  onTap,
  onToggleHandsFree,
  handsFreeOn = false,
}) {
  const config = STATE_CONFIG[state] || STATE_CONFIG.idle;
  const subText = sub !== undefined ? sub : config.defaultSub;

  return (
    <div
      onClick={onTap}
      style={{
        padding: "10px 14px",
        borderRadius: 14,
        background: config.bg,
        border: `1px solid ${config.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        cursor: onTap ? "pointer" : "default",
        fontFamily: FONT.sans,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <Waveform color={config.color} animate={config.animate} />
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{
            fontSize: 12.5,
            fontWeight: 700,
            color: config.color,
            letterSpacing: "-0.01em",
          }}>
            {config.label}
          </div>
          {subText && (
            <div style={{
              fontSize: 10.5,
              color: C.muted,
              fontFamily: FONT.mono,
              marginTop: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {subText}
            </div>
          )}
        </div>
      </div>

      {onToggleHandsFree && (
        <div
          onClick={(e) => { e.stopPropagation(); onToggleHandsFree(); }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
            padding: "4px 8px",
            borderRadius: 8,
            background: "rgba(255, 255, 255, 0.05)",
            border: `1px solid ${C.border}`,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 28,
              height: 16,
              borderRadius: 10,
              position: "relative",
              background: handsFreeOn ? C.amber : C.surfaceHigh,
              transition: "background 0.15s",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 2,
                left: handsFreeOn ? 14 : 2,
                width: 12,
                height: 12,
                background: "#fff",
                borderRadius: "50%",
                transition: "left 0.15s",
              }}
            />
          </div>
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 9.5,
              color: C.text,
              letterSpacing: "0.04em",
              fontWeight: 600,
            }}
          >
            HF&nbsp;{handsFreeOn ? "ON" : "OFF"}
          </span>
        </div>
      )}
    </div>
  );
}

// Animated 6-bar waveform. When `animate` is true, bars pulse with stagger.
function Waveform({ color, animate }) {
  const heights = [6, 12, 16, 10, 14, 8];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        height: 16,
        flexShrink: 0,
      }}
    >
      {heights.map((h, i) => (
        <div
          key={i}
          style={{
            width: 2.5,
            height: h,
            background: color,
            borderRadius: 2,
            animation: animate
              ? `tradepa-wave 1.2s ease-in-out ${i * 0.15}s infinite`
              : "none",
            opacity: animate ? 1 : 0.4,
          }}
        />
      ))}
    </div>
  );
}
