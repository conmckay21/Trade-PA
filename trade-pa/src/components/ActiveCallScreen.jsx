import { useState, useEffect } from "react";

// ─── Softphone UI: Active call ───────────────────────────────────────────────
// Sister component to IncomingCallScreen. Uses hardcoded palette because
// softphone overlays are always-dark regardless of app theme.
export function ActiveCallScreen({ callerName, callerNumber, direction, startTime, muted, onMute, onHangUp, speaker, onSpeaker }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startTime]);
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const initials = callerName && callerName !== "Unknown" && callerName !== "Unknown caller"
    ? callerName.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: "linear-gradient(180deg,#0a2018 0%,#0f0f0f 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: "env(safe-area-inset-top,0px)", paddingBottom: "env(safe-area-inset-bottom,0px)" }}>
      <style>{`@keyframes activePulse{0%,100%{box-shadow:0 0 0 0 #22c55e40;}50%{box-shadow:0 0 0 16px #22c55e00;}}`}</style>
      <div style={{ fontSize: 12, color: "#22c55e", background: "#22c55e18", border: "1px solid #22c55e40", borderRadius: 20, padding: "4px 14px", marginBottom: 32, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {direction === "outbound" ? "Calling..." : "● Connected"}
      </div>
      <div style={{ width: 100, height: 100, borderRadius: "50%", background: "linear-gradient(135deg,#1a3320,#166534)", border: "3px solid #22c55e40", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 700, color: "#fff", fontFamily: "'DM Mono',monospace", marginBottom: 24, animation: "activePulse 2s ease infinite" }}>{initials}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: "#f0f0f0", marginBottom: 6, textAlign: "center", padding: "0 32px" }}>{callerName}</div>
      <div style={{ fontSize: 22, color: "#22c55e", fontFamily: "'DM Mono',monospace", marginBottom: 6, letterSpacing: "0.05em" }}>{fmt(elapsed)}</div>
      {callerNumber && <div style={{ fontSize: 12, color: "#4b5563", fontFamily: "'DM Mono',monospace", marginBottom: 52 }}>{callerNumber}</div>}
      <div style={{ display: "flex", gap: 32, alignItems: "flex-end", marginBottom: 48 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <button onClick={onMute} style={{ width: 56, height: 56, borderRadius: "50%", background: muted ? "#f59e0b" : "#1f2937", border: `2px solid ${muted ? "#f59e0b" : "#374151"}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, transition: "all 0.2s" }}>{muted ? "🔇" : "🎙️"}</button>
          <div style={{ fontSize: 11, color: "#6b7280" }}>{muted ? "Unmute" : "Mute"}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <button onClick={onHangUp} style={{ width: 70, height: 70, borderRadius: "50%", background: "#ef4444", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, boxShadow: "0 4px 20px #ef444460" }}>📵</button>
          <div style={{ fontSize: 11, color: "#6b7280" }}>End call</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <button onClick={onSpeaker} style={{ width: 56, height: 56, borderRadius: "50%", background: speaker ? "#3b82f6" : "#1f2937", border: `2px solid ${speaker ? "#3b82f6" : "#374151"}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, transition: "all 0.2s" }}>🔊</button>
          <div style={{ fontSize: 11, color: speaker ? "#3b82f6" : "#6b7280" }}>{speaker ? "Speaker on" : "Speaker"}</div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: "#374151", display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444" }} />
        Call is being recorded
      </div>
    </div>
  );
}
