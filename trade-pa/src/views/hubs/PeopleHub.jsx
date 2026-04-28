// ─── PeopleHub — People bottom-tab landing ──────────────────────────────
// Extracted verbatim from App.jsx during P8 (28 Apr 2026).
import { HubPage } from "../../components/HubPage.jsx";

export function PeopleHub({ setView, customers, enquiries }) {
  const customerCount = (customers || []).length;
  const newEnquiryCount = (enquiries || []).filter(e => !e.status || e.status === "new").length;
  return (
    <HubPage
      title="People"
      sub="Customers, team, and the inbox"
      rows={[
        {
          name: "Customers",
          meta: customerCount > 0 ? `${customerCount} customer${customerCount === 1 ? "" : "s"}` : "No customers yet",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M5 21c0-3.87 3.13-7 7-7s7 3.13 7 7" /></svg>,
          onClick: () => setView("Customers"),
        },
        {
          name: "Inbox Actions",
          meta: newEnquiryCount > 0 ? `${newEnquiryCount} new message${newEnquiryCount === 1 ? "" : "s"}` : "AI suggests actions from email",
          tint: newEnquiryCount > 0 ? "warn" : null,
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" /></svg>,
          onClick: () => setView("Inbox"),
        },
        {
          name: "Workers",
          meta: "PAYE staff and self-employed labour on your team",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
          onClick: () => setView("Workers"),
        },
        {
          name: "Subcontractors",
          meta: "Your go-to people for overflow work",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a3 3 0 015.36-1.857M17 4a3 3 0 100 6 3 3 0 000-6zM12 12a4 4 0 100-8 4 4 0 000 8zM7 4a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
          onClick: () => setView("Subcontractors"),
        },
        {
          name: "Reviews",
          meta: "Google, Checkatrade, Trustpilot feedback",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
          onClick: () => setView("Reviews"),
        },
      ]}
    />
  );
}
