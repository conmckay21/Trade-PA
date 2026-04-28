// ─── AccountsHub — Accounts (formerly Money) bottom-tab landing ─────────
// Extracted verbatim from App.jsx during P8 (28 Apr 2026).
import { HubPage } from "../../components/HubPage.jsx";
import { fmtAmount } from "../../lib/format.js";

export function AccountsHub({ setView, invoices }) {
  const allInvoices = (invoices || []).filter(i => !i.isQuote);
  const allQuotes = (invoices || []).filter(i => i.isQuote);
  const overdue = allInvoices.filter(i => i.status === "overdue" || i.status === "due");
  const overdueValue = overdue.reduce((s, i) => s + (i.amount || 0), 0);
  const outstanding = allInvoices.filter(i => i.status !== "paid");
  return (
    <HubPage
      title="Accounts"
      sub="Money in, money out, and HMRC-ready records"
      rows={[
        {
          name: "Invoices",
          meta: overdueValue > 0
            ? `${fmtAmount(overdueValue)} overdue · ${outstanding.length} outstanding`
            : outstanding.length > 0
              ? `${outstanding.length} outstanding`
              : "All paid up",
          tint: overdueValue > 0 ? "urgent" : outstanding.length > 0 ? "warn" : "ok",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
          onClick: () => setView("Invoices"),
        },
        {
          name: "Quotes",
          meta: allQuotes.length > 0 ? `${allQuotes.length} quote${allQuotes.length === 1 ? "" : "s"}` : "No quotes",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12h6m-3-3v6m9-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
          onClick: () => setView("Quotes"),
        },
        {
          name: "Payments",
          meta: "Stripe and bank transfers",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 10h.01M18 14h.01" /></svg>,
          onClick: () => setView("Payments"),
        },
        {
          name: "Expenses",
          meta: "Receipts, tools, materials spend",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
          onClick: () => setView("Expenses"),
        },
        {
          name: "Mileage",
          meta: "HMRC-rate tracking, auto-calculated",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 2" /></svg>,
          onClick: () => setView("Mileage"),
        },
        {
          name: "CIS",
          meta: "Construction industry scheme statements",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
          onClick: () => setView("CIS"),
        },
        {
          name: "Reports",
          meta: "P&L, income, expenses summaries",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
          onClick: () => setView("Reports"),
        },
      ]}
    />
  );
}

// ─── PeopleHub — People bottom-tab landing ──────────────────────────────────
