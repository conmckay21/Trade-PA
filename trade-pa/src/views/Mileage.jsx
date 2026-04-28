// ─── Mileage Tab ────────────────────────────────────────────────────────
// Extracted verbatim from App.jsx during P7 sub-batch A (28 Apr 2026).
import React, { useState, useEffect } from "react";
import { db } from "../lib/db.js";
import { C } from "../theme/colors.js";
import { S } from "../theme/styles.js";
import { fmtCurrency } from "../lib/format.js";
import { VoiceFillButton } from "../components/VoiceFillButton.jsx";

export function MileageTab({ user, setContextHint }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingTrip, setEditingTrip] = useState(null);

  useEffect(() => {
    if (!setContextHint) return;
    const totalMiles = trips.reduce((s, t) => s + parseFloat(t.miles || 0), 0);
    setContextHint(`Mileage: ${trips.length} trips · ${Math.round(totalMiles)} miles`);
    return () => { if (setContextHint) setContextHint(null); };
  }, [trips, setContextHint]);
  const [form, setForm] = useState({ date: new Date().toISOString().split("T")[0], from: "", to: "", miles: "", job: "", purpose: "" });
  const [yearMiles, setYearMiles] = useState(0);
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState("date"); // date | miles | value

  const taxYearStart = () => {
    const now = new Date();
    const april6 = new Date(now.getFullYear(), 3, 6);
    return (now >= april6 ? april6 : new Date(now.getFullYear() - 1, 3, 6)).toISOString().split("T")[0];
  };

  const calcValue = (miles, priorMiles = 0) => {
    let v = 0, m = parseFloat(miles || 0);
    for (let i = 0; i < m; i++) v += (priorMiles + i) < 10000 ? 0.45 : 0.25;
    return parseFloat(v.toFixed(2));
  };

  useEffect(() => { if (user?.id) load(); }, [user?.id]);

  const load = async () => {
    setLoading(true);
    const { data } = await db.from("mileage_logs").select("*").eq("user_id", user.id).order("date", { ascending: false });
    setTrips(data || []);
    const ym = (data || []).filter(t => t.date >= taxYearStart()).reduce((s, t) => s + parseFloat(t.miles || 0), 0);
    setYearMiles(ym);
    setLoading(false);
  };

  const save = async () => {
    if (!form.miles || !form.date) return;
    const value = calcValue(form.miles, yearMiles);
    const { data, error } = await db.from("mileage_logs").insert({ user_id: user.id, date: form.date, from_location: form.from, to_location: form.to, miles: parseFloat(form.miles), job_ref: form.job, purpose: form.purpose, rate: parseFloat(form.miles) <= (10000 - yearMiles) ? 0.45 : 0.25, value, created_at: new Date().toISOString() }).select().single();
    if (!error && data) { setTrips(p => [data, ...p]); setYearMiles(y => y + parseFloat(form.miles)); setShowAdd(false); setForm({ date: new Date().toISOString().split("T")[0], from: "", to: "", miles: "", job: "", purpose: "" }); }
  };

  const del = async (id, miles) => {
    await db.from("mileage_logs").delete().eq("id", id).eq("user_id", user.id);
    setTrips(p => p.filter(t => t.id !== id));
    setYearMiles(y => y - parseFloat(miles || 0));
  };

  const updateTrip = async () => {
    if (!form.miles || !form.date || !editingTrip) return;
    const oldMiles = parseFloat(editingTrip.miles || 0);
    const newMiles = parseFloat(form.miles);
    const value = calcValue(newMiles, yearMiles - oldMiles);
    const { error } = await db.from("mileage_logs").update({
      date: form.date, from_location: form.from, to_location: form.to,
      miles: newMiles, job_ref: form.job, purpose: form.purpose, value,
    }).eq("id", editingTrip.id).eq("user_id", user.id);
    if (!error) {
      setTrips(p => p.map(t => t.id === editingTrip.id ? { ...t, date: form.date, from_location: form.from, to_location: form.to, miles: newMiles, job_ref: form.job, purpose: form.purpose, value } : t));
      setYearMiles(y => y - oldMiles + newMiles);
      setEditingTrip(null); setShowAdd(false);
      setForm({ date: new Date().toISOString().split("T")[0], from: "", to: "", miles: "", job: "", purpose: "" });
    }
  };

  const openEditTrip = (t) => {
    setForm({ date: t.date || "", from: t.from_location || "", to: t.to_location || "", miles: String(t.miles || ""), job: t.job_ref || "", purpose: t.purpose || "" });
    setEditingTrip(t);
    setShowAdd(true);
  };

  const yearValue = calcValue(yearMiles);

  // Search + sort
  const sLower = search.trim().toLowerCase();
  const visibleTrips = trips.filter(t => {
    if (!sLower) return true;
    return (t.from_location || "").toLowerCase().includes(sLower)
        || (t.to_location || "").toLowerCase().includes(sLower)
        || (t.purpose || "").toLowerCase().includes(sLower)
        || (t.job_ref || "").toLowerCase().includes(sLower);
  }).sort((a, b) => {
    if (sortMode === "miles") return parseFloat(b.miles || 0) - parseFloat(a.miles || 0);
    if (sortMode === "value") return parseFloat(b.value || 0) - parseFloat(a.value || 0);
    return new Date(b.date) - new Date(a.date);
  });
  const nextSort = () => setSortMode(m => m === "date" ? "miles" : m === "miles" ? "value" : "date");
  const sortLabel = sortMode === "date" ? "Recent" : sortMode === "miles" ? "Miles" : "Value";

  const exportPDF = () => {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Mileage Log</title><style>body{font-family:Arial,sans-serif;padding:32px;font-size:12px}h1{font-size:20px;margin-bottom:4px}.meta{color:#666;margin-bottom:24px}table{width:100%;border-collapse:collapse}th{background:#f3f4f6;padding:8px;text-align:left;font-size:10px;text-transform:uppercase;border-bottom:2px solid #e5e7eb}td{padding:8px;border-bottom:1px solid #f3f4f6}tr.tot td{font-weight:700;background:#fef9f0}</style></head><body><h1>Mileage Log</h1><div class="meta">Tax Year · ${yearMiles.toFixed(1)} miles · ${fmtCurrency(yearValue)} claimable at HMRC rates</div><table><thead><tr><th>Date</th><th>From</th><th>To</th><th>Miles</th><th>Purpose / Job</th><th>Value</th></tr></thead><tbody>${trips.map(t=>`<tr><td>${new Date(t.date).toLocaleDateString("en-GB")}</td><td>${t.from_location||"—"}</td><td>${t.to_location||"—"}</td><td>${t.miles}</td><td>${t.purpose||t.job_ref||"—"}</td><td>${fmtCurrency((t.value||0))}</td></tr>`).join("")}<tr class="tot"><td colspan="3"><b>Total (Tax Year)</b></td><td>${yearMiles.toFixed(1)}</td><td></td><td>${fmtCurrency(yearValue)}</td></tr></tbody></table><p style="margin-top:20px;font-size:11px;color:#888">HMRC mileage rate: 45p/mile for first 10,000 miles · 25p/mile thereafter</p></body></html>`;
    window.dispatchEvent(new CustomEvent("trade-pa-show-pdf", { detail: html }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 80 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Mileage</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={exportPDF} style={{ ...S.btn("ghost"), fontSize: 12 }}>⬇ PDF</button>
          <button onClick={() => setShowAdd(true)} style={S.btn("primary")}>+ Add Trip</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
        {[["Miles This Tax Year", yearMiles.toFixed(1) + " mi", C.text], ["Tax Relief Value", "£" + yearValue.toFixed(2), C.green], ["Remaining at 45p", Math.max(0, 10000 - yearMiles).toFixed(0) + " mi", C.amber], ["Total Trips", trips.length, C.muted]].map(([l, v, col], i) => (
          <div key={i} style={{ background: C.surfaceHigh, borderRadius: 10, padding: "14px 16px", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: col, fontFamily: "'DM Mono',monospace" }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, color: C.amber, background: C.amber + "11", border: `1px solid ${C.amber}33`, borderRadius: 8, padding: "8px 12px" }}>
        💡 HMRC allows 45p/mile for your first 10,000 business miles each tax year, then 25p/mile. Export this log for your self-assessment.
      </div>

      {/* Search + sort */}
      {trips.length > 0 && (
        <>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search from, to, purpose…"
            style={{ ...S.input, fontSize: 13 }}
          />
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <div style={{ fontSize: 11, color: C.muted }}>{visibleTrips.length} of {trips.length} trip{trips.length === 1 ? "" : "s"}</div>
            <button onClick={nextSort} style={{
              marginLeft: "auto", padding: "6px 12px", borderRadius: 16,
              fontSize: 12, fontWeight: 600, background: "transparent",
              color: C.muted, border: `1px solid ${C.border}`, cursor: "pointer",
              whiteSpace: "nowrap",
            }}>↕ {sortLabel}</button>
          </div>
        </>
      )}

      {loading ? <div style={{ fontSize: 12, color: C.muted, padding: 16 }}>Loading...</div> : trips.length === 0 ? (
        <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic", textAlign: "center", padding: 32 }}>No trips logged yet — tap + Add Trip</div>
      ) : visibleTrips.length === 0 ? (
        <div style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: 24 }}>No trips match "{search}".</div>
      ) : visibleTrips.map(t => (
        <div key={t.id} style={{ background: C.surfaceHigh, borderRadius: 10, padding: "12px 14px", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 4, height: 40, borderRadius: 2, background: C.muted, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{t.from_location || "Trip"}{t.to_location ? ` → ${t.to_location}` : ""}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{new Date(t.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}{(t.purpose || t.job_ref) ? ` · ${t.purpose || t.job_ref}` : ""}</div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{t.miles} mi</div>
            <div style={{ fontSize: 11, color: C.green, fontFamily: "'DM Mono',monospace" }}>£{(t.value || 0).toFixed(2)}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
            <button onClick={(e) => { e.stopPropagation(); openEditTrip(t); }} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: "2px 4px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button onClick={() => del(t.id, t.miles)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: "2px 4px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
      ))}

      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px,env(safe-area-inset-top,52px))", overflowY: "auto" }} onClick={() => { setShowAdd(false); setEditingTrip(null); }}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.card, maxWidth: 480, width: "100%", marginBottom: 16, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 14, borderBottom: `1px solid ${C.border}`, marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{editingTrip ? "Edit Trip" : "Log Trip"}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <VoiceFillButton form={form} setForm={setForm} fieldDescriptions="date (YYYY-MM-DD), from (start location e.g. Home), to (destination), miles (number), purpose (e.g. site visit)" />
                <button aria-label="Close" onClick={() => { setShowAdd(false); setEditingTrip(null); }} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><label style={S.label}>Date</label><input style={S.input} type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
              <div style={S.grid2}>
                <div><label style={S.label}>From</label><input style={S.input} value={form.from} onChange={e => setForm(f => ({ ...f, from: e.target.value }))} placeholder="e.g. Home" /></div>
                <div><label style={S.label}>To</label><input style={S.input} value={form.to} onChange={e => setForm(f => ({ ...f, to: e.target.value }))} placeholder="e.g. Customer site" /></div>
              </div>
              <div style={S.grid2}>
                <div>
                  <label style={S.label}>Miles</label>
                  <input style={S.input} type="number" step="0.1" min="0" value={form.miles} onChange={e => setForm(f => ({ ...f, miles: e.target.value }))} placeholder="0.0" />
                </div>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                  {form.miles > 0 && <div style={{ fontSize: 12, color: C.green, background: C.green + "11", borderRadius: 10, padding: "8px 10px", textAlign: "center", fontFamily: "'DM Mono',monospace" }}>£{calcValue(form.miles, yearMiles).toFixed(2)} claimable</div>}
                </div>
              </div>
              <div><label style={S.label}>Job / Purpose</label><input style={S.input} value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} placeholder="e.g. Boiler service — J. Smith" /></div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button style={{ ...S.btn("primary"), flex: 1, justifyContent: "center" }} onClick={editingTrip ? updateTrip : save} disabled={!form.miles}>{editingTrip ? "Save Changes" : "Save Trip"}</button>
              <button style={S.btn("ghost")} onClick={() => { setShowAdd(false); setEditingTrip(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// ─── SUBCONTRACTOR CIS MANAGEMENT ────────────────────────────────────────────
