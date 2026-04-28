// ─── Enquiries Tab ──────────────────────────────────────────────────────
// Extracted verbatim from App.jsx during P7 sub-batch B (28 Apr 2026).
import React, { useState, useEffect } from "react";
import { C } from "../theme/colors.js";
import { S } from "../theme/styles.js";
import { newEnquiryId } from "../lib/ids.js";
import { statusColor, statusLabel } from "../lib/status.js";
import { VoiceFillButton } from "../components/VoiceFillButton.jsx";

export function EnquiriesTab({ enquiries, setEnquiries, customers, setCustomers, invoices, setInvoices, brand, user, setView, setContextHint }) {
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingEnquiry, setEditingEnquiry] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", source: "Phone", msg: "", urgent: false });
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState("recent");

  useEffect(() => {
    if (!setContextHint) return;
    const newCount = (enquiries || []).filter(e => !e.status || e.status === "new").length;
    const urgCount = (enquiries || []).filter(e => e.urgent).length;
    const bits = [`Enquiries: ${(enquiries || []).length} total`];
    if (newCount) bits.push(`${newCount} new`);
    if (urgCount) bits.push(`${urgCount} urgent`);
    setContextHint(bits.join(" · "));
    return () => { if (setContextHint) setContextHint(null); };
  }, [enquiries, setContextHint]);

  const SOURCES = ["Phone", "Email", "Website", "Referral", "Returning", "Other"];

  const filtered = (enquiries || []).filter(e => {
    if (filter === "urgent") return e.urgent;
    if (filter === "new") return !e.status || e.status === "new";
    if (filter === "contacted") return e.status === "contacted";
    if (filter === "quoted") return e.status === "quoted";
    return true;
  }).filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (e.name || "").toLowerCase().includes(q) || (e.phone || "").toLowerCase().includes(q) || (e.email || "").toLowerCase().includes(q) || (e.msg || "").toLowerCase().includes(q) || (e.address || "").toLowerCase().includes(q);
  }).sort((a, b) => {
    if (sortMode === "name") return (a.name || "").localeCompare(b.name || "");
    if (sortMode === "source") return (a.source || "").localeCompare(b.source || "");
    return (b.id || 0) - (a.id || 0); // recent first
  });
  const sortLabels = { recent: "Recent", name: "A–Z", source: "Source" };
  const nextSort = () => { const keys = Object.keys(sortLabels); setSortMode(keys[(keys.indexOf(sortMode) + 1) % keys.length]); };

  function addEnquiry() {
    if (!form.name) return;
    const enq = { ...form, id: newEnquiryId(), time: "Just now", status: "new" };
    setEnquiries(prev => [enq, ...(prev || [])]);
    setShowAdd(false);
    setForm({ name: "", phone: "", email: "", address: "", source: "Phone", msg: "", urgent: false });
  }

  function updateStatus(id, status) {
    setEnquiries(prev => (prev || []).map(e => e.id === id ? { ...e, status } : e));
    if (selected?.id === id) setSelected(s => ({ ...s, status }));
  }

  function deleteEnquiry(id) {
    setEnquiries(prev => (prev || []).filter(e => e.id !== id));
    setSelected(null);
  }

  function updateEnquiry() {
    if (!form.name) return;
    setEnquiries(prev => (prev || []).map(e => e.id === editingEnquiry.id ? { ...e, name: form.name, phone: form.phone, email: form.email, address: form.address, source: form.source, msg: form.msg, urgent: form.urgent } : e));
    setEditingEnquiry(null);
    setShowAdd(false);
    setSelected(null);
    setForm({ name: "", phone: "", email: "", address: "", source: "Phone", msg: "", urgent: false });
  }

  function openEditEnquiry(enq) {
    setForm({ name: enq.name || "", phone: enq.phone || "", email: enq.email || "", address: enq.address || "", source: enq.source || "Phone", msg: enq.msg || "", urgent: !!enq.urgent });
    setEditingEnquiry(enq);
    setShowAdd(true);
    setSelected(null);
  }

  function convertToQuote(enq) {
    // Add to customers if not already there
    const exists = (customers || []).find(c => c.name?.toLowerCase() === enq.name?.toLowerCase());
    if (!exists) {
      setCustomers(prev => [...(prev || []), { id: Date.now(), name: enq.name, email: enq.email || "", phone: enq.phone || "", address: enq.address || "", notes: `From enquiry: ${enq.msg || ""}` }]);
    }
    updateStatus(enq.id, "quoted");
    setSelected(null);
    setView("Quotes");
  }

  const statusColor = { new: C.blue, contacted: C.amber, quoted: C.purple, won: C.green, lost: C.red };
  const statusLabel = { new: "New", contacted: "Contacted", quoted: "Quoted", won: "Won", lost: "Lost" };
  const counts = { all: (enquiries || []).length, urgent: (enquiries || []).filter(e => e.urgent).length, new: (enquiries || []).filter(e => !e.status || e.status === "new").length, contacted: (enquiries || []).filter(e => e.status === "contacted").length, quoted: (enquiries || []).filter(e => e.status === "quoted").length };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Enquiries</div>
        <button style={S.btn("primary")} onClick={() => setShowAdd(true)}>+ Add Enquiry</button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px,1fr))", gap: 10 }}>
        {[
          { l: "Total", v: counts.all, c: C.text },
          { l: "New", v: counts.new, c: C.blue },
          { l: "Contacted", v: counts.contacted, c: C.amber },
          { l: "Quoted", v: counts.quoted, c: C.purple },
          { l: "Urgent", v: counts.urgent, c: C.red },
        ].map((st, i) => (
          <div key={i} style={S.card}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{st.l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: st.c }}>{st.v}</div>
          </div>
        ))}
      </div>

      {/* Search + Sort */}
      <div style={{ display: "flex", gap: 8 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search enquiries..." style={{ ...S.input, flex: 1, fontSize: 13 }} />
        <button onClick={nextSort} style={S.btn("ghost")}>{sortLabels[sortMode]} ↕</button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[["all","All"],["new","New"],["contacted","Contacted"],["quoted","Quoted"],["urgent","Urgent 🔴"]].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)} style={S.pill(C.amber, filter === v)}>{l}</button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0
        ? <div style={{ ...S.card, textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📩</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>No enquiries</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>Enquiries come in automatically from your inbox, or add one manually.</div>
            <button style={S.btn("primary")} onClick={() => setShowAdd(true)}>+ Add Enquiry</button>
          </div>
        : filtered.map(enq => (
          <div key={enq.id} onClick={() => setSelected(enq)} style={{ ...S.card, cursor: "pointer", borderLeft: `3px solid ${statusColor[enq.status || "new"]}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{enq.name}</div>
                  {enq.urgent && <div style={{ fontSize: 10, background: C.red, color: "#fff", borderRadius: 4, padding: "1px 6px", fontWeight: 700 }}>URGENT</div>}
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{enq.source}{enq.phone ? ` · ${enq.phone}` : ""}{enq.email ? ` · ${enq.email}` : ""}</div>
                {enq.msg && <div style={{ fontSize: 12, color: C.textDim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{enq.msg}</div>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0, marginLeft: 12 }}>
                <div style={S.badge(statusColor[enq.status || "new"])}>{statusLabel[enq.status || "new"]}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{enq.time}</div>
              </div>
            </div>
          </div>
        ))
      }

      {/* Add/Edit Enquiry Modal */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }}>
          <div style={{ ...S.card, maxWidth: 460, width: "100%", marginBottom: 16, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 14, borderBottom: `1px solid ${C.border}`, marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{editingEnquiry ? "Edit Enquiry" : "New Enquiry"}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <VoiceFillButton form={form} setForm={setForm} fieldDescriptions="name (full name), phone (phone number), email (email address), address (address where work is needed), msg (what they want e.g. extension quote, boiler service), source (how they got in touch: Phone/Email/Website/Referral)" />
                <button aria-label="Close" onClick={() => { setShowAdd(false); setEditingEnquiry(null); }} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { k: "name", l: "Name *", p: "e.g. Steve Johnson" },
                { k: "phone", l: "Phone", p: "e.g. 07700 900000" },
                { k: "email", l: "Email", p: "e.g. steve@email.com" },
                { k: "address", l: "Address", p: "e.g. 12 High Street, Portsmouth" },
              ].map(({ k, l, p }) => (
                <div key={k}>
                  <label style={S.label}>{l}</label>
                  <input style={S.input} placeholder={p} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label style={S.label}>Source</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {SOURCES.map(s => <button key={s} onClick={() => setForm(f => ({ ...f, source: s }))} style={S.pill(C.amber, form.source === s)}>{s}</button>)}
                </div>
              </div>
              <div>
                <label style={S.label}>What they want</label>
                <textarea style={{ ...S.input, minHeight: 72, resize: "vertical" }} placeholder="e.g. Extension quote, boiler service..." value={form.msg} onChange={e => setForm(f => ({ ...f, msg: e.target.value }))} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8, cursor: "pointer" }} onClick={() => setForm(f => ({ ...f, urgent: !f.urgent }))}>
                <div style={{ width: 36, height: 20, borderRadius: 10, background: form.urgent ? C.red : C.border, position: "relative", flexShrink: 0, transition: "all 0.2s" }}>
                  <div style={{ position: "absolute", top: 2, left: form.urgent ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "all 0.2s" }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Mark as urgent</div>
              </div>
              <button style={S.btn("primary", !form.name)} disabled={!form.name} onClick={editingEnquiry ? updateEnquiry : addEnquiry}>{editingEnquiry ? "Save Changes" : "Add Enquiry →"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }} onClick={() => setSelected(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.card, maxWidth: 460, width: "100%", marginBottom: 16, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 12, borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{selected.name}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={S.badge(statusColor[selected.status || "new"])}>{statusLabel[selected.status || "new"]}</div>
                  {selected.urgent && <div style={{ fontSize: 10, background: C.red, color: "#fff", borderRadius: 4, padding: "1px 6px", fontWeight: 700 }}>URGENT</div>}
                </div>
              </div>
              <button aria-label="Close" onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {/* Phone — always shown, editable inline */}
              <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Phone</div>
                {selected.phone
                  ? <a href={`tel:${selected.phone}`} style={{ fontSize: 14, color: C.blue, textDecoration: "none", display: "block" }}>{selected.phone}</a>
                  : <input style={{ ...S.input, padding: "4px 8px", fontSize: 13, background: "transparent", border: `1px dashed ${C.border}` }} placeholder="Add phone number..." onBlur={async e => { if (e.target.value.trim()) { setEnquiries(prev => prev.map(en => en.id === selected.id ? { ...en, phone: e.target.value.trim() } : en)); setSelected(s => ({ ...s, phone: e.target.value.trim() })); } }} />
                }
              </div>
              {/* Email — always shown, editable inline */}
              <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Email</div>
                {selected.email
                  ? <a href={`mailto:${selected.email}`} style={{ fontSize: 13, color: C.blue, textDecoration: "none", display: "block" }}>{selected.email}</a>
                  : <input style={{ ...S.input, padding: "4px 8px", fontSize: 13, background: "transparent", border: `1px dashed ${C.border}` }} placeholder="Add email address..." onBlur={async e => { if (e.target.value.trim()) { setEnquiries(prev => prev.map(en => en.id === selected.id ? { ...en, email: e.target.value.trim() } : en)); setSelected(s => ({ ...s, email: e.target.value.trim() })); } }} />
                }
              </div>
              {selected.address && <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Address</div>
                <div style={{ fontSize: 13 }}>{selected.address}</div>
              </div>}
              {selected.msg && <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Enquiry</div>
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>{selected.msg}</div>
              </div>}
              <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Source</div>
                <div style={{ fontSize: 13 }}>{selected.source}</div>
              </div>
            </div>

            {/* Status pipeline */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Update Status</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Object.entries(statusLabel).map(([v, l]) => (
                  <button key={v} onClick={() => updateStatus(selected.id, v)}
                    style={{ padding: "5px 12px", borderRadius: 10, border: `1px solid ${selected.status === v ? statusColor[v] : C.border}`, background: selected.status === v ? statusColor[v] + "22" : "transparent", color: selected.status === v ? statusColor[v] : C.muted, fontSize: 11, fontFamily: "'DM Mono',monospace", fontWeight: 600, cursor: "pointer" }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <button style={{ ...S.btn("ghost"), width: "100%", justifyContent: "center", padding: "12px", marginBottom: 8 }} onClick={() => openEditEnquiry(selected)}>Edit Enquiry</button>
            <button style={{ ...S.btn("primary"), width: "100%", justifyContent: "center", padding: "12px", marginBottom: 8 }} onClick={() => convertToQuote(selected)}>→ Convert to Quote</button>
            <div style={{ display: "flex", gap: 8 }}>
              <a href={selected.phone ? `tel:${selected.phone}` : "#"} style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", textDecoration: "none", opacity: selected.phone ? 1 : 0.4, pointerEvents: selected.phone ? "auto" : "none" }}>📞 Call</a>
              <a href={selected.email ? `mailto:${selected.email}` : "#"} style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", textDecoration: "none", opacity: selected.email ? 1 : 0.4, pointerEvents: selected.email ? "auto" : "none" }}>✉ Email</a>
              <button style={{ ...S.btn("ghost"), color: C.red }} onClick={() => deleteEnquiry(selected.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Compliance Doc Helpers ───────────────────────────────────────────────────
