// ─── CIS Monthly Statements ──────────────────────────────────────────────
// Extracted verbatim from App.jsx during P7 sub-batch A (28 Apr 2026).
import React, { useState, useEffect } from "react";
import { db } from "../lib/db.js";
import { C } from "../theme/colors.js";
import { S } from "../theme/styles.js";
import { fmtCurrency } from "../lib/format.js";
import { localMonth } from "../lib/time.js";
import { openHtmlPreview } from "../lib/files.js";
import { VoiceFillButton } from "../components/VoiceFillButton.jsx";

export function CISStatementsTab({ user, setContextHint }) {
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    if (!setContextHint) return;
    const totalDed = statements.reduce((s, st) => s + parseFloat(st.deduction || 0), 0);
    setContextHint(`CIS: ${statements.length} statements · £${Math.round(totalDed).toLocaleString()} deductions`);
    return () => { if (setContextHint) setContextHint(null); };
  }, [statements, setContextHint]);
  const [form, setForm] = useState({ contractor_name: "", tax_month: localMonth(), gross_amount: "", deduction_amount: "", notes: "" });
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("all");

  useEffect(() => { loadStatements(); }, [user]);

  async function loadStatements() {
    if (!user) return;
    setLoading(true);
    const { data } = await db.from("cis_statements").select("*").eq("user_id", user.id).is("archived_at", null).order("tax_month", { ascending: false });
    setStatements(data || []);
    setLoading(false);
  }

  async function saveStatement() {
    const gross = parseFloat(form.gross_amount) || 0;
    const deduction = parseFloat(form.deduction_amount) || 0;
    const { data } = await db.from("cis_statements").insert({
      user_id: user.id,
      contractor_name: form.contractor_name,
      tax_month: form.tax_month + "-01",
      gross_amount: gross,
      deduction_amount: deduction,
      net_amount: gross - deduction,
      notes: form.notes,
    }).select().single();
    if (data) {
      setStatements(prev => [data, ...prev]);
      setShowAdd(false);
      setForm({ contractor_name: "", tax_month: localMonth(), gross_amount: "", deduction_amount: "", notes: "" });
    }
  }

  const years = [...new Set(statements.map(s => s.tax_month?.slice(0,4)).filter(Boolean))].sort().reverse();
  const sLower = search.trim().toLowerCase();
  const visibleStatements = statements.filter(st => {
    if (yearFilter !== "all" && !st.tax_month?.startsWith(yearFilter)) return false;
    if (!sLower) return true;
    return (st.contractor_name || "").toLowerCase().includes(sLower)
        || (st.notes || "").toLowerCase().includes(sLower);
  });
  const totalGross = visibleStatements.reduce((s, st) => s + (st.gross_amount || 0), 0);
  const totalDeducted = visibleStatements.reduce((s, st) => s + (st.deduction_amount || 0), 0);
  const totalNet = visibleStatements.reduce((s, st) => s + (st.net_amount || 0), 0);

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
        <div style={{ fontSize: 14, fontWeight: 700 }}>CIS Monthly Statements</div>
        <button style={S.btn("primary")} onClick={() => setShowAdd(true)}>+ Add Statement</button>
      </div>
      <div style={{ fontSize: 12, color: C.muted, background: C.surfaceHigh, borderRadius: 8, padding: "10px 14px" }}>
        Log the CIS monthly statements you receive from main contractors. These show your gross pay, CIS tax deducted, and net paid — needed for your self-assessment tax return.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 10 }}>
        {[
          { l: "Total Gross", v: `${fmtCurrency(totalGross)}`, c: C.text },
          { l: "CIS Deducted", v: `${fmtCurrency(totalDeducted)}`, c: C.red },
          { l: "Net Received", v: `${fmtCurrency(totalNet)}`, c: C.green },
        ].map((st, i) => (
          <div key={i} style={S.card}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{st.l}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: st.c }}>{st.v}</div>
          </div>
        ))}
      </div>

      {statements.length > 0 && (
        <>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search contractor or note…"
            style={{ ...S.input, fontSize: 13 }}
          />
          {years.length > 1 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button onClick={() => setYearFilter("all")} style={chipStyle(yearFilter === "all")}>All years</button>
              {years.map(y => (
                <button key={y} onClick={() => setYearFilter(y)} style={chipStyle(yearFilter === y)}>{y}</button>
              ))}
            </div>
          )}
        </>
      )}

      <div style={S.card}>
        <div style={S.sectionTitle}>Statements ({visibleStatements.length})</div>
        {loading && <div style={{ fontSize: 12, color: C.muted }}>Loading...</div>}
        {!loading && statements.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 16px" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>📋</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>No CIS statements yet</div>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>When a contractor sends you a CIS statement, log it here so the deductions count toward your tax bill. Or ask Trade PA: "log a CIS statement from Bilfinger for March".</div>
          </div>
        )}
        {!loading && statements.length > 0 && visibleStatements.length === 0 && <div style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: "12px 8px" }}>{search ? `No statements match "${search}".` : `No statements in ${yearFilter}.`}</div>}
        {visibleStatements.map(s => (
          <div key={s.id} style={S.row}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.contractor_name}</div>
                {s.attachment_data && (
                  <div
                    title="CIS statement PDF attached"
                    style={{ fontSize: 10, background: C.blue + "22", color: C.blue, border: `1px solid ${C.blue}44`, borderRadius: 4, padding: "1px 5px", cursor: "pointer", flexShrink: 0 }}
                    onClick={() => {
                      // Wrap the data URI in an HTML iframe page so openHtmlPreview's
                      // PDFOverlay path can render it consistently across PWA/browser.
                      const html = `<html><body style="margin:0"><iframe src="${s.attachment_data}" width="100%" height="100%" style="border:none;position:fixed;top:0;left:0;"></iframe></body></html>`;
                      openHtmlPreview(html);
                    }}
                  >📄 View PDF</div>
                )}
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>{new Date(s.tax_month).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</div>
              {s.notes && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{s.notes}</div>}
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>£{Number(s.gross_amount).toFixed(2)} gross</div>
              <div style={{ fontSize: 11, color: C.red }}>-£{Number(s.deduction_amount).toFixed(2)} CIS</div>
              <div style={{ fontSize: 11, color: C.green }}>£{Number(s.net_amount).toFixed(2)} net</div>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }}>
          <div style={{ ...S.card, maxWidth: 460, width: "100%", marginBottom: 16, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 14, borderBottom: `1px solid ${C.border}`, marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Add CIS Statement</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <VoiceFillButton form={form} setForm={setForm} fieldDescriptions="contractor_name (main contractor company name), tax_month (month in YYYY-MM format), gross_amount (gross amount as number), deduction_amount (CIS deduction as number), notes (any reference number or notes)" />
                <button aria-label="Close" onClick={() => setShowAdd(false)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><label style={S.label}>Contractor Name</label><input style={S.input} placeholder="e.g. ABC Construction Ltd" value={form.contractor_name} onChange={e => setForm(f => ({ ...f, contractor_name: e.target.value }))} /></div>
              <div><label style={S.label}>Tax Month</label><input type="month" style={S.input} value={form.tax_month} onChange={e => setForm(f => ({ ...f, tax_month: e.target.value }))} /></div>
              <div><label style={S.label}>Gross Amount (£)</label><input type="number" step="0.01" style={S.input} placeholder="e.g. 3500.00" value={form.gross_amount} onChange={e => setForm(f => ({ ...f, gross_amount: e.target.value }))} /></div>
              <div><label style={S.label}>CIS Deduction (£)</label><input type="number" step="0.01" style={S.input} placeholder="e.g. 700.00" value={form.deduction_amount} onChange={e => setForm(f => ({ ...f, deduction_amount: e.target.value }))} /></div>
              {form.gross_amount && form.deduction_amount && (
                <div style={{ background: C.green + "18", border: `1px solid ${C.green}44`, borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
                  Net payable: <strong style={{ color: C.green }}>£{(parseFloat(form.gross_amount) - parseFloat(form.deduction_amount)).toFixed(2)}</strong>
                </div>
              )}
              <div><label style={S.label}>Notes</label><input style={S.input} placeholder="e.g. Statement ref 2024/3" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
              <button style={S.btn("primary", !form.contractor_name || !form.gross_amount || !form.deduction_amount)} disabled={!form.contractor_name || !form.gross_amount || !form.deduction_amount} onClick={saveStatement}>Save Statement →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reports Tab ─────────────────────────────────────────────────────────────
