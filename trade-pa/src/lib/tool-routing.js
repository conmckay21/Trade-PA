// ─── Thin tool routing — per-message dynamic tool subset ────────────────────
// The voice assistant ships 38 tool definitions to Claude on every call.
// At ~80KB / ~20K tokens of tool defs alone, that's a real cost driver
// at scale. Most messages only need 2-5 tools. This module-level helper
// matches the user's message against keyword clusters and ships only the
// relevant subset to Claude.
//
// Strategy:
//   Tier 1 — ALWAYS_INCLUDE: cheap context-gathering tools (find/list/get).
//            Total ~6KB. Always shipped so Claude can resolve references
//            ("the Smith job", "that invoice") without needing a specific
//            cluster match.
//   Tier 2 — TOOL_CLUSTERS: action tools (create/update/delete/log)
//            grouped by domain. Heavier schemas — only ship when the
//            domain is mentioned.
//
// Special cases:
//   - update_brand is 40KB on its own (half the entire payload). Clustered
//     under `settings` so it only ships when the user is talking about
//     business profile / branding.
//   - set_reminder is 4.3KB. Clustered under `reminders` because users
//     mention "remind" explicitly, so detection is reliable.
//
// Safety nets:
//   - Short messages (<3 words) → ship all tools (too ambiguous to classify)
//   - Zero clusters matched → ship all tools (don't gamble on uncertain class)
//   - RAMS active → ship all tools (stateful flow needs everything)
//
// Telemetry: classification logged once per send() to usage_events for tuning.
export const ALWAYS_INCLUDE_TOOLS = [
  // Read-only context gathering — Claude needs these to look up data
  // referenced in the user's message. Tiny schemas (~500 chars each).
  "list_schedule",
  "list_invoices",
  "list_jobs",
  "list_materials",
  "find_invoice",
  "find_quote",
  "find_job_card",
  "find_material_receipt",
  "get_job_full",
  "get_job_profit",
  // Universal lightweight actions
  "save_memory",
  "restore_recently_deleted",
];

export const TOOL_CLUSTERS = {
  invoicing: [
    "create_invoice", "create_quote", "mark_invoice_paid",
    "delete_invoice", "convert_quote_to_invoice",
  ],
  jobs: [
    "create_job", "create_job_card", "update_job_status",
    "delete_job", "add_job_note",
  ],
  customers: [
    "create_customer", "delete_customer", "log_enquiry", "delete_enquiry",
  ],
  materials: [
    "create_material", "update_material", "update_material_status",
    "delete_material", "assign_material_to_job", "update_stock",
  ],
  money: [
    "log_time", "log_mileage",
  ],
  rams: [
    "start_rams", "rams_confirm_hazards",
    "rams_save_step1", "rams_save_step2", "rams_save_step3",
    "rams_save_step4", "rams_save_step5",
  ],
  reminders: [
    "set_reminder",
  ],
  settings: [
    "update_brand",
  ],
};

// Keyword regex per cluster. Tuned for tradie phrasing — short verbs,
// common abbreviations, brand names. Comments next to each pattern
// explain what tradie-speak it's catching.
export const CLUSTER_PATTERNS = {
  invoicing: /\b(invoic\w*|bill(ed|ing)?|quote(d|s)?|quoting|paid|payment|owed|owe me|owes me|owing|outstanding|chase\w*|chasing|raise an?|due|sent it|payment|paying|collect|receipt for)\b/i,
  jobs: /\b(job\w*|booking|book in|booked|schedule\w*|diary|calendar|appointment\w*|today|tomorrow|next week|this week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|on site|on-site|day off|holiday|completed it|finished the|note on|notes? on)\b/i,
  customers: /\b(customer\w*|client\w*|enquir\w*|new lead|got a call|rang up|rang me|inquired|interested|prospect\w*)\b/i,
  materials: /\b(material\w*|supply|supplies|stock|reorder|to order|ordered|collected|toolstation|screwfix|plumb\w*|wickes|b&q|jewson|travis|merchant|purchase order|po for|po\d+|receipt scan|scan a receipt|scanned)\b/i,
  money: /\b(mileage|miles|fuel|drove|drive|hours|time on|logged time|time log|log (time|hours)|hours? worked|worked from|hours? at|started at \d|finished at \d|clocked (in|on|out))\b/i,
  rams: /\b(rams|risk assessment|method statement|safety doc|hazards?|control measures|h&s|cdm)\b/i,
  reminders: /\b(remind\w*)\b/i,
  // Settings — keywords that suggest the user wants to update brand/business profile.
  // Deliberately conservative because update_brand is 40KB.
  settings: /\b(brand\w*|(business|company) (name|address|phone|number|email)|trading name|logo|vat number|payment terms?|invoice (terms|number)|contact details?|business profile|setting\w*|preferences?)\b/i,
};

// Returns a Set of cluster names matching the message text.
export function classifyToolClusters(text) {
  if (!text || typeof text !== "string") return new Set();
  const matched = new Set();
  for (const [cluster, pattern] of Object.entries(CLUSTER_PATTERNS)) {
    if (pattern.test(text)) matched.add(cluster);
  }
  return matched;
}

// Build the actual tool subset to ship. Falls back to all tools whenever
// classification is uncertain — token cost is preferable to missing a tool.
export function buildToolSubset(text, allTools, opts = {}) {
  const { forceAll = false } = opts;
  if (forceAll) {
    return { tools: allTools, clusters: ["all"], forcedAll: true, reason: "forced" };
  }
  if (!text || text.trim().split(/\s+/).length < 3) {
    return { tools: allTools, clusters: ["all"], forcedAll: true, reason: "short_message" };
  }

  const clusters = classifyToolClusters(text);
  if (clusters.size === 0) {
    return { tools: allTools, clusters: ["all"], forcedAll: true, reason: "no_match" };
  }

  const allowedNames = new Set(ALWAYS_INCLUDE_TOOLS);
  for (const cluster of clusters) {
    for (const toolName of (TOOL_CLUSTERS[cluster] || [])) {
      allowedNames.add(toolName);
    }
  }
  const subset = allTools.filter(t => allowedNames.has(t.name));
  // Defensive: if for some reason we'd ship < 5 tools (something's wrong with
  // our cluster definitions), fall back to all. Clusters get edited, mistakes
  // happen — this prevents a misconfig from breaking voice flow in production.
  if (subset.length < 5) {
    return { tools: allTools, clusters: ["all"], forcedAll: true, reason: "subset_too_small" };
  }
  return { tools: subset, clusters: Array.from(clusters), forcedAll: false, reason: "matched" };
}
