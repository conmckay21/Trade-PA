// ─── Tool routing — per-message fixed-group tool scoping ────────────────────
// The voice assistant defines ~96 tools. Shipping all of them on every call is
// the dominant API input-token cost, and (because Anthropic's cache prefix is
// tools -> system -> messages) a tool list that changes shape from message to
// message also keeps invalidating the cached system prompt behind it.
//
// This module maps EVERY tool to exactly one place:
//   - ALWAYS_INCLUDE_TOOLS: read-only lookup + universal tools. Tiny schemas,
//     shipped on every call so Claude can resolve references ("the Smith job",
//     "that invoice") regardless of which action group is active.
//   - TOOL_CLUSTERS: action tools grouped by domain. Only the group(s) matching
//     the user's message get shipped.
//
// Why fixed groups (not an arbitrary per-message subset):
//   A given instruction maps to the same group every time, so the tool list is
//   byte-identical on repeat use within a domain and the cache actually hits.
//   The previous version only mapped ~38 of the 96 tools, so most commands fell
//   through to "ship everything", and the routing flip-flopped between a small
//   subset and the full catalogue — which thrashed the cache. Completing the map
//   removes both problems.
//
// Multi-intent: if a message matches more than one group, the groups union
//   (e.g. "invoice Steve and mark the job done" ships invoicing + jobs).
//
// Safety:
//   - RAMS active -> ship all tools (stateful multi-domain flow; left as-is).
//   - Zero groups matched -> ship all tools (correctness over cost). With the
//     map now complete this is rare, but it guarantees nothing ever breaks for
//     lack of a tool.
//
// Telemetry: classification is logged once per send() to usage_events so the
//   patterns can be tuned against real usage.

// Read-only lookups + universal actions. Constant base on every call.
export const ALWAYS_INCLUDE_TOOLS = [
  // Cross-domain lookups Claude needs to resolve references in any message.
  "find_invoice",
  "find_quote",
  "find_job_card",
  "find_material_receipt",
  "get_job_full",
  "get_job_profit",
  "list_schedule",
  "list_invoices",
  "list_jobs",
  "list_materials",
  "list_customers",
  // Universal, domain-agnostic.
  "save_memory",
  "restore_recently_deleted",
  "escalate_to_support",
];

// Action tools (and domain-specific lists) grouped by domain. A tool may appear
// in more than one group where it legitimately spans domains.
export const TOOL_CLUSTERS = {
  invoicing: [
    "create_invoice", "update_invoice", "delete_invoice",
    "mark_invoice_paid", "mark_invoice_paid_xero",
    "send_invoice", "chase_invoice",
    "create_invoice_from_job", "add_stage_payment", "list_unpaid",
    "create_quote", "update_quote", "send_quote",
    "convert_quote_to_invoice", "list_quotes",
  ],
  jobs: [
    "create_job", "update_job_status", "delete_job", "add_job_note",
    "create_job_card", "update_job_card", "delete_job_card",
    "assign_material_to_job",
  ],
  materials: [
    "create_material", "update_material", "delete_material",
    "update_material_status", "assign_material_to_job",
    "update_stock", "add_stock_item", "delete_stock_item", "list_stock",
    "send_supplier_order",
    "sync_material_to_xero", "sync_material_to_quickbooks",
  ],
  customers: [
    "create_customer", "delete_customer",
    "log_enquiry", "delete_enquiry", "list_enquiries",
    "send_review_request",
  ],
  time_mileage: [
    "log_time", "log_mileage", "delete_mileage", "list_mileage", "log_daywork",
  ],
  expenses: [
    "log_expense", "delete_expense", "list_expenses",
  ],
  cis: [
    "log_cis_statement", "delete_cis_statement", "list_cis_statements",
  ],
  subcontractors: [
    "add_subcontractor", "delete_subcontractor",
    "log_subcontractor_payment", "update_subcontractor_payment",
    "delete_subcontractor_payment", "generate_subcontractor_statement",
    "list_subcontractors",
  ],
  workers: [
    "add_worker", "update_worker", "delete_worker",
    "assign_worker_to_job", "log_worker_time", "add_worker_document",
    "list_workers", "list_expiring_documents",
  ],
  rams: [
    "start_rams", "rams_confirm_hazards", "delete_rams", "list_rams",
    "add_compliance_cert", "add_variation_order", "request_signature",
  ],
  reminders: [
    "set_reminder", "list_reminders",
  ],
  settings: [
    "update_brand",
  ],
  accounting: [
    "sync_to_xero", "sync_to_quickbooks",
  ],
  inbox: [
    "approve_inbox_action", "reject_inbox_action", "list_inbox_actions",
  ],
  reports: [
    "get_report",
  ],
};

// Keyword regex per group. Tuned for tradie phrasing — short verbs, common
// abbreviations, merchant and software names. Overlap between groups is fine:
// it just unions a few extra tools, which is cheaper than missing one.
export const CLUSTER_PATTERNS = {
  invoicing: /\b(invoic\w*|bill(ed|ing|s)?|quot\w*|paid|pay(ment|ing|s)?|owe\w*|owing|outstanding|chas\w*|due|deposit|stage payment|raise an?|send (it|the|that)|sent it|collect)\b/i,
  jobs: /\b(job\w*|booking|book(ed| in)?|schedul\w*|diary|calendar|appointment\w*|on[- ]?site|complet\w*|finish\w*|note\w*|job ?card|job ?sheet|day off|holiday)\b/i,
  materials: /\b(material\w*|suppl(y|ies|ier)|stock|reorder|to order|ordered|collect\w*|toolstation|screwfix|wickes|b&q|jewson|travis|merchant|purchase order|po for|po\d+|receipt|scan\w*)\b/i,
  customers: /\b(customer\w*|client\w*|enquir\w*|inquir\w*|new lead|lead\b|got a call|rang (up|me)|prospect\w*|review request|google review|leave a review)\b/i,
  time_mileage: /\b(mileage|miles|fuel|drove|driv\w*|hours?|time on|log(ged)? (time|hours)|time log|worked|clock\w*|day ?work)\b/i,
  expenses: /\b(expense\w*|spent|spend|outgoing\w*|cost me|paid out|petrol|parking|tools? cost|bought)\b/i,
  cis: /\b(cis|subcontractor tax|tax deduction|deduction\w*|cis statement|verif\w*|gross status)\b/i,
  subcontractors: /\b(subcontractor\w*|subbie\w*|sub\b|labour only|labour[- ]only|day rate)\b/i,
  workers: /\b(worker\w*|employee\w*|staff|team member|operative\w*|labourer\w*|apprentice\w*|document\w*|cert\w* expir\w*|expiring)\b/i,
  rams: /\b(rams|risk assessment|method statement|safety doc\w*|hazard\w*|control measures?|h&s|cdm|compliance|certificate\w*|variation\w*|signature|sign[- ]?off|signed off)\b/i,
  reminders: /\b(remind\w*|nudge|chase me|don'?t let me forget)\b/i,
  settings: /\b(brand\w*|(business|company) (name|address|phone|number|email)|trading name|logo|vat number|payment terms?|invoice (terms|number)|contact details?|business profile|setting\w*|preferences?)\b/i,
  accounting: /\b(xero|quickbooks|quick books|qbo?\b|accounting|sync to|push to (xero|quickbooks)|bookkeep\w*)\b/i,
  inbox: /\b(inbox|approve\w*|reject\w*|pending action\w*|action list|to approve|awaiting approval)\b/i,
  reports: /\b(report\w*|summary|summaris\w*|breakdown|how much (did|have) i|total for|figures|turnover|profit|takings|earned)\b/i,
};

// Returns a Set of group names whose pattern matches the message text.
export function classifyToolClusters(text) {
  if (!text || typeof text !== "string") return new Set();
  const matched = new Set();
  for (const [cluster, pattern] of Object.entries(CLUSTER_PATTERNS)) {
    if (pattern.test(text)) matched.add(cluster);
  }
  return matched;
}

// Build the tool subset to ship. Fixed groups, deterministic order (the master
// TOOLS order is preserved by filter, so the same matched groups always produce
// a byte-identical list -> the cache hits on repeat use within a domain).
// Falls back to all tools only when RAMS is active or nothing matched.
export function buildToolSubset(text, allTools, opts = {}) {
  const { forceAll = false } = opts;

  // RAMS is a stateful, multi-domain flow — give it everything (stable set, so
  // it still caches across the session).
  if (forceAll) {
    return { tools: allTools, clusters: ["all"], forcedAll: true, reason: "forced" };
  }

  const clusters = classifyToolClusters(text);

  // Nothing matched — ship everything rather than risk missing a tool. With the
  // map complete this is rare, and it guarantees correctness.
  if (clusters.size === 0) {
    return { tools: allTools, clusters: ["all"], forcedAll: true, reason: "no_match" };
  }

  const allowedNames = new Set(ALWAYS_INCLUDE_TOOLS);
  for (const cluster of clusters) {
    for (const toolName of (TOOL_CLUSTERS[cluster] || [])) {
      allowedNames.add(toolName);
    }
  }
  const subset = allTools.filter((t) => allowedNames.has(t.name));

  // Defensive: should be impossible (ALWAYS_INCLUDE alone is non-empty), but if
  // we somehow produced an empty set, fall back to all.
  if (subset.length === 0) {
    return { tools: allTools, clusters: ["all"], forcedAll: true, reason: "empty_subset" };
  }

  return { tools: subset, clusters: Array.from(clusters), forcedAll: false, reason: "matched" };
}
