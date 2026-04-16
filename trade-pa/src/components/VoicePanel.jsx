// ─── VoicePanel.jsx ────────────────────────────────────────────────────
// Contextual mini-conversation in a bottom sheet. Triggered by the CTAMic
// on detail screens. Keeps the user on the current screen (record stays
// visible above the panel) while letting them act on it by voice.
//
// Composes BottomSheet + StateStrip + a transcript area. Uses the same
// state vocabulary as the full Hands-Free conversation, just in a smaller
// container.
//
// Usage:
//   const [voiceOpen, setVoiceOpen] = useState(false);
//   const [voiceState, setVoiceState] = useState("listening");
//   const [transcript, setTranscript] = useState("");
//
//   <VoicePanel
//     open={voiceOpen}
//     onClose={() => setVoiceOpen(false)}
//     contextEyebrow="VOICE · IN CONTEXT"
//     contextName="QTE-836 · Trevor Kinsman"
//     state={voiceState}
//     transcript={transcript}
//     onOpenFullChat={() => goToFullHandsFree()}
//   />
//
// Props:
//   open            — boolean. Controls visibility.
//   onClose         — fn. Called when user dismisses (backdrop, swipe-down, cancel).
//   contextEyebrow  — optional string. Small uppercase label ("VOICE · IN CONTEXT").
//   contextName     — string. The record being acted on (e.g. "QTE-836 · Trevor Kinsman").
//   state           — "listening" | "thinking" | "speaking" | "auto" | "idle".
//                     Drives the StateStrip colour and animation.
//   stateSub        — optional string. Override the StateStrip sub-line.
//   transcript      — optional string. Live transcription text.
//   children        — optional. Extra content rendered inside the transcript area
//                     (e.g. a ReceiptCard or ConfirmationCard mid-conversation).
//   onOpenFullChat  — optional fn. Shows "Open chat ↗" link in the header.
//   onTapState      — optional fn. Forwarded to StateStrip onTap (for "tap to interrupt").

import React from "react";
import BottomSheet from "./BottomSheet.jsx";
import StateStrip from "./StateStrip.jsx";
import { C, FONT, injectKeyframes } from "./tokens.js";

injectKeyframes(
  "tradepa-voice-panel",
  `@keyframes tradepa-vp-cursor {
     50% { opacity: 0; }
   }`
);

export default function VoicePanel({
  open,
  onClose,
  contextEyebrow = "VOICE · IN CONTEXT",
  contextName,
  state = "listening",
  stateSub,
  transcript,
  children,
  onOpenFullChat,
  onTapState,
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      height="56%"
      showHandle={true}
      showClose={false}
      footer={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              background: C.surfaceHigh,
              border: `1px solid ${C.border}`,
              color: C.text,
              fontSize: 11.5,
              padding: "9px 14px",
              borderRadius: 9,
              cursor: "pointer",
              fontWeight: 600,
              fontFamily: FONT.sans,
            }}
          >
            Cancel
          </button>
          <div
            style={{
              fontSize: 10,
              color: C.muted,
              fontFamily: FONT.mono,
              letterSpacing: "0.04em",
              textAlign: "right",
            }}
          >
            SWIPE DOWN TO CLOSE
          </div>
        </div>
      }
    >
      {/* Custom header — overrides default sheet header to show context */}
      <div
        style={{
          padding: "8px 16px 12px",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 9.5,
              color: C.muted,
              letterSpacing: "0.10em",
              fontWeight: 600,
              marginBottom: 2,
            }}
          >
            {contextEyebrow}
          </div>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 700,
              color: C.text,
              letterSpacing: "-0.01em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {contextName}
          </div>
        </div>
        {onOpenFullChat && (
          <button
            type="button"
            onClick={onOpenFullChat}
            style={{
              background: C.surfaceHigh,
              border: `1px solid ${C.border}`,
              color: C.muted,
              fontSize: 10.5,
              padding: "6px 9px",
              borderRadius: 8,
              cursor: "pointer",
              fontFamily: FONT.mono,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              flexShrink: 0,
            }}
          >
            Open chat
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 5l7 7-7 7M3 12h18" />
            </svg>
          </button>
        )}
      </div>

      {/* State strip */}
      <div style={{ padding: "12px 14px 10px" }}>
        <StateStrip state={state} sub={stateSub} onTap={onTapState} />
      </div>

      {/* Transcript area */}
      <div style={{ padding: "10px 18px 14px" }}>
        {transcript && (
          <>
            <div
              style={{
                fontSize: 11,
                color: C.muted,
                fontFamily: FONT.mono,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              You said
            </div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 500,
                lineHeight: 1.4,
                color: C.text,
                letterSpacing: "-0.01em",
              }}
            >
              {transcript}
              {state === "listening" && (
                <span
                  style={{
                    display: "inline-block",
                    width: 2,
                    height: 18,
                    background: C.amber,
                    marginLeft: 2,
                    verticalAlign: "middle",
                    animation: "tradepa-vp-cursor 1s steps(2) infinite",
                  }}
                />
              )}
            </div>
          </>
        )}

        {/* Slot for inline cards (Receipt / Confirmation / Error) */}
        {children && <div style={{ marginTop: transcript ? 14 : 0 }}>{children}</div>}
      </div>
    </BottomSheet>
  );
}
