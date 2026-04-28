import React, { useState } from "react";
import { C } from "../theme/colors.js";
import { S } from "../theme/styles.js";
import { buildRef, downloadInvoicePDF } from "../lib/invoice-html.js";
import { isExemptAccount, nextInvoiceId } from "../lib/ids.js";
import { LineItemsBuilder } from "../components/LineItemsBuilder.jsx";
import { MicButton } from "../components/MicButton.jsx";

// ─── Invoice Modal ────────────────────────────────────────────────────────────
export function InvoiceModal({ brand, onClose, onSent, initialData, invoices, user, customers = [] }) {
  const [form, setForm] = useState(() => initialData ? {
    customer: initialData.customer || "",
    email: initialData.email || "",
    address: initialData.address || "",
    amount: initialData.amount ? String(initialData.amount) : "",
    labour: initialData.cisLabour ? String(initialData.cisLabour) : "",
    materials: initialData.cisMaterials ? String(initialData.cisMaterials) : "",
    desc: initialData.description || initialData.desc || "",
    due: initialData.due?.replace(/\D/g, "") || brand.paymentTerms || "14",
    paymentMethod: initialData.paymentMethod || brand.defaultPaymentMethod || "both",
    vatEnabled: initialData.vatEnabled || false,
    vatRate: initialData.vatRate || 20,
    vatType: initialData.vatType || "income",
    vatZeroRated: initialData.vatZeroRated || false,
    cisEnabled: initialData.cisEnabled || false,
    cisRate: initialData.cisRate || 20,
    jobRef: initialData?.jobRef || "",
    poNumber: initialData?.poNumber || "",
    lineItems: initialData?.lineItems || [],
    materialItems: initialData?.materialItems || [{ desc: "", amount: "" }],
  } : { customer: "", email: "", address: "", amount: "", labour: "", materials: "", desc: "", due: brand.paymentTerms || "14", paymentMethod: brand.defaultPaymentMethod || "both", vatEnabled: brand.vatEnabled || false, vatRate: brand.vatRate || 20, vatType: "income", vatZeroRated: false, cisEnabled: brand.cisEnabled || false, cisRate: brand.cisRate || 20, jobRef: "", lineItems: [], materialItems: [{ desc: "", amount: "" }] });
  const isEditing = !!initialData;
  const [tab, setTab] = useState("form");
  const [sent, setSent] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const isVatRegistered = !!(brand.vatNumber && (isExemptAccount(user?.email) || brand.registrationVerifications?.vatNumber?.verified));

  // CIS calculations
  const labourAmt = parseFloat(form.labour) || 0;
  const materialsAmt = parseFloat(form.materials) || 0;
  const cisDeduction = form.cisEnabled ? parseFloat(((labourAmt * form.cisRate) / 100).toFixed(2)) : 0;
  const cisGross = form.cisEnabled ? labourAmt + materialsAmt : 0;
  const cisNetPayable = form.cisEnabled ? parseFloat((cisGross - cisDeduction).toFixed(2)) : 0;

  // Compute total from line items if individual prices set
  const lineItemsTotal = form.lineItems && form.lineItems.length > 0 && form.lineItems.some(l => l.amount && l.amount !== "")
    ? form.lineItems.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)
    : null;

  // grossAmount uses lineItemsTotal when available
  const netAmount = form.cisEnabled ? cisGross : (lineItemsTotal !== null ? lineItemsTotal : (parseFloat(form.amount) || 0));
  const vatRate = form.vatZeroRated ? 0 : (form.vatRate || 20);
  const vatAmount = (form.vatEnabled && !form.vatZeroRated) ? parseFloat((netAmount * vatRate / 100).toFixed(2)) : 0;
  const grossAmount = netAmount + vatAmount;

  const previewRef = buildRef(brand, { id: "INV-043", customer: form.customer || "Customer Name" });

  // Valid if customer + (email required for new, optional for edits) + some amount source
  const hasAmount = form.cisEnabled ? (form.labour || form.materials) : (lineItemsTotal !== null || !!form.amount);
  const valid = form.customer && (isEditing || form.email) && hasAmount;

  const send = () => {
    try {
      const finalDesc = form.lineItems && form.lineItems.length > 0
        ? form.lineItems.map(l => l.amount && l.amount !== "" ? `${l.desc || l.description}|${l.amount}` : (l.desc || l.description || "")).filter(Boolean).join("\n")
        : form.desc;
      const finalAmount = form.cisEnabled ? cisNetPayable : netAmount;
      const finalGross = form.cisEnabled ? cisGross : grossAmount;
      const payload = {
        id: initialData?.id || nextInvoiceId(invoices),
        customer: form.customer, email: form.email, address: form.address,
        amount: finalAmount,
        grossAmount: finalGross,
        due: `Due in ${form.due} days`, status: initialData?.status || "sent",
        description: finalDesc, paymentMethod: form.paymentMethod || "bacs",
        lineItems: form.lineItems || [],
        vatEnabled: form.vatEnabled, vatRate: form.vatZeroRated ? 0 : vatRate,
        vatZeroRated: form.vatZeroRated, vatType: form.vatType || "",
        cisEnabled: form.cisEnabled, cisRate: form.cisRate,
        cisLabour: labourAmt, cisMaterials: materialsAmt, cisDeduction, cisNetPayable,
        jobRef: form.jobRef || "", poNumber: form.poNumber || "",
        materialItems: form.materialItems || [],
      };
      if (isEditing) {
        onSent(payload);
      } else {
        setSent(true);
        setTimeout(() => onSent(payload), 1500);
      }
    } catch (e) {
      console.error("Invoice save error:", e);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }}>
      <div style={{ ...S.card, maxWidth: 880, width: "100%", marginBottom: 16, borderRadius: 14, overflow: "hidden" }}>
        {sent ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{isEditing ? "✅" : "✅"}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.green, marginBottom: 8 }}>{isEditing ? "Invoice Updated!" : "Invoice Sent!"}</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
              {isEditing ? "Changes saved successfully." : (form.paymentMethod === "card" || form.paymentMethod === "both") ? `Payment link sent to ${form.email}` : `BACS details sent to ${form.email}`}
            </div>
            {form.vatEnabled && (
              <div style={{ ...S.card, background: C.surfaceHigh, padding: 14, display: "inline-block", textAlign: "left", marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 8 }}>VAT BREAKDOWN</div>
                <div style={{ fontSize: 12, color: C.textDim }}>Net: £{netAmount.toFixed(2)} · VAT @ {form.vatRate}%: £{vatAmount.toFixed(2)} · Gross: £{grossAmount.toFixed(2)}</div>
              </div>
            )}
            <div style={{ ...S.card, background: C.surfaceHigh, textAlign: "left", marginBottom: 16, padding: 14, display: "inline-block" }}>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>PAYMENT REFERENCE</div>
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.06em", color: C.amber }}>{previewRef}</div>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 14, borderBottom: `1px solid ${C.border}`, marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{isEditing ? `Edit Invoice · ${initialData.id}` : "New Invoice"}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <MicButton form={form} setForm={setForm} accentColor={brand.accentColor} />
                <button onClick={() => {
                    const finalDesc = form.lineItems && form.lineItems.length > 0
                      ? form.lineItems.map(l => l.amount && l.amount !== "" ? `${l.desc||l.description}|${l.amount}` : (l.desc||l.description||"")).filter(Boolean).join("\n")
                      : form.desc;
                    downloadInvoicePDF(brand, {
                      id: isEditing ? initialData.id : "INV-043",
                      customer: form.customer || "Customer Name", email: form.email, address: form.address,
                      description: finalDesc, lineItems: form.lineItems || [], materialItems: form.materialItems || [],
                      amount: form.cisEnabled ? cisNetPayable : (lineItemsTotal !== null ? lineItemsTotal : grossAmount),
                      grossAmount: form.cisEnabled ? cisGross : (lineItemsTotal !== null ? lineItemsTotal : grossAmount),
                      due: `Due in ${form.due} days`, paymentMethod: form.paymentMethod,
                      vatEnabled: form.vatEnabled, vatRate: form.vatRate, vatType: form.vatType, vatZeroRated: form.vatZeroRated,
                      cisEnabled: form.cisEnabled, cisRate: form.cisRate,
                      cisLabour: labourAmt, cisMaterials: materialsAmt, cisDeduction, cisNetPayable,
                      jobRef: form.jobRef, poNumber: form.poNumber || "",
                    });
                  }} style={S.pill(brand.accentColor, false)} disabled={!valid}>Preview PDF</button>
                <button aria-label="Close" onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {customers && customers.length > 0 && !isEditing && (
                  <div>
                    <label style={S.label}>Pick existing customer (optional)</label>
                    <select
                      style={S.input}
                      value=""
                      onChange={e => {
                        const pickedId = e.target.value;
                        if (!pickedId) return;
                        const c = customers.find(x => String(x.id) === String(pickedId));
                        if (c) {
                          setForm(f => ({
                            ...f,
                            customer: c.name || c.customer_name || "",
                            email: c.email || "",
                            address: c.address || "",
                          }));
                        }
                      }}
                    >
                      <option value="">— New customer / type below —</option>
                      {[...customers].sort((a, b) => (a.name || "").localeCompare(b.name || "")).map(c => (
                        <option key={c.id} value={c.id}>{c.name}{c.email ? ` · ${c.email}` : ""}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div style={S.grid2}>
                  {[
                    { k: "customer", l: "Customer Name", p: "e.g. James Oliver" },
                    { k: "email", l: "Customer Email", p: "james@email.com" },
                    { k: "address", l: "Customer Address", p: "5 High Street, Guildford GU1 3AA" },
                  ].map(({ k, l, p }) => (
                    <div key={k}><label style={S.label}>{l}</label>
                      {k === "address" ? <textarea style={{ ...S.input, resize: "none", height: 60 }} placeholder={p} value={form[k]} onChange={set(k)} />
                        : <input style={S.input} placeholder={p} value={form[k]} onChange={set(k)} />}
                    </div>
                  ))}
                  {!form.cisEnabled && lineItemsTotal === null && (
                    <div><label style={S.label}>{form.vatEnabled && !form.vatZeroRated ? `Amount inc. VAT @ ${vatRate}% (£)` : "Amount (£)"}</label>
                      <input style={S.input} placeholder="e.g. 480" value={form.amount} onChange={set("amount")} />
                    </div>
                  )}
                  {!form.cisEnabled && lineItemsTotal !== null && (
                    <div>
                      <label style={S.label}>Total from line items</label>
                      <div style={{ ...S.input, color: C.amber, fontWeight: 700, cursor: "default" }}>£{lineItemsTotal.toFixed(2)}</div>
                    </div>
                  )}
                </div>

                {/* CIS toggle */}
                <div style={{ padding: "14px 16px", background: form.cisEnabled ? "#f59e0b11" : C.surfaceHigh, borderRadius: 8, border: `1px solid ${form.cisEnabled ? "#f59e0b66" : C.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: form.cisEnabled ? 14 : 0 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>CIS — Construction Industry Scheme</div>
                      <div style={{ fontSize: 11, color: C.muted }}>For subcontracting to contractors who deduct CIS tax from labour</div>
                    </div>
                    <button onClick={() => setForm(f => ({ ...f, cisEnabled: !f.cisEnabled }))} style={{ padding: "6px 14px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 12, fontFamily: "'DM Mono',monospace", fontWeight: 700, background: form.cisEnabled ? C.amber : C.border, color: form.cisEnabled ? "#000" : C.muted, transition: "all 0.2s", flexShrink: 0, marginLeft: 12 }}>
                      {form.cisEnabled ? "CIS On ✓" : "Enable CIS"}
                    </button>
                  </div>
                  {form.cisEnabled && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div>
                        <label style={S.label}>Labour (£)</label>
                        <input style={S.input} type="number" placeholder="e.g. 400" value={form.labour} onChange={set("labour")} />
                      </div>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <label style={S.label}>Materials <span style={{ color: C.muted, fontWeight: 400 }}>(no CIS deduction)</span></label>
                          <button onClick={() => setForm(f => ({ ...f, materialItems: [...(f.materialItems || [{ desc: "", amount: "" }]), { desc: "", amount: "" }] }))} style={{ ...S.btn("ghost"), fontSize: 11, padding: "3px 10px" }}>+ Add line</button>
                        </div>
                        {(form.materialItems || [{ desc: "", amount: "" }]).map((item, i) => (
                          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
                            <input style={{ ...S.input, flex: 1 }} placeholder="e.g. Boiler unit" value={item.desc} onChange={e => setForm(f => { const next = [...(f.materialItems || [{ desc: "", amount: "" }])]; next[i] = { ...next[i], desc: e.target.value }; return { ...f, materialItems: next, materials: String(next.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0)) }; })} />
                            <input style={{ ...S.input, width: 90, flexShrink: 0 }} type="number" placeholder="£" value={item.amount} onChange={e => setForm(f => { const next = [...(f.materialItems || [{ desc: "", amount: "" }])]; next[i] = { ...next[i], amount: e.target.value }; return { ...f, materialItems: next, materials: String(next.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0)) }; })} />
                            {(form.materialItems || []).length > 1 && <button onClick={() => setForm(f => { const next = f.materialItems.filter((_, j) => j !== i); return { ...f, materialItems: next, materials: String(next.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0)) }; })} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: "0 4px", flexShrink: 0 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>}
                          </div>
                        ))}
                      </div>
                      <div>
                        <label style={S.label}>CIS Deduction Rate</label>
                        <div style={{ display: "flex", gap: 8 }}>
                          {[{ v: 20, l: "20% — Registered" }, { v: 30, l: "30% — Unregistered" }].map(({ v, l }) => (
                            <button key={v} onClick={() => setForm(f => ({ ...f, cisRate: v }))} style={{ ...S.pill(C.amber, form.cisRate === v), fontSize: 11 }}>{l}</button>
                          ))}
                        </div>
                      </div>
                      {(labourAmt > 0 || materialsAmt > 0) && (
                        <div style={{ background: C.surface, borderRadius: 8, padding: "12px 14px", border: `1px solid ${C.border}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span style={{ color: C.muted }}>Labour</span><span>£{labourAmt.toFixed(2)}</span></div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span style={{ color: C.muted }}>Materials</span><span>£{materialsAmt.toFixed(2)}</span></div>
                          {form.vatEnabled && !form.vatZeroRated && !form.vatType?.includes("drc") && (
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span style={{ color: C.muted }}>VAT @ {form.vatRate}%</span><span>£{(cisGross * form.vatRate / 100).toFixed(2)}</span></div>
                          )}
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}><span style={{ color: C.muted }}>Gross Total</span><span>£{(cisGross + (form.vatEnabled && !form.vatType?.includes("drc") ? cisGross * form.vatRate / 100 : 0)).toFixed(2)}</span></div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4, color: C.red }}><span>CIS Deduction ({form.cisRate}% of labour)</span><span>-£{cisDeduction.toFixed(2)}</span></div>
                          {form.vatEnabled && form.vatType?.includes("drc") && (
                            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>DRC — contractor accounts for VAT @ {form.vatRate}%</div>
                          )}
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, color: C.green }}><span>Net Payable to You</span><span>£{(cisNetPayable + (form.vatEnabled && !form.vatType?.includes("drc") ? cisGross * form.vatRate / 100 : 0)).toFixed(2)}</span></div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Line items */}
                <LineItemsBuilder form={form} setForm={setForm} accentColor={brand.accentColor} />

                {/* VAT toggle */}
                {isVatRegistered ? (
                  <div style={{ padding: "14px 16px", background: C.surfaceHigh, borderRadius: 8, border: `1px solid ${(form.vatEnabled || form.vatZeroRated) ? C.amber + "66" : C.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: (form.vatEnabled && !form.vatZeroRated && grossAmount > 0) || form.vatZeroRated ? 8 : 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>VAT</div>
                      <select
                        value={form.vatZeroRated ? "zero" : form.vatEnabled ? `${form.vatRate}_${form.vatType || "income"}` : "none"}
                        onChange={e => {
                          const v = e.target.value;
                          if (v === "none") setForm(f => ({ ...f, vatEnabled: false, vatZeroRated: false, vatType: "" }));
                          else if (v === "zero") setForm(f => ({ ...f, vatEnabled: true, vatZeroRated: true, vatRate: 0, vatType: "zero" }));
                          else {
                            const parts = v.split("_");
                            const rate = parseInt(parts[0]);
                            const type = parts.slice(1).join("_"); // handles "income", "expenses", "drc_income", "drc_expenses"
                            setForm(f => ({ ...f, vatEnabled: true, vatZeroRated: false, vatRate: rate, vatType: type }));
                          }
                        }}
                        style={{ ...S.input, width: "auto", minWidth: 260, padding: "6px 10px" }}
                      >
                        <option value="none">No VAT</option>
                        <option value="5_income">5% Income</option>
                        <option value="5_expenses">5% Expenses</option>
                        <option value="20_income">20% Income</option>
                        <option value="20_expenses">20% Expenses</option>
                        <option value="zero">Zero Rate 0% — New Build</option>
                        <option value="5_drc_income">Domestic Reverse Charge @ 5% Income</option>
                        <option value="5_drc_expenses">Domestic Reverse Charge @ 5% Expenses</option>
                        <option value="20_drc_income">Domestic Reverse Charge @ 20% Income</option>
                        <option value="20_drc_expenses">Domestic Reverse Charge @ 20% Expenses</option>
                      </select>
                    </div>
                    {form.vatZeroRated && (
                      <div style={{ fontSize: 11, color: C.green }}>✓ Zero-rated — new residential build. Xero code: ZERORATEDOUTPUT</div>
                    )}
                    {form.vatEnabled && !form.vatZeroRated && grossAmount > 0 && (
                      <div style={{ fontSize: 11, color: C.muted }}>Net: £{netAmount.toFixed(2)} + VAT £{vatAmount.toFixed(2)} = Gross £{grossAmount.toFixed(2)}</div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 11, color: C.muted }}>
                    VAT registered? Add your VAT number in Settings to enable VAT invoices. Zero-rated new build option also available.
                  </div>
                )}

                <div style={S.grid2}>
                  <div>
                    <label style={S.label}>Payment Due</label>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {["0", "7", "14"].map(d => <button key={d} onClick={() => setForm(f => ({ ...f, due: d }))} style={S.pill(brand.accentColor, form.due === d)}>{d} days</button>)}
                      <button onClick={() => setForm(f => ({ ...f, due: "custom" }))} style={S.pill(brand.accentColor, !["0","7","14"].includes(form.due))}>Custom</button>
                    </div>
                    {!["0","7","14"].includes(form.due) && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                        <input
                          style={{ ...S.input, width: 80 }}
                          type="number"
                          min="1"
                          placeholder="e.g. 60"
                          value={form.due === "custom" ? "" : form.due}
                          onChange={e => setForm(f => ({ ...f, due: e.target.value }))}
                        />
                        <span style={{ fontSize: 12, color: C.muted }}>days</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={S.label}>Payment Method</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {[{ v: "bacs", label: "🏦 BACS" }, { v: "card", label: "💳 Card" }, { v: "both", label: "🏦💳 Both" }].map(({ v, label }) => (
                        <button key={v} onClick={() => setForm(f => ({ ...f, paymentMethod: v }))} style={S.pill(brand.accentColor, form.paymentMethod === v)}>{label}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8, border: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>PAYMENT REFERENCE CUSTOMER MUST USE</div>
                    <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.06em", color: brand.accentColor }}>{previewRef}</div>
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, textAlign: "right" }}>
                    Format: {brand.refFormat?.replace(/_/g, " ")}<br />
                    <span style={{ fontSize: 10 }}>Change in Settings</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  {isEditing
                    ? <button style={S.btn("primary", !valid)} disabled={!valid} onClick={send}>Save Changes →</button>
                    : (form.paymentMethod === "card" || form.paymentMethod === "both")
                      ? <button style={S.btn("stripe", !valid)} disabled={!valid} onClick={send}><span style={{ fontWeight: 900 }}>S</span> Send via Stripe →</button>
                      : <button style={S.btn("primary", !valid)} disabled={!valid} onClick={send}>Send Invoice →</button>
                  }
                </div>
              </div>
          </>
        )}
      </div>
    </div>
  );
}
