import { useState } from "react";
import { C } from "../theme/colors.js";
import { S } from "../theme/styles.js";

export function LineItemsBuilder({ form, setForm, accentColor, isQuote }) {
  // Normalise lineItems — support both {desc} and {description} keys
  const items = form.lineItems && form.lineItems.length > 0
    ? form.lineItems.map(l => ({ desc: l.desc ?? l.description ?? "", amount: l.amount ?? "" }))
    : [{ desc: form.desc || "", amount: "" }];

  const [useIndividualPrices, setUseIndividualPrices] = useState(
    form.lineItems && form.lineItems.some(l => l.amount && l.amount !== "")
  );

  const updateItem = (i, key, val) => {
    const next = items.map((item, idx) => idx === i ? { ...item, [key]: val } : item);
    setForm(f => ({ ...f, lineItems: next, desc: next.map(l => l.desc).filter(Boolean).join("\n") }));
  };

  const addItem = () => {
    const next = [...items, { desc: "", amount: "" }];
    setForm(f => ({ ...f, lineItems: next }));
  };

  const removeItem = (i) => {
    const next = items.filter((_, idx) => idx !== i);
    setForm(f => ({ ...f, lineItems: next, desc: next.map(l => l.desc).filter(Boolean).join("\n") }));
  };

  const total = useIndividualPrices ? items.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0) : null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <label style={S.label}>{isQuote ? "Scope of Work" : "Line Items"}</label>
        <button
          onClick={() => {
            const next = !useIndividualPrices;
            setUseIndividualPrices(next);
            if (!next) setForm(f => ({ ...f, lineItems: items.map(l => ({ ...l, amount: "" })) }));
          }}
          style={{ ...S.btn("ghost"), fontSize: 10, padding: "3px 10px" }}
        >
          {useIndividualPrices ? "✓ Individual prices" : "Add individual prices"}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              style={{ ...S.input, flex: 1 }}
              placeholder={isQuote ? `e.g. Supply and fit new boiler` : `e.g. Boiler service`}
              value={item.desc}
              onChange={e => updateItem(i, "desc", e.target.value)}
            />
            {useIndividualPrices && (
              <input
                style={{ ...S.input, width: 90, flexShrink: 0 }}
                type="number"
                placeholder="£"
                value={item.amount}
                onChange={e => updateItem(i, "amount", e.target.value)}
              />
            )}
            {items.length > 1 && (
              <button onClick={() => removeItem(i)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: "0 4px", flexShrink: 0 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
        <button onClick={addItem} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px" }}>+ Add line</button>
        {useIndividualPrices && total !== null && (
          <div style={{ fontSize: 12, color: C.muted }}>
            Total: <span style={{ fontWeight: 700, color: C.text }}>£{total.toFixed(2)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
