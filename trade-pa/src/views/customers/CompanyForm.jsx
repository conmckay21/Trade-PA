// ─── CompanyForm — company name + address + multi-contact array editor ─
// Extracted verbatim from App.jsx during P7 sub-batch C (28 Apr 2026).
//
// Rendered inside the Add Customer modal when form.isCompany === true.
// Domestic/single-contact users see CustomerForm instead.
import React, { useEffect } from "react";
import { C } from "../../theme/colors.js";
import { S } from "../../theme/styles.js";

export function CompanyForm({ form, set, draftContacts, setDraftContacts, onSave, onCancel }) {
  // Ensure at least one draft contact exists on mount
  React.useEffect(() => {
    if ((draftContacts || []).length === 0) {
      setDraftContacts([{ tempId: Date.now(), name: "", role: "", phone: "", email: "", isPrimary: true, isBilling: true }]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateContact = (idx, field, value) => {
    setDraftContacts(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  const setPrimary = (idx) => {
    // Exactly one primary at a time
    setDraftContacts(prev => prev.map((c, i) => ({ ...c, isPrimary: i === idx })));
  };
  const setBilling = (idx) => {
    // Exactly one billing at a time
    setDraftContacts(prev => prev.map((c, i) => ({ ...c, isBilling: i === idx })));
  };

  const addContact = () => {
    setDraftContacts(prev => [
      ...prev,
      { tempId: Date.now() + prev.length, name: "", role: "", phone: "", email: "", isPrimary: false, isBilling: false },
    ]);
  };

  const removeContact = (idx) => {
    setDraftContacts(prev => {
      const next = prev.filter((_, i) => i !== idx);
      // Ensure at least one remains; if we removed the primary/billing, reassign to first
      if (next.length === 0) return prev; // refuse — can't have zero contacts
      const hasPrimary = next.some(c => c.isPrimary);
      const hasBilling = next.some(c => c.isBilling);
      return next.map((c, i) => ({
        ...c,
        isPrimary: hasPrimary ? c.isPrimary : i === 0,
        isBilling: hasBilling ? c.isBilling : i === 0,
      }));
    });
  };

  const validContacts = (draftContacts || []).filter(c => c.name && c.name.trim());
  const canSave = !!form.name && validContacts.length > 0;

  const inputStyle = {
    width: "100%",
    background: C.surfaceHigh,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: "10px 12px",
    color: C.text,
    fontSize: 16,
    fontFamily: "'DM Sans', sans-serif",
    outline: "none",
    boxSizing: "border-box",
  };
  const labelStyle = {
    display: "block",
    fontFamily: "'DM Mono', monospace",
    fontSize: 10,
    color: C.muted,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    fontWeight: 600,
    marginBottom: 5,
  };

  const pillToggle = (on, label, onClick, colour) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: 9,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        fontWeight: 700,
        padding: "4px 8px",
        borderRadius: 8,
        cursor: "pointer",
        background: on ? `${colour}26` : "transparent",
        color: on ? colour : C.muted,
        border: `1px solid ${on ? `${colour}66` : C.border}`,
        transition: "all 150ms ease",
      }}
    >{on ? "✓ " : ""}{label}</button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Company name */}
      <div>
        <label style={labelStyle}>Company name <span style={{ color: C.red }}>*</span></label>
        <input
          style={inputStyle}
          placeholder="e.g. ABC Construction Ltd"
          value={form.name || ""}
          onChange={set("name")}
        />
      </div>

      {/* Company address */}
      <div>
        <label style={labelStyle}>Company address</label>
        <input
          style={inputStyle}
          placeholder="e.g. 12 Industrial Way, London, EC1A 1BB"
          value={form.address || ""}
          onChange={set("address")}
        />
      </div>

      {/* Contacts section */}
      <div style={{ marginTop: 4 }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 8,
        }}>
          <div style={labelStyle}>Contacts · {(draftContacts || []).length}</div>
          <button
            type="button"
            onClick={addContact}
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontWeight: 700,
              color: C.amber,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >+ Add contact</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(draftContacts || []).map((contact, idx) => (
            <div
              key={contact.tempId || idx}
              style={{
                background: C.surfaceHigh,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: 12,
              }}
            >
              {/* Row header: # and remove */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}>
                <div style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10,
                  color: C.textDim,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}>
                  Contact {idx + 1}
                </div>
                {(draftContacts || []).length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeContact(idx)}
                    aria-label="Remove contact"
                    style={{
                      background: "transparent",
                      border: "none",
                      color: C.red,
                      cursor: "pointer",
                      fontSize: 11,
                      fontFamily: "'DM Mono', monospace",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      fontWeight: 600,
                      padding: 0,
                    }}
                  >Remove</button>
                )}
              </div>

              {/* Name */}
              <input
                style={{ ...inputStyle, marginBottom: 8 }}
                placeholder="Name (e.g. Sarah Smith)"
                value={contact.name || ""}
                onChange={e => updateContact(idx, "name", e.target.value)}
              />
              {/* Role + Phone grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                <input
                  style={inputStyle}
                  placeholder="Role (Accounts, Site…)"
                  value={contact.role || ""}
                  onChange={e => updateContact(idx, "role", e.target.value)}
                />
                <input
                  style={inputStyle}
                  placeholder="Phone"
                  inputMode="tel"
                  value={contact.phone || ""}
                  onChange={e => updateContact(idx, "phone", e.target.value)}
                />
              </div>
              {/* Email */}
              <input
                style={{ ...inputStyle, marginBottom: 8 }}
                placeholder="Email"
                inputMode="email"
                value={contact.email || ""}
                onChange={e => updateContact(idx, "email", e.target.value)}
              />
              {/* Primary + Billing toggles */}
              <div style={{ display: "flex", gap: 6 }}>
                {pillToggle(!!contact.isPrimary, "Primary", () => setPrimary(idx), C.amber)}
                {pillToggle(!!contact.isBilling, "Billing", () => setBilling(idx), C.green)}
              </div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 8,
          fontFamily: "'DM Mono', monospace",
          fontSize: 10,
          color: C.muted,
          letterSpacing: "0.04em",
          lineHeight: 1.4,
        }}>
          Primary = who you call. Billing = who gets invoices.
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button style={S.btn("primary", !canSave)} disabled={!canSave} onClick={onSave}>
          Save company →
        </button>
        <button style={S.btn("ghost")} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
