// ─── Subcontractors / Workers Tab ───────────────────────────────────────
// Extracted verbatim from App.jsx during P7 sub-batch B (28 Apr 2026).
//
// Single component, rendered twice from AppInner with different `mode`
// props — once for view==='Subcontractors' (mode default 'subs') and once
// for view==='Workers' (mode='workers'). Behaviour preserved.
import React, { useState, useEffect, useRef } from "react";
import { db } from "../lib/db.js";
import { C } from "../theme/colors.js";
import { S } from "../theme/styles.js";
import { fmtCurrency, fmtAmount } from "../lib/format.js";
import { localDate } from "../lib/time.js";
import { authHeaders } from "../lib/auth.js";
import { fileToContentBlock } from "../lib/files.js";
import { SUB_INVOICE_SCAN_PROMPT } from "../lib/scan-prompts.js";
import { tmReadWorkers, tmReadSubs } from "../lib/team-members.js";
import { VoiceFillButton } from "../components/VoiceFillButton.jsx";

export function SubcontractorsTab({ user, brand, setContextHint, mode = "subs" }) {
  const [subs, setSubs] = useState([]);
  const [payments, setPayments] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [workerDocs, setWorkerDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list"); // list | add_sub | add_payment | add_worker | add_doc
  const [selected, setSelected] = useState(null);
  const [workerForm, setWorkerForm] = useState({ name: "", type: "subcontractor", role: "", email: "", phone: "", address: "", day_rate: "", hourly_rate: "", utr: "", cis_rate: 20, ni_number: "" });
  const [docForm, setDocForm] = useState({ worker_id: "", doc_type: "cscs", doc_number: "", issued_date: "", expiry_date: "", notes: "" });
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [subScanResult, setSubScanResult] = useState(null);
  const [subScanImage, setSubScanImage] = useState(null);
  const subScanFileRef = React.useRef(null);
  const subScanUploadRef = React.useRef(null);
  // Phase 3: search for workers + payments
  const [workerSearch, setWorkerSearch] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");

  const handleSubInvoiceScan = async (file) => {
    if (!file) return;
    setScanError("");
    setScanning(true);
    try {
      const { fileContent } = await fileToContentBlock(file);
      const resp = await fetch("/api/claude", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          messages: [{ role: "user", content: [fileContent, { type: "text", text: SUB_INVOICE_SCAN_PROMPT }] }],
        }),
      });
      const data = await resp.json();
      const raw = (data.content?.[0]?.text) || "";
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error("Could not read invoice — try a clearer photo");
      const parsed = JSON.parse(raw.slice(start, end + 1));
      setSubScanResult(parsed);
      setSubScanImage(dataUrl);
      // Pre-fill the payment form
      const matchingSub = subs.find(s => s.name.toLowerCase().includes((parsed.subcontractor_name || "").toLowerCase().slice(0, 6)));
      setPayForm(f => ({
        ...f,
        subcontractor_id: matchingSub?.id || f.subcontractor_id,
        date: parsed.date || f.date,
        invoice_number: parsed.invoice_number || f.invoice_number,
        payment_type: "price_work",
        labour_amount: parsed.labour_amount ? String(parsed.labour_amount) : f.labour_amount,
        material_items: parsed.material_items?.length ? parsed.material_items.map(m => ({ desc: m.desc, amount: String(m.amount) })) : [{ desc: "", amount: "" }],
        description: parsed.description || f.description,
      }));
      setView("add_payment");
    } catch (e) {
      setScanError("Could not read invoice: " + e.message);
    }
    setScanning(false);
  };
  const [subForm, setSubForm] = useState({ name: "", utr: "", cis_rate: 20, email: "", phone: "", company: "", address: "" });
  const [jobs, setJobs] = useState([]);
  useEffect(() => {
    if (user?.id) db.from("job_cards").select("id,title,type,customer,address").eq("user_id", user.id).eq("status","in_progress").order("created_at",{ascending:false}).limit(30).then(({data})=>setJobs(data||[]));
  }, [user?.id]);
  const [payForm, setPayForm] = useState({ subcontractor_id: "", job_id: "", date: new Date().toISOString().split("T")[0], payment_type: "price_work", days: "", hours: "", rate: "", gross: "", labour_amount: "", material_items: [{ desc: "", amount: "" }], job_ref: "", description: "", invoice_number: "" });
  const [filterSub, setFilterSub] = useState("all");
  const [editingPayment, setEditingPayment] = useState(null); // payment object being edited
  const [editingWorker, setEditingWorker] = useState(null);   // worker object being edited
  const [deletingPayment, setDeletingPayment] = useState(null);
  const [deletingWorker, setDeletingWorker] = useState(null);

  useEffect(() => { if (user?.id) load(); }, [user?.id]);

  const load = async () => {
    setLoading(true);
    const [{ data: s }, { data: p }, { data: w }, { data: wd }] = await Promise.all([
      tmReadSubs(db, user.id),
      db.from("subcontractor_payments").select("*").eq("user_id", user.id).order("date", { ascending: false }),
      tmReadWorkers(db, user.id, { activeOnly: true }),
      db.from("worker_documents").select("*, team_members(name)").eq("user_id", user.id).order("expiry_date", { ascending: true }),
    ]);
    // tmReadSubs/tmReadWorkers don't take an order() clause — sort client-side
    // to preserve the alphabetical-by-name behaviour the UI relied on.
    const sSorted = (s || []).slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    const wSorted = (w || []).slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    setSubs(sSorted);
    setPayments(p || []);
    setWorkers(wSorted);
    setWorkerDocs(wd || []);
    setLoading(false);
  };

  // Phase 5b: rich context hint for the floating mic
  useEffect(() => {
    if (!setContextHint) return;
    const outstanding = payments.filter(p => !p.paid).reduce((s, p) => s + parseFloat(p.net || 0), 0);
    const dueCount = payments.filter(p => !p.paid).length;
    const bits = [`Subcontractors: ${workers.length} workers · ${subs.length} subs · ${payments.length} payments`];
    if (dueCount > 0) bits.push(`${dueCount} due totalling £${outstanding.toFixed(0)}`);
    setContextHint(bits.join(" · "));
    return () => { if (setContextHint) setContextHint(null); };
  }, [workers.length, subs.length, payments, setContextHint]);

  const saveSub = async () => {
    if (!subForm.name) return;
    // Session 3: direct write to team_members. source_table='subcontractors'
    // preserved for tmReadSubs filter compatibility (Subcontractors tab shows
    // anyone added via "Add Subcontractor"). engagement is always self_employed
    // — anyone you pay via CIS counts as a self-employed sub from the
    // unification model's perspective.
    const { data, error } = await db.from("team_members").insert({
      user_id: user.id,
      name: subForm.name,
      engagement: "self_employed",
      company_name: subForm.company || null,
      utr: subForm.utr || null,
      cis_rate: parseInt(subForm.cis_rate) || 20,
      email: subForm.email || null,
      phone: subForm.phone || null,
      active: true,
      source_table: "subcontractors",
    }).select().single();
    if (!error && data) {
      // Translate to legacy subcontractors shape for in-memory state — UI code
      // (statements, payment lookups) reads `company`, not `company_name`.
      setSubs(p => [...p, {
        id: data.id, user_id: data.user_id, name: data.name,
        company: data.company_name, utr: data.utr, cis_rate: data.cis_rate,
        email: data.email, phone: data.phone, active: data.active,
        created_at: data.created_at,
      }]);
      setView("list");
      setSubForm({ name: "", utr: "", cis_rate: 20, email: "", phone: "", company: "" });
    }
  };

  const saveWorker = async () => {
    if (!workerForm.name) return;
    // Session 3: direct write to team_members. source_table='workers' for
    // Workers-tab filter. engagement maps from form's type field.
    //
    // Pre-Session-3 the saveWorker handler ALSO inserted into the legacy
    // subcontractors table when type='subcontractor' so the same human
    // appeared in both Workers and Subcontractors tabs. That created two
    // team_members rows per human via the dual-write mirror. Session 3
    // drops that auto-duplication: one human, one row, in the Workers tab
    // they were added from. Users wanting the same person in Subcontractors
    // tab add them separately (or we add a UI move-tab affordance later).
    const engagement = workerForm.type === "employed" ? "employed" : "self_employed";
    const { data, error } = await db.from("team_members").insert({
      user_id: user.id,
      name: workerForm.name,
      engagement,
      role: workerForm.role || null,
      day_rate: parseFloat(workerForm.day_rate) || null,
      hourly_rate: parseFloat(workerForm.hourly_rate) || null,
      utr: workerForm.utr || null,
      cis_rate: engagement === "self_employed" ? (parseInt(workerForm.cis_rate) || 20) : null,
      ni_number: workerForm.ni_number || null,
      email: workerForm.email || null,
      phone: workerForm.phone || null,
      active: true,
      source_table: "workers",
    }).select().single();
    if (!error && data) {
      // Translate to legacy workers shape for in-memory state.
      setWorkers(w => [...w, {
        id: data.id, user_id: data.user_id, name: data.name,
        type: data.engagement === "employed" ? "employed" : "subcontractor",
        role: data.role, email: data.email, phone: data.phone,
        day_rate: data.day_rate, hourly_rate: data.hourly_rate,
        utr: data.utr, cis_rate: data.cis_rate, ni_number: data.ni_number,
        active: data.active, address: data.address,
        start_date: data.start_date, notes: data.notes,
        created_at: data.created_at,
      }]);
      setView("list");
      setWorkerForm({ name: "", type: "subcontractor", role: "", email: "", phone: "", day_rate: "", hourly_rate: "", utr: "", cis_rate: 20, ni_number: "" });
    }
  };

  const saveWorkerDoc = async () => {
    if (!docForm.worker_id || !docForm.doc_type) return;
    const { data, error } = await db.from("worker_documents").insert({
      user_id: user.id, ...docForm, created_at: new Date().toISOString(),
    }).select("*, team_members(name)").single();
    if (!error && data) {
      setWorkerDocs(d => [...d, data]);
      setView("list");
      setDocForm({ worker_id: "", doc_type: "cscs", doc_number: "", issued_date: "", expiry_date: "", notes: "" });
    }
  };

  const savePayment = async () => {
    if (!payForm.subcontractor_id) return;
    const sub = subs.find(s => s.id === payForm.subcontractor_id);
    // Calculate gross from payment type
    let gross = parseFloat(payForm.gross) || 0;
    let labourAmount = 0, materialsAmount = 0;
    if (payForm.payment_type === "day_rate" && payForm.days && payForm.rate) {
      gross = parseFloat(payForm.days) * parseFloat(payForm.rate);
    } else if (payForm.payment_type === "hourly" && payForm.hours && payForm.rate) {
      gross = parseFloat(payForm.hours) * parseFloat(payForm.rate);
    } else if (payForm.payment_type === "price_work") {
      // Labour + materials split
      labourAmount = parseFloat(payForm.labour_amount) || 0;
      materialsAmount = (payForm.material_items || []).reduce((s, m) => s + (parseFloat(m.amount) || 0), 0);
      if (labourAmount || materialsAmount) {
        gross = labourAmount + materialsAmount;
      }
    }
    if (!gross) return;
    const cisRate = (sub?.cis_rate || 20) / 100;
    // CIS applies to labour only — not materials
    const cisBase = (payForm.payment_type === "price_work" && labourAmount > 0) ? labourAmount : gross;
    const deduction = parseFloat((cisBase * cisRate).toFixed(2));
    const net = parseFloat((gross - deduction).toFixed(2));
    const { data, error } = await db.from("subcontractor_payments").insert({
      user_id: user.id, subcontractor_id: payForm.subcontractor_id,
      job_id: payForm.job_id || null,
      date: payForm.date, gross, deduction, net,
      cis_rate: sub?.cis_rate || 20,
      payment_type: payForm.payment_type || "price_work",
      days: parseFloat(payForm.days) || null,
      hours: parseFloat(payForm.hours) || null,
      rate: parseFloat(payForm.rate) || null,
      labour_amount: labourAmount || null,
      materials_amount: materialsAmount || null,
      material_items: materialsAmount > 0 ? JSON.stringify(payForm.material_items.filter(m => m.amount)) : null,
      job_ref: payForm.job_ref, description: payForm.description,
      invoice_number: payForm.invoice_number,
      created_at: new Date().toISOString(),
    }).select().single();
    if (!error && data) { setPayments(p => [data, ...p]); setView("list"); setSubScanResult(null); setSubScanImage(null); setPayForm({ subcontractor_id: "", job_id: "", date: new Date().toISOString().split("T")[0], payment_type: "price_work", days: "", hours: "", rate: "", gross: "", labour_amount: "", material_items: [{ desc: "", amount: "" }], job_ref: "", description: "", invoice_number: "" }); }
  };

  const updatePayment = async () => {
    if (!editingPayment) return;
    const sub = subs.find(s => s.id === editingPayment.subcontractor_id);
    let gross = parseFloat(editingPayment.gross) || 0;
    let labourAmount = parseFloat(editingPayment.labour_amount) || 0;
    let materialsAmount = parseFloat(editingPayment.materials_amount) || 0;
    if (editingPayment.payment_type === "day_rate" && editingPayment.days && editingPayment.rate) {
      gross = parseFloat(editingPayment.days) * parseFloat(editingPayment.rate);
    } else if (editingPayment.payment_type === "hourly" && editingPayment.hours && editingPayment.rate) {
      gross = parseFloat(editingPayment.hours) * parseFloat(editingPayment.rate);
    } else if (editingPayment.payment_type === "price_work" && (labourAmount || materialsAmount)) {
      gross = labourAmount + materialsAmount;
    }
    if (!gross) return;
    const cisRate = (sub?.cis_rate || editingPayment.cis_rate || 20) / 100;
    const cisBase = (editingPayment.payment_type === "price_work" && labourAmount > 0) ? labourAmount : gross;
    const deduction = parseFloat((cisBase * cisRate).toFixed(2));
    const net = parseFloat((gross - deduction).toFixed(2));
    const { error } = await db.from("subcontractor_payments").update({
      date: editingPayment.date, gross, deduction, net,
      payment_type: editingPayment.payment_type,
      days: parseFloat(editingPayment.days) || null,
      hours: parseFloat(editingPayment.hours) || null,
      rate: parseFloat(editingPayment.rate) || null,
      labour_amount: labourAmount || null,
      materials_amount: materialsAmount || null,
      job_id: editingPayment.job_id || null,
      job_ref: editingPayment.job_ref || "",
      description: editingPayment.description || "",
      invoice_number: editingPayment.invoice_number || "",
    }).eq("id", editingPayment.id).eq("user_id", user.id);
    if (!error) {
      setPayments(ps => ps.map(p => p.id === editingPayment.id
        ? { ...editingPayment, gross, deduction, net } : p));
      setEditingPayment(null);
    }
  };

  const deletePayment = async (id) => {
    const { error } = await db.from("subcontractor_payments").delete().eq("id", id).eq("user_id", user.id);
    if (!error) { setPayments(ps => ps.filter(p => p.id !== id)); setDeletingPayment(null); }
  };

  const updateWorker = async () => {
    if (!editingWorker) return;
    // Session 3: update team_members directly. Mapping legacy workers shape
    // back to team_members columns. id is now tm.id (read helpers updated).
    const engagement = editingWorker.type === "employed" ? "employed" : "self_employed";
    const { error } = await db.from("team_members").update({
      name: editingWorker.name,
      engagement,
      role: editingWorker.role || null,
      email: editingWorker.email || null,
      phone: editingWorker.phone || null,
      address: editingWorker.address || null,
      day_rate: parseFloat(editingWorker.day_rate) || null,
      hourly_rate: parseFloat(editingWorker.hourly_rate) || null,
      utr: editingWorker.utr || null,
      cis_rate: engagement === "self_employed" ? (parseInt(editingWorker.cis_rate) || 20) : null,
      ni_number: editingWorker.ni_number || null,
    }).eq("id", editingWorker.id).eq("user_id", user.id);
    if (!error) {
      setWorkers(ws => ws.map(w => w.id === editingWorker.id ? { ...w, ...editingWorker } : w));
      setEditingWorker(null);
    }
  };

  const deleteWorker = async (id) => {
    // Session 3: delete from team_members directly.
    const { error } = await db.from("team_members").delete().eq("id", id).eq("user_id", user.id);
    if (!error) {
      setWorkers(ws => ws.filter(w => w.id !== id));
      setDeletingWorker(null);
    }
  };

  const generateStatement = (sub, month) => {
    const monthPayments = payments.filter(p => p.subcontractor_id === sub.id && p.date?.startsWith(month));
    const totalGross = monthPayments.reduce((s, p) => s + parseFloat(p.gross || 0), 0);
    const totalDed = monthPayments.reduce((s, p) => s + parseFloat(p.deduction || 0), 0);
    const totalNet = monthPayments.reduce((s, p) => s + parseFloat(p.net || 0), 0);
    const monthLabel = new Date(month + "-01").toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>CIS Payment Statement</title>
    <style>body{font-family:Arial,sans-serif;padding:40px;font-size:13px}h1{font-size:20px;margin-bottom:4px}.meta{color:#666;font-size:12px;margin-bottom:32px}.box{border:2px solid #111;border-radius:8px;padding:20px;margin-bottom:20px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.label{font-size:10px;text-transform:uppercase;color:#666;margin-bottom:4px}.value{font-size:15px;font-weight:700}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#f3f4f6;padding:8px;text-align:left;font-size:10px;text-transform:uppercase;border-bottom:2px solid #e5e7eb}td{padding:8px;border-bottom:1px solid #f3f4f6}.tot{font-weight:700;background:#fef9f0}.notice{background:#fef3c7;border:1px solid #f59e0b44;border-radius:6px;padding:12px;font-size:11px;color:#92400e;margin-top:16px}</style>
    </head><body>
    <h1>${brand?.tradingName || "Trade PA"}</h1>
    <div class="meta">CIS Payment & Deduction Statement · ${monthLabel}</div>
    <div class="box">
      <div class="grid">
        <div><div class="label">Contractor</div><div class="value">${brand?.tradingName || ""}</div>${brand?.utrNumber ? `<div style="font-size:11px;color:#666;margin-top:4px">UTR: ${brand.utrNumber}</div>` : ""}</div>
        <div><div class="label">Subcontractor</div><div class="value">${sub.name}</div>${sub.utr ? `<div style="font-size:11px;color:#666;margin-top:4px">UTR: ${sub.utr}</div>` : ""}${sub.company ? `<div style="font-size:11px;color:#666">${sub.company}</div>` : ""}</div>
      </div>
    </div>
    <table><thead><tr><th>Date</th><th>Description</th><th>Invoice</th><th>Gross</th><th>Deduction (${sub.cis_rate || 20}%)</th><th>Net Paid</th></tr></thead>
    <tbody>${monthPayments.map(p=>`<tr><td>${new Date(p.date).toLocaleDateString("en-GB")}</td><td>${p.description||p.job_ref||"—"}</td><td>${p.invoice_number||"—"}</td><td>${fmtCurrency(parseFloat(p.gross||0))}</td><td>${fmtCurrency(parseFloat(p.deduction||0))}</td><td>${fmtCurrency(parseFloat(p.net||0))}</td></tr>`).join("")}
    <tr class="tot"><td colspan="3">Total</td><td>${fmtCurrency(totalGross)}</td><td>${fmtCurrency(totalDed)}</td><td>${fmtCurrency(totalNet)}</td></tr>
    </tbody></table>
    <div class="notice">Under the Construction Industry Scheme, the contractor is required to deduct ${sub.cis_rate || 20}% from payments made to this subcontractor and pay this to HMRC. The subcontractor can use this statement as evidence of deductions made when completing their self-assessment tax return.</div>
    </body></html>`;
    window.dispatchEvent(new CustomEvent("trade-pa-show-pdf", { detail: html }));
  };

  const subPayments = (subId) => payments.filter(p => p.subcontractor_id === subId);
  const subTotal = (subId) => subPayments(subId).reduce((s, p) => s + parseFloat(p.gross || 0), 0);
  const subDeductions = (subId) => subPayments(subId).reduce((s, p) => s + parseFloat(p.deduction || 0), 0);

  // Get unique months for statement generation
  const getMonths = (subId) => {
    const months = [...new Set(subPayments(subId).map(p => p.date?.substring(0, 7)))].sort().reverse();
    return months;
  };

  const [filterPaid, setFilterPaid] = useState("all"); // all | due | paid
  const filteredPayments = payments.filter(p => {
    if (filterSub !== "all" && p.subcontractor_id !== filterSub) return false;
    if (filterPaid === "due" && p.paid) return false;
    if (filterPaid === "paid" && !p.paid) return false;
    return true;
  });

  const markPaymentPaid = async (pay, paidValue) => {
    const paid_on = paidValue ? localDate() : null;
    const { error } = await db
      .from("subcontractor_payments")
      .update({ paid: paidValue, paid_on })
      .eq("id", pay.id)
      .eq("user_id", user?.id);
    if (!error) {
      setPayments(prev => prev.map(p => p.id === pay.id ? { ...p, paid: paidValue, paid_on } : p));
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 80 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Row 1: title + action buttons */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{mode === "workers" ? "Workers" : "Subcontractors"}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setView("add_worker")} style={S.btn("primary")}>{mode === "workers" ? "+ Add Worker" : "+ Add Worker / Sub"}</button>
            {mode !== "workers" && <button onClick={() => setView("add_payment")} style={{ ...S.btn("ghost"), fontSize: 12 }}>+ Payment</button>}
          </div>
        </div>
        {/* Row 2: scan buttons (subs only) */}
        {mode !== "workers" && <div style={{ display: "flex", gap: 8 }}>
          <input ref={subScanFileRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleSubInvoiceScan(f); e.target.value = ""; }} />
          <input ref={subScanUploadRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleSubInvoiceScan(f); e.target.value = ""; }} />
          <button onClick={() => subScanFileRef.current?.click()} style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", fontSize: 12, color: C.amber }}>📷 Scan Invoice</button>
          <button onClick={() => subScanUploadRef.current?.click()} style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", fontSize: 12, color: C.amber }}>📎 Upload Invoice</button>
        </div>}
      </div>

      {/* Summary (subs only) */}
      {mode !== "workers" && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
        {(() => {
          const outstanding = payments.filter(p => !p.paid).reduce((s,p) => s + parseFloat(p.net||0), 0);
          const paidNet = payments.filter(p => p.paid).reduce((s,p) => s + parseFloat(p.net||0), 0);
          const outCount = payments.filter(p => !p.paid).length;
          return [
            ["Outstanding", "£" + outstanding.toFixed(2), outstanding > 0 ? C.red : C.muted, `${outCount} due`],
            ["Paid (Net)", "£" + paidNet.toFixed(2), C.green, `${payments.length - outCount} settled`],
            ["CIS Deducted", "£" + payments.reduce((s,p) => s + parseFloat(p.deduction||0), 0).toFixed(2), C.amber, "All time"],
            ["Subcontractors", subs.length, C.text, "On books"],
          ];
        })().map(([l, v, col, sub], i) => (
          <div key={i} style={{ background: C.surfaceHigh, borderRadius: 10, padding: "14px 16px", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{l}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: col, fontFamily: "'DM Mono',monospace" }}>{v}</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{sub}</div>
          </div>
        ))}
      </div>}

      {/* Scanning spinner */}
      {scanning && (
        <div style={{ background: C.amber + "18", border: `1px solid ${C.amber}44`, borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 16, height: 16, border: `2px solid ${C.amber}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <span style={{ color: C.amber, fontSize: 13 }}>Reading invoice...</span>
        </div>
      )}

      {scanError && (
        <div style={{ background: "#ef444418", border: "1px solid #ef444444", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#ef4444", display: "flex", justifyContent: "space-between" }}>
          {scanError}
          <button onClick={() => setScanError("")} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>
      )}

      {/* Scanned invoice review banner (subs only) */}
      {mode !== "workers" && subScanResult && !scanning && (
        <div style={{ background: C.green + "18", border: `1px solid ${C.green}44`, borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.green }}>✓ Invoice scanned — payment form pre-filled</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{subScanResult.subcontractor_name || "Unknown"} · {subScanResult.invoice_number || "No invoice number"} · £{(subScanResult.gross_total || 0).toFixed(2)}</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setView("add_payment")} style={{ ...S.btn("primary"), fontSize: 11 }}>Review & Save</button>
            <button onClick={() => { setSubScanResult(null); setSubScanImage(null); }} style={{ ...S.btn("ghost"), fontSize: 11 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
          </div>
        </div>
      )}

      {/* Workers Section */}
      {(mode === "workers" || workers.length > 0) && (() => {
        const wq = workerSearch.trim().toLowerCase();
        const visibleWorkers = wq ? workers.filter(w =>
          (w.name || "").toLowerCase().includes(wq)
          || (w.role || "").toLowerCase().includes(wq)
          || (w.type || "").toLowerCase().includes(wq)
          || (w.utr || "").includes(wq)
        ) : workers;
        return (
        <div style={{ ...S.card }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Workers</div>
            <button onClick={() => setView("add_worker")} style={{ ...S.btn("ghost"), fontSize: 11 }}>+ Add</button>
          </div>
          {workers.length > 3 && (
            <input
              type="text"
              value={workerSearch}
              onChange={e => setWorkerSearch(e.target.value)}
              placeholder="Search workers…"
              style={{ ...S.input, fontSize: 12, marginBottom: 10 }}
            />
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {visibleWorkers.length === 0 ? (
              <div style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: 20 }}>
                {workers.length === 0
                  ? <>No workers added yet. Tap <strong>+ Add Worker</strong> above to get started — for PAYE staff or self-employed labour on your team.</>
                  : <>No workers match "{workerSearch}".</>}
              </div>
            ) : visibleWorkers.map(w => {
              const wDocs = workerDocs.filter(d => d.worker_id === w.id);
              const today = localDate();
              const expiredDocs = wDocs.filter(d => d.expiry_date && d.expiry_date < today);
              const soonDocs = wDocs.filter(d => d.expiry_date && d.expiry_date >= today && d.expiry_date <= new Date(Date.now()+30*86400000).toISOString().slice(0,10));
              return (
                <div key={w.id} style={{ background: C.surfaceHigh, borderRadius: 8, padding: "10px 12px", border: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{w.name}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>
                        {w.role && `${w.role} · `}
                        <span style={{ color: w.type === "employed" ? C.green : C.amber }}>{w.type === "employed" ? "Employed" : "Subcontractor"}</span>
                        {w.utr && ` · UTR: ${w.utr}`}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", fontSize: 11, color: C.muted }}>
                      {w.day_rate > 0 && <div>{fmtAmount(w.day_rate)}/day</div>}
                      {w.hourly_rate > 0 && <div>{fmtAmount(w.hourly_rate)}/hr</div>}
                    </div>
                  </div>
                  {/* Cert alerts */}
                  {(expiredDocs.length > 0 || soonDocs.length > 0) && (
                    <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {expiredDocs.map(d => <span key={d.id} style={{ fontSize: 10, background: "#ef444422", color: "#ef4444", borderRadius: 4, padding: "2px 6px" }}>⚠ {d.doc_type.replace(/_/g," ").toUpperCase()} expired</span>)}
                      {soonDocs.map(d => <span key={d.id} style={{ fontSize: 10, background: C.amber+"22", color: C.amber, borderRadius: 4, padding: "2px 6px" }}>⏰ {d.doc_type.replace(/_/g," ").toUpperCase()} expiring</span>)}
                    </div>
                  )}
                  {/* Docs list */}
                  {wDocs.length > 0 && (
                    <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {wDocs.map(d => (
                        <span key={d.id} style={{ fontSize: 10, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, padding: "2px 6px", color: C.textDim }}>
                          {d.doc_type.replace(/_/g," ").toUpperCase()}{d.expiry_date ? ` · ${new Date(d.expiry_date).toLocaleDateString("en-GB")}` : ""}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <button onClick={() => { setDocForm(f => ({...f, worker_id: w.id})); setView("add_doc"); }} style={{ ...S.btn("ghost"), fontSize: 11, padding: "2px 8px" }}>+ Doc</button>
                    <button onClick={() => setEditingWorker({...w})} style={{ ...S.btn("ghost"), fontSize: 11, padding: "2px 8px" }}>✏️ Edit</button>
                    <button onClick={() => setDeletingWorker(w)} style={{ ...S.btn("ghost"), fontSize: 11, padding: "2px 8px", color: "#ef4444", borderColor: "#ef444433" }}>🗑️ Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        );
      })()}

      {workers.length === 0 && !loading && (
        <div onClick={() => setView("add_worker")} style={{ background: C.surfaceHigh, border: `2px dashed ${C.border}`, borderRadius: 10, padding: 20, textAlign: "center", cursor: "pointer" }}>
          <div style={{ fontSize: 13, color: C.muted }}>No workers yet</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Tap to add a worker or subcontractor</div>
        </div>
      )}

      {/* Subcontractor cards (subs only) */}
      {mode !== "workers" && subs.length > 0 && (
        <div style={{ ...S.card }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Your Subcontractors</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {subs.map(sub => (
              <div key={sub.id} style={{ background: C.surfaceHigh, borderRadius: 10, padding: "12px 14px", border: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{sub.name}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      {sub.utr && `UTR: ${sub.utr} · `}CIS Rate: {sub.cis_rate || 20}%{sub.company && ` · ${sub.company}`}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: C.muted }}>Gross paid: <span style={{ color: C.text, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>£{subTotal(sub.id).toFixed(2)}</span></div>
                    <div style={{ fontSize: 12, color: C.muted }}>CIS deducted: <span style={{ color: C.amber, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>£{subDeductions(sub.id).toFixed(2)}</span></div>
                  </div>
                </div>
                {/* Statement buttons by month */}
                {getMonths(sub.id).length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Generate Statement</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {getMonths(sub.id).map(month => (
                        <button key={month} onClick={() => generateStatement(sub, month)}
                          style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px" }}>
                          {new Date(month + "-01").toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment history (subs only) */}
      {mode !== "workers" && payments.length > 0 && (
        <div style={{ ...S.card }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Payment History</div>
            <select style={{ ...S.input, width: "auto", fontSize: 11 }} value={filterSub} onChange={e => setFilterSub(e.target.value)}>
              <option value="all">All</option>
              {subs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <button onClick={() => setFilterPaid("all")} style={S.pill(C.amber, filterPaid === "all")}>All</button>
            <button onClick={() => setFilterPaid("due")} style={S.pill(C.red, filterPaid === "due")}>Due</button>
            <button onClick={() => setFilterPaid("paid")} style={S.pill(C.green, filterPaid === "paid")}>Paid</button>
          </div>
          {payments.length > 5 && (
            <input
              type="text"
              value={paymentSearch}
              onChange={e => setPaymentSearch(e.target.value)}
              placeholder="Search payments…"
              style={{ ...S.input, fontSize: 12, marginBottom: 10 }}
            />
          )}
          {(() => {
            const pq = paymentSearch.trim().toLowerCase();
            const visible = pq ? filteredPayments.filter(p => {
              const sub = subs.find(s => s.id === p.subcontractor_id);
              return (sub?.name || "").toLowerCase().includes(pq)
                || (p.description || "").toLowerCase().includes(pq)
                || (p.invoice_number || "").toLowerCase().includes(pq)
                || (p.job_ref || "").toLowerCase().includes(pq);
            }) : filteredPayments;
            return visible.length === 0
              ? <div style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: 12 }}>{pq ? `No payments match "${paymentSearch}".` : "No payments match this filter."}</div>
              : visible.map(p => {
            const sub = subs.find(s => s.id === p.subcontractor_id);
            return (
              <div key={p.id} style={{ padding: "10px 0", borderBottom: `1px solid ${C.border}`, borderLeft: p.paid ? `3px solid ${C.green}` : `3px solid ${C.red}`, paddingLeft: 10, marginLeft: -10 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                      {sub?.name || "Unknown"}
                      <span style={S.badge(p.paid ? C.green : C.red)}>{p.paid ? "PAID" : "DUE"}</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>{new Date(p.date).toLocaleDateString("en-GB")}{p.invoice_number ? ` · ${p.invoice_number}` : ""}{p.description ? ` · ${p.description}` : ""}{p.job_ref ? ` · ${p.job_ref}` : ""}</div>
                    {p.payment_type === "price_work" && (p.labour_amount > 0 || p.materials_amount > 0) && (
                      <div style={{ fontSize: 11, color: C.muted }}>
                        {p.labour_amount > 0 && `Labour ${fmtCurrency(parseFloat(p.labour_amount))}`}
                        {p.labour_amount > 0 && p.materials_amount > 0 && " · "}
                        {p.materials_amount > 0 && `Materials ${fmtCurrency(parseFloat(p.materials_amount))}`}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 12, color: C.muted }}>Gross: <span style={{ color: C.text, fontFamily: "'DM Mono',monospace" }}>£{parseFloat(p.gross||0).toFixed(2)}</span></div>
                    <div style={{ fontSize: 12, color: C.muted }}>CIS: <span style={{ color: C.amber, fontFamily: "'DM Mono',monospace" }}>-£{parseFloat(p.deduction||0).toFixed(2)}</span></div>
                    <div style={{ fontSize: 12, color: C.muted }}>Net: <span style={{ color: C.green, fontFamily: "'DM Mono',monospace" }}>£{parseFloat(p.net||0).toFixed(2)}</span></div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                  <button
                    onClick={() => markPaymentPaid(p, !p.paid)}
                    style={{ ...S.btn(p.paid ? "ghost" : "green"), fontSize: 11, padding: "2px 10px" }}
                  >
                    {p.paid ? `↺ Unmark (paid ${p.paid_on ? new Date(p.paid_on).toLocaleDateString("en-GB") : ""})` : "✓ Mark Paid"}
                  </button>
                  <button onClick={() => setEditingPayment({...p})} style={{ ...S.btn("ghost"), fontSize: 11, padding: "2px 10px" }}>✏️ Edit</button>
                  <button onClick={() => setDeletingPayment(p)} style={{ ...S.btn("ghost"), fontSize: 11, padding: "2px 10px", color: "#ef4444", borderColor: "#ef444433" }}>🗑️ Delete</button>
                </div>
              </div>
            );
          }); })()}
        </div>
      )}

      {subs.length === 0 && !loading && (
        <div style={{ textAlign: "center", padding: "32px 16px" }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>👷</div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>No subcontractors yet</div>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>Tap <strong style={{ color: C.amber }}>+ Add Worker / Sub</strong> above to add a subbie with their UTR + CIS rate. Then scan their invoices and log payments — Trade PA handles the CIS deductions.</div>
        </div>
      )}

      {/* Add Subcontractor Modal */}
      {view === "add_sub" && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px,env(safe-area-inset-top,52px))", overflowY: "auto" }} onClick={() => setView("list")}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.card, maxWidth: 480, width: "100%", marginBottom: 16, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 14, borderBottom: `1px solid ${C.border}`, marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Add Subcontractor</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <VoiceFillButton form={subForm} setForm={setSubForm} fieldDescriptions="name (full name), company (company name), utr (10-digit UTR number), cis_rate (20 for registered, 30 for unregistered, 0 for gross), email, phone, address (business or home address)" />
                <button aria-label="Close" onClick={() => setView("list")} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><label style={S.label}>Name</label><input style={S.input} value={subForm.name} onChange={e => setSubForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" /></div>
              <div><label style={S.label}>Company (optional)</label><input style={S.input} value={subForm.company} onChange={e => setSubForm(f => ({ ...f, company: e.target.value }))} placeholder="Company name" /></div>
              <div style={S.grid2}>
                <div><label style={S.label}>UTR Number</label><input style={S.input} value={subForm.utr} onChange={e => setSubForm(f => ({ ...f, utr: e.target.value }))} placeholder="10-digit UTR" /></div>
                <div>
                  <label style={S.label}>CIS Rate</label>
                  <select style={S.input} value={subForm.cis_rate} onChange={e => setSubForm(f => ({ ...f, cis_rate: parseInt(e.target.value) }))}>
                    <option value={20}>20% — Registered</option>
                    <option value={30}>30% — Unregistered</option>
                    <option value={0}>0% — Gross payment</option>
                  </select>
                </div>
              </div>
              <div style={S.grid2}>
                <div><label style={S.label}>Email</label><input style={S.input} type="email" value={subForm.email} onChange={e => setSubForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" /></div>
                <div><label style={S.label}>Phone</label><input style={S.input} value={subForm.phone} onChange={e => setSubForm(f => ({ ...f, phone: e.target.value }))} placeholder="07xxx xxxxxx" /></div>
              </div>
              <div><label style={S.label}>Address</label><input style={S.input} value={subForm.address} onChange={e => setSubForm(f => ({ ...f, address: e.target.value }))} placeholder="Business or home address" /></div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button style={{ ...S.btn("primary"), flex: 1, justifyContent: "center" }} onClick={saveSub} disabled={!subForm.name}>Save</button>
              <button style={S.btn("ghost")} onClick={() => setView("list")}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Payment Modal */}
      {view === "add_payment" && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px,env(safe-area-inset-top,52px))", overflowY: "auto" }} onClick={() => setView("list")}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.card, maxWidth: 480, width: "100%", marginBottom: 16, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 14, borderBottom: `1px solid ${C.border}`, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Log Payment{subScanResult ? " — Invoice Scanned ✓" : ""}</div>
                {subScanResult && <div style={{ fontSize: 11, color: C.green, marginTop: 2 }}>Data pre-filled from invoice scan — review and confirm</div>}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <VoiceFillButton form={payForm} setForm={setPayForm} fieldDescriptions="date (YYYY-MM-DD), gross (gross amount in pounds), invoice_number (their invoice ref), job_ref (job reference), description (work description)" />
                <button aria-label="Close" onClick={() => setView("list")} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Scanned invoice thumbnail */}
              {subScanImage && (
                <div style={{ marginBottom: 4 }}>
                  <img src={subScanImage} alt="Scanned invoice" style={{ width: "100%", maxHeight: 120, objectFit: "contain", borderRadius: 10, border: `1px solid ${C.border}` }} />
                </div>
              )}
              <div>
                <label style={S.label}>Subcontractor</label>
                <select style={S.input} value={payForm.subcontractor_id} onChange={e => setPayForm(f => ({ ...f, subcontractor_id: e.target.value }))}>
                  <option value="">Select subcontractor...</option>
                  {subs.map(s => <option key={s.id} value={s.id}>{s.name} ({s.cis_rate || 20}%)</option>)}
                </select>
              </div>
              <div style={S.grid2}>
                <div><label style={S.label}>Date</label><input style={S.input} type="date" value={payForm.date} onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))} /></div>
                <div><label style={S.label}>Invoice Number</label><input style={S.input} value={payForm.invoice_number} onChange={e => setPayForm(f => ({ ...f, invoice_number: e.target.value }))} placeholder="Their invoice ref" /></div>
              </div>
              {/* Payment Type Selector */}
              <div>
                <label style={S.label}>Payment Type</label>
                <select style={S.input} value={payForm.payment_type} onChange={e => setPayForm(f => ({ ...f, payment_type: e.target.value, days: "", hours: "", rate: "", gross: "" }))}>
                  <option value="price_work">Price Work (fixed amount)</option>
                  <option value="day_rate">Day Rate</option>
                  <option value="hourly">Hourly</option>
                </select>
              </div>
              {payForm.payment_type === "day_rate" && (
                <div style={S.grid2}>
                  <div><label style={S.label}>Number of Days</label><input style={S.input} type="number" step="0.5" value={payForm.days} onChange={e => setPayForm(f => ({ ...f, days: e.target.value }))} placeholder="e.g. 5" /></div>
                  <div><label style={S.label}>Day Rate (£)</label><input style={S.input} type="number" step="0.01" value={payForm.rate} onChange={e => setPayForm(f => ({ ...f, rate: e.target.value }))} placeholder="e.g. 200" /></div>
                </div>
              )}
              {payForm.payment_type === "hourly" && (
                <div style={S.grid2}>
                  <div><label style={S.label}>Hours</label><input style={S.input} type="number" step="0.5" value={payForm.hours} onChange={e => setPayForm(f => ({ ...f, hours: e.target.value }))} placeholder="e.g. 40" /></div>
                  <div><label style={S.label}>Hourly Rate (£)</label><input style={S.input} type="number" step="0.01" value={payForm.rate} onChange={e => setPayForm(f => ({ ...f, rate: e.target.value }))} placeholder="e.g. 25" /></div>
                </div>
              )}
              {payForm.payment_type === "price_work" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {/* Labour */}
                  <div><label style={S.label}>Labour (£)</label><input style={S.input} type="number" step="0.01" value={payForm.labour_amount} onChange={e => setPayForm(f => ({ ...f, labour_amount: e.target.value }))} placeholder="e.g. 1500.00" /></div>
                  {/* Materials */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <label style={S.label}>Materials <span style={{ color: C.muted, fontWeight: 400 }}>(optional)</span></label>
                      <button onClick={() => setPayForm(f => ({ ...f, material_items: [...(f.material_items || []), { desc: "", amount: "" }] }))} style={{ ...S.btn("ghost"), fontSize: 11, padding: "2px 8px" }}>+ Add</button>
                    </div>
                    {(payForm.material_items || []).map((item, idx) => (
                      <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
                        <input style={{ ...S.input, flex: 1 }} placeholder="e.g. Boiler unit" value={item.desc} onChange={e => setPayForm(f => ({ ...f, material_items: f.material_items.map((m,i) => i===idx ? {...m, desc: e.target.value} : m) }))} />
                        <input style={{ ...S.input, width: 90, flexShrink: 0 }} type="number" placeholder="£" value={item.amount} onChange={e => setPayForm(f => ({ ...f, material_items: f.material_items.map((m,i) => i===idx ? {...m, amount: e.target.value} : m) }))} />
                        {(payForm.material_items || []).length > 1 && <button onClick={() => setPayForm(f => ({ ...f, material_items: f.material_items.filter((_,i) => i!==idx) }))} style={{ color: C.muted, background: "none", border: "none", cursor: "pointer" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* CIS breakdown - live calculation */}
              {(() => {
                const sub = subs.find(s => s.id === payForm.subcontractor_id);
                if (!sub) return null;
                let calcLabour = 0, calcMats = 0, calcGross = 0;
                if (payForm.payment_type === "day_rate" && payForm.days && payForm.rate) {
                  calcGross = parseFloat(payForm.days) * parseFloat(payForm.rate);
                  calcLabour = calcGross;
                } else if (payForm.payment_type === "hourly" && payForm.hours && payForm.rate) {
                  calcGross = parseFloat(payForm.hours) * parseFloat(payForm.rate);
                  calcLabour = calcGross;
                } else if (payForm.payment_type === "price_work") {
                  calcLabour = parseFloat(payForm.labour_amount) || 0;
                  calcMats = (payForm.material_items || []).reduce((s, m) => s + (parseFloat(m.amount) || 0), 0);
                  calcGross = calcLabour + calcMats;
                }
                if (!calcGross) return null;
                const cisRate = (sub.cis_rate || 20) / 100;
                const cisBase = calcLabour > 0 ? calcLabour : calcGross;
                const ded = parseFloat((cisBase * cisRate).toFixed(2));
                const net = calcGross - ded;
                return (
                  <div style={{ background: C.amber + "11", border: `1px solid ${C.amber}33`, borderRadius: 8, padding: "10px 12px" }}>
                    {calcMats > 0 && (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                          <span style={{ color: C.muted }}>Labour (CIS applies)</span>
                          <span style={{ fontFamily: "'DM Mono',monospace" }}>£{calcLabour.toFixed(2)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6, paddingBottom: 6, borderBottom: `1px solid ${C.amber}22` }}>
                          <span style={{ color: C.muted }}>Materials (no CIS)</span>
                          <span style={{ fontFamily: "'DM Mono',monospace" }}>£{calcMats.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ color: C.muted }}>Gross total</span>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>£{calcGross.toFixed(2)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4 }}>
                      <span style={{ color: C.muted }}>CIS {sub.cis_rate || 20}%{calcMats > 0 ? " (on labour only)" : ""}</span>
                      <span style={{ color: C.amber, fontFamily: "'DM Mono',monospace" }}>-£{ded.toFixed(2)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${C.amber}33` }}>
                      <span>Net to pay</span>
                      <span style={{ color: C.green, fontFamily: "'DM Mono',monospace" }}>£{net.toFixed(2)}</span>
                    </div>
                    {payForm.payment_type === "day_rate" && payForm.days && <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{payForm.days} days × £{payForm.rate}/day</div>}
                    {payForm.payment_type === "hourly" && payForm.hours && <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{payForm.hours} hrs × £{payForm.rate}/hr</div>}
                  </div>
                );
              })()}
              <div>
                <label style={S.label}>Link to Job Card</label>
                <select style={S.input} value={payForm.job_id} onChange={e => setPayForm(f => ({ ...f, job_id: e.target.value }))}>
                  <option value="">No job linked</option>
                  {jobs.map(j => <option key={j.id} value={j.id}>{j.customer} — {j.title || j.type}{j.address ? ` · ${j.address.split(",")[0]}` : ""}</option>)}
                </select>
              </div>
              <div><label style={S.label}>Invoice Reference</label><input style={S.input} value={payForm.job_ref} onChange={e => setPayForm(f => ({ ...f, job_ref: e.target.value }))} placeholder="e.g. Kitchen extension" /></div>
              <div><label style={S.label}>Description</label><input style={S.input} value={payForm.description} onChange={e => setPayForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. First fix electrical" /></div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button style={{ ...S.btn("primary"), flex: 1, justifyContent: "center" }} onClick={savePayment} disabled={!payForm.subcontractor_id || !payForm.gross}>Save Payment</button>
              <button style={S.btn("ghost")} onClick={() => setView("list")}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {/* Add Worker Modal */}
      {view === "add_worker" && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 60, zIndex: 1000 }} onClick={() => setView("list")}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.card, maxWidth: 480, width: "100%", marginBottom: 20, borderRadius: 14, overflow: "hidden", maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Add Worker / Subcontractor</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Subcontractors also appear in the CIS payment section</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <VoiceFillButton form={workerForm} setForm={setWorkerForm} fieldDescriptions="name (full name), type (subcontractor or employed), role (trade or job title), day_rate (daily rate in pounds), hourly_rate (hourly rate), utr (UTR number), email, phone" />
                <button aria-label="Close" onClick={() => setView("list")} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><label style={S.label}>Name</label><input style={S.input} value={workerForm.name} onChange={e => setWorkerForm(f => ({...f, name: e.target.value}))} placeholder="Full name" /></div>
              <div style={S.grid2}>
                <div>
                  <label style={S.label}>Type</label>
                  <select style={S.input} value={workerForm.type} onChange={e => setWorkerForm(f => ({...f, type: e.target.value}))}>
                    <option value="subcontractor">Subcontractor (CIS)</option>
                    <option value="employed">Employed (PAYE)</option>
                  </select>
                </div>
                <div><label style={S.label}>Role / Trade</label><input style={S.input} value={workerForm.role} onChange={e => setWorkerForm(f => ({...f, role: e.target.value}))} placeholder="e.g. Electrician" /></div>
              </div>
              <div style={S.grid2}>
                <div><label style={S.label}>Day Rate (£)</label><input style={S.input} type="number" value={workerForm.day_rate} onChange={e => setWorkerForm(f => ({...f, day_rate: e.target.value}))} placeholder="0.00" /></div>
                <div><label style={S.label}>Hourly Rate (£)</label><input style={S.input} type="number" value={workerForm.hourly_rate} onChange={e => setWorkerForm(f => ({...f, hourly_rate: e.target.value}))} placeholder="0.00" /></div>
              </div>
              <div style={S.grid2}>
                <div><label style={S.label}>Email</label><input style={S.input} type="email" value={workerForm.email} onChange={e => setWorkerForm(f => ({...f, email: e.target.value}))} /></div>
                <div><label style={S.label}>Phone</label><input style={S.input} value={workerForm.phone} onChange={e => setWorkerForm(f => ({...f, phone: e.target.value}))} /></div>
              </div>
              <div><label style={S.label}>Address</label><input style={S.input} value={workerForm.address || ""} onChange={e => setWorkerForm(f => ({...f, address: e.target.value}))} placeholder="Business or home address" /></div>
              {workerForm.type === "subcontractor" && (
                <div style={S.grid2}>
                  <div><label style={S.label}>UTR Number</label><input style={S.input} value={workerForm.utr} onChange={e => setWorkerForm(f => ({...f, utr: e.target.value}))} /></div>
                  <div>
                    <label style={S.label}>CIS Rate</label>
                    <select style={S.input} value={workerForm.cis_rate} onChange={e => setWorkerForm(f => ({...f, cis_rate: e.target.value}))}>
                      <option value={20}>20% — Registered</option>
                      <option value={30}>30% — Unregistered</option>
                      <option value={0}>0% — Gross</option>
                    </select>
                  </div>
                </div>
              )}
              {workerForm.type === "employed" && (
                <div><label style={S.label}>NI Number</label><input style={S.input} value={workerForm.ni_number} onChange={e => setWorkerForm(f => ({...f, ni_number: e.target.value}))} placeholder="e.g. AB123456C" /></div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button style={{ ...S.btn("primary"), flex: 1, justifyContent: "center" }} onClick={saveWorker} disabled={!workerForm.name}>Save Worker</button>
              <button style={S.btn("ghost")} onClick={() => setView("list")}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Document Modal */}
      {view === "add_doc" && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 60, zIndex: 1000 }} onClick={() => setView("list")}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.card, maxWidth: 480, width: "100%", marginBottom: 20, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Add Certificate / Document</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <VoiceFillButton form={docForm} setForm={setDocForm} fieldDescriptions="doc_type (cscs, gas_safe, public_liability, employers_liability, driving_licence, right_to_work, other), doc_number, issued_date (YYYY-MM-DD), expiry_date (YYYY-MM-DD), notes" />
                <button aria-label="Close" onClick={() => setView("list")} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={S.label}>Worker</label>
                <select style={S.input} value={docForm.worker_id} onChange={e => setDocForm(f => ({...f, worker_id: e.target.value}))}>
                  <option value="">Select worker...</option>
                  {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div style={S.grid2}>
                <div>
                  <label style={S.label}>Document Type</label>
                  <select style={S.input} value={docForm.doc_type} onChange={e => setDocForm(f => ({...f, doc_type: e.target.value}))}>
                    <option value="cscs">CSCS Card</option>
                    <option value="gas_safe">Gas Safe</option>
                    <option value="public_liability">Public Liability Insurance</option>
                    <option value="employers_liability">Employers Liability Insurance</option>
                    <option value="driving_licence">Driving Licence</option>
                    <option value="right_to_work">Right to Work</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div><label style={S.label}>Reference / Number</label><input style={S.input} value={docForm.doc_number} onChange={e => setDocForm(f => ({...f, doc_number: e.target.value}))} placeholder="Card or cert number" /></div>
              </div>
              <div style={S.grid2}>
                <div><label style={S.label}>Issue Date</label><input style={S.input} type="date" value={docForm.issued_date} onChange={e => setDocForm(f => ({...f, issued_date: e.target.value}))} /></div>
                <div><label style={S.label}>Expiry Date</label><input style={S.input} type="date" value={docForm.expiry_date} onChange={e => setDocForm(f => ({...f, expiry_date: e.target.value}))} /></div>
              </div>
              <div><label style={S.label}>Notes</label><input style={S.input} value={docForm.notes} onChange={e => setDocForm(f => ({...f, notes: e.target.value}))} placeholder="Optional" /></div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button style={{ ...S.btn("primary"), flex: 1, justifyContent: "center" }} onClick={saveWorkerDoc} disabled={!docForm.worker_id || !docForm.doc_type}>Save Document</button>
              <button style={S.btn("ghost")} onClick={() => setView("list")}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Payment Modal ───────────────────────────────────────── */}
      {editingPayment && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, overflowY: "auto", padding: "max(60px, env(safe-area-inset-top, 60px)) 16px 20px" }}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.card, maxWidth: 480, width: "100%", marginBottom: 16, maxHeight: "85vh", overflowY: "auto", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Edit Payment</div>
              <button aria-label="Close" onClick={() => setEditingPayment(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={S.label}>Subcontractor</label>
                <select style={S.input} value={editingPayment.subcontractor_id} onChange={e => setEditingPayment(p => ({...p, subcontractor_id: e.target.value}))}>
                  {subs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div style={S.grid2}>
                <div><label style={S.label}>Date</label><input style={S.input} type="date" value={editingPayment.date||""} onChange={e => setEditingPayment(p => ({...p, date: e.target.value}))}/></div>
                <div>
                  <label style={S.label}>Payment Type</label>
                  <select style={S.input} value={editingPayment.payment_type||"price_work"} onChange={e => setEditingPayment(p => ({...p, payment_type: e.target.value}))}>
                    <option value="price_work">Price Work</option>
                    <option value="day_rate">Day Rate</option>
                    <option value="hourly">Hourly</option>
                  </select>
                </div>
              </div>
              {(editingPayment.payment_type === "price_work") && (
                <div style={S.grid2}>
                  <div><label style={S.label}>Labour (£)</label><input style={S.input} type="number" value={editingPayment.labour_amount||""} onChange={e => setEditingPayment(p => ({...p, labour_amount: e.target.value}))}/></div>
                  <div><label style={S.label}>Materials (£)</label><input style={S.input} type="number" value={editingPayment.materials_amount||""} onChange={e => setEditingPayment(p => ({...p, materials_amount: e.target.value}))}/></div>
                </div>
              )}
              {(editingPayment.payment_type === "day_rate") && (
                <div style={S.grid2}>
                  <div><label style={S.label}>Days</label><input style={S.input} type="number" value={editingPayment.days||""} onChange={e => setEditingPayment(p => ({...p, days: e.target.value}))}/></div>
                  <div><label style={S.label}>Rate (£/day)</label><input style={S.input} type="number" value={editingPayment.rate||""} onChange={e => setEditingPayment(p => ({...p, rate: e.target.value}))}/></div>
                </div>
              )}
              {(editingPayment.payment_type === "hourly") && (
                <div style={S.grid2}>
                  <div><label style={S.label}>Hours</label><input style={S.input} type="number" value={editingPayment.hours||""} onChange={e => setEditingPayment(p => ({...p, hours: e.target.value}))}/></div>
                  <div><label style={S.label}>Rate (£/hr)</label><input style={S.input} type="number" value={editingPayment.rate||""} onChange={e => setEditingPayment(p => ({...p, rate: e.target.value}))}/></div>
                </div>
              )}
              {(editingPayment.payment_type !== "price_work") && (
                <div><label style={S.label}>Gross Override (£) — leave blank to calculate</label><input style={S.input} type="number" value={editingPayment.gross||""} onChange={e => setEditingPayment(p => ({...p, gross: e.target.value}))}/></div>
              )}
              <div style={S.grid2}>
                <div><label style={S.label}>Invoice No.</label><input style={S.input} value={editingPayment.invoice_number||""} onChange={e => setEditingPayment(p => ({...p, invoice_number: e.target.value}))}/></div>
                <div><label style={S.label}>Job Ref</label><input style={S.input} value={editingPayment.job_ref||""} onChange={e => setEditingPayment(p => ({...p, job_ref: e.target.value}))}/></div>
              </div>
              <div><label style={S.label}>Description</label><input style={S.input} value={editingPayment.description||""} onChange={e => setEditingPayment(p => ({...p, description: e.target.value}))}/></div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button style={{ ...S.btn("primary"), flex: 1, justifyContent: "center" }} onClick={updatePayment}>Save Changes</button>
              <button style={S.btn("ghost")} onClick={() => setEditingPayment(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Worker Modal ────────────────────────────────────────── */}
      {editingWorker && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, overflowY: "auto", padding: "max(60px, env(safe-area-inset-top, 60px)) 16px 20px" }}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.card, maxWidth: 480, width: "100%", marginBottom: 16, maxHeight: "85vh", overflowY: "auto", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Edit Worker</div>
              <button aria-label="Close" onClick={() => setEditingWorker(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><label style={S.label}>Name</label><input style={S.input} value={editingWorker.name||""} onChange={e => setEditingWorker(w => ({...w, name: e.target.value}))}/></div>
              <div style={S.grid2}>
                <div>
                  <label style={S.label}>Type</label>
                  <select style={S.input} value={editingWorker.type||"subcontractor"} onChange={e => setEditingWorker(w => ({...w, type: e.target.value}))}>
                    <option value="subcontractor">Subcontractor (CIS)</option>
                    <option value="employed">Employed (PAYE)</option>
                  </select>
                </div>
                <div><label style={S.label}>Role / Trade</label><input style={S.input} value={editingWorker.role||""} onChange={e => setEditingWorker(w => ({...w, role: e.target.value}))}/></div>
              </div>
              <div style={S.grid2}>
                <div><label style={S.label}>Day Rate (£)</label><input style={S.input} type="number" value={editingWorker.day_rate||""} onChange={e => setEditingWorker(w => ({...w, day_rate: e.target.value}))}/></div>
                <div><label style={S.label}>Hourly Rate (£)</label><input style={S.input} type="number" value={editingWorker.hourly_rate||""} onChange={e => setEditingWorker(w => ({...w, hourly_rate: e.target.value}))}/></div>
              </div>
              <div style={S.grid2}>
                <div><label style={S.label}>Email</label><input style={S.input} type="email" value={editingWorker.email||""} onChange={e => setEditingWorker(w => ({...w, email: e.target.value}))}/></div>
                <div><label style={S.label}>Phone</label><input style={S.input} value={editingWorker.phone||""} onChange={e => setEditingWorker(w => ({...w, phone: e.target.value}))}/></div>
              </div>
              {editingWorker.type === "subcontractor" && (
                <div style={S.grid2}>
                  <div><label style={S.label}>UTR Number</label><input style={S.input} value={editingWorker.utr||""} onChange={e => setEditingWorker(w => ({...w, utr: e.target.value}))}/></div>
                  <div>
                    <label style={S.label}>CIS Rate</label>
                    <select style={S.input} value={editingWorker.cis_rate||20} onChange={e => setEditingWorker(w => ({...w, cis_rate: parseInt(e.target.value)}))}>
                      <option value={20}>20% — Registered</option>
                      <option value={30}>30% — Unregistered</option>
                      <option value={0}>0% — Gross</option>
                    </select>
                  </div>
                </div>
              )}
              {editingWorker.type === "employed" && (
                <div><label style={S.label}>NI Number</label><input style={S.input} value={editingWorker.ni_number||""} onChange={e => setEditingWorker(w => ({...w, ni_number: e.target.value}))}/></div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button style={{ ...S.btn("primary"), flex: 1, justifyContent: "center" }} onClick={updateWorker}>Save Changes</button>
              <button style={S.btn("ghost")} onClick={() => setEditingWorker(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmations ─────────────────────────────────────── */}
      {deletingPayment && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001, padding: 16 }}>
          <div style={{ ...S.card, maxWidth: 360, width: "100%", textAlign: "center", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Delete Payment?</div>
            <div style={{ fontSize: 13, color: C.textDim, marginBottom: 20 }}>
              {subs.find(s => s.id === deletingPayment.subcontractor_id)?.name} · £{parseFloat(deletingPayment.gross||0).toFixed(2)} · {new Date(deletingPayment.date).toLocaleDateString("en-GB")}
              <br/>This cannot be undone.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", color: "#ef4444", borderColor: "#ef444455" }} onClick={() => deletePayment(deletingPayment.id)}>Yes, delete</button>
              <button style={{ ...S.btn("primary"), flex: 1, justifyContent: "center" }} onClick={() => setDeletingPayment(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {deletingWorker && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001, padding: 16 }}>
          <div style={{ ...S.card, maxWidth: 360, width: "100%", textAlign: "center", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Delete Worker?</div>
            <div style={{ fontSize: 13, color: C.textDim, marginBottom: 20 }}>
              {deletingWorker.name} · {deletingWorker.role || deletingWorker.type}
              <br/>This will also remove their documents. Cannot be undone.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", color: "#ef4444", borderColor: "#ef444455" }} onClick={() => deleteWorker(deletingWorker.id)}>Yes, delete</button>
              <button style={{ ...S.btn("primary"), flex: 1, justifyContent: "center" }} onClick={() => setDeletingWorker(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// ─── DOCUMENT STORAGE ────────────────────────────────────────────────────────
// (DocumentsTab moved to ./views/Documents.jsx — P7-7A)
// (ReviewsTab moved to ./views/Reviews.jsx — P7-7A)
// (StockTab moved to ./views/Stock.jsx — P7-7A)
// (PurchaseOrdersTab moved to ./views/PurchaseOrders.jsx — P7-7A)
