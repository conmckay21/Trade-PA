// trade-pa/src/components/UpdateBanner.jsx
//
// Shows a subtle banner at the bottom of the screen when a new app version
// has been deployed and the service worker has finished installing it in
// the background. User can tap "Reload" for a clean boot on the new code,
// or dismiss it (comes back on next check).
//
// Relies on workbox-window (already a dep via vite-plugin-pwa) to hook into
// the same SW registration that Vite auto-injects. We don't re-register the
// SW here — we listen to lifecycle events on the existing registration.
//
// Why the reload button matters:
// The SW is configured with skipWaiting:true, so it auto-activates within
// seconds of deploy. But any open tab keeps using the JS that was loaded
// when the tab first opened — it won't see new code until the user either
// navigates within the SPA (which doesn't do a full page load) or reloads.
// This banner tells them to reload NOW for the latest features/fixes.

import { useEffect, useState } from "react";
import { Workbox } from "workbox-window";

export default function UpdateBanner() {
  const [updateReady, setUpdateReady] = useState(false);
  const [dismissedAt, setDismissedAt] = useState(0);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // In dev mode Vite doesn't register the SW — skip cleanly
    if (import.meta.env.DEV) return;

    const wb = new Workbox("/sw.js");

    // Fired when a new SW has installed and is waiting (or has activated
    // in skipWaiting mode). Either way, there's new code available.
    const onWaiting = () => setUpdateReady(true);
    const onActivated = (event) => {
      // Only flag if this wasn't the very first activation (first install
      // isn't an update — there's no previous version to replace).
      if (!event.isUpdate) return;
      setUpdateReady(true);
    };

    wb.addEventListener("waiting", onWaiting);
    wb.addEventListener("activated", onActivated);

    // Register. If already registered by Vite's auto-inject, workbox-window
    // attaches to the existing registration instead of duplicating it.
    wb.register().catch((err) => {
      // Non-fatal — push notifications and offline are nice-to-have
      console.log("[UpdateBanner] SW register:", err?.message || err);
    });

    // Also poll for updates every 30 minutes so long-lived tabs pick up
    // new versions without requiring a navigation event. Vite's
    // registerType:'autoUpdate' already does periodic checks but this
    // adds an extra safety net.
    const interval = setInterval(() => {
      wb.update().catch(() => {});
    }, 30 * 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // If user dismissed within the last 5 minutes, stay hidden — gives them
  // breathing room to finish what they were doing. Reappears after that.
  const recentlyDismissed = dismissedAt > 0 && Date.now() - dismissedAt < 5 * 60 * 1000;
  if (!updateReady || recentlyDismissed) return null;

  const handleReload = () => {
    // Full page reload. Unregister not needed — skipWaiting has already
    // activated the new SW, reload just fetches fresh HTML/JS which the
    // new SW will serve.
    window.location.reload();
  };

  const handleDismiss = () => {
    setDismissedAt(Date.now());
  };

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        // Sit above iOS safe-area and any bottom nav. 72px clears the tab
        // bar on mobile; desktop has no bottom nav so it just floats low.
        bottom: "max(72px, calc(env(safe-area-inset-bottom, 0px) + 72px))",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        background: "#1a1a1a",
        border: "1px solid #f59e0b",
        borderRadius: 12,
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
        maxWidth: "calc(100vw - 24px)",
        fontFamily: "'DM Mono', ui-monospace, monospace",
        animation: "tpUpdateBannerSlide 250ms ease-out",
      }}
    >
      <style>{`
        @keyframes tpUpdateBannerSlide {
          from { transform: translate(-50%, 20px); opacity: 0; }
          to   { transform: translate(-50%, 0);    opacity: 1; }
        }
      `}</style>
      <div style={{ fontSize: 18, lineHeight: 1 }} aria-hidden="true">✨</div>
      <div style={{ fontSize: 12, color: "#e5e5e5", lineHeight: 1.35 }}>
        <div style={{ fontWeight: 700 }}>New version available</div>
        <div style={{ color: "#a3a3a3", fontSize: 11 }}>Reload to get the latest.</div>
      </div>
      <button
        onClick={handleReload}
        style={{
          background: "#f59e0b",
          color: "#0f0f0f",
          border: "none",
          borderRadius: 8,
          padding: "7px 12px",
          fontSize: 12,
          fontWeight: 700,
          fontFamily: "'DM Mono', ui-monospace, monospace",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        Reload
      </button>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        style={{
          background: "transparent",
          color: "#737373",
          border: "none",
          borderRadius: 6,
          padding: "4px 8px",
          fontSize: 16,
          lineHeight: 1,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
