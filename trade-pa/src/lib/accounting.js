// ─── Accounting sync (Xero + QuickBooks) ─────────────────────────────────
// Hoisted from App.jsx during P7 prelude (28 Apr 2026). Verbatim move —
// no behavioural changes. Used by AIAssistant (3 calls), Payments (2 calls),
// and InvoicesView (2 calls). Fire-and-forget: failures are swallowed so a
// disconnected Xero/QuickBooks integration never blocks invoice flow.

export async function syncInvoiceToAccounting(userId, invoice) {
  if (!userId || !invoice) return;
  try {
    if (invoice.status === "paid") {
      // Mark as paid in Xero
      fetch("/api/xero/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, invoiceId: invoice.id }),
      }).catch(() => {});
      // Mark as paid in QuickBooks
      fetch("/api/quickbooks/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, invoiceId: invoice.id }),
      }).catch(() => {});
    } else {
      // Create invoice in both systems
      fetch("/api/xero/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, invoice }),
      }).catch(() => {});
      fetch("/api/quickbooks/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, invoice }),
      }).catch(() => {});
    }
  } catch (e) {
    console.log("Accounting sync skipped:", e.message);
  }
}
