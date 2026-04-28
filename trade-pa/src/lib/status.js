// ─── Status colour/label maps ─────────────────────────────────────────────
// Hoisted from App.jsx during P7 prelude (28 Apr 2026). Verbatim move —
// no behavioural changes. Used by Schedule, Payments, Customers,
// InvoicesView, EnquiriesTab, JobsTab, PurchaseOrdersTab, MaterialRow
// and AIAssistant. Lifted to lib/ so each view can import it after extraction.
import { C } from "../theme/colors.js";

export const statusColor = { confirmed: C.green, pending: C.amber, quote_sent: C.blue, overdue: C.red, due: C.amber, paid: C.green, to_order: C.red, ordered: C.amber, collected: C.green, sent: C.amber, draft: C.muted };
export const statusLabel = { confirmed: "Confirmed", pending: "Pending", quote_sent: "Quote Sent", overdue: "Overdue", due: "Due Today", paid: "Paid", to_order: "To Order", ordered: "Ordered", collected: "Collected", sent: "Sent", draft: "Draft" };
