// ─── Suppliers Tab ─────────────────────────────────────────────────────
// First-class suppliers entity. Self-loading from public.suppliers via
// Supabase — parent App doesn't need to pass data down, unlike Customers.
//
// Stage 1: list, search, add, edit, soft-delete, contact rows.
// Stage 2: "Send material order" button that emails the supplier the
// current to_order materials list via the user's connected Gmail/Outlook.
import React, { useState, useEffect } from "react";
import { db } from "../lib/db.js";
import { C } from "../theme/colors.js";
import { S } from "../theme/styles.js";
import SupplierOrderModal from "../modals/SupplierOrderModal.jsx";

function DetailContactRow({ kind, value, onTap, href, onAdd }) {
  const labels = { phone: "PHONE", email: "EMAIL", address: "ADDRESS" };
  const paths = {
    phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />,
    email: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></>,
    address: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>,
  };
  const present = !!value;
  const rowContent = (
    <>
      <div style={{ width: 32, height: 32, borderRadius: 10, background: present ? `${C.green}1f` : "transparent", border: present ? "none" : `1px dashed ${C.border}`, color: present ? C.green : C.muted, display: "grid", placeItems: "center", flexShrink: 0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{paths[kind]}</svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 9, color: C.muted, letterSpacing: "0.08em", marginBottom: 2 }}>{labels[kind]}</div>
        {present ? (<div style={{ fontSize: 13, color: C.text, lineHeight: 1.25, wordBreak: "break-all" }}>{value}</div>) : (<div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>Not added yet</div>)}
      </div>
      {!present && <span style={{ fontSize: 11, color: C.amber, fontWeight: 700, flexShrink: 0 }}>+ Add</span>}
    </>
  );
  const baseStyle = { padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, borderTop: `1px solid ${C.border}`, cursor: (present ? (onTap || href) : onAdd) ? "pointer" : "default", textDecoration: "none", color: "inherit" };
  if (present && href) return <a href={href} style={baseStyle}>{rowContent}</a>;
  if (present && onTap) return <div onClick={onTap} style={baseStyle}>{rowContent}</div>;
  if (!present && onAdd) return <div onClick={onAdd} style={baseStyle}>{rowContent}</div>;
  return <div style={baseStyle}>{rowContent}</div>;
}

export function Suppliers({ user, setView, makeCall, hasTwilio, setContextHint }) {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", notes: "" });
  const [sendingOrder, setSendingOrder] = useState(false);
  const [orderResult, setOrderResult] = useState(null);
  const [orderModalOpen, setOrderModalOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      const { data, error } = await db.from("suppliers").select("*").eq("user_id", user.id).is("deleted_at", null).order("name", { ascending: true });
      if (error) { console.error("Failed to load suppliers:", error); setSuppliers([]); } else { setSuppliers(data || []); }
      setLoading(false);
    })();
  }, [user?.id]);

  useEffect(() => {
    if (!setContextHint) return;
    if (selected) {
      const bits = ["Supplier: " + (selected.name || "Unknown")];
      if (selected.phone) bits.push(selected.phone);
      else if (selected.email) bits.push(selected.email);
      setContextHint(bits.join(" · "));
    } else { setContextHint(null); }
    return () => { if (setContextHint) setContextHint(null); };
  }, [selected, setContextHint]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.name?.trim()) return;
    if (editing && selected) {
      const { data, error } = await db.from("suppliers").update({ name: form.name.trim(), phone: form.phone || null, email: form.email || null, address: form.address || null, notes: form.notes || null }).eq("id", selected.id).eq("user_id", user.id).select().single();
      if (error || !data) { alert(`Couldn't save supplier: ${error?.message || "unknown error"}`); return; }
      setSuppliers(prev => prev.map(s => s.id === data.id ? data : s));
      setSelected(data);
      setEditing(false);
    } else {
      const { data, error } = await db.from("suppliers").insert({ user_id: user.id, name: form.name.trim(), phone: form.phone || null, email: form.email || null, address: form.address || null, notes: form.notes || null }).select().single();
      if (error || !data) {
        const msg = error?.message?.includes("duplicate") || error?.code === "23505" ? `A supplier called "${form.name}" already exists.` : `Couldn't save supplier: ${error?.message || "unknown error"}`;
        alert(msg); return;
      }
      setSuppliers(prev => [...prev, data].sort((a, b) => (a.name || "").localeCompare(b.name || "")));
      setShowAdd(false);
      setForm({ name: "", phone: "", email: "", address: "", notes: "" });
    }
  };

  const softDelete = async (s) => {
    if (!s?.id) return;
    if (!confirm(`Remove ${s.name}? You can find them in Recently Deleted.`)) return;
    const { error } = await db.from("suppliers").update({ deleted_at: new Date().toISOString() }).eq("id", s.id).eq("user_id", user.id);
    if (error) { alert(`Couldn't remove supplier: ${error.message}`); return; }
    setSuppliers(prev => prev.filter(x => x.id !== s.id));
    setSelected(null);
  };

  const filtered = suppliers.filter(s => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (s.name || "").toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q) || (s.phone || "").includes(search);
  });

  const missingDetailsCount = suppliers.filter(s => !s.phone && !s.email).length;

  const sendMaterialOrder = async (supplier) => {
    if (!supplier?.email) { alert("This supplier has no email address yet. Tap Edit and add one first."); return; }
    if (!user?.id) return;
    setOrderResult(null);
    setSendingOrder(true);
    try {
      const res = await fetch("/api/email/send-material-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, supplierId: supplier.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setOrderResult({ ok: false, message: data.error || data.message || "Couldn't send the order." });
      } else if (data.itemCount === 0) {
        setOrderResult({ ok: false, message: `No materials currently marked "to order" for ${supplier.name}.` });
      } else {
        setOrderResult({ ok: true, message: `Sent ${data.itemCount} item${data.itemCount === 1 ? "" : "s"} to ${supplier.email}` });
      }
    } catch (err) { setOrderResult({ ok: false, message: err.message || "Network error" }); }
    finally { setSendingOrder(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: C.amber, fontWeight: 500 }}>Suppliers</div>
          <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", color: C.text, lineHeight: 1.1 }}>All suppliers</div>
          <div style={{ fontSize: 11, color: C.textDim, marginTop: 2, letterSpacing: "0.02em" }}>
            <span style={{ color: C.text, fontWeight: 600 }}>{suppliers.length}</span>{" "}{suppliers.length === 1 ? "supplier" : "suppliers"}
            {missingDetailsCount > 0 && <>{" · "}<span style={{ color: C.red }}>{missingDetailsCount} missing details</span></>}
          </div>
        </div>
        <button onClick={() => { setForm({ name: "", phone: "", email: "", address: "", notes: "" }); setShowAdd(true); }} style={{ background: C.amber, color: "#000", border: "none", borderRadius: 10, padding: "10px 14px", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em", cursor: "pointer", boxShadow: `0 4px 12px ${C.amber}33`, display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0, whiteSpace: "nowrap" }}>
          <span style={{ fontSize: 16, lineHeight: 1, marginTop: -1 }}>+</span> Add
        </button>
      </div>

      <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input placeholder="Search by name, phone or email…" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 16, fontFamily: "'Plus Jakarta Sans', sans-serif", minWidth: 0 }} />
      </div>

      {loading ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, textAlign: "center", color: C.textDim, fontSize: 14 }}>Loading suppliers…</div>
      ) : suppliers.length === 0 ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "32px 20px", textAlign: "center" }}>
          <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: C.muted, marginBottom: 8 }}>No suppliers yet</div>
          <div style={{ fontSize: 14, color: C.textDim, lineHeight: 1.5 }}>Tap <strong style={{ color: C.amber }}>+ Add</strong> to add the merchants you buy from — CEF, Screwfix, Toolstation, your local builder's merchant. Save their phone and email once, never look them up again.</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, textAlign: "center", color: C.textDim, fontSize: 14 }}>No suppliers match your search.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map(s => {
            const hasPhone = !!s.phone, hasEmail = !!s.email, hasAddr = !!s.address;
            const sub = s.address || (s.notes ? s.notes.slice(0, 60) : "no address");
            return (
              <div key={s.id} onClick={() => setSelected(s)} style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 14, padding: 12, cursor: "pointer", display: "grid", gridTemplateColumns: "40px 1fr auto", gap: 12, alignItems: "center", transition: "background 150ms ease" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: `linear-gradient(135deg, ${C.amber}40, ${C.amber}20)`, border: `1.5px solid ${C.amber}4d`, display: "grid", placeItems: "center", color: C.amber, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                  {(s.name || "?").split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 700, color: C.text, lineHeight: 1.2, marginBottom: 3, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name || "Unnamed"}</div>
                  <div style={{ fontSize: 11.5, color: C.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>
                </div>
                <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
                  {hasPhone && <div title="Has phone" style={{ width: 6, height: 6, borderRadius: 3, background: C.green }} />}
                  {hasEmail && <div title="Has email" style={{ width: 6, height: 6, borderRadius: 3, background: C.green }} />}
                  {hasAddr && <div title="Has address" style={{ width: 6, height: 6, borderRadius: 3, background: C.green }} />}
                  {!hasPhone && !hasEmail && <span style={{ fontSize: 10, color: C.red, fontWeight: 700, letterSpacing: "0.04em" }}>NO CONTACT</span>}
                  <span style={{ fontSize: 14, color: C.muted, marginLeft: 6 }}>→</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && !editing && (
        <div onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 500, width: "100%", marginBottom: 16, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", boxShadow: `0 0 0 1px rgba(255,255,255,0.02), 0 24px 48px -12px rgba(0,0,0,0.6), 0 0 80px -20px ${C.amber}1a` }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}66`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <button onClick={() => setSelected(null)} aria-label="Back" style={{ background: "transparent", border: "none", color: C.text, padding: 6, cursor: "pointer", display: "grid", placeItems: "center" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, color: C.muted, letterSpacing: "0.14em", textTransform: "uppercase" }}>Supplier</div>
              <button onClick={() => { setEditing(true); setForm({ name: selected.name || "", phone: selected.phone || "", email: selected.email || "", address: selected.address || "", notes: selected.notes || "" }); }} aria-label="Edit" style={{ background: "transparent", border: "none", color: C.text, padding: 6, cursor: "pointer", display: "grid", placeItems: "center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 1 1 2.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </button>
            </div>
            <div style={{ padding: "16px 18px 14px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: `linear-gradient(135deg, ${C.amber}40, ${C.amber}20)`, border: `2px solid ${C.amber}66`, display: "grid", placeItems: "center", color: C.amber, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 17, flexShrink: 0 }}>
                {(selected.name || "?").split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.15, color: C.text }}>{selected.name || "Unnamed supplier"}</div>
              </div>
            </div>
            <div style={{ margin: "0 16px 14px" }}>
              <button onClick={(e) => { e.stopPropagation(); if (selected && selected.email) setOrderModalOpen(true); }} disabled={sendingOrder || !selected.email} style={{ width: "100%", background: selected.email ? C.amber : C.surfaceHigh, color: selected.email ? "#000" : C.muted, border: "none", borderRadius: 12, padding: "12px 14px", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 700, cursor: selected.email ? "pointer" : "not-allowed", opacity: sendingOrder ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {sendingOrder ? "Sending…" : selected.email ? "✉ Email materials to order" : "Add an email to send orders"}
              </button>
              {orderResult && (
                <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 10, background: orderResult.ok ? `${C.green}1a` : `${C.red}1a`, border: `1px solid ${orderResult.ok ? C.green : C.red}44`, color: orderResult.ok ? C.green : C.red, fontSize: 12, lineHeight: 1.4 }}>{orderResult.message}</div>
              )}
            </div>
            <div style={{ padding: "0 16px 8px" }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 10, color: C.muted, letterSpacing: "0.14em", fontWeight: 700, marginBottom: 6, paddingLeft: 2 }}>CONTACT</div>
              <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
                <DetailContactRow kind="phone" value={selected.phone} onTap={selected.phone ? (hasTwilio ? () => makeCall(selected.phone, selected.name) : null) : null} href={!hasTwilio && selected.phone ? `tel:${selected.phone.replace(/\s/g, "")}` : null} onAdd={() => { setEditing(true); setForm({ name: selected.name || "", phone: selected.phone || "", email: selected.email || "", address: selected.address || "", notes: selected.notes || "" }); }} />
                <DetailContactRow kind="email" value={selected.email} href={selected.email ? `mailto:${selected.email}` : null} onAdd={() => { setEditing(true); setForm({ name: selected.name || "", phone: selected.phone || "", email: selected.email || "", address: selected.address || "", notes: selected.notes || "" }); }} />
                <DetailContactRow kind="address" value={selected.address} onAdd={() => { setEditing(true); setForm({ name: selected.name || "", phone: selected.phone || "", email: selected.email || "", address: selected.address || "", notes: selected.notes || "" }); }} />
              </div>
            </div>
            {selected.notes && (
              <div style={{ padding: "0 16px 16px" }}>
                <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 10, color: C.muted, letterSpacing: "0.14em", fontWeight: 700, marginTop: 14, marginBottom: 6, paddingLeft: 2 }}>NOTES</div>
                <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", fontSize: 13, color: C.text, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{selected.notes}</div>
              </div>
            )}
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.border}66`, display: "flex", justifyContent: "space-between" }}>
              <button onClick={() => softDelete(selected)} style={{ background: "transparent", border: "none", color: C.red, fontSize: 12, cursor: "pointer", padding: 4 }}>Remove supplier</button>
              <button onClick={() => setSelected(null)} style={{ ...S.btn("ghost"), fontSize: 12 }}>Close</button>
            </div>
          </div>
        </div>
      )}

      <SupplierOrderModal
        open={orderModalOpen}
        supplier={selected}
        userId={user && user.id}
        onClose={() => setOrderModalOpen(false)}
        onSent={(data) => {
          setOrderResult && setOrderResult({ ok: true, ...data });
          setOrderModalOpen(false);
        }}
      />

      {(showAdd || editing) && (
        <div onClick={() => { setShowAdd(false); setEditing(false); }} style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 320, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.card, maxWidth: 500, width: "100%", marginBottom: 16, borderRadius: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 14, borderBottom: `1px solid ${C.border}`, marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{editing ? "Edit supplier" : "Add supplier"}</div>
              <button aria-label="Close" onClick={() => { setShowAdd(false); setEditing(false); }} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><label style={S.label}>Supplier name *</label><input style={S.input} value={form.name} onChange={set("name")} placeholder="e.g. CEF, Screwfix, Toolstation" autoFocus /></div>
              <div><label style={S.label}>Phone</label><input style={S.input} type="tel" value={form.phone} onChange={set("phone")} placeholder="0800 123 4567" /></div>
              <div><label style={S.label}>Email</label><input style={S.input} type="email" value={form.email} onChange={set("email")} placeholder="orders@supplier.com" /></div>
              <div><label style={S.label}>Address</label><input style={S.input} value={form.address} onChange={set("address")} placeholder="Branch address (optional)" /></div>
              <div><label style={S.label}>Notes</label><textarea style={{ ...S.input, minHeight: 60 }} value={form.notes} onChange={set("notes")} placeholder="Account number, opening hours, anything useful" /></div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button style={{ ...S.btn("primary"), flex: 1, justifyContent: "center" }} onClick={save} disabled={!form.name?.trim()}>{editing ? "Save changes" : "Add supplier"}</button>
              <button style={S.btn("ghost")} onClick={() => { setShowAdd(false); setEditing(false); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
