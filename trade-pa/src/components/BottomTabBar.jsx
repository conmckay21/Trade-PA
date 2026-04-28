import { C } from "../theme/colors.js";

// ─── BottomTabBar — Session B (mobile only, coexists with top nav) ──────────
// 5-tab bottom navigation per the new Home-centric design:
// Home · Jobs · Diary · Money · People
// Each bottom tab maps to an existing internal view until Session C consolidates.
export function BottomTabBar({ view, setView, isDesktopBrowser }) {
  if (isDesktopBrowser) return null; // desktop has side nav; skip bottom bar entirely

  // Map each bottom tab to its primary internal view and a set of "related" views
  // that should light it up when active. Session C will consolidate these into
  // proper containers with internal routers.
  const TABS = [
    {
      id: "Home",
      label: "Home",
      view: "AI Assistant",
      activeOn: ["AI Assistant", "Dashboard"],
      icon: (active) => (
        <svg viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 10.5L12 3l9 7.5V21a1 1 0 01-1 1h-5v-7h-6v7H4a1 1 0 01-1-1V10.5z" />
        </svg>
      ),
    },
    {
      id: "Jobs",
      label: "Jobs",
      view: "JobsHub",
      activeOn: ["JobsHub", "Jobs", "Enquiries", "Materials", "Stock", "RAMS", "Documents"],
      icon: (active) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
        </svg>
      ),
    },
    {
      id: "Diary",
      label: "Diary",
      view: "DiaryHub",
      activeOn: ["DiaryHub", "Schedule", "Reminders"],
      icon: (active) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 11h18" />
        </svg>
      ),
    },
    {
      id: "Accounts",
      label: "Accounts",
      view: "AccountsHub",
      activeOn: ["AccountsHub", "Invoices", "Quotes", "Payments", "Expenses", "Mileage", "CIS", "Reports"],
      icon: (active) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <circle cx="12" cy="12" r="2.5" />
          <path d="M6 10h.01M18 14h.01" />
        </svg>
      ),
    },
    {
      id: "People",
      label: "People",
      view: "PeopleHub",
      activeOn: ["PeopleHub", "Customers", "Workers", "Subcontractors", "Reviews", "Inbox"],
      icon: (active) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M5 21c0-3.87 3.13-7 7-7s7 3.13 7 7" />
        </svg>
      ),
    },
  ];

  // Which tab is "active" based on current view
  const activeTabId = TABS.find(t => t.activeOn.includes(view))?.id;

  return (
    <nav
      aria-label="Main navigation"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 95, // above content, below modals (which are 100+)
        // Translucent surface + backdrop blur — the bg colour comes from the
        // theme so light mode gets frosted-white (native iOS look) and dark
        // mode keeps the existing near-black. See tabBarBg in DARK/LIGHT_PALETTE.
        background: C.tabBarBg,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderTop: `1px solid ${C.border}`,
        paddingBottom: 0,
        // translateY(20px) shifts the bar physically down by 20px, bypassing iOS
        // safe-area clamping on bottom:0. To avoid cropping labels, the grid below
        // is taller (72 vs 52) and content is pinned to the TOP of the bar — the
        // extra 20px of empty space at the bottom goes off-screen (invisible).
        transform: "translateY(20px)",
      }}
    >
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          height: 72,
          maxWidth: 520,
          margin: "0 auto",
        }}>
          {TABS.map(tab => {
            const active = tab.id === activeTabId;
            return (
              <button
                key={tab.id}
                onClick={() => setView(tab.view)}
                aria-label={tab.label}
                aria-current={active ? "page" : undefined}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  gap: 4,
                  color: active ? C.amber : C.muted,
                  fontFamily: "'DM Sans', sans-serif",
                  padding: "6px 4px",
                  transition: "color 150ms ease",
                  position: "relative",
                }}
              >
                {/* Active indicator bar */}
                {active && (
                  <span style={{
                    position: "absolute",
                    top: 0,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 28,
                    height: 2,
                    borderRadius: 1,
                    background: C.amber,
                  }} />
                )}
                <div style={{ width: 22, height: 22 }}>{tab.icon(active)}</div>
                <div style={{
                  fontSize: 10,
                  fontWeight: active ? 700 : 500,
                  letterSpacing: "0.01em",
                }}>{tab.label}</div>
              </button>
            );
          })}
        </div>
      </nav>
  );
}
