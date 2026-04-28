// ─── Documents Tab ──────────────────────────────────────────────────────
// Extracted verbatim from App.jsx during P7 sub-batch A (28 Apr 2026).
import React, { useState, useEffect, useRef } from "react";
import { db } from "../lib/db.js";
import { C } from "../theme/colors.js";
import { S } from "../theme/styles.js";

export function DocumentsTab({ user, customers, setContextHint }) {
  const [docs, setDocs] = useState([]);
  const [jobCards, setJobCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!setContextHint) return;
    setContextHint(`Documents: ${docs.length} files`);
    return () => { if (setContextHint) setContextHint(null); };
  }, [docs, setContextHint]);
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState("recent"); // recent | name | size
  const fileRef = useRef();

  const CATEGORIES = ["Insurance", "Certifications", "Risk Assessments", "COSHH", "Job Documents", "Customer Documents", "Contracts", "Other"];

  useEffect(() => { if (user?.id) load(); }, [user?.id]);

  const load = async () => {
    setLoading(true);
    const [{ data: d }, { data: j }] = await Promise.all([
      db.from("documents").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      db.from("job_cards").select("id,title,type,customer").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    setDocs(d || []);
    setJobCards(j || []);
    setLoading(false);
  };

  const upload = async (file, category, linkedJob, linkedCustomer) => {
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
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

  const del = async (doc) => {
    if (!confirm(`Delete "${doc.name}"?`)) return;
    await db.storage.from("documents").remove([doc.storage_path]);
    await db.from("documents").delete().eq("id", doc.id).eq("user_id", user.id);
    setDocs(p => p.filter(d => d.id !== doc.id));
  };

  const openDoc = (doc) => { if (doc.public_url) window.open(doc.public_url, "_blank"); };

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

  const filtered = docs.filter(d =>
    (filter === "all" || d.category === filter) &&
    (!search || d.name?.toLowerCase().includes(search.toLowerCase()))
  ).sort((a, b) => {
    if (sortMode === "name") return (a.name || "").localeCompare(b.name || "");
    if (sortMode === "size") return (b.file_size || 0) - (a.file_size || 0);
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });
  const nextSort = () => setSortMode(m => m === "recent" ? "name" : m === "name" ? "size" : "recent");
  const sortLabel = sortMode === "recent" ? "Recent" : sortMode === "name" ? "Name" : "Size";

  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ category: "Other", job_id: "", customer_id: "" });
  const [pendingFile, setPendingFile] = useState(null);

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
        {[["Total Files", docs.length, C.text], ["Storage Used", fmtSize(docs.reduce((s,d) => s+(d.file_size||0),0)), C.muted]].map(([l,v,col],i) => (
          <div key={i} style={{ background: C.surfaceHigh, borderRadius: 10, padding: "14px 16px", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{l}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: col }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Search + filter + sort */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input style={{ ...S.input, flex: 1, minWidth: 180 }} placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)} />
        <select style={{ ...S.input, width: "auto" }} value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={nextSort} style={{
          padding: "6px 12px", borderRadius: 16,
          fontSize: 12, fontWeight: 600, background: "transparent",
          color: C.muted, border: `1px solid ${C.border}`, cursor: "pointer",
          whiteSpace: "nowrap",
        }}>↕ {sortLabel}</button>
      </div>

      {/* Category sections */}
      {loading ? <div style={{ fontSize: 12, color: C.muted, padding: 16 }}>Loading...</div> :
        docs.length === 0 ? <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic", textAlign: "center", padding: 32 }}>No documents uploaded yet — tap ⬆ Upload to add your first.</div> :
        filtered.length === 0 ? <div style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: 24 }}>{search ? `No documents match "${search}".` : `No documents in ${filter}.`}</div> :
        filtered.map(doc => (
          <div key={doc.id} style={{ background: C.surfaceHigh, borderRadius: 10, padding: "12px 14px", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 28, flexShrink: 0 }}>{fileIcon(doc.type)}</div>
            <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => openDoc(doc)}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.name}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                {doc.category}{doc.file_size ? ` · ${fmtSize(doc.file_size)}` : ""}
                {" · "}{new Date(doc.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </div>
            </div>
            <button onClick={() => openDoc(doc)} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px", flexShrink: 0 }}>Open</button>
            <button onClick={() => del(doc)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: "0 4px", flexShrink: 0 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
          </div>
        ))
      }

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
// ─── CUSTOMER REVIEWS ────────────────────────────────────────────────────────
