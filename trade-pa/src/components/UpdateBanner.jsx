// trade-pa/src/components/UpdateBanner.jsx
//
// Shows a subtle banner at the bottom of the screen when a new app version
// has been deployed and the service worker has finished installing it in
// the background. User can tap "Reload" for a clean boot on the new code,
// tap "What's new" to read the changelog without reloading, or dismiss it
// (reappears after a short cooldown so they don't miss it forever).
//
// Relies on workbox-window (already a dep via vite-plugin-pwa) to hook into
// the same SW registration that Vite auto-injects.

import { useEffect, useState } from "react";
import { Workbox } from "workbox-window";
import ChangelogModal from "./ChangelogModal.jsx";

export default function UpdateBanner() {
  const [updateReady, setUpdateReady] = useState(false);
  const [dismissedAt, setDismissedAt] = useState(0);
  const [changelogOpen, setChangelogOpen] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (import.meta.env.DEV) return;

    const wb = new Workbox("/sw.js");

    const onWaiting = () => setUpdateReady(true);
    const onActivated = (event) => {
      if (!event.isUpdate) return;
      setUpdateReady(true);
    };

    wb.addEventListener("waiting", onWaiting);
    wb.addEventListener("activated", onActivated);

    wb.register().catch((err) => {
      console.log("[UpdateBanner] SW register:", err?.message || err);
    });

    const interval = setInterval(() => {
      wb.update().catch(() => {});
    }, 30 * 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const recentlyDismissed = dismissedAt > 0 && Date.now() - dismissedAt < 5 * 60 * 1000;
  const bannerVisible = updateReady && !recentlyDismissed;

  const handleReload = () => window.location.reload();
  const handleDismiss = () => setDismissedAt(Date.now());

  return (
    <>
      <ChangelogModal open={changelogOpen} onClose={() => setChangelogOpen(false)} />

      {bannerVisible && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
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
            <button
              onClick={() => setChangelogOpen(true)}
              style={{
                background: "transparent",
                color: "#f59e0b",
                border: "none",
                padding: 0,
                fontSize: 11,
                fontFamily: "inherit",
                cursor: "pointer",
                textDecoration: "underline",
                textUnderlineOffset: 2,
              }}
            >
              What's new →
            </button>
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
      )}
    </>
  );
}
