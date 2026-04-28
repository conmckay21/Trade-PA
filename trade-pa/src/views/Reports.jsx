// ─── Reports Tab ────────────────────────────────────────────────────────
// Extracted verbatim from App.jsx during P7 sub-batch B (28 Apr 2026).
import React, { useState, useEffect } from "react";
import { C } from "../theme/colors.js";
import { S } from "../theme/styles.js";

export function ReportsTab({ invoices, jobs, materials, customers, enquiries, brand, user, setContextHint }) {
  const today = new Date();
  const fmtDate = d => d.toISOString().split("T")[0];

  // Period presets
  // UK tax year runs 6 April → 5 April. If today is on/after April 6, current
  // tax year started this April; otherwise it started last April.
  const taxYearStartYear = (today.getMonth() > 3 || (today.getMonth() === 3 && today.getDate() >= 6))
    ? today.getFullYear()
    : today.getFullYear() - 1;
  const taxYearLabel = (startYr) => `${String(startYr).slice(-2)}/${String(startYr + 1).slice(-2)}`;
  const periods = [
    { label: "This Month", from: fmtDate(new Date(today.getFullYear(), today.getMonth(), 1)), to: fmtDate(today) },
    { label: "Last Month", from: fmtDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)), to: fmtDate(new Date(today.getFullYear(), today.getMonth(), 0)) },
    { label: "This Quarter", from: fmtDate(new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1)), to: fmtDate(today) },
    { label: "Last Quarter", from: fmtDate(new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3 - 3, 1)), to: fmtDate(new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 0)) },
    { label: "Last 6 Months", from: fmtDate(new Date(today.getFullYear(), today.getMonth() - 6, 1)), to: fmtDate(today) },
    { label: "This Year", from: fmtDate(new Date(today.getFullYear(), 0, 1)), to: fmtDate(today) },
    { label: "Last Year", from: fmtDate(new Date(today.getFullYear() - 1, 0, 1)), to: fmtDate(new Date(today.getFullYear() - 1, 11, 31)) },
    { label: `Tax Year ${taxYearLabel(taxYearStartYear)}`, from: fmtDate(new Date(taxYearStartYear, 3, 6)), to: fmtDate(today) },
    { label: `Tax Year ${taxYearLabel(taxYearStartYear - 1)}`, from: fmtDate(new Date(taxYearStartYear - 1, 3, 6)), to: fmtDate(new Date(taxYearStartYear, 3, 5)) },
    { label: "Custom", from: "", to: "" },
  ];

  const [periodIdx, setPeriodIdx] = useState(0);
  const [customFrom, setCustomFrom] = useState(fmtDate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [customTo, setCustomTo] = useState(fmtDate(today));
  const [activeReport, setActiveReport] = useState("pl");

  const isCustom = periodIdx === periods.length - 1;
  const fromDate = isCustom ? customFrom : periods[periodIdx].from;
  const toDate = isCustom ? customTo : periods[periodIdx].to;

  const inRange = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d >= new Date(fromDate) && d <= new Date(toDate + "T23:59:59");
  };

  const fmt = n => `£${(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtPct = n => `${(n || 0).toFixed(1)}%`;

  // ── Data calculations ─────────────────────────────────────────────────────
  const allInvoices = (invoices || []).filter(i => !i.isQuote);
  const paidInvoices = allInvoices.filter(i => i.status === "paid" && inRange(i.paidDate || i.created_at || i.date));
  const sentInvoices = allInvoices.filter(i => inRange(i.created_at || i.date));
  const overdueInvoices = allInvoices.filter(i => i.status === "overdue");
  const outstandingInvoices = allInvoices.filter(i => ["sent", "overdue", "due"].includes(i.status));

  const totalRevenue = paidInvoices.reduce((s, i) => s + parseFloat(i.grossAmount || i.amount || 0), 0);
  const totalOutstanding = outstandingInvoices.reduce((s, i) => s + parseFloat(i.grossAmount || i.amount || 0), 0);

  const vatInvoices = paidInvoices.filter(i => i.vatEnabled && !i.vatZeroRated);
  const outputVat = vatInvoices.reduce((s, i) => {
    const gross = parseFloat(i.grossAmount || i.amount || 0);
    const rate = parseFloat(i.vatRate || 20) / 100;
    return s + gross - gross / (1 + rate);
  }, 0);

  const periodMaterials = (materials || []).filter(m => inRange(m.receiptDate || m.created_at));
  const totalMaterialCost = periodMaterials.reduce((s, m) => s + parseFloat(m.unitPrice || 0) * parseFloat(m.qty || 1), 0);
  const inputVat = periodMaterials.filter(m => m.vatEnabled).reduce((s, m) => {
    const net = parseFloat(m.unitPrice || 0) * parseFloat(m.qty || 1);
    const rate = parseFloat(m.vatRate || 20) / 100;
    return s + net * rate;
  }, 0);
  const netVat = outputVat - inputVat;

  const grossProfit = totalRevenue - totalMaterialCost;
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  const periodJobs = (jobs || []).filter(j => inRange(j.dateObj || j.date));
  const completedJobs = periodJobs.filter(j => j.status === "completed");

  // CIS
  const cisInvoices = paidInvoices.filter(i => i.cisEnabled);
  const cisGross = cisInvoices.reduce((s, i) => s + parseFloat(i.grossAmount || i.amount || 0), 0);
  const cisDeductions = cisInvoices.reduce((s, i) => s + parseFloat(i.cisDeduction || 0), 0);
  const cisNet = cisGross - cisDeductions;

  // Job profitability
  const jobProfitData = (jobs || [])
    .filter(j => j.status === "completed" && inRange(j.dateObj || j.date))
    .map(j => {
      const jobInvoices = allInvoices.filter(i => i.customer?.toLowerCase() === j.customer?.toLowerCase() && i.status === "paid");
      const revenue = jobInvoices.reduce((s, i) => s + parseFloat(i.grossAmount || i.amount || 0), 0);
      const jobMaterials = (materials || []).filter(m => m.job?.toLowerCase() === j.customer?.toLowerCase() || m.job === j.title);
      const costs = jobMaterials.reduce((s, m) => s + parseFloat(m.unitPrice || 0) * parseFloat(m.qty || 1), 0);
      const profit = revenue - costs;
      return { name: j.customer || j.title || "Unknown", type: j.type || "Job", revenue, costs, profit, margin: revenue > 0 ? (profit / revenue) * 100 : 0 };
    })
    .filter(j => j.revenue > 0 || j.costs > 0)
    .sort((a, b) => b.profit - a.profit);

  // Customer activity
  const customerData = (customers || []).map(c => {
    const custInvoices = allInvoices.filter(i => i.customer?.toLowerCase() === c.name?.toLowerCase());
    const paid = custInvoices.filter(i => i.status === "paid" && inRange(i.paidDate || i.created_at));
    const outstanding = custInvoices.filter(i => ["sent", "overdue", "due"].includes(i.status));
    const totalSpend = paid.reduce((s, i) => s + parseFloat(i.grossAmount || i.amount || 0), 0);
    const lastJob = (jobs || []).filter(j => j.customer?.toLowerCase() === c.name?.toLowerCase()).sort((a, b) => new Date(b.dateObj || b.date) - new Date(a.dateObj || a.date))[0];
    return { name: c.name, totalSpend, invoiceCount: paid.length, outstanding: outstanding.reduce((s, i) => s + parseFloat(i.grossAmount || i.amount || 0), 0), lastJobDate: lastJob?.dateObj || lastJob?.date };
  }).filter(c => c.totalSpend > 0 || c.outstanding > 0).sort((a, b) => b.totalSpend - a.totalSpend);

  // Materials by supplier
  const supplierData = {};
  periodMaterials.forEach(m => {
    const s = m.supplier || "Unknown";
    if (!supplierData[s]) supplierData[s] = { name: s, total: 0, items: 0 };
    supplierData[s].total += parseFloat(m.unitPrice || 0) * parseFloat(m.qty || 1);
    supplierData[s].items++;
  });
  const supplierList = Object.values(supplierData).sort((a, b) => b.total - a.total);

  // Aged debtors
  const agedDebtors = outstandingInvoices.map(i => {
    const invoiceDate = new Date(i.created_at || i.date || Date.now());
    const daysOld = Math.floor((Date.now() - invoiceDate) / 86400000);
    return { ...i, daysOld };
  }).sort((a, b) => b.daysOld - a.daysOld);

  const reports = [
    { id: "pl", label: "P&L Summary", icon: "📊" },
    { id: "vat", label: "VAT Summary", icon: "🏦" },
    { id: "outstanding", label: "Outstanding Invoices", icon: "⏳" },
    { id: "jobprofit", label: "Job Profitability", icon: "💼" },
    { id: "customers", label: "Customer Activity", icon: "👥" },
    { id: "materials", label: "Materials Spend", icon: "🔧" },
    { id: "cis", label: "CIS Summary", icon: "🏗" },
    { id: "jobs", label: "Jobs Overview", icon: "📋" },
    { id: "quoteconv", label: "Quote Conversion", icon: "🤝" },
    { id: "enqconv", label: "Enquiry to Quote", icon: "📩" },
  ];

  // Phase 5b: context hint for the floating mic — tells the AI which report
  // the user is looking at + the period so "Hey Trade PA, how's this month looking?"
  // gets a grounded answer instead of a guess.
  useEffect(() => {
    if (!setContextHint) return;
    const rpt = reports.find(r => r.id === activeReport);
    const periodLabel = isCustom
      ? `${new Date(customFrom).toLocaleDateString("en-GB")} – ${new Date(customTo).toLocaleDateString("en-GB")}`
      : periods[periodIdx]?.label || "";
    const bits = [`Reports: ${rpt?.label || activeReport}`, periodLabel];
    if (activeReport === "pl") bits.push(`revenue ${fmt(totalRevenue)} · profit ${fmt(grossProfit)} · margin ${fmtPct(grossMargin)}`);
    if (activeReport === "vat") bits.push(`output £${outputVat.toFixed(0)} · input £${inputVat.toFixed(0)} · net £${netVat.toFixed(0)}`);
    if (activeReport === "outstanding") bits.push(`${outstandingInvoices.length} outstanding totalling ${fmt(totalOutstanding)}`);
    setContextHint(bits.join(" · "));
    return () => { if (setContextHint) setContextHint(null); };
  }, [activeReport, periodIdx, customFrom, customTo, totalRevenue, grossProfit, grossMargin, outputVat, inputVat, netVat, totalOutstanding, outstandingInvoices.length, setContextHint]);

  const StatBox = ({ label, value, sub, color }) => (
    <div style={{ background: C.surfaceHigh, borderRadius: 10, padding: "14px 16px", border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || C.text, fontFamily: "'DM Mono',monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );

  const TableRow = ({ cells, bold, highlight }) => (
    <div style={{ display: "grid", gridTemplateColumns: cells.map(() => "1fr").join(" "), gap: 8, padding: "10px 12px", borderBottom: `1px solid ${C.border}`, background: highlight ? C.amber + "0a" : "transparent" }}>
      {cells.map((cell, i) => (
        <div key={i} style={{ fontSize: 12, color: bold ? C.text : i === 0 ? C.text : C.muted, fontWeight: bold ? 700 : 400, textAlign: i > 0 ? "right" : "left", fontFamily: i > 0 ? "'DM Mono',monospace" : "inherit" }}>{cell}</div>
      ))}
    </div>
  );

  const TableHeader = ({ cells }) => (
    <div style={{ display: "grid", gridTemplateColumns: cells.map(() => "1fr").join(" "), gap: 8, padding: "8px 12px", borderBottom: `1px solid ${C.border}`, background: C.surfaceHigh }}>
      {cells.map((cell, i) => (
        <div key={i} style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", textAlign: i > 0 ? "right" : "left" }}>{cell}</div>
      ))}
    </div>
  );

  const downloadPDF = () => {
    const reportName = reports.find(r => r.id === activeReport)?.label || "Report";
    const periodLabel = isCustom
      ? `${new Date(customFrom).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} to ${new Date(customTo).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
      : periods[periodIdx].label;
    const businessName = brand?.tradingName || "Trade PA";
    const accent = brand?.accentColor || "#f59e0b";

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${reportName} — ${businessName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #111; padding: 40px; font-size: 13px; background: #fff; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid ${accent}; }
  .business { font-size: 22px; font-weight: 700; }
  .report-title { font-size: 16px; font-weight: 700; color: #333; text-align: right; }
  .report-meta { font-size: 12px; color: #888; margin-top: 4px; text-align: right; }
  .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .stat { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; }
  .stat-label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
  .stat-value { font-size: 20px; font-weight: 700; font-family: monospace; color: #111; }
  .stat-sub { font-size: 11px; color: #9ca3af; margin-top: 4px; }
  .section-title { font-size: 14px; font-weight: 700; margin: 24px 0 10px; padding-bottom: 6px; border-bottom: 1px solid #e5e7eb; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  thead tr { background: #f9fafb; }
  th { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.06em; padding: 8px 12px; text-align: left; border-bottom: 2px solid #e5e7eb; }
  th:not(:first-child) { text-align: right; }
  td { padding: 9px 12px; border-bottom: 1px solid #f3f4f6; font-size: 12px; }
  td:not(:first-child) { text-align: right; font-family: monospace; }
  tr.total td { font-weight: 700; background: #fef9f0; border-top: 2px solid ${accent}44; }
  .note { background: #fef3c7; border: 1px solid #f59e0b44; border-radius: 6px; padding: 10px 14px; font-size: 11px; color: #92400e; margin-top: 12px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<div class="header">
  <div class="business">${businessName}</div>
  <div>
    <div class="report-title">${reportName}</div>
    <div class="report-meta">${periodLabel}</div>
    <div class="report-meta">Generated ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</div>
  </div>
</div>
${generateReportHTML()}
<div class="footer">${businessName} · Generated by Trade PA · ${new Date().toLocaleDateString("en-GB")}</div>
</body>
</html>`;

    window.dispatchEvent(new CustomEvent("trade-pa-show-pdf", { detail: html }));
  };

  const generateReportHTML = () => {
    const fmtH = n => `£${(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const statBox = (label, value, sub) => `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value">${value}</div>${sub ? `<div class="stat-sub">${sub}</div>` : ""}</div>`;
    const tableRow = (cells, isTotal) => `<tr${isTotal ? ' class="total"' : ""}>${cells.map((c, i) => `<td>${c}</td>`).join("")}</tr>`;
    const tableHead = cells => `<thead><tr>${cells.map(c => `<th>${c}</th>`).join("")}</tr></thead>`;

    if (activeReport === "pl") return `
      <div class="stat-grid">
        ${statBox("Total Revenue", fmtH(totalRevenue), `${paidInvoices.length} paid invoices`)}
        ${statBox("Materials Cost", fmtH(totalMaterialCost), `${periodMaterials.length} items`)}
        ${statBox("Gross Profit", fmtH(grossProfit), `${fmtPct(grossMargin)} margin`)}
        ${statBox("Outstanding", fmtH(totalOutstanding), `${outstandingInvoices.length} invoices`)}
      </div>
      <table>
        ${tableHead(["Category", "Amount"])}
        <tbody>
          ${tableRow(["Revenue (paid invoices)", fmtH(totalRevenue)])}
          ${tableRow(["Less: Materials & Supplies", `(${fmtH(totalMaterialCost)})`])}
          ${tableRow(["Gross Profit", fmtH(grossProfit)], true)}
          ${tableRow(["Gross Margin", fmtPct(grossMargin)])}
          ${tableRow(["Outstanding (not yet paid)", fmtH(totalOutstanding)])}
        </tbody>
      </table>`;

    if (activeReport === "vat") return `
      <div class="stat-grid">
        ${statBox("Output VAT", fmtH(outputVat), "Collected from customers")}
        ${statBox("Input VAT", fmtH(inputVat), "Paid on materials")}
        ${statBox("Net VAT Due", fmtH(netVat), netVat >= 0 ? "Payable to HMRC" : "Reclaimable")}
      </div>
      <table>
        ${tableHead(["Description", "Net", "VAT"])}
        <tbody>
          ${tableRow(["Sales (Output VAT)", fmtH(totalRevenue - outputVat), fmtH(outputVat)])}
          ${tableRow(["Purchases (Input VAT)", fmtH(totalMaterialCost), `(${fmtH(inputVat)})`])}
          ${tableRow(["Net VAT payable to HMRC", "", fmtH(netVat)], true)}
        </tbody>
      </table>
      <div class="section-title">VAT Invoices</div>
      <table>
        ${tableHead(["Invoice", "Customer", "Net", "VAT", "Gross"])}
        <tbody>${vatInvoices.map(i => {
          const gross = parseFloat(i.grossAmount || i.amount || 0);
          const rate = parseFloat(i.vatRate || 20) / 100;
          const vat = gross - gross / (1 + rate);
          return tableRow([i.id, i.customer, fmtH(gross - vat), fmtH(vat), fmtH(gross)]);
        }).join("")}</tbody>
      </table>`;

    if (activeReport === "outstanding") return `
      <table>
        ${tableHead(["Invoice", "Customer", "Amount", "Days Outstanding"])}
        <tbody>${agedDebtors.map(i => tableRow([i.id, i.customer, fmtH(parseFloat(i.grossAmount || i.amount || 0)), `${i.daysOld} days`])).join("")}</tbody>
      </table>`;

    if (activeReport === "jobprofit") return `
      <table>
        ${tableHead(["Job", "Revenue", "Costs", "Profit", "Margin"])}
        <tbody>
          ${jobProfitData.map(j => tableRow([j.name, fmtH(j.revenue), fmtH(j.costs), fmtH(j.profit), fmtPct(j.margin)])).join("")}
          ${tableRow(["Total", fmtH(jobProfitData.reduce((s,j)=>s+j.revenue,0)), fmtH(jobProfitData.reduce((s,j)=>s+j.costs,0)), fmtH(jobProfitData.reduce((s,j)=>s+j.profit,0)), ""], true)}
        </tbody>
      </table>`;

    if (activeReport === "customers") return `
      <table>
        ${tableHead(["Customer", "Invoices", "Total Paid", "Outstanding", "Last Job"])}
        <tbody>${customerData.map(c => tableRow([c.name, c.invoiceCount, fmtH(c.totalSpend), c.outstanding > 0 ? fmtH(c.outstanding) : "—", c.lastJobDate ? new Date(c.lastJobDate).toLocaleDateString("en-GB") : "—"])).join("")}</tbody>
      </table>`;

    if (activeReport === "materials") return `
      <div class="section-title">By Supplier</div>
      <table>
        ${tableHead(["Supplier", "Items", "Total"])}
        <tbody>${supplierList.map(s => tableRow([s.name, s.items, fmtH(s.total)])).join("")}</tbody>
      </table>
      <div class="section-title">All Items</div>
      <table>
        ${tableHead(["Item", "Supplier", "Qty", "Unit Price", "Total"])}
        <tbody>${periodMaterials.map(m => tableRow([m.item, m.supplier || "—", m.qty, fmtH(m.unitPrice), fmtH((m.unitPrice||0)*(m.qty||1))])).join("")}</tbody>
      </table>`;

    if (activeReport === "cis") return `
      <div class="stat-grid">
        ${statBox("Gross Earnings", fmtH(cisGross), "")}
        ${statBox("CIS Deductions", fmtH(cisDeductions), "")}
        ${statBox("Net Received", fmtH(cisNet), "")}
        ${statBox("CIS Invoices", cisInvoices.length, "")}
      </div>
      <table>
        ${tableHead(["Invoice", "Contractor", "Gross", "Deduction", "Net Paid"])}
        <tbody>${cisInvoices.map(i => tableRow([i.id, i.customer, fmtH(parseFloat(i.grossAmount||i.amount||0)), fmtH(parseFloat(i.cisDeduction||0)), fmtH(parseFloat(i.cisNetPayable||0))])).join("")}</tbody>
      </table>
      <div class="note">Use these figures on your self-assessment tax return. CIS deductions can be offset against your tax bill.</div>`;

    if (activeReport === "jobs") return `
      <table>
        ${tableHead(["Job", "Customer", "Type", "Date", "Status"])}
        <tbody>${periodJobs.map(j => tableRow([j.title||j.type||"Job", j.customer, j.type||"—", j.date ? new Date(j.dateObj||j.date).toLocaleDateString("en-GB") : "TBC", j.status])).join("")}</tbody>
      </table>`;

    if (activeReport === "quoteconv") {
      const allQuotes = (invoices || []).filter(i => i.isQuote && inRange(i.created_at || i.date));
      const accepted = allQuotes.filter(q => q.status === "accepted");
      const declined = allQuotes.filter(q => q.status === "declined");
      const pending = allQuotes.filter(q => q.status !== "accepted" && q.status !== "declined");
      const rate = allQuotes.length > 0 ? ((accepted.length / allQuotes.length) * 100).toFixed(1) : "0.0";
      return `
        <div class="stat-grid">
          ${statBox("Total Quotes", allQuotes.length, fmtH(allQuotes.reduce((s,q)=>s+parseFloat(q.grossAmount||q.amount||0),0)))}
          ${statBox("Converted", accepted.length, fmtH(accepted.reduce((s,q)=>s+parseFloat(q.grossAmount||q.amount||0),0)))}
          ${statBox("Declined", declined.length, fmtH(declined.reduce((s,q)=>s+parseFloat(q.grossAmount||q.amount||0),0)))}
          ${statBox("Conversion Rate", rate + "%", `${pending.length} pending`)}
        </div>
        <table>
          ${tableHead(["Quote", "Customer", "Value", "Sent", "Outcome"])}
          <tbody>${allQuotes.sort((a,b)=>new Date(b.created_at||b.date)-new Date(a.created_at||a.date)).map(q => tableRow([q.id, q.customer, fmtH(parseFloat(q.grossAmount||q.amount||0)), q.date ? new Date(q.created_at||q.date).toLocaleDateString("en-GB") : "—", q.status==="accepted" ? "Converted" : q.status==="declined" ? "Declined" : "Pending"])).join("")}</tbody>
        </table>`;
    }

    if (activeReport === "enqconv") {
      const allEnq = (enquiries || []).filter(e => inRange(e.created_at || e.date));
      const quoted = allEnq.filter(e => ["quoted","quote_sent","won","accepted"].includes(e.status));
      const rate = allEnq.length > 0 ? ((quoted.length / allEnq.length) * 100).toFixed(1) : "0.0";
      return `
        <div class="stat-grid">
          ${statBox("Total Enquiries", allEnq.length, "")}
          ${statBox("Quoted", quoted.length, "")}
          ${statBox("Not Quoted", allEnq.length - quoted.length, "")}
          ${statBox("Quote Rate", rate + "%", "")}
        </div>
        <table>
          ${tableHead(["Name", "Source", "Date", "Status"])}
          <tbody>${allEnq.sort((a,b)=>new Date(b.created_at||b.date)-new Date(a.created_at||a.date)).map(e => tableRow([e.name||e.customer||"Unknown", e.source||"—", e.created_at ? new Date(e.created_at).toLocaleDateString("en-GB") : "—", ["quoted","quote_sent"].includes(e.status) ? "Quoted" : ["won","accepted"].includes(e.status) ? "Won" : ["lost","declined"].includes(e.status) ? "Lost" : "Pending"])).join("")}</tbody>
        </table>`;
    }

    return "";
  };

  // ── CSV export ────────────────────────────────────────────────────────────
  // Reuses the same in-memory data the screen renders, but emits CSV rows.
  // Each report has its own shape so its own builder. Common helpers escape
  // commas/quotes/newlines safely. Numbers come out unformatted so accountants
  // can sum them in Excel without stripping currency symbols.
  const downloadCSV = () => {
    const csv = generateReportCSV();
    if (!csv) return;
    const reportName = reports.find(r => r.id === activeReport)?.label || "Report";
    const periodLabel = isCustom ? `${customFrom}_to_${customTo}` : (periods[periodIdx]?.label || "").replace(/[^A-Za-z0-9]+/g, "_");
    const filename = `${reportName.replace(/[^A-Za-z0-9]+/g, "_")}_${periodLabel}.csv`;
    // BOM so Excel auto-detects UTF-8 (avoids £ rendering as Â£)
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const generateReportCSV = () => {
    // Escape any field that contains a comma, quote, or newline
    const esc = v => {
      if (v == null) return "";
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const row = cells => cells.map(esc).join(",") + "\n";
    const num = n => (parseFloat(n) || 0).toFixed(2);
    const reportName = reports.find(r => r.id === activeReport)?.label || activeReport;
    const periodLabel = isCustom ? `${customFrom} to ${customTo}` : (periods[periodIdx]?.label || "");
    const businessName = brand?.tradingName || "Trade PA";

    let csv = "";
    csv += row([businessName]);
    csv += row([reportName]);
    csv += row([`Period: ${periodLabel}`]);
    csv += row([`Generated: ${new Date().toLocaleDateString("en-GB")}`]);
    csv += "\n";

    if (activeReport === "pl") {
      csv += row(["Summary"]);
      csv += row(["Metric", "Value", "Detail"]);
      csv += row(["Total Revenue", num(totalRevenue), `${paidInvoices.length} paid invoices`]);
      csv += row(["Materials Cost", num(totalMaterialCost), `${periodMaterials.length} items`]);
      csv += row(["Gross Profit", num(grossProfit), `${grossMargin.toFixed(1)}% margin`]);
      csv += row(["Outstanding", num(totalOutstanding), `${outstandingInvoices.length} invoices`]);
      csv += "\n";
      csv += row(["Paid Invoices"]);
      csv += row(["Invoice", "Customer", "Date", "Amount"]);
      paidInvoices.forEach(i => csv += row([i.id, i.customer, i.paidDate || i.created_at || i.date, num(i.grossAmount || i.amount)]));
    } else if (activeReport === "vat") {
      csv += row(["VAT Summary"]);
      csv += row(["Description", "Net", "VAT"]);
      csv += row(["Sales (Output VAT)", num(totalRevenue - outputVat), num(outputVat)]);
      csv += row(["Purchases (Input VAT)", num(totalMaterialCost), num(inputVat)]);
      csv += row(["Net VAT payable to HMRC", "", num(netVat)]);
      csv += "\n";
      csv += row(["VAT Invoices"]);
      csv += row(["Invoice", "Customer", "Net", "VAT", "Gross", "Date"]);
      vatInvoices.forEach(i => {
        const gross = parseFloat(i.grossAmount || i.amount || 0);
        const rate = parseFloat(i.vatRate || 20) / 100;
        const vat = gross - gross / (1 + rate);
        csv += row([i.id, i.customer, num(gross - vat), num(vat), num(gross), i.paidDate || i.created_at || i.date]);
      });
    } else if (activeReport === "outstanding") {
      csv += row(["Outstanding Invoices"]);
      csv += row(["Bucket", "Invoice", "Customer", "Amount", "Days Old", "Created"]);
      [["0-30 days", 0, 30], ["31-60 days", 31, 60], ["61-90 days", 61, 90], ["90+ days", 91, 9999]].forEach(([label, min, max]) => {
        const bucket = agedDebtors.filter(i => i.daysOld >= min && i.daysOld <= max);
        bucket.forEach(i => csv += row([label, i.id, i.customer, num(i.grossAmount || i.amount), i.daysOld, i.created_at || i.date]));
      });
    } else if (activeReport === "jobprofit") {
      csv += row(["Job Profitability"]);
      csv += row(["Job", "Type", "Revenue", "Costs", "Profit", "Margin %"]);
      jobProfitData.forEach(j => csv += row([j.name, j.type, num(j.revenue), num(j.costs), num(j.profit), j.margin.toFixed(1)]));
    } else if (activeReport === "customers") {
      csv += row(["Customer Activity"]);
      csv += row(["Customer", "Total Spend", "Invoices Paid", "Outstanding", "Last Job"]);
      customerData.forEach(c => csv += row([c.name, num(c.totalSpend), c.invoiceCount, num(c.outstanding), c.lastJobDate ? new Date(c.lastJobDate).toLocaleDateString("en-GB") : ""]));
    } else if (activeReport === "materials") {
      csv += row(["Materials Spend by Supplier"]);
      csv += row(["Supplier", "Total Spend", "Items"]);
      supplierList.forEach(s => csv += row([s.name, num(s.total), s.items]));
      csv += "\n";
      csv += row(["All Material Lines"]);
      csv += row(["Item", "Supplier", "Qty", "Unit Price", "Total", "Job", "Date"]);
      periodMaterials.forEach(m => {
        const total = parseFloat(m.unitPrice || 0) * parseFloat(m.qty || 1);
        csv += row([m.item, m.supplier || "", m.qty || 1, num(m.unitPrice), num(total), m.job || "", m.receiptDate || m.created_at || ""]);
      });
    } else if (activeReport === "cis") {
      csv += row(["CIS Summary"]);
      csv += row(["Metric", "Value"]);
      csv += row(["Gross", num(cisGross)]);
      csv += row(["Deductions", num(cisDeductions)]);
      csv += row(["Net", num(cisNet)]);
      csv += "\n";
      csv += row(["CIS Invoices"]);
      csv += row(["Invoice", "Customer", "Gross", "Deduction", "Net", "Date"]);
      cisInvoices.forEach(i => {
        const gross = parseFloat(i.grossAmount || i.amount || 0);
        const ded = parseFloat(i.cisDeduction || 0);
        csv += row([i.id, i.customer, num(gross), num(ded), num(gross - ded), i.paidDate || i.created_at || i.date]);
      });
    } else if (activeReport === "jobs") {
      csv += row(["Jobs Overview"]);
      csv += row(["Total Jobs", periodJobs.length]);
      csv += row(["Completed", completedJobs.length]);
      csv += "\n";
      csv += row(["Jobs"]);
      csv += row(["Customer", "Type", "Status", "Value", "Date"]);
      periodJobs.forEach(j => csv += row([j.customer, j.type || j.title || "", j.status || "", num(j.value), j.dateObj || j.date || ""]));
    } else if (activeReport === "quoteconv") {
      csv += row(["Quote Conversion"]);
      // The screen has its own logic for these; mirror it lightly.
      const quotes = (invoices || []).filter(i => i.isQuote && inRange(i.created_at || i.date));
      const accepted = quotes.filter(q => q.status === "accepted" || q.status === "won");
      csv += row(["Total Quotes", quotes.length]);
      csv += row(["Accepted", accepted.length]);
      csv += row(["Conversion Rate %", quotes.length > 0 ? ((accepted.length / quotes.length) * 100).toFixed(1) : "0"]);
    } else if (activeReport === "enqconv") {
      csv += row(["Enquiry to Quote"]);
      const periodEnq = (enquiries || []).filter(e => inRange(e.created_at || e.date));
      csv += row(["Total Enquiries", periodEnq.length]);
    }

    return csv;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Reports</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={downloadCSV} style={{ ...S.btn("ghost"), fontSize: 12 }}>⬇ CSV</button>
          <button onClick={downloadPDF} style={{ ...S.btn("ghost"), fontSize: 12 }}>⬇ Save PDF</button>
        </div>
      </div>

      {/* Period selector */}
      <div style={{ background: C.surface, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Report Period</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: isCustom ? 12 : 0 }}>
          {periods.map((p, i) => (
            <button key={p.label} onClick={() => setPeriodIdx(i)}
              style={{ ...S.btn(periodIdx === i ? "primary" : "ghost"), fontSize: 11, padding: "5px 12px" }}>
              {p.label}
            </button>
          ))}
        </div>
        {isCustom && (
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>FROM</div>
              <input type="date" style={S.input} value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>TO</div>
              <input type="date" style={S.input} value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </div>
          </div>
        )}
        {!isCustom && (
          <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
            {new Date(fromDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} — {new Date(toDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </div>
        )}
      </div>

      {/* Report selector — grouped by category */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[
          { label: "Financial", ids: ["pl", "vat", "cis", "outstanding"] },
          { label: "Performance", ids: ["jobprofit", "quoteconv", "enqconv"] },
          { label: "Activity", ids: ["customers", "materials", "jobs"] },
        ].map(group => (
          <div key={group.label}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, fontFamily: "'DM Mono',monospace", marginBottom: 5 }}>{group.label}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {group.ids.map(id => {
                const r = reports.find(x => x.id === id);
                if (!r) return null;
                const active = activeReport === id;
                return (
                  <button key={id} onClick={() => setActiveReport(id)}
                    style={{
                      padding: "6px 12px", borderRadius: 16, fontSize: 11, fontWeight: active ? 700 : 500,
                      background: active ? C.amber : "transparent",
                      color: active ? "#000" : C.textDim,
                      border: `1px solid ${active ? C.amber : C.border}`,
                      cursor: "pointer", whiteSpace: "nowrap",
                    }}>
                    {r.icon} {r.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── P&L Summary ── */}
      {activeReport === "pl" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>📊 Profit & Loss Summary</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 10 }}>
            <StatBox label="Total Revenue" value={fmt(totalRevenue)} sub={`${paidInvoices.length} paid invoices`} color={C.green} />
            <StatBox label="Materials Cost" value={fmt(totalMaterialCost)} sub={`${periodMaterials.length} items`} color={C.red} />
            <StatBox label="Gross Profit" value={fmt(grossProfit)} sub={`${fmtPct(grossMargin)} margin`} color={grossProfit >= 0 ? C.green : C.red} />
            <StatBox label="Outstanding" value={fmt(totalOutstanding)} sub={`${outstandingInvoices.length} invoices`} color={C.amber} />
          </div>
          <div style={{ background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            <TableHeader cells={["Category", "Amount"]} />
            <TableRow cells={["Revenue (paid invoices)", fmt(totalRevenue)]} />
            <TableRow cells={["Less: Materials & Supplies", `(${fmt(totalMaterialCost)})`]} />
            <TableRow cells={["Gross Profit", fmt(grossProfit)]} bold highlight />
            <TableRow cells={["Gross Margin", fmtPct(grossMargin)]} />
            <TableRow cells={["Outstanding (not yet paid)", fmt(totalOutstanding)]} />
            <TableRow cells={["Overdue invoices", fmt(overdueInvoices.reduce((s, i) => s + parseFloat(i.grossAmount || i.amount || 0), 0))]} />
          </div>
          <div style={{ background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", fontSize: 12, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>Revenue by Month</div>
            {(() => {
              const byMonth = {};
              paidInvoices.forEach(i => {
                const d = new Date(i.paidDate || i.created_at || i.date);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                byMonth[key] = (byMonth[key] || 0) + parseFloat(i.grossAmount || i.amount || 0);
              });
              return Object.entries(byMonth).sort().map(([month, total]) => (
                <div key={month} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 12, width: 80 }}>{new Date(month + "-01").toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</div>
                  <div style={{ flex: 1, background: C.border, borderRadius: 4, height: 8, overflow: "hidden" }}>
                    <div style={{ width: `${Math.min((total / Math.max(...Object.values(byMonth))) * 100, 100)}%`, height: "100%", background: C.green, borderRadius: 4 }} />
                  </div>
                  <div style={{ fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.green, width: 80, textAlign: "right" }}>{fmt(total)}</div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* ── VAT Summary ── */}
      {activeReport === "vat" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>🏦 VAT Summary</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 10 }}>
            <StatBox label="Output VAT" value={fmt(outputVat)} sub="Collected from customers" color={C.red} />
            <StatBox label="Input VAT" value={fmt(inputVat)} sub="Paid on materials" color={C.green} />
            <StatBox label="Net VAT Due" value={fmt(netVat)} sub={netVat >= 0 ? "Payable to HMRC" : "Reclaimable"} color={netVat >= 0 ? C.red : C.green} />
          </div>
          <div style={{ background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            <TableHeader cells={["Description", "Net", "VAT"]} />
            <TableRow cells={["Sales (Output VAT)", fmt(totalRevenue - outputVat), fmt(outputVat)]} />
            <TableRow cells={["Purchases (Input VAT)", fmt(totalMaterialCost), `(${fmt(inputVat)})`]} />
            <TableRow cells={["Net VAT payable to HMRC", "", fmt(netVat)]} bold highlight />
          </div>
          <div style={{ background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", fontSize: 12, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>VAT Invoices</div>
            <TableHeader cells={["Invoice", "Customer", "Net", "VAT", "Gross"]} />
            {vatInvoices.map(i => {
              const gross = parseFloat(i.grossAmount || i.amount || 0);
              const rate = parseFloat(i.vatRate || 20) / 100;
              const vat = gross - gross / (1 + rate);
              const net = gross - vat;
              return <TableRow key={i.id} cells={[i.id, i.customer, fmt(net), fmt(vat), fmt(gross)]} />;
            })}
            {vatInvoices.length === 0 && <div style={{ padding: "16px 14px", fontSize: 12, color: C.muted, fontStyle: "italic" }}>No VAT invoices in this period</div>}
          </div>
        </div>
      )}

      {/* ── Outstanding Invoices ── */}
      {activeReport === "outstanding" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>⏳ Outstanding Invoices</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 10 }}>
            <StatBox label="Total Outstanding" value={fmt(totalOutstanding)} sub={`${outstandingInvoices.length} invoices`} color={C.amber} />
            <StatBox label="Overdue" value={fmt(overdueInvoices.reduce((s, i) => s + parseFloat(i.grossAmount || i.amount || 0), 0))} sub={`${overdueInvoices.length} overdue`} color={C.red} />
          </div>
          {[["0–30 days", 0, 30], ["31–60 days", 31, 60], ["61–90 days", 61, 90], ["90+ days", 91, 9999]].map(([label, min, max]) => {
            const bucket = agedDebtors.filter(i => i.daysOld >= min && i.daysOld <= max);
            if (bucket.length === 0) return null;
            const total = bucket.reduce((s, i) => s + parseFloat(i.grossAmount || i.amount || 0), 0);
            return (
              <div key={label} style={{ background: C.surface, borderRadius: 10, border: `1px solid ${min > 30 ? C.red + "44" : C.border}`, overflow: "hidden" }}>
                <div style={{ padding: "10px 14px", fontSize: 12, fontWeight: 700, borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between" }}>
                  <span>{label}</span><span style={{ color: min > 30 ? C.red : C.amber }}>{fmt(total)}</span>
                </div>
                <TableHeader cells={["Invoice", "Customer", "Amount", "Days"]} />
                {bucket.map(i => <TableRow key={i.id} cells={[i.id, i.customer, fmt(parseFloat(i.grossAmount || i.amount || 0)), `${i.daysOld}d`]} />)}
              </div>
            );
          })}
          {agedDebtors.length === 0 && <div style={{ fontSize: 12, color: C.green, fontStyle: "italic", textAlign: "center", padding: 20 }}>✓ No outstanding invoices — great work!</div>}
        </div>
      )}

      {/* ── Job Profitability ── */}
      {activeReport === "jobprofit" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>💼 Job Profitability</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 10 }}>
            <StatBox label="Jobs Completed" value={jobProfitData.length} />
            <StatBox label="Total Revenue" value={fmt(jobProfitData.reduce((s, j) => s + j.revenue, 0))} color={C.green} />
            <StatBox label="Total Costs" value={fmt(jobProfitData.reduce((s, j) => s + j.costs, 0))} color={C.red} />
            <StatBox label="Total Profit" value={fmt(jobProfitData.reduce((s, j) => s + j.profit, 0))} color={C.green} />
          </div>
          <div style={{ background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            <TableHeader cells={["Job", "Revenue", "Costs", "Profit", "Margin"]} />
            {jobProfitData.map((j, i) => (
              <TableRow key={i} cells={[j.name, fmt(j.revenue), fmt(j.costs), fmt(j.profit), fmtPct(j.margin)]} />
            ))}
            {jobProfitData.length === 0 && <div style={{ padding: "16px 14px", fontSize: 12, color: C.muted, fontStyle: "italic" }}>No completed jobs with invoices in this period</div>}
          </div>
        </div>
      )}

      {/* ── Customer Activity ── */}
      {activeReport === "customers" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>👥 Customer Activity</div>
          <div style={{ background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            <TableHeader cells={["Customer", "Invoices", "Paid", "Outstanding", "Last Job"]} />
            {customerData.map((c, i) => (
              <TableRow key={i} cells={[
                c.name,
                c.invoiceCount,
                fmt(c.totalSpend),
                c.outstanding > 0 ? fmt(c.outstanding) : "—",
                c.lastJobDate ? new Date(c.lastJobDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"
              ]} />
            ))}
            {customerData.length === 0 && <div style={{ padding: "16px 14px", fontSize: 12, color: C.muted, fontStyle: "italic" }}>No customer activity in this period</div>}
          </div>
        </div>
      )}

      {/* ── Materials Spend ── */}
      {activeReport === "materials" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>🔧 Materials Spend</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 10 }}>
            <StatBox label="Total Spend" value={fmt(totalMaterialCost)} sub={`${periodMaterials.length} items`} color={C.amber} />
            <StatBox label="Suppliers" value={supplierList.length} />
          </div>
          <div style={{ background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", fontSize: 12, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>By Supplier</div>
            <TableHeader cells={["Supplier", "Items", "Total"]} />
            {supplierList.map((s, i) => (
              <TableRow key={i} cells={[s.name, s.items, fmt(s.total)]} />
            ))}
            {supplierList.length === 0 && <div style={{ padding: "16px 14px", fontSize: 12, color: C.muted, fontStyle: "italic" }}>No materials in this period</div>}
          </div>
          <div style={{ background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", fontSize: 12, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>All Items</div>
            <TableHeader cells={["Item", "Supplier", "Qty", "Unit", "Total"]} />
            {periodMaterials.map((m, i) => (
              <TableRow key={i} cells={[m.item, m.supplier || "—", m.qty, fmt(m.unitPrice), fmt((m.unitPrice || 0) * (m.qty || 1))]} />
            ))}
            {periodMaterials.length === 0 && <div style={{ padding: "16px 14px", fontSize: 12, color: C.muted, fontStyle: "italic" }}>No materials in this period</div>}
          </div>
        </div>
      )}

      {/* ── CIS Summary ── */}
      {activeReport === "cis" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>🏗 CIS Summary</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 10 }}>
            <StatBox label="Gross Earnings" value={fmt(cisGross)} color={C.text} />
            <StatBox label="CIS Deductions" value={fmt(cisDeductions)} color={C.red} />
            <StatBox label="Net Received" value={fmt(cisNet)} color={C.green} />
            <StatBox label="CIS Invoices" value={cisInvoices.length} />
          </div>
          <div style={{ background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            <TableHeader cells={["Invoice", "Contractor", "Gross", "Deduction", "Net Paid"]} />
            {cisInvoices.map(i => (
              <TableRow key={i.id} cells={[
                i.id, i.customer,
                fmt(parseFloat(i.grossAmount || i.amount || 0)),
                fmt(parseFloat(i.cisDeduction || 0)),
                fmt(parseFloat(i.cisNetPayable || 0))
              ]} />
            ))}
            {cisInvoices.length === 0 && <div style={{ padding: "16px 14px", fontSize: 12, color: C.muted, fontStyle: "italic" }}>No CIS invoices in this period</div>}
          </div>
          <div style={{ background: C.amber + "11", border: `1px solid ${C.amber}44`, borderRadius: 8, padding: "10px 14px", fontSize: 11, color: C.amber }}>
            Use these figures on your self-assessment tax return. CIS deductions can be offset against your tax bill.
          </div>
        </div>
      )}

      {/* ── Jobs Overview ── */}
      {activeReport === "jobs" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>📋 Jobs Overview</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 10 }}>
            {[["Total Jobs", periodJobs.length, C.text], ["Completed", completedJobs.length, C.green], ["Pending", periodJobs.filter(j => j.status === "pending").length, C.amber], ["Confirmed", periodJobs.filter(j => j.status === "confirmed").length, C.blue]].map(([l, v, c]) => (
              <StatBox key={l} label={l} value={v} color={c} />
            ))}
          </div>
          <div style={{ background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            <TableHeader cells={["Job", "Customer", "Type", "Date", "Status"]} />
            {periodJobs.sort((a, b) => new Date(b.dateObj || b.date) - new Date(a.dateObj || a.date)).map((j, i) => {
              const sc = { completed: C.green, confirmed: C.blue, in_progress: C.blue, pending: C.text, cancelled: C.red };
              const label = (j.status || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
              return (
              <TableRow key={i} cells={[
                j.title || j.type || "Job",
                j.customer,
                j.type || "—",
                j.date ? new Date(j.dateObj || j.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "TBC",
                <span key="s" style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: sc[j.status] || C.muted, padding: "2px 8px", borderRadius: 4, display: "inline-block" }}>{label}</span>
              ]} />
              );
            })}
            {periodJobs.length === 0 && <div style={{ padding: "16px 14px", fontSize: 12, color: C.muted, fontStyle: "italic" }}>No jobs in this period</div>}
          </div>
        </div>
      )}

      {/* ── Quote Conversion ── */}
      {activeReport === "quoteconv" && (() => {
        const allQuotes = (invoices || []).filter(i => i.isQuote && inRange(i.created_at || i.date));
        const acceptedQuotes = allQuotes.filter(q => q.status === "accepted");
        const declinedQuotes = allQuotes.filter(q => q.status === "declined");
        const pendingQuotes = allQuotes.filter(q => q.status !== "accepted" && q.status !== "declined");
        const convRate = allQuotes.length > 0 ? (acceptedQuotes.length / allQuotes.length) * 100 : 0;
        const totalQuoteValue = allQuotes.reduce((s, q) => s + parseFloat(q.grossAmount || q.amount || 0), 0);
        const wonValue = acceptedQuotes.reduce((s, q) => s + parseFloat(q.grossAmount || q.amount || 0), 0);
        const lostValue = declinedQuotes.reduce((s, q) => s + parseFloat(q.grossAmount || q.amount || 0), 0);
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>🤝 Quote Conversion</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 10 }}>
              <StatBox label="Total Quotes" value={allQuotes.length} sub={fmt(totalQuoteValue)} />
              <StatBox label="Converted" value={acceptedQuotes.length} sub={fmt(wonValue)} color={C.green} />
              <StatBox label="Declined" value={declinedQuotes.length} sub={fmt(lostValue)} color={C.red} />
              <StatBox label="Conversion Rate" value={`${convRate.toFixed(1)}%`} sub={`${pendingQuotes.length} pending`} color={convRate >= 50 ? C.green : C.amber} />
            </div>
            {/* Visual bar */}
            {allQuotes.length > 0 && (
              <div style={{ background: C.surface, borderRadius: 10, padding: 16, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Quote outcomes</div>
                <div style={{ display: "flex", height: 24, borderRadius: 10, overflow: "hidden", gap: 2 }}>
                  {acceptedQuotes.length > 0 && <div style={{ flex: acceptedQuotes.length, background: C.green, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#000", fontWeight: 700 }}>{acceptedQuotes.length} Won</div>}
                  {pendingQuotes.length > 0 && <div style={{ flex: pendingQuotes.length, background: C.amber, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#000", fontWeight: 700 }}>{pendingQuotes.length} Pending</div>}
                  {declinedQuotes.length > 0 && <div style={{ flex: declinedQuotes.length, background: C.red + "88", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 700 }}>{declinedQuotes.length} Lost</div>}
                </div>
              </div>
            )}
            <div style={{ background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              <TableHeader cells={["Quote", "Customer", "Value", "Sent", "Outcome"]} />
              {allQuotes.sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date)).map((q, i) => (
                <TableRow key={i} cells={[
                  q.id,
                  q.customer,
                  fmt(parseFloat(q.grossAmount || q.amount || 0)),
                  q.date ? new Date(q.created_at || q.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—",
                  q.status === "accepted" ? "✓ Converted" : q.status === "declined" ? "✗ Declined" : "⏳ Pending"
                ]} />
              ))}
              {allQuotes.length === 0 && <div style={{ padding: "16px 14px", fontSize: 12, color: C.muted, fontStyle: "italic" }}>No quotes in this period</div>}
            </div>
            {allQuotes.length > 0 && (
              <div style={{ background: C.surface, borderRadius: 10, padding: 14, border: `1px solid ${C.border}`, fontSize: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Pipeline Summary</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, color: C.muted }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Value won</span><span style={{ color: C.green, fontFamily: "'DM Mono',monospace" }}>{fmt(wonValue)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Value pending</span><span style={{ color: C.amber, fontFamily: "'DM Mono',monospace" }}>{fmt(pendingQuotes.reduce((s, q) => s + parseFloat(q.grossAmount || q.amount || 0), 0))}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Value lost</span><span style={{ color: C.red, fontFamily: "'DM Mono',monospace" }}>{fmt(lostValue)}</span></div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Enquiry to Quote ── */}
      {activeReport === "enqconv" && (() => {
        const allEnquiries = (enquiries || []).filter(e => inRange(e.created_at || e.date));
        const quotedEnquiries = allEnquiries.filter(e => e.status === "quoted" || e.status === "quote_sent");
        const wonEnquiries = allEnquiries.filter(e => e.status === "won" || e.status === "accepted");
        const lostEnquiries = allEnquiries.filter(e => e.status === "lost" || e.status === "declined");
        const pendingEnquiries = allEnquiries.filter(e => !["quoted", "quote_sent", "won", "accepted", "lost", "declined"].includes(e.status));
        const toQuoteRate = allEnquiries.length > 0 ? ((quotedEnquiries.length + wonEnquiries.length) / allEnquiries.length) * 100 : 0;
        const bySource = {};
        allEnquiries.forEach(e => {
          const src = e.source || "Unknown";
          if (!bySource[src]) bySource[src] = { total: 0, quoted: 0 };
          bySource[src].total++;
          if (e.status === "quoted" || e.status === "quote_sent" || e.status === "won" || e.status === "accepted") bySource[src].quoted++;
        });
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>📩 Enquiry to Quote</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 10 }}>
              <StatBox label="Total Enquiries" value={allEnquiries.length} />
              <StatBox label="Quoted" value={quotedEnquiries.length + wonEnquiries.length} color={C.blue} />
              <StatBox label="Not Quoted" value={pendingEnquiries.length + lostEnquiries.length} color={C.muted} />
              <StatBox label="Quote Rate" value={`${toQuoteRate.toFixed(1)}%`} color={toQuoteRate >= 60 ? C.green : C.amber} />
            </div>
            {allEnquiries.length > 0 && (
              <div style={{ background: C.surface, borderRadius: 10, padding: 16, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Enquiry outcomes</div>
                <div style={{ display: "flex", height: 24, borderRadius: 10, overflow: "hidden", gap: 2 }}>
                  {(quotedEnquiries.length + wonEnquiries.length) > 0 && <div style={{ flex: quotedEnquiries.length + wonEnquiries.length, background: C.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 700 }}>{quotedEnquiries.length + wonEnquiries.length} Quoted</div>}
                  {pendingEnquiries.length > 0 && <div style={{ flex: pendingEnquiries.length, background: C.amber, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#000", fontWeight: 700 }}>{pendingEnquiries.length} Pending</div>}
                  {lostEnquiries.length > 0 && <div style={{ flex: lostEnquiries.length, background: "rgba(128,128,140,0.27)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: C.muted, fontWeight: 700 }}>{lostEnquiries.length} Lost</div>}
                </div>
              </div>
            )}
            {Object.keys(bySource).length > 0 && (
              <div style={{ background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                <div style={{ padding: "10px 14px", fontSize: 12, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>By Source</div>
                <TableHeader cells={["Source", "Enquiries", "Quoted", "Rate"]} />
                {Object.entries(bySource).sort((a, b) => b[1].total - a[1].total).map(([src, d], i) => (
                  <TableRow key={i} cells={[src, d.total, d.quoted, `${d.total > 0 ? ((d.quoted / d.total) * 100).toFixed(0) : 0}%`]} />
                ))}
              </div>
            )}
            <div style={{ background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              <TableHeader cells={["Name", "Source", "Date", "Status"]} />
              {allEnquiries.sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date)).map((e, i) => (
                <TableRow key={i} cells={[
                  e.name || e.customer || "Unknown",
                  e.source || "—",
                  e.created_at ? new Date(e.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—",
                  e.status === "quoted" || e.status === "quote_sent" ? "✓ Quoted" : e.status === "won" || e.status === "accepted" ? "✓ Won" : e.status === "lost" || e.status === "declined" ? "✗ Lost" : "⏳ Pending"
                ]} />
              ))}
              {allEnquiries.length === 0 && <div style={{ padding: "16px 14px", fontSize: 12, color: C.muted, fontStyle: "italic" }}>No enquiries in this period</div>}
            </div>
          </div>
        );
      })()}
    </div>
  );
}


// ─── MILEAGE TRACKING ────────────────────────────────────────────────────────
// (MileageTab moved to ./views/Mileage.jsx — P7-7A)
