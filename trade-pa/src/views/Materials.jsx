// ─── Materials Tab ──────────────────────────────────────────────────────
// Extracted verbatim from App.jsx during P7 sub-batch B (28 Apr 2026).
//
// Includes MaterialRow as a private (non-exported) helper — only Materials
// renders it.
import React, { useState, useEffect, useRef } from "react";
import { db } from "../lib/db.js";
import { C } from "../theme/colors.js";
import { S } from "../theme/styles.js";
import { fmtCurrency } from "../lib/format.js";
import { localDate, weekBounds, groupByRecency } from "../lib/time.js";
import { DEFAULT_SUPPLIERS } from "../lib/constants.js";
import { authHeaders } from "../lib/auth.js";
import { fileToContentBlock } from "../lib/files.js";
import { uploadReceiptToStorage } from "../lib/receipts.js";
import { getReceiptViewUrl } from "../lib/receipts.js";
import { statusColor, statusLabel } from "../lib/status.js";
import { VoiceFillButton } from "../components/VoiceFillButton.jsx";
import { AssignToJobModal } from "../modals/AssignToJobModal.jsx";

function MaterialRow({ m, i, cycleStatus, setEditingMaterial, deleteMaterial, markPaid, userId, onAssignJob }) {
  const [expanded, setExpanded] = useState(false);
  const statusColor = { to_order: C.red, ordered: C.blue, collected: C.green };
  const statusLabel = { to_order: "To Order", ordered: "Ordered", collected: "Collected" };

  const viewReceipt = async () => {
    // Resolution order: Storage signed URL → in-memory dataURL → localStorage cache → legacy DB column.
    // getReceiptViewUrl walks these in priority order and returns the first match.
    const url = await getReceiptViewUrl(m);
    if (!url) {
      if (m.receiptSource === "email" && m.receiptFilename) {
        alert(`Invoice: ${m.receiptFilename}\n\nThis invoice was received via email. Open your Inbox to view the original.`);
      } else {
        alert("Invoice image not available.");
      }
      return;
    }

    // PDF? Use an iframe; otherwise an img element.
    const isPdf = url.toLowerCase().includes(".pdf") || url.startsWith("data:application/pdf");
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;overflow-y:auto;padding:16px";
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "← Back to app";
    closeBtn.style.cssText = "position:sticky;top:0;align-self:flex-start;background:#f59e0b;color:#000;border:none;border-radius:8px;padding:10px 18px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:16px;font-family:'DM Mono',monospace;z-index:10;margin-top:max(16px, env(safe-area-inset-top, 16px))";
    closeBtn.onclick = () => document.body.removeChild(overlay);
    overlay.appendChild(closeBtn);
    if (isPdf) {
      const frame = document.createElement("iframe");
      frame.src = url;
      frame.style.cssText = "width:100%;max-width:900px;height:80vh;border:none;background:#fff;border-radius:8px";
      overlay.appendChild(frame);
    } else {
      const imgEl = document.createElement("img");
      imgEl.src = url;
      imgEl.style.cssText = "max-width:100%;border-radius:8px;background:#fff";
      overlay.appendChild(imgEl);
    }
    document.body.appendChild(overlay);
  };

  return (
    <div style={{ background: C.surfaceHigh, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", cursor: "pointer" }} onClick={() => setExpanded(e => !e)}>
        <div style={{ width: 4, alignSelf: "stretch", borderRadius: 2, background: statusColor[m.status] || C.muted, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{m.item}</div>
          <div style={{ fontSize: 11, color: C.muted, display: "flex", flexWrap: "wrap", gap: "2px 8px" }}>
            {m.qty > 1 && <span>×{m.qty}</span>}
            {m.supplier && <span>🏪 {m.supplier}</span>}
            {m.job && <span>📋 {m.job}</span>}
            {m.unitPrice > 0 && <span style={{ color: C.amber }}>£{((m.unitPrice || 0) * (m.qty || 1)).toFixed(2)} ex.VAT{m.vatEnabled ? ` +${m.vatRate || 20}%` : ""}</span>}
            {m.dueDate && <span>📅 {new Date(m.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
          </div>
        </div>
        <div style={{ ...S.badge(statusColor[m.status] || C.muted), flexShrink: 0 }}>{statusLabel[m.status] || m.status}</div>
        <div style={{ color: C.muted, fontSize: 12, flexShrink: 0 }}>{expanded ? "▲" : "▼"}</div>
      </div>
      {expanded && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => cycleStatus(i)} style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", fontSize: 12 }}>
              {m.status === "to_order" ? "✓ Mark Ordered" : m.status === "ordered" ? "✓ Mark Collected" : "↺ Reset Status"}
            </button>
            <button
              onClick={() => markPaid && markPaid(i)}
              style={{ ...S.btn(m.paid ? "ghost" : "green"), fontSize: 12, padding: "6px 14px" }}
            >
              {m.paid ? `↺ Paid ${m.paid_on ? new Date(m.paid_on).toLocaleDateString("en-GB") : ""}` : "💷 Mark Paid"}
            </button>
            <button onClick={() => setEditingMaterial({ index: i, item: m.item, qty: String(m.qty || 1), unitPrice: String(m.unitPrice || ""), supplier: m.supplier || "", job: m.job || "", status: m.status || "to_order", vatEnabled: m.vatEnabled || false, vatRate: m.vatRate || 20, dueDate: m.dueDate || "" })} style={{ ...S.btn("ghost"), fontSize: 12, padding: "6px 14px" }}>✏ Edit</button>
            <button onClick={() => deleteMaterial(i)} style={{ ...S.btn("ghost"), fontSize: 12, padding: "6px 14px", color: C.red, borderColor: C.red + "44" }}>Delete</button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => onAssignJob && onAssignJob(i)} style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", fontSize: 12, color: m.job_id ? C.green : C.muted, borderColor: m.job_id ? C.green + "44" : C.border }}>
              🔗 {m.job_id ? (m.job || "Linked") : "Assign to Job"}
            </button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => fetch("/api/xero/create-bill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, material: m }) }).then(r => r.json()).then(d => alert(d.error ? `Xero: ${d.error}` : "✓ Bill created in Xero")).catch(() => alert("Xero not connected"))}
              style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", fontSize: 12, color: "#13B5EA", borderColor: "#13B5EA44" }}>↑ Xero Bill</button>
            <button onClick={() => fetch("/api/quickbooks/create-bill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, material: m }) }).then(r => r.json()).then(d => alert(d.error ? `QuickBooks: ${d.error}` : "✓ Bill created in QuickBooks")).catch(() => alert("QuickBooks not connected"))}
              style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", fontSize: 12, color: "#2CA01C", borderColor: "#2CA01C44" }}>↑ QB Bill</button>
          </div>
          {(m.receiptId || m.receiptSource || m.receiptImage || m.receiptStoragePath) && (
            <div onClick={viewReceipt} style={{ fontSize: 12, background: C.green + "22", color: C.green, border: `1px solid ${C.green}44`, borderRadius: 10, padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              🧾 {m.receiptFilename || "View Invoice"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Materials({ materials, setMaterials, user, companyId, setContextHint }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showSuppliers, setShowSuppliers] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanImageData, setScanImageData] = useState(null);
  const [scanImageType, setScanImageType] = useState("image/jpeg");
  const [scanFile, setScanFile] = useState(null); // Original File object — used to upload to Supabase Storage on save
  const [scanError, setScanError] = useState("");
  const fileRef = useRef();
  const uploadRef = useRef();
  const suppliers = DEFAULT_SUPPLIERS;
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [assigningMaterialIdx, setAssigningMaterialIdx] = useState(null);

  const handleAssignMaterialToJob = (jobId, jobTitle) => {
    if (assigningMaterialIdx === null) return;
    setMaterials(prev => (prev || []).map((m, j) => j === assigningMaterialIdx
      ? { ...m, job_id: jobId, job: jobTitle || m.job }
      : m
    ));
    setAssigningMaterialIdx(null);
  };
  const [supplierForm, setSupplierForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const [filterJob, setFilterJob] = useState("all");

  useEffect(() => {
    if (!setContextHint) return;
    const toOrder = (materials || []).filter(m => m.status === "to_order").length;
    const bits = [`Materials: ${(materials || []).length} items`];
    if (toOrder) bits.push(`${toOrder} to order`);
    setContextHint(bits.join(" · "));
    return () => { if (setContextHint) setContextHint(null); };
  }, [materials, setContextHint]);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const [editingMaterial, setEditingMaterial] = useState(null); // {index, ...fields}
  const emptyRow = () => ({ item: "", qty: 1, unitPrice: "", supplier: "", job: "", status: "to_order", vatEnabled: false, vatRate: 20, dueDate: "" });
  const [rows, setRows] = useState([emptyRow()]);
  const updateRow = (i, k, v) => setRows(prev => prev.map((r, j) => j === i ? { ...r, [k]: v } : r));
  const addRow = () => setRows(prev => [...prev, emptyRow()]);
  const removeRow = (i) => setRows(prev => prev.filter((_, j) => j !== i));

  const scanReceipt = async (file) => {
    if (!file) return;
    setScanning(true);
    setScanError("");
    setScanResult(null);
    setScanImageData(null);
    setScanFile(file); // Hold the original File for Storage upload at save time
    try {
      const { fileContent, dataUrl } = await fileToContentBlock(file);

      setScanImageData(dataUrl);
      setScanImageType(file.type || "image/jpeg");

      const response = await fetch("/api/claude", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              fileContent,
              { type: "text", text: `You are reading a UK supplier receipt or invoice. Extract all details carefully.

IMPORTANT VAT RULES FOR UK RECEIPTS:
- Screwfix, Travis Perkins, Toolstation, City Plumbing, Plumbbase and most UK trade suppliers show prices EX-VAT with VAT added at the bottom as a separate line
- If you see a "VAT" line at the bottom of the receipt, pricesIncVat = false (prices are ex-VAT)
- If there is no separate VAT line and the total appears to include VAT, pricesIncVat = true
- UK standard VAT rate is 20%. Reduced rate is 5%.
- unitPrice should ALWAYS be the ex-VAT price per unit
- If pricesIncVat is true: unitPriceExVat = unitPrice / 1.2 (for 20%) or unitPrice / 1.05 (for 5%)
- If pricesIncVat is false: unitPriceExVat = unitPrice (already ex-VAT)

Return ONLY valid JSON:
{
  "supplier": "supplier name",
  "date": "YYYY-MM-DD or empty string",
  "total": 123.45,
  "vatAmount": 20.59,
  "vatRate": 20,
  "pricesIncVat": false,
  "items": [
    { "item": "item name", "qty": 1, "unitPrice": 5.97, "unitPriceExVat": 5.97 }
  ]
}

Example: Screwfix receipt showing "Tubular Latch £5.97" with "VAT £1.19" at bottom:
- pricesIncVat: false (prices shown are ex-VAT)
- unitPrice: 5.97
- unitPriceExVat: 5.97
- vatAmount: 1.19
- vatRate: 20
- total (inc VAT): 7.16

Return only JSON, no other text.` },
            ],
          }],
        }),
      });

      const data = await response.json();
      const text = data.content?.[0]?.text || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Could not parse receipt");
      const parsed = JSON.parse(jsonMatch[0]);
      setScanResult(parsed);
      setShowScanner(true);
    } catch (e) {
      console.error("Scan error:", e);
      setScanError("Could not read receipt — try a clearer photo or different file");
    }
    setScanning(false);
  };

  const addScannedMaterials = async () => {
    if (!scanResult) return;
    const receiptId = `rcpt_${Date.now()}`;

    // ─── Upload to Supabase Storage (preferred path) ───────────────────────
    // Storage gives cross-device receipts (scan on phone, view on desktop)
    // and avoids browser localStorage's 5MB ceiling. Falls back to
    // localStorage if upload fails (offline / network glitch) so the
    // receipt isn't lost.
    let receiptStoragePath = null;
    if (scanFile && user?.id) {
      receiptStoragePath = await uploadReceiptToStorage(scanFile, user.id, receiptId);
    }
    // Local fallback — only stored if Storage upload didn't succeed.
    // Saves bandwidth + browser storage when the canonical copy is in cloud.
    if (!receiptStoragePath && scanImageData) {
      try { localStorage.setItem(`trade-pa-receipt-${receiptId}`, scanImageData); } catch {}
    }

    // ─── Persist materials to DB (was previously React-state-only) ─────────
    // Build INSERT payloads. Receipt fields go on each row so any item
    // from the same receipt links back to the same scan. The supplier
    // and date come from the scanResult.
    const vatRate = parseInt(scanResult.vatRate || 0);
    const vatEnabled = vatRate > 0;
    const insertPayloads = (scanResult.items || []).map(item => {
      const exVatPrice = item.unitPriceExVat
        || (scanResult.pricesIncVat && vatEnabled
          ? parseFloat((item.unitPrice / (1 + vatRate / 100)).toFixed(4))
          : item.unitPrice) || 0;
      return {
        user_id: user?.id,
        company_id: companyId || null,
        item: item.item,
        qty: item.qty || 1,
        unit_price: parseFloat(exVatPrice.toFixed(2)),
        supplier: scanResult.supplier || "",
        job: scanResult.jobRef || "",
        status: "ordered",
        receipt_id: receiptId,
        receipt_source: "scan",
        receipt_filename: scanFile?.name || null,
        receipt_storage_path: receiptStoragePath,  // null if upload failed (legacy fallback)
        created_at: new Date().toISOString(),
      };
    });

    let insertedRows = [];
    if (user?.id && insertPayloads.length > 0) {
      const { data, error } = await db.from("materials").insert(insertPayloads).select();
      if (error) {
        console.warn("Materials insert failed:", error.message);
        setSyncMsg("⚠️ Saved locally — couldn't sync to cloud. Try again.");
        setTimeout(() => setSyncMsg(""), 4000);
      } else {
        insertedRows = data || [];
      }
    }

    // Map DB rows → in-memory shape (camelCase + extra UI fields).
    // If the DB insert failed, fall back to the original payload shape.
    const newMaterials = (insertedRows.length > 0 ? insertedRows : insertPayloads).map((row, idx) => ({
      id: row.id || `tmp_${Date.now()}_${idx}`,
      item: row.item,
      qty: row.qty,
      unitPrice: row.unit_price,
      supplier: row.supplier,
      job: row.job,
      status: row.status,
      vatEnabled,
      vatRate: vatEnabled ? vatRate : null,
      dueDate: scanResult.date || "",
      receiptId,
      receiptSource: "scan",
      receiptFilename: row.receipt_filename || scanFile?.name || "",
      receiptStoragePath,  // for cross-device viewing
      receiptImage: receiptStoragePath ? "" : (scanImageData || ""), // only carry inline if storage failed
      receiptDate: scanResult.date || "",
    }));
    setMaterials(prev => [...(prev || []), ...newMaterials]);

    // ─── Sync to Xero as bill, attaching the image ─────────────────────────
    if (user?.id) {
      fetch("/api/xero/create-bill", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          userId: user.id,
          bill: { ...scanResult, jobRef: "" },
          receiptImage: scanImageData,
          receiptImageType: scanImageType,
        }),
      }).catch(() => {});
    }

    setScanResult(null);
    setScanImageData(null);
    setScanFile(null);
    setShowScanner(false);
    setSyncMsg(`✓ ${newMaterials.length} items added from receipt`);
    setTimeout(() => setSyncMsg(""), 3000);
  };

  const saveAll = async () => {
    const valid = rows.filter(r => r.item.trim());
    if (!valid.length) return;

    // ─── Persist to DB ─────────────────────────────────────────────────────
    // Previously: only setMaterials() — entries vanished on refresh.
    // Fixed 27 Apr 2026 alongside scanner persistence (forensic audit).
    const insertPayloads = valid.map(r => ({
      user_id: user?.id,
      company_id: companyId || null,
      item: r.item,
      qty: parseInt(r.qty) || 1,
      unit_price: parseFloat(r.unitPrice) || 0,
      supplier: r.supplier || "",
      job: r.job || "",
      status: r.status || "to_order",
      created_at: new Date().toISOString(),
    }));

    let insertedRows = [];
    if (user?.id) {
      const { data, error } = await db.from("materials").insert(insertPayloads).select();
      if (error) {
        console.warn("Materials manual insert failed:", error.message);
        setSyncMsg("⚠️ Saved locally — couldn't sync to cloud. Try again.");
        setTimeout(() => setSyncMsg(""), 4000);
      } else {
        insertedRows = data || [];
      }
    }

    // Map DB rows → in-memory shape (camelCase). Fall back to local-shape
    // if insert failed so user still sees their entries until they retry.
    const newMaterials = (insertedRows.length > 0 ? insertedRows : insertPayloads).map((row, idx) => ({
      id: row.id || `tmp_${Date.now()}_${idx}`,
      item: row.item,
      qty: row.qty,
      unitPrice: row.unit_price,
      supplier: row.supplier,
      job: row.job,
      status: row.status,
      vatEnabled: valid[idx].vatEnabled || false,
      vatRate: valid[idx].vatEnabled ? (valid[idx].vatRate || 20) : null,
      dueDate: valid[idx].dueDate || "",
    }));
    setMaterials(prev => [...(prev || []), ...newMaterials]);

    setRows([emptyRow()]);
    setShowAdd(false);
  };

  const saveSupplier = () => {
    if (!supplierForm.name) return;
    if (editingSupplier !== null) {
      setSuppliers(prev => prev.map((s, i) => i === editingSupplier ? supplierForm : s));
    } else {
      setSuppliers(prev => [...prev, supplierForm]);
    }
    setEditingSupplier(null);
    setSupplierForm({ name: "", phone: "", email: "", notes: "" });
  };

  const deleteSupplier = (i) => setSuppliers(prev => prev.filter((_, j) => j !== i));
  const dial = (phone) => { if (phone) window.location.href = `tel:${phone.replace(/\s/g, "")}`; };
  const cycleStatus = async (i) => {
    const target = (materials || [])[i];
    if (!target) return;
    const next = target.status === "to_order" ? "ordered" : target.status === "ordered" ? "collected" : "to_order";
    setMaterials(prev => (prev || []).map((x, j) => j === i ? { ...x, status: next } : x));
    if (target.id && user?.id) {
      try {
        await db.from("materials").update({ status: next }).eq("id", target.id).eq("user_id", user.id);
      } catch (err) { console.warn("cycleStatus DB update failed:", err.message); }
    }
  };
  // markPaid — toggle paid flag on a material row. Previously this lived
  // inline in MaterialRow and referenced undefined `setMaterials` and `user`
  // because MaterialRow's props don't include them. Lifted up to the parent
  // Materials scope where setMaterials and user are in scope, then passed
  // down to MaterialRow as a callback prop.
  const markPaid = async (i) => {
    const target = (materials || [])[i];
    if (!target) return;
    const paidValue = !target.paid;
    const paid_on = paidValue ? localDate() : null;
    setMaterials(prev => (prev || []).map((x, j) => j === i ? { ...x, paid: paidValue, paid_on } : x));
    if (target.id && user?.id) {
      try {
        await db.from("materials").update({ paid: paidValue, paid_on }).eq("id", target.id).eq("user_id", user.id);
      } catch (err) { console.warn("markPaid DB update failed:", err.message); }
    }
  };
  const deleteMaterial = async (i) => {
    const target = (materials || [])[i];
    if (!target) return;
    setMaterials(prev => (prev || []).filter((_, j) => j !== i));
    // Soft-delete via the db wrapper (.delete() on materials triggers the holding-bay path)
    if (target.id && user?.id) {
      try {
        await db.from("materials").delete().eq("id", target.id).eq("user_id", user.id);
      } catch (err) { console.warn("deleteMaterial DB delete failed:", err.message); }
    }
  };

  const jobList = [...new Set((materials || []).map(m => m.job).filter(Boolean))];
  const filtered = filterJob === "all" ? (materials || []) : (materials || []).filter(m => m.job === filterJob);
  const totalCost = (materials || []).reduce((s, m) => s + (m.unitPrice || 0) * (m.qty || 1), 0);
  const toOrderCost = (materials || []).filter(m => m.status === "to_order").reduce((s, m) => s + (m.unitPrice || 0) * (m.qty || 1), 0);

  const syncToXero = async () => {
    const toSync = (materials || []).filter(m => m.unitPrice > 0);
    if (!toSync.length) { setSyncMsg("No priced materials to sync — add unit prices first"); setTimeout(() => setSyncMsg(""), 3000); return; }
    setSyncing(true);
    try {
      const res = await fetch("/api/xero/create-bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id, materials: toSync }),
      });
      const data = await res.json();
      if (data.success) {
        setSyncMsg(`✓ ${toSync.length} material${toSync.length !== 1 ? "s" : ""} synced to Xero as purchase orders`);
      } else {
        setSyncMsg(`Error: ${data.error || "Sync failed"}`);
      }
    } catch (e) {
      setSyncMsg("Connection error — check Xero is connected in Settings");
    }
    setSyncing(false);
    setTimeout(() => setSyncMsg(""), 4000);
  };

  // ── Phase 3: list-level controls (search / status filter / sort / grouping)
  // Job filter (filterJob) above is retained as a secondary dimension.
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [sortMode, setSortMode] = useState("recent");

  // Canonical material pill — amber reserved for actions/warnings per audit.
  const MAT_PILL = {
    to_order:  { label: "To Order",  color: C.red   },
    ordered:   { label: "Ordered",   color: C.blue  },
    collected: { label: "Collected", color: C.green },
  };

  // Week bounds — see module-scope utilities
  const _bounds = weekBounds();

  // Per-material derivations
  const isToOrder   = (m) => m.status === "to_order";
  const isOrdered   = (m) => m.status === "ordered";
  const isCollected = (m) => m.status === "collected";
  const isUnassigned = (m) => !m.job && !m.job_id;
  const matTime = (m) => new Date(m.receiptDate || m.created_at || m.dueDate || 0).getTime();

  // Live chip counts — layered on the job-filtered `filtered` so counts reflect
  // the current job-filter context (if the user has narrowed to one job).
  const counts = {
    all:        filtered.length,
    to_order:   filtered.filter(isToOrder).length,
    ordered:    filtered.filter(isOrdered).length,
    collected:  filtered.filter(isCollected).length,
    unassigned: filtered.filter(isUnassigned).length,
  };

  // Apply status filter + search on top of the job-filtered set
  const _q = search.trim().toLowerCase();
  const filteredMaterials = filtered.filter(m => {
    if (_q) {
      const hay = [m.item, m.supplier, m.job, m.notes].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(_q)) return false;
    }
    switch (activeFilter) {
      case "to_order":   return isToOrder(m);
      case "ordered":    return isOrdered(m);
      case "collected":  return isCollected(m);
      case "unassigned": return isUnassigned(m);
      default:           return true;
    }
  });

  // Sort
  const sortedMaterials = [...filteredMaterials].sort((a, b) => {
    switch (sortMode) {
      case "value":    return (parseFloat(b.unitPrice || 0) * parseFloat(b.qty || 1)) - (parseFloat(a.unitPrice || 0) * parseFloat(a.qty || 1));
      case "supplier": return (a.supplier || "").localeCompare(b.supplier || "");
      case "status":   return (a.status || "").localeCompare(b.status || "");
      default:         return matTime(b) - matTime(a);
    }
  });

  // Group by recency (recent sort only)
  const groupedMaterials = sortMode === "recent"
    ? groupByRecency(sortedMaterials, matTime, _bounds)
    : [{ key: "flat", label: null, items: sortedMaterials }];

  // Filtered cost — reflects search + status + job together
  const filteredCost = sortedMaterials.reduce((s, m) => s + (parseFloat(m.unitPrice) || 0) * (parseFloat(m.qty) || 1), 0);

  const CHIPS = [
    { id: "all",        label: "All",        urgent: false },
    { id: "to_order",   label: "To order",   urgent: true  },
    { id: "ordered",    label: "Ordered",    urgent: false },
    { id: "collected",  label: "Collected",  urgent: false },
    { id: "unassigned", label: "Unassigned", urgent: false },
  ];
  const SORT_LABELS = { recent: "Recent", value: "By value", supplier: "By supplier", status: "By status" };
  const SORT_ORDER = ["recent", "value", "supplier", "status"];
  const nextSort = () => setSortMode(s => SORT_ORDER[(SORT_ORDER.indexOf(s) + 1) % SORT_ORDER.length]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Materials & Orders</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={S.btn("ghost")} onClick={() => setShowSuppliers(true)}>Suppliers</button>
            <button style={{ ...S.btn("ghost"), color: "#13B5EA", borderColor: "#13B5EA44" }} onClick={syncToXero} disabled={syncing}>{syncing ? "Syncing..." : "↑ Xero"}</button>
            <button style={{ ...S.btn("ghost"), color: "#2CA01C", borderColor: "#2CA01C44" }} onClick={async () => {
              try {
                const toSync = materials.filter(m => m.status === "ordered" || m.status === "to_order");
                if (toSync.length === 0) { alert("No materials to sync"); return; }
                await fetch("/api/quickbooks/create-bills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user?.id, materials: toSync }) });
                alert(`✓ ${toSync.length} material${toSync.length !== 1 ? "s" : ""} synced to QuickBooks`);
              } catch { alert("QuickBooks sync failed — check QuickBooks is connected in Settings"); }
            }}>↑ QB</button>
            <button style={S.btn("primary")} onClick={() => setShowAdd(true)}>+ Add</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...S.btn("ghost"), color: C.amber, flex: 1, justifyContent: "center" }} onClick={() => fileRef.current?.click()} disabled={scanning}>{scanning ? "⏳ Scanning..." : "📷 Scan Receipt"}</button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => { scanReceipt(e.target.files?.[0]); e.target.value = ""; }} />
          <button style={{ ...S.btn("ghost"), color: C.amber, flex: 1, justifyContent: "center" }} onClick={() => uploadRef.current?.click()} disabled={scanning}>⬆ Upload Receipt</button>
          <input ref={uploadRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={e => { scanReceipt(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
      </div>

      {scanError && (
        <div style={{ padding: "10px 14px", background: C.red + "18", border: `1px solid ${C.red}44`, borderRadius: 8, fontSize: 12, color: C.red }}>{scanError}</div>
      )}

      {/* Receipt scanner result modal — fully editable */}
      {showScanner && scanResult && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }}>
          <div style={{ ...S.card, maxWidth: 520, width: "100%", marginBottom: 16, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Receipt Scanned ✓</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Review and edit before saving</div>
              </div>
              <button aria-label="Close" onClick={() => { setShowScanner(false); setScanResult(null); setScanImageData(null); }} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
            </div>

            {/* Receipt image thumbnail */}
            {scanImageData && (
              <div style={{ marginBottom: 14 }}>
                <img src={scanImageData} alt="Receipt" style={{ width: "100%", maxHeight: 160, objectFit: "contain", borderRadius: 8, border: `1px solid ${C.border}`, background: "#111" }} />
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              {/* Editable supplier */}
              <div>
                <label style={S.label}>Supplier</label>
                <input style={S.input} value={scanResult.supplier || ""} onChange={e => setScanResult(r => ({ ...r, supplier: e.target.value }))} placeholder="Supplier name" />
              </div>

              {/* Editable date */}
              <div>
                <label style={S.label}>Date</label>
                <input style={S.input} type="date" value={scanResult.date || ""} onChange={e => setScanResult(r => ({ ...r, date: e.target.value }))} />
              </div>

              {/* Job reference */}
              <div>
                <label style={S.label}>Job Reference <span style={{ color: C.muted, fontWeight: 400 }}>(optional)</span></label>
                <input style={S.input} placeholder="e.g. Kitchen refurb, Job #1042" value={scanResult.jobRef || ""} onChange={e => setScanResult(r => ({ ...r, jobRef: e.target.value }))} />
              </div>

              {/* VAT info */}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <label style={S.label}>VAT on this receipt</label>
                  <select style={S.input} value={scanResult.vatRate > 0 ? String(scanResult.vatRate) : "0"} onChange={e => setScanResult(r => ({ ...r, vatRate: parseInt(e.target.value) || 0, vatAmount: parseInt(e.target.value) > 0 ? r.vatAmount : 0 }))}>
                    <option value="0">No VAT</option>
                    <option value="20">20% VAT</option>
                    <option value="5">5% VAT</option>
                  </select>
                </div>
                {scanResult.vatRate > 0 && (
                  <div style={{ flex: 1 }}>
                    <label style={S.label}>VAT Amount (£)</label>
                    <input style={S.input} type="number" step="0.01" value={scanResult.vatAmount || ""} onChange={e => setScanResult(r => ({ ...r, vatAmount: parseFloat(e.target.value) || 0 }))} placeholder="0.00" />
                  </div>
                )}
              </div>
              {scanResult.vatRate > 0 && (
                <div style={{ fontSize: 11, padding: "6px 10px", background: C.amber + "11", borderRadius: 10, color: C.amber }}>
                  {scanResult.pricesIncVat
                    ? `Prices on receipt are inc. ${scanResult.vatRate}% VAT — ex-VAT prices will be calculated automatically`
                    : `Prices on receipt are ex. ${scanResult.vatRate}% VAT — VAT will be added when uploading to Xero`}
                </div>
              )}

              {/* Editable line items */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label style={S.label}>Items</label>
                  <button onClick={() => setScanResult(r => ({ ...r, items: [...(r.items || []), { item: "", qty: 1, unitPrice: 0 }] }))} style={{ ...S.btn("ghost"), fontSize: 11, padding: "3px 10px" }}>+ Add line</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {/* Header row */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 80px 28px", gap: 6 }}>
                    <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Item</div>
                    <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Qty</div>
                    <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Unit £</div>
                    <div />
                  </div>
                  {(scanResult.items || []).map((item, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 60px 80px 28px", gap: 6, alignItems: "center" }}>
                      <input style={{ ...S.input, fontSize: 12 }} value={item.item} onChange={e => setScanResult(r => ({ ...r, items: r.items.map((x, j) => j === i ? { ...x, item: e.target.value } : x) }))} placeholder="Item name" />
                      <input style={{ ...S.input, fontSize: 12, textAlign: "center" }} type="number" min="1" value={item.qty} onChange={e => setScanResult(r => ({ ...r, items: r.items.map((x, j) => j === i ? { ...x, qty: parseFloat(e.target.value) || 1 } : x) }))} />
                      <input style={{ ...S.input, fontSize: 12 }} type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => setScanResult(r => ({ ...r, items: r.items.map((x, j) => j === i ? { ...x, unitPrice: parseFloat(e.target.value) || 0 } : x) }))} />
                      <button onClick={() => setScanResult(r => ({ ...r, items: r.items.filter((_, j) => j !== i) }))} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: 0, textAlign: "center" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
                    </div>
                  ))}
                </div>
                {/* Running total */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10, fontSize: 13, fontWeight: 700, color: C.amber }}>
                  Total: £{(scanResult.items || []).reduce((s, x) => s + (x.unitPrice || 0) * (x.qty || 1), 0).toFixed(2)}
                </div>
              </div>
            </div>

            <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>
              Items will be added to Materials{user?.id ? " and a draft bill with the receipt image sent to Xero." : "."}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn("primary"), flex: 1, justifyContent: "center" }} onClick={addScannedMaterials}>✓ Save to Materials</button>
              <button style={S.btn("ghost")} onClick={() => { setShowScanner(false); setScanResult(null); setScanImageData(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {syncMsg && (
        <div style={{ padding: "10px 14px", background: syncMsg.startsWith("✓") ? C.green + "18" : C.red + "18", border: `1px solid ${syncMsg.startsWith("✓") ? C.green + "44" : C.red + "44"}`, borderRadius: 8, fontSize: 12, color: syncMsg.startsWith("✓") ? C.green : C.red }}>
          {syncMsg}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 10 }}>
        {(() => {
          const unpaidMats = (materials || []).filter(m => !m.paid);
          const unpaidCost = unpaidMats.reduce((s, m) => s + (parseFloat(m.unitPrice) || 0) * (parseFloat(m.qty) || 1), 0);
          return [
            { l: "Unpaid", v: unpaidMats.length, sub: unpaidCost > 0 ? `${fmtCurrency(unpaidCost)} owed` : "Nothing owed", c: unpaidMats.length > 0 ? C.red : C.muted },
            { l: "To Order", v: (materials || []).filter(m => m.status === "to_order").length, sub: toOrderCost > 0 ? `Est. ${fmtCurrency(toOrderCost)}` : "No prices set", c: C.amber },
            { l: "Ordered", v: (materials || []).filter(m => m.status === "ordered").length, sub: "Awaiting delivery", c: C.blue },
            { l: "Total Cost", v: totalCost > 0 ? `${fmtCurrency(totalCost)}` : "—", sub: "All materials", c: C.text },
          ];
        })().map((st, i) => {
          // Auto-shrink the value font when long currency figures would
          // overflow the card. £3,207.16 = 9 chars, fits at 22px. £999,999.99
          // = 11 chars, needs 18px. £9,999,999.99 = 13 chars, needs 16px.
          // Defaults to 22px for short/numeric values like counts.
          const valueLen = String(st.v ?? "").length;
          const valueFontSize = valueLen >= 12 ? 16 : valueLen >= 10 ? 18 : valueLen >= 8 ? 20 : 22;
          return (
            <div key={i} style={S.card}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{st.l}</div>
              <div style={{ fontSize: valueFontSize, fontWeight: 700, color: st.c, lineHeight: 1.15, wordBreak: "break-word" }}>{st.v}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{st.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Phase 3: search + status chips — always visible, persistent */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search materials — item, supplier, job…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 13, minWidth: 0, fontFamily: "inherit" }}
          />
          {search && (
            <button onClick={() => setSearch("")} aria-label="Clear search" style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: 0, flexShrink: 0 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
          )}
        </div>

        {/* Status chips */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
          {CHIPS.map(chip => {
            const n = counts[chip.id];
            const active = activeFilter === chip.id;
            const muted  = !active && chip.id !== "all" && n === 0;
            const urgentLive = chip.urgent && n > 0;
            const accent = urgentLive ? C.red : C.text;
            return (
              <button
                key={chip.id}
                onClick={() => setActiveFilter(chip.id)}
                disabled={muted}
                style={{
                  flexShrink: 0,
                  padding: "6px 11px",
                  borderRadius: 16,
                  border: `1px solid ${active ? accent : C.border}`,
                  background: active ? (urgentLive ? C.red + "22" : C.surfaceHigh) : "transparent",
                  color: active ? accent : (urgentLive ? C.red : C.muted),
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  fontFamily: "'DM Mono', monospace",
                  cursor: muted ? "default" : "pointer",
                  opacity: muted ? 0.4 : 1,
                  whiteSpace: "nowrap",
                  transition: "background 0.15s, border-color 0.15s, color 0.15s",
                }}
              >
                {chip.label}{n > 0 && <span style={{ marginLeft: 5, fontWeight: 700 }}>{n}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {jobList.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => setFilterJob("all")} style={S.pill(C.amber, filterJob === "all")}>All Jobs</button>
          {jobList.map(j => <button key={j} onClick={() => setFilterJob(j)} style={S.pill(C.amber, filterJob === j)}>{j}</button>)}
        </div>
      )}

      {/* List header strip — count/cost + sort affordance */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingLeft: 2, paddingRight: 2 }}>
        <div style={{ fontSize: 11, color: C.muted, fontFamily: "'DM Mono', monospace", letterSpacing: "0.04em" }}>
          {sortedMaterials.length} material{sortedMaterials.length !== 1 ? "s" : ""}
          {filteredCost > 0 && <> · <span style={{ color: C.text }}>£{filteredCost.toFixed(2)}</span></>}
        </div>
        <button
          onClick={nextSort}
          aria-label="Change sort"
          style={{
            background: "none", border: "none",
            color: C.muted, fontSize: 11,
            fontFamily: "'DM Mono', monospace", letterSpacing: "0.04em",
            cursor: "pointer", padding: "2px 4px",
          }}
        >
          {SORT_LABELS[sortMode]} ↕
        </button>
      </div>

      {/* Unified grouped list — each MaterialRow is its own card, no wrapper */}
      {(materials || []).length === 0 && (
        <div style={{ ...S.card, textAlign: "center", padding: 32 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📦</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>No materials yet — tap + Add above, scan a receipt, or ask Trade PA.</div>
          <button style={S.btn("primary")} onClick={() => setShowAdd(true)}>+ Add Material</button>
        </div>
      )}
      {(materials || []).length > 0 && sortedMaterials.length === 0 && (
        <div style={{ ...S.card, textAlign: "center", padding: 22 }}>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>
            No materials match {_q ? <>&ldquo;{search}&rdquo;</> : `"${CHIPS.find(c => c.id === activeFilter)?.label || activeFilter}"`}{filterJob !== "all" ? ` in ${filterJob}` : ""}.
          </div>
          <button style={{ ...S.btn("ghost"), fontSize: 12 }} onClick={() => { setSearch(""); setActiveFilter("all"); setFilterJob("all"); }}>Clear filters</button>
        </div>
      )}
      {groupedMaterials.map(group => (
        <React.Fragment key={group.key}>
          {group.label && (
            <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: C.muted, letterSpacing: "0.14em", fontWeight: 700, paddingLeft: 2, paddingTop: 4 }}>
              {group.label} · {group.items.length}
            </div>
          )}
          {group.items.map(m => {
            const i = (materials || []).indexOf(m);
            return (
              <MaterialRow key={i} m={m} i={i}
                cycleStatus={cycleStatus}
                setEditingMaterial={setEditingMaterial}
                deleteMaterial={deleteMaterial}
                markPaid={markPaid}
                userId={user?.id}
                onAssignJob={(idx) => setAssigningMaterialIdx(idx)}
              />
            );
          })}
        </React.Fragment>
      ))}

      {/* Material edit modal */}
      {editingMaterial && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }} onClick={() => setEditingMaterial(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.card, maxWidth: 480, width: "100%", marginBottom: 16, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 14, borderBottom: `1px solid ${C.border}`, marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Edit Material</div>
              <button aria-label="Close" onClick={() => setEditingMaterial(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><label style={S.label}>Item Description</label><input style={S.input} value={editingMaterial.item} onChange={e => setEditingMaterial(m => ({ ...m, item: e.target.value }))} placeholder="e.g. 22mm copper pipe" /></div>
              <div style={S.grid2}>
                <div><label style={S.label}>Qty</label><input style={S.input} type="number" min="1" value={editingMaterial.qty} onChange={e => setEditingMaterial(m => ({ ...m, qty: e.target.value }))} /></div>
                <div><label style={S.label}>Unit Price ex. VAT (£)</label><input style={S.input} type="number" min="0" step="0.01" value={editingMaterial.unitPrice} onChange={e => setEditingMaterial(m => ({ ...m, unitPrice: e.target.value }))} placeholder="0.00" /></div>
              </div>
              <div style={S.grid2}>
                <div>
                  <label style={S.label}>VAT</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[["none", "No VAT"], ["20", "20%"], ["5", "5%"]].map(([v, l]) => (
                      <button key={v} onClick={() => setEditingMaterial(m => ({ ...m, vatRate: v === "none" ? null : parseInt(v), vatEnabled: v !== "none" }))}
                        style={S.pill(C.amber, (v === "none" && !editingMaterial.vatEnabled) || String(editingMaterial.vatRate) === v)}>{l}</button>
                    ))}
                  </div>
                </div>
                <div><label style={S.label}>Due Date</label><input style={S.input} type="date" value={editingMaterial.dueDate || ""} onChange={e => setEditingMaterial(m => ({ ...m, dueDate: e.target.value }))} /></div>
              </div>
              {editingMaterial.vatEnabled && editingMaterial.unitPrice > 0 && (
                <div style={{ fontSize: 11, color: C.amber, background: C.amber + "11", borderRadius: 10, padding: "6px 10px" }}>
                  Total inc. VAT: £{(parseFloat(editingMaterial.unitPrice || 0) * parseFloat(editingMaterial.qty || 1) * (1 + (editingMaterial.vatRate || 20) / 100)).toFixed(2)}
                </div>
              )}
              <div><label style={S.label}>Supplier</label><input style={S.input} value={editingMaterial.supplier} onChange={e => setEditingMaterial(m => ({ ...m, supplier: e.target.value }))} placeholder="e.g. Screwfix" /></div>
              <div><label style={S.label}>Job Reference</label><input style={S.input} value={editingMaterial.job} onChange={e => setEditingMaterial(m => ({ ...m, job: e.target.value }))} placeholder="e.g. Kitchen refurb" /></div>
              <div>
                <label style={S.label}>Status</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[["to_order", "To Order"], ["ordered", "Ordered"], ["collected", "Collected"]].map(([v, l]) => (
                    <button key={v} onClick={() => setEditingMaterial(m => ({ ...m, status: v }))} style={S.pill(C.amber, editingMaterial.status === v)}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button style={{ ...S.btn("primary"), flex: 1, justifyContent: "center" }} onClick={() => {
                const { index, ...fields } = editingMaterial;
                setMaterials(prev => (prev || []).map((m, j) => j === index ? { ...m, item: fields.item, qty: parseInt(fields.qty) || 1, unitPrice: parseFloat(fields.unitPrice) || 0, supplier: fields.supplier, job: fields.job, status: fields.status, vatEnabled: fields.vatEnabled || false, vatRate: fields.vatRate || null, dueDate: fields.dueDate || null } : m));
                setEditingMaterial(null);
              }}>Save Changes</button>
              <button style={S.btn("ghost")} onClick={() => setEditingMaterial(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
          <div style={S.sectionTitle}>Supplier Quick Dial</div>
          <button style={{ ...S.btn("ghost"), fontSize: 11 }} onClick={() => setShowSuppliers(true)}>+ Add Supplier</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          {suppliers.map((sup, i) => (
            <div key={i} style={{ padding: "12px 14px", background: C.surfaceHigh, borderRadius: 8, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{sup.name}</div>
              {sup.notes && <div style={{ fontSize: 10, color: C.muted, marginBottom: 8 }}>{sup.notes}</div>}
              {sup.phone ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <button onClick={() => dial(sup.phone)} style={{ ...S.btn("primary"), fontSize: 11, padding: "5px 12px" }}>📞 {sup.phone}</button>
                  {sup.email && <a href={`mailto:${sup.email}`} style={{ ...S.btn("ghost"), fontSize: 11, padding: "5px 12px", textDecoration: "none", textAlign: "center" }}>✉ Email</a>}
                </div>
              ) : (
                <button onClick={() => { setEditingSupplier(i); setSupplierForm(sup); setShowSuppliers(true); }} style={{ ...S.btn("ghost"), fontSize: 11, padding: "5px 10px", width: "100%" }}>Add number</button>
              )}
            </div>
          ))}
        </div>
      </div>

      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }} onClick={() => { setShowAdd(false); setRows([emptyRow()]); }}>
          <div style={{ ...S.card, maxWidth: 700, width: "100%", marginBottom: 16, borderRadius: 14, overflow: "hidden" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 14, borderBottom: `1px solid ${C.border}`, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Add Materials</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Add multiple items at once — one row per material</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <VoiceFillButton
                  form={{ item: "", qty: 1, unitPrice: "", job: "", supplier: "" }}
                  setForm={updates => {
                    setRows(prev => {
                      const lastEmpty = prev.findIndex(r => !r.item);
                      if (lastEmpty >= 0) {
                        const next = [...prev];
                        next[lastEmpty] = { ...next[lastEmpty], ...updates };
                        return next;
                      }
                      return [...prev, { ...emptyRow(), ...updates }];
                    });
                  }}
                  fieldDescriptions="item (material name e.g. Copper pipe 22mm), qty (quantity as number), unitPrice (unit price in £ as number), job (job name if mentioned), supplier (supplier name if mentioned)"
                />
                <button aria-label="Close" onClick={() => { setShowAdd(false); setRows([emptyRow()]); }} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: 560 }}>
                <div style={{ display: "grid", gridTemplateColumns: "3fr 50px 70px 70px 2fr 2fr 90px 24px", gap: 6, marginBottom: 6 }}>
                  {["Item", "Qty", "Unit £", "VAT", "Job", "Supplier", "Status", ""].map(h => (
                    <div key={h} style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</div>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  {rows.map((row, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "3fr 50px 70px 70px 2fr 2fr 90px 24px", gap: 6, alignItems: "center" }}>
                      <input style={{ ...S.input, fontSize: 12 }} placeholder="e.g. Copper pipe 22mm" value={row.item} onChange={e => updateRow(i, "item", e.target.value)} />
                      <input style={{ ...S.input, fontSize: 12 }} type="number" min="1" value={row.qty} onChange={e => updateRow(i, "qty", e.target.value)} />
                      <input style={{ ...S.input, fontSize: 12 }} type="number" placeholder="0.00" value={row.unitPrice} onChange={e => updateRow(i, "unitPrice", e.target.value)} />
                      <select style={{ ...S.input, fontSize: 11 }} value={row.vatEnabled ? String(row.vatRate || 20) : "none"} onChange={e => {
                        const v = e.target.value;
                        setRows(prev => prev.map((r, j) => j === i ? { ...r, vatEnabled: v !== "none", vatRate: v === "none" ? null : parseInt(v) } : r));
                      }}>
                        <option value="none">No VAT</option>
                        <option value="20">20%</option>
                        <option value="5">5%</option>
                      </select>
                      <input style={{ ...S.input, fontSize: 12 }} placeholder="Job name" value={row.job} onChange={e => updateRow(i, "job", e.target.value)} />
                      <select style={{ ...S.input, fontSize: 11 }} value={row.supplier} onChange={e => updateRow(i, "supplier", e.target.value)}>
                        <option value="">Supplier...</option>
                        {suppliers.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                        <option value="other">Other</option>
                      </select>
                      <select style={{ ...S.input, fontSize: 11 }} value={row.status} onChange={e => updateRow(i, "status", e.target.value)}>
                        <option value="to_order">To Order</option>
                        <option value="ordered">Ordered</option>
                        <option value="collected">Collected</option>
                      </select>
                      <button onClick={() => removeRow(i)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }} disabled={rows.length === 1}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button onClick={addRow} style={{ ...S.btn("ghost"), fontSize: 12 }}>+ Add Row</button>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {rows.some(r => r.unitPrice > 0) && (
                  <div style={{ fontSize: 11, color: C.muted }}>
                    Total: £{rows.reduce((s, r) => s + (parseFloat(r.unitPrice) || 0) * (parseInt(r.qty) || 1), 0).toFixed(2)}
                  </div>
                )}
                <button style={S.btn("primary", !rows.some(r => r.item.trim()))} disabled={!rows.some(r => r.item.trim())} onClick={saveAll}>
                  Save {rows.filter(r => r.item.trim()).length} Item{rows.filter(r => r.item.trim()).length !== 1 ? "s" : ""} →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSuppliers && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }}>
          <div style={{ ...S.card, maxWidth: 520, width: "100%", marginBottom: 16, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 14, borderBottom: `1px solid ${C.border}`, marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Manage Suppliers</div>
              <button aria-label="Close" onClick={() => { setShowSuppliers(false); setEditingSupplier(null); setSupplierForm({ name: "", phone: "", notes: "" }); }} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {suppliers.map((sup, i) => (
                <div key={i} style={{ ...S.card, padding: "12px 14px", background: editingSupplier === i ? C.amber + "11" : C.surfaceHigh, borderColor: editingSupplier === i ? C.amber + "66" : C.border }}>
                  {editingSupplier === i ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {[{ k: "name", l: "Name", p: "City Plumbing" }, { k: "phone", l: "Phone", p: "01483 123456" }, { k: "email", l: "Email", p: "orders@cityplumbing.co.uk" }, { k: "notes", l: "Notes", p: "Main plumbing supplies" }].map(({ k, l, p }) => (
                        <div key={k}><label style={S.label}>{l}</label><input style={S.input} placeholder={p} value={supplierForm[k] || ""} onChange={e => setSupplierForm(f => ({ ...f, [k]: e.target.value }))} /></div>
                      ))}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button style={S.btn("primary", !supplierForm.name)} disabled={!supplierForm.name} onClick={saveSupplier}>Save</button>
                        <button style={S.btn("ghost")} onClick={() => { setEditingSupplier(null); setSupplierForm({ name: "", phone: "", notes: "" }); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{sup.name}</div>
                        <div style={{ fontSize: 11, color: sup.phone ? C.amber : C.muted }}>{sup.phone || "No phone number"}</div>
                        {sup.email && <div style={{ fontSize: 11, color: C.blue }}>{sup.email}</div>}
                        {sup.notes && <div style={{ fontSize: 11, color: C.muted }}>{sup.notes}</div>}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        {sup.phone && <button onClick={() => dial(sup.phone)} style={{ ...S.btn("primary"), fontSize: 11, padding: "5px 12px" }}>📞 Call</button>}
                        {sup.email && <a href={`mailto:${sup.email}`} style={{ ...S.btn("ghost"), fontSize: 11, padding: "5px 10px", textDecoration: "none" }}>✉</a>}
                      </div>
                      <button onClick={() => { setEditingSupplier(i); setSupplierForm(sup); }} style={{ ...S.btn("ghost"), fontSize: 11, padding: "5px 10px" }}>Edit</button>
                      <button onClick={() => deleteSupplier(i)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {editingSupplier === null && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 12 }}>Add New Supplier</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[{ k: "name", l: "Name", p: "National Plumbing Supplies" }, { k: "phone", l: "Phone", p: "01234 567890" }, { k: "email", l: "Email", p: "orders@supplier.co.uk" }, { k: "notes", l: "Notes", p: "Good for copper fittings" }].map(({ k, l, p }) => (
                    <div key={k}><label style={S.label}>{l}</label><input style={S.input} placeholder={p} value={supplierForm[k] || ""} onChange={e => setSupplierForm(f => ({ ...f, [k]: e.target.value }))} /></div>
                  ))}
                  <button style={S.btn("primary", !supplierForm.name)} disabled={!supplierForm.name} onClick={saveSupplier}>Add Supplier →</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Assign material to job modal */}
      {assigningMaterialIdx !== null && (
        <AssignToJobModal
          user={user}
          currentJobId={(materials || [])[assigningMaterialIdx]?.job_id}
          onAssign={handleAssignMaterialToJob}
          onClose={() => setAssigningMaterialIdx(null)}
        />
      )}
    </div>
  );
}
