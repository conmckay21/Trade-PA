// ─── OfflineBanner.jsx ─────────────────────────────────────────────────
//
// Visual indicator for offline state and pending writes.
//
// Session 4b additions:
//   - Whole banner / toast is clickable → opens OfflineSettings modal
//   - Small corner badge shows when failed writes exist (even online with
//     no pending) so user can always reach retry/discard UI

import React, { useEffect, useRef, useState } from "react";
import { useOnlineStatus } from "../hooks/useOnlineStatus.js";
import {
  getPendingCount,
  onQueueChange,
  drainQueue,
  listAllPending,
} from "../lib/writeQueue.js";

export default function OfflineBanner({ onOpenSettings }) {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [syncState, setSyncState] = useState(null); // null | 'syncing' | 'synced' | 'failed'
  const [syncResult, setSyncResult] = useState(null);
  const prevOnline = useRef(isOnline);

  // Keep pending + failed counts fresh
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const [p, all] = await Promise.all([
        getPendingCount(),
        listAllPending(),
      ]);
      if (!cancelled) {
        setPendingCount(p);
        setFailedCount(all.filter((e) => e.status === "failed").length);
      }
    };
    refresh();
    const unsubscribe = onQueueChange(refresh);
    return () => { cancelled = true; unsubscribe(); };
  }, []);

  // Offline → online: drain
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

  const openSettings = () => {
    if (onOpenSettings) onOpenSettings();
  };

  // ── Render priority ──────────────────────────────────────────────
  // 1. Offline → amber strip (clickable)
  // 2. Online + syncing → blue toast (clickable)
  // 3. Online + synced/failed toast → transient feedback (clickable)
  // 4. Online + idle + failed writes exist → small amber pill (clickable)
  // 5. Online + idle + no failed → nothing

  if (!isOnline) {
    const label = pendingCount > 0
      ? `Offline — ${pendingCount} change${pendingCount === 1 ? "" : "s"} queued`
      : "Offline — showing cached data";
    return <OfflineBar label={label} onClick={openSettings} />;
  }

  if (syncState === "syncing") {
    return (
      <Toast color="#0ea5e9" onClick={openSettings}>
        <Spinner /> Syncing {pendingCount} change{pendingCount === 1 ? "" : "s"}…
      </Toast>
    );
  }

  if (syncState === "synced") {
    const n = syncResult?.drained ?? 0;
    const text = n > 0 ? `Synced ${n} change${n === 1 ? "" : "s"}` : "Back online";
    return (
      <Toast color="#10b981" onClick={openSettings}>
        ✓ {text}
      </Toast>
    );
  }

  if (syncState === "failed") {
    const n = syncResult?.failed ?? 0;
    return (
      <Toast color="#f59e0b" onClick={openSettings}>
        ⚠ {n} change{n === 1 ? "" : "s"} failed — tap to review
      </Toast>
    );
  }

  if (failedCount > 0) {
    return <FailedPill count={failedCount} onClick={openSettings} />;
  }

  return null;
}

// ─── Sub-components ─────────────────────────────────────────────────

function OfflineBar({ label, onClick }) {
  return (
    <div
      role="status"
      aria-live="polite"
      onClick={onClick}
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0,
        zIndex: 9999,
        paddingTop: "max(6px, env(safe-area-inset-top, 6px))",
        paddingBottom: 6,
        paddingLeft: 16, paddingRight: 16,
        background: "#f59e0b",
        color: "#0a0a0a",
        fontFamily: "'DM Mono', ui-monospace, monospace",
        fontSize: 12, fontWeight: 700, letterSpacing: "0.04em",
        textAlign: "center",
        boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            display: "inline-block",
            width: 6, height: 6,
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

function Toast({ color, children, onClick }) {
  return (
    <div
      role="status"
      aria-live="polite"
      onClick={onClick}
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
        fontSize: 12, fontWeight: 700, letterSpacing: "0.04em",
        borderRadius: 999,
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        animation: "tradepa-reconnect-in 0.25s ease-out",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        cursor: onClick ? "pointer" : "default",
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

function FailedPill({ count, onClick }) {
  return (
    <div
      role="status"
      onClick={onClick}
      style={{
        position: "fixed",
        top: "max(12px, env(safe-area-inset-top, 12px))",
        right: 12,
        zIndex: 9998,
        padding: "5px 10px",
        background: "#2a0a0a",
        border: "1px solid #ef4444",
        color: "#ef4444",
        fontFamily: "'DM Mono', ui-monospace, monospace",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.04em",
        borderRadius: 999,
        cursor: "pointer",
        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
      }}
    >
      ⚠ {count} sync issue{count === 1 ? "" : "s"}
    </div>
  );
}

function Spinner() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 10, height: 10,
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
