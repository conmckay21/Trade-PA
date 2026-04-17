// ─── OfflineBanner.jsx ─────────────────────────────────────────────────
//
// Visual indicator for offline state and pending writes.
//
//   Offline + queued writes:  amber strip "Offline — 3 changes queued"
//   Offline + no queue:       amber strip "Offline — showing cached data"
//   Reconnect + drain:        green toast cycles through
//                             "Syncing 3 changes…" → "All synced" (or
//                             "1 change failed to sync" if errors)
//   Online, no queue:         nothing
//
// Subscribes to writeQueue's pub/sub so the count updates live as
// offline writes happen. On reconnect it kicks off drainQueue and
// watches the result.

import React, { useEffect, useRef, useState } from "react";
import { useOnlineStatus } from "../hooks/useOnlineStatus.js";
import {
  getPendingCount,
  onQueueChange,
  drainQueue,
} from "../lib/writeQueue.js";

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncState, setSyncState] = useState(null); // null | 'syncing' | 'synced' | 'failed'
  const [syncResult, setSyncResult] = useState(null); // { drained, failed }
  const prevOnline = useRef(isOnline);

  // Keep the pending count fresh. Subscribes to queue changes and also
  // polls on mount + online transition.
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const n = await getPendingCount();
      if (!cancelled) setPendingCount(n);
    };
    refresh();
    const unsubscribe = onQueueChange(refresh);
    return () => { cancelled = true; unsubscribe(); };
  }, []);

  // On offline → online transition, drain the queue and show progress.
  useEffect(() => {
    let timer;
    if (!prevOnline.current && isOnline) {
      (async () => {
        const countBefore = await getPendingCount();
        if (countBefore > 0) {
          setSyncState("syncing");
          const res = await drainQueue();
          setSyncResult(res);
          setSyncState(res.failed > 0 ? "failed" : "synced");
          timer = setTimeout(() => {
            setSyncState(null);
            setSyncResult(null);
          }, 3000);
        } else {
          // No queue — just show a brief "back online" flash
          setSyncState("synced");
          setSyncResult({ drained: 0, failed: 0 });
          timer = setTimeout(() => {
            setSyncState(null);
            setSyncResult(null);
          }, 2000);
        }
      })();
    }
    prevOnline.current = isOnline;
    return () => { if (timer) clearTimeout(timer); };
  }, [isOnline]);

  // ── Render ───────────────────────────────────────────────────────

  if (!isOnline) {
    const label = pendingCount > 0
      ? `Offline — ${pendingCount} change${pendingCount === 1 ? "" : "s"} queued`
      : "Offline — showing cached data";
    return <OfflineBar label={label} />;
  }

  if (syncState === "syncing") {
    return (
      <Toast color="#0ea5e9">
        <Spinner /> Syncing {pendingCount} change{pendingCount === 1 ? "" : "s"}…
      </Toast>
    );
  }

  if (syncState === "synced") {
    const n = syncResult?.drained ?? 0;
    const text = n > 0
      ? `Synced ${n} change${n === 1 ? "" : "s"}`
      : "Back online";
    return <Toast color="#10b981">✓ {text}</Toast>;
  }

  if (syncState === "failed") {
    const n = syncResult?.failed ?? 0;
    return (
      <Toast color="#f59e0b">
        ⚠ {n} change{n === 1 ? "" : "s"} failed to sync — will retry
      </Toast>
    );
  }

  return null;
}

// ─── Sub-components ─────────────────────────────────────────────────

function OfflineBar({ label }) {
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
        {label}
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

function Toast({ color, children }) {
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
        background: color,
        color: "#0a0a0a",
        fontFamily: "'DM Mono', ui-monospace, monospace",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.04em",
        borderRadius: 999,
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        animation: "tradepa-reconnect-in 0.25s ease-out",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {children}
      <style>{`
        @keyframes tradepa-reconnect-in {
          from { opacity: 0; transform: translate(-50%, -8px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
}

function Spinner() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        border: "2px solid rgba(0,0,0,0.25)",
        borderTopColor: "#0a0a0a",
        borderRadius: "50%",
        animation: "tradepa-spinner 0.8s linear infinite",
      }}
    >
      <style>{`
        @keyframes tradepa-spinner {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </span>
  );
}
