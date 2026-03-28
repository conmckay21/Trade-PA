import { useState, useRef, useEffect } from "react";

const C = {
  bg: "#0f0f0f", surface: "#1a1a1a", surfaceHigh: "#242424",
  border: "#2a2a2a", amber: "#f59e0b", amberDim: "#92400e",
  green: "#10b981", red: "#ef4444", blue: "#3b82f6", purple: "#8b5cf6",
  muted: "#6b7280", text: "#e5e5e5", textDim: "#9ca3af",
};

const S = {
  app: { fontFamily: "'DM Mono','Courier New',monospace", background: C.bg, minHeight: "100vh", color: C.text },
  header: { background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56, position: "sticky", top: 0, zIndex: 100 },
  logo: { display: "flex", alignItems: "center", gap: 10, fontWeight: 700, fontSize: 16, letterSpacing: "0.05em", color: C.amber },
  logoIcon: { width: 32, height: 28, background: C.amber, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: "#000", fontSize: 11, fontWeight: 900, letterSpacing: "-0.02em" },
  nav: { display: "flex", gap: 4 },
  navBtn: (a) => ({ padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontFamily: "'DM Mono',monospace", fontWeight: a ? 700 : 400, letterSpacing: "0.04em", background: a ? C.amber : "transparent", color: a ? "#000" : C.textDim, transition: "all 0.15s" }),
  main: { flex: 1, padding: 24, maxWidth: 1200, width: "100%", margin: "0 auto" },
  card: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 },
  grid4: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 },
  sectionTitle: { fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginBottom: 16 },
  badge: (color) => ({ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", background: color + "22", color, border: `1px solid ${color}44` }),
  pill: (color, active) => ({ padding: "6px 14px", borderRadius: 6, border: `1px solid ${active ? color : C.border}`, background: active ? color + "22" : C.surfaceHigh, color: active ? color : C.textDim, cursor: "pointer", fontSize: 11, fontFamily: "'DM Mono',monospace", fontWeight: 600 }),
  btn: (v = "primary", dis = false) => ({ padding: "8px 16px", borderRadius: 6, border: v === "ghost" ? `1px solid ${C.border}` : "none", cursor: dis ? "not-allowed" : "pointer", fontSize: 12, fontFamily: "'DM Mono',monospace", fontWeight: 600, letterSpacing: "0.04em", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6, background: dis ? C.surfaceHigh : v === "primary" ? C.amber : v === "stripe" ? "#635bff" : v === "danger" ? C.red : v === "green" ? C.green : C.surfaceHigh, color: dis ? C.muted : v === "primary" ? "#000" : v === "green" ? "#000" : C.text, opacity: dis ? 0.6 : 1, transition: "all 0.15s" }),
  input: { width: "100%", background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 13, fontFamily: "'DM Mono',monospace", outline: "none", boxSizing: "border-box" },
  label: { fontSize: 11, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6, display: "block" },
  row: { display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${C.border}` },
  statCard: (accent) => ({ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${accent}`, borderRadius: 10, padding: 20 }),
  aiMsg: (r) => ({ display: "flex", gap: 10, marginBottom: 16, flexDirection: r === "user" ? "row-reverse" : "row" }),
  aiBubble: (r) => ({ maxWidth: "80%", padding: "10px 14px", borderRadius: r === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px", background: r === "user" ? C.amberDim : C.surfaceHigh, border: `1px solid ${r === "user" ? C.amber + "44" : C.border}`, fontSize: 13, lineHeight: 1.6, color: C.text, whiteSpace: "pre-wrap" }),
  avatar: (r) => ({ width: 30, height: 30, borderRadius: "50%", background: r === "user" ? C.amber : C.surface, border: `1px solid ${r === "user" ? C.amber : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: r === "user" ? "#000" : C.amber, flexShrink: 0 }),
};

const JOBS = [
  { id: 1, customer: "Mike Patterson", address: "14 Elm Close, Guildford", type: "Boiler Service", date: "Mon 09:00", status: "confirmed", value: 120 },
  { id: 2, customer: "Sarah Chen", address: "7 Brook Lane, Woking", type: "Leak Repair", date: "Mon 13:30", status: "confirmed", value: 85 },
  { id: 3, customer: "David Marsh", address: "3 Oak Avenue, Farnham", type: "New Radiator", date: "Tue 10:00", status: "pending", value: 340 },
  { id: 4, customer: "Lisa Fox", address: "22 Cedar Rd, Guildford", type: "Annual Service", date: "Thu 09:00", status: "confirmed", value: 120 },
  { id: 5, customer: "Tom Harris", address: "9 Pine Way, Woking", type: "Bathroom Fit", date: "Fri 08:00", status: "quote_sent", value: 2400 },
];
const INVOICES_INIT = [
  { id: "INV-041", customer: "James Oliver", amount: 480, due: "3 days overdue", status: "overdue" },
  { id: "INV-039", customer: "Rachel Green", amount: 120, due: "Due today", status: "due" },
  { id: "INV-038", customer: "Paul Wright", amount: 650, due: "Due in 5 days", status: "pending" },
  { id: "INV-036", customer: "Anna Black", amount: 280, due: "Paid 2 days ago", status: "paid" },
];
const ENQUIRIES = [
  { name: "Kevin Nash", source: "WhatsApp", msg: "Hi mate, need someone to look at my boiler, been cutting out. Any chance this week?", time: "2m ago", urgent: true },
  { name: "Emma Taylor", source: "Email", msg: "Could you provide a quote for a full bathroom renovation? Looking to start in about 6 weeks.", time: "1hr ago", urgent: false },
  { name: "Chris Ball", source: "Facebook", msg: "Do you cover the GU11 area? Need a gas certificate done.", time: "3hr ago", urgent: false },
];
const MATERIALS = [
  { item: "Copper pipe 22mm x 3m", qty: 10, supplier: "City Plumbing", status: "to_order", job: "Bathroom Fit - Harris" },
  { item: "Thermostatic rad valve pair", qty: 4, supplier: "Screwfix", status: "ordered", job: "New Radiator - Marsh" },
  { item: "Fernox filter + inhibitor", qty: 2, supplier: "Wolseley", status: "collected", job: "Boiler Service" },
];
const statusColor = { confirmed: C.green, pending: C.amber, quote_sent: C.blue, overdue: C.red, due: C.amber, paid: C.green, to_order: C.red, ordered: C.amber, collected: C.green, sent: C.amber, draft: C.muted };
const statusLabel = { confirmed: "Confirmed", pending: "Pending", quote_sent: "Quote Sent", overdue: "Overdue", due: "Due Today", paid: "Paid", to_order: "To Order", ordered: "Ordered", collected: "Collected", sent: "Sent", draft: "Draft" };

const DEFAULT_BRAND = {
  logo: null,
  tradingName: "Dave's Plumbing & Heating",
  tagline: "Gas Safe Registered · Fully Insured",
  phone: "07700 900123",
  email: "dave@davesplumbing.co.uk",
  website: "www.davesplumbing.co.uk",
  address: "14 Station Road\nGuildford, GU1 4AH",
  gasSafeNumber: "123456",
  vatNumber: "",
  bankName: "Barclays",
  sortCode: "40-47-84",
  accountNumber: "12345678",
  accountName: "D Hughes",
  accentColor: "#f59e0b",
  paymentTerms: "30",
  invoiceNote: "Thank you for your business. Payment due within 30 days.",
  // Payment reference
  refFormat: "invoice_number",   // invoice_number | surname_invoice | custom_prefix | number_only
  refPrefix: "DPH",              // used when refFormat === "custom_prefix"
  // Default payment method shown on invoices
  defaultPaymentMethod: "both",  // bacs | card | both
};

// Helper: build the payment reference string for a given invoice
function buildRef(brand, inv) {
  const num = (inv.id || "INV-001").replace(/\D/g, "");
  const surname = (inv.customer || "").split(" ").pop().toUpperCase();
  switch (brand.refFormat) {
    case "surname_invoice": return `${surname}-${inv.id || "INV-001"}`;
    case "custom_prefix":   return `${brand.refPrefix || "REF"}-${num}`;
    case "number_only":     return num;
    default:                return inv.id || "INV-001";
  }
}

// ─── Invoice Preview ──────────────────────────────────────────────────────────
function InvoicePreview({ brand, invoice }) {
  const inv = invoice || { id: "INV-042", customer: "John Smith", address: "5 High Street\nGuildford GU1 3AA", desc: "Annual boiler service\nFlue check and clean\nPressure test", amount: 120, date: new Date().toLocaleDateString("en-GB"), due: "30 days", paymentMethod: brand.defaultPaymentMethod || "both" };
  const accent = brand.accentColor || "#f59e0b";
  const ref = buildRef(brand, inv);
  const payMethod = inv.paymentMethod || brand.defaultPaymentMethod || "both";
  const showBacs = payMethod === "bacs" || payMethod === "both";
  const showCard = payMethod === "card" || payMethod === "both";

  return (
    <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden", fontFamily: "Georgia, serif", color: "#1a1a1a", boxShadow: "0 4px 24px #0008", maxWidth: 560, width: "100%" }}>
      {/* Header */}
      <div style={{ background: accent, padding: "24px 28px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          {brand.logo
            ? <img src={brand.logo} alt="logo" style={{ maxHeight: 56, maxWidth: 160, objectFit: "contain", marginBottom: 6, display: "block" }} />
            : <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em", marginBottom: 4 }}>{brand.tradingName}</div>}
          {brand.tagline && <div style={{ fontSize: 11, color: "#ffffffcc", fontFamily: "Arial,sans-serif" }}>{brand.tagline}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "0.05em" }}>INVOICE</div>
          <div style={{ fontSize: 13, color: "#ffffffcc", fontFamily: "Arial,sans-serif", marginTop: 4 }}>{inv.id}</div>
        </div>
      </div>

      {/* Info bar */}
      <div style={{ background: "#f8f8f8", padding: "14px 28px", display: "flex", justifyContent: "space-between", borderBottom: "1px solid #eee" }}>
        <div style={{ fontFamily: "Arial,sans-serif", fontSize: 12 }}>
          <span style={{ color: "#888", marginRight: 6 }}>Date:</span>{inv.date}
        </div>
        <div style={{ fontFamily: "Arial,sans-serif", fontSize: 12 }}>
          <span style={{ color: "#888", marginRight: 6 }}>Payment due:</span>{brand.paymentTerms || "30"} days
        </div>
        {brand.vatNumber && (
          <div style={{ fontFamily: "Arial,sans-serif", fontSize: 12 }}>
            <span style={{ color: "#888", marginRight: 6 }}>VAT No:</span>{brand.vatNumber}
          </div>
        )}
      </div>

      {/* Addresses */}
      <div style={{ padding: "20px 28px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, borderBottom: "1px solid #eee" }}>
        <div>
          <div style={{ fontSize: 10, fontFamily: "Arial,sans-serif", textTransform: "uppercase", letterSpacing: "0.08em", color: "#888", marginBottom: 8 }}>From</div>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "Arial,sans-serif", marginBottom: 4 }}>{brand.tradingName}</div>
          <div style={{ fontSize: 12, fontFamily: "Arial,sans-serif", color: "#444", lineHeight: 1.7, whiteSpace: "pre-line" }}>{brand.address}</div>
          {brand.phone && <div style={{ fontSize: 12, fontFamily: "Arial,sans-serif", color: "#444", marginTop: 4 }}>{brand.phone}</div>}
          {brand.email && <div style={{ fontSize: 12, fontFamily: "Arial,sans-serif", color: accent }}>{brand.email}</div>}
          {brand.gasSafeNumber && <div style={{ fontSize: 11, fontFamily: "Arial,sans-serif", color: "#888", marginTop: 6 }}>Gas Safe: {brand.gasSafeNumber}</div>}
        </div>
        <div>
          <div style={{ fontSize: 10, fontFamily: "Arial,sans-serif", textTransform: "uppercase", letterSpacing: "0.08em", color: "#888", marginBottom: 8 }}>To</div>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "Arial,sans-serif", marginBottom: 4 }}>{inv.customer}</div>
          <div style={{ fontSize: 12, fontFamily: "Arial,sans-serif", color: "#444", lineHeight: 1.7, whiteSpace: "pre-line" }}>{inv.address}</div>
        </div>
      </div>

      {/* Line items */}
      <div style={{ padding: "0 28px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Arial,sans-serif" }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${accent}` }}>
              <th style={{ textAlign: "left", padding: "12px 0 8px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "#888" }}>Description</th>
              <th style={{ textAlign: "right", padding: "12px 0 8px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "#888" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {(inv.desc || "").split("\n").filter(Boolean).map((line, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "10px 0", fontSize: 13 }}>{line}</td>
                <td style={{ padding: "10px 0", fontSize: 13, textAlign: "right", color: i === 0 ? "#1a1a1a" : "#888" }}>{i === 0 ? `£${inv.amount}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Total */}
      <div style={{ margin: "0 28px", borderTop: `2px solid ${accent}`, padding: "14px 0", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 20 }}>
        <div style={{ fontFamily: "Arial,sans-serif", fontSize: 13, color: "#888" }}>Total Due</div>
        <div style={{ fontFamily: "Arial,sans-serif", fontSize: 22, fontWeight: 900, color: accent }}>£{inv.amount}</div>
      </div>

      {/* Payment section */}
      <div style={{ margin: "0 28px 20px", display: "flex", flexDirection: "column", gap: 10 }}>

        {/* BACS block */}
        {showBacs && (
          <div style={{ background: "#f8f8f8", borderRadius: 6, padding: "14px 16px", border: "1px solid #eee" }}>
            <div style={{ fontSize: 10, fontFamily: "Arial,sans-serif", textTransform: "uppercase", letterSpacing: "0.08em", color: "#888", marginBottom: 10 }}>
              {showCard ? "Option 1 — Pay by Bank Transfer (BACS)" : "Pay by Bank Transfer (BACS)"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px", fontFamily: "Arial,sans-serif", fontSize: 12 }}>
              <div><span style={{ color: "#888" }}>Bank: </span><strong>{brand.bankName}</strong></div>
              <div><span style={{ color: "#888" }}>Account name: </span><strong>{brand.accountName}</strong></div>
              <div><span style={{ color: "#888" }}>Sort code: </span><strong>{brand.sortCode}</strong></div>
              <div><span style={{ color: "#888" }}>Account no: </span><strong>{brand.accountNumber}</strong></div>
            </div>
            <div style={{ marginTop: 10, padding: "8px 12px", background: accent + "18", borderRadius: 4, border: `1px solid ${accent}44`, fontFamily: "Arial,sans-serif", fontSize: 12 }}>
              <span style={{ color: "#888" }}>⚠ Payment reference: </span>
              <strong style={{ color: "#1a1a1a", letterSpacing: "0.04em" }}>{ref}</strong>
              <span style={{ color: "#888", fontSize: 11, marginLeft: 8 }}>(please use exactly as shown)</span>
            </div>
          </div>
        )}

        {/* Card / Stripe block */}
        {showCard && (
          <div style={{ background: "#635bff11", borderRadius: 6, padding: "14px 16px", border: "1px solid #635bff33" }}>
            <div style={{ fontSize: 10, fontFamily: "Arial,sans-serif", textTransform: "uppercase", letterSpacing: "0.08em", color: "#635bff", marginBottom: 8 }}>
              {showBacs ? "Option 2 — Pay by Card (Stripe)" : "Pay by Card (Stripe)"}
            </div>
            <div style={{ fontFamily: "Arial,sans-serif", fontSize: 12, color: "#444", marginBottom: 10 }}>
              Pay securely online by debit or credit card. Takes 30 seconds.
            </div>
            <div style={{ display: "inline-block", padding: "8px 18px", background: "#635bff", borderRadius: 5, fontFamily: "Arial,sans-serif", fontSize: 12, fontWeight: 700, color: "#fff", letterSpacing: "0.04em" }}>
              Pay £{inv.amount} online →
            </div>
            <div style={{ fontFamily: "Arial,sans-serif", fontSize: 10, color: "#888", marginTop: 8 }}>
              https://pay.stripe.com/i/acct_1Ox8.../inv_sample
            </div>
          </div>
        )}

        <div style={{ fontFamily: "Arial,sans-serif", fontSize: 11, color: "#888" }}>{brand.invoiceNote}</div>
      </div>

      {/* Footer */}
      <div style={{ background: accent + "22", padding: "10px 28px", display: "flex", justifyContent: "space-between", fontFamily: "Arial,sans-serif", fontSize: 11, color: "#666", borderTop: `1px solid ${accent}44` }}>
        {brand.website && <span>{brand.website}</span>}
        {brand.phone && <span>{brand.phone}</span>}
        {brand.email && <span>{brand.email}</span>}
      </div>
    </div>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function Settings({ brand, setBrand }) {
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState(false);
  const logoRef = useRef();
  const set = (k) => (e) => setBrand(b => ({ ...b, [k]: e.target.value }));

  const handleLogo = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setBrand(b => ({ ...b, logo: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const ACCENT_PRESETS = ["#f59e0b", "#3b82f6", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#0ea5e9", "#1a1a1a"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Branding & Settings</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>These details appear on every invoice and customer communication.</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={S.btn("ghost")} onClick={() => setPreview(true)}>Preview Invoice →</button>
          <button style={S.btn(saved ? "green" : "primary")} onClick={save}>{saved ? "✓ Saved" : "Save Changes"}</button>
        </div>
      </div>

      <div style={S.grid2}>
        {/* Logo upload */}
        <div style={S.card}>
          <div style={S.sectionTitle}>Logo</div>
          <div
            onClick={() => logoRef.current.click()}
            style={{ border: `2px dashed ${brand.logo ? C.green : C.border}`, borderRadius: 10, padding: 24, textAlign: "center", cursor: "pointer", transition: "all 0.2s", background: brand.logo ? C.green + "08" : "transparent" }}
          >
            {brand.logo
              ? <img src={brand.logo} alt="logo" style={{ maxHeight: 80, maxWidth: 200, objectFit: "contain", margin: "0 auto 10px", display: "block" }} />
              : <div style={{ fontSize: 32, marginBottom: 8 }}>🖼</div>}
            <div style={{ fontSize: 12, color: brand.logo ? C.green : C.muted }}>{brand.logo ? "Click to change logo" : "Click to upload logo"}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>PNG or JPG, max 2MB. Transparent PNG works best.</div>
            <input ref={logoRef} type="file" accept="image/*" onChange={handleLogo} style={{ display: "none" }} />
          </div>
          {brand.logo && (
            <button style={{ ...S.btn("ghost"), marginTop: 10, fontSize: 11 }} onClick={() => setBrand(b => ({ ...b, logo: null }))}>Remove logo</button>
          )}
        </div>

        {/* Accent colour */}
        <div style={S.card}>
          <div style={S.sectionTitle}>Brand Colour</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            {ACCENT_PRESETS.map(col => (
              <div key={col} onClick={() => setBrand(b => ({ ...b, accentColor: col }))} style={{ width: 36, height: 36, borderRadius: 8, background: col, cursor: "pointer", border: `3px solid ${brand.accentColor === col ? "#fff" : "transparent"}`, transition: "all 0.15s", boxShadow: brand.accentColor === col ? `0 0 0 1px ${col}` : "none" }} />
            ))}
          </div>
          <label style={S.label}>Custom Colour</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="color" value={brand.accentColor} onChange={e => setBrand(b => ({ ...b, accentColor: e.target.value }))} style={{ width: 44, height: 36, borderRadius: 8, border: `1px solid ${C.border}`, background: "none", cursor: "pointer", padding: 2 }} />
            <input style={{ ...S.input, flex: 1 }} value={brand.accentColor} onChange={set("accentColor")} placeholder="#f59e0b" />
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={S.sectionTitle}>Preview</div>
            <div style={{ height: 6, borderRadius: 3, background: brand.accentColor, marginBottom: 8 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ padding: "6px 14px", borderRadius: 6, background: brand.accentColor, color: "#fff", fontSize: 12, fontWeight: 700 }}>Button</div>
              <div style={{ padding: "6px 14px", borderRadius: 6, background: brand.accentColor + "22", border: `1px solid ${brand.accentColor}`, color: brand.accentColor, fontSize: 12, fontWeight: 700 }}>Badge</div>
            </div>
          </div>
        </div>
      </div>

      {/* Business Info */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Business Information</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          {[
            { k: "tradingName", l: "Trading Name" },
            { k: "tagline", l: "Tagline (shown on invoice)" },
            { k: "phone", l: "Phone Number" },
            { k: "email", l: "Email Address" },
            { k: "website", l: "Website" },
            { k: "gasSafeNumber", l: "Gas Safe Number" },
            { k: "vatNumber", l: "VAT Number (if registered)" },
          ].map(({ k, l }) => (
            <div key={k}>
              <label style={S.label}>{l}</label>
              <input style={S.input} value={brand[k]} onChange={set(k)} />
            </div>
          ))}
          <div>
            <label style={S.label}>Business Address</label>
            <textarea style={{ ...S.input, resize: "vertical", minHeight: 72 }} value={brand.address} onChange={set("address")} />
          </div>
        </div>
      </div>

      {/* Payment + Invoice Settings */}
      <div style={S.grid2}>
        <div style={S.card}>
          <div style={S.sectionTitle}>Bank Details (shown on invoice)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { k: "bankName", l: "Bank Name" },
              { k: "sortCode", l: "Sort Code" },
              { k: "accountNumber", l: "Account Number" },
              { k: "accountName", l: "Account Name" },
            ].map(({ k, l }) => (
              <div key={k}>
                <label style={S.label}>{l}</label>
                <input style={S.input} value={brand[k]} onChange={set(k)} />
              </div>
            ))}
          </div>
        </div>

        <div style={S.card}>
          <div style={S.sectionTitle}>Invoice Defaults</div>

          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Default Payment Terms</label>
            <div style={{ display: "flex", gap: 8 }}>
              {["7", "14", "30"].map(d => (
                <button key={d} onClick={() => setBrand(b => ({ ...b, paymentTerms: d }))} style={S.pill(brand.accentColor, brand.paymentTerms === d)}>{d} days</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Payment Method on Invoices</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { v: "bacs", label: "🏦 BACS only" },
                { v: "card", label: "💳 Card only" },
                { v: "both", label: "🏦💳 Both options" },
              ].map(({ v, label }) => (
                <button key={v} onClick={() => setBrand(b => ({ ...b, defaultPaymentMethod: v }))} style={S.pill(brand.accentColor, brand.defaultPaymentMethod === v)}>{label}</button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
              {brand.defaultPaymentMethod === "bacs" && "Invoice shows bank details only. Good for customers who prefer traditional bank transfer."}
              {brand.defaultPaymentMethod === "card" && "Invoice shows a Stripe payment link only. Fastest way to get paid."}
              {brand.defaultPaymentMethod === "both" && "Invoice shows both options. Customer chooses. Recommended for mixed customer base."}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Payment Reference Format</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { v: "invoice_number", label: "Invoice number", example: "INV-041" },
                { v: "surname_invoice", label: "Surname + invoice", example: "OLIVER-INV-041" },
                { v: "custom_prefix", label: "Custom prefix + number", example: `${brand.refPrefix || "DPH"}-041` },
                { v: "number_only", label: "Number only", example: "041" },
              ].map(({ v, label, example }) => (
                <div key={v} onClick={() => setBrand(b => ({ ...b, refFormat: v }))} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 8, border: `1px solid ${brand.refFormat === v ? brand.accentColor : C.border}`, background: brand.refFormat === v ? brand.accentColor + "11" : C.surfaceHigh, cursor: "pointer", transition: "all 0.15s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${brand.refFormat === v ? brand.accentColor : C.muted}`, background: brand.refFormat === v ? brand.accentColor : "transparent", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: brand.refFormat === v ? C.text : C.textDim }}>{label}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: brand.refFormat === v ? brand.accentColor : C.muted, letterSpacing: "0.04em" }}>{example}</span>
                </div>
              ))}
            </div>
            {brand.refFormat === "custom_prefix" && (
              <div style={{ marginTop: 10 }}>
                <label style={S.label}>Your Custom Prefix</label>
                <input style={S.input} value={brand.refPrefix || ""} onChange={e => setBrand(b => ({ ...b, refPrefix: e.target.value.toUpperCase() }))} placeholder="e.g. DPH, DAVE, PLB" maxLength={8} />
              </div>
            )}
            <div style={{ marginTop: 10, padding: "8px 12px", background: C.surfaceHigh, borderRadius: 6, border: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 11, color: C.muted }}>Preview: </span>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", color: C.text }}>{buildRef(brand, { id: "INV-041", customer: "James Oliver" })}</span>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Invoice Footer Note</label>
            <textarea style={{ ...S.input, resize: "vertical", minHeight: 70 }} value={brand.invoiceNote} onChange={set("invoiceNote")} />
          </div>
          <div>
            <label style={S.label}>Next Invoice Number</label>
            <input style={S.input} defaultValue="INV-043" />
          </div>
        </div>
      </div>

      {/* Certifications */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Certifications & Compliance</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          {[
            { label: "Gas Safe Registered", icon: "🔥", enabled: true },
            { label: "OFTEC Registered", icon: "🛢", enabled: false },
            { label: "NICEIC Approved", icon: "⚡", enabled: false },
            { label: "Which? Trusted Trader", icon: "✓", enabled: true },
          ].map((cert, i) => {
            const [on, setOn] = useState(cert.enabled);
            return (
              <div key={i} onClick={() => setOn(o => !o)} style={{ padding: "14px", background: on ? brand.accentColor + "11" : C.surfaceHigh, border: `1px solid ${on ? brand.accentColor + "44" : C.border}`, borderRadius: 8, cursor: "pointer", textAlign: "center", transition: "all 0.2s" }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>{cert.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: on ? C.text : C.muted }}>{cert.label}</div>
                <div style={{ fontSize: 10, color: on ? brand.accentColor : C.muted, marginTop: 4 }}>{on ? "Shown on invoice" : "Click to enable"}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Preview Modal */}
      {preview && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 24 }} onClick={() => setPreview(false)}>
          <div onClick={e => e.stopPropagation()} style={{ maxHeight: "90vh", overflowY: "auto", borderRadius: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: C.muted, fontFamily: "'DM Mono',monospace" }}>INVOICE PREVIEW</div>
              <button onClick={() => setPreview(false)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22 }}>×</button>
            </div>
            <InvoicePreview brand={brand} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ setView }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={S.grid3}>
        {[
          { label: "This Week Revenue", value: "£3,065", sub: "5 jobs scheduled", color: C.amber },
          { label: "Outstanding Invoices", value: "£1,250", sub: "3 invoices — 1 overdue", color: C.red },
          { label: "Open Quotes", value: "£3,180", sub: "2 quotes awaiting reply", color: C.green },
        ].map((stat, i) => (
          <div key={i} style={S.statCard(stat.color)}>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>{stat.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{stat.sub}</div>
          </div>
        ))}
      </div>
      <div style={S.grid2}>
        <div style={S.card}>
          <div style={S.sectionTitle}>Today's Jobs</div>
          {JOBS.filter(j => j.date.startsWith("Mon")).map(job => (
            <div key={job.id} style={S.row}>
              <div style={{ width: 4, height: 36, borderRadius: 2, background: statusColor[job.status], flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{job.customer}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{job.type} · {job.date}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.amber }}>£{job.value}</div>
            </div>
          ))}
        </div>
        <div style={S.card}>
          <div style={S.sectionTitle}>New Enquiries</div>
          {ENQUIRIES.map((e, i) => (
            <div key={i} style={{ ...S.row, alignItems: "flex-start" }}>
              <div style={{ width: 4, height: 36, borderRadius: 2, background: e.urgent ? C.red : C.blue, flexShrink: 0, marginTop: 4 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{e.name}</span>
                  <span style={S.badge(C.muted)}>{e.source}</span>
                  {e.urgent && <span style={S.badge(C.red)}>Urgent</span>}
                </div>
                <div style={{ fontSize: 11, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.msg}</div>
              </div>
              <div style={{ fontSize: 10, color: C.muted, flexShrink: 0 }}>{e.time}</div>
            </div>
          ))}
          <div style={{ marginTop: 12 }}><button style={S.btn("ghost")} onClick={() => setView("AI Assistant")}>Reply with AI →</button></div>
        </div>
      </div>
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={S.sectionTitle}>Invoice Pipeline</div>
          <button style={S.btn("ghost")} onClick={() => setView("Payments")}>Manage →</button>
        </div>
        {INVOICES_INIT.map(inv => (
          <div key={inv.id} style={S.row}>
            <div style={{ fontSize: 12, color: C.muted, width: 70 }}>{inv.id}</div>
            <div style={{ flex: 1 }}><span style={{ fontSize: 13, fontWeight: 600 }}>{inv.customer}</span></div>
            <div style={{ fontSize: 13, fontWeight: 700, marginRight: 16 }}>£{inv.amount}</div>
            <div style={{ width: 130, textAlign: "right" }}>
              <div style={S.badge(statusColor[inv.status])}>{statusLabel[inv.status]}</div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{inv.due}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Schedule ─────────────────────────────────────────────────────────────────
function Schedule() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const dates = { Mon: "24", Tue: "25", Wed: "26", Thu: "27", Fri: "28" };
  const dayJobs = { Mon: JOBS.filter(j => j.date.startsWith("Mon")), Tue: JOBS.filter(j => j.date.startsWith("Tue")), Wed: [], Thu: JOBS.filter(j => j.date.startsWith("Thu")), Fri: JOBS.filter(j => j.date.startsWith("Fri")) };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Week of 24 March 2026</div>
        <button style={S.btn("primary")}>+ Add Job</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
        {days.map(day => (
          <div key={day} style={{ ...S.card, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: C.muted, marginBottom: 12, textTransform: "uppercase" }}>{day} {dates[day]}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {dayJobs[day].length === 0 && <div style={{ fontSize: 11, color: C.border, fontStyle: "italic" }}>Free</div>}
              {dayJobs[day].map(job => (
                <div key={job.id} style={{ padding: "8px 10px", background: C.surfaceHigh, borderRadius: 6, borderLeft: `2px solid ${statusColor[job.status]}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 2 }}>{job.customer.split(" ")[0]}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>{job.type}</div>
                  <div style={{ fontSize: 10, color: C.amber, marginTop: 4 }}>£{job.value}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={S.card}>
        <div style={S.sectionTitle}>All Jobs This Week</div>
        {JOBS.map(job => (
          <div key={job.id} style={S.row}>
            <div style={{ width: 4, height: 40, borderRadius: 2, background: statusColor[job.status], flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{job.customer}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{job.address}</div>
            </div>
            <div style={{ fontSize: 12, color: C.textDim, marginRight: 12 }}>{job.type}</div>
            <div style={{ fontSize: 12, color: C.textDim, marginRight: 12 }}>{job.date}</div>
            <div style={S.badge(statusColor[job.status])}>{statusLabel[job.status]}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.amber, marginLeft: 16 }}>£{job.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Materials ────────────────────────────────────────────────────────────────
function Materials() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Materials & Orders</div>
        <button style={S.btn("primary")}>+ Add Material</button>
      </div>
      <div style={S.card}>
        <div style={S.sectionTitle}>Current Material List</div>
        {MATERIALS.map((m, i) => (
          <div key={i} style={S.row}>
            <div style={{ width: 4, height: 40, borderRadius: 2, background: statusColor[m.status], flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{m.item}</div>
              <div style={{ fontSize: 11, color: C.muted }}>For: {m.job}</div>
            </div>
            <div style={{ fontSize: 12, color: C.textDim, marginRight: 16 }}>Qty: {m.qty}</div>
            <div style={{ fontSize: 12, color: C.textDim, marginRight: 16 }}>{m.supplier}</div>
            <div style={S.badge(statusColor[m.status])}>{statusLabel[m.status]}</div>
          </div>
        ))}
      </div>
      <div style={S.card}>
        <div style={S.sectionTitle}>Supplier Quick Dial</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {["City Plumbing", "Screwfix", "Wolseley", "Toolstation", "BSS", "Plumb Center"].map(sup => (
            <div key={sup} style={{ padding: "12px 14px", background: C.surfaceHigh, borderRadius: 8, border: `1px solid ${C.border}`, cursor: "pointer" }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{sup}</div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>Tap to call / order</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── AI Assistant ─────────────────────────────────────────────────────────────
function AIAssistant({ brand }) {
  const [messages, setMessages] = useState([{ role: "assistant", content: "Hi! I'm your trades admin assistant.\n\nType or use 🎙 voice note — a new job, enquiry, invoice update, or ask me to draft a message.\n\nTry: \"Just finished at Sarah's, leak was a dodgy valve, charge her £95\"" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const SYSTEM = `You are a smart admin assistant for ${brand.tradingName}, a UK sole trader trades business.
Outstanding invoices: INV-041 James Oliver £480 (3 days overdue), INV-039 Rachel Green £120 (due today).
This week: Mon boiler service + leak repair, Tue new radiator, Thu annual service, Fri bathroom fit (£2400 quote pending).
Open enquiries: Kevin Nash WhatsApp (urgent boiler cutting out), Emma Taylor (bathroom reno quote), Chris Ball (gas cert GU11).
Keep responses concise and practical. Use £ not $. When drafting messages, label them clearly.`;

  const send = async (text) => {
    if (!text.trim() || loading) return;
    const updated = [...messages, { role: "user", content: text }];
    setMessages(updated);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: SYSTEM, messages: updated.map(m => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.content?.[0]?.text || "Sorry, something went wrong." }]);
    } catch { setMessages(prev => [...prev, { role: "assistant", content: "Connection error — please try again." }]); }
    setLoading(false);
  };

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert("Speech recognition isn't available here.\n\nThis is a sandbox limitation of the preview environment. When deployed to your own URL (e.g. on Vercel), the 🎙 voice note button will work fully in Chrome and Edge.\n\nFor now, just type your message instead.");
      return;
    }
    const r = new SR();
    r.continuous = false; r.interimResults = false; r.lang = "en-GB";
    r.onresult = (e) => { setInput(e.results[0][0].transcript); setListening(false); };
    r.onerror = (e) => {
      setListening(false);
      if (e.error === "not-allowed") {
        alert("Microphone access was blocked.\n\nThis preview runs in a sandboxed iframe which restricts microphone access. The voice note will work fully once deployed to your own URL.");
      }
    };
    r.onend = () => setListening(false);
    r.start(); setListening(true);
  };

  const quick = ["Chase James Oliver — 3 days overdue", "Draft reply to Kevin Nash re boiler", "What's on this week?", "Log new job: John Smith, 5 High St Guildford, tap replacement, £65, Wednesday 2pm"];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 140px)", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {quick.map((q, i) => (<button key={i} onClick={() => send(q)} style={{ padding: "5px 12px", background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 20, color: C.textDim, fontSize: 11, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>{q}</button>))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        {messages.map((m, i) => (
          <div key={i} style={S.aiMsg(m.role)}>
            <div style={S.avatar(m.role)}>{m.role === "user" ? brand.tradingName[0] : "⚡"}</div>
            <div style={S.aiBubble(m.role)}>{m.content}</div>
          </div>
        ))}
        {loading && (<div style={S.aiMsg("assistant")}><div style={S.avatar("assistant")}>⚡</div><div style={{ ...S.aiBubble("assistant"), color: C.muted }}>Thinking...</div></div>)}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        <textarea style={{ ...S.input, flex: 1, minHeight: 44, maxHeight: 120, resize: "none" }} placeholder="Type or use voice note..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} rows={2} />
        <button onClick={startListening} style={{ ...S.btn(listening ? "danger" : "ghost"), padding: "10px 14px", fontSize: 18 }}>🎙</button>
        <button onClick={() => send(input)} style={{ ...S.btn("primary"), padding: "10px 16px" }} disabled={loading || !input.trim()}>Send</button>
      </div>
    </div>
  );
}

// ─── Payments ─────────────────────────────────────────────────────────────────
function Payments({ brand }) {
  const [connected, setConnected] = useState(false);
  const [stage, setStage] = useState(0);
  const [invoices, setInvoices] = useState(INVOICES_INIT);
  const [showModal, setShowModal] = useState(false);
  const [bankVerified, setBankVerified] = useState(false);
  const [verifyStep, setVerifyStep] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [payout, setPayout] = useState("Daily");
  const [bizType, setBizType] = useState("sole_trader");

  if (!connected) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {stage > 0 && (
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
          {["Authorise", "Business", "Bank", "Verify", "Connected"].map((label, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", flex: i < 4 ? 1 : 0 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: stage > i + 1 ? C.green : stage === i + 1 ? brand.accentColor : C.surfaceHigh, border: `2px solid ${stage > i + 1 ? C.green : stage === i + 1 ? brand.accentColor : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: stage >= i + 1 ? "#000" : C.muted, transition: "all 0.3s" }}>{stage > i + 1 ? "✓" : i + 1}</div>
                <div style={{ fontSize: 10, color: stage >= i + 1 ? C.text : C.muted, whiteSpace: "nowrap" }}>{label}</div>
              </div>
              {i < 4 && <div style={{ flex: 1, height: 2, background: stage > i + 1 ? C.green : C.border, margin: "0 6px", marginBottom: 18, transition: "all 0.3s" }} />}
            </div>
          ))}
        </div>
      )}

      {stage === 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ ...S.card, borderColor: C.purple + "44", background: "linear-gradient(135deg,#1a1a2e 0%,#1a1a1a 100%)" }}>
            <div style={{ display: "flex", gap: 20 }}>
              <div style={{ fontSize: 44 }}>💳</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Connect Stripe to get paid</div>
                <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.7, marginBottom: 20 }}>Customers pay invoices online. Money goes straight to your bank — TradeBase never touches it.</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button style={S.btn("stripe")} onClick={() => setStage(1)}><span style={{ fontWeight: 900 }}>S</span> Connect with Stripe</button>
                </div>
              </div>
            </div>
          </div>
          <div style={S.grid3}>
            {[{ icon: "🔒", t: "Your money, your bank", d: "Funds go directly to your Stripe account. TradeBase has zero access." }, { icon: "⚡", t: "Instant payment links", d: "Every invoice gets a pay link. Customers pay by card in seconds." }, { icon: "📊", t: "Auto reconciliation", d: "Invoice marks paid automatically when customer pays." }].map((f, i) => (
              <div key={i} style={S.card}><div style={{ fontSize: 28, marginBottom: 10 }}>{f.icon}</div><div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{f.t}</div><div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>{f.d}</div></div>
            ))}
          </div>
        </div>
      )}

      {stage === 1 && (
        <div style={{ ...S.card, textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 16, fontWeight: 900, color: "#635bff" }}>S</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Redirecting to Stripe</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 24 }}>In production, you'd be sent to Stripe's secure OAuth page. For this demo we simulate the authorisation.</div>
          <button style={S.btn("stripe")} onClick={() => setStage(2)}>Simulate Stripe Authorisation ✓</button>
        </div>
      )}

      {stage === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Business Details</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[{ l: "Trading Name", v: brand.tradingName }, { l: "Legal Name", v: "David Hughes" }, { l: "Mobile", v: brand.phone }, { l: "Email", v: brand.email }, { l: "VAT Number", v: brand.vatNumber || "" }, { l: "Address", v: brand.address }].map(({ l, v }) => (
              <div key={l}><label style={S.label}>{l}</label><input style={S.input} defaultValue={v} /></div>
            ))}
          </div>
          <div><label style={S.label}>Business Type</label>
            <div style={{ display: "flex", gap: 10 }}>
              {[["sole_trader", "Sole Trader"], ["limited_company", "Ltd Company"], ["partnership", "Partnership"]].map(([k, label]) => (
                <button key={k} onClick={() => setBizType(k)} style={S.pill(brand.accentColor, bizType === k)}>{label}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}><button style={S.btn("primary")} onClick={() => setStage(3)}>Continue →</button></div>
        </div>
      )}

      {stage === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Bank Account for Payouts</div>
          <div style={{ ...S.card, background: C.surfaceHigh }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              {[{ l: "Sort Code", v: brand.sortCode }, { l: "Account Number", v: brand.accountNumber }, { l: "Account Name", v: brand.accountName }].map(({ l, v }) => (
                <div key={l}><label style={S.label}>{l}</label><input style={S.input} defaultValue={v} /></div>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              {!bankVerified ? <button style={S.btn("ghost")} onClick={() => setTimeout(() => setBankVerified(true), 1000)}>Verify Bank Account</button>
                : <div style={S.badge(C.green)}>✓ Bank verified</div>}
            </div>
          </div>
          <div style={S.card}>
            <label style={S.label}>Payout Schedule</label>
            <div style={{ display: "flex", gap: 10 }}>
              {["Daily", "Weekly", "Monthly"].map(p => <button key={p} onClick={() => setPayout(p)} style={S.pill(brand.accentColor, payout === p)}>{p}</button>)}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}><button style={S.btn("primary", !bankVerified)} disabled={!bankVerified} onClick={() => setStage(4)}>Continue →</button></div>
        </div>
      )}

      {stage === 4 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Identity Verification</div>
          {[{ t: "Photo ID", d: "Passport, driving licence, or national ID", icon: "🪪" }, { t: "Selfie with ID", d: "A photo of you holding your ID", icon: "🤳" }, { t: "Proof of Address", d: "Bank statement or utility bill (last 3 months)", icon: "📄" }].map((item, i) => (
            <div key={i} style={{ ...S.card, display: "flex", alignItems: "center", gap: 16, borderColor: verifyStep > i ? C.green + "44" : C.border, background: verifyStep > i ? C.green + "08" : C.surface }}>
              <div style={{ fontSize: 28 }}>{item.icon}</div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700 }}>{item.t}</div><div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{item.d}</div></div>
              {verifyStep > i ? <div style={S.badge(C.green)}>✓ Uploaded</div>
                : verifyStep === i ? <button style={S.btn(uploading ? "ghost" : "primary")} onClick={() => { setUploading(true); setTimeout(() => { setUploading(false); setVerifyStep(s => s + 1); }, 1400); }} disabled={uploading}>{uploading ? "Uploading..." : "Upload →"}</button>
                : <div style={{ fontSize: 11, color: C.muted }}>Waiting</div>}
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button style={S.btn("primary", verifyStep < 3)} disabled={verifyStep < 3} onClick={() => setConnected(true)}>Submit & Connect →</button>
          </div>
        </div>
      )}
    </div>
  );

  // Connected
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ ...S.card, borderColor: C.green + "44", background: "linear-gradient(135deg,#0d2018 0%,#1a1a1a 100%)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 32 }}>✅</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.green, marginBottom: 4 }}>Stripe Connected</div>
            <div style={{ fontSize: 12, color: C.textDim }}>{brand.tradingName} · Sort {brand.sortCode} · Daily payouts</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: C.muted }}>ACCOUNT ID</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.green }}>acct_1Ox8dR...</div>
          </div>
        </div>
      </div>
      <div style={S.grid4}>
        {[{ l: "Available", v: "£834", c: C.green }, { l: "Pending", v: "£120", c: C.amber }, { l: "This Month", v: "£3,240", c: C.text }, { l: "Outstanding", v: "£1,250", c: C.red }].map((st, i) => (
          <div key={i} style={{ ...S.card, textAlign: "center" }}>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>{st.l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: st.c }}>{st.v}</div>
          </div>
        ))}
      </div>
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={S.sectionTitle}>Invoices</div>
          <button style={S.btn("primary")} onClick={() => setShowModal(true)}>+ Send Invoice</button>
        </div>
        {invoices.map(inv => (
          <div key={inv.id} style={S.row}>
            <div style={{ fontSize: 12, color: C.muted, width: 70 }}>{inv.id}</div>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{inv.customer}</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginRight: 14 }}>£{inv.amount}</div>
            <div style={{ ...S.badge(statusColor[inv.status]), marginRight: 10 }}>{statusLabel[inv.status]}</div>
            <div style={{ fontSize: 10, color: C.muted, marginRight: 12, width: 110 }}>{inv.due}</div>
            {inv.status !== "paid" && <button style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px" }}>Copy Link</button>}
            {inv.status === "overdue" && <button style={{ ...S.btn("danger"), fontSize: 11, padding: "4px 10px", marginLeft: 6 }} onClick={() => setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: "sent", due: "Chaser sent" } : i))}>Chase</button>}
            {inv.status === "paid" && <div style={{ fontSize: 11, color: C.green, marginLeft: 10 }}>✓</div>}
          </div>
        ))}
      </div>
      {showModal && <InvoiceModal brand={brand} onClose={() => setShowModal(false)} onSent={(inv) => { setInvoices(prev => [inv, ...prev]); setShowModal(false); }} />}
    </div>
  );
}

// ─── Invoice Modal ────────────────────────────────────────────────────────────
function InvoiceModal({ brand, onClose, onSent }) {
  const [form, setForm] = useState({ customer: "", email: "", address: "", amount: "", desc: "", due: brand.paymentTerms || "30", paymentMethod: brand.defaultPaymentMethod || "both" });
  const [tab, setTab] = useState("form");
  const [sent, setSent] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const valid = form.customer && form.email && form.amount;

  const previewRef = buildRef(brand, { id: "INV-043", customer: form.customer || "Customer Name" });

  const send = () => {
    setSent(true);
    setTimeout(() => {
      onSent({ id: `INV-0${43 + Math.floor(Math.random() * 10)}`, customer: form.customer, amount: parseInt(form.amount) || 0, due: `Due in ${form.due} days`, status: "sent" });
    }, 1500);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16 }}>
      <div style={{ ...S.card, maxWidth: 880, width: "100%", maxHeight: "92vh", overflowY: "auto" }}>
        {sent ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.green, marginBottom: 8 }}>Invoice Sent!</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
              {(form.paymentMethod === "card" || form.paymentMethod === "both") ? `Payment link sent to ${form.email}` : `BACS details sent to ${form.email}`}
            </div>
            <div style={{ ...S.card, background: C.surfaceHigh, textAlign: "left", marginBottom: 16, padding: 14, display: "inline-block" }}>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>PAYMENT REFERENCE</div>
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.06em", color: C.amber }}>{previewRef}</div>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>New Invoice</div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ display: "flex", gap: 4 }}>
                  {["form", "preview"].map(t => <button key={t} onClick={() => setTab(t)} style={S.pill(brand.accentColor, tab === t)}>{t === "form" ? "Details" : "Preview"}</button>)}
                </div>
                <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22 }}>×</button>
              </div>
            </div>

            {tab === "form" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={S.grid2}>
                  {[{ k: "customer", l: "Customer Name", p: "e.g. James Oliver" }, { k: "email", l: "Customer Email", p: "james@email.com" }, { k: "address", l: "Customer Address", p: "5 High Street\nGuildford GU1 3AA" }, { k: "amount", l: "Amount (£)", p: "e.g. 480" }].map(({ k, l, p }) => (
                    <div key={k}><label style={S.label}>{l}</label>
                      {k === "address" ? <textarea style={{ ...S.input, resize: "none", height: 60 }} placeholder={p} value={form[k]} onChange={set(k)} />
                        : <input style={S.input} placeholder={p} value={form[k]} onChange={set(k)} />}
                    </div>
                  ))}
                </div>
                <div><label style={S.label}>Description (one line per item)</label>
                  <textarea style={{ ...S.input, resize: "vertical", minHeight: 80 }} placeholder={"Annual boiler service\nFlue check and clean\nPressure test"} value={form.desc} onChange={set("desc")} />
                </div>

                <div style={S.grid2}>
                  <div>
                    <label style={S.label}>Payment Due</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {["7", "14", "30"].map(d => <button key={d} onClick={() => setForm(f => ({ ...f, due: d }))} style={S.pill(brand.accentColor, form.due === d)}>{d} days</button>)}
                    </div>
                  </div>
                  <div>
                    <label style={S.label}>Payment Method for this Invoice</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {[{ v: "bacs", label: "🏦 BACS" }, { v: "card", label: "💳 Card" }, { v: "both", label: "🏦💳 Both" }].map(({ v, label }) => (
                        <button key={v} onClick={() => setForm(f => ({ ...f, paymentMethod: v }))} style={S.pill(brand.accentColor, form.paymentMethod === v)}>{label}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Reference preview */}
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
                  <button style={S.btn("ghost")} onClick={() => setTab("preview")} disabled={!valid}>Preview Invoice →</button>
                  {(form.paymentMethod === "card" || form.paymentMethod === "both")
                    ? <button style={S.btn("stripe", !valid)} disabled={!valid} onClick={send}><span style={{ fontWeight: 900 }}>S</span> Send via Stripe →</button>
                    : <button style={S.btn("primary", !valid)} disabled={!valid} onClick={send}>Send Invoice →</button>
                  }
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "center" }}>
                <InvoicePreview brand={brand} invoice={{ id: "INV-043", customer: form.customer || "Customer Name", address: form.address || "Customer Address", desc: form.desc || "Service description", amount: form.amount || "0", date: new Date().toLocaleDateString("en-GB"), due: form.due, paymentMethod: form.paymentMethod }} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Reminders ────────────────────────────────────────────────────────────────
function useReminders() {
  const [reminders, setReminders] = useState([
    { id: "r1", text: "Chase James Oliver invoice", time: Date.now() + 1000 * 60 * 8, done: false },
    { id: "r2", text: "Call Emma Taylor back re: bathroom quote", time: Date.now() + 1000 * 60 * 60 * 2, done: false },
    { id: "r3", text: "Order copper pipe from City Plumbing", time: Date.now() + 1000 * 60 * 60 * 5, done: false },
    { id: "r4", text: "Confirm Friday job with Tom Harris", time: Date.now() - 1000 * 60 * 30, done: true },
  ]);

  const add = (reminder) => setReminders(prev => [reminder, ...prev]);
  const dismiss = (id) => setReminders(prev => prev.map(r => r.id === id ? { ...r, done: true } : r));
  const remove = (id) => setReminders(prev => prev.filter(r => r.id !== id));

  return { reminders, add, dismiss, remove };
}

function formatCountdown(ms) {
  if (ms <= 0) return "Now";
  const mins = Math.floor(ms / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `in ${days}d ${hrs % 24}h`;
  if (hrs > 0) return `in ${hrs}h ${mins % 60}m`;
  if (mins > 0) return `in ${mins}m`;
  return "in <1m";
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function formatDate(ts) {
  const d = new Date(ts);
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function Reminders({ reminders, onAdd, onDismiss, onRemove, dueNow, onClearDue }) {
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [notifStatus, setNotifStatus] = useState("unknown");

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if ("Notification" in window) setNotifStatus(Notification.permission);
  }, []);

  const requestNotifPermission = async () => {
    try {
      const result = await Notification.requestPermission();
      setNotifStatus(result);
    } catch {
      setNotifStatus("denied");
    }
  };

  const SYSTEM_PROMPT = `You are a reminder parser. The user is a UK tradesperson. Extract a reminder from their natural language input.

Return ONLY valid JSON, no other text:
{
  "text": "short reminder title (max 60 chars)",
  "minutesFromNow": <integer — minutes from now until reminder should fire>,
  "timeLabel": "human readable time e.g. '3:00 PM today' or 'tomorrow 9 AM'"
}

Rules:
- "in 10 minutes" = 10
- "at 3pm" = minutes until 3pm today (if already past, assume tomorrow)
- "tomorrow morning" = assume 9:00 AM tomorrow
- "tomorrow at 2" = 2:00 PM tomorrow
- "end of day" = 5:00 PM today
- "in an hour" = 60
- If no time given, default to 30 minutes
- Current time is ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;

  const parseReminder = async (text) => {
    if (!text.trim()) return;
    setParsing(true);
    setParseError("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 200,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: text }],
        }),
      });
      const data = await res.json();
      const raw = data.content?.[0]?.text || "{}";
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);

      const fireAt = Date.now() + (parsed.minutesFromNow || 30) * 60000;
      const reminder = {
        id: `r${Date.now()}`,
        text: parsed.text || text,
        time: fireAt,
        timeLabel: parsed.timeLabel || "",
        done: false,
        raw: text,
      };

      onAdd(reminder);
      setInput("");

      // Schedule notification
      const delay = fireAt - Date.now();
      if (delay > 0) {
        setTimeout(() => {
          // Try browser notification
          if ("Notification" in window && Notification.permission === "granted") {
            try {
              new Notification("Trade PA Reminder 🔔", {
                body: reminder.text,
                icon: "/favicon.ico",
              });
            } catch {}
          }
          // Always trigger in-app
          onAdd({ ...reminder, _due: true });
        }, delay);
      }
    } catch (e) {
      setParseError("Couldn't parse that — try again or type more clearly, e.g. 'remind me to call Dave at 3pm'");
    }
    setParsing(false);
  };

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert("Voice note isn't available in this preview sandbox.\n\nWhen deployed to your own URL it will work fully. For now, type your reminder below.");
      return;
    }
    const r = new SR();
    r.continuous = false; r.interimResults = false; r.lang = "en-GB";
    r.onresult = (e) => { const t = e.results[0][0].transcript; setInput(t); setListening(false); };
    r.onerror = () => { setListening(false); alert("Microphone blocked in sandbox — type instead."); };
    r.onend = () => setListening(false);
    r.start(); setListening(true);
  };

  const upcoming = reminders.filter(r => !r.done && !r._due).sort((a, b) => a.time - b.time);
  const overdue = reminders.filter(r => !r.done && !r._due && r.time < now);
  const done = reminders.filter(r => r.done);

  const examples = [
    "Remind me to chase James Oliver at 3pm",
    "Call Emma Taylor back in 2 hours",
    "Order copper pipe tomorrow morning",
    "Check boiler parts invoice end of day",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Due now alert */}
      {dueNow.length > 0 && (
        <div style={{ background: C.red + "18", border: `1px solid ${C.red}44`, borderRadius: 10, padding: 16, display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ fontSize: 28 }}>🔔</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.red, marginBottom: 6 }}>Reminder Due</div>
            {dueNow.map((r, i) => (
              <div key={i} style={{ fontSize: 13, color: C.text, marginBottom: 4 }}>— {r.text}</div>
            ))}
          </div>
          <button style={S.btn("ghost")} onClick={onClearDue}>Dismiss all</button>
        </div>
      )}

      {/* Notification permission banner */}
      {notifStatus === "default" && (
        <div style={{ ...S.card, borderColor: C.amber + "44", background: C.amber + "08", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 24 }}>🔔</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Enable push notifications</div>
            <div style={{ fontSize: 12, color: C.muted }}>Get a browser notification when a reminder fires — even if the app isn't open.</div>
          </div>
          <button style={S.btn("primary")} onClick={requestNotifPermission}>Enable →</button>
        </div>
      )}
      {notifStatus === "denied" && (
        <div style={{ ...S.card, borderColor: C.muted + "44", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 20 }}>⚠️</div>
          <div style={{ flex: 1, fontSize: 12, color: C.muted }}>Browser notifications are blocked. Reminders will show in-app only. Allow notifications in your browser settings to get push alerts.</div>
        </div>
      )}
      {notifStatus === "granted" && (
        <div style={{ ...S.card, borderColor: C.green + "44", background: C.green + "08", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 20 }}>✅</div>
          <div style={{ fontSize: 12, color: C.green }}>Push notifications enabled — you'll get alerted even when the app isn't in focus.</div>
        </div>
      )}

      {/* Input */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Set a Reminder</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
          Speak or type naturally — "remind me to call Kevin at 3pm" or "chase Paul Wright invoice in 2 hours"
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {examples.map((ex, i) => (
            <button key={i} onClick={() => setInput(ex)} style={{ padding: "5px 12px", background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 20, color: C.textDim, fontSize: 11, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>{ex}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <input
            style={{ ...S.input, flex: 1 }}
            placeholder="e.g. Remind me to call Kevin Nash at 3pm today..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") parseReminder(input); }}
          />
          <button onClick={startListening} style={{ ...S.btn(listening ? "danger" : "ghost"), padding: "10px 14px", fontSize: 18 }} title="Voice note">🎙</button>
          <button onClick={() => parseReminder(input)} style={{ ...S.btn("primary"), padding: "10px 20px" }} disabled={parsing || !input.trim()}>
            {parsing ? "Parsing..." : "Set →"}
          </button>
        </div>
        {parseError && <div style={{ fontSize: 12, color: C.red, marginTop: 10 }}>{parseError}</div>}
      </div>

      {/* Upcoming reminders */}
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={S.sectionTitle}>Upcoming ({upcoming.length})</div>
        </div>
        {upcoming.length === 0 && <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No upcoming reminders. Set one above.</div>}
        {upcoming.map(r => {
          const ms = r.time - now;
          const isUrgent = ms < 1000 * 60 * 15;
          const isPast = ms <= 0;
          return (
            <div key={r.id} style={{ ...S.row, alignItems: "flex-start" }}>
              <div style={{ width: 4, height: 40, borderRadius: 2, background: isPast ? C.red : isUrgent ? C.amber : C.green, flexShrink: 0, marginTop: 4 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{r.text}</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: C.muted }}>{formatDate(r.time)} at {formatTime(r.time)}</span>
                  <span style={{ ...S.badge(isPast ? C.red : isUrgent ? C.amber : C.blue) }}>
                    {isPast ? "Overdue" : formatCountdown(ms)}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button onClick={() => onDismiss(r.id)} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px" }}>Done ✓</button>
                <button onClick={() => onRemove(r.id)} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px", color: C.muted }}>✕</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Completed */}
      {done.length > 0 && (
        <div style={{ ...S.card, opacity: 0.7 }}>
          <div style={S.sectionTitle}>Completed ({done.length})</div>
          {done.map(r => (
            <div key={r.id} style={{ ...S.row, alignItems: "center" }}>
              <div style={{ fontSize: 13, color: C.muted, textDecoration: "line-through", flex: 1 }}>{r.text}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{formatDate(r.time)} {formatTime(r.time)}</div>
              <button onClick={() => onRemove(r.id)} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px", marginLeft: 10, color: C.muted }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Sandbox note */}
      <div style={{ ...S.card, background: C.surfaceHigh, borderStyle: "dashed" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ fontSize: 20 }}>ℹ️</div>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
            <strong style={{ color: C.textDim }}>Sandbox note:</strong> Voice notes and push notifications are blocked in this preview iframe. Both work fully when deployed to your own URL. In the meantime — type a reminder, hit Set, and the in-app alert above will fire when the time comes (keep the tab open). Try one now: type "remind me in 1 minute" to test it.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
const VIEWS = ["Dashboard", "Schedule", "Materials", "AI Assistant", "Reminders", "Payments", "Settings"];

export default function App() {
  const [view, setView] = useState("Dashboard");
  const [brand, setBrand] = useState(DEFAULT_BRAND);
  const { reminders, add, dismiss, remove } = useReminders();
  const [dueNow, setDueNow] = useState([]);
  const [bellFlash, setBellFlash] = useState(false);
  const now = Date.now();

  // Watch for reminders that just became due
  useEffect(() => {
    const t = setInterval(() => {
      const due = reminders.filter(r => !r.done && !r._due && r.time <= Date.now() && r.time > Date.now() - 60000);
      if (due.length > 0) {
        setDueNow(d => [...d, ...due.filter(r => !d.find(x => x.id === r.id))]);
        setBellFlash(true);
        setTimeout(() => setBellFlash(false), 3000);
        due.forEach(r => dismiss(r.id));
      }
    }, 5000);
    return () => clearInterval(t);
  }, [reminders]);

  const upcomingCount = reminders.filter(r => !r.done && !r._due && r.time > now).length;
  const overdueCount = reminders.filter(r => !r.done && !r._due && r.time <= now).length;
  const alertCount = dueNow.length + overdueCount;

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:5px;}
        ::-webkit-scrollbar-track{background:#1a1a1a;}
        ::-webkit-scrollbar-thumb{background:#333;border-radius:3px;}
        button:hover:not(:disabled){opacity:0.82;}
        input:focus,textarea:focus{border-color:#f59e0b !important;outline:none;}
        @keyframes bellPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.3)} }
      `}</style>
      <header style={S.header}>
        <div style={S.logo}>
          <div style={S.logoIcon}>TP</div>
          TRADE PA
        </div>
        <nav style={S.nav}>
          {VIEWS.map(v => <button key={v} style={S.navBtn(view === v)} onClick={() => setView(v)}>{v}</button>)}
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Bell icon */}
          <div onClick={() => setView("Reminders")} style={{ position: "relative", cursor: "pointer", padding: "4px 6px" }}>
            <span style={{ fontSize: 18, display: "block", animation: bellFlash ? "bellPulse 0.4s ease 3" : "none" }}>🔔</span>
            {alertCount > 0 && (
              <div style={{ position: "absolute", top: 0, right: 0, width: 16, height: 16, background: C.red, borderRadius: "50%", fontSize: 9, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.bg}` }}>{alertCount}</div>
            )}
            {alertCount === 0 && upcomingCount > 0 && (
              <div style={{ position: "absolute", top: 0, right: 0, width: 16, height: 16, background: C.amber, borderRadius: "50%", fontSize: 9, fontWeight: 700, color: "#000", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.bg}` }}>{upcomingCount}</div>
            )}
          </div>
          {brand.logo
            ? <img src={brand.logo} alt="logo" style={{ height: 28, objectFit: "contain", borderRadius: 4 }} />
            : <div style={{ fontSize: 12, color: C.muted }}>{brand.tradingName}</div>}
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.green }} />
        </div>
      </header>
      <main style={{ ...S.main, paddingTop: view === "AI Assistant" || view === "Reminders" ? 16 : 24 }}>
        {view === "Dashboard" && <Dashboard setView={setView} />}
        {view === "Schedule" && <Schedule />}
        {view === "Materials" && <Materials />}
        {view === "AI Assistant" && <AIAssistant brand={brand} />}
        {view === "Reminders" && <Reminders reminders={reminders} onAdd={add} onDismiss={dismiss} onRemove={remove} dueNow={dueNow} onClearDue={() => setDueNow([])} />}
        {view === "Payments" && <Payments brand={brand} />}
        {view === "Settings" && <Settings brand={brand} setBrand={setBrand} />}
      </main>
    </div>
  );
}
