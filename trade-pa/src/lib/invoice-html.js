// ─── Invoice/quote HTML + email template builders ───────────────────────────
// Self-contained HTML generators for:
//   - buildEmailHTML — branded email wrapper (heading, body, BACS, signature)
//   - buildRef       — invoice reference string (per brand format preference)
//   - buildInvoiceHTML — full A4 invoice/quote document with VAT + CIS support
//   - downloadInvoicePDF — opens buildInvoiceHTML output in print preview
//
// Imports fmtCurrency + vatLabel for amount formatting in the templates,
// and openHtmlPreview for the iOS-PWA-safe window.open cascade.

import { fmtCurrency, vatLabel } from "./format.js";
import { openHtmlPreview } from "./files.js";

export function buildEmailHTML(brand, { heading, body, showBacs = false, invoiceId = "" }) {
  const accent = brand?.accentColor || "#f59e0b";
  const name = brand?.tradingName || "";
  const bacsBlock = showBacs && brand?.bankName ? `
    <div style="background:#f8f8f8;border-radius:6px;padding:14px 16px;margin:16px 0;border:1px solid #eee;color:#1a1a1a;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#666;margin-bottom:8px;">Pay by bank transfer (BACS)</div>
      <div style="font-size:13px;line-height:1.8;color:#1a1a1a;">
        <b style="color:#1a1a1a;">Bank:</b> ${brand.bankName}<br>
        <b style="color:#1a1a1a;">Account name:</b> ${brand.accountName || ""}<br>
        <b style="color:#1a1a1a;">Sort code:</b> ${brand.sortCode || ""}<br>
        <b style="color:#1a1a1a;">Account number:</b> ${brand.accountNumber || ""}<br>
        <b style="color:#1a1a1a;">Reference:</b> ${invoiceId}
      </div>
    </div>` : "";
  const sig = `<p style="margin-top:24px;color:#1a1a1a;">Many thanks,<br><strong style="color:#1a1a1a;">${name}</strong>${brand?.phone ? `<br><span style="color:#1a1a1a;">${brand.phone}</span>` : ""}${brand?.email ? `<br><span style="color:#1a1a1a;">${brand.email}</span>` : ""}</p>`;
  // Full HTML doc (not just a div) so we can inject color-scheme + meta tags
  // that disable iOS Mail / Outlook / Gmail dark-mode auto-inversion. Without
  // these, those clients try to "helpfully" recolour the email and break the
  // amber header + amber button (white-on-amber becomes invisible). Belt-and-
  // braces: meta tag, color-scheme rule, and explicit colour declarations on
  // every text element so even partial inversion can't corrupt the design.
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${name}</title>
<style>
  :root { color-scheme: light only; supported-color-schemes: light only; }
  /* Force amber header bar to remain amber even in dark-mode email clients.
     Apple Mail respects color-scheme; Outlook needs the !important on bg. */
  .tp-header { background:${accent} !important; }
  .tp-header h2, .tp-header .tp-sub { color:#ffffff !important; }
  /* CTA button — ensure amber bg + white text survive dark-mode inversion.
     Wrapping table fallback for Outlook desktop, which ignores backdrop and
     button styling but renders table cells reliably. */
  .tp-cta { background:${accent} !important; color:#ffffff !important; }
  /* Body copy — lock text colour so iOS Dark Mode doesn't flip dark grey to
     light grey on a still-white surface (which would render invisibly). */
  .tp-body, .tp-body p, .tp-body div, .tp-body strong, .tp-body span, .tp-body b { color:#1a1a1a !important; }
  .tp-body a { color:#1a1a1a; }
  /* Some clients also try to invert background: lock the inner card to white. */
  .tp-card { background:#ffffff !important; }
  @media (prefers-color-scheme: dark) {
    /* Re-assert in dark-mode media query in case client honours it. */
    .tp-header { background:${accent} !important; }
    .tp-header h2, .tp-header .tp-sub { color:#ffffff !important; }
    .tp-cta { background:${accent} !important; color:#ffffff !important; }
    .tp-card { background:#ffffff !important; }
    .tp-body, .tp-body p, .tp-body div, .tp-body strong, .tp-body span, .tp-body b { color:#1a1a1a !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;color-scheme:light only;">
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
  <div class="tp-header" style="background:${accent};padding:24px 28px;border-radius:8px 8px 0 0;">
    <h2 style="color:#ffffff;margin:0;font-size:20px;">${name}</h2>
    ${heading ? `<div class="tp-sub" style="color:#ffffff;opacity:0.85;font-size:13px;margin-top:4px;">${heading}</div>` : ""}
  </div>
  <div class="tp-card tp-body" style="padding:24px 28px;background:#ffffff;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px;color:#1a1a1a;">
    ${body}
    ${bacsBlock}
    ${sig}
  </div>
</div>
</body>
</html>`;
}

export function buildRef(brand, inv) {
  const num = (inv.id || "INV-001").replace(/\D/g, "");
  const surname = (inv.customer || "").split(" ").pop().toUpperCase();
  switch (brand.refFormat) {
    case "surname_invoice": return `${surname}-${inv.id || "INV-001"}`;
    case "custom_prefix":   return `${brand.refPrefix || "REF"}-${num}`;
    case "number_only":     return num;
    default:                return inv.id || "INV-001";
  }
}

// ─── PDF Generator ────────────────────────────────────────────────────────────
export function buildInvoiceHTML(brand, inv) {
  try {
  const accent = brand.accentColor || "#f59e0b";
  let ref; try { ref = buildRef(brand, inv); } catch(e) { console.error("[PDF CRASH] buildRef:", e.message); ref = inv.id || "INV-001"; }
  const payMethod = inv.paymentMethod || brand.defaultPaymentMethod || "both";
  const showBacs = payMethod === "bacs" || payMethod === "both";
  const showCard = payMethod === "card" || payMethod === "both";
  const vatEnabled = inv.vatEnabled && brand.vatNumber;
  const vatRate = Number(inv.vatZeroRated ? 0 : (inv.vatRate || 20));
  const netAmount = (vatEnabled && !inv.vatZeroRated) ? parseFloat(inv.amount || inv.grossAmount || 0) : parseFloat(inv.grossAmount || inv.amount) || 0;
  const grossAmount = (vatEnabled && !inv.vatZeroRated) ? parseFloat((netAmount * (1 + vatRate / 100)).toFixed(2)) : netAmount;
  const vatAmount = (vatEnabled && !inv.vatZeroRated) ? parseFloat((grossAmount - netAmount).toFixed(2)) : 0;
  const date = inv.date || new Date().toLocaleDateString("en-GB");
  const isQuote = inv.isQuote;
  const cisEnabled = inv.cisEnabled;
  const cisLabour = parseFloat(inv.cisLabour) || 0;
  const cisMaterials = parseFloat(inv.cisMaterials) || 0;
  const cisGross = cisLabour + cisMaterials;
  const cisDeduction = parseFloat(inv.cisDeduction) || 0;
  const cisNetPayable = parseFloat(inv.cisNetPayable) || 0;
  const cisRate = Number(inv.cisRate) || 20;

  const rawDesc = inv.desc || inv.description || "Service";

  // Parse line items — support stored lineItems array, or pipe-separated "desc|amount" format, or plain text
  // Safety: lineItems may arrive as a JSON string from Supabase — parse it first
  let rawLineItems = inv.lineItems || inv.line_items;
  if (typeof rawLineItems === "string") { try { rawLineItems = JSON.parse(rawLineItems); } catch { rawLineItems = null; } }
  if (!Array.isArray(rawLineItems)) rawLineItems = null;

  let lineItems;
  if (cisEnabled) {
    // CIS invoices: labour as single line, materials as individual items
    lineItems = [];
    if (cisLabour > 0) lineItems.push({ description: "Labour", amount: cisLabour });
    const matItems = inv.materialItems && inv.materialItems.filter(m => m.desc || m.description).length > 0
      ? inv.materialItems.filter(m => m.desc || m.description)
      : cisMaterials > 0 ? [{ description: "Materials", amount: cisMaterials }] : [];
    matItems.forEach(m => lineItems.push({ description: m.description || m.desc, amount: parseFloat(m.amount) || 0 }));
    if (lineItems.length === 0) lineItems.push({ description: rawDesc, amount: grossAmount });
  } else if (rawLineItems && rawLineItems.length > 0) {
    lineItems = rawLineItems.map(l => ({
      description: l.description || l.desc || "",
      amount: l.amount !== "" && l.amount != null && !isNaN(parseFloat(l.amount)) ? parseFloat(l.amount) : null,
    })).filter(l => l.description);
  } else {
    lineItems = rawDesc
      .split(/\n|;\s*/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => {
        const pipeIdx = s.lastIndexOf("|");
        if (pipeIdx > 0) {
          const desc = s.slice(0, pipeIdx).trim();
          const amt = parseFloat(s.slice(pipeIdx + 1));
          if (!isNaN(amt)) return { description: desc, amount: amt };
        }
        return { description: s, amount: null };
      });
  }

  // If only one item with no price, use the total
  if (!cisEnabled && lineItems.length === 1 && lineItems[0].amount === null) {
    lineItems[0].amount = grossAmount;
  }

  const hasIndividualPrices = lineItems.some(l => l.amount !== null && lineItems.length > 1);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${isQuote ? "Quote" : "Invoice"} ${inv.id} — ${inv.customer}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:Arial,sans-serif;color:#1a1a1a;background:#fff;padding:0;}
  .page{max-width:800px;margin:0 auto;padding:0;color:#1a1a1a;font-family:Arial,sans-serif;}
  .header{background:${accent};padding:28px 36px;display:flex;justify-content:space-between;align-items:flex-start;}
  .header-left .biz-name{font-size:22px;font-weight:700;color:#fff;margin-bottom:4px;}
  .header-left .tagline{font-size:12px;color:rgba(255,255,255,0.8);}
  .header-right{text-align:right;}
  .header-right .doc-type{font-size:24px;font-weight:700;color:#fff;letter-spacing:0.05em;}
  .header-right .doc-id{font-size:14px;color:rgba(255,255,255,0.8);margin-top:4px;}
  .logo{max-height:60px;max-width:180px;object-fit:contain;margin-bottom:6px;display:block;}
  .infobar{background:#f8f8f8;padding:12px 28px;display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;border-bottom:1px solid #eee;font-size:12px;color:#1a1a1a;}
  .infobar span{color:#999;margin-right:4px;}
  .infobar-left{display:flex;flex-direction:column;gap:4px;}
  .infobar-right{display:flex;flex-direction:column;gap:4px;text-align:right;}
  .addresses{padding:24px 36px;display:grid;grid-template-columns:1fr 1fr;gap:28px;border-bottom:1px solid #eee;}
  .addr-label{font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px;}
  .addr-name{font-size:14px;font-weight:700;margin-bottom:4px;color:#1a1a1a;}
  .addr-detail{font-size:12px;color:#555;line-height:1.7;}
  .addr-accent{color:${accent};}
  .items{padding:0 36px;color:#1a1a1a;}
  table{width:100%;border-collapse:collapse;}
  th{text-align:left;padding:12px 0 8px;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#999;font-weight:400;border-bottom:2px solid ${accent};}
  th.right,td.right{text-align:right;}
  td{padding:11px 0;font-size:13px;border-bottom:1px solid #f0f0f0;color:#1a1a1a;}
  td.muted{color:#999;}
  .totals{padding:12px 36px 0;display:flex;flex-direction:column;align-items:flex-end;gap:5px;border-top:2px solid ${accent};margin:0 36px;}
  .total-row{display:flex;gap:40px;font-size:13px;color:#888;}
  .total-row.grand{font-size:20px;font-weight:700;color:${accent};border-top:1px solid #eee;padding-top:8px;margin-top:4px;}
  .payment{margin:16px 36px 0;display:flex;flex-direction:column;gap:10px;}
  .pay-block{background:#f8f8f8;border-radius:6px;padding:14px 16px;border:1px solid #eee;}
  .pay-block.stripe{background:rgba(99,91,255,0.06);border-color:rgba(99,91,255,0.2);}
  .pay-title{font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#888;margin-bottom:10px;}
  .pay-title.stripe-title{color:#635bff;}
  .pay-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px 20px;font-size:12px;color:#555;}
  .pay-grid strong{color:#1a1a1a;}
  .ref-box{margin-top:10px;padding:8px 12px;background:${accent}18;border-radius:4px;border:1px solid ${accent}44;font-size:12px;}
  .ref-box span{color:#999;}
  .ref-box strong{letter-spacing:0.04em;color:#1a1a1a;}
  .ref-box small{color:#bbb;margin-left:8px;}
  .stripe-btn{display:inline-block;padding:8px 20px;background:#635bff;border-radius:5px;font-size:12px;font-weight:700;color:#fff;margin-top:10px;}
  .stripe-url{font-size:10px;color:#bbb;margin-top:6px;}
  .note{font-size:11px;color:#999;margin-top:4px;}
  .footer{background:${accent}18;padding:10px 36px;display:flex;justify-content:space-between;border-top:1px solid ${accent}44;font-size:11px;color:#888;margin-top:20px;}
  .validity{background:#fff8e8;border:1px solid ${accent}44;border-radius:6px;padding:10px 16px;margin:0 36px;font-size:12px;color:#888;}
  @media print{
    .back-bar{display:none !important;}
    body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  }
  .back-bar{background:#1a1a1a;padding:max(10px, env(safe-area-inset-top, 10px)) 36px 10px;display:flex;gap:16px;align-items:center;position:sticky;top:0;z-index:10;}
  .back-bar a{color:#f59e0b;font-size:13px;text-decoration:none;font-weight:600;cursor:pointer;}
</style>
</head>
<body>
<div class="back-bar">
  <a onclick="try{window.parent.postMessage('close-pdf','*')}catch(e){}; try{if(window.opener||window.history.length<=1){window.close();}else{window.history.back();}}catch(e){}">← Back to Trade PA</a>
  <a onclick="window.print()" style="color:#aaa;">🖨 Print / Save PDF</a>
</div>
<div class="page" style="color:#1a1a1a;">
  <div class="header">
    <div class="header-left">
      ${brand.logo ? `<img src="${brand.logo}" class="logo" alt="logo"/>` : `<div class="biz-name">${brand.tradingName}</div>`}
      ${brand.tagline ? `<div class="tagline">${brand.tagline}</div>` : ""}
    </div>
    <div class="header-right">
      <div class="doc-type">${isQuote ? "QUOTE" : "INVOICE"}</div>
      <div class="doc-id">${inv.id}</div>
    </div>
  </div>

  <div class="infobar" style="color:#1a1a1a;">
    <div class="infobar-left">
      <div style="color:#1a1a1a;"><span>Date:</span>${date}</div>
      <div style="color:#1a1a1a;"><span>${isQuote ? "Valid for:" : "Payment due:"}</span>${isQuote ? (inv.due || "30 days") : (inv.due || `${brand.paymentTerms || 30} days`)}</div>
    </div>
    <div class="infobar-right">
      ${inv.jobRef ? `<div style="color:#1a1a1a;"><span>Job Ref:</span>${inv.jobRef}</div>` : ""}
      ${inv.poNumber ? `<div style="color:#1a1a1a;"><span>PO:</span>${inv.poNumber}</div>` : ""}
      ${(brand.vatNumber && (brand._exemptBypass || brand.registrationVerifications?.vatNumber?.verified)) ? `<div style="color:#1a1a1a;"><span>VAT No:</span>${brand.vatNumber}</div>` : ""}
    </div>
  </div>

  <div class="addresses">
    <div>
      <div class="addr-label">From</div>
      <div class="addr-name" style="color:#1a1a1a;">${brand.tradingName}</div>
      <div class="addr-detail" style="white-space:pre-line;color:#555;">${brand.address || ""}</div>
      ${brand.phone ? `<div class="addr-detail" style="color:#555;">${brand.phone}</div>` : ""}
      ${brand.email ? `<div class="addr-detail addr-accent">${brand.email}</div>` : ""}
      ${brand.gasSafeNumber ? `<div class="addr-detail" style="font-size:11px;color:#999;margin-top:6px">Gas Safe: ${brand.gasSafeNumber}</div>` : ""}
      ${brand.utrNumber ? `<div class="addr-detail" style="font-size:11px;color:#999;margin-top:2px">UTR: ${brand.utrNumber}</div>` : ""}
    </div>
    <div>
      <div class="addr-label">To</div>
      <div class="addr-name" style="color:#1a1a1a;">${inv.customer}</div>
      <div class="addr-detail" style="white-space:pre-line;color:#555;">${inv.address || ""}</div>
    </div>
  </div>

  <div class="items" style="color:#1a1a1a;">
    <table>
      <thead>
        <tr>
          <th>Description</th>
          ${cisEnabled ? `<th class="right">Amount</th>` : vatEnabled ? `<th class="right">Net</th><th class="right">VAT ${vatRate}%</th><th class="right">Gross</th>` : `<th class="right">Amount</th>`}
        </tr>
      </thead>
      <tbody>
        ${lineItems.map((line, i) => {
          const isLast = i === lineItems.length - 1;
          const lineAmt = line.amount !== null && line.amount !== undefined ? Number(line.amount) : (isLast && !hasIndividualPrices ? grossAmount : null);
          const lineNet = !cisEnabled && vatEnabled && lineAmt !== null ? parseFloat((lineAmt / (1 + vatRate / 100)).toFixed(2)) : null;
          const lineVat = !cisEnabled && vatEnabled && lineAmt !== null ? parseFloat((lineAmt - lineNet).toFixed(2)) : null;
          return `
        <tr>
          <td style="color:#1a1a1a;">${line.description || line}</td>
          ${cisEnabled
            ? `<td class="right" style="color:#1a1a1a;">${lineAmt !== null ? fmtCurrency(lineAmt) : "—"}</td>`
            : vatEnabled
              ? `<td class="right" style="color:#1a1a1a;">${lineNet !== null ? fmtCurrency(lineNet) : "—"}</td>
                 <td class="right" style="color:#1a1a1a;">${lineVat !== null ? fmtCurrency(lineVat) : "—"}</td>
                 <td class="right" style="color:#1a1a1a;">${lineAmt !== null ? fmtCurrency(lineAmt) : "—"}</td>`
              : `<td class="right" style="color:#1a1a1a;">${lineAmt !== null ? fmtCurrency(lineAmt) : "—"}</td>`
          }
        </tr>`;
        }).join("")}
      </tbody>
    </table>
  </div>

  <div class="totals">
    ${cisEnabled ? (() => {
      const isDrc = (inv.vatType || "").includes("drc");
      const cisVat = vatEnabled && !isDrc ? parseFloat((cisGross * vatRate / 100).toFixed(2)) : 0;
      const cisNetTotal = cisGross + cisVat - cisDeduction;
      return `
    <div class="total-row"><span>Labour</span><span>${fmtCurrency(cisLabour)}</span></div>
    ${cisMaterials > 0 ? `<div class="total-row"><span>Materials (no CIS deduction)</span><span>${fmtCurrency(cisMaterials)}</span></div>` : ""}
    <div class="total-row"><span>Gross (labour + materials)</span><span>${fmtCurrency(cisGross)}</span></div>
    ${vatEnabled && !isDrc ? `<div class="total-row"><span>${vatLabel(inv)}</span><span>${fmtCurrency(cisVat)}</span></div>` : ""}
    ${vatEnabled && isDrc ? `<div class="total-row" style="color:#888"><span>${vatLabel(inv)} — contractor accounts for VAT</span><span>£0.00</span></div>` : ""}
    <div class="total-row" style="color:#c0392b"><span>CIS Deduction @ ${cisRate}% (labour only)</span><span>-${fmtCurrency(cisDeduction)}</span></div>
    <div class="total-row grand"><span>Net Amount Payable</span><span>${fmtCurrency(cisNetTotal)}</span></div>`;
    })() : vatEnabled ? `
    <div class="total-row"><span>Net amount</span><span>${fmtCurrency(netAmount)}</span></div>
    <div class="total-row"><span>${vatLabel(inv)}</span><span>${fmtCurrency(vatAmount)}</span></div>
    <div class="total-row grand"><span>${isQuote ? "Quote Total (inc. VAT)" : "Total Due (inc. VAT)"}</span><span>${fmtCurrency(grossAmount)}</span></div>
    ` : `
    <div class="total-row grand"><span>${isQuote ? "Quote Total" : "Total Due"}</span><span>${fmtCurrency(grossAmount)}</span></div>
    `}
    ${cisEnabled ? `<div style="font-size:10px;color:#888;margin-top:8px;padding-top:8px;border-top:1px solid #eee">CIS tax deducted by contractor under the Construction Industry Scheme. This statement will be provided by the contractor.</div>` : ""}
    ${inv.vatZeroRated ? `<div style="font-size:10px;color:#888;margin-top:8px">Zero-rated VAT — new residential construction (VATA 1994, Group 5)</div>` : ""}
  </div>

  ${isQuote ? `
  <div class="validity">
    This quote is valid for 30 days from the date above. Prices may be subject to change after this period. Please contact us to proceed or if you have any questions.
  </div>` : ""}

  <div class="payment">
    ${!isQuote && showBacs && brand.bankName ? `
    <div class="pay-block">
      <div class="pay-title">${showCard ? "Option 1 — Pay by Bank Transfer (BACS)" : "Pay by Bank Transfer (BACS)"}</div>
      <div class="pay-grid">
        <div><span style="color:#999">Bank: </span><strong>${brand.bankName}</strong></div>
        <div><span style="color:#999">Account name: </span><strong>${brand.accountName}</strong></div>
        <div><span style="color:#999">Sort code: </span><strong>${brand.sortCode}</strong></div>
        <div><span style="color:#999">Account no: </span><strong>${brand.accountNumber}</strong></div>
      </div>
      <div class="ref-box">
        <span>Payment reference: </span><strong>${ref}</strong><small>(please use exactly as shown)</small>
      </div>
    </div>` : ""}

    ${!isQuote && showCard ? `
    <div class="pay-block stripe">
      <div class="pay-title stripe-title">${showBacs ? "Option 2 — Pay by Card (Stripe)" : "Pay by Card (Stripe)"}</div>
      <div style="font-size:12px;color:#555;margin-bottom:10px">Pay securely online by debit or credit card. Takes 30 seconds.</div>
      <div class="stripe-btn">Pay ${fmtCurrency(grossAmount)} online</div>
      <div class="stripe-url">Payment link sent separately by email</div>
    </div>` : ""}

    <div class="note">${brand.invoiceNote || ""}</div>
  </div>

  <div class="footer">
    ${brand.website ? `<span>${brand.website}</span>` : "<span></span>"}
    ${brand.phone ? `<span>${brand.phone}</span>` : "<span></span>"}
    ${brand.email ? `<span>${brand.email}</span>` : "<span></span>"}
  </div>

  <!-- Back to app button — hidden when printing -->
  <div class="no-print" style="text-align:center;padding:20px;margin-top:10px;">
    <button onclick="try{window.parent.postMessage('close-pdf','*')}catch(e){}; try{if(window.opener||window.history.length<=1){window.close();}else{window.history.back();}}catch(e){}" style="padding:10px 24px;background:#f59e0b;color:#000;border:none;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;margin-right:10px;">← Back to Trade PA</button>
    <button onclick="window.print()" style="padding:10px 24px;background:#1a1a1a;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;">🖨 Print / Save PDF</button>
  </div>
</div>
</body>
</html>`;;
  return html;
  } catch(e) { console.error("[PDF] buildInvoiceHTML CRASHED:", e.message, e.stack); return "<p>Error generating invoice</p>"; }
}

export function downloadInvoicePDF(brand, inv) {
  try {
  const html = buildInvoiceHTML(brand, inv);
  openHtmlPreview(html);
  } catch (err) {
    console.error("PDF generation error:", err);
    alert("Could not generate PDF: " + err.message);
  }
}
