import { C } from "../theme/colors.js";

// ─── Floating Mic (Phase 5a) ──────────────────────────────────────────────────
// Persistent voice affordance, bottom-right, on every non-AI screen. Tap routes
// the user to the AI Assistant overlay sheet with the current screen's context
// injected into the system prompt. Hidden when the user is already on the AI
// Assistant view (redundant there — the hero mic is the entry point).
// Colour hints at hands-free state: amber when inactive, green when HF is on.
export function FloatingMicButton({ visible, handsFree, onTap }) {
  if (!visible) return null;
  const tint = handsFree ? C.green : C.amber;
  return (
    <button
      onClick={onTap}
      aria-label="Talk to Trade PA"
      style={{
        position: "fixed",
        right: 16,
        bottom: "calc(84px + env(safe-area-inset-bottom, 0px))",
        width: 52, height: 52,
        borderRadius: "50%",
        background: `linear-gradient(180deg, ${tint === C.green ? "#34d399" : "#fbbf24"}, ${tint})`,
        border: `2px solid ${tint}cc`,
        boxShadow: `0 8px 24px -6px ${tint}80, 0 0 0 10px ${tint}15`,
        color: "#000",
        display: "grid", placeItems: "center",
        cursor: "pointer",
        zIndex: 320,
        padding: 0,
        transition: "transform 0.15s, box-shadow 0.15s",
      }}
      onMouseDown={e => e.currentTarget.style.transform = "scale(0.94)"}
      onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
      onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
        <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
      </svg>
      {handsFree && (
        <div style={{
          position: "absolute", top: -2, right: -2,
          width: 12, height: 12, borderRadius: "50%",
          background: C.green,
          border: `2px solid ${C.bg}`,
          animation: "bellPulse 1.4s ease infinite",
        }} />
      )}
    </button>
  );
}
