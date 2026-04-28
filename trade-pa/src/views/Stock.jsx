// ─── Stock Inventory ────────────────────────────────────────────────────
// Extracted verbatim from App.jsx during P7 sub-batch A (28 Apr 2026).
import React, { useState, useEffect } from "react";
import { db } from "../lib/db.js";
import { C } from "../theme/colors.js";
import { S } from "../theme/styles.js";
import { fmtCurrency } from "../lib/format.js";
import { VoiceFillButton } from "../components/VoiceFillButton.jsx";

export function StockTab({ user, setContextHint }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all | low

  useEffect(() => {
    if (!setContextHint) return;
    const low = items.filter(i => i.qty <= (i.reorder_level || 0)).length;
    const bits = [`Stock: ${items.length} items`];
    if (low) bits.push(`${low} low`);
    setContextHint(bits.join(" · "));
    return () => { if (setContextHint) setContextHint(null); };
  }, [items, setContextHint]);
  const [sortMode, setSortMode] = useState("name"); // name | quantity | value
  const [form, setForm] = useState({ name: "", sku: "", quantity: "", unit: "unit", reorder_level: "", unit_cost: "", location: "" });

  const UNITS = ["unit", "m", "m²", "m³", "length", "sheet", "box", "bag", "roll", "litre", "kg"];

  useEffect(() => { if (user?.id) load(); }, [user?.id]);

  const load = async () => {
    setLoading(true);
    const { data } = await db.from("stock_items").select("*").eq("user_id", user.id).order("name");
    setItems(data || []);
    setLoading(false);
  };

  const save = async () => {
    if (!form.name) return;
    const payload = { user_id: user.id, name: form.name, sku: form.sku, quantity: parseFloat(form.quantity || 0), unit: form.unit, reorder_level: parseFloat(form.reorder_level || 0), unit_cost: parseFloat(form.unit_cost || 0), location: form.location, updated_at: new Date().toISOString() };
    if (editing) {
      const { data, error } = await db.from("stock_items").update(payload).eq("id", editing.id).eq("user_id", user.id).select().single();
      if (!error && data) { setItems(p => p.map(i => i.id === data.id ? data : i)); setEditing(null); }
    } else {
      const { data, error } = await db.from("stock_items").insert({ ...payload, created_at: new Date().toISOString() }).select().single();
      if (!error && data) { setItems(p => [...p, data]); setShowAdd(false); }
    }
    setForm({ name: "", sku: "", quantity: "", unit: "unit", reorder_level: "", unit_cost: "", location: "" });
  };

  const adjust = async (id, delta) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const newQty = Math.max(0, parseFloat(item.quantity || 0) + delta);
    const { data, error } = await db.from("stock_items").update({ quantity: newQty, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id).select().single();
    if (!error && data) setItems(p => p.map(i => i.id === data.id ? data : i));
  };

  const del = async (id) => {
    if (!confirm("Delete this stock item?")) return;
    await db.from("stock_items").delete().eq("id", id).eq("user_id", user.id);
    setItems(p => p.filter(i => i.id !== id));
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({ name: item.name, sku: item.sku || "", quantity: String(item.quantity || 0), unit: item.unit || "unit", reorder_level: String(item.reorder_level || ""), unit_cost: String(item.unit_cost || ""), location: item.location || "" });
  };

  const sLower = search.trim().toLowerCase();
  const searched = items.filter(i => !sLower || i.name?.toLowerCase().includes(sLower) || i.sku?.toLowerCase().includes(sLower));
  const lowStock = items.filter(i => i.reorder_level > 0 && parseFloat(i.quantity || 0) <= parseFloat(i.reorder_level || 0));
  const lowStockIds = new Set(lowStock.map(i => i.id));
  const filtered = (filter === "low" ? searched.filter(i => lowStockIds.has(i.id)) : searched).sort((a, b) => {
    if (sortMode === "quantity") return parseFloat(b.quantity || 0) - parseFloat(a.quantity || 0);
    if (sortMode === "value") return (parseFloat(b.quantity || 0) * parseFloat(b.unit_cost || 0)) - (parseFloat(a.quantity || 0) * parseFloat(a.unit_cost || 0));
    return (a.name || "").localeCompare(b.name || "");
  });
  const totalValue = items.reduce((s, i) => s + parseFloat(i.quantity || 0) * parseFloat(i.unit_cost || 0), 0);

  const chipStyle = (active, color) => ({
    padding: "6px 12px", borderRadius: 16, fontSize: 12, fontWeight: 600,
    background: active ? (color || C.text) : "transparent",
    color: active ? (color === C.text ? C.bg : "#fff") : C.textDim,
    border: `1px solid ${active ? (color || C.text) : C.border}`,
    cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
  });
  const nextSort = () => setSortMode(m => m === "name" ? "quantity" : m === "quantity" ? "value" : "name");
  const sortLabel = sortMode === "name" ? "Name" : sortMode === "quantity" ? "Quantity" : "Value";

  const FormModal = ({ title, onClose }) => (
    <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px,env(safe-area-inset-top,52px))", overflowY: "auto" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ ...S.card, maxWidth: 480, width: "100%", marginBottom: 16, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 14, borderBottom: `1px solid ${C.border}`, marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <VoiceFillButton form={form} setForm={setForm} fieldDescriptions="name (item name e.g. 22mm copper pipe), sku (stock code), quantity (number in stock), unit (unit e.g. m/unit/box/kg), unit_cost (cost per unit in pounds), reorder_level (alert when below this number), location (where stored e.g. van shelf 2)" />
            <button aria-label="Close" onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={S.grid2}>
            <div><label style={S.label}>SKU / Code</label><input style={S.input} value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="Optional" /></div>
            <div><label style={S.label}>Location</label><input style={S.input} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Van shelf 2" /></div>
          </div>
          <div style={S.grid2}>
            <div><label style={S.label}>Quantity</label><input style={S.input} type="number" step="0.1" min="0" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0" /></div>
            <div>
              <label style={S.label}>Unit</label>
              <select style={S.input} value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div style={S.grid2}>
            <div><label style={S.label}>Unit Cost (£)</label><input style={S.input} type="number" step="0.01" min="0" value={form.unit_cost} onChange={e => setForm(f => ({ ...f, unit_cost: e.target.value }))} placeholder="0.00" /></div>
            <div><label style={S.label}>Reorder Level</label><input style={S.input} type="number" step="0.1" min="0" value={form.reorder_level} onChange={e => setForm(f => ({ ...f, reorder_level: e.target.value }))} placeholder="Alert when below" /></div>
          </div>
          {form.quantity && form.unit_cost && <div style={{ fontSize: 11, color: C.green, background: C.green + "11", borderRadius: 10, padding: "6px 10px" }}>Stock value: £{(parseFloat(form.quantity||0) * parseFloat(form.unit_cost||0)).toFixed(2)}</div>}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button style={{ ...S.btn("primary"), flex: 1, justifyContent: "center" }} onClick={save} disabled={!form.name}>Save</button>
          <button style={S.btn("ghost")} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 80 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Stock</div>
        <button onClick={() => setShowAdd(true)} style={S.btn("primary")}>+ Add Item</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
        {[["Items", items.length, C.text], ["Stock Value", "£" + totalValue.toFixed(2), C.green], ["Low Stock", lowStock.length, lowStock.length > 0 ? C.red : C.muted]].map(([l,v,col],i) => (
          <div key={i} style={{ background: C.surfaceHigh, borderRadius: 10, padding: "14px 16px", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{l}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: col, fontFamily: "'DM Mono',monospace" }}>{v}</div>
          </div>
        ))}
      </div>

      {lowStock.length > 0 && (
        <div style={{ background: C.red + "11", border: `1px solid ${C.red}44`, borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.red, marginBottom: 6 }}>⚠ Low Stock Alert</div>
          {lowStock.map(i => <div key={i.id} style={{ fontSize: 12, color: C.muted }}>{i.name} — {i.quantity} {i.unit} remaining (reorder at {i.reorder_level})</div>)}
        </div>
      )}

      <input style={S.input} placeholder="Search stock..." value={search} onChange={e => setSearch(e.target.value)} />

      {items.length > 0 && (
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => setFilter("all")} style={chipStyle(filter === "all")}>All {items.length}</button>
          <button onClick={() => setFilter("low")} style={chipStyle(filter === "low", C.red)}>Low stock {lowStock.length}</button>
          <button onClick={nextSort} style={{
            marginLeft: "auto", padding: "6px 12px", borderRadius: 16,
            fontSize: 12, fontWeight: 600, background: "transparent",
            color: C.muted, border: `1px solid ${C.border}`, cursor: "pointer",
            whiteSpace: "nowrap",
          }}>↕ {sortLabel}</button>
        </div>
      )}

      {loading ? <div style={{ fontSize: 12, color: C.muted, padding: 16 }}>Loading...</div> : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 16px" }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>📦</div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>No stock items yet</div>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>Tap <strong style={{ color: C.amber }}>+ Add Item</strong> above to track what you carry in the van. Set a reorder level and Trade PA will flag low stock. Or say: "add 5 boxes of 22mm copper to stock".</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: 24 }}>{search ? `No stock matches "${search}".` : filter === "low" ? "No items below reorder level — all stocked up." : "No items."}</div>
      ) : filtered.map(item => {
        const isLow = item.reorder_level > 0 && parseFloat(item.quantity || 0) <= parseFloat(item.reorder_level || 0);
        return (
          <div key={item.id} style={{ background: C.surfaceHigh, borderRadius: 10, border: `1px solid ${isLow ? C.red + "66" : C.border}`, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
              <div style={{ width: 4, alignSelf: "stretch", borderRadius: 2, background: isLow ? C.red : C.green, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  {item.sku && `SKU: ${item.sku} · `}
                  {item.location && `📍 ${item.location} · `}
                  {item.unit_cost > 0 && `${fmtCurrency(parseFloat(item.unit_cost))}/${item.unit}`}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <button onClick={() => adjust(item.id, -1)} style={{ width: 28, height: 28, borderRadius: 10, background: C.surfaceHigh, border: `1px solid ${C.border}`, color: C.text, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                <div style={{ textAlign: "center", minWidth: 50 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: isLow ? C.red : C.text }}>{item.quantity}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>{item.unit}</div>
                </div>
                <button onClick={() => adjust(item.id, 1)} style={{ width: 28, height: 28, borderRadius: 10, background: C.surfaceHigh, border: `1px solid ${C.border}`, color: C.text, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
              </div>
              <button onClick={() => openEdit(item)} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px", flexShrink: 0 }}>✏</button>
              <button onClick={() => del(item.id)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: "0 4px", flexShrink: 0 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
            </div>
          </div>
        );
      })}

      {showAdd && <FormModal title="Add Stock Item" onClose={() => { setShowAdd(false); setForm({ name: "", sku: "", quantity: "", unit: "unit", reorder_level: "", unit_cost: "", location: "" }); }} />}
      {editing && <FormModal title="Edit Stock Item" onClose={() => { setEditing(null); setForm({ name: "", sku: "", quantity: "", unit: "unit", reorder_level: "", unit_cost: "", location: "" }); }} />}
    </div>
  );
}
// ─── PURCHASE ORDERS ─────────────────────────────────────────────────────────
