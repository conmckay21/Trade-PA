// ─── useOnlineStatus.js ────────────────────────────────────────────────
//
// Returns true when the browser believes it has a network connection.
// Listens to the native `online` / `offline` window events.
//
// Caveat: navigator.onLine is unreliable on some platforms — it can
// report true on a captive wifi with no real internet, or false when the
// radio is briefly off between cell towers. An active ping check is
// planned for Session 6 (Phase 4). For now the native signal is good
// enough for the UI offline banner and to gate write-queue flushes.
//
// Usage:
//   const isOnline = useOnlineStatus();
//   if (!isOnline) return <OfflineBanner />;

import { useEffect, useState } from "react";

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
