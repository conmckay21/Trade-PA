// ─── OfflineSettings.jsx ───────────────────────────────────────────────
//
// Full modal with three sections:
//   1. Cache — per-table row counts + last-synced times; refresh / clear
//   2. Pending — queued writes waiting to sync; "Sync now" button
//   3. Failed — writes that hit 3 retry attempts; retry / discard
//
// Rendered over the whole app as a dark overlay. Dismisses on overlay
// click, X button, or Escape.

import React, { useEffect, useState, useCallback } from "react";
import {
  getCacheStats,
  clearAllCache,
  readMeta,
} from "../lib/offlineDb.js";
import {
  listAllPending,
  drainQueue,
  retryFailedWrite,
  discardFailedWrite,
  retryAllFailed,
  discardAllFailed,
  onQueueChange,
} from "../lib/writeQueue.js";
import { prewarmCache } from "../lib/prewarm.js";

export default function OfflineSettings({ open, onClose }) {
  const [stats, setStats] = useState(null);
  const [queue, setQueue] = useState([]);
  const [busy, setBusy] = useState(null); // null | 'refresh' | 'clear' | 'sync' | 'retryAll' | 'discardAll'

  const refresh = useCallback(async () => {
    const [s, q] = await Promise.all([getCacheStats(), listAllPending()]);
    setStats(s);
    setQueue(q);
  }, []);

  // Live updates while the modal is open
  useEffect(() => {
    if (!open) return;
    refresh();
    const unsubscribe = onQueueChange(refresh);
    return unsubscribe;
  }, [open, refresh]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const pending = queue.filter((e) => e.status === "pending");
  const failed = queue.filter((e) => e.status === "failed");
  const tables = stats?.perTable || {};
  const populatedTables = Object.entries(tables)
    .filter(([, v]) => v.rows > 0)
    .sort(([a], [b]) => a.localeCompare(b));
  const emptyTables = Object.entries(tables)
    .filter(([, v]) => v.rows === 0)
    .sort(([a], [b]) => a.localeCompare(b));

  const doRefreshCache = async () => {
    setBusy("refresh");
    try { await prewarmCache(); await refresh(); }
    finally { setBusy(null); }
  };

  const doClearCache = async () => {
    if (!window.confirm("Clear all cached data? This removes IndexedDB content only. Your Supabase data is untouched.")) return;
    setBusy("clear");
    try { await clearAllCache(); await refresh(); }
    finally { setBusy(null); }
  };

  const doSyncNow = async () => {
    setBusy("sync");
    try { await drainQueue(); await refresh(); }
    finally { setBusy(null); }
  };

  const doRetry = async (id) => {
    await retryFailedWrite(id);
    refresh();
  };
  const doDiscard = async (id) => {
    if (!window.confirm("Discard this change? It will not be sent to Supabase.")) return;
    await discardFailedWrite(id);
    refresh();
  };
  const doRetryAll = async () => {
    setBusy("retryAll");
    try { await retryAllFailed(); await refresh(); }
    finally { setBusy(null); }
  };
  const doDiscardAll = async () => {
    if (!window.confirm(`Discard all ${failed.length} failed changes? This cannot be undone.`)) return;
    setBusy("discardAll");
    try { await discardAllFailed(); await refresh(); }
    finally { setBusy(null); }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        zIndex: 10000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "48px 16px 16px",
        overflowY: "auto",
        fontFamily: "'DM Mono', ui-monospace, monospace",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0f0f0f",
          color: "#eee",
          border: "1px solid #333",
          borderRadius: 12,
          maxWidth: 720,
          width: "100%",
          padding: 24,
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.04em", color: "#f59e0b" }}>
              OFFLINE
            </div>
            <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
              Cache, pending writes, failed writes
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={closeBtn}
          >×</button>
        </div>

        {/* Pending queue */}
        <Section
          title="Pending changes"
          subtitle={pending.length === 0
            ? "Nothing queued — all changes are synced"
            : `${pending.length} waiting to sync to Supabase`}
          accent={pending.length > 0 ? "#0ea5e9" : "#555"}
        >
          {pending.length > 0 && (
            <>
              <QueueTable entries={pending} />
              <div style={{ marginTop: 12 }}>
                <Btn onClick={doSyncNow} busy={busy === "sync"} primary>
                  {busy === "sync" ? "Syncing…" : "Sync now"}
                </Btn>
              </div>
            </>
          )}
        </Section>

        {/* Failed writes */}
        <Section
          title="Failed changes"
          subtitle={failed.length === 0
            ? "No failures"
            : `${failed.length} stopped after 3 retries — retry or discard`}
          accent={failed.length > 0 ? "#ef4444" : "#555"}
        >
          {failed.length > 0 && (
            <>
              {failed.map((f) => (
                <FailedRow key={f.id} entry={f} onRetry={doRetry} onDiscard={doDiscard} />
              ))}
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <Btn onClick={doRetryAll} busy={busy === "retryAll"}>
                  {busy === "retryAll" ? "Retrying…" : "Retry all"}
                </Btn>
                <Btn onClick={doDiscardAll} busy={busy === "discardAll"} danger>
                  {busy === "discardAll" ? "Discarding…" : "Discard all"}
                </Btn>
              </div>
            </>
          )}
        </Section>

        {/* Cache */}
        <Section
          title="Cached data"
          subtitle={stats
            ? `${populatedTables.length} tables with data, ${emptyTables.length} empty`
            : "Loading…"}
          accent="#555"
        >
          {stats && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {populatedTables.map(([name, info]) => (
                  <CacheRow key={name} name={name} info={info} />
                ))}
              </div>
              {emptyTables.length > 0 && (
                <details style={{ marginTop: 12, fontSize: 11, color: "#888" }}>
                  <summary style={{ cursor: "pointer", userSelect: "none" }}>
                    {emptyTables.length} empty tables (click to expand)
                  </summary>
                  <div style={{ marginTop: 8, paddingLeft: 12 }}>
                    {emptyTables.map(([n]) => n).join(", ")}
                  </div>
                </details>
              )}
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <Btn onClick={doRefreshCache} busy={busy === "refresh"}>
                  {busy === "refresh" ? "Refreshing…" : "Refresh cache"}
                </Btn>
                <Btn onClick={doClearCache} busy={busy === "clear"} danger>
                  {busy === "clear" ? "Clearing…" : "Clear cache"}
                </Btn>
              </div>
            </>
          )}
        </Section>

        <div style={{ marginTop: 20, fontSize: 10, color: "#555", textAlign: "center" }}>
          TradePA offline layer · write queue · local cache
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

function Section({ title, subtitle, accent, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{
          display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: accent,
        }} />
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em" }}>{title}</span>
      </div>
      <div style={{ fontSize: 11, color: "#888", marginBottom: 12 }}>{subtitle}</div>
      {children}
    </div>
  );
}

function QueueTable({ entries }) {
  return (
    <div style={{ border: "1px solid #222", borderRadius: 6, overflow: "hidden" }}>
      {entries.map((e, i) => (
        <div key={e.id} style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr auto",
          gap: 8,
          padding: "8px 12px",
          fontSize: 11,
          borderBottom: i < entries.length - 1 ? "1px solid #222" : "none",
          background: i % 2 ? "#0a0a0a" : "transparent",
        }}>
          <span style={{ color: "#ddd" }}>{e.table}</span>
          <span style={{ color: "#888" }}>{e.operation}</span>
          <span style={{ color: "#666" }}>{formatAgo(e.created_at)}</span>
          <span style={{ color: e.attempts > 0 ? "#f59e0b" : "#555" }}>
            {e.attempts > 0 ? `attempt ${e.attempts}` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

function FailedRow({ entry, onRetry, onDiscard }) {
  return (
    <div style={{
      border: "1px solid #441515",
      borderRadius: 6,
      padding: 12,
      marginBottom: 8,
      background: "#1a0a0a",
      fontSize: 11,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ color: "#ddd" }}>
          <strong>{entry.table}</strong> · {entry.operation}
        </span>
        <span style={{ color: "#666" }}>{formatAgo(entry.created_at)}</span>
      </div>
      <div style={{ color: "#ef4444", marginTop: 4, marginBottom: 8, fontSize: 10 }}>
        {entry.last_error || "Unknown error"}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn small onClick={() => onRetry(entry.id)}>Retry</Btn>
        <Btn small danger onClick={() => onDiscard(entry.id)}>Discard</Btn>
      </div>
    </div>
  );
}

function CacheRow({ name, info }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      padding: "6px 10px",
      fontSize: 11,
      background: "#161616",
      borderRadius: 4,
    }}>
      <span style={{ color: "#ddd" }}>{name}</span>
      <span style={{ color: "#888" }}>
        {info.rows} {info.lastCached ? `· ${formatAgo(info.lastCached)}` : ""}
      </span>
    </div>
  );
}

function Btn({ children, onClick, primary, danger, busy, small }) {
  const colours = danger
    ? { bg: "#2a0a0a", border: "#441515", color: "#ef4444" }
    : primary
      ? { bg: "#0a2238", border: "#0ea5e9", color: "#7dd3fc" }
      : { bg: "#161616", border: "#333", color: "#ddd" };
  return (
    <button
      onClick={onClick}
      disabled={busy}
      style={{
        background: colours.bg,
        border: `1px solid ${colours.border}`,
        color: colours.color,
        borderRadius: 6,
        padding: small ? "4px 10px" : "8px 14px",
        fontFamily: "inherit",
        fontSize: small ? 10 : 12,
        fontWeight: 700,
        letterSpacing: "0.04em",
        cursor: busy ? "wait" : "pointer",
        opacity: busy ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}

const closeBtn = {
  background: "transparent",
  border: "1px solid #333",
  color: "#888",
  fontSize: 20,
  width: 32,
  height: 32,
  borderRadius: "50%",
  cursor: "pointer",
  fontFamily: "inherit",
  lineHeight: 1,
  padding: 0,
};

function formatAgo(timestamp) {
  if (!timestamp) return "—";
  const t = typeof timestamp === "number" ? timestamp : Date.parse(timestamp);
  if (!Number.isFinite(t)) return "—";
  const secs = Math.floor((Date.now() - t) / 1000);
  if (secs < 0) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
