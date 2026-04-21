// trade-pa/src/components/UpdateBanner.jsx
//
// Shows a subtle banner at the bottom of the screen when a new app version
// has been deployed. User can tap "Reload" for a clean boot on the new code,
// tap "What's new" to read the changelog without reloading, or dismiss it
// (reappears after a short cooldown so they don't miss it forever).
//
// HOW UPDATE DETECTION WORKS:
// The build emits /public/version.json containing the build timestamp (see
// vite.config.js's versionJsonPlugin). On app load we capture the current
// version. Every minute we poll /version.json with a cache-buster — if the
// version we see differs from the one we started with, a new deploy has
// landed and we show the banner.
//
// We DELIBERATELY don't use service worker lifecycle events (waiting,
// activated) because the push-notification SW skips waiting on install,
// so those events never fire reliably. A simple fetch-and-compare loop
// is far more robust across browsers and SW configurations.
//
// The banner also shows when the visibility changes back to "visible"
// (user returns to the tab) — catches updates that landed while the app
// was backgrounded.

import { useEffect, useState, useRef } from "react";
import ChangelogModal from "./ChangelogModal.jsx";

// Poll interval — every 60 seconds. Light enough not to matter for bandwidth
// (version.json is <50 bytes), frequent enough that a tradie sees the banner
// within a minute of a deploy. Tab-visible polling only — when backgrounded
// we pause to save battery, then check immediately on return.
const POLL_INTERVAL_MS = 60 * 1000;
// Dismiss cooldown — after the user taps × the banner stays hidden for 5
// minutes, then reappears so they don't permanently miss the update.
const DISMISS_COOLDOWN_MS = 5 * 60 * 1000;

export default function UpdateBanner() {
  const [updateReady, setUpdateReady] = useState(false);
  const [dismissedAt, setDismissedAt] = useState(0);
  const [changelogOpen, setChangelogOpen] = useState(false);
  // Captured at first successful fetch — never changes for the lifetime of
  // this app instance. This is "what version were we running when we loaded".
  const baselineVersionRef = useRef(null);

  useEffect(() => {
    // Disabled in dev — version.json is only emitted by `vite build`, so a
    // dev server would 404 the polls and clutter the console with errors.
    if (import.meta.env.DEV) return;

    let cancelled = false;

    // Single-shot fetch + compare. Cache-buster ensures we never get a stale
    // copy from any layer (browser cache, SW cache, CDN edge cache).
    const checkVersion = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const v = data?.version;
        if (!v) return;
        if (cancelled) return;
        // First successful fetch establishes the baseline.
        if (baselineVersionRef.current === null) {
          baselineVersionRef.current = v;
          return;
        }
        // Subsequent fetches compare against baseline.
        if (v !== baselineVersionRef.current) {
          setUpdateReady(true);
        }
      } catch (err) {
        // Silent — network glitches are expected (offline, server hiccup).
        // Next poll will try again.
      }
    };

    // Capture baseline on mount.
    checkVersion();

    // Poll on interval, but only while tab is visible — saves battery on
    // backgrounded PWAs.
    let intervalId = null;
    const startPolling = () => {
      if (intervalId) return;
      intervalId = setInterval(checkVersion, POLL_INTERVAL_MS);
    };
    const stopPolling = () => {
      if (!intervalId) return;
      clearInterval(intervalId);
      intervalId = null;
    };

    // When the tab becomes visible again, check immediately (catches updates
    // that landed while user was on another tab / had screen locked) then
    // resume polling.
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkVersion();
        startPolling();
      } else {
        stopPolling();
      }
    };

    if (document.visibilityState === "visible") startPolling();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const recentlyDismissed = dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS;
  const bannerVisible = updateReady && !recentlyDismissed;

  // Hard reload — bypasses HTTP cache. The new SW will take over on the
  // fresh page load. SW skipWaiting + clientsClaim is already configured,
  // so no extra dance needed.
  const handleReload = () => {
    // Some browsers honour a cache-busting query on reload; harmless if not.
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("_v", Date.now().toString());
      window.location.replace(url.toString());
    } catch {
      window.location.reload();
    }
  };
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
