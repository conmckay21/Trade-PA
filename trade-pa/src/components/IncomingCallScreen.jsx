import { useState, useEffect } from "react";

// ─── Softphone UI: Incoming call ─────────────────────────────────────────────
// Sister component to ActiveCallScreen. Both use hardcoded brand-blue / brand-
// green palettes rather than theme tokens because softphone overlays are
// always-dark regardless of app theme — matches native iOS Phone aesthetic.
export function IncomingCallScreen({ callerName, callerNumber, onAnswer, onDecline }) {
  const [dots, setDots] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDots(d => (d + 1) % 4), 500);
    return () => clearInterval(t);
  }, []);
  const initials = callerName && callerName !== "Unknown caller" && callerName !== "Unknown"
    ? callerName.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: "linear-gradient(180deg, #0a1628 0%, #0f0f0f 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <style>{`
        @keyframes ringPulse { 0% { transform:scale(1);opacity:0.6; } 50%,100% { transform:scale(1.5);opacity:0; } }
        @keyframes ringPulse2 { 0% { transform:scale(1);opacity:0.4; } 50%,100% { transform:scale(1.8);opacity:0; } }
      `}</style>
      <div style={{ position: "relative", width: 100, height: 100, marginBottom: 32 }}>
        <div style={{ position: "absolute", inset: -20, borderRadius: "50%", border: "2px solid #3b82f6", animation: "ringPulse 1.5s ease-out infinite" }} />
        <div style={{ position: "absolute", inset: -20, borderRadius: "50%", border: "2px solid #3b82f6", animation: "ringPulse2 1.5s ease-out 0.4s infinite" }} />
        <div style={{ width: 100, height: 100, borderRadius: "50%", background: "linear-gradient(135deg,#1e3a5f,#2563eb)", border: "3px solid #3b82f680", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 700, color: "#fff", fontFamily: "'DM Mono',monospace" }}>{initials}</div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: "#f0f0f0", marginBottom: 8, textAlign: "center", padding: "0 32px" }}>{callerName}</div>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 6 }}>Incoming call{".".repeat(dots)}</div>
      {callerNumber && <div style={{ fontSize: 13, color: "#4b5563", fontFamily: "'DM Mono',monospace", marginBottom: 60 }}>{callerNumber}</div>}
      <div style={{ display: "flex", gap: 60, alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <button onClick={onDecline} style={{ width: 70, height: 70, borderRadius: "50%", background: "#ef4444", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, boxShadow: "0 4px 20px #ef444460" }}>📵</button>
          <div style={{ fontSize: 11, color: "#6b7280" }}>Decline</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <button onClick={onAnswer} style={{ width: 70, height: 70, borderRadius: "50%", background: "#22c55e", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, boxShadow: "0 4px 20px #22c55e60" }}>📞</button>
          <div style={{ fontSize: 11, color: "#6b7280" }}>Answer</div>
        </div>
      </div>
    </div>
  );
}
