// Shared portal URL helper — used by PortalLinkPanel (component) and
// portalCtaBlock (HTML-email helper that stays in App.jsx). Always
// generates the production view.tradespa.co.uk URL, regardless of
// which platform the app is running on.
//
// History: until 19 May 2026, this read window.location.origin and
// only swapped to view.tradespa.co.uk when origin contained
// "tradespa.co.uk". In the native iOS/Android Capacitor app,
// window.location.origin is "capacitor://localhost", which fell
// through to using that as the host — producing useless
// capacitor://localhost/quote/TOKEN URLs in customer emails. Fixed
// by always returning the production URL; portal links never need
// to vary by device (they're for the recipient, not the sender).
export function portalUrl(token) {
  if (!token) return "";
  return `https://view.tradespa.co.uk/quote/${token}`;
}
