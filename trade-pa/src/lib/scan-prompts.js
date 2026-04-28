// ─── Vision scan prompts ──────────────────────────────────────────────────
// Hoisted from App.jsx during P7 prelude (28 Apr 2026). Verbatim move —
// no behavioural changes. Used by AIAssistant (P10) and SubcontractorsTab.

export const SUB_INVOICE_SCAN_PROMPT =
  "You are reading a UK subcontractor invoice. Extract and return ONLY valid JSON with these keys: " +
  "subcontractor_name, invoice_number, date (YYYY-MM-DD), labour_amount (number, ex-VAT), " +
  "material_items (array of {desc, amount} ex-VAT), materials_total (number, sum of material_items), " +
  "gross_total (number, labour + materials ex-VAT), vat_rate (0, 5, or 20), vat_amount (number), " +
  "description (brief summary of work). " +
  "If labour and materials are not split out separately, put full amount in labour_amount and leave material_items empty.";
