// ─── Customers Tab ─────────────────────────────────────────────────────
// Extracted verbatim from App.jsx during P7 sub-batch C (28 Apr 2026).
//
// Bundles DetailContactRow + ContactIcon as private helpers (only used by
// the Customers component). CustomerForm, CompanyForm, ImportContacts have
// been split into views/customers/ to keep this file under the 2k goal.
import React, { useState, useEffect } from "react";
import { db } from "../lib/db.js";
import { C } from "../theme/colors.js";
import { S } from "../theme/styles.js";
import { fmtAmount } from "../lib/format.js";
import { statusColor, statusLabel } from "../lib/status.js";
import { VoiceFillButton } from "../components/VoiceFillButton.jsx";
import { CustomerForm } from "./customers/CustomerForm.jsx";
import { CompanyForm } from "./customers/CompanyForm.jsx";
import { ImportContacts } from "./customers/ImportContacts.jsx";

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
      <div style={{
        width: 32, height: 32,
        borderRadius: 10,
        background: present ? `${C.green}1f` : "transparent",
        border: present ? "none" : `1px dashed ${C.border}`,
        color: present ? C.green : C.muted,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {paths[kind]}
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 9,
          color: C.muted,
          letterSpacing: "0.08em",
          marginBottom: 2,
        }}>{labels[kind]}</div>
        {present ? (
          <div style={{
            fontSize: 13,
            color: C.text,
            lineHeight: 1.25,
            wordBreak: "break-all",
          }}>{value}</div>
        ) : (
          <div style={{
            fontSize: 12,
            color: C.muted,
            fontStyle: "italic",
          }}>Not added yet</div>
        )}
      </div>
      {!present && (
        <span style={{
          fontSize: 11,
          color: C.amber,
          fontWeight: 700,
          flexShrink: 0,
          fontFamily: "'DM Sans', sans-serif",
        }}>+ Add</span>
      )}
    </>
  );

  const baseStyle = {
    padding: "10px 14px",
    display: "flex",
    alignItems: "center",
    gap: 12,
    borderTop: `1px solid ${C.border}`,
    cursor: (present ? (onTap || href) : onAdd) ? "pointer" : "default",
    textDecoration: "none",
    color: "inherit",
  };

  // Three render paths: <a> for href (mailto/tel native), button-style div for onTap, button for onAdd
  if (present && href) {
    return <a href={href} style={baseStyle}>{rowContent}</a>;
  }
  if (present && onTap) {
    return <div onClick={onTap} style={baseStyle}>{rowContent}</div>;
  }
  if (!present && onAdd) {
    return <div onClick={onAdd} style={baseStyle}>{rowContent}</div>;
  }
  return <div style={baseStyle}>{rowContent}</div>;
}

function ContactIcon({ kind, present }) {
  const paths = {
    phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />,
    email: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></>,
    address: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>,
  };
  return (
    <div
      title={`${kind}${present ? "" : " — not set"}`}
      style={{
        width: 22, height: 22,
        borderRadius: 10,
        display: "grid",
        placeItems: "center",
        background: present ? `${C.green}1f` : "transparent",
        border: present ? "none" : `1px dashed ${C.border}`,
        color: present ? C.green : C.muted,
        flexShrink: 0,
      }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {paths[kind]}
      </svg>
    </div>
  );
}

export function Customers({ customers, setCustomers, customerContacts, setCustomerContacts, jobs, invoices, setView, user, makeCall, hasTwilio, setContextHint, companyId }) {
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState(null);

  // Phase 5b: publish context hint when a customer is selected.
  useEffect(() => {
    if (!setContextHint) return;
    if (selected) {
      const bits = [];
      bits.push("Customer: " + (selected.name || "Unknown"));
      if (selected.phone) bits.push(selected.phone);
      else if (selected.email) bits.push(selected.email);
      if (selected.address) bits.push(selected.address);
      setContextHint(bits.join(" · "));
    } else {
      setContextHint(null);
    }
    return () => { if (setContextHint) setContextHint(null); };
  }, [selected, setContextHint]);
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", notes: "", isCompany: false });
  // Draft contacts for the Add Customer flow when isCompany=true.
  // Each draft: { tempId, name, role, phone, email, isPrimary, isBilling }
  const [draftContacts, setDraftContacts] = useState([]);
  const [callLogs, setCallLogs] = useState([]);
  const [customerTab, setCustomerTab] = useState("overview"); // overview | calls
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  // Contacts helpers — both scoped to the current user's data in state
  const contactsForCustomer = (customerId) =>
    (customerContacts || []).filter(c => c.customerId === customerId);
  const primaryContactOf = (customerId) => {
    const all = contactsForCustomer(customerId);
    return all.find(c => c.isPrimary) || all[0] || null;
  };
  const billingContactOf = (customerId) => {
    const all = contactsForCustomer(customerId);
    return all.find(c => c.isBilling) || all.find(c => c.isPrimary) || all[0] || null;
  };

  // Load call logs when customer selected
  useEffect(() => {
    if (!selected || !user?.id) return;
    setCustomerTab("overview");
    db.from("call_logs")
      .select("*")
      .eq("user_id", user.id)
      .ilike("customer_name", selected.name)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setCallLogs(data || []));
  }, [selected, user?.id]);

  const save = async () => {
    if (!form.name) return;
    if (editing) {
      // Edit flow — updates the customer row's convenience fields only.
      // Contact edits happen via the CONTACTS section in Customer Detail.
      setCustomers(prev => prev.map(c => c.id === selected.id ? { ...c, ...form } : c));
      setSelected({ ...selected, ...form });
      setEditing(false);
    } else {
      // Add flow. Insert the customer FIRST so we have a real ID (or offline
      // temp ID) before building contacts. Previously used Date.now() as a
      // placeholder id which never matched a server row, causing contacts to
      // fail with FK violations both online (silently) and offline (visibly).
      const isCompany = !!form.isCompany;
      const { data: inserted, error } = await db.from("customers").insert({
        company_id: companyId,
        user_id: user.id,
        name: form.name,
        phone: isCompany ? "" : (form.phone || ""),
        email: isCompany ? "" : (form.email || ""),
        address: form.address || "",
        notes: form.notes || "",
        is_company: isCompany,
      }).select().single();
      if (error || !inserted) {
        alert(`Couldn't save customer: ${error?.message || "unknown error"}`);
        return;
      }
      const customerId = inserted.id;
      setCustomers(prev => [...prev, inserted]);

      // Build the contacts we need to create
      let contactsToCreate = [];
      if (isCompany) {
        // Drafts from the company editor — must have at least one, first is primary+billing by default
        contactsToCreate = (draftContacts.length > 0 ? draftContacts : [{ name: "Primary contact", role: "", phone: "", email: "" }])
          .map((d, i) => ({
            customerId,
            name: d.name || "",
            role: d.role || "",
            phone: d.phone || "",
            email: d.email || "",
            isPrimary: d.isPrimary || i === 0,
            isBilling: d.isBilling || i === 0,
          }))
          .filter(c => c.name.trim());
      } else {
        // Domestic: one contact, mirrors the customer's name/phone/email
        contactsToCreate = [{
          customerId,
          name: form.name,
          role: "",
          phone: form.phone || "",
          email: form.email || "",
          isPrimary: true,
          isBilling: true,
        }];
      }
      setCustomerContacts(prev => [...prev, ...contactsToCreate]);

      // Reset
      setShowAdd(false);
      setForm({ name: "", phone: "", email: "", address: "", notes: "", isCompany: false });
      setDraftContacts([]);
    }
  };

  const del = (id) => { setCustomers(prev => prev.filter(c => c.id !== id)); setSelected(null); };

  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    if (c.name.toLowerCase().includes(q)) return true;
    if ((c.email || "").toLowerCase().includes(q)) return true;
    if ((c.phone || "").includes(search)) return true;
    // Also search child contacts (for companies with multiple people)
    const kids = contactsForCustomer(c.id);
    return kids.some(k =>
      (k.name || "").toLowerCase().includes(q) ||
      (k.email || "").toLowerCase().includes(q) ||
      (k.phone || "").includes(search) ||
      (k.role || "").toLowerCase().includes(q)
    );
  });

  const jobsForCustomer = (name) => jobs.filter(j => j.customer?.toLowerCase() === name?.toLowerCase());
  const invoicesForCustomer = (name) => invoices.filter(i => i.customer?.toLowerCase() === name?.toLowerCase());

  // missingDetailsCount — a customer counts as "missing details" if no contact has a phone OR an email
  const customerHasAnyContact = (c) => {
    if (c.phone || c.email) return true;
    const kids = contactsForCustomer(c.id);
    return kids.some(k => k.phone || k.email);
  };
  const missingDetailsCount = customers.filter(c => !customerHasAnyContact(c)).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* ─── Page header ────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <div style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            color: C.amber,
            fontWeight: 500,
          }}>Customers</div>
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: C.text,
            lineHeight: 1.1,
          }}>
            All customers
          </div>
          <div style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 11,
            color: C.textDim,
            marginTop: 2,
            letterSpacing: "0.02em",
          }}>
            <span style={{ color: C.text, fontWeight: 600 }}>{customers.length}</span>
            {" "}{customers.length === 1 ? "customer" : "customers"}
            {missingDetailsCount > 0 && (
              <>
                {" · "}
                <span style={{ color: C.red }}>{missingDetailsCount} missing details</span>
              </>
            )}
          </div>
        </div>
        <button
          onClick={() => { setForm({ name: "", phone: "", email: "", address: "", notes: "" }); setShowAdd(true); }}
          style={{
            background: C.amber,
            color: "#000",
            border: "none",
            borderRadius: 10,
            padding: "10px 14px",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            cursor: "pointer",
            boxShadow: `0 4px 12px ${C.amber}33`,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1, marginTop: -1 }}>+</span> Add
        </button>
      </div>

      {/* ─── Search bar (mockup style with icon) ───────────────────── */}
      <div style={{
        background: C.surfaceHigh,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: "10px 12px",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          placeholder="Search by name, phone or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: C.text,
            fontSize: 16,
            fontFamily: "'DM Sans', sans-serif",
            minWidth: 0,
          }}
        />
      </div>

      {/* ─── Customer cards ────────────────────────────────────────── */}
      {customers.length === 0 ? (
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          padding: "32px 20px",
          textAlign: "center",
        }}>
          <div style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: C.muted,
            marginBottom: 8,
          }}>No customers yet</div>
          <div style={{ fontSize: 14, color: C.textDim, lineHeight: 1.5 }}>
            Tap <strong style={{ color: C.amber }}>+ Add</strong> to add one manually,{" "}
            import from your phone's contacts, or they'll be added automatically{" "}
            when you book jobs via the AI Assistant.
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          padding: 24,
          textAlign: "center",
          color: C.textDim,
          fontSize: 14,
        }}>No customers match your search.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map(c => {
            const cJobs = jobsForCustomer(c.name);
            const cInvoices = invoicesForCustomer(c.name);
            const totalSpend = cInvoices.reduce((s, i) => s + (i.amount || 0), 0);
            const kids = contactsForCustomer(c.id);
            const isCo = !!c.is_company;
            // For presence icons: check the customer row OR any child contact
            const hasPhone = !!c.phone || kids.some(k => !!k.phone);
            const hasEmail = !!c.email || kids.some(k => !!k.email);
            const hasAddr = !!c.address;
            // Sub-line: address for domestic, "Company · N contacts" for company without address
            const subLine = isCo
              ? (c.address || `Company · ${kids.length} ${kids.length === 1 ? "contact" : "contacts"}`)
              : (c.address || "no address");
            return (
              <div
                key={c.id}
                onClick={() => setSelected(c)}
                style={{
                  background: C.surfaceHigh,
                  border: `1px solid ${C.border}`,
                  borderRadius: 14,
                  padding: 12,
                  cursor: "pointer",
                  display: "grid",
                  gridTemplateColumns: "40px 1fr auto",
                  gap: 12,
                  alignItems: "center",
                  transition: "background 150ms ease",
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 40, height: 40,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${C.amber}40, ${C.amber}20)`,
                  border: `1.5px solid ${C.amber}4d`,
                  display: "grid",
                  placeItems: "center",
                  color: C.amber,
                  fontFamily: "'DM Mono', monospace",
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: "0.02em",
                  flexShrink: 0,
                }}>
                  {c.name.split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?"}
                </div>

                {/* Body */}
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 14,
                    fontWeight: 700,
                    color: C.text,
                    lineHeight: 1.2,
                    marginBottom: 3,
                    letterSpacing: "-0.01em",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{c.name}</span>
                    {isCo && (
                      <span style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 9,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: C.blue,
                        background: `${C.blue}1a`,
                        border: `1px solid ${C.blue}40`,
                        padding: "2px 5px",
                        borderRadius: 4,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}>CO</span>
                    )}
                  </div>
                  <div style={{
                    fontSize: 11.5,
                    color: (isCo || c.address) ? C.textDim : C.muted,
                    fontStyle: (isCo || c.address) ? "normal" : "italic",
                    lineHeight: 1.3,
                    marginBottom: 6,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {subLine}
                  </div>
                  {/* Contact icons row */}
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <ContactIcon kind="phone" present={hasPhone} />
                    <ContactIcon kind="email" present={hasEmail} />
                    <ContactIcon kind="address" present={hasAddr} />
                  </div>
                </div>

                {/* Right column */}
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 2,
                  flexShrink: 0,
                }}>
                  {cJobs.length > 0 && (
                    <div style={{
                      fontSize: 11,
                      color: C.textDim,
                      fontFamily: "'DM Mono', monospace",
                    }}>
                      {cJobs.length} job{cJobs.length !== 1 ? "s" : ""}
                    </div>
                  )}
                  {totalSpend > 0 && (
                    <div style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: C.amber,
                      fontFamily: "'DM Mono', monospace",
                      letterSpacing: "-0.02em",
                    }}>
                      £{totalSpend.toLocaleString()}
                    </div>
                  )}
                  {cJobs.length === 0 && totalSpend === 0 && (
                    <div style={{ fontSize: 14, color: C.muted }}>→</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Customer Detail Modal (mockup-styled) ─────────────────── */}
      {selected && !editing && (() => {
        const isCo = !!selected.is_company;
        const contacts = contactsForCustomer(selected.id);
        const primaryContact = primaryContactOf(selected.id);
        const billingContact = billingContactOf(selected.id);
        const cJobs = jobsForCustomer(selected.name);
        const cInvoices = invoicesForCustomer(selected.name);
        // Split jobs and invoices by work state (interpretation B from session plan)
        const closedJobStatuses = ["complete", "completed", "cancelled", "canceled"];
        const openJobs = cJobs.filter(j => !closedJobStatuses.includes((j.status || "").toLowerCase()));
        const doneJobs = cJobs.filter(j => ["complete", "completed"].includes((j.status || "").toLowerCase()));
        const outstandingInvs = cInvoices.filter(i => (i.status || "").toLowerCase() !== "paid");
        const paidInvs = cInvoices.filter(i => (i.status || "").toLowerCase() === "paid");
        const lifetime = cInvoices.reduce((s, i) => s + (i.amount || 0), 0);
        const outstanding = outstandingInvs.reduce((s, i) => s + (i.amount || 0), 0);
        const hasOutstanding = outstanding > 0;
        // Resolve where CTAs route to — billing contact for email, primary for phone
        const ctaEmail = (billingContact?.email) || selected.email || "";
        const ctaPhone = (primaryContact?.phone) || selected.phone || "";
        const ctaFirstName = (primaryContact?.name || selected.name || "").split(" ")[0] || "";
        // Last seen: latest of any invoice/job/call timestamp
        const allDates = [
          ...cInvoices.map(i => i.created_at ? new Date(i.created_at).getTime() : 0),
          ...cJobs.map(j => j.dateObj ? new Date(j.dateObj).getTime() : 0),
          ...callLogs.map(l => l.created_at ? new Date(l.created_at).getTime() : 0),
        ].filter(Boolean);
        const lastSeen = allDates.length > 0 ? Math.max(...allDates) : 0;
        const lastSeenDisplay = lastSeen > 0
          ? new Date(lastSeen).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
          : "—";

        return (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: "fixed", inset: 0,
            background: "#000c",
            display: "flex", alignItems: "flex-start", justifyContent: "center",
            zIndex: 300, padding: 16,
            paddingTop: "max(52px, env(safe-area-inset-top, 52px))",
            overflowY: "auto",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 500, width: "100%",
              marginBottom: 16,
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              overflow: "hidden",
              boxShadow: `0 0 0 1px rgba(255,255,255,0.02), 0 24px 48px -12px rgba(0,0,0,0.6), 0 0 80px -20px ${C.amber}1a`,
            }}
          >
            {/* App bar — back / eyebrow / edit shortcut */}
            <div style={{
              padding: "12px 16px",
              borderBottom: `1px solid ${C.border}66`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <button
                onClick={() => setSelected(null)}
                aria-label="Back"
                style={{
                  background: "transparent", border: "none",
                  color: C.text, padding: 6, cursor: "pointer",
                  display: "grid", placeItems: "center",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 11,
                color: C.muted,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}>Customer</div>
              <button
                onClick={() => { setEditing(true); setForm({ name: selected.name, phone: selected.phone || "", email: selected.email || "", address: selected.address || "", notes: selected.notes || "", isCompany: !!selected.is_company }); }}
                aria-label="Edit"
                style={{
                  background: "transparent", border: "none",
                  color: C.text, padding: 6, cursor: "pointer",
                  display: "grid", placeItems: "center",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 1 1 2.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </div>

            {/* Identity */}
            <div style={{
              padding: "16px 18px 14px",
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: `linear-gradient(135deg, ${C.amber}40, ${C.amber}20)`,
                border: `2px solid ${C.amber}66`,
                display: "grid",
                placeItems: "center",
                color: C.amber,
                fontFamily: "'DM Mono', monospace",
                fontWeight: 700,
                fontSize: 17,
                flexShrink: 0,
              }}>
                {selected.name.split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.15,
                  color: C.text,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}>
                  <span>{selected.name}</span>
                  {isCo && (
                    <span style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 9,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      color: C.blue,
                      background: `${C.blue}1a`,
                      border: `1px solid ${C.blue}40`,
                      padding: "3px 6px",
                      borderRadius: 4,
                      fontWeight: 700,
                    }}>Company · {contacts.length}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Summary band */}
            <div style={{
              margin: "0 16px 14px",
              padding: "12px 14px",
              background: hasOutstanding
                ? `linear-gradient(135deg, ${C.red}10, ${C.amber}08)`
                : `linear-gradient(135deg, ${C.amber}0d, ${C.amber}05)`,
              border: hasOutstanding
                ? `1px solid ${C.red}40`
                : `1px solid ${C.amber}33`,
              borderRadius: 12,
            }}>
              {hasOutstanding && (
                <div style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10,
                  color: C.red,
                  letterSpacing: "0.12em",
                  fontWeight: 700,
                  marginBottom: 8,
                }}>
                  £{outstanding.toLocaleString()} OUTSTANDING
                </div>
              )}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 10,
              }}>
                {[
                  { label: "LIFETIME", value: lifetime > 0 ? `£${lifetime.toLocaleString()}` : "—", color: C.text },
                  { label: "OUTSTANDING", value: outstanding > 0 ? `£${outstanding.toLocaleString()}` : "£0", color: outstanding > 0 ? C.red : C.text },
                  { label: "JOBS", value: cJobs.length || "0", color: C.text },
                  { label: "LAST SEEN", value: lastSeenDisplay, color: C.text, fontSize: 12 },
                ].map((stat, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 9,
                      color: C.muted,
                      letterSpacing: "0.06em",
                      fontWeight: 600,
                      marginBottom: 3,
                    }}>{stat.label}</div>
                    <div style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: stat.fontSize || 14,
                      fontWeight: 700,
                      color: stat.color,
                      letterSpacing: "-0.02em",
                      lineHeight: 1.1,
                    }}>{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Scroll content */}
            <div style={{ padding: "0 16px 8px", display: "flex", flexDirection: "column", gap: 14 }}>

              {/* CONTACTS section */}
              <div>
                <div style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10,
                  color: C.muted,
                  letterSpacing: "0.14em",
                  fontWeight: 700,
                  marginBottom: 6,
                  paddingLeft: 2,
                }}>CONTACT{contacts.length !== 1 ? "S" : ""}{contacts.length > 1 ? ` · ${contacts.length}` : ""}</div>
                <div style={{
                  background: C.surfaceHigh,
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  overflow: "hidden",
                }}>
                  {!isCo ? (
                    // DOMESTIC / SINGLE CONTACT — show phone/email/address rows like before.
                    // Read from primary contact if present, fall back to customer row.
                    (() => {
                      const phoneVal = primaryContact?.phone || selected.phone;
                      const emailVal = primaryContact?.email || selected.email;
                      const addrVal = selected.address;
                      return (
                        <>
                          <DetailContactRow
                            kind="phone"
                            value={phoneVal}
                            onTap={phoneVal ? (hasTwilio ? () => makeCall(phoneVal, selected.name) : null) : null}
                            href={!hasTwilio && phoneVal ? `tel:${phoneVal.replace(/\s/g, "")}` : null}
                            onAdd={() => { setEditing(true); setForm({ name: selected.name, phone: selected.phone || "", email: selected.email || "", address: selected.address || "", notes: selected.notes || "", isCompany: !!selected.is_company }); }}
                          />
                          <DetailContactRow
                            kind="email"
                            value={emailVal}
                            href={emailVal ? `mailto:${emailVal}` : null}
                            onAdd={() => { setEditing(true); setForm({ name: selected.name, phone: selected.phone || "", email: selected.email || "", address: selected.address || "", notes: selected.notes || "", isCompany: !!selected.is_company }); }}
                          />
                          <DetailContactRow
                            kind="address"
                            value={addrVal}
                            onAdd={() => { setEditing(true); setForm({ name: selected.name, phone: selected.phone || "", email: selected.email || "", address: selected.address || "", notes: selected.notes || "", isCompany: !!selected.is_company }); }}
                          />
                        </>
                      );
                    })()
                  ) : (
                    // COMPANY — render each contact as its own row with name + role + quick actions
                    <>
                      {contacts.length === 0 && (
                        <div style={{
                          padding: "14px 16px",
                          fontSize: 12,
                          color: C.muted,
                          fontStyle: "italic",
                        }}>No contacts added yet. Tap Edit above to add people at this company.</div>
                      )}
                      {contacts.map((ct, idx) => (
                        <div
                          key={ct.id || idx}
                          style={{
                            padding: "12px 14px",
                            borderTop: idx > 0 ? `1px solid ${C.border}` : "none",
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          {/* Contact initials avatar */}
                          <div style={{
                            width: 36, height: 36,
                            borderRadius: "50%",
                            background: `linear-gradient(135deg, ${C.amber}33, ${C.amber}1a)`,
                            border: `1px solid ${C.amber}4d`,
                            color: C.amber,
                            fontFamily: "'DM Mono', monospace",
                            fontWeight: 700,
                            fontSize: 12,
                            display: "grid", placeItems: "center",
                            flexShrink: 0,
                          }}>
                            {(ct.name || "?").split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()}
                          </div>
                          {/* Name + role + badges */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 13.5,
                              fontWeight: 600,
                              color: C.text,
                              letterSpacing: "-0.01em",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              flexWrap: "wrap",
                            }}>
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{ct.name}</span>
                              {ct.isPrimary && (
                                <span style={{
                                  fontFamily: "'DM Mono', monospace",
                                  fontSize: 8.5,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.08em",
                                  color: C.amber,
                                  background: `${C.amber}1a`,
                                  padding: "1px 5px",
                                  borderRadius: 3,
                                  fontWeight: 700,
                                }}>Primary</span>
                              )}
                              {ct.isBilling && (
                                <span style={{
                                  fontFamily: "'DM Mono', monospace",
                                  fontSize: 8.5,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.08em",
                                  color: C.green,
                                  background: `${C.green}1a`,
                                  padding: "1px 5px",
                                  borderRadius: 3,
                                  fontWeight: 700,
                                }}>Billing</span>
                              )}
                            </div>
                            <div style={{
                              fontSize: 11,
                              color: C.textDim,
                              marginTop: 2,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}>
                              {[ct.role, ct.phone, ct.email].filter(Boolean).join(" · ") || "no details"}
                            </div>
                          </div>
                          {/* Quick actions */}
                          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            {ct.phone && (
                              hasTwilio ? (
                                <button
                                  onClick={() => makeCall(ct.phone, `${selected.name} · ${ct.name}`)}
                                  aria-label={`Call ${ct.name}`}
                                  style={{
                                    width: 32, height: 32, borderRadius: 8,
                                    background: `${C.green}1f`,
                                    border: `1px solid ${C.green}40`,
                                    color: C.green,
                                    cursor: "pointer",
                                    display: "grid", placeItems: "center",
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                  </svg>
                                </button>
                              ) : (
                                <a
                                  href={`tel:${ct.phone.replace(/\s/g, "")}`}
                                  aria-label={`Call ${ct.name}`}
                                  style={{
                                    width: 32, height: 32, borderRadius: 8,
                                    background: `${C.green}1f`,
                                    border: `1px solid ${C.green}40`,
                                    color: C.green,
                                    textDecoration: "none",
                                    display: "grid", placeItems: "center",
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                  </svg>
                                </a>
                              )
                            )}
                            {ct.email && (
                              <a
                                href={`mailto:${ct.email}`}
                                aria-label={`Email ${ct.name}`}
                                style={{
                                  width: 32, height: 32, borderRadius: 8,
                                  background: `${C.blue}1f`,
                                  border: `1px solid ${C.blue}40`,
                                  color: C.blue,
                                  textDecoration: "none",
                                  display: "grid", placeItems: "center",
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                  <polyline points="22,6 12,13 2,6" />
                                </svg>
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                      {/* Company address shown once at the end if set */}
                      {selected.address && (
                        <div style={{
                          padding: "10px 14px",
                          borderTop: `1px solid ${C.border}`,
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        }}>
                          <div style={{
                            width: 32, height: 32,
                            borderRadius: 10,
                            background: `${C.green}1f`,
                            color: C.green,
                            display: "grid", placeItems: "center",
                            flexShrink: 0,
                          }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                              <circle cx="12" cy="10" r="3" />
                            </svg>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontFamily: "'DM Mono', monospace",
                              fontSize: 9,
                              color: C.muted,
                              letterSpacing: "0.08em",
                              marginBottom: 2,
                            }}>COMPANY ADDRESS</div>
                            <div style={{ fontSize: 13, color: C.text, lineHeight: 1.25 }}>{selected.address}</div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* OUTSTANDING INVOICES */}
              {outstandingInvs.length > 0 && (
                <div>
                  <div style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 10,
                    color: C.red,
                    letterSpacing: "0.14em",
                    fontWeight: 700,
                    marginBottom: 6,
                    paddingLeft: 2,
                  }}>OUTSTANDING INVOICES · {outstandingInvs.length}</div>
                  <div style={{
                    background: C.surfaceHigh,
                    border: `1px solid ${C.border}`,
                    borderRadius: 12,
                    overflow: "hidden",
                  }}>
                    {outstandingInvs.map((i, idx) => (
                      <div key={i.id} style={{
                        padding: "11px 14px",
                        borderTop: idx > 0 ? `1px solid ${C.border}` : "none",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: C.text, letterSpacing: "-0.01em" }}>
                            {i.id}
                          </span>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: C.red, letterSpacing: "-0.02em" }}>
                            {fmtAmount(i.amount)}
                          </span>
                        </div>
                        <div>
                          <span style={S.badge(statusColor[i.status] || C.muted)}>{statusLabel[i.status] || i.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PAID INVOICES */}
              {paidInvs.length > 0 && (
                <div>
                  <div style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 10,
                    color: C.muted,
                    letterSpacing: "0.14em",
                    fontWeight: 700,
                    marginBottom: 6,
                    paddingLeft: 2,
                  }}>PAID INVOICES · {paidInvs.length}</div>
                  <div style={{
                    background: C.surfaceHigh,
                    border: `1px solid ${C.border}`,
                    borderRadius: 12,
                    overflow: "hidden",
                  }}>
                    {paidInvs.map((i, idx) => (
                      <div key={i.id} style={{
                        padding: "11px 14px",
                        borderTop: idx > 0 ? `1px solid ${C.border}` : "none",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: C.textDim, letterSpacing: "-0.01em" }}>
                            {i.id}
                          </span>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: C.textDim, letterSpacing: "-0.02em" }}>
                            {fmtAmount(i.amount)}
                          </span>
                        </div>
                        <div>
                          <span style={S.badge(C.green)}>Paid</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* OPEN JOBS */}
              {openJobs.length > 0 && (
                <div>
                  <div style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 10,
                    color: C.amber,
                    letterSpacing: "0.14em",
                    fontWeight: 700,
                    marginBottom: 6,
                    paddingLeft: 2,
                  }}>OPEN JOBS · {openJobs.length}</div>
                  <div style={{
                    background: C.surfaceHigh,
                    border: `1px solid ${C.border}`,
                    borderRadius: 12,
                    overflow: "hidden",
                  }}>
                    {openJobs.map((j, idx) => (
                      <div key={j.id} style={{
                        padding: "11px 14px",
                        borderTop: idx > 0 ? `1px solid ${C.border}` : "none",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: C.text, letterSpacing: "-0.01em" }}>
                            {j.type}
                          </span>
                          {j.value > 0 && (
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: C.amber, letterSpacing: "-0.02em" }}>
                              {fmtAmount(j.value)}
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          {j.status && <span style={S.badge(statusColor[j.status] || C.muted)}>{statusLabel[j.status] || j.status}</span>}
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10.5, color: C.textDim }}>
                            {j.dateObj ? new Date(j.dateObj).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : j.date}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* COMPLETED JOBS */}
              {doneJobs.length > 0 && (
                <div>
                  <div style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 10,
                    color: C.muted,
                    letterSpacing: "0.14em",
                    fontWeight: 700,
                    marginBottom: 6,
                    paddingLeft: 2,
                  }}>COMPLETED JOBS · {doneJobs.length}</div>
                  <div style={{
                    background: C.surfaceHigh,
                    border: `1px solid ${C.border}`,
                    borderRadius: 12,
                    overflow: "hidden",
                  }}>
                    {doneJobs.map((j, idx) => (
                      <div key={j.id} style={{
                        padding: "11px 14px",
                        borderTop: idx > 0 ? `1px solid ${C.border}` : "none",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: C.textDim, letterSpacing: "-0.01em" }}>
                            {j.type}
                          </span>
                          {j.value > 0 && (
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: C.textDim, letterSpacing: "-0.02em" }}>
                              {fmtAmount(j.value)}
                            </span>
                          )}
                        </div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10.5, color: C.muted }}>
                          {j.dateObj ? new Date(j.dateObj).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : j.date}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* RECENT CALLS */}
              {callLogs.length > 0 && (
                <div>
                  <div style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 10,
                    color: C.muted,
                    letterSpacing: "0.14em",
                    fontWeight: 700,
                    marginBottom: 6,
                    paddingLeft: 2,
                  }}>RECENT CALLS · {callLogs.length}</div>
                  <div style={{
                    background: C.surfaceHigh,
                    border: `1px solid ${C.border}`,
                    borderRadius: 12,
                    overflow: "hidden",
                  }}>
                    {callLogs.map((log, idx) => (
                      <div key={log.id} style={{
                        padding: 12,
                        borderTop: idx > 0 ? `1px solid ${C.border}` : "none",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 14 }}>{log.direction === "outbound" ? "📲" : "📞"}</span>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
                                {new Date(log.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </div>
                              <div style={{ fontSize: 10.5, color: C.textDim, fontFamily: "'DM Mono', monospace" }}>
                                {log.direction === "outbound" ? "Outbound · " : "Inbound · "}{Math.floor((log.duration_seconds || 0) / 60)}m {(log.duration_seconds || 0) % 60}s
                              </div>
                            </div>
                          </div>
                          {log.category && (
                            <span style={S.badge(
                              log.category === "existing_job" ? C.green :
                              log.category === "new_enquiry" ? C.blue :
                              log.category === "invoice_payment" ? C.amber : C.muted
                            )}>{log.category.replace(/_/g, " ")}</span>
                          )}
                        </div>
                        {log.summary && <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5, marginTop: 6 }}>{log.summary}</div>}
                        {log.recording_url && (
                          <audio controls style={{ width: "100%", marginTop: 8, height: 32 }}
                            src={`/api/calls/audio?url=${encodeURIComponent(log.recording_url)}`}>
                            Your browser does not support audio playback.
                          </audio>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* NOTES */}
              <div>
                <div style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10,
                  color: C.muted,
                  letterSpacing: "0.14em",
                  fontWeight: 700,
                  marginBottom: 6,
                  paddingLeft: 2,
                }}>NOTES</div>
                {selected.notes ? (
                  <div style={{
                    background: C.surfaceHigh,
                    border: `1px solid ${C.border}`,
                    borderRadius: 12,
                    padding: "12px 14px",
                    fontSize: 13,
                    color: C.text,
                    lineHeight: 1.6,
                  }}>
                    {selected.notes}
                  </div>
                ) : (
                  <div
                    onClick={() => { setEditing(true); setForm({ name: selected.name, phone: selected.phone || "", email: selected.email || "", address: selected.address || "", notes: selected.notes || "", isCompany: !!selected.is_company }); }}
                    style={{
                      background: C.surfaceHigh,
                      border: `1px dashed ${C.border}`,
                      borderRadius: 12,
                      padding: "14px",
                      textAlign: "center",
                      cursor: "pointer",
                      fontSize: 12,
                      color: C.textDim,
                      lineHeight: 1.4,
                    }}
                  >
                    Tap to add a note · gate code, access info, preferences
                  </div>
                )}
              </div>
            </div>

            {/* Sticky CTA bar */}
            <div style={{
              padding: "14px 16px 18px",
              borderTop: `1px solid ${C.border}66`,
              background: C.surface,
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}>
              {hasOutstanding && ctaEmail ? (
                <a
                  href={`mailto:${ctaEmail}?subject=Payment%20reminder&body=Hi%20${encodeURIComponent(ctaFirstName)}%2C%0A%0AJust%20a%20friendly%20reminder%20about%20the%20%C2%A3${outstanding.toLocaleString()}%20outstanding.%0A%0AThanks!`}
                  style={{
                    flex: 1,
                    background: C.amber,
                    color: "#000",
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 700,
                    fontSize: 14,
                    border: "none",
                    padding: "12px 16px",
                    borderRadius: 11,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    textDecoration: "none",
                    letterSpacing: "-0.01em",
                  }}
                >Send chase email →</a>
              ) : ctaPhone ? (
                hasTwilio ? (
                  <button
                    onClick={() => makeCall(ctaPhone, selected.name)}
                    style={{
                      flex: 1,
                      background: C.amber, color: "#000",
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: 700, fontSize: 14,
                      border: "none",
                      padding: "12px 16px", borderRadius: 11,
                      cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      letterSpacing: "-0.01em",
                    }}
                  >📞 Call {ctaFirstName || selected.name.split(" ")[0]}</button>
                ) : (
                  <a
                    href={`tel:${ctaPhone.replace(/\s/g, "")}`}
                    style={{
                      flex: 1,
                      background: C.amber, color: "#000",
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: 700, fontSize: 14,
                      border: "none",
                      padding: "12px 16px", borderRadius: 11,
                      cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      textDecoration: "none",
                      letterSpacing: "-0.01em",
                    }}
                  >📞 Call {ctaFirstName || selected.name.split(" ")[0]}</a>
                )
              ) : (
                <button
                  onClick={() => { setEditing(true); setForm({ name: selected.name, phone: selected.phone || "", email: selected.email || "", address: selected.address || "", notes: selected.notes || "", isCompany: !!selected.is_company }); }}
                  style={{
                    flex: 1,
                    background: C.amber, color: "#000",
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 700, fontSize: 14,
                    border: "none",
                    padding: "12px 16px", borderRadius: 11,
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    letterSpacing: "-0.01em",
                  }}
                >+ Add contact details</button>
              )}
              <button
                onClick={() => { if (window.confirm(`Delete ${selected.name}?`)) del(selected.id); }}
                aria-label="Delete customer"
                style={{
                  width: 48, height: 48,
                  background: "transparent",
                  border: `1px solid ${C.border}`,
                  borderRadius: 11,
                  color: C.red,
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Edit Modal */}
      {selected && editing && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 310, padding: 16 }}>
          <div style={{
            maxWidth: 440,
            width: "100%",
            marginBottom: 16,
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            overflow: "hidden",
            boxShadow: `0 0 0 1px rgba(255,255,255,0.02), 0 24px 48px -12px rgba(0,0,0,0.6), 0 0 80px -20px ${C.amber}1a`,
          }}>
            {/* Header */}
            <div style={{
              padding: "20px 20px 16px",
              borderBottom: `1px solid ${C.border}66`,
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                <div style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  color: C.amber,
                  fontWeight: 500,
                }}>Customers</div>
                <div style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  lineHeight: 1.1,
                  color: C.text,
                }}>Edit customer</div>
              </div>
              <button
                onClick={() => setEditing(false)}
                aria-label="Close"
                style={{
                  background: "transparent",
                  border: `1px solid ${C.border}`,
                  color: C.textDim,
                  width: 32, height: 32,
                  borderRadius: 10,
                  display: "grid", placeItems: "center",
                  cursor: "pointer",
                  fontSize: 18, lineHeight: 1, padding: 0,
                  flexShrink: 0,
                }}
              ><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
            </div>
            {/* Body */}
            <div style={{ padding: 20 }}>
              <CustomerForm form={form} set={set} onSave={save} onCancel={() => setEditing(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }}>
          <div style={{
            maxWidth: 440,
            width: "100%",
            marginBottom: 16,
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            overflow: "hidden",
            boxShadow: `0 0 0 1px rgba(255,255,255,0.02), 0 24px 48px -12px rgba(0,0,0,0.6), 0 0 80px -20px ${C.amber}1a`,
          }}>
            {/* Header */}
            <div style={{
              padding: "20px 20px 16px",
              borderBottom: `1px solid ${C.border}66`,
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                <div style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  color: C.amber,
                  fontWeight: 500,
                }}>Customers</div>
                <div style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  lineHeight: 1.1,
                  color: C.text,
                }}>New customer</div>
              </div>
              <button
                onClick={() => setShowAdd(false)}
                aria-label="Close"
                style={{
                  background: "transparent",
                  border: `1px solid ${C.border}`,
                  color: C.textDim,
                  width: 32, height: 32,
                  borderRadius: 10,
                  display: "grid", placeItems: "center",
                  cursor: "pointer",
                  fontSize: 18, lineHeight: 1, padding: 0,
                  flexShrink: 0,
                }}
              ><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
            </div>
            {/* Voice-fill banner — wraps existing VoiceFillButton logic in mockup chrome */}
            <div style={{
              margin: "16px 20px 0",
              padding: "12px 14px",
              background: `${C.amber}1a`,
              border: `1px solid ${C.amber}4d`,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                  color: C.text,
                  marginBottom: 2,
                }}>Dictate the whole customer</div>
                <div style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: C.textDim,
                }}>Tap and speak — I'll fill every field</div>
              </div>
              <VoiceFillButton form={form} setForm={f => Object.keys(f).forEach(k => set(k)({ target: { value: f[k] } }))} fieldDescriptions="name (full name), phone (phone number), email (email address), address (full address), notes (any extra details)" />
            </div>
            {/* Import from Contacts banner — Android Chrome native picker, iOS/desktop vCard upload */}
            <ImportContacts
              currentCustomers={customers}
              onImport={(novel) => {
                // Each imported contact gets a unique ID so the setCustomersRaw
                // diff (parent component) inserts a new row in Supabase per contact.
                const stamped = novel.map((c, i) => ({ ...c, id: Date.now() + i }));
                setCustomers(prev => [...prev, ...stamped]);
                setShowAdd(false);
                alert(`Imported ${stamped.length} ${stamped.length === 1 ? "contact" : "contacts"}.`);
              }}
            />
            {/* "OR ENTER MANUALLY" divider */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "16px 20px 4px",
              fontFamily: "'DM Mono', monospace",
              fontSize: 9,
              color: C.muted,
              letterSpacing: "0.16em",
            }}>
              <div style={{ flex: 1, height: 1, background: C.border }} />
              OR ENTER MANUALLY
              <div style={{ flex: 1, height: 1, background: C.border }} />
            </div>
            {/* Body */}
            <div style={{ padding: 20 }}>
              {/* Company toggle — sits above both single-contact and multi-contact paths */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                background: form.isCompany ? `${C.blue}12` : C.surfaceHigh,
                border: `1px solid ${form.isCompany ? `${C.blue}40` : C.border}`,
                borderRadius: 10,
                marginBottom: 16,
                cursor: "pointer",
                transition: "all 150ms ease",
              }}
              onClick={() => setForm(f => ({ ...f, isCompany: !f.isCompany }))}
              >
                <div style={{
                  width: 36, height: 20,
                  borderRadius: 10,
                  background: form.isCompany ? C.blue : C.border,
                  position: "relative",
                  flexShrink: 0,
                  transition: "background 150ms ease",
                }}>
                  <div style={{
                    position: "absolute",
                    top: 2,
                    left: form.isCompany ? 18 : 2,
                    width: 16, height: 16,
                    borderRadius: "50%",
                    background: "#fff",
                    transition: "left 150ms ease",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                  }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 14,
                    fontWeight: 600,
                    color: C.text,
                    lineHeight: 1.2,
                  }}>This is a company</div>
                  <div style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 10,
                    color: C.textDim,
                    marginTop: 3,
                    letterSpacing: "0.04em",
                  }}>
                    {form.isCompany ? "Add multiple contacts (owner, accounts, site)" : "Single person — the customer is one contact"}
                  </div>
                </div>
              </div>

              {!form.isCompany ? (
                <CustomerForm form={form} set={set} onSave={save} onCancel={() => setShowAdd(false)} />
              ) : (
                <CompanyForm
                  form={form}
                  set={set}
                  draftContacts={draftContacts}
                  setDraftContacts={setDraftContacts}
                  onSave={save}
                  onCancel={() => { setShowAdd(false); setForm({ name: "", phone: "", email: "", address: "", notes: "", isCompany: false }); setDraftContacts([]); }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
