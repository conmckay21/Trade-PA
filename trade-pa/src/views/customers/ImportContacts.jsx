// ─── ImportContacts — vCard upload + parser ────────────────────────────
// Extracted verbatim from App.jsx during P7 sub-batch C (28 Apr 2026).
//
// Bundles parseVCard as a private helper (only used here).
import React, { useState, useRef } from "react";
import { C } from "../../theme/colors.js";

function parseVCard(text) {
  if (!text) return [];
  const cards = String(text).split(/BEGIN:VCARD/i).slice(1);
  return cards.map(card => {
    const body = card.split(/END:VCARD/i)[0];
    // RFC 6350 line unfolding: lines starting with whitespace continue prior line
    const lines = body.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
    const get = (key) => {
      const re = new RegExp(`^${key}(;[^:]*)?:(.*)$`, "i");
      for (const line of lines) {
        const m = line.match(re);
        if (m) return m[2].trim();
      }
      return "";
    };
    const fn = get("FN");
    const tel = get("TEL").replace(/[^0-9+ ()-]/g, "").trim();
    const email = get("EMAIL").toLowerCase();
    // ADR per RFC: PO;Ext;Street;Locality;Region;Postcode;Country
    const adrRaw = get("ADR");
    let address = "";
    if (adrRaw) {
      const adrParts = adrRaw.split(";").slice(2);
      address = adrParts.filter(Boolean).join(", ").trim();
    }
    const note = get("NOTE");
    return { name: fn, phone: tel, email, address, notes: note };
  }).filter(c => c.name);
}

export function ImportContacts({ onImport, currentCustomers }) {
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null); // null | array of contact objects
  const [selectedIdx, setSelectedIdx] = useState(new Set());
  const fileInputRef = useRef(null);

  const hasContactsAPI = typeof navigator !== "undefined"
    && "contacts" in navigator
    && navigator.contacts && typeof navigator.contacts.select === "function";

  const handleClick = async () => {
    if (busy) return;
    if (hasContactsAPI) {
      try {
        setBusy(true);
        const contacts = await navigator.contacts.select(
          ["name", "tel", "email", "address"],
          { multiple: true }
        );
        const normalised = contacts.map(c => ({
          name: (c.name && c.name[0]) || "",
          phone: (c.tel && c.tel[0]) || "",
          email: (c.email && c.email[0]) || "",
          address: (c.address && c.address[0])
            ? [c.address[0].streetAddress, c.address[0].city, c.address[0].postalCode]
                .filter(Boolean).join(", ")
            : "",
          notes: "",
        })).filter(c => c.name);
        if (normalised.length === 0) {
          alert("No contacts selected.");
        } else {
          setPending(normalised);
          setSelectedIdx(new Set(normalised.map((_, i) => i)));
        }
      } catch (err) {
        console.error("Contact picker:", err);
        if (err.name !== "AbortError") {
          alert("Could not access contacts: " + (err.message || err.name));
        }
      } finally {
        setBusy(false);
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const contacts = parseVCard(text);
      if (contacts.length === 0) {
        alert("No contacts found. Make sure this is a .vcf or vCard file from your phone's Contacts app.");
      } else {
        setPending(contacts);
        setSelectedIdx(new Set(contacts.map((_, i) => i)));
      }
    } catch (err) {
      console.error("vCard parse:", err);
      alert("Could not read this file. Try a different .vcf export.");
    } finally {
      setBusy(false);
      e.target.value = ""; // reset so same file can be re-selected
    }
  };

  const toggleSelect = (idx) => {
    setSelectedIdx(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const confirmImport = () => {
    const toImport = pending.filter((_, i) => selectedIdx.has(i));
    if (toImport.length === 0) {
      alert("Select at least one contact to import.");
      return;
    }
    // Detect duplicates by name (case-insensitive, trimmed)
    const existingNames = new Set(currentCustomers.map(c => (c.name || "").toLowerCase().trim()));
    const novel = toImport.filter(c => !existingNames.has(c.name.toLowerCase().trim()));
    const dupCount = toImport.length - novel.length;
    if (novel.length === 0) {
      alert(`All ${toImport.length} selected ${toImport.length === 1 ? "contact is" : "contacts are"} already in your customer list.`);
      return;
    }
    if (dupCount > 0) {
      const ok = window.confirm(
        `${dupCount} of ${toImport.length} are already saved (matched by name).\n\nImport only the ${novel.length} new ${novel.length === 1 ? "one" : "ones"}?`
      );
      if (!ok) return;
    }
    onImport(novel);
    setPending(null);
    setSelectedIdx(new Set());
  };

  return (
    <>
      {/* Banner — rendered inline by parent's Add modal */}
      <div
        onClick={handleClick}
        role="button"
        aria-label="Import from contacts"
        style={{
          margin: "10px 20px 0",
          padding: "12px 14px",
          background: C.surfaceHigh,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          gap: 12,
          cursor: busy ? "wait" : "pointer",
          opacity: busy ? 0.6 : 1,
          transition: "all 150ms ease",
        }}
      >
        <div style={{
          width: 32, height: 32,
          borderRadius: "50%",
          background: `${C.amber}26`,
          border: `1px solid ${C.amber}66`,
          color: C.amber,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}>
          {/* address book icon */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 2 }}>
            {busy ? "Loading…" : "Import from contacts"}
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textDim }}>
            {hasContactsAPI ? "Pick from your phone's address book" : "Upload a .vcf file from your contacts app"}
          </div>
        </div>
        <div style={{ color: C.textDim, fontSize: 18 }}>→</div>
      </div>

      {/* Hidden file input — only used on platforms without Contact Picker API */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".vcf,.vcard,text/vcard,text/x-vcard"
        style={{ display: "none" }}
        onChange={handleFile}
      />

      {/* Preview modal — appears after picker/upload returns contacts */}
      {pending && (
        <div
          style={{
            position: "fixed", inset: 0,
            background: "#000c",
            display: "flex", alignItems: "flex-start", justifyContent: "center",
            zIndex: 320, padding: 16,
            paddingTop: "max(52px, env(safe-area-inset-top, 52px))",
            overflowY: "auto",
          }}
        >
          <div style={{
            maxWidth: 440, width: "100%",
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
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: C.amber, fontWeight: 500 }}>Import contacts</div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.1, color: C.text }}>
                  {pending.length} {pending.length === 1 ? "contact" : "contacts"} found
                </div>
              </div>
              <button
                onClick={() => { setPending(null); setSelectedIdx(new Set()); }}
                aria-label="Cancel import"
                style={{
                  background: "transparent",
                  border: `1px solid ${C.border}`,
                  color: C.textDim,
                  width: 32, height: 32, borderRadius: 10,
                  display: "grid", placeItems: "center",
                  cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0,
                  flexShrink: 0,
                }}
              ><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
            </div>

            {/* Select all/none + count */}
            <div style={{
              padding: "12px 20px",
              borderBottom: `1px solid ${C.border}66`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: C.textDim, letterSpacing: "0.04em" }}>
                {selectedIdx.size} of {pending.length} selected
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setSelectedIdx(new Set(pending.map((_, i) => i)))}
                  style={{
                    background: "transparent", border: `1px solid ${C.border}`,
                    color: C.textDim, padding: "5px 10px", borderRadius: 10,
                    fontFamily: "'DM Mono', monospace", fontSize: 10,
                    textTransform: "uppercase", letterSpacing: "0.08em",
                    cursor: "pointer",
                  }}
                >All</button>
                <button
                  onClick={() => setSelectedIdx(new Set())}
                  style={{
                    background: "transparent", border: `1px solid ${C.border}`,
                    color: C.textDim, padding: "5px 10px", borderRadius: 10,
                    fontFamily: "'DM Mono', monospace", fontSize: 10,
                    textTransform: "uppercase", letterSpacing: "0.08em",
                    cursor: "pointer",
                  }}
                >None</button>
              </div>
            </div>

            {/* Contact list */}
            <div style={{ maxHeight: "55vh", overflowY: "auto", padding: "8px 16px" }}>
              {pending.map((c, i) => {
                const isSel = selectedIdx.has(i);
                return (
                  <div
                    key={i}
                    onClick={() => toggleSelect(i)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 12px",
                      margin: "4px 0",
                      borderRadius: 10,
                      background: isSel ? `${C.amber}14` : C.surfaceHigh,
                      border: `1px solid ${isSel ? `${C.amber}66` : C.border}`,
                      cursor: "pointer",
                      transition: "all 150ms ease",
                    }}
                  >
                    {/* Checkbox */}
                    <div style={{
                      width: 20, height: 20, borderRadius: 8,
                      border: `1.5px solid ${isSel ? C.amber : C.border}`,
                      background: isSel ? C.amber : "transparent",
                      display: "grid", placeItems: "center",
                      flexShrink: 0,
                      transition: "all 150ms ease",
                    }}>
                      {isSel && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    {/* Avatar */}
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%",
                      background: `linear-gradient(135deg, ${C.amber}40, ${C.amber}20)`,
                      border: `1px solid ${C.amber}40`,
                      display: "grid", placeItems: "center",
                      color: C.amber, fontFamily: "'DM Mono', monospace",
                      fontWeight: 700, fontSize: 12,
                      flexShrink: 0,
                    }}>
                      {(c.name || "?").split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()}
                    </div>
                    {/* Name + sub */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: C.text, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.name}
                      </div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: C.textDim, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {[c.phone, c.email].filter(Boolean).join(" · ") || "no contact details"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action row */}
            <div style={{
              padding: "16px 20px 20px",
              borderTop: `1px solid ${C.border}66`,
              display: "flex",
              gap: 10,
              background: C.surface,
            }}>
              <button
                onClick={() => { setPending(null); setSelectedIdx(new Set()); }}
                style={{
                  flex: 1, height: 48, borderRadius: 10,
                  background: "transparent",
                  border: `1px solid ${C.border}`,
                  color: C.textDim,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 15, fontWeight: 600,
                  cursor: "pointer",
                }}
              >Cancel</button>
              <button
                onClick={confirmImport}
                disabled={selectedIdx.size === 0}
                style={{
                  flex: 1, height: 48, borderRadius: 10,
                  background: selectedIdx.size === 0 ? C.surfaceHigh : C.amber,
                  border: "none",
                  color: selectedIdx.size === 0 ? C.muted : "#000",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 15, fontWeight: 600,
                  cursor: selectedIdx.size === 0 ? "not-allowed" : "pointer",
                  opacity: selectedIdx.size === 0 ? 0.6 : 1,
                }}
              >
                Import {selectedIdx.size > 0 ? `${selectedIdx.size} ` : ""}→
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
