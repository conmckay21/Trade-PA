// ============================================================================
// CsvImport.jsx — Bulk import from CSV: Customers, Jobs, Invoices & Quotes.
// ----------------------------------------------------------------------------
// Self-contained modal. Matches Trade PA dark/amber theme. Inline styles.
//
// Six stages:
//   1. entity      — Pick what you're importing (Customers / Jobs / Invoices)
//   2. pick        — File picker
//   3. mapping     — Auto-detect columns, user remaps if needed
//   4. preview     — Show first 5 rows + dedup warning + Skip/Import-anyway
//   5. importing   — Batch insert with progress bar (50 rows per batch)
//   6. done        — Summary + "Import another type" CTA
//
// Wiring (3 changes to App.jsx, handled by patch_csv_import_phase_7c.py):
//   1. import CsvImport from "./components/CsvImport.jsx";
//   2. const [csvImportOpen, setCsvImportOpen] = useState(false);
//   3. <CsvImport open={csvImportOpen} onClose={() => setCsvImportOpen(false)}
//                 db={db} user={user} />
//   4. Step 7 graduation tile "Import from another app" that opens this modal.
//
// Dependencies: papaparse (npm install papaparse).
// ============================================================================

import React, { useEffect, useState, useMemo, useRef } from "react";
import Papa from "papaparse";

// ─── Theme tokens (self-contained, matches AssistantSetup pattern) ──────
const T = {
  font: '"DM Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  bg: "#0f0f0f",
  surface: "#1a1a1a",
  surfaceHigh: "#222",
  border: "#2a2a2a",
  text: "#f0f0f0",
  muted: "#888",
  amber: "#F59E0B",
  green: "#10B981",
  red: "#EF4444",
};

const primaryBtn = {
  background: T.amber,
  color: "#0A0A0A",
  border: "none",
  borderRadius: 10,
  padding: "10px 18px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: T.font,
};

const ghostBtn = {
  background: "transparent",
  color: T.muted,
  border: "1px solid " + T.border,
  borderRadius: 10,
  padding: "10px 14px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: T.font,
};

// ─── Helpers (used by ENTITIES config below) ────────────────────────────
function getStr(row, key) {
  if (!key || !row) return "";
  const v = row[key];
  return v == null ? "" : String(v).trim();
}

function parseNum(s) {
  if (s == null) return null;
  const cleaned = String(s).replace(/[£$€,\s]/g, "").trim();
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseDate(s) {
  if (!s) return null;
  const trimmed = String(s).trim();
  if (!trimmed) return null;

  // ISO: YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  // UK: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const ukMatch = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (ukMatch) {
    const [, day, month, year] = ukMatch;
    const fullYear = year.length === 2
      ? (parseInt(year, 10) > 50 ? "19" + year : "20" + year)
      : year;
    const d = new Date(`${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  // Natural language fallback (handles "May 26 2026", "26 May 2026", etc.)
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  return null;
}

function coerceBoolean(v) {
  if (v === true || v === false) return v;
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return ["true", "yes", "y", "1", "business", "company", "ltd", "limited"].includes(s);
}

function coerceIsQuote(v) {
  if (v === true || v === false) return v;
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  if (["true", "yes", "y", "1", "quote", "estimate", "qte"].includes(s)) return true;
  if (["false", "no", "n", "0", "invoice", "inv", "bill"].includes(s)) return false;
  return false;
}

function coerceJobStatus(s) {
  if (!s) return "enquiry";
  const v = String(s).toLowerCase().trim();
  if (/in[\s_-]?progress|active|started|wip|underway|on[\s_-]?site/.test(v)) return "in_progress";
  if (/complet|done|finished|paid|closed/.test(v)) return "completed";
  if (/on[\s_-]?hold|paused|wait/.test(v)) return "on_hold";
  if (/cancel|abandoned|lost/.test(v)) return "cancelled";
  if (/quote|quoted|estimate/.test(v)) return "quoted";
  if (/accept|approved|won/.test(v)) return "accepted";
  return "enquiry";
}

function coerceInvoiceStatus(s, isQuote) {
  if (!s) return isQuote ? "draft" : "sent";
  const v = String(s).toLowerCase().trim();
  if (/paid|settled/.test(v)) return "paid";
  if (/overdue|late/.test(v)) return "overdue";
  if (/sent|delivered|issued/.test(v)) return "sent";
  if (/draft|new/.test(v)) return "draft";
  if (/accept|approved|won/.test(v)) return "accepted";
  if (/declin|reject|lost/.test(v)) return "declined";
  return isQuote ? "draft" : "sent";
}

// ─── Entity definitions ─────────────────────────────────────────────────
const ENTITIES = {
  customers: {
    label: "Customers",
    singular: "customer",
    description: "Names, phones, emails, addresses",
    iconPath: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2",
    iconPath2: "M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
    table: "customers",
    targetFields: [
      { key: "name",       label: "Customer name",  required: true,  hint: "e.g. Mrs Patel" },
      { key: "phone",      label: "Phone",          required: false, hint: "Mobile or landline" },
      { key: "email",      label: "Email",          required: false, hint: "" },
      { key: "address",    label: "Address",        required: false, hint: "Full address — one column" },
      { key: "notes",      label: "Notes",          required: false, hint: "Anything else worth keeping" },
      { key: "is_company", label: "Is a business",  required: false, hint: "true/false or yes/no" },
    ],
    headerPatterns: {
      name:       /\b(customer|client|contact)?\s*(name|full[\s_-]?name)\b|^customer$|^client$|^company$|^name$/i,
      phone:      /\b(phone|mobile|tel(?:ephone)?|cell)\b/i,
      email:      /\b(e-?mail)\b/i,
      address:    /\b(address|street|addr)\b/i,
      notes:      /\b(notes?|comments?|description|memo)\b/i,
      is_company: /\b(is[\s_-]?company|business|company[\s_-]?type)\b/i,
    },
    dedupKey: (row, mapping) => {
      const n = getStr(row, mapping.name).toLowerCase();
      return n || null;
    },
    loadExistingKeys: async (db, userId) => {
      const { data, error } = await db.from("customers").select("name")
        .eq("user_id", userId).is("deleted_at", null);
      if (error || !data) return [];
      return data.map(c => (c.name || "").trim().toLowerCase()).filter(Boolean);
    },
    buildRow: (r, m, userId) => ({
      user_id: userId,
      name: getStr(r, m.name),
      phone: getStr(r, m.phone) || null,
      email: getStr(r, m.email) || null,
      address: getStr(r, m.address) || null,
      notes: getStr(r, m.notes) || null,
      is_company: m.is_company ? coerceBoolean(r[m.is_company]) : false,
    }),
    rowValid: (r, m) => !!getStr(r, m.name),
  },

  jobs: {
    label: "Jobs",
    singular: "job",
    description: "Job cards with customer, address, type, value",
    iconPath: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z",
    iconPath2: "M14 2v6h6M9 13h6M9 17h6",
    table: "job_cards",
    targetFields: [
      { key: "title",      label: "Job title",      required: true,  hint: "" },
      { key: "customer",   label: "Customer name",  required: true,  hint: "Matched by name" },
      { key: "address",    label: "Site address",   required: false, hint: "" },
      { key: "type",       label: "Job type",       required: false, hint: "e.g. Boiler Service" },
      { key: "status",     label: "Status",         required: false, hint: "in progress / completed / etc." },
      { key: "value",      label: "Value (£)",      required: false, hint: "" },
      { key: "start_date", label: "Start date",     required: false, hint: "" },
      { key: "end_date",   label: "End date",       required: false, hint: "" },
      { key: "notes",      label: "Notes",          required: false, hint: "" },
    ],
    headerPatterns: {
      title:      /\b(title|job[\s_-]?name|job[\s_-]?title|description|summary)\b|^name$|^title$/i,
      customer:   /\b(customer|client|contact)[\s_-]?(name)?\b|^customer$|^client$/i,
      address:    /\b(address|site|location|street)\b/i,
      type:       /\b(type|category|trade|kind|job[\s_-]?type)\b/i,
      status:     /\b(status|state|stage)\b/i,
      value:      /\b(value|amount|price|total|cost|fee)\b/i,
      start_date: /\b(start[\s_-]?date|date[\s_-]?started|begin|from)\b|^start$|^date$/i,
      end_date:   /\b(end[\s_-]?date|date[\s_-]?finished|finished|complet|to)\b|^end$/i,
      notes:      /\b(notes?|comments?|details)\b/i,
    },
    dedupKey: (row, mapping) => {
      const t = getStr(row, mapping.title).toLowerCase();
      const c = getStr(row, mapping.customer).toLowerCase();
      if (!t || !c) return null;
      return t + "|" + c;
    },
    loadExistingKeys: async (db, userId) => {
      const { data, error } = await db.from("job_cards").select("title, customer")
        .eq("user_id", userId);
      if (error || !data) return [];
      return data
        .map(j => (j.title || "").trim().toLowerCase() + "|" + (j.customer || "").trim().toLowerCase())
        .filter(k => k !== "|");
    },
    buildRow: (r, m, userId) => ({
      user_id: userId,
      title: getStr(r, m.title) || (getStr(r, m.customer) + " — " + (getStr(r, m.type) || "Job")),
      customer: getStr(r, m.customer),
      address: getStr(r, m.address) || null,
      type: getStr(r, m.type) || null,
      status: m.status ? coerceJobStatus(getStr(r, m.status)) : "enquiry",
      value: parseNum(getStr(r, m.value)) || 0,
      start_date: m.start_date ? parseDate(getStr(r, m.start_date)) : null,
      end_date: m.end_date ? parseDate(getStr(r, m.end_date)) : null,
      notes: getStr(r, m.notes) || null,
    }),
    rowValid: (r, m) => !!getStr(r, m.title) && !!getStr(r, m.customer),
  },

  invoices: {
    label: "Invoices & Quotes",
    singular: "invoice",
    description: "One row per invoice or quote",
    iconPath: "M12 1v22",
    iconPath2: "M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
    table: "invoices",
    targetFields: [
      { key: "customer",    label: "Customer name", required: true,  hint: "" },
      { key: "amount",      label: "Total (£)",     required: true,  hint: "Excluding currency symbols" },
      { key: "description", label: "Description",   required: false, hint: "What the work was" },
      { key: "due",         label: "Due date",      required: false, hint: "" },
      { key: "status",      label: "Status",        required: false, hint: "draft / sent / paid / overdue" },
      { key: "is_quote",    label: "Is a quote",    required: false, hint: "true / Quote / QTE = quote" },
      { key: "address",     label: "Customer address", required: false, hint: "" },
      { key: "email",       label: "Customer email",   required: false, hint: "" },
    ],
    headerPatterns: {
      customer:    /\b(customer|client|contact)[\s_-]?(name)?\b|^customer$|^client$/i,
      amount:      /\b(total|amount|value|price|sum|net|gross|grand[\s_-]?total)\b/i,
      description: /\b(description|details|work|service|notes?)\b/i,
      due:         /\b(due|due[\s_-]?date|payment[\s_-]?due|paid[\s_-]?by)\b/i,
      status:      /\b(status|state|paid)\b/i,
      is_quote:    /\b(quote|is[\s_-]?quote|doc[\s_-]?type|document[\s_-]?type)\b|^type$/i,
      address:     /\b(address|billing[\s_-]?address|street)\b/i,
      email:       /\b(e-?mail)\b/i,
    },
    // No dedup for invoices in v1 — every row imports.
    dedupKey: () => null,
    loadExistingKeys: async () => [],
    buildRow: (r, m, userId, ctx) => {
      const amount = parseNum(getStr(r, m.amount)) || 0;
      const description = getStr(r, m.description) || "Imported invoice";
      const isQuote = m.is_quote ? coerceIsQuote(r[m.is_quote]) : false;
      const prefix = isQuote ? "QTE" : "INV";
      const id = `${prefix}-IMP-${ctx.sessionStamp}-${String(ctx.rowIndex + 1).padStart(3, "0")}`;
      return {
        id,
        user_id: userId,
        customer: getStr(r, m.customer),
        amount,
        description,
        due: getStr(r, m.due) || null,
        status: coerceInvoiceStatus(getStr(r, m.status), isQuote),
        is_quote: isQuote,
        address: getStr(r, m.address) || "",
        email: getStr(r, m.email) || "",
        line_items: [{ description, amount }],
        vat_enabled: false,
        vat_rate: 20,
        cis_enabled: false,
        gross_amount: amount,
      };
    },
    rowValid: (r, m) => !!getStr(r, m.customer) && (parseNum(getStr(r, m.amount)) !== null),
  },
};

// ─── Header auto-detection (used by mapping stage) ──────────────────────
function detectFieldMapping(headers, patterns) {
  const mapping = {};
  for (const [field, pattern] of Object.entries(patterns)) {
    const match = headers.find(h => h && pattern.test(h));
    if (match) mapping[field] = match;
  }
  return mapping;
}

// ─── Main component ─────────────────────────────────────────────────────
export default function CsvImport({
  open = false,
  onClose = () => {},
  db,
  user,
  onImported = () => {},
}) {
  const [stage, setStage] = useState("entity");
  const [entity, setEntity] = useState(null);
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [parseError, setParseError] = useState(null);
  const [existingKeys, setExistingKeys] = useState(new Set());
  const [dedupChoice, setDedupChoice] = useState("skip");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState({ inserted: 0, skipped: 0, errors: 0 });
  const [completedImports, setCompletedImports] = useState({});
  const fileInputRef = useRef(null);

  const E = entity ? ENTITIES[entity] : null;

  // Reset everything when modal closes
  useEffect(() => {
    if (open) return;
    setStage("entity");
    setEntity(null);
    setFile(null);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setParseError(null);
    setExistingKeys(new Set());
    setDedupChoice("skip");
    setProgress({ done: 0, total: 0 });
    setResult({ inserted: 0, skipped: 0, errors: 0 });
    setCompletedImports({});
  }, [open]);

  // Load existing keys for dedup when entering mapping stage
  useEffect(() => {
    if (!E || !user?.id || !db || stage !== "mapping") return;
    let cancelled = false;
    (async () => {
      try {
        const keys = await E.loadExistingKeys(db, user.id);
        if (!cancelled) setExistingKeys(new Set(keys));
      } catch (err) {
        if (typeof console !== "undefined") {
          console.warn("[CsvImport] could not load existing keys:", err?.message);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [E, user?.id, db, stage]);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const handler = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleFile = (f) => {
    if (!f || !E) return;
    setFile(f);
    setParseError(null);
    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => (h || "").trim(),
      complete: (results) => {
        if (results.errors && results.errors.length > 0) {
          const first = results.errors[0];
          setParseError("Couldn't read your file: " + first.message + ". Try re-saving as CSV first.");
          return;
        }
        const cleanedRows = (results.data || []).filter(r =>
          Object.values(r).some(v => v != null && String(v).trim())
        );
        if (cleanedRows.length === 0) {
          setParseError("That file has no data rows. Make sure your CSV has a header row and at least one " + E.singular + ".");
          return;
        }
        const hs = (results.meta?.fields || []).filter(Boolean);
        setHeaders(hs);
        setRows(cleanedRows);
        setMapping(detectFieldMapping(hs, E.headerPatterns));
        setStage("mapping");
      },
      error: (err) => {
        setParseError("Couldn't read your file: " + (err?.message || "unknown error"));
      },
    });
  };

  // Derived
  const validRows = useMemo(() => {
    if (!rows.length || !E || !mapping) return [];
    return rows.filter(r => E.rowValid(r, mapping));
  }, [rows, mapping, E]);

  const duplicates = useMemo(() => {
    if (!validRows.length || !E || !mapping) return [];
    return validRows.filter(r => {
      const key = E.dedupKey(r, mapping);
      return key && existingKeys.has(key);
    });
  }, [validRows, mapping, existingKeys, E]);

  const rowsToImport = useMemo(() => {
    if (!validRows.length) return [];
    if (dedupChoice === "import_anyway") return validRows;
    return validRows.filter(r => {
      const key = E.dedupKey(r, mapping);
      return !key || !existingKeys.has(key);
    });
  }, [validRows, mapping, existingKeys, dedupChoice, E]);

  const previewRows = useMemo(() => {
    if (!rowsToImport.length) return [];
    return rowsToImport.slice(0, 5);
  }, [rowsToImport]);

  const requiredFieldsMapped = useMemo(() => {
    if (!E) return false;
    return E.targetFields.filter(f => f.required).every(f => mapping[f.key]);
  }, [mapping, E]);

  const runImport = async () => {
    if (!rowsToImport.length || !user?.id || !db || !E) return;
    setStage("importing");
    setProgress({ done: 0, total: rowsToImport.length });
    const sessionStamp = Date.now().toString(36).slice(-6).toUpperCase();
    let inserted = 0;
    let errors = 0;
    const BATCH = 50;
    for (let i = 0; i < rowsToImport.length; i += BATCH) {
      const slice = rowsToImport.slice(i, i + BATCH);
      const batch = slice.map((r, j) =>
        E.buildRow(r, mapping, user.id, { sessionStamp, rowIndex: i + j })
      );
      try {
        const { error } = await db.from(E.table).insert(batch);
        if (error) {
          errors += batch.length;
          if (typeof console !== "undefined") {
            console.warn("[CsvImport] batch insert error:", error.message);
          }
        } else {
          inserted += batch.length;
        }
      } catch (err) {
        errors += batch.length;
        if (typeof console !== "undefined") {
          console.warn("[CsvImport] batch threw:", err?.message);
        }
      }
      setProgress({ done: Math.min(i + BATCH, rowsToImport.length), total: rowsToImport.length });
    }
    const skipped = validRows.length - rowsToImport.length;
    const res = { inserted, skipped, errors };
    setResult(res);
    setCompletedImports(prev => ({ ...prev, [entity]: (prev[entity] || 0) + inserted }));
    setStage("done");
    onImported({ entity, ...res });
  };

  const importAnother = () => {
    setEntity(null);
    setFile(null);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setParseError(null);
    setExistingKeys(new Set());
    setDedupChoice("skip");
    setProgress({ done: 0, total: 0 });
    setResult({ inserted: 0, skipped: 0, errors: 0 });
    setStage("entity");
  };

  if (!open) return null;

  // ─── Render ───────────────────────────────────────────────────────────
  const headerTitle =
    stage === "entity" ? "Import from another app"
    : stage === "done" ? "Import complete"
    : stage === "importing" ? "Importing " + (E?.label || "").toLowerCase() + "..."
    : "Import " + (E?.label || "").toLowerCase();

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9100,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, fontFamily: T.font,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.surface,
          border: "1px solid " + T.border,
          borderRadius: 16,
          padding: 24,
          maxWidth: 520, width: "100%",
          maxHeight: "90vh", overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: T.text, fontFamily: T.font }}>
            {headerTitle}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stage 1: entity picker */}
        {stage === "entity" && (
          <div>
            <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.6, marginBottom: 18 }}>
              What are you bringing in? Most apps export each type to a separate CSV — pick one to start. You can come back for the others next.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              {Object.entries(ENTITIES).map(([key, ent]) => {
                const completed = completedImports[key];
                return (
                  <button
                    key={key}
                    onClick={() => { setEntity(key); setStage("pick"); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 14,
                      background: T.surfaceHigh,
                      border: "1px solid " + T.border,
                      borderRadius: 12, padding: "14px 16px",
                      cursor: "pointer", textAlign: "left",
                      fontFamily: T.font,
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: T.amber + "22",
                      border: "1px solid " + T.amber + "44",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d={ent.iconPath} />
                        {ent.iconPath2 && <path d={ent.iconPath2} />}
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 2 }}>{ent.label}</div>
                      <div style={{ fontSize: 12, color: T.muted }}>{ent.description}</div>
                    </div>
                    {completed > 0 && (
                      <div style={{
                        fontSize: 11, fontWeight: 700, color: T.green,
                        background: T.green + "22", padding: "4px 8px", borderRadius: 6,
                        whiteSpace: "nowrap",
                      }}>
                        ✓ {completed}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: 11, color: T.muted, lineHeight: 1.5, margin: 0, padding: "10px 12px", background: T.amber + "0a", border: "1px solid " + T.amber + "22", borderRadius: 8 }}>
              💡 Tip: import customers first so jobs and invoices can link to them by name.
            </p>
          </div>
        )}

        {/* Stage 2: file picker */}
        {stage === "pick" && E && (
          <div>
            <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.6, marginBottom: 16 }}>
              Pick your <strong style={{ color: T.text }}>{E.label.toLowerCase()}</strong> CSV file. We'll auto-detect the columns and let you tweak any that look off.
            </p>
            {parseError && (
              <div style={{ background: T.red + "22", border: "1px solid " + T.red + "66", borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, color: T.red, lineHeight: 1.5 }}>
                {parseError}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={e => handleFile(e.target.files?.[0])}
              style={{ display: "none" }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: "100%", padding: 20, borderRadius: 12,
                border: "2px dashed " + T.border,
                background: T.surfaceHigh, color: T.text,
                fontSize: 14, fontWeight: 600, cursor: "pointer",
                fontFamily: T.font,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Choose CSV file
            </button>
            <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 16 }}>
              <button onClick={() => setStage("entity")} style={ghostBtn}>← Back</button>
            </div>
          </div>
        )}

        {/* Stage 3: column mapping */}
        {stage === "mapping" && E && (
          <div>
            <div style={{
              background: T.surfaceHigh, border: "1px solid " + T.border,
              borderRadius: 10, padding: "10px 14px", marginBottom: 16,
              fontSize: 12, color: T.muted,
              display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
            }}>
              <span style={{ color: T.green }}>✓</span>
              <strong style={{ color: T.text }}>{file?.name}</strong>
              <span>· {rows.length} row{rows.length !== 1 ? "s" : ""}</span>
            </div>
            <p style={{ fontSize: 12, color: T.muted, marginBottom: 16, lineHeight: 1.5 }}>
              Match each of our fields to the column in your file. We've taken a guess — change anything that's off.
            </p>
            {E.targetFields.map(f => (
              <div key={f.key} style={{
                display: "grid", gridTemplateColumns: "140px 1fr",
                alignItems: "center", gap: 12, marginBottom: 10,
              }}>
                <div>
                  <div style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>
                    {f.label}{f.required && <span style={{ color: T.red }}> *</span>}
                  </div>
                  {f.hint && <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{f.hint}</div>}
                </div>
                <select
                  value={mapping[f.key] || ""}
                  onChange={e => setMapping(m => ({ ...m, [f.key]: e.target.value || undefined }))}
                  style={{
                    background: T.surfaceHigh, border: "1px solid " + T.border,
                    borderRadius: 8, padding: "8px 10px", color: T.text,
                    fontSize: 13, fontFamily: T.font, width: "100%",
                  }}
                >
                  <option value="">— Skip this field —</option>
                  {headers.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
              <button onClick={() => setStage("pick")} style={ghostBtn}>← Back</button>
              <button
                onClick={() => setStage("preview")}
                disabled={!requiredFieldsMapped}
                style={{
                  ...primaryBtn,
                  opacity: requiredFieldsMapped ? 1 : 0.4,
                  cursor: requiredFieldsMapped ? "pointer" : "not-allowed",
                }}
              >
                Preview →
              </button>
            </div>
          </div>
        )}

        {/* Stage 4: preview + dedup */}
        {stage === "preview" && E && (
          <div>
            <p style={{ fontSize: 13, color: T.text, marginBottom: 14, lineHeight: 1.5 }}>
              Ready to import <strong style={{ color: T.amber }}>{rowsToImport.length}</strong> {E.label.toLowerCase()}.
            </p>
            {validRows.length < rows.length && (
              <div style={{
                background: T.muted + "22", border: "1px solid " + T.border,
                borderRadius: 8, padding: "8px 12px", marginBottom: 12,
                fontSize: 11, color: T.muted,
              }}>
                {rows.length - validRows.length} row{rows.length - validRows.length !== 1 ? "s" : ""} skipped (missing required fields)
              </div>
            )}
            {duplicates.length > 0 && (
              <div style={{
                background: T.amber + "11", border: "1px solid " + T.amber + "44",
                borderRadius: 10, padding: 12, marginBottom: 16,
              }}>
                <div style={{ fontSize: 12, color: T.amber, fontWeight: 600, marginBottom: 8 }}>
                  ⚠ {duplicates.length} look{duplicates.length === 1 ? "s" : ""} like duplicate{duplicates.length !== 1 ? "s" : ""} of existing records
                </div>
                <div style={{ display: "flex", gap: 14, fontSize: 12, color: T.text, flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="dedup"
                      value="skip"
                      checked={dedupChoice === "skip"}
                      onChange={() => setDedupChoice("skip")}
                      style={{ accentColor: T.amber }}
                    />
                    Skip those
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="dedup"
                      value="import_anyway"
                      checked={dedupChoice === "import_anyway"}
                      onChange={() => setDedupChoice("import_anyway")}
                      style={{ accentColor: T.amber }}
                    />
                    Import anyway
                  </label>
                </div>
              </div>
            )}
            {previewRows.length > 0 && (
              <div style={{
                background: T.surfaceHigh, border: "1px solid " + T.border,
                borderRadius: 10, padding: 12, marginBottom: 16,
              }}>
                <div style={{
                  fontSize: 10, color: T.muted, textTransform: "uppercase",
                  letterSpacing: "0.06em", fontWeight: 700, marginBottom: 8,
                }}>
                  Preview — first {previewRows.length}
                </div>
                {previewRows.map((r, i) => (
                  <PreviewRow
                    key={i}
                    row={r}
                    mapping={mapping}
                    entity={entity}
                    divider={i > 0}
                  />
                ))}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
              <button onClick={() => setStage("mapping")} style={ghostBtn}>← Back</button>
              <button
                onClick={runImport}
                disabled={rowsToImport.length === 0}
                style={{
                  ...primaryBtn,
                  opacity: rowsToImport.length > 0 ? 1 : 0.4,
                  cursor: rowsToImport.length > 0 ? "pointer" : "not-allowed",
                }}
              >
                Import {rowsToImport.length} →
              </button>
            </div>
          </div>
        )}

        {/* Stage 5: importing */}
        {stage === "importing" && (
          <div>
            <div style={{ background: T.surfaceHigh, borderRadius: 8, height: 10, overflow: "hidden", marginBottom: 16 }}>
              <div style={{
                width: progress.total > 0 ? ((progress.done / progress.total) * 100) + "%" : "0%",
                height: "100%", background: T.amber, transition: "width 0.2s",
              }} />
            </div>
            <p style={{ fontSize: 13, color: T.text, textAlign: "center", margin: "0 0 4px" }}>
              {progress.done} of {progress.total}
            </p>
            <p style={{ fontSize: 12, color: T.muted, textAlign: "center", margin: 0 }}>
              Hang tight, this won't take long.
            </p>
          </div>
        )}

        {/* Stage 6: done + import another */}
        {stage === "done" && E && (
          <div>
            <div style={{ textAlign: "center", padding: "12px 0 20px" }}>
              <div style={{
                width: 60, height: 60, borderRadius: "50%",
                background: T.green + "22", border: "2px solid " + T.green,
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 16px",
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 6 }}>
                Imported {result.inserted} {result.inserted === 1 ? E.singular : E.label.toLowerCase()}
              </div>
              {result.skipped > 0 && (
                <div style={{ fontSize: 13, color: T.muted }}>
                  Skipped {result.skipped} duplicate{result.skipped !== 1 ? "s" : ""}
                </div>
              )}
              {result.errors > 0 && (
                <div style={{ fontSize: 13, color: T.red, marginTop: 4 }}>
                  {result.errors} failed — try those again later
                </div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={importAnother} style={{ ...primaryBtn, width: "100%" }}>
                Import another type →
              </button>
              <button onClick={onClose} style={{ ...ghostBtn, width: "100%" }}>
                Done for now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PreviewRow — entity-specific row rendering for the preview stage ───
function PreviewRow({ row, mapping, entity, divider }) {
  const borderTop = divider ? "1px solid " + T.border : "none";

  if (entity === "customers") {
    const detail = [
      getStr(row, mapping.phone),
      getStr(row, mapping.email),
      getStr(row, mapping.address),
    ].filter(Boolean).join(" · ");
    return (
      <div style={{ fontSize: 12, color: T.text, padding: "8px 0", borderTop }}>
        <div style={{ fontWeight: 600 }}>{getStr(row, mapping.name) || "(no name)"}</div>
        <div style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>
          {detail || <em>no contact details</em>}
        </div>
      </div>
    );
  }

  if (entity === "jobs") {
    const value = getStr(row, mapping.value);
    const detail = [
      getStr(row, mapping.customer),
      getStr(row, mapping.type),
      value ? "£" + value : null,
    ].filter(Boolean).join(" · ");
    return (
      <div style={{ fontSize: 12, color: T.text, padding: "8px 0", borderTop }}>
        <div style={{ fontWeight: 600 }}>{getStr(row, mapping.title) || "(untitled job)"}</div>
        <div style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>
          {detail || <em>no other details</em>}
        </div>
      </div>
    );
  }

  if (entity === "invoices") {
    const amount = getStr(row, mapping.amount);
    const isQuote = mapping.is_quote ? coerceIsQuote(row[mapping.is_quote]) : false;
    const detail = [
      getStr(row, mapping.description),
      getStr(row, mapping.due) && "due " + getStr(row, mapping.due),
    ].filter(Boolean).join(" · ");
    return (
      <div style={{ fontSize: 12, color: T.text, padding: "8px 0", borderTop }}>
        <div style={{ fontWeight: 600 }}>
          {isQuote ? "QTE" : "INV"} · {getStr(row, mapping.customer)} · £{amount || "0"}
        </div>
        <div style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>
          {detail || <em>no description</em>}
        </div>
      </div>
    );
  }

  return null;
}
