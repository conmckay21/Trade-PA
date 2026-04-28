// ─── Purchase Orders Tab ────────────────────────────────────────────────
// Extracted verbatim from App.jsx during P7 sub-batch A (28 Apr 2026).
//
// Note: the local `const statusColor` inside this component intentionally
// shadows the imported one from lib/status.js — PO statuses use a different
// colour vocabulary (sent=blue, received=green) than invoice/job statuses.
// Verbatim preserves this.
//
// Also note: per Phase 7 audit, this component is currently orphaned —
// defined but not rendered as a top-level view in AppInner. Tracked as a
// candidate bug for the post-refactor cleanup pass; refactor preserves the
// dead code as-is.
import React, { useState, useEffect } from "react";
import { db } from "../lib/db.js";
import { C } from "../theme/colors.js";
import { S } from "../theme/styles.js";
import { fmtCurrency } from "../lib/format.js";
import { VoiceFillButton } from "../components/VoiceFillButton.jsx";
import { AssignToJobModal } from "../modals/AssignToJobModal.jsx";

export function PurchaseOrdersTab({ user, brand }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState(null);
  const [assigningPO, setAssigningPO] = useState(null);
  const [form, setForm] = useState({ supplier: "", supplier_email: "", job_ref: "", notes: "", expected_delivery: "", items: [{ description: "", qty: 1, unit_price: "", unit: "unit" }] });

  const assignPOToJob = async (orderId, jobId, jobTitle) => {
    await db.from("purchase_orders").update({ job_id: jobId, job_ref: jobTitle || "" }).eq("id", orderId).eq("user_id", user.id);
    setOrders(p => p.map(o => o.id === orderId ? { ...o, job_id: jobId, job_ref: jobTitle || o.job_ref } : o));
    setAssigningPO(null);
  };

  useEffect(() => { if (user?.id) load(); }, [user?.id]);

  const load = async () => {
    setLoading(true);
    const { data } = await db.from("purchase_orders").select("*, purchase_order_items(*)").eq("user_id", user.id).order("created_at", { ascending: false });
    setOrders(data || []);
    setLoading(false);
  };

  const nextPONumber = () => `PO-${String(orders.length + 1).padStart(4, "0")}`;

  const lineTotal = (item) => parseFloat(item.qty || 1) * parseFloat(item.unit_price || 0);
  const orderTotal = (items) => (items || []).reduce((s, i) => s + lineTotal(i), 0);

  const save = async () => {
    if (!form.supplier) return;
    const poNumber = nextPONumber();
    const total = orderTotal(form.items);
    const { data: order, error } = await db.from("purchase_orders").insert({
      user_id: user.id, po_number: poNumber, supplier: form.supplier,
      supplier_email: form.supplier_email, job_ref: form.job_ref, notes: form.notes,
      expected_delivery: form.expected_delivery || null, status: "sent", total,
      created_at: new Date().toISOString(),
    }).select().single();
    if (error || !order) return;
    if (form.items.length > 0) {
      await db.from("purchase_order_items").insert(form.items.filter(i => i.description).map(i => ({
        po_id: order.id, description: i.description, qty: parseFloat(i.qty || 1),
        unit_price: parseFloat(i.unit_price || 0), unit: i.unit, total: lineTotal(i),
      })));
    }
    setOrders(p => [{ ...order, purchase_order_items: form.items }, ...p]);
    setShowAdd(false);
    setForm({ supplier: "", supplier_email: "", job_ref: "", notes: "", expected_delivery: "", items: [{ description: "", qty: 1, unit_price: "", unit: "unit" }] });
    // Optionally send PO email
    if (form.supplier_email) {
      generatePO({ ...order, purchase_order_items: form.items }, true);
    }
  };

  const updateStatus = async (id, status) => {
    await db.from("purchase_orders").update({ status }).eq("id", id).eq("user_id", user.id);
    setOrders(p => p.map(o => o.id === id ? { ...o, status } : o));
    if (selected?.id === id) setSelected(s => ({ ...s, status }));
  };

  const generatePO = (order, send = false) => {
    const items = order.purchase_order_items || [];
    const total = orderTotal(items);
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Purchase Order ${order.po_number}</title>
    <style>body{font-family:Arial,sans-serif;padding:40px;font-size:13px;color:#111}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid #f59e0b}
    .business{font-size:20px;font-weight:700}.po-title{font-size:16px;font-weight:700;text-align:right}.po-meta{font-size:12px;color:#666;text-align:right;margin-top:4px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px}
    .box{background:#f9fafb;border-radius:8px;padding:16px}.box-label{font-size:10px;text-transform:uppercase;color:#6b7280;margin-bottom:8px;letter-spacing:0.06em}
    table{width:100%;border-collapse:collapse;margin-bottom:20px}
    th{background:#f3f4f6;padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;border-bottom:2px solid #e5e7eb}
    th:not(:first-child){text-align:right}td{padding:9px 12px;border-bottom:1px solid #f3f4f6}td:not(:first-child){text-align:right;font-family:monospace}
    .total{font-weight:700;font-size:14px;background:#fef9f0}.notice{background:#fef3c7;border:1px solid #f59e0b44;border-radius:6px;padding:12px;font-size:11px;color:#92400e;margin-top:16px}
    </style></head><body>
    <div class="header">
      <div><div class="business">${brand?.tradingName || "Trade PA"}</div>${brand?.address ? `<div style="font-size:12px;color:#666;margin-top:4px">${brand.address}</div>` : ""}${brand?.phone ? `<div style="font-size:12px;color:#666">${brand.phone}</div>` : ""}</div>
      <div><div class="po-title">Purchase Order</div><div class="po-meta">${order.po_number}</div><div class="po-meta">${new Date(order.created_at).toLocaleDateString("en-GB", { day:"numeric",month:"long",year:"numeric" })}</div></div>
    </div>
    <div class="grid">
      <div class="box"><div class="box-label">Supplier</div><div style="font-weight:700">${order.supplier}</div>${order.supplier_email ? `<div style="font-size:12px;color:#666;margin-top:4px">${order.supplier_email}</div>` : ""}</div>
      <div class="box"><div class="box-label">Delivery</div>${order.expected_delivery ? `<div style="font-weight:700">${new Date(order.expected_delivery).toLocaleDateString("en-GB")}</div>` : '<div style="color:#9ca3af">No date specified</div>'}${order.job_ref ? `<div style="font-size:12px;color:#666;margin-top:4px">Job: ${order.job_ref}</div>` : ""}</div>
    </div>
    <table><thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Unit Price</th><th>Total</th></tr></thead>
    <tbody>${items.map(i => `<tr><td>${i.description}</td><td>${i.qty}</td><td>${i.unit||"unit"}</td><td>${fmtCurrency(parseFloat(i.unit_price||0))}</td><td>${fmtCurrency(lineTotal(i))}</td></tr>`).join("")}
    <tr class="total"><td colspan="4">Total</td><td>${fmtCurrency(total)}</td></tr></tbody></table>
    ${order.notes ? `<div class="notice"><b>Notes:</b> ${order.notes}</div>` : ""}
    </body></html>`;
    window.dispatchEvent(new CustomEvent("trade-pa-show-pdf", { detail: html }));
  };

  const statusColor = { draft: C.muted, sent: C.blue, received: C.green, cancelled: C.red };
  const UNITS = ["unit", "m", "m²", "length", "sheet", "box", "bag", "roll", "litre", "kg"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 80 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Purchase Orders</div>
        <button onClick={() => setShowAdd(true)} style={S.btn("primary")}>+ New PO</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
        {[["Total POs", orders.length, C.text], ["Awaiting Delivery", orders.filter(o=>o.status==="sent").length, C.amber], ["Received", orders.filter(o=>o.status==="received").length, C.green]].map(([l,v,col],i) => (
          <div key={i} style={{ background: C.surfaceHigh, borderRadius: 10, padding: "14px 16px", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{l}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: col, fontFamily: "'DM Mono',monospace" }}>{v}</div>
          </div>
        ))}
      </div>

      {loading ? <div style={{ fontSize: 12, color: C.muted, padding: 16 }}>Loading...</div> : orders.length === 0 ? (
        <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic", textAlign: "center", padding: 32 }}>No purchase orders yet</div>
      ) : orders.map(o => (
        <div key={o.id} style={{ background: C.surfaceHigh, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer" }} onClick={() => setSelected(selected?.id === o.id ? null : o)}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{o.po_number}</div>
                <div style={{ ...S.badge(statusColor[o.status] || C.muted) }}>{o.status}</div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{o.supplier}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{new Date(o.created_at).toLocaleDateString("en-GB")}{o.job_ref && ` · ${o.job_ref}`}</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>£{parseFloat(o.total||0).toFixed(2)}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{(o.purchase_order_items||[]).length} items</div>
            </div>
          </div>
          {selected?.id === o.id && (
            <div style={{ borderTop: `1px solid ${C.border}`, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              {(o.purchase_order_items || []).map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span>{item.description} × {item.qty} {item.unit}</span>
                  <span style={{ fontFamily: "'DM Mono',monospace" }}>£{lineTotal(item).toFixed(2)}</span>
                </div>
              ))}
              {o.notes && <div style={{ fontSize: 11, color: C.muted, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>Note: {o.notes}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button onClick={() => generatePO(o)} style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", fontSize: 12 }}>⬇ PDF</button>
                <button onClick={() => setAssigningPO(o)} style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", fontSize: 12, color: o.job_id ? C.green : C.muted }}>🔗 {o.job_id ? "Linked" : "Job"}</button>
                {o.status === "sent" && <button onClick={() => updateStatus(o.id, "received")} style={{ ...S.btn("primary"), flex: 1, justifyContent: "center", fontSize: 12 }}>✓ Mark Received</button>}
                {o.status === "draft" && <button onClick={() => updateStatus(o.id, "sent")} style={{ ...S.btn("primary"), flex: 1, justifyContent: "center", fontSize: 12 }}>Send PO</button>}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Add PO Modal */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px,env(safe-area-inset-top,52px))", overflowY: "auto" }} onClick={() => setShowAdd(false)}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.card, maxWidth: 600, width: "100%", marginBottom: 16, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 14, borderBottom: `1px solid ${C.border}`, marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>New Purchase Order</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <VoiceFillButton form={form} setForm={setForm} fieldDescriptions="supplier (supplier name), supplier_email (email address), job_ref (which job this is for), notes (any special instructions), expected_delivery (date YYYY-MM-DD)" />
                <button aria-label="Close" onClick={() => setShowAdd(false)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={S.grid2}>
                <div><label style={S.label}>Supplier</label><input style={S.input} value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} placeholder="Supplier name" /></div>
                <div><label style={S.label}>Supplier Email</label><input style={S.input} type="email" value={form.supplier_email} onChange={e => setForm(f => ({ ...f, supplier_email: e.target.value }))} placeholder="orders@supplier.com" /></div>
              </div>
              <div style={S.grid2}>
                <div><label style={S.label}>Job Reference</label><input style={S.input} value={form.job_ref} onChange={e => setForm(f => ({ ...f, job_ref: e.target.value }))} placeholder="Which job is this for?" /></div>
                <div><label style={S.label}>Expected Delivery</label><input style={S.input} type="date" value={form.expected_delivery} onChange={e => setForm(f => ({ ...f, expected_delivery: e.target.value }))} /></div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label style={S.label}>Items</label>
                  <button onClick={() => setForm(f => ({ ...f, items: [...f.items, { description: "", qty: 1, unit_price: "", unit: "unit" }] }))} style={{ ...S.btn("ghost"), fontSize: 11, padding: "3px 10px" }}>+ Add Line</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 50px 70px 70px 24px", gap: 6 }}>
                    {["Description", "Qty", "Unit", "Price £", ""].map(h => <div key={h} style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</div>)}
                  </div>
                  {form.items.map((item, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 50px 70px 70px 24px", gap: 6, alignItems: "center" }}>
                      <input style={{ ...S.input, fontSize: 12 }} value={item.description} onChange={e => setForm(f => ({ ...f, items: f.items.map((x,j) => j===i ? {...x, description: e.target.value} : x) }))} placeholder="Item" />
                      <input style={{ ...S.input, fontSize: 12 }} type="number" min="1" value={item.qty} onChange={e => setForm(f => ({ ...f, items: f.items.map((x,j) => j===i ? {...x, qty: e.target.value} : x) }))} />
                      <select style={{ ...S.input, fontSize: 11 }} value={item.unit} onChange={e => setForm(f => ({ ...f, items: f.items.map((x,j) => j===i ? {...x, unit: e.target.value} : x) }))}>
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <input style={{ ...S.input, fontSize: 12 }} type="number" step="0.01" placeholder="0.00" value={item.unit_price} onChange={e => setForm(f => ({ ...f, items: f.items.map((x,j) => j===i ? {...x, unit_price: e.target.value} : x) }))} />
                      <button onClick={() => setForm(f => ({ ...f, items: f.items.filter((_,j) => j!==i) }))} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }} disabled={form.items.length===1}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
                    </div>
                  ))}
                  {orderTotal(form.items) > 0 && <div style={{ fontSize: 12, fontWeight: 700, textAlign: "right", color: C.amber, fontFamily: "'DM Mono',monospace" }}>Total: £{orderTotal(form.items).toFixed(2)}</div>}
                </div>
              </div>
              <div><label style={S.label}>Notes</label><textarea style={{ ...S.input, minHeight: 60 }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any special instructions..." /></div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button style={{ ...S.btn("primary"), flex: 1, justifyContent: "center" }} onClick={save} disabled={!form.supplier}>Create PO</button>
              <button style={S.btn("ghost")} onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {assigningPO && (
        <AssignToJobModal
          user={user}
          currentJobId={assigningPO.job_id}
          onAssign={(jobId, jobTitle) => assignPOToJob(assigningPO.id, jobId, jobTitle)}
          onClose={() => setAssigningPO(null)}
        />
      )}
    </div>
  );
}
// ─── RAMS BUILDER ────────────────────────────────────────────────────────────
