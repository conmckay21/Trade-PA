// ─── OfflineBanner.jsx ─────────────────────────────────────────────────
//
// Tiny visual cue for offline state.
//   - When offline: amber strip pinned to the top of the viewport,
//     reading "Offline — showing cached data".
//   - On transition from offline → online: green "Back online" toast
//     slides in for ~2.5s then disappears.
//   - When online (steady state): renders nothing.
//
// Mounted once near the top of AppInner (so it floats over every screen
// in the authenticated app). Does not render on the LandingPage because
// AppInner returns the landing early when user is null.
//
// Uses fixed positioning + safe-area-inset-top so it sits correctly on
// iOS PWAs where the notch / Dynamic Island area would otherwise hide it.

import React, { useEffect, useRef, useState } from "react";
import { useOnlineStatus } from "../hooks/useOnlineStatus.js";

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [showReconnect, setShowReconnect] = useState(false);
  const prevOnline = useRef(isOnline);

  useEffect(() => {
    // Only show the toast if we were offline and just came back.
    if (!prevOnline.current && isOnline) {
      setShowReconnect(true);
      const t = setTimeout(() => setShowReconnect(false), 2500);
      prevOnline.current = isOnline;
      return () => clearTimeout(t);
    }
    prevOnline.current = isOnline;
  }, [isOnline]);

  if (isOnline && !showReconnect) return null;

  // Offline — persistent amber strip
  if (!isOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          paddingTop: "max(6px, env(safe-area-inset-top, 6px))",
          paddingBottom: 6,
          paddingLeft: 16,
          paddingRight: 16,
          background: "#f59e0b",
          color: "#0a0a0a",
          fontFamily: "'DM Mono', ui-monospace, monospace",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.04em",
          textAlign: "center",
          boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#0a0a0a",
              animation: "tradepa-offline-pulse 1.8s ease-in-out infinite",
            }}
          />
          Offline — showing cached data
        </span>
        <style>{`
          @keyframes tradepa-offline-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.35; }
          }
        `}</style>
      </div>
    );
  }

  // Online again — green toast, auto-dismisses
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: "max(12px, env(safe-area-inset-top, 12px))",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        padding: "8px 16px",
        background: "#10b981",
        color: "#0a0a0a",
        fontFamily: "'DM Mono', ui-monospace, monospace",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.04em",
        borderRadius: 999,
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        animation: "tradepa-reconnect-in 0.25s ease-out",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13 }}>✓</span>
        Back online
      </span>
      <style>{`
        @keyframes tradepa-reconnect-in {
          from { opacity: 0; transform: translate(-50%, -8px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
}
