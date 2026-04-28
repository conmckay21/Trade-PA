import React, { useState, useEffect } from "react";
import { C } from "../theme/colors.js";
import { S } from "../theme/styles.js";
import { db } from "../lib/db.js";

// ─── ASSIGN TO JOB MODAL ─────────────────────────────────────────────────────
export function AssignToJobModal({ user, onAssign, onClose, currentJobId }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    db.from("job_cards").select("id,title,type,customer,status").eq("user_id", user.id)
      .order("created_at", { ascending: false }).then(({ data }) => { setJobs(data || []); setLoading(false); });
  }, [user?.id]);

  const filtered = jobs.filter(j =>
    !search || j.customer?.toLowerCase().includes(search.toLowerCase()) ||
    j.title?.toLowerCase().includes(search.toLowerCase()) ||
    j.type?.toLowerCase().includes(search.toLowerCase())
  );

  const statusColor = { completed: C.green, in_progress: C.blue, accepted: C.amber, quoted: C.muted, enquiry: C.muted };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 400, padding: 16, paddingTop: "max(52px,env(safe-area-inset-top,52px))", overflowY: "auto" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ ...S.card, maxWidth: 480, width: "100%", marginBottom: 16, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Assign to Job</div>
          <button aria-label="Close" onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>
        <input style={{ ...S.input, marginBottom: 12 }} placeholder="Search jobs..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        {loading ? <div style={{ fontSize: 12, color: C.muted, padding: 16, textAlign: "center" }}>Loading jobs...</div> :
          filtered.length === 0 ? <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic", textAlign: "center", padding: 16 }}>No jobs found</div> :
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 360, overflowY: "auto" }}>
            {currentJobId && (
              <div onClick={() => onAssign(null, null)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.red}44`, background: C.red + "0a", cursor: "pointer" }}>
                <div style={{ fontSize: 12, color: C.red }}>✕ Remove job link</div>
              </div>
            )}
            {filtered.map(j => (
              <div key={j.id} onClick={() => onAssign(j.id, j.title || j.type || j.customer)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, border: `2px solid ${j.id === currentJobId ? C.amber : C.border}`, background: j.id === currentJobId ? C.amber + "0a" : C.surfaceHigh, cursor: "pointer" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{j.customer}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{j.title || j.type || "Job"}</div>
                </div>
                <div style={{ ...S.badge(statusColor[j.status] || C.muted), flexShrink: 0 }}>{j.status}</div>
                {j.id === currentJobId && <div style={{ fontSize: 11, color: C.amber }}>✓ Linked</div>}
              </div>
            ))}
          </div>
        }
      </div>
    </div>
  );
}
