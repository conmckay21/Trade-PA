// ─── Expenses & Mileage Tab ─────────────────────────────────────────────
// Extracted verbatim from App.jsx during P7 sub-batch A (28 Apr 2026).
import React, { useState, useEffect, useRef } from "react";
import { db } from "../lib/db.js";
import { C } from "../theme/colors.js";
import { S } from "../theme/styles.js";
import { fmtCurrency } from "../lib/format.js";
import { localDate } from "../lib/time.js";
import { MILEAGE_RATE } from "../lib/constants.js";
import { VoiceFillButton } from "../components/VoiceFillButton.jsx";

export function ExpensesTab({ user, setContextHint }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ exp_type: "mileage", description: "", amount: "", miles: "", exp_date: localDate() });
  const [filterMonth, setFilterMonth] = useState("all");

  useEffect(() => {
    if (!setContextHint) return;
    const total = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    setContextHint(`Expenses: ${expenses.length} records · £${Math.round(total).toLocaleString()} total`);
    return () => { if (setContextHint) setContextHint(null); };
  }, [expenses, setContextHint]);
  const [search, setSearch] = useState("");
  const receiptRef = useRef();
  const [receiptData, setReceiptData] = useState(null);

  useEffect(() => { loadExpenses(); }, [user]);

  async function loadExpenses() {
    if (!user) return;
    setLoading(true);
    const { data } = await db.from("expenses").select("*").eq("user_id", user.id).order("exp_date", { ascending: false });
    setExpenses(data || []);
    setLoading(false);
  }

  async function saveExpense() {
    let amount = parseFloat(form.amount) || 0;
    if (form.exp_type === "mileage" && form.miles) {
      amount = parseFloat(form.miles) * MILEAGE_RATE;
    }
    const { data } = await db.from("expenses").insert({
      user_id: user.id,
      exp_type: form.exp_type,
      description: form.description,
      amount,
      miles: form.exp_type === "mileage" ? parseFloat(form.miles) : null,
      exp_date: form.exp_date,
      receipt_data: receiptData || null,
    }).select().single();
    if (data) {
      setExpenses(prev => [data, ...prev]);
      setShowAdd(false);
      setForm({ exp_type: "mileage", description: "", amount: "", miles: "", exp_date: localDate() });
      setReceiptData(null);
    }
  }

  const addReceipt = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => setReceiptData(e.target.result);
    reader.readAsDataURL(file);
  };

  const months = [...new Set(expenses.map(e => e.exp_date?.slice(0,7)))].sort().reverse();
  const monthFiltered = filterMonth === "all" ? expenses : expenses.filter(e => e.exp_date?.startsWith(filterMonth));
  // Search applies on top of month filter
  const sLower = search.trim().toLowerCase();
  const filtered = !sLower ? monthFiltered : monthFiltered.filter(e =>
    (e.description || "").toLowerCase().includes(sLower)
    || (e.exp_type || "").toLowerCase().includes(sLower)
  );
  const totalFiltered = filtered.reduce((s, e) => s + (e.amount || 0), 0);
  const totalMileage = filtered.filter(e => e.exp_type === "mileage").reduce((s, e) => s + (e.miles || 0), 0);

  const EXP_TYPES = [
    { value: "mileage", label: "🚗 Mileage", desc: `HMRC rate ${MILEAGE_RATE * 100}p/mile` },
    { value: "fuel", label: "⛽ Fuel" },
    { value: "parking", label: "🅿 Parking" },
    { value: "tools", label: "🔧 Tools" },
    { value: "materials", label: "📦 Materials" },
    { value: "accommodation", label: "🏨 Accommodation" },
    { value: "subsistence", label: "🥗 Subsistence" },
    { value: "other", label: "📋 Other" },
  ];

  // Canonical filter-chip style (amber discipline — chips are neutral, not amber)
  const chipStyle = (active) => ({
    padding: "6px 12px", borderRadius: 16, fontSize: 12, fontWeight: 600,
    background: active ? C.text : "transparent",
    color: active ? C.bg : C.textDim,
    border: `1px solid ${active ? C.text : C.border}`,
    cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Expenses & Mileage</div>
        <button style={S.btn("primary")} onClick={() => setShowAdd(true)}>+ Add Expense</button>
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 10 }}>
        {[
          { l: "Total Expenses", v: `${fmtCurrency(filtered.reduce((s,e) => s + (e.amount||0), 0))}`, c: C.text },
          { l: "Mileage", v: `${totalMileage.toFixed(0)} miles`, c: C.blue },
          { l: "Mileage Value", v: `${fmtCurrency((totalMileage * MILEAGE_RATE))}`, c: C.green },
          { l: "This period", v: filtered.length + " entries", c: C.muted },
        ].map((st, i) => (
          <div key={i} style={S.card}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{st.l}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: st.c }}>{st.v}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      {expenses.length > 0 && (
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search description or type…"
          style={{ ...S.input, fontSize: 13 }}
        />
      )}

      {/* Month filter — canonical chip style */}
      {months.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => setFilterMonth("all")} style={chipStyle(filterMonth === "all")}>All time</button>
          {months.slice(0, 6).map(m => (
            <button key={m} onClick={() => setFilterMonth(m)} style={chipStyle(filterMonth === m)}>
              {new Date(m + "-01").toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
            </button>
          ))}
        </div>
      )}

      {/* Expense list */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Expense Log ({filtered.length})</div>
        {loading && <div style={{ fontSize: 12, color: C.muted }}>Loading...</div>}
        {!loading && expenses.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 16px" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🧾</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>No expenses logged yet</div>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>Tap <strong style={{ color: C.amber }}>+ Log Expense</strong> above, scan a receipt, or just tell Trade PA: "log £42 for diesel today".</div>
          </div>
        )}
        {!loading && expenses.length > 0 && filtered.length === 0 && <div style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: "16px 8px" }}>{search ? `No expenses match "${search}".` : "No expenses this period."}</div>}
        {filtered.map(e => (
          <div key={e.id} style={S.row}>
            <div style={{ fontSize: 18, flexShrink: 0 }}>{EXP_TYPES.find(t => t.value === e.exp_type)?.label?.split(" ")[0] || "📋"}</div>
            <div style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{EXP_TYPES.find(t => t.value === e.exp_type)?.label?.split(" ").slice(1).join(" ") || e.exp_type}</div>
              <div style={{ fontSize: 11, color: C.muted }}>
                {new Date(e.exp_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                {e.description ? ` · ${e.description}` : ""}
                {e.miles ? ` · ${e.miles} miles` : ""}
              </div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, flexShrink: 0 }}>£{Number(e.amount).toFixed(2)}</div>
            {e.receipt_data && <div style={{ fontSize: 16, marginLeft: 6 }} title="Receipt attached">🧾</div>}
          </div>
        ))}
      </div>

      {/* Add Expense Modal */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }}>
          <div style={{ ...S.card, maxWidth: 460, width: "100%", marginBottom: 16, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 14, borderBottom: `1px solid ${C.border}`, marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Add Expense</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <VoiceFillButton form={form} setForm={setForm} fieldDescriptions="exp_type (type: mileage/fuel/parking/tools/materials/other), miles (miles as number if mileage), amount (£ amount as number), description (what it was for e.g. trip to Screwfix), exp_date (date in YYYY-MM-DD format)" />
                <button aria-label="Close" onClick={() => { setShowAdd(false); setReceiptData(null); }} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={S.label}>Type</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {EXP_TYPES.map(t => (
                    <button key={t.value} onClick={() => setForm(f => ({ ...f, exp_type: t.value }))} style={S.pill(C.amber, form.exp_type === t.value)}>{t.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={S.label}>Date</label>
                <input type="date" style={S.input} value={form.exp_date} onChange={e => setForm(f => ({ ...f, exp_date: e.target.value }))} />
              </div>
              {form.exp_type === "mileage" ? (
                <div>
                  <label style={S.label}>Miles</label>
                  <input type="number" style={S.input} placeholder="e.g. 24" value={form.miles} onChange={e => setForm(f => ({ ...f, miles: e.target.value }))} />
                  {form.miles && <div style={{ fontSize: 11, color: C.amber, marginTop: 4 }}>= £{(parseFloat(form.miles) * MILEAGE_RATE).toFixed(2)} at {MILEAGE_RATE * 100}p/mile</div>}
                </div>
              ) : (
                <div>
                  <label style={S.label}>Amount (£)</label>
                  <input type="number" step="0.01" style={S.input} placeholder="e.g. 45.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
              )}
              <div>
                <label style={S.label}>Description</label>
                <input style={S.input} placeholder="e.g. Trip to Screwfix, parking at site" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Receipt (optional)</label>
                <button style={{ ...S.btn("ghost"), width: "100%", justifyContent: "center" }} onClick={() => receiptRef.current?.click()}>
                  {receiptData ? "✓ Receipt added" : "📷 Add receipt photo"}
                </button>
                <input ref={receiptRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => { addReceipt(e.target.files?.[0]); e.target.value = ""; }} />
              </div>
              <button style={S.btn("primary", (!form.miles && !form.amount) || form.exp_type === "mileage" && !form.miles)} onClick={saveExpense}>Save Expense →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CIS Statements Tab ───────────────────────────────────────────────────────
