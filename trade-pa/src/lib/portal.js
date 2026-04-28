// Shared portal URL helper — used by PortalLinkPanel (component) and
// portalCtaBlock (HTML-email helper that stays in App.jsx). Hoisted out
// during Phase 3 so the component file doesn't need to reach back into
// App.jsx and to avoid duplicating the host-resolution logic.
export function portalUrl(token) {
  if (!token) return "";
  let host = "https://view.tradespa.co.uk";
  if (typeof window !== "undefined" && window.location?.origin) {
    const origin = window.location.origin;
    host = origin.includes("tradespa.co.uk") ? "https://view.tradespa.co.uk" : origin;
  }
  return `${host}/quote/${token}`;
}
