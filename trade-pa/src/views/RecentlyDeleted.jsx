// ─── Recently Deleted (rendered from inside Settings) ───────────────────
// Extracted verbatim from App.jsx during P7 sub-batch A (28 Apr 2026).
import React, { useState, useEffect } from "react";
import { db } from "../lib/db.js";
import { C } from "../theme/colors.js";
import { S } from "../theme/styles.js";

export function RecentlyDeleted({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null); // {action, table, id} while a restore/purge is in flight

  // Tables we surface in the trash + display config (icon, label, summary builder)
  const TABLE_DISPLAY = {
    invoices:               { label: "Invoice",          icon: "🧾", sumKey: "amount", title: r => `${r.customer || "—"} · ${r.id || ""}` },
    jobs:                   { label: "Job",              icon: "🛠️", title: r => `${r.customer || "—"} · ${r.type || ""}` },
    job_cards:              { label: "Job card",         icon: "📋", title: r => `${r.customer || "—"} · ${r.title || r.type || ""}` },
    customers:              { label: "Customer",         icon: "👤", title: r => r.name || "—" },
    enquiries:              { label: "Enquiry",          icon: "📩", title: r => r.customer || r.name || "—" },
    materials:              { label: "Material",         icon: "🧱", title: r => `${r.name || "—"} · ${r.qty || 1}` },
    expenses:               { label: "Expense",          icon: "💸", title: r => `${r.description || "—"} · £${r.amount || 0}` },
    mileage_logs:           { label: "Mileage log",      icon: "🚗", title: r => `${r.miles || 0} miles · ${r.from || ""} → ${r.to || ""}` },
    time_logs:              { label: "Time log",         icon: "⏱️", title: r => `${r.hours || 0}h · ${r.notes || ""}` },
    stock_items:            { label: "Stock item",       icon: "📦", title: r => `${r.name || "—"} × ${r.qty || 0}` },
    cis_statements:         { label: "CIS statement",    icon: "🏗️", title: r => `${r.contractor_name || "—"}` },
    subcontractor_payments: { label: "Sub payment",      icon: "💷", title: r => `£${r.gross_amount || r.amount || 0}` },
    daywork_sheets:         { label: "Daywork sheet",    icon: "📝", title: r => r.title || "Daywork" },
    variation_orders:       { label: "Variation order",  icon: "📐", title: r => r.title || `VO ${r.id || ""}` },
    purchase_orders:        { label: "Purchase order",   icon: "🛒", title: r => `${r.supplier || "—"} · PO ${r.id || ""}` },
    purchase_order_items:   { label: "PO item",          icon: "📦", title: r => r.description || "—" },
    compliance_docs:        { label: "Compliance doc",   icon: "📄", title: r => r.doc_type || "Doc" },
    trade_certificates:     { label: "Certificate",      icon: "📜", title: r => r.cert_label || r.cert_type || "Cert" },
    worker_documents:       { label: "Worker doc",       icon: "🪪", title: r => r.doc_type || "Doc" },
    rams_documents:         { label: "RAMS",             icon: "⚠️", title: r => r.title || "RAMS" },
    documents:              { label: "Document",         icon: "📁", title: r => r.title || r.filename || "Document" },
    reminders:              { label: "Reminder",         icon: "⏰", title: r => r.title || r.message || "Reminder" },
    customer_contacts:      { label: "Customer contact", icon: "📇", title: r => r.name || r.email || "—" },
    call_logs:              { label: "Call log",         icon: "📞", title: r => `${r.from_number || "—"} · ${r.duration_seconds || 0}s` },
    user_commands:          { label: "Custom command",   icon: "🎙️", title: r => r.phrase || "—" },
    job_notes:              { label: "Job note",         icon: "🗒️", title: r => (r.body || "").slice(0, 60) },
    job_photos:             { label: "Job photo",        icon: "📷", title: r => r.caption || "Photo" },
    job_drawings:           { label: "Drawing",          icon: "🖼️", title: r => r.title || "Drawing" },
    job_workers:            { label: "Job assignment",   icon: "🧑‍🔧", title: r => `Worker on job ${r.job_id || ""}` },
  };
  const TABLE_NAMES = Object.keys(TABLE_DISPLAY);

  const loadItems = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const all = [];
      // Fan-out across all tables. Using .withDeleted() to bypass the
      // auto-filter and .neq("deleted_at", null) — but we ONLY want
      // soft-deleted rows here, so use .gt("deleted_at", "1970…") which
      // selects any non-null deleted_at value.
      // 100 most recent per table to keep this snappy; total cap of ~2800.
      await Promise.all(TABLE_NAMES.map(async (table) => {
        try {
          const { data, error } = await db.from(table)
            .withDeleted()
            .select("*")
            .eq("user_id", user.id)
            .not("deleted_at", "is", null)
            .order("deleted_at", { ascending: false })
            .limit(50);
          if (error) {
            // Some tables might not have deleted_at if migration is partial —
            // skip gracefully rather than blowing up the whole list.
            return;
          }
          for (const row of (data || [])) {
            all.push({ ...row, _sourceTable: table });
          }
        } catch {}
      }));
      // Sort merged list by deleted_at descending
      all.sort((a, b) => (b.deleted_at || "").localeCompare(a.deleted_at || ""));
      setItems(all.slice(0, 200));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadItems(); }, [user?.id]);

  const restoreItem = async (item) => {
    setBusy({ action: "restore", table: item._sourceTable, id: item.id });
    try {
      // Restoring: clear deleted_at and deleted_cascade_id. Also restore
      // any siblings that share the cascade_id — that's the whole point
      // of the cascade approach (deleted as a group, restored as a group).
      const cascadeId = item.deleted_cascade_id;
      // Restore the row itself
      await db.from(item._sourceTable)
        .withDeleted()
        .update({ deleted_at: null, deleted_cascade_id: null })
        .eq("id", item.id)
        .eq("user_id", user.id);
      // Restore siblings sharing cascade_id (they'll be in their own tables).
      // We don't know which tables — sweep them all. Cheap because the
      // cascade_id index is partial.
      if (cascadeId) {
        await Promise.all(TABLE_NAMES.map(async (t) => {
          if (t === item._sourceTable) return; // already done
          try {
            await db.from(t)
              .withDeleted()
              .update({ deleted_at: null, deleted_cascade_id: null })
              .eq("deleted_cascade_id", cascadeId)
              .eq("user_id", user.id);
          } catch {}
        }));
      }
      await loadItems();
    } finally {
      setBusy(null);
    }
  };

  const purgeItem = async (item) => {
    if (!confirm(`Permanently delete this ${TABLE_DISPLAY[item._sourceTable]?.label || "item"}? This can't be undone.`)) return;
    setBusy({ action: "purge", table: item._sourceTable, id: item.id });
    try {
      // Hard delete via escape hatch
      await db.from(item._sourceTable)
        .hardDelete()
        .eq("id", item.id)
        .eq("user_id", user.id);
      await loadItems();
    } finally {
      setBusy(null);
    }
  };

  const fmtAge = (ts) => {
    if (!ts) return "";
    const ms = Date.now() - new Date(ts).getTime();
    const days = Math.floor(ms / 86400000);
    if (days >= 1) return `${days}d ago`;
    const hrs = Math.floor(ms / 3600000);
    if (hrs >= 1) return `${hrs}h ago`;
    const mins = Math.floor(ms / 60000);
    return mins < 1 ? "just now" : `${mins}m ago`;
  };
  const fmtExpiry = (ts) => {
    if (!ts) return "";
    const ms = new Date(ts).getTime() + (14 * 86400000) - Date.now();
    if (ms <= 0) return "expired";
    const days = Math.floor(ms / 86400000);
    if (days >= 1) return `${days}d left`;
    const hrs = Math.floor(ms / 3600000);
    return `${hrs}h left`;
  };

  return (
    <div style={S.card}>
      <div style={S.sectionTitle}>Recently deleted</div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>
        Anything you've deleted in the last 14 days. Tap Restore to bring it back, or Delete forever to remove it permanently. After 14 days items are removed automatically.
      </div>
      {loading ? (
        <div style={{ padding: "20px 0", textAlign: "center", color: C.muted, fontSize: 12 }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ padding: "24px 0", textAlign: "center", color: C.muted, fontSize: 13 }}>
          ✨ Nothing here. Anything you delete shows up for 14 days.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map(item => {
            const cfg = TABLE_DISPLAY[item._sourceTable] || { label: item._sourceTable, icon: "📄", title: () => "—" };
            const itemBusy = busy && busy.table === item._sourceTable && busy.id === item.id;
            return (
              <div key={`${item._sourceTable}:${item.id}`} style={{
                background: C.surfaceHigh,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: "10px 12px",
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}>
                <div style={{ fontSize: 18, flexShrink: 0 }} aria-hidden>{cfg.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Mono', monospace", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 1 }}>
                    {cfg.label}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {cfg.title(item)}
                  </div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                    Deleted {fmtAge(item.deleted_at)} · {fmtExpiry(item.deleted_at)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => restoreItem(item)}
                    disabled={!!busy}
                    style={{ ...S.btn("primary"), fontSize: 11, padding: "5px 10px", opacity: itemBusy ? 0.5 : 1 }}
                  >{itemBusy && busy.action === "restore" ? "…" : "Restore"}</button>
                  <button
                    onClick={() => purgeItem(item)}
                    disabled={!!busy}
                    style={{ ...S.btn("ghost"), fontSize: 11, padding: "5px 10px", color: C.red, opacity: itemBusy ? 0.5 : 1 }}
                  >{itemBusy && busy.action === "purge" ? "…" : "Delete"}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
