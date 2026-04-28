import React from "react";
import { useTheme } from "../theme/ThemeProvider.jsx";
import { DARK_PALETTE, LIGHT_PALETTE } from "../theme/colors.js";

// ─────────────────────────────────────────────────────────────────────────
// Notifications — in-app feed backed by the in_app_notifications table.
//
// Receives the list of notifications as props from AppInner (which loads
// and polls). Handles UX: tap to mark-as-read + navigate to the URL,
// swipe/tap to dismiss, "mark all as read" button.
//
// Visual language matches Reminders so it feels consistent with the
// existing "inbox-style" views in the app.
// ─────────────────────────────────────────────────────────────────────────
export function Notifications({ notifications, onMarkRead, onMarkAllRead, onDismiss, onOpen }) {
  const { theme } = useTheme();
  const palette = theme === "dark" ? DARK_PALETTE : LIGHT_PALETTE;
  const C = new Proxy({}, { get: (_, k) => `var(--c-${k})` });

  const hasUnread = notifications.some(n => !n.read_at);

  if (notifications.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔔</div>
        <div style={{ fontSize: 15, color: C.text, fontWeight: 600, marginBottom: 4 }}>No notifications yet</div>
        <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.5, maxWidth: 320, margin: "0 auto" }}>
          When a customer opens one of your quote or invoice portal links, you'll see it here.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 16px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0 4px" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: C.muted, letterSpacing: "0.1em", fontWeight: 700 }}>
          RECENT · {notifications.length}
        </div>
        {hasUnread && (
          <button
            onClick={onMarkAllRead}
            style={{
              background: "transparent",
              border: "none",
              color: C.amber,
              fontFamily: "'DM Mono', monospace",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.06em",
              cursor: "pointer",
              padding: 0,
              textTransform: "uppercase",
            }}
          >Mark all read</button>
        )}
      </div>

      {notifications.map(n => {
        const unread = !n.read_at;
        const when = (() => {
          const ms = Date.now() - new Date(n.created_at).getTime();
          const mins = Math.floor(ms / 60000);
          if (mins < 1) return "Just now";
          if (mins < 60) return `${mins}m ago`;
          const hours = Math.floor(mins / 60);
          if (hours < 24) return `${hours}h ago`;
          const days = Math.floor(hours / 24);
          if (days < 7) return `${days}d ago`;
          return new Date(n.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
        })();
        return (
          <div
            key={n.id}
            onClick={() => onOpen(n)}
            style={{
              background: unread ? `${palette.amber}12` : "var(--c-surfaceHigh)",
              border: `1px solid ${unread ? `${palette.amber}40` : "var(--c-border)"}`,
              borderRadius: 12,
              padding: "12px 14px",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              gap: 4,
              position: "relative",
            }}
          >
            {unread && (
              <div style={{
                position: "absolute",
                top: 14, right: 14,
                width: 8, height: 8,
                borderRadius: "50%",
                background: palette.amber,
              }} />
            )}
            <div style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 14,
              fontWeight: 700,
              color: C.text,
              letterSpacing: "-0.01em",
              paddingRight: unread ? 24 : 0,
            }}>{n.title}</div>
            <div style={{
              fontSize: 12.5,
              color: C.textDim,
              lineHeight: 1.5,
            }}>{n.body}</div>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 4,
            }}>
              <div style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                color: C.muted,
                letterSpacing: "0.05em",
              }}>{when}</div>
              <button
                onClick={(e) => { e.stopPropagation(); onDismiss(n.id); }}
                aria-label="Dismiss"
                style={{
                  background: "transparent",
                  border: "none",
                  color: C.muted,
                  cursor: "pointer",
                  padding: 4,
                  fontSize: 14,
                  lineHeight: 1,
                }}
              >✕</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
