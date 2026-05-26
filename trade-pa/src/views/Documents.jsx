// ─── Documents Tab ──────────────────────────────────────────────────────
// Unified paperwork view: uploaded files + certificates + compliance docs
// + RAMS + worker documents. Sorted by date, filterable by source type.
//
// Each row shows its origin via icon + label badge. Tap actions vary:
//   files       → open public URL in new tab (existing)
//   cert        → modal rendering html_content in an iframe (no nav)
//   compliance / worker / rams → metadata details modal
//
// Upload UI still writes to the `documents` table only — file uploads are
// intrinsically tied to that storage bucket. Cert/compliance/etc. creation
// and editing remain in their original views (Certificates inside Jobs,
// RAMS in the RAMS view, Worker Docs in Subcontractors).
//
// Module-scope helpers (CATEGORIES, fileIcon, fmtSize, fmtDate) are now
// shared between the main component and the MetaFields helper.
import React, { useState, useEffect, useRef } from "react";
import { db } from "../lib/db.js";
import { C } from "../theme/colors.js";
import { S } from "../theme/styles.js";
import EmptyState from "../components/EmptyState.jsx";

const SOURCES = {
  all:        { label: "All",          icon: "📚" },
  files:      { label: "Files",        icon: "📄" },
  cert:       { label: "Certificates", icon: "📜" },
  compliance: { label: "Compliance",   icon: "🛡" },
  rams:       { label: "RAMS",         icon: "⚠️" },
  worker:     { label: "Worker Docs",  icon: "👷" },
};

const CATEGORIES = ["Insurance", "Certifications", "Risk Assessments", "COSHH", "Job Documents", "Customer Documents", "Contracts", "Other"];

const fileIcon = (type) => {
  if (!type) return "📄";
  if (type.includes("pdf")) return "📋";
  if (type.includes("image")) return "🖼";
  if (type.includes("word") || type.includes("document")) return "📝";
  if (type.includes("sheet") || type.includes("excel")) return "📊";
  return "📄";
};

const fmtSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
};

const fmtDate = (ts) => {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch { return ""; }
};

export function DocumentsTab({ user, customers, setContextHint }) {
  // Data sources — five tables, loaded in parallel
  const [docs, setDocs] = useState([]);
  const [certs, setCerts] = useState([]);
  const [compDocs, setCompDocs] = useState([]);
  const [ramsDocs, setRamsDocs] = useState([]);
  const [workerDocs, setWorkerDocs] = useState([]);
  const [jobCards, setJobCards] = useState([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState("recent"); // recent | name | size

  // Modals
  const [viewCert, setViewCert] = useState(null);     // cert HTML viewer
  const [viewMeta, setViewMeta] = useState(null);     // compliance/worker/rams details
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ category: "Other", job_id: "", customer_id: "" });
  const [pendingFile, setPendingFile] = useState(null);

  const fileRef = useRef();

  // Reset category filter when leaving the Files view (categories only apply there)
  useEffect(() => { if (sourceFilter !== "files") setCategoryFilter("all"); }, [sourceFilter]);

  useEffect(() => { if (user?.id) load(); }, [user?.id]);

  const load = async () => {
    setLoading(true);
    const u = user.id;
    const [r1, r2, r3, r4, r5, r6] = await Promise.all([
      db.from("documents").select("*").eq("user_id", u).is("deleted_at", null).order("created_at", { ascending: false }),
      db.from("trade_certificates").select("*").eq("user_id", u).is("deleted_at", null).order("created_at", { ascending: false }),
      db.from("compliance_docs").select("*").eq("user_id", u).is("deleted_at", null).order("created_at", { ascending: false }),
      db.from("rams_documents").select("*").eq("user_id", u).is("deleted_at", null).order("created_at", { ascending: false }),
      db.from("worker_documents").select("*").eq("user_id", u).is("deleted_at", null).order("created_at", { ascending: false }),
      db.from("job_cards").select("id,title,type,customer").eq("user_id", u).order("created_at", { ascending: false }),
    ]);
    setDocs(r1.data || []);
    setCerts(r2.data || []);
    setCompDocs(r3.data || []);
    setRamsDocs(r4.data || []);
    setWorkerDocs(r5.data || []);
    setJobCards(r6.data || []);
    setLoading(false);
  };

  // Normalize each source row into a common shape for unified rendering.
  // `raw` keeps the original row so source-specific actions can drill in.
  const items = [
    ...docs.map(d => ({
      key: `f:${d.id}`, source: "files", raw: d,
      name: d.name || "Untitled file",
      sublabel: [d.category, d.file_size ? fmtSize(d.file_size) : "", fmtDate(d.created_at)].filter(Boolean).join(" · "),
      icon: fileIcon(d.type),
      category: d.category,
      createdAt: d.created_at,
      sortName: (d.name || "").toLowerCase(),
      sortSize: d.file_size || 0,
    })),
    ...certs.map(c => {
      const cd = c.cert_data || {};
      return {
        key: `c:${c.id}`, source: "cert", raw: c,
        name: c.cert_label || c.cert_type || "Certificate",
        sublabel: [cd.client || cd.customer, cd.site || cd.address, fmtDate(c.created_at)].filter(Boolean).join(" · "),
        icon: "📜",
        createdAt: c.created_at,
        sortName: (c.cert_label || "").toLowerCase(),
        sortSize: 0,
      };
    }),
    ...compDocs.map(c => ({
      key: `comp:${c.id}`, source: "compliance", raw: c,
      name: c.doc_type || "Compliance document",
      sublabel: [
        c.doc_number ? `#${c.doc_number}` : "",
        c.expiry_date ? `Expires ${fmtDate(c.expiry_date)}` : "",
        fmtDate(c.created_at),
      ].filter(Boolean).join(" · "),
      icon: "🛡",
      createdAt: c.created_at,
      sortName: (c.doc_type || "").toLowerCase(),
      sortSize: 0,
    })),
    ...ramsDocs.map(r => ({
      key: `r:${r.id}`, source: "rams", raw: r,
      name: r.title || "RAMS document",
      sublabel: [r.client_name, r.site_address, fmtDate(r.date || r.created_at)].filter(Boolean).join(" · "),
      icon: "⚠️",
      createdAt: r.created_at,
      sortName: (r.title || "").toLowerCase(),
      sortSize: 0,
    })),
    ...workerDocs.map(w => ({
      key: `w:${w.id}`, source: "worker", raw: w,
      name: w.doc_type || "Worker document",
      sublabel: [
        w.doc_number ? `#${w.doc_number}` : "",
        w.expiry_date ? `Expires ${fmtDate(w.expiry_date)}` : "",
        fmtDate(w.created_at),
      ].filter(Boolean).join(" · "),
      icon: "👷",
      createdAt: w.created_at,
      sortName: (w.doc_type || "").toLowerCase(),
      sortSize: 0,
    })),
  ];

  // Context hint reflects total items shown
  useEffect(() => {
    if (!setContextHint) return;
    setContextHint(`Documents: ${items.length} items`);
    return () => { if (setContextHint) setContextHint(null); };
  }, [items.length, setContextHint]);

  // Filter + sort across the unified list
  const filtered = items.filter(item => {
    if (sourceFilter !== "all" && item.source !== sourceFilter) return false;
    if (sourceFilter === "files" && categoryFilter !== "all" && item.category !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!item.name.toLowerCase().includes(q) && !(item.sublabel || "").toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a, b) => {
    if (sortMode === "name") return a.sortName.localeCompare(b.sortName);
    if (sortMode === "size") return b.sortSize - a.sortSize;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  const nextSort = () => setSortMode(m => m === "recent" ? "name" : m === "name" ? "size" : "recent");
  const sortLabel = sortMode === "recent" ? "Recent" : sortMode === "name" ? "Name" : "Size";

  const openItem = (item) => {
    if (item.source === "files") {
      if (item.raw.public_url) window.open(item.raw.public_url, "_blank");
      return;
    }
    if (item.source === "cert") {
      setViewCert(item.raw);
      return;
    }
    // compliance / worker / rams: show metadata modal
    setViewMeta(item);
  };

  const upload = async (file, category, linkedJob, linkedCustomer) => {
    if (!file) return;
    setUploading(true);
    try {
      const path = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: uploadError } = await db.storage.from("documents").upload(path, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = db.storage.from("documents").getPublicUrl(path);
      const { data, error } = await db.from("documents").insert({
        user_id: user.id, name: file.name, type: file.type, category: category || "Other",
        job_id: linkedJob || null, customer_id: linkedCustomer || null,
        storage_path: path, file_size: file.size, public_url: publicUrl,
        created_at: new Date().toISOString(),
      }).select().single();
      if (!error && data) setDocs(p => [data, ...p]);
    } catch (e) { alert("Upload failed: " + e.message); }
    setUploading(false);
  };

  const delDoc = async (doc) => {
    if (!confirm(`Delete "${doc.name}"?`)) return;
    await db.storage.from("documents").remove([doc.storage_path]);
    await db.from("documents").delete().eq("id", doc.id).eq("user_id", user.id);
    setDocs(p => p.filter(d => d.id !== doc.id));
  };

  const totalFiles = docs.length;
  const totalStorage = fmtSize(docs.reduce((s, d) => s + (d.file_size || 0), 0));
  const totalAll = items.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 80 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Documents</div>
        <button onClick={() => fileRef.current?.click()} style={S.btn("primary")} disabled={uploading}>
          {uploading ? "Uploading..." : "⬆ Upload"}
        </button>
        <input ref={fileRef} type="file" accept="*/*" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) { setPendingFile(e.target.files[0]); setShowUpload(true); } e.target.value = ""; }} />
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
        {[
          ["Total Items", totalAll, C.text],
          ["Files", totalFiles, C.muted],
          ["Storage Used", totalStorage, C.muted],
        ].map(([l, v, col], i) => (
          <div key={i} style={{ background: C.surfaceHigh, borderRadius: 10, padding: "14px 16px", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{l}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: col }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Source filter chips */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {Object.entries(SOURCES).map(([key, meta]) => {
          const active = sourceFilter === key;
          return (
            <button
              key={key}
              onClick={() => setSourceFilter(key)}
              style={{
                padding: "6px 12px",
                borderRadius: 16,
                fontSize: 12,
                fontWeight: 600,
                background: active ? C.text : "transparent",
                color: active ? C.surfaceHigh : C.muted,
                border: `1px solid ${active ? C.text : C.border}`,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {meta.icon} {meta.label}
            </button>
          );
        })}
      </div>

      {/* Search + (Files category) + sort */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input style={{ ...S.input, flex: 1, minWidth: 180 }} placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)} />
        {sourceFilter === "files" && (
          <select style={{ ...S.input, width: "auto" }} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="all">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <button onClick={nextSort} style={{
          padding: "6px 12px", borderRadius: 16,
          fontSize: 12, fontWeight: 600, background: "transparent",
          color: C.muted, border: `1px solid ${C.border}`, cursor: "pointer",
          whiteSpace: "nowrap",
        }}>↕ {sortLabel}</button>
      </div>

      {/* List */}
      {loading ? <div style={{ fontSize: 12, color: C.muted, padding: 16 }}>Loading...</div> :
        items.length === 0 ? <EmptyState
          icon="documents"
          title="No documents stored"
          body="Insurance, qualifications, contracts, manuals — one place, sharable with a tap."
          ctaLabel="⬆ Upload document"
          onCta={() => fileRef.current?.click()}
          voiceTip={'Or just drop a file on this screen'}
        /> :
        filtered.length === 0 ? <div style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: 24 }}>{search ? `No documents match "${search}".` : `Nothing in ${SOURCES[sourceFilter]?.label || sourceFilter}.`}</div> :
        filtered.map(item => (
          <div key={item.key} style={{ background: C.surfaceHigh, borderRadius: 10, padding: "12px 14px", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 28, flexShrink: 0 }}>{item.icon}</div>
            <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => openItem(item)}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                {item.source !== "files" && (
                  <span style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", border: `1px solid ${C.border}`, padding: "1px 6px", borderRadius: 4, flexShrink: 0 }}>
                    {SOURCES[item.source].label}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>{item.sublabel}</div>
            </div>
            <button onClick={() => openItem(item)} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px", flexShrink: 0 }}>View</button>
            {item.source === "files" && (
              <button onClick={() => delDoc(item.raw)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: "0 4px", flexShrink: 0 }} aria-label="Delete">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            )}
          </div>
        ))
      }

      {/* Certificate viewer modal (renders html_content via iframe srcDoc) */}
      {viewCert && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "stretch", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(20px,env(safe-area-inset-top,20px))" }} onClick={() => setViewCert(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.card, maxWidth: 900, width: "100%", display: "flex", flexDirection: "column", borderRadius: 14, overflow: "hidden", padding: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{viewCert.cert_label || viewCert.cert_type || "Certificate"}</div>
              <button aria-label="Close" onClick={() => setViewCert(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            {viewCert.html_content ? (
              <iframe
                title="Certificate"
                srcDoc={viewCert.html_content}
                style={{ flex: 1, width: "100%", border: "none", background: "#fff", minHeight: 400 }}
              />
            ) : (
              <div style={{ padding: 32, textAlign: "center", color: C.muted, fontSize: 13 }}>
                This certificate has no rendered content yet. Open the related job to sign and complete it.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Metadata details modal — compliance / worker / RAMS */}
      {viewMeta && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px,env(safe-area-inset-top,52px))", overflowY: "auto" }} onClick={() => setViewMeta(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.card, maxWidth: 480, width: "100%", marginBottom: 16, borderRadius: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 14, borderBottom: `1px solid ${C.border}`, marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{viewMeta.name}</div>
              <button aria-label="Close" onClick={() => setViewMeta(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
              {SOURCES[viewMeta.source].icon} {SOURCES[viewMeta.source].label}
            </div>
            <MetaFields item={viewMeta} />
            <div style={{ marginTop: 16, padding: 12, background: C.surfaceHigh, borderRadius: 8, fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
              To edit or delete this {SOURCES[viewMeta.source].label.toLowerCase().replace(/s$/, "")}, open it from its original section in the app.
            </div>
          </div>
        </div>
      )}

      {/* Upload modal */}
      {showUpload && pendingFile && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px,env(safe-area-inset-top,52px))", overflowY: "auto" }} onClick={() => { setShowUpload(false); setPendingFile(null); }}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.card, maxWidth: 480, width: "100%", marginBottom: 16, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 14, borderBottom: `1px solid ${C.border}`, marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Upload Document</div>
              <button aria-label="Close" onClick={() => { setShowUpload(false); setPendingFile(null); }} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: C.surfaceHigh, borderRadius: 8, padding: "10px 12px", fontSize: 13 }}>
                📄 {pendingFile.name} <span style={{ color: C.muted, fontSize: 11 }}>({fmtSize(pendingFile.size)})</span>
              </div>
              <div>
                <label style={S.label}>Category</label>
                <select style={S.input} value={uploadForm.category} onChange={e => setUploadForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Link to Job (optional)</label>
                <select style={S.input} value={uploadForm.job_id} onChange={e => setUploadForm(f => ({ ...f, job_id: e.target.value }))}>
                  <option value="">No job link</option>
                  {jobCards.map(j => <option key={j.id} value={j.id}>{j.title || j.type} — {j.customer}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Link to Customer (optional)</label>
                <select style={S.input} value={uploadForm.customer_id} onChange={e => setUploadForm(f => ({ ...f, customer_id: e.target.value }))}>
                  <option value="">No customer link</option>
                  {(customers || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button style={{ ...S.btn("primary"), flex: 1, justifyContent: "center" }} onClick={async () => { await upload(pendingFile, uploadForm.category, uploadForm.job_id, uploadForm.customer_id); setShowUpload(false); setPendingFile(null); }}>Upload</button>
              <button style={S.btn("ghost")} onClick={() => { setShowUpload(false); setPendingFile(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MetaFields ─────────────────────────────────────────────────────────
// Renders source-specific structured fields inside the details modal for
// compliance / worker / RAMS rows. Tries the most useful fields first and
// silently skips any that are null/empty.
function MetaFields({ item }) {
  const r = item.raw;
  const rows = [];
  if (item.source === "compliance") {
    if (r.doc_type) rows.push(["Type", r.doc_type]);
    if (r.doc_number) rows.push(["Reference", r.doc_number]);
    if (r.issued_date) rows.push(["Issued", fmtDate(r.issued_date)]);
    if (r.expiry_date) rows.push(["Expires", fmtDate(r.expiry_date)]);
    if (r.notes) rows.push(["Notes", r.notes]);
  } else if (item.source === "worker") {
    if (r.doc_type) rows.push(["Type", r.doc_type]);
    if (r.doc_number) rows.push(["Reference", r.doc_number]);
    if (r.issued_date) rows.push(["Issued", fmtDate(r.issued_date)]);
    if (r.expiry_date) rows.push(["Expires", fmtDate(r.expiry_date)]);
    if (r.notes) rows.push(["Notes", r.notes]);
  } else if (item.source === "rams") {
    if (r.client_name) rows.push(["Client", r.client_name]);
    if (r.site_address) rows.push(["Site", r.site_address]);
    if (r.date) rows.push(["Date", fmtDate(r.date)]);
    if (r.prepared_by) rows.push(["Prepared by", r.prepared_by]);
    if (r.reviewed_by) rows.push(["Reviewed by", r.reviewed_by]);
    if (r.scope) rows.push(["Scope", r.scope]);
    if (r.cdm_notifiable !== null && r.cdm_notifiable !== undefined) rows.push(["CDM Notifiable", r.cdm_notifiable ? "Yes" : "No"]);
  }
  if (rows.length === 0) {
    return <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No additional details.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map(([label, value], i) => (
        <div key={i}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{String(value)}</div>
        </div>
      ))}
    </div>
  );
}
// ─── CUSTOMER REVIEWS ────────────────────────────────────────────────────────
