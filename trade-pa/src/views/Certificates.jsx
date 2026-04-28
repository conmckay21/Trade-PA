// ─── Trade Certificates & Compliance Documents ──────────────────────────
// Extracted verbatim from App.jsx during P7 sub-batch C (28 Apr 2026).
//
// Split out from the Jobs cluster (per Phase 7 audit recommendation) to keep
// views/Jobs.jsx under the 2k-line goal. CertificatesTab is rendered from
// inside JobsTab; SignaturePad, printComplianceDoc, and emailComplianceDoc
// are also called from JobsTab — all four are exported. The remaining
// helpers (buildCertHTML, buildComplianceDocHTML, CERT_CATEGORIES,
// TRADE_CERT_LIST) are private to this file.
import React, { useState, useEffect, useRef } from "react";
import { db } from "../lib/db.js";
import { C } from "../theme/colors.js";
import { S } from "../theme/styles.js";
import { openHtmlPreview } from "../lib/files.js";
import { buildEmailHTML } from "../lib/invoice-html.js";
import { VoiceFillButton } from "../components/VoiceFillButton.jsx";

function buildComplianceDocHTML(doc, job, brand) {
  const issued = doc.issued_date ? new Date(doc.issued_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
  const expiry = doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:'Helvetica Neue',Arial,sans-serif;background:#fff;color:#1a1a1a;margin:0;padding:40px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:24px;border-bottom:3px solid #f59e0b}
    .brand-name{font-size:22px;font-weight:700;margin-bottom:4px}
    .brand-detail{font-size:12px;color:#666;line-height:1.6}
    .doc-title{font-size:28px;font-weight:700;color:#f59e0b;text-align:right}
    .doc-type{font-size:13px;color:#666;text-align:right;margin-top:4px}
    .section{margin-bottom:24px;padding:20px;background:#f9f9f9;border-radius:8px}
    .section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:12px}
    .row{display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px}
    .label{color:#666}
    .value{font-weight:600}
    .footer{margin-top:40px;padding-top:20px;border-top:1px solid #eee;font-size:11px;color:#999;text-align:center}
    .cert-number{font-size:32px;font-weight:700;text-align:center;color:#1a1a1a;margin:24px 0;letter-spacing:0.1em}
  </style></head><body>
    <div class="header">
      <div>
        <div class="brand-name">${brand.tradingName || ""}</div>
        <div class="brand-detail">${brand.address || ""}${brand.phone ? `<br>${brand.phone}` : ""}${brand.email ? `<br>${brand.email}` : ""}${brand.gasSafeNumber ? `<br>Gas Safe: ${brand.gasSafeNumber}` : ""}${(brand.vatNumber && (brand._exemptBypass || brand.registrationVerifications?.vatNumber?.verified)) ? `<br>VAT: ${brand.vatNumber}` : ""}</div>
      </div>
      <div>
        <div class="doc-title">CERTIFICATE</div>
        <div class="doc-type">${doc.doc_type}</div>
      </div>
    </div>

    ${doc.doc_number ? `<div class="cert-number">${doc.doc_number}</div>` : ""}

    <div class="section">
      <div class="section-title">Certificate Details</div>
      <div class="row"><span class="label">Document Type</span><span class="value">${doc.doc_type}</span></div>
      ${doc.doc_number ? `<div class="row"><span class="label">Certificate Number</span><span class="value">${doc.doc_number}</span></div>` : ""}
      ${issued ? `<div class="row"><span class="label">Date Issued</span><span class="value">${issued}</span></div>` : ""}
      ${expiry ? `<div class="row"><span class="label">Valid Until / Expiry</span><span class="value" style="color:${new Date(doc.expiry_date) < new Date() ? "#ef4444" : "#10b981"}">${expiry}</span></div>` : ""}
      ${doc.notes ? `<div class="row"><span class="label">Notes</span><span class="value">${doc.notes}</span></div>` : ""}
    </div>

    <div class="section">
      <div class="section-title">Property / Job Details</div>
      <div class="row"><span class="label">Customer</span><span class="value">${job?.customer || ""}</span></div>
      ${job?.address ? `<div class="row"><span class="label">Address</span><span class="value">${job.address}</span></div>` : ""}
      <div class="row"><span class="label">Job</span><span class="value">${job?.title || job?.type || ""}</span></div>
    </div>

    <div class="section">
      <div class="section-title">Issued By</div>
      <div class="row"><span class="label">Company</span><span class="value">${brand.tradingName || ""}</span></div>
      ${brand.gasSafeNumber ? `<div class="row"><span class="label">Gas Safe Reg.</span><span class="value">${brand.gasSafeNumber}</span></div>` : ""}
      ${brand.utrNumber ? `<div class="row"><span class="label">UTR</span><span class="value">${brand.utrNumber}</span></div>` : ""}
    </div>

    <div class="footer">${brand.tradingName} · ${brand.phone || ""} · ${brand.email || ""}<br>This certificate was issued on ${issued || "—"}</div>
  </body></html>`;
}

export function printComplianceDoc(doc, job, brand) {
  const html = buildComplianceDocHTML(doc, job, brand);
  openHtmlPreview(html);
}

export async function emailComplianceDoc(doc, job, customers, user, connection, brand) {
  if (!connection) { alert("No email account connected. Go to the Inbox tab to connect Gmail or Outlook."); return; }
  const customer = (customers || []).find(c => c.name?.toLowerCase() === job?.customer?.toLowerCase());
  let toEmail = customer?.email || "";
  if (!toEmail) {
    toEmail = prompt(`Enter email address for ${job?.customer}:`);
    if (!toEmail) return;
  }

  const issued = doc.issued_date ? new Date(doc.issued_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
  const html = buildComplianceDocHTML(doc, job, brand);

  const body = buildEmailHTML(brand, {
    heading: doc.doc_type.toUpperCase(),
    body: `<p style="font-size:15px;">Dear ${job?.customer || "Customer"},</p>
      <p style="color:#555;">Please find your ${doc.doc_type}${doc.doc_number ? ` (Certificate No: ${doc.doc_number})` : ""}${issued ? `, issued ${issued}` : ""} below.</p>
      <p style="color:#555;font-size:13px;">If you have any questions regarding this certificate, please don't hesitate to get in touch.</p>
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee">
      ${html.replace(/<!DOCTYPE.*?<body>/s, "").replace(/<\/body>.*$/s, "")}`,
  });

  const endpoint = connection.provider === "outlook" ? "/api/outlook/send" : "/api/gmail/send";
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, to: toEmail, subject: `${doc.doc_type}${doc.doc_number ? ` — ${doc.doc_number}` : ""} — ${brand.tradingName}`, body }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    alert(`✓ Certificate sent to ${toEmail}`);
  } catch (err) {
    alert(`Failed to send: ${err.message}`);
  }
}

// ─── Signature Pad ────────────────────────────────────────────────────────────
export function SignaturePad({ onSave, onCancel, title = "Customer Signature" }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSig, setHasSig] = useState(false);
  const lastPos = useRef(null);

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function startDraw(e) {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    lastPos.current = pos;
    setIsDrawing(true);
    setHasSig(true);
  }

  function draw(e) {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  }

  function endDraw(e) { e.preventDefault(); setIsDrawing(false); }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSig(false);
  }

  function save() {
    const canvas = canvasRef.current;
    const data = canvas.toDataURL("image/png");
    onSave(data);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000d", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: 16, fontFamily: "'DM Mono',monospace" }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 20, maxWidth: 380, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>{title}</div>
          <button aria-label="Close" onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", color: "#999" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>
        <div style={{ fontSize: 11, color: "#999", marginBottom: 8 }}>Sign in the box below</div>
        <div style={{ border: "2px solid #e5e5e5", borderRadius: 8, overflow: "hidden", touchAction: "none", background: "#fafafa" }}>
          <canvas
            ref={canvasRef}
            width={560} height={200}
            style={{ width: "100%", height: 120, display: "block", cursor: "crosshair" }}
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
          />
        </div>
        <div style={{ borderTop: "1px dashed #ccc", marginTop: 0, marginBottom: 12, marginLeft: 16, marginRight: 16 }} />
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={clear} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid #e5e5e5", background: "#fff", color: "#666", cursor: "pointer", fontSize: 11, fontFamily: "'DM Mono',monospace" }}>Clear</button>
          <button onClick={save} disabled={!hasSig} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: hasSig ? "#10b981" : "#e5e5e5", color: hasSig ? "#fff" : "#999", cursor: hasSig ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 12, fontFamily: "'DM Mono',monospace" }}>
            ✓ Confirm Signature
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Trade Certificates ───────────────────────────────────────────────────────
const CERT_CATEGORIES = [
  {
    category: "Gas",
    icon: "🔥",
    certs: [
      { id: "cp12", label: "CP12 — Landlord Gas Safety Record", short: "CP12" },
      { id: "smr", label: "Service & Maintenance Record", short: "SMR" },
      { id: "pad17", label: "Commissioning Record (Pad 17)", short: "Pad 17" },
      { id: "gas_warning", label: "Gas Warning/Advice Notice", short: "Warning" },
    ],
  },
  {
    category: "Electrical",
    icon: "⚡",
    certs: [
      { id: "eicr", label: "EICR — Electrical Installation Condition Report", short: "EICR" },
      { id: "eic", label: "EIC — Electrical Installation Certificate", short: "EIC" },
      { id: "meic", label: "MEIC — Minor Electrical Works Certificate", short: "MEIC" },
      { id: "pat", label: "PAT Testing Record", short: "PAT" },
      { id: "fire_alarm_design", label: "Fire Alarm — Design, Installation & Commissioning", short: "FA Install" },
      { id: "fire_alarm_periodic", label: "Fire Alarm — Periodic Inspection Certificate", short: "FA Periodic" },
      { id: "em_lighting_install", label: "Emergency Lighting — Installation Certificate", short: "EL Install" },
      { id: "em_lighting_periodic", label: "Emergency Lighting — Periodic Inspection", short: "EL Periodic" },
    ],
  },
  {
    category: "Plumbing & Heating",
    icon: "🔧",
    certs: [
      { id: "pressure_test", label: "Pressure Test Certificate", short: "Pressure" },
      { id: "unvented_hw", label: "Unvented Hot Water Commissioning", short: "UHW" },
    ],
  },
  {
    category: "Oil",
    icon: "🛢",
    certs: [
      { id: "cd11", label: "CD/11 — Oil Installation Commissioning", short: "CD/11" },
      { id: "cd12", label: "CD/12 — Oil Safety Certificate", short: "CD/12" },
    ],
  },
  {
    category: "General",
    icon: "📋",
    certs: [
      { id: "part_p", label: "Part P Building Regulations Certificate", short: "Part P" },
      { id: "custom", label: "Custom Certificate", short: "Custom" },
    ],
  },
];

// Flatten for easy lookup
const TRADE_CERT_LIST = CERT_CATEGORIES.flatMap(cat => cat.certs);

function buildCertHTML(cert, brand, job, sig) {
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const accentColor = {
    cp12: "#f59e0b", smr: "#f59e0b", pad17: "#f59e0b", gas_warning: "#ef4444",
    eicr: "#3b82f6", eic: "#3b82f6", meic: "#3b82f6", pat: "#3b82f6",
    pressure_test: "#10b981", unvented_hw: "#10b981",
    cd11: "#8b5cf6", cd12: "#8b5cf6",
    part_p: "#6b7280", custom: "#6b7280",
  }[cert.id] || "#f59e0b";

  const regLine = cert.id.startsWith("cp12") || cert.id === "smr" || cert.id === "pad17" || cert.id === "gas_warning"
    ? (brand.gasSafeNumber ? `Gas Safe Reg: <strong>${brand.gasSafeNumber}</strong>` : "<span style=\"color:#c0392b\">⚠ Gas Safe number not set — add in Settings</span>")
    : cert.id === "eicr" || cert.id === "eic" || cert.id === "meic" || cert.id === "pat"
    ? (brand.niceicNumber ? `NICEIC No: <strong>${brand.niceicNumber}</strong>`
       : brand.napitNumber ? `NAPIT No: <strong>${brand.napitNumber}</strong>`
       : brand.elecsaNumber ? `ELECSA No: <strong>${brand.elecsaNumber}</strong>`
       : "<span style=\"color:#c0392b\">⚠ Electrical scheme number not set — add in Settings</span>")
    : cert.id === "oil_service" || cert.id === "oil_warning"
    ? (brand.oftecNumber ? `OFTEC No: <strong>${brand.oftecNumber}</strong>` : "<span style=\"color:#c0392b\">⚠ OFTEC number not set — add in Settings</span>")
    : cert.id === "cd11" || cert.id === "cd12"
    ? (brand.hetasNumber ? `HETAS No: <strong>${brand.hetasNumber}</strong>` : "<span style=\"color:#c0392b\">⚠ HETAS number not set — add in Settings</span>")
    : cert.id === "unvented_hw" || cert.id === "pressure_test"
    ? (brand.aphcNumber ? `APHC/WaterSafe No: <strong>${brand.aphcNumber}</strong>` : "")
    : cert.id === "fgas"
    ? (brand.fgasNumber ? `F-Gas Cert No: <strong>${brand.fgasNumber}</strong>` : "<span style=\"color:#c0392b\">⚠ F-Gas number not set — add in Settings</span>")
    : cert.id === "mcs"
    ? (brand.mcsNumber ? `MCS No: <strong>${brand.mcsNumber}</strong>` : "<span style=\"color:#c0392b\">⚠ MCS number not set — add in Settings</span>")
    : "";

  // Use sequential cert number from brand settings, or fall back to manually entered certNumber
  const isGasCert = cert.id.startsWith("cp12") || cert.id === "smr" || cert.id === "pad17" || cert.id === "gas_warning";
  const certRef = cert.certNumber || (brand.certPrefix && brand.certNextNumber
    ? `${brand.certPrefix}-${String(brand.certNextNumber).padStart(3, "0")}`
    : "");

  const header = `<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:24px;color:#1a1a1a;font-size:13px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${accentColor};padding-bottom:16px;margin-bottom:20px">
      <div style="display:flex;align-items:flex-start;gap:14px">
        ${brand.logo ? `<img src="${brand.logo}" style="width:52px;height:52px;object-fit:contain;border-radius:8px;flex-shrink:0">` : ""}
        <div>
          <div style="font-size:22px;font-weight:700">${brand.tradingName || ""}</div>
          <div style="color:#666;font-size:12px;margin-top:4px">${brand.address || ""}${brand.phone ? ` · ${brand.phone}` : ""}${brand.email ? ` · ${brand.email}` : ""}</div>
          ${regLine ? `<div style="font-size:12px;color:#666;margin-top:2px">${regLine}</div>` : ""}
          ${brand.utrNumber ? `<div style="font-size:12px;color:#666">UTR: ${brand.utrNumber}</div>` : ""}
        </div>
      </div>
      <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        ${isGasCert && brand.gasSafeLogo ? `<img src="${brand.gasSafeLogo}" style="height:36px;object-fit:contain;margin-bottom:4px">` : ""}
        <div style="font-size:18px;font-weight:700;color:${accentColor}">${cert.short}</div>
        <div style="font-size:11px;color:#666">${cert.label}</div>
        <div style="font-size:11px;color:#666">Date: ${today}</div>
        ${certRef ? `<div style="font-size:12px;font-weight:700;color:#1a1a1a;background:#f5f5f5;padding:4px 8px;border-radius:4px;font-family:monospace">Cert No: ${certRef}</div>` : ""}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <div style="background:#f9f9f9;padding:14px;border-radius:8px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px">Property / Client</div>
        <div style="font-weight:600">${cert.customer || job?.customer || ""}</div>
        <div style="color:#666;margin-top:4px">${cert.address || job?.address || ""}</div>
        ${cert.landlord ? `<div style="color:#666;margin-top:4px;font-size:12px">Landlord: ${cert.landlord}</div>` : ""}
      </div>
      <div style="background:#f9f9f9;padding:14px;border-radius:8px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px">Engineer / Contractor</div>
        <div style="font-weight:600">${cert.engineer || brand.tradingName || ""}</div>
        ${regLine ? `<div style="color:#666;margin-top:4px;font-size:12px">${regLine}</div>` : ""}
      </div>
    </div>`;

  // Certificate-specific body
  let body = "";

  // GAS
  if (cert.id === "cp12") {
    body = `<div style="margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:10px">Appliance Inspection</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#f5f5f5">${["Location","Appliance","Make/Model","Flue Type","Safe to Use"].map(h=>`<th style="padding:8px;text-align:left;border:1px solid #e5e5e5">${h}</th>`).join("")}</tr></thead>
        <tbody><tr>${[cert.applianceLocation||"",cert.applianceType||"",cert.makeModel||"",cert.flueType||"Open flued",cert.safeToUse!==false?"Yes ✓":"No ✗"].map(v=>`<td style="padding:8px;border:1px solid #e5e5e5">${v}</td>`).join("")}</tr></tbody>
      </table>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;margin-bottom:16px">
      ${["Gas tightness","Flue flow test","Burner pressure","Safety devices","CO detector","Adequate ventilation"].map(c=>`<div style="background:#f9f9f9;padding:8px 12px;border-radius:4px;display:flex;justify-content:space-between"><span>${c}</span><span style="color:#10b981;font-weight:700">✓</span></div>`).join("")}
    </div>
    ${cert.defects?`<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:12px;margin-bottom:16px"><strong>⚠ Defects/Action Required:</strong> ${cert.defects}</div>`:""}`;
  }

  if (cert.id === "smr") {
    body = `<div style="background:#f9f9f9;padding:14px;border-radius:8px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px">Service Record</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
        ${[["Appliance",cert.applianceType||""],["Make/Model",cert.makeModel||""],["Serial No.",cert.serialNo||""],["Next Service",cert.nextServiceDate||""]].map(([l,v])=>`<div><span style="color:#666">${l}:</span> <strong>${v}</strong></div>`).join("")}
      </div>
      ${cert.serviceNotes?`<div style="margin-top:10px;font-size:12px;color:#444">${cert.serviceNotes}</div>`:""}
    </div>`;
  }

  if (cert.id === "pad17") {
    body = `<div style="background:#f9f9f9;padding:14px;border-radius:8px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px">Commissioning Details</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
        ${[["Appliance",cert.applianceType||""],["Make/Model",cert.makeModel||""],["Serial No.",cert.serialNo||""],["Gas Type","Natural Gas"],["Inlet Pressure",cert.inletPressure||""],["Heat Input",cert.heatInput||""]].map(([l,v])=>`<div><span style="color:#666">${l}:</span> <strong>${v}</strong></div>`).join("")}
      </div>
    </div>`;
  }

  if (cert.id === "gas_warning") {
    body = `<div style="background:#fff3cd;border:2px solid #f59e0b;border-radius:8px;padding:16px;margin-bottom:16px">
      <div style="font-size:13px;font-weight:700;margin-bottom:8px">⚠ Gas Warning/Advice Notice</div>
      <div style="font-size:12px"><strong>Condition Found:</strong> ${cert.warningCondition||""}</div>
      ${cert.warningAction?`<div style="font-size:12px;margin-top:6px"><strong>Action Taken:</strong> ${cert.warningAction}</div>`:""}
      ${cert.warningAdvice?`<div style="font-size:12px;margin-top:6px"><strong>Advice:</strong> ${cert.warningAdvice}</div>`:""}
    </div>`;
  }

  // ELECTRICAL
  if (cert.id === "eicr") {
    body = `<div style="background:#f9f9f9;padding:14px;border-radius:8px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px">EICR Details</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
        ${[["Overall Result",cert.eicrResult||"Satisfactory"],["Number of Circuits",cert.numCircuits||""],["Earthing Arrangement",cert.earthing||"TN-C-S (PME)"],["Next Inspection Due",cert.nextInspection||""],["Max Demand",cert.maxDemand||""],["Supply Voltage",cert.supplyVoltage||"230V"]].map(([l,v])=>`<div><span style="color:#666">${l}:</span> <strong style="color:${l==="Overall Result"?(v==="Satisfactory"?"#10b981":"#ef4444"):"inherit"}">${v}</strong></div>`).join("")}
      </div>
      ${cert.observations?`<div style="margin-top:12px"><strong style="font-size:12px">Observations / Codes:</strong><div style="font-size:12px;color:#444;margin-top:4px">${cert.observations}</div></div>`:""}
    </div>`;
  }

  if (cert.id === "eic") {
    body = `<div style="background:#f9f9f9;padding:14px;border-radius:8px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px">Installation Details</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
        ${[["Description of Work",cert.workDescription||""],["Number of Circuits",cert.numCircuits||""],["Earthing",cert.earthing||"TN-C-S (PME)"],["Supply Voltage","230V"],["Test Method",cert.testMethod||""],["Overall Result","Satisfactory ✓"]].map(([l,v])=>`<div><span style="color:#666">${l}:</span> <strong>${v}</strong></div>`).join("")}
      </div>
    </div>`;
  }

  if (cert.id === "meic") {
    body = `<div style="background:#f9f9f9;padding:14px;border-radius:8px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px">Minor Works Details</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
        ${[["Description",cert.workDescription||""],["Location",cert.workLocation||""],["Circuit Details",cert.circuitDetails||""],["Test Results","Satisfactory ✓"]].map(([l,v])=>`<div><span style="color:#666">${l}:</span> <strong>${v}</strong></div>`).join("")}
      </div>
    </div>`;
  }

  if (cert.id === "pat") {
    body = `<div style="background:#f9f9f9;padding:14px;border-radius:8px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px">PAT Testing Summary</div>
      <div style="font-size:12px"><strong>Total Items Tested:</strong> ${cert.totalItems||""}</div>
      <div style="font-size:12px;margin-top:4px"><strong>Pass:</strong> ${cert.itemsPass||""} &nbsp; <strong>Fail:</strong> ${cert.itemsFail||"0"}</div>
      ${cert.patNotes?`<div style="margin-top:8px;font-size:12px;color:#444">${cert.patNotes}</div>`:""}
    </div>`;
  }

  // PLUMBING
  if (cert.id === "pressure_test") {
    body = `<div style="background:#f9f9f9;padding:14px;border-radius:8px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px">Pressure Test Results</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
        ${[["System",cert.systemType||""],["Test Pressure",cert.testPressure||""],["Duration",cert.testDuration||""],["Final Reading",cert.finalReading||""],["Pass/Fail",cert.pressureResult||"Pass ✓"]].map(([l,v])=>`<div><span style="color:#666">${l}:</span> <strong>${v}</strong></div>`).join("")}
      </div>
    </div>`;
  }

  if (cert.id === "unvented_hw") {
    body = `<div style="background:#f9f9f9;padding:14px;border-radius:8px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px">Unvented Hot Water System</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
        ${[["Cylinder Make/Model",cert.makeModel||""],["Serial No.",cert.serialNo||""],["Capacity",cert.capacity||""],["Max Working Pressure",cert.maxPressure||""],["Temperature Setting",cert.tempSetting||"60°C"],["Commissioned By",brand.tradingName||""]].map(([l,v])=>`<div><span style="color:#666">${l}:</span> <strong>${v}</strong></div>`).join("")}
      </div>
    </div>`;
  }

  // OIL
  if (cert.id === "cd11" || cert.id === "cd12") {
    body = `<div style="background:#f9f9f9;padding:14px;border-radius:8px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px">${cert.id === "cd11" ? "Oil Installation Commissioning" : "Oil Safety Assessment"}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
        ${[["Appliance",cert.applianceType||""],["Make/Model",cert.makeModel||""],["Serial No.",cert.serialNo||""],["Oil Type",cert.oilType||"Kerosene 28s"],["Result",cert.oilResult||"Satisfactory ✓"]].map(([l,v])=>`<div><span style="color:#666">${l}:</span> <strong>${v}</strong></div>`).join("")}
      </div>
    </div>`;
  }

  // GENERAL
  if (cert.id === "part_p") {
    body = `<div style="background:#f9f9f9;padding:14px;border-radius:8px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px">Part P Notification</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
        ${[["Work Description",cert.workDescription||""],["Location",cert.workLocation||""],["Notification No.",cert.notificationNo||""],["Building Control",cert.buildingControl||""]].map(([l,v])=>`<div><span style="color:#666">${l}:</span> <strong>${v}</strong></div>`).join("")}
      </div>
    </div>`;
  }

  if (cert.id === "fire_alarm_design" || cert.id === "fire_alarm_periodic") {
    const isPeriodic = cert.id === "fire_alarm_periodic";
    body = `<div style="background:#f9f9f9;padding:14px;border-radius:8px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px">${isPeriodic ? "Periodic Inspection Details" : "Installation Details"}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
        ${[["System Grade",cert.systemGrade||""],["Category",cert.category||""],["Number of Detectors",cert.numDetectors||""],["Number of Sounders",cert.numSounders||""],["Panel Make/Model",cert.makeModel||""],["Overall Result",cert.eicrResult||"Satisfactory ✓"]].map(([l,v])=>`<div><span style="color:#666">${l}:</span> <strong style="color:${l==="Overall Result"&&v.includes("Unsat")?"#ef4444":"inherit"}">${v}</strong></div>`).join("")}
      </div>
      ${cert.serviceNotes?`<div style="margin-top:10px;font-size:12px;color:#444">${cert.serviceNotes}</div>`:""}
    </div>`;
  }

  if (cert.id === "em_lighting_install" || cert.id === "em_lighting_periodic") {
    const isPeriodic = cert.id === "em_lighting_periodic";
    body = `<div style="background:#f9f9f9;padding:14px;border-radius:8px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px">${isPeriodic ? "Periodic Inspection Details" : "Installation Details"}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
        ${[["Number of Luminaires",cert.numLuminaires||""],["System Category",cert.emCategory||""],["Duration Test (hrs)",cert.durationTest||"3"],["Battery Type",cert.batteryType||""],["Overall Result",cert.eicrResult||"Satisfactory ✓"]].map(([l,v])=>`<div><span style="color:#666">${l}:</span> <strong>${v}</strong></div>`).join("")}
      </div>
      ${cert.serviceNotes?`<div style="margin-top:10px;font-size:12px;color:#444">${cert.serviceNotes}</div>`:""}
    </div>`;
  }

  if (cert.id === "custom") {
    body = `<div style="background:#f9f9f9;padding:14px;border-radius:8px;margin-bottom:16px">
      <div style="font-size:12px;white-space:pre-wrap">${cert.customBody||""}</div>
    </div>`;
  }

  const sigSection = sig ? `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:24px;padding-top:16px;border-top:1px solid #e5e5e5">
      <div><div style="font-size:11px;color:#999;margin-bottom:8px">ENGINEER / CONTRACTOR</div>
        <img src="${sig}" style="height:50px;border-bottom:1px solid #333;padding-bottom:4px" alt="sig"/>
        <div style="font-size:11px;color:#666;margin-top:4px">${brand.tradingName||""} — ${today}</div>
      </div>
      <div><div style="font-size:11px;color:#999;margin-bottom:8px">CLIENT SIGNATURE</div>
        <div style="height:50px;border-bottom:1px solid #333;margin-bottom:4px"></div>
        <div style="font-size:11px;color:#666">Print name: ______________________</div>
      </div>
    </div>` : `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:24px;padding-top:16px;border-top:1px solid #e5e5e5">
      <div><div style="font-size:11px;color:#999;margin-bottom:4px">ENGINEER</div><div style="height:50px;border-bottom:1px solid #333"></div></div>
      <div><div style="font-size:11px;color:#999;margin-bottom:4px">CLIENT</div><div style="height:50px;border-bottom:1px solid #333"></div></div>
    </div>`;

  return header + body + sigSection + `<div style="margin-top:16px;font-size:10px;color:#999;text-align:center">${brand.tradingName} · ${brand.phone||""} · Issued ${today}</div></div>`;
}

// ─── Certificates Tab (all trades) ────────────────────────────────────────────
export function CertificatesTab({ job, brand, customers, user, connection }) {
  const [certs, setCerts] = useState([]);
  const [showForm, setShowForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showSig, setShowSig] = useState(false);
  const [pendingSig, setPendingSig] = useState(null);
  const [expandedCat, setExpandedCat] = useState("Gas");
  const [form, setForm] = useState({
    customer: job?.customer || "", address: job?.address || "", engineer: brand?.tradingName || "",
    landlord: "", certNumber: "", niceicNumber: "",
    applianceType: "", applianceLocation: "", makeModel: "", serialNo: "",
    flueType: "Open flued", safeToUse: true, defects: "", serviceNotes: "", nextServiceDate: "",
    warningCondition: "", warningAction: "", warningAdvice: "",
    inletPressure: "", heatInput: "",
    eicrResult: "Satisfactory", numCircuits: "", earthing: "TN-C-S (PME)", nextInspection: "",
    maxDemand: "", supplyVoltage: "230V", observations: "",
    workDescription: "", workLocation: "", circuitDetails: "", testMethod: "",
    totalItems: "", itemsPass: "", itemsFail: "0", patNotes: "",
    systemType: "", testPressure: "", testDuration: "", finalReading: "", pressureResult: "Pass",
    capacity: "", maxPressure: "", tempSetting: "60°C",
    oilType: "Kerosene 28s", oilResult: "Satisfactory",
    notificationNo: "", buildingControl: "", customBody: "",
  });

  useEffect(() => { loadCerts(); }, [job?.id]);
  useEffect(() => { setForm(f => ({ ...f, customer: job?.customer || "", address: job?.address || "", engineer: brand?.tradingName || "" })); }, [job, brand]);

  async function loadCerts() {
    if (!user || !job?.id) return;
    const { data } = await db.from("trade_certificates").select("*").eq("job_id", job.id).order("created_at", { ascending: false });
    setCerts(data || []);
  }

  async function saveCert(sigData) {
    if (!showForm) return;
    setSaving(true);
    const certType = TRADE_CERT_LIST.find(c => c.id === showForm);
    // Assign sequential certificate number from brand settings
    const certNum = brand.certPrefix && brand.certNextNumber
      ? `${brand.certPrefix}-${String(brand.certNextNumber).padStart(3, "0")}`
      : "";
    const certData = { ...form, id: showForm, label: certType?.label || "", short: certType?.short || "", signature: sigData, certNumber: certNum };
    const html = buildCertHTML(certData, brand, job, sigData);
    const { data, error } = await db.from("trade_certificates").insert({ job_id: job.id, user_id: user.id, cert_type: showForm, cert_label: certType?.label || "", cert_data: certData, html_content: html, signature: sigData || null, created_at: new Date().toISOString() }).select().single();
    if (error) {
      alert(`Couldn't save certificate: ${error.message}`);
      setSaving(false);
      return;
    }
    if (data) {
      setCerts(prev => [data, ...prev]);
      // Auto-increment the certificate counter in brand settings
      if (certNum) setBrand(b => ({ ...b, certNextNumber: (b.certNextNumber || 1) + 1 }));
    }
    setShowForm(null);
    setSaving(false);
  }

  async function emailCert(cert) {
    if (!connection) { alert("No email connected. Go to Inbox to connect Gmail or Outlook."); return; }
    const customer = (customers || []).find(c => c.name?.toLowerCase() === job?.customer?.toLowerCase());
    let toEmail = customer?.email || "";
    if (!toEmail) { toEmail = prompt(`Email address for ${job?.customer}:`); if (!toEmail) return; }
    const endpoint = connection.provider === "outlook" ? "/api/outlook/send" : "/api/gmail/send";
    const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id, to: toEmail, subject: `${cert.cert_label} — ${brand.tradingName}`, body: `<p>Dear ${job?.customer},</p><p>Please find your ${cert.cert_label} below.</p>${cert.html_content}<p>Many thanks,<br>${brand.tradingName}</p>` }) });
    const d = await res.json();
    if (d.error) alert(`Failed: ${d.error}`); else alert(`✓ Certificate sent to ${toEmail}`);
  }

  const setF = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  // Cert-specific form fields
  function CertFormFields({ id }) {
    const gas = ["cp12","smr","pad17","gas_warning"].includes(id);
    const elec = ["eicr","eic","meic","pat"].includes(id);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div><label style={S.label}>Customer Name</label><input style={S.input} value={form.customer} onChange={setF("customer")} /></div>
          <div><label style={S.label}>Property Address</label><input style={S.input} value={form.address} onChange={setF("address")} /></div>
          <div><label style={S.label}>Certificate No.</label><input style={S.input} placeholder="e.g. GS-2024-001" value={form.certNumber} onChange={setF("certNumber")} /></div>
          {id === "cp12" && <div><label style={S.label}>Landlord Name</label><input style={S.input} value={form.landlord} onChange={setF("landlord")} /></div>}
          {elec && (
            <div>
              <label style={S.label}>Electrical Scheme No.</label>
              <div style={{ ...S.input, background: C.surfaceHigh, color: brand.niceicNumber || brand.napitNumber || brand.elecsaNumber ? C.green : C.amber, cursor: "default", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {brand.niceicNumber ? `NICEIC: ${brand.niceicNumber}`
                  : brand.napitNumber ? `NAPIT: ${brand.napitNumber}`
                  : brand.elecsaNumber ? `ELECSA: ${brand.elecsaNumber}`
                  : "⚠ Not set — add in Settings"}
                <span style={{ fontSize: 10, color: C.muted }}>from Settings</span>
              </div>
            </div>
          )}
          {(id === "oil_service" || id === "oil_warning") && (
            <div>
              <label style={S.label}>OFTEC No.</label>
              <div style={{ ...S.input, background: C.surfaceHigh, color: brand.oftecNumber ? C.green : C.amber, cursor: "default", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {brand.oftecNumber || "⚠ Not set — add in Settings"}
                <span style={{ fontSize: 10, color: C.muted }}>from Settings</span>
              </div>
            </div>
          )}
          {(id === "cd11" || id === "cd12") && (
            <div>
              <label style={S.label}>HETAS No.</label>
              <div style={{ ...S.input, background: C.surfaceHigh, color: brand.hetasNumber ? C.green : C.amber, cursor: "default", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {brand.hetasNumber || "⚠ Not set — add in Settings"}
                <span style={{ fontSize: 10, color: C.muted }}>from Settings</span>
              </div>
            </div>
          )}
          {id === "cp12" && (
            <div>
              <label style={S.label}>Gas Safe No.</label>
              <div style={{ ...S.input, background: C.surfaceHigh, color: brand.gasSafeNumber ? C.green : C.amber, cursor: "default", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {brand.gasSafeNumber || "⚠ Not set — add in Settings"}
                <span style={{ fontSize: 10, color: C.muted }}>from Settings</span>
              </div>
            </div>
          )}
        </div>

        {gas && id !== "gas_warning" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><label style={S.label}>Appliance Type</label><input style={S.input} placeholder="e.g. Boiler, Gas Fire" value={form.applianceType} onChange={setF("applianceType")} /></div>
            <div><label style={S.label}>Make / Model</label><input style={S.input} value={form.makeModel} onChange={setF("makeModel")} /></div>
            {["smr","pad17"].includes(id) && <div><label style={S.label}>Serial No.</label><input style={S.input} value={form.serialNo} onChange={setF("serialNo")} /></div>}
            {id === "cp12" && <div><label style={S.label}>Location</label><input style={S.input} placeholder="e.g. Kitchen" value={form.applianceLocation} onChange={setF("applianceLocation")} /></div>}
            {id === "cp12" && <div><label style={S.label}>Flue Type</label><select style={S.input} value={form.flueType} onChange={setF("flueType")}>{["Open flued","Room sealed","Balanced flue","Fan flue","Flueless"].map(f=><option key={f}>{f}</option>)}</select></div>}
            {id === "pad17" && <><div><label style={S.label}>Inlet Pressure</label><input style={S.input} placeholder="mbar" value={form.inletPressure} onChange={setF("inletPressure")} /></div><div><label style={S.label}>Heat Input</label><input style={S.input} placeholder="kW" value={form.heatInput} onChange={setF("heatInput")} /></div></>}
            {id === "smr" && <div><label style={S.label}>Next Service Due</label><input type="date" style={S.input} value={form.nextServiceDate} onChange={setF("nextServiceDate")} /></div>}
          </div>
        )}
        {id === "smr" && <div><label style={S.label}>Service Notes</label><textarea style={{ ...S.input, minHeight: 60, resize: "none" }} value={form.serviceNotes} onChange={setF("serviceNotes")} /></div>}
        {id === "cp12" && <div><label style={S.label}>Defects / Remedial Action</label><textarea style={{ ...S.input, minHeight: 60, resize: "none" }} placeholder="None found, or describe issues..." value={form.defects} onChange={setF("defects")} /></div>}
        {id === "gas_warning" && (
          <>
            <div><label style={S.label}>Condition Found</label><textarea style={{ ...S.input, minHeight: 60, resize: "none" }} value={form.warningCondition} onChange={setF("warningCondition")} /></div>
            <div><label style={S.label}>Action Taken</label><input style={S.input} value={form.warningAction} onChange={setF("warningAction")} /></div>
            <div><label style={S.label}>Advice Given</label><input style={S.input} value={form.warningAdvice} onChange={setF("warningAdvice")} /></div>
          </>
        )}
        {id === "eicr" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><label style={S.label}>Overall Result</label><select style={S.input} value={form.eicrResult} onChange={setF("eicrResult")}><option>Satisfactory</option><option>Unsatisfactory</option></select></div>
            <div><label style={S.label}>No. of Circuits</label><input style={S.input} value={form.numCircuits} onChange={setF("numCircuits")} /></div>
            <div><label style={S.label}>Earthing</label><input style={S.input} value={form.earthing} onChange={setF("earthing")} /></div>
            <div><label style={S.label}>Next Inspection Due</label><input type="date" style={S.input} value={form.nextInspection} onChange={setF("nextInspection")} /></div>
            <div style={{ gridColumn: "1/-1" }}><label style={S.label}>Observations / Codes</label><textarea style={{ ...S.input, minHeight: 60, resize: "none" }} placeholder="e.g. C1: Danger present..." value={form.observations} onChange={setF("observations")} /></div>
          </div>
        )}
        {(id === "eic" || id === "meic") && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div style={{ gridColumn: "1/-1" }}><label style={S.label}>Description of Work</label><input style={S.input} value={form.workDescription} onChange={setF("workDescription")} /></div>
            <div><label style={S.label}>Location</label><input style={S.input} value={form.workLocation} onChange={setF("workLocation")} /></div>
            {id === "eic" && <><div><label style={S.label}>No. of Circuits</label><input style={S.input} value={form.numCircuits} onChange={setF("numCircuits")} /></div><div><label style={S.label}>Earthing</label><input style={S.input} value={form.earthing} onChange={setF("earthing")} /></div></>}
            {id === "meic" && <div><label style={S.label}>Circuit Details</label><input style={S.input} value={form.circuitDetails} onChange={setF("circuitDetails")} /></div>}
          </div>
        )}
        {id === "pat" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><label style={S.label}>Total Items Tested</label><input type="number" style={S.input} value={form.totalItems} onChange={setF("totalItems")} /></div>
            <div><label style={S.label}>Items Passed</label><input type="number" style={S.input} value={form.itemsPass} onChange={setF("itemsPass")} /></div>
            <div><label style={S.label}>Items Failed</label><input type="number" style={S.input} value={form.itemsFail} onChange={setF("itemsFail")} /></div>
            <div style={{ gridColumn: "1/-1" }}><label style={S.label}>Notes</label><textarea style={{ ...S.input, minHeight: 60, resize: "none" }} value={form.patNotes} onChange={setF("patNotes")} /></div>
          </div>
        )}
        {id === "pressure_test" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><label style={S.label}>System</label><input style={S.input} placeholder="e.g. CH, DHW" value={form.systemType} onChange={setF("systemType")} /></div>
            <div><label style={S.label}>Test Pressure (bar)</label><input style={S.input} value={form.testPressure} onChange={setF("testPressure")} /></div>
            <div><label style={S.label}>Duration (mins)</label><input style={S.input} value={form.testDuration} onChange={setF("testDuration")} /></div>
            <div><label style={S.label}>Final Reading (bar)</label><input style={S.input} value={form.finalReading} onChange={setF("finalReading")} /></div>
          </div>
        )}
        {id === "unvented_hw" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><label style={S.label}>Cylinder Make/Model</label><input style={S.input} value={form.makeModel} onChange={setF("makeModel")} /></div>
            <div><label style={S.label}>Serial No.</label><input style={S.input} value={form.serialNo} onChange={setF("serialNo")} /></div>
            <div><label style={S.label}>Capacity (litres)</label><input style={S.input} value={form.capacity} onChange={setF("capacity")} /></div>
            <div><label style={S.label}>Max Working Pressure</label><input style={S.input} value={form.maxPressure} onChange={setF("maxPressure")} /></div>
            <div><label style={S.label}>Temp Setting</label><input style={S.input} value={form.tempSetting} onChange={setF("tempSetting")} /></div>
          </div>
        )}
        {(id === "cd11" || id === "cd12") && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><label style={S.label}>Appliance</label><input style={S.input} value={form.applianceType} onChange={setF("applianceType")} /></div>
            <div><label style={S.label}>Make/Model</label><input style={S.input} value={form.makeModel} onChange={setF("makeModel")} /></div>
            <div><label style={S.label}>Serial No.</label><input style={S.input} value={form.serialNo} onChange={setF("serialNo")} /></div>
            <div><label style={S.label}>Oil Type</label><select style={S.input} value={form.oilType} onChange={setF("oilType")}><option>Kerosene 28s</option><option>Gas Oil 35s</option></select></div>
          </div>
        )}
        {id === "part_p" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div style={{ gridColumn: "1/-1" }}><label style={S.label}>Description of Work</label><input style={S.input} value={form.workDescription} onChange={setF("workDescription")} /></div>
            <div><label style={S.label}>Notification No.</label><input style={S.input} value={form.notificationNo} onChange={setF("notificationNo")} /></div>
            <div><label style={S.label}>Building Control</label><input style={S.input} value={form.buildingControl} onChange={setF("buildingControl")} /></div>
          </div>
        )}
        {(id === "fire_alarm_design" || id === "fire_alarm_periodic") && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><label style={S.label}>System Grade</label><select style={S.input} value={form.systemGrade} onChange={setF("systemGrade")}>{["Grade A","Grade B","Grade C","Grade D","Grade E","Grade F"].map(g=><option key={g}>{g}</option>)}</select></div>
            <div><label style={S.label}>Category</label><input style={S.input} placeholder="e.g. L1, M, P1" value={form.category} onChange={setF("category")} /></div>
            <div><label style={S.label}>No. of Detectors</label><input type="number" style={S.input} value={form.numDetectors} onChange={setF("numDetectors")} /></div>
            <div><label style={S.label}>No. of Sounders</label><input type="number" style={S.input} value={form.numSounders} onChange={setF("numSounders")} /></div>
            <div><label style={S.label}>Panel Make/Model</label><input style={S.input} value={form.makeModel} onChange={setF("makeModel")} /></div>
            <div><label style={S.label}>Result</label><select style={S.input} value={form.eicrResult} onChange={setF("eicrResult")}><option>Satisfactory ✓</option><option>Unsatisfactory</option></select></div>
            <div style={{ gridColumn: "1/-1" }}><label style={S.label}>Notes</label><textarea style={{ ...S.input, minHeight: 60, resize: "none" }} value={form.serviceNotes} onChange={setF("serviceNotes")} /></div>
          </div>
        )}
        {(id === "em_lighting_install" || id === "em_lighting_periodic") && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><label style={S.label}>No. of Luminaires</label><input type="number" style={S.input} value={form.numLuminaires} onChange={setF("numLuminaires")} /></div>
            <div><label style={S.label}>Category</label><input style={S.input} placeholder="e.g. Maintained, Non-maintained" value={form.emCategory} onChange={setF("emCategory")} /></div>
            <div><label style={S.label}>Duration Test (hrs)</label><input style={S.input} value={form.durationTest} onChange={setF("durationTest")} /></div>
            <div><label style={S.label}>Battery Type</label><input style={S.input} placeholder="e.g. NiCd, LiFePO4" value={form.batteryType} onChange={setF("batteryType")} /></div>
            <div><label style={S.label}>Result</label><select style={S.input} value={form.eicrResult} onChange={setF("eicrResult")}><option>Satisfactory ✓</option><option>Unsatisfactory</option></select></div>
            <div style={{ gridColumn: "1/-1" }}><label style={S.label}>Notes</label><textarea style={{ ...S.input, minHeight: 60, resize: "none" }} value={form.serviceNotes} onChange={setF("serviceNotes")} /></div>
          </div>
        )}
        {id === "custom" && (
          <>
            <div><label style={S.label}>Certificate Title</label><input style={S.input} placeholder="e.g. Scope of Works Certificate" value={form.certTitle} onChange={setF("certTitle")} /></div>
            <div><label style={S.label}>Body Text</label><textarea style={{ ...S.input, minHeight: 100, resize: "vertical" }} placeholder="Describe the work, findings, results..." value={form.customBody} onChange={setF("customBody")} /></div>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      {!showForm && (
        <div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
            Create professional trade certificates pre-filled with job details. Capture signatures on-screen and email directly to the customer.
          </div>

          {/* Category accordion */}
          {CERT_CATEGORIES.map(cat => (
            <div key={cat.category} style={{ marginBottom: 8 }}>
              <button onClick={() => setExpandedCat(expandedCat === cat.category ? null : cat.category)}
                style={{ ...S.btn("ghost"), width: "100%", justifyContent: "space-between", padding: "10px 14px" }}>
                <span style={{ fontWeight: 700 }}>{cat.icon} {cat.category}</span>
                <span style={{ color: C.muted }}>{expandedCat === cat.category ? "▲" : "▼"}</span>
              </button>
              {expandedCat === cat.category && (
                <div style={{ background: C.surfaceHigh, borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
                  {cat.certs.map((c, i) => (
                    <button key={c.id} onClick={() => setShowForm(c.id)}
                      style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "transparent", border: "none", borderTop: i > 0 ? `1px solid ${C.border}` : "none", cursor: "pointer", fontFamily: "'DM Mono',monospace", fontSize: 12, color: C.text }}>
                      <span>{c.label}</span>
                      <span style={{ color: C.amber, fontWeight: 700, fontSize: 11 }}>Create →</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Issued certs */}
          {certs.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={S.sectionTitle}>Issued Certificates ({certs.length})</div>
              {certs.map(cert => (
                <div key={cert.id} style={{ background: C.surfaceHigh, borderRadius: 8, padding: "12px 14px", marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{cert.cert_label}</div>
                      {cert.cert_data?.certNumber && (
                        <div style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: C.amber, marginTop: 2 }}>{cert.cert_data.certNumber}</div>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: C.muted }}>{new Date(cert.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>
                  </div>
                  {cert.signature && <div style={{ fontSize: 11, color: C.green, marginBottom: 6 }}>✓ Signed</div>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px" }} onClick={() => openHtmlPreview(cert.html_content)}>⬇ View/Print</button>
                    <button style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px", color: C.blue }} onClick={() => emailCert(cert)}>✉ Email</button>
                    {!cert.signature && <button style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px", color: C.green }} onClick={() => { setPendingSig(cert); setShowSig(true); }}>✍ Sign</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Certificate form */}
      {showForm && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => setShowForm(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 20, padding: 0 }}>←</button>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{TRADE_CERT_LIST.find(c => c.id === showForm)?.label}</div>
            </div>
            <VoiceFillButton
              form={form}
              setForm={setForm}
              fieldDescriptions="customer (customer name), address (property address), applianceType (e.g. boiler or gas fire), makeModel (make and model), serialNo (serial number), flueType (flue type), defects (any defects found), serviceNotes (service notes), nextServiceDate (next service date YYYY-MM-DD), eicrResult (Satisfactory or Unsatisfactory), numCircuits (number of circuits), nextInspection (next inspection date YYYY-MM-DD), observations (any observations or codes), workDescription (description of work), totalItems (number of items PAT tested), itemsPass (number passed), testPressure (test pressure in bar), customBody (certificate body text)"
            />
          </div>
          <CertFormFields id={showForm} />
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button style={{ ...S.btn("primary"), flex: 1, justifyContent: "center" }} disabled={saving} onClick={() => { setPendingSig(null); setShowSig(true); }}>✍ Sign & Save</button>
            <button style={S.btn("ghost")} disabled={saving} onClick={() => saveCert(null)}>{saving ? "Saving..." : "Save without signature"}</button>
          </div>
        </div>
      )}

      {showSig && (
        <SignaturePad
          title="Engineer Signature"
          onSave={async (sigData) => {
            setShowSig(false);
            if (pendingSig) {
              const certData = { ...pendingSig.cert_data, signature: sigData };
              const html = buildCertHTML(certData, brand, job, sigData);
              await db.from("trade_certificates").update({ signature: sigData, html_content: html }).eq("id", pendingSig.id);
              setCerts(prev => prev.map(c => c.id === pendingSig.id ? { ...c, signature: sigData, html_content: html } : c));
              setPendingSig(null);
            } else {
              await saveCert(sigData);
            }
          }}
          onCancel={() => { setShowSig(false); setPendingSig(null); }}
        />
      )}
    </div>
  );
}
