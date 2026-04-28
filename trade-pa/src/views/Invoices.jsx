// ─── Invoices / Quotes / Payments cluster ──────────────────────────────
// Extracted verbatim from App.jsx during P7 sub-batch C (28 Apr 2026).
//
// Bundles five top-level components plus two private helpers because they
// share state/data flows and template helpers:
//   - LineItemsDisplay      (private — used by InvoicesView and QuotesView)
//   - sendDocumentEmail     (private — used by InvoicesView and QuotesView)
//   - InvoicePreview        (exported — also rendered from Settings → Branding)
//   - Payments              (exported — view === "Payments")
//   - InvoicesView          (exported — view === "Invoices")
//   - QuotesView            (exported — view === "Quotes")
//
// Order of declaration matters for human readability; JavaScript function
// hoisting means the runtime ordering is irrelevant.
import React, { useState, useEffect } from "react";
import { db } from "../lib/db.js";
import { C } from "../theme/colors.js";
import { S } from "../theme/styles.js";
import { fmtCurrency, fmtAmount, vatLabel, relTime } from "../lib/format.js";
import { weekBounds, groupByRecency } from "../lib/time.js";
import { trackEvent } from "../lib/tracking.js";
import {
  buildEmailHTML, buildInvoiceHTML, buildRef, downloadInvoicePDF,
} from "../lib/invoice-html.js";
import { generatePortalToken, nextInvoiceId } from "../lib/ids.js";
import { statusColor, statusLabel } from "../lib/status.js";
import { syncInvoiceToAccounting } from "../lib/accounting.js";
import { portalCtaBlock } from "../lib/portal-extras.js";
import { DetailPage } from "../components/DetailPage.jsx";
import { PortalLinkPanel } from "../components/PortalLinkPanel.jsx";
import { InvoiceModal } from "../modals/InvoiceModal.jsx";
import { QuoteModal } from "../modals/QuoteModal.jsx";

function LineItemsDisplay({ inv }) {
  if (!inv) return null;

  // Normalise items — handle both {desc, amount} from builder and {description, amount} from legacy
  const rawItems = inv.lineItems && inv.lineItems.length > 0
    ? inv.lineItems.map(l => ({
        description: l.description || l.desc || "",
        amount: l.amount !== "" && l.amount != null && !isNaN(parseFloat(l.amount)) ? parseFloat(l.amount) : null,
      })).filter(l => l.description)
    : (inv.description || inv.desc || "").split(/\n|;\s*/).map(s => {
        const pipeIdx = s.lastIndexOf("|");
        if (pipeIdx > 0) return { description: s.slice(0, pipeIdx).trim(), amount: parseFloat(s.slice(pipeIdx + 1)) || null };
        return { description: s.trim(), amount: null };
      }).filter(i => i.description);

  const items = rawItems;
  if (items.length === 0) return <div style={{ fontSize: 13, color: "#888" }}>—</div>;

  if (items.length === 1) {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
        <span>{items[0].description}</span>
        {items[0].amount != null && <span style={{ fontWeight: 600 }}>£{Number(items[0].amount).toFixed(2)}</span>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingBottom: 6, borderBottom: i < items.length - 1 ? `1px solid rgba(255,255,255,0.06)` : "none" }}>
          <span>{item.description}</span>
          {item.amount != null && <span style={{ fontWeight: 600, flexShrink: 0, marginLeft: 12 }}>£{Number(item.amount).toFixed(2)}</span>}
        </div>
      ))}
    </div>
  );
}

// Generate a base64-encoded PDF from the invoice HTML template. The
// /api/send-invoice-email endpoint expects pdfBase64 — raw base64 of the
// PDF bytes, no `data:` prefix. Pre-fix the client sent pdfHtml (raw HTML)
// which the endpoint silently ignored, so emails went out attachment-free.
//
// html2canvas + jspdf are heavy (~700KB combined). They're lazy-imported so
// they only land in the bundle the user downloads when they actually tap
// Send — not on app boot. (BUG-008 PDF half, 28 Apr 2026)
async function generatePdfBase64(htmlString) {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  // Render the invoice HTML offscreen at A4 width (794px @ 96dpi) so the
  // captured canvas has the right aspect ratio for the printed page.
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.style.width = "794px";
  container.innerHTML = htmlString;
  document.body.appendChild(container);

  try {
    // Wait for any web fonts in use to be ready before capturing — without
    // this, html2canvas can capture text in fallback fonts on slow loads.
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    // One paint tick for layout to settle (helps with images sized via CSS).
    await new Promise((r) => setTimeout(r, 50));

    const canvas = await html2canvas(container, {
      scale: 1.5,            // matches the "~600KB-1MB at 1.5x" the endpoint comment expects
      useCORS: true,         // brand logos may be cross-origin (Supabase Storage)
      backgroundColor: "#ffffff",
      logging: false,
    });

    // A4 dimensions in millimetres
    const pdfWidthMm = 210;
    const pdfHeightMm = 297;
    const imgWidthMm = pdfWidthMm;
    const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;

    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const imgData = canvas.toDataURL("image/png");

    // Multi-page: invoices with many line items can be taller than A4. We
    // splice the same image across pages by negative-positioning successive
    // additions — standard jsPDF + html2canvas pattern for long content.
    let heightLeft = imgHeightMm;
    let position = 0;
    pdf.addImage(imgData, "PNG", 0, position, imgWidthMm, imgHeightMm);
    heightLeft -= pdfHeightMm;
    while (heightLeft > 0) {
      position -= pdfHeightMm;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidthMm, imgHeightMm);
      heightLeft -= pdfHeightMm;
    }

    // output("datauristring") returns "data:application/pdf;base64,XXXX".
    // Strip the prefix; the endpoint wants raw base64.
    const dataUri = pdf.output("datauristring");
    return dataUri.split(",")[1] || "";
  } finally {
    if (container.parentNode) container.parentNode.removeChild(container);
  }
}

async function sendDocumentEmail(doc, brand, customers, userId, setSending, customerContacts = []) {
  if (!userId) { alert("Please log in first."); return false; }

  // Check email connection
  const connRes = await fetch(
    `${window._supabaseUrl || ""}/rest/v1/email_connections?user_id=eq.${userId}&select=provider,email`,
    {
      headers: {
        "apikey": window._supabaseAnonKey || "",
        "Authorization": `Bearer ${window._supabaseToken || ""}`,
      },
    }
  ).catch(() => null);

  // Use db client directly instead
  const { data: conns } = await window._supabase
    .from("email_connections")
    .select("provider, email")
    .eq("user_id", userId);

  if (!conns?.length) {
    alert("No email account connected. Go to the Inbox tab to connect Gmail or Outlook first.");
    return false;
  }

  const provider = conns[0].provider;

  // Look up customer row
  const customerRecord = (customers || []).find(c =>
    c.name?.toLowerCase() === doc.customer?.toLowerCase()
  );

  // Multi-contact-aware email resolution chain:
  //   1. An explicit billing_contact_id on the invoice (future-proof)
  //   2. The billing contact for this customer (is_billing=true)
  //   3. The primary contact for this customer (is_primary=true)
  //   4. The customer row's email (mirrored from primary at create time)
  //   5. doc.customerEmail
  //   6. Prompt the user
  let toEmail = "";
  if (customerRecord) {
    const kids = (customerContacts || []).filter(ct => ct.customerId === customerRecord.id);
    if (doc.billing_contact_id) {
      const pinned = kids.find(ct => ct.id === doc.billing_contact_id);
      if (pinned?.email) toEmail = pinned.email;
    }
    if (!toEmail) {
      const billing = kids.find(ct => ct.isBilling && ct.email);
      if (billing) toEmail = billing.email;
    }
    if (!toEmail) {
      const primary = kids.find(ct => ct.isPrimary && ct.email);
      if (primary) toEmail = primary.email;
    }
  }
  if (!toEmail) toEmail = customerRecord?.email || doc.customerEmail || "";

  if (!toEmail) {
    toEmail = prompt(`Enter email address for ${doc.customer}:`);
    if (!toEmail) return false;
  }

  // Ensure a portal token exists synchronously before we build the email body.
  // If Send was tapped from a list view (not detail), the open-detail useEffect
  // that normally back-fills the token hasn't fired yet — so portalToken would
  // be undefined and portalCtaBlock would render an empty string. Without this
  // the customer gets an email with no orange "View & Pay Online" button.
  // (BUG-008 portal-CTA fix, 28 Apr 2026)
  if (!doc.portalToken && !doc.portal_token) {
    const t = generatePortalToken();
    try {
      await db.from("invoices")
        .update({ portal_token: t })
        .eq("id", doc.id)
        .eq("user_id", userId);
    } catch (e) {
      console.warn("Portal token backfill on send:", e?.message || e);
    }
    // Mutate the local doc so the body builder below picks up the token.
    // We keep both casings because the rest of the codebase reads either.
    doc = { ...doc, portal_token: t, portalToken: t };
  }

  const isQuote = doc.isQuote;
  const docType = isQuote ? "Quote" : "Invoice";
  const subject = `${docType} ${doc.id} from ${brand.tradingName} — ${fmtCurrency(doc.amount)}`;
  const accent = brand?.accentColor || "#f59e0b";
  const docAmt = fmtCurrency(doc.amount);
  // Portal CTA — shared helper produces button + plain-text fallback link.
  // Renders empty string if no token, so body interpolation is unconditional.
  const portalToken = doc.portalToken || doc.portal_token;
  const stripeReady = !isQuote && !!brand?.stripeAccountId;
  const portalCTA = portalCtaBlock({ token: portalToken, isQuote, stripeReady, accent });
  const body = buildEmailHTML(brand, {
    heading: `${docType.toUpperCase()} ${doc.id}`,
    showBacs: !isQuote,
    invoiceId: doc.id,
    body: `<p style="font-size:15px;">Dear ${doc.customer},</p>
      <p style="color:#555;">Please find your ${docType.toLowerCase()} ${doc.id} for <strong>${docAmt}</strong> attached.</p>
      ${portalCTA}
      <div style="background:${accent}18;border-radius:6px;padding:16px;margin:16px 0;border-left:4px solid ${accent};">
        <div style="font-size:22px;font-weight:700;color:${accent};">${docAmt}</div>
        <div style="font-size:12px;color:#888;margin-top:4px;">${isQuote ? "Valid for 30 days" : `Due within ${brand.paymentTerms || 30} days`}</div>
      </div>
      <p style="color:#555;font-size:13px;">${isQuote ? "This quote is valid for 30 days. Please get in touch to proceed or if you have any questions." : "If you have any questions, please don't hesitate to get in touch."}</p>`,
  });

  if (setSending) setSending(doc.id);
  try {
    // Generate a PDF from the invoice HTML template. The endpoint expects
    // pdfBase64 (raw base64 of PDF bytes); historical client code sent
    // pdfHtml which the endpoint silently ignored, so emails went out
    // attachment-free. If PDF generation fails (OOM, blocked image, etc.)
    // we still send the email — the customer gets the body + portal CTA.
    // (BUG-008 PDF fix, 28 Apr 2026)
    const filename = `${docType}-${doc.id}.pdf`;
    let pdfBase64 = null;
    try {
      const html = buildInvoiceHTML(brand, doc);
      pdfBase64 = await generatePdfBase64(html);
    } catch (e) {
      console.warn("Invoice PDF generation failed; sending without attachment:", e);
    }
    const res = await fetch("/api/send-invoice-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, to: toEmail, subject, body, pdfBase64, filename }),
    });
    if (!res.ok) {
      // Fallback to basic send if new endpoint not deployed
      if (res.status === 404) {
        const endpoint = provider === "outlook" ? "/api/outlook/send" : "/api/gmail/send";
        const fallback = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, to: toEmail, subject, body }) });
        const fr = await fallback.json();
        if (fr.error) throw new Error(fr.error);
        alert(`✓ ${docType} sent to ${toEmail}`);
        return true;
      }
      throw new Error(`Send failed (${res.status})`);
    }
    const result = await res.json();
    if (result.error) throw new Error(result.error);
    const attachNote = result.hasAttachment ? " with PDF" : "";
    alert(`✓ ${docType} sent to ${toEmail}${attachNote}`);
    return true;
  } catch (err) {
    alert(`Failed to send: ${err.message}`);
    return false;
  } finally {
    if (setSending) setSending(null);
  }
}

export function InvoicePreview({ brand, invoice }) {
  const inv = invoice || { id: "INV-042", customer: "John Smith", address: "5 High Street\nGuildford GU1 3AA", desc: "Annual boiler service\nFlue check and clean\nPressure test", amount: 120, date: new Date().toLocaleDateString("en-GB"), due: "30 days", paymentMethod: brand.defaultPaymentMethod || "both", vatEnabled: false };
  const accent = brand.accentColor || "#f59e0b";
  const ref = buildRef(brand, inv);
  const payMethod = inv.paymentMethod || brand.defaultPaymentMethod || "both";
  const showBacs = payMethod === "bacs" || payMethod === "both";
  const showCard = payMethod === "card" || payMethod === "both";

  // VAT calculations — only if VAT number is set AND invoice has VAT enabled
  const vatEnabled = inv.vatEnabled && brand.vatNumber;
  const vatRate = inv.vatRate || 20;
  const netAmount = parseFloat(inv.amount) || 0;
  const vatAmount = vatEnabled ? parseFloat((netAmount * vatRate / 100).toFixed(2)) : 0;
  const grossAmount = netAmount + vatAmount;

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
      <div style={{ background: "#f8f8f8", padding: "14px 28px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #eee" }}>
        <div style={{ fontFamily: "Arial,sans-serif", fontSize: 12, display: "flex", flexDirection: "column", gap: 4 }}>
          <div><span style={{ color: "#888", marginRight: 6 }}>Date:</span>{inv.date}</div>
          <div><span style={{ color: "#888", marginRight: 6 }}>Payment due:</span>{brand.paymentTerms || "30"} days</div>
        </div>
        {brand.vatNumber && (brand._exemptBypass || brand.registrationVerifications?.vatNumber?.verified) && (
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
              {vatEnabled && <th style={{ textAlign: "right", padding: "12px 0 8px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "#888" }}>Net</th>}
              {vatEnabled && <th style={{ textAlign: "right", padding: "12px 0 8px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "#888" }}>VAT {vatRate}%</th>}
              <th style={{ textAlign: "right", padding: "12px 0 8px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "#888" }}>{vatEnabled ? "Gross" : "Amount"}</th>
            </tr>
          </thead>
          <tbody>
            {(inv.desc || "").split("\n").filter(Boolean).map((line, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "10px 0", fontSize: 13 }}>{line}</td>
                {vatEnabled && <td style={{ padding: "10px 0", fontSize: 13, textAlign: "right", color: i === 0 ? "#1a1a1a" : "#888" }}>{i === 0 ? `${fmtCurrency(netAmount)}` : "—"}</td>}
                {vatEnabled && <td style={{ padding: "10px 0", fontSize: 13, textAlign: "right", color: i === 0 ? "#1a1a1a" : "#888" }}>{i === 0 ? `${fmtCurrency(vatAmount)}` : "—"}</td>}
                <td style={{ padding: "10px 0", fontSize: 13, textAlign: "right", color: i === 0 ? "#1a1a1a" : "#888" }}>{i === 0 ? `${fmtCurrency(parseFloat(grossAmount))}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div style={{ margin: "0 28px", borderTop: `2px solid ${accent}`, padding: "14px 0" }}>
        {vatEnabled ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, fontFamily: "Arial,sans-serif" }}>
            <div style={{ display: "flex", gap: 32, fontSize: 12, color: "#888" }}>
              <span>Net amount</span>
              <span style={{ minWidth: 80, textAlign: "right" }}>£{netAmount.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", gap: 32, fontSize: 12, color: "#888" }}>
              <span>VAT @ {vatRate}%</span>
              <span style={{ minWidth: 80, textAlign: "right" }}>£{vatAmount.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", gap: 32, fontSize: 16, fontWeight: 700, color: accent, borderTop: `1px solid #eee`, paddingTop: 8, marginTop: 4 }}>
              <span>Total due (inc. VAT)</span>
              <span style={{ minWidth: 80, textAlign: "right" }}>£{parseFloat(grossAmount).toFixed(2)}</span>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 20 }}>
            <div style={{ fontFamily: "Arial,sans-serif", fontSize: 13, color: "#888" }}>Total Due</div>
            <div style={{ fontFamily: "Arial,sans-serif", fontSize: 22, fontWeight: 900, color: accent }}>£{parseFloat(grossAmount).toFixed(2)}</div>
          </div>
        )}
      </div>

      {/* Payment section */}
      <div style={{ margin: "0 28px 20px", display: "flex", flexDirection: "column", gap: 10 }}>

        {/* BACS block */}
        {showBacs && (
          <div style={{ background: "#f8f8f8", borderRadius: 10, padding: "14px 16px", border: "1px solid #eee" }}>
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
          <div style={{ background: "#635bff11", borderRadius: 10, padding: "14px 16px", border: "1px solid #635bff33" }}>
            <div style={{ fontSize: 10, fontFamily: "Arial,sans-serif", textTransform: "uppercase", letterSpacing: "0.08em", color: "#635bff", marginBottom: 8 }}>
              {showBacs ? "Option 2 — Pay by Card (Stripe)" : "Pay by Card (Stripe)"}
            </div>
            <div style={{ fontFamily: "Arial,sans-serif", fontSize: 12, color: "#444", marginBottom: 10 }}>
              Pay securely online by debit or credit card. Takes 30 seconds.
            </div>
            <div style={{ display: "inline-block", padding: "8px 18px", background: "#635bff", borderRadius: 8, fontFamily: "Arial,sans-serif", fontSize: 12, fontWeight: 700, color: "#fff", letterSpacing: "0.04em" }}>
              Pay {fmtAmount(inv.amount)} online →
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

export function Payments({ brand, invoices, setInvoices, customers, user, sendPush, setContextHint }) {
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [docType, setDocType] = useState("invoices");
  const [selected, setSelected] = useState(null);
  const [chasingId, setChasingId] = useState(null);

  const safeInvoices = invoices || [];
  const allInvoices = safeInvoices.filter(i => !i.isQuote);
  const allQuotes = safeInvoices.filter(i => i.isQuote);

  // Invoice breakdowns
  const paidInvoices = allInvoices.filter(i => i.status === "paid");
  const outstandingInvoices = allInvoices.filter(i => i.status !== "paid");
  const overdueInvoices = allInvoices.filter(i => i.status === "overdue");

  // Quote breakdowns
  const acceptedQuotes = allQuotes.filter(q => q.status === "accepted");
  const pendingQuotes = allQuotes.filter(q => q.status !== "accepted" && q.status !== "declined");
  const declinedQuotes = allQuotes.filter(q => q.status === "declined");

  // Context hint for floating mic
  useEffect(() => {
    if (!setContextHint) return;
    const total = outstandingInvoices.reduce((s, i) => s + parseFloat(i.grossAmount || i.amount || 0), 0);
    setContextHint(`Payments: ${outstandingInvoices.length} outstanding · £${Math.round(total).toLocaleString()}`);
    return () => { if (setContextHint) setContextHint(null); };
  }, [outstandingInvoices.length, setContextHint]);

  // Back-fill portal token for older docs opened from the Payments view
  // (quotes or invoices) that pre-date the portal feature. Matches the
  // InvoicesView back-fill so the shareable link exists whichever screen
  // the user opens the doc from.
  useEffect(() => {
    if (!selected) return;
    const existingToken = selected.portalToken || selected.portal_token;
    if (existingToken) return;
    const t = generatePortalToken();
    setSelected(s => ({ ...s, portalToken: t }));
    setInvoices(prev => (prev || []).map(i => i.id === selected.id ? { ...i, portalToken: t } : i));
    if (user?.id) db.from("invoices").update({ portal_token: t }).eq("id", selected.id).eq("user_id", user.id).then(() => {}).catch(() => {});
  }, [selected?.id]);

  const updateStatus = (id, status) => {
    const inv = (invoices || []).find(i => i.id === id);
    setInvoices(prev => (prev || []).map(i => i.id === id ? { ...i, status, due: status === "paid" ? "Paid" : i.due } : i));
    if (selected && selected.id === id) setSelected(s => ({ ...s, status, due: status === "paid" ? "Paid" : s.due }));
    if (status === "paid" && inv) {
      syncInvoiceToAccounting(user?.id, { ...inv, status: "paid" });
      if (sendPush) sendPush({
        title: "💰 Invoice Paid",
        body: `${inv.customer} paid ${fmtAmount(inv.amount)}`,
        url: "/",
        type: "invoice_paid",
        tag: "invoice-paid",
      });
      // Analytics parity with voice mark_invoice_paid — undercounting otherwise
      trackEvent(db, user?.id, window._companyId, "payment", "invoice_marked_paid", {
        amount: inv.amount,
        invoice_id: inv.id,
      });
    }
  };

  const convertToInvoice = (quote) => {
    const newId = nextInvoiceId(invoices);
    // Conversion preserves the original quote (don't delete). New invoice
    // gets its own fresh portal_token so the customer's existing quote link
    // still shows the quote; the invoice gets a new link in its email.
    const inv = {
      ...quote,
      isQuote: false,
      id: newId,
      status: "sent",
      due: `Due in ${brand.paymentTerms || 30} days`,
      portalToken: generatePortalToken(),
    };
    // Mark the quote as accepted (conversion implies customer said yes).
    // Leaves already-accepted quotes unchanged.
    const quoteNewStatus = (quote.status === "accepted") ? quote.status : "accepted";
    setInvoices(prev => {
      const withUpdatedQuote = (prev || []).map(i =>
        i.id === quote.id ? { ...i, status: quoteNewStatus } : i
      );
      return [inv, ...withUpdatedQuote];
    });
    setSelected(null);
    setDocType("invoices");
    // Persist: insert new invoice row + update quote status. Both non-blocking.
    if (user?.id) {
      db.from("invoices").upsert({
        id: inv.id, user_id: user?.id,
        customer: inv.customer, address: inv.address || "",
        email: inv.email || "", phone: inv.phone || "",
        amount: inv.amount, gross_amount: inv.grossAmount || inv.amount,
        status: "sent", is_quote: false,
        due: inv.due,
        description: inv.description || "",
        line_items: inv.lineItems ? JSON.stringify(inv.lineItems) : null,
        job_ref: inv.jobRef || "",
        created_at: new Date().toISOString(),
        portal_token: inv.portalToken,
      }).then(({ error }) => { if (error) console.error("convertToInvoice upsert failed:", error.message); });
      if (quote.status !== "accepted") {
        db.from("invoices").update({ status: "accepted" }).eq("id", quote.id).eq("user_id", user.id)
          .then(({ error }) => { if (error) console.error("convertToInvoice quote status update failed:", error.message); });
      }
    }
  };

  const deleteDoc = (id) => {
    setInvoices(prev => (prev || []).filter(i => i.id !== id));
    setSelected(null);
  };

  const accent = brand.accentColor || "#f59e0b";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Tab switcher */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => { setDocType("invoices"); setSelected(null); }} style={S.pill(accent, docType === "invoices")}>
            💰 Invoices ({allInvoices.length})
          </button>
          <button onClick={() => { setDocType("quotes"); setSelected(null); }} style={S.pill(accent, docType === "quotes")}>
            📋 Quotes ({allQuotes.length})
          </button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={S.btn("ghost")} onClick={() => setShowQuoteModal(true)}>+ Quote</button>
          <button style={S.btn("primary")} onClick={() => setShowInvoiceModal(true)}>+ Invoice</button>
        </div>
      </div>

      {/* ── INVOICES VIEW ── */}
      {docType === "invoices" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 10 }}>
            <div style={S.card}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Outstanding</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: outstandingInvoices.length > 0 ? C.amber : C.muted }}>{outstandingInvoices.length}</div>
              <div style={{ fontSize: 11, color: C.muted }}>£{outstandingInvoices.reduce((s, i) => s + (i.amount || 0), 0).toLocaleString()}</div>
            </div>
            <div style={S.card}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Overdue</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: overdueInvoices.length > 0 ? C.red : C.muted }}>{overdueInvoices.length}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{overdueInvoices.length > 0 ? "Needs chasing" : "None"}</div>
            </div>
            <div style={S.card}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Paid</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.green }}>{paidInvoices.length}</div>
              <div style={{ fontSize: 11, color: C.muted }}>£{paidInvoices.reduce((s, i) => s + (i.amount || 0), 0).toLocaleString()}</div>
            </div>
            <div style={S.card}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Total</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.text }}>{allInvoices.length}</div>
              <div style={{ fontSize: 11, color: C.muted }}>£{allInvoices.reduce((s, i) => s + (i.amount || 0), 0).toLocaleString()}</div>
            </div>
          </div>

          {/* Outstanding */}
          <div style={S.card}>
            <div style={S.sectionTitle}>Outstanding ({outstandingInvoices.length})</div>
            {outstandingInvoices.length === 0
              ? <div style={{ fontSize: 12, color: C.green, fontStyle: "italic" }}>All invoices paid!</div>
              : outstandingInvoices.map(inv => (
                <div key={inv.id} onClick={() => setSelected(inv)} style={{ ...S.row, cursor: "pointer" }}>
                  <div style={{ width: 4, height: 44, borderRadius: 2, background: inv.status === "overdue" ? C.red : C.amber, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{inv.customer}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>{inv.id} · {inv.due}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: inv.status === "overdue" ? C.red : C.text, marginRight: 8, flexShrink: 0 }}>{fmtAmount(inv.amount)}</div>
                  <div style={{ ...S.badge(statusColor[inv.status] || C.muted), marginRight: 8, flexShrink: 0 }}>{statusLabel[inv.status] || inv.status}</div>
                  <button onClick={e => { e.stopPropagation(); updateStatus(inv.id, "paid"); }} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px", color: C.green, flexShrink: 0 }}>✓ Paid</button>
                  <div style={{ fontSize: 11, color: C.muted, marginLeft: 4 }}>→</div>
                </div>
              ))
            }
          </div>

          {/* Paid */}
          {paidInvoices.length > 0 && (
            <div style={S.card}>
              <div style={S.sectionTitle}>Paid ({paidInvoices.length})</div>
              {paidInvoices.map(inv => (
                <div key={inv.id} onClick={() => setSelected(inv)} style={{ ...S.row, cursor: "pointer" }}>
                  <div style={{ width: 4, height: 44, borderRadius: 2, background: C.green, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{inv.customer}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>{inv.id}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.green, marginRight: 8, flexShrink: 0 }}>{fmtAmount(inv.amount)}</div>
                  <div style={S.badge(C.green)}>Paid</div>
                  <div style={{ fontSize: 11, color: C.muted, marginLeft: 8 }}>→</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── QUOTES VIEW ── */}
      {docType === "quotes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 10 }}>
            <div style={S.card}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Pending</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.blue }}>{pendingQuotes.length}</div>
              <div style={{ fontSize: 11, color: C.muted }}>£{pendingQuotes.reduce((s, q) => s + (q.amount || 0), 0).toLocaleString()}</div>
            </div>
            <div style={S.card}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Accepted</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.green }}>{acceptedQuotes.length}</div>
              <div style={{ fontSize: 11, color: C.muted }}>£{acceptedQuotes.reduce((s, q) => s + (q.amount || 0), 0).toLocaleString()}</div>
            </div>
            <div style={S.card}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Declined</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: declinedQuotes.length > 0 ? C.red : C.muted }}>{declinedQuotes.length}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{declinedQuotes.length > 0 ? "Not won" : "None"}</div>
            </div>
            <div style={S.card}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Pipeline</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.text }}>{allQuotes.length}</div>
              <div style={{ fontSize: 11, color: C.muted }}>£{allQuotes.reduce((s, q) => s + (q.amount || 0), 0).toLocaleString()}</div>
            </div>
          </div>

          {/* All quotes */}
          <div style={S.card}>
            <div style={S.sectionTitle}>All Quotes ({allQuotes.length})</div>
            {allQuotes.length === 0
              ? <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No quotes yet — tap + Quote above or ask the AI Assistant.</div>
              : allQuotes.map(q => (
                <div key={q.id} onClick={() => setSelected(q)} style={{ ...S.row, cursor: "pointer" }}>
                  <div style={{ width: 4, height: 44, borderRadius: 2, background: q.status === "accepted" ? C.green : q.status === "declined" ? C.red : C.blue, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{q.customer}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>{q.address || q.id} · {q.due}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginRight: 8, flexShrink: 0 }}>{fmtAmount(q.amount)}</div>
                  <div style={{ ...S.badge(q.status === "accepted" ? C.green : q.status === "declined" ? C.red : C.blue), marginRight: 8, flexShrink: 0 }}>
                    {q.status === "accepted" ? "Accepted" : q.status === "declined" ? "Declined" : "Sent"}
                  </div>
                  <button onClick={e => { e.stopPropagation(); convertToInvoice(q); }} style={{ ...S.btn("primary"), fontSize: 11, padding: "4px 10px", flexShrink: 0 }}>→ Invoice</button>
                  <div style={{ fontSize: 11, color: C.muted, marginLeft: 4 }}>→</div>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* Detail page — Phase 4 */}
      {selected && (
        <DetailPage
          title={selected.customer}
          subtitle={`${selected.isQuote ? "Quote" : "Invoice"} · ${selected.id}`}
          onBack={() => setSelected(null)}
          maxWidth={480}
        >
            {/* Amount + status hero */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 18, flexWrap: "wrap" }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: selected.status === "paid" ? C.green : C.text, letterSpacing: "-0.01em" }}>{fmtAmount(selected.amount)}</div>
              <span style={S.badge(statusColor[selected.status] || C.muted)}>{statusLabel[selected.status] || selected.status}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Line Items</div>
                {(selected.lineItems && selected.lineItems.length > 0)
                  ? selected.lineItems.map((l, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingTop: i > 0 ? 6 : 0, borderTop: i > 0 ? `1px solid ${C.border}` : "none", marginTop: i > 0 ? 6 : 0 }}>
                      <span>{l.description || l.desc || ""}</span>
                      {(l.amount || l.amount === 0) && <span style={{ fontWeight: 600, flexShrink: 0, marginLeft: 12 }}>£{(parseFloat(l.amount) || 0).toFixed(2)}</span>}
                    </div>
                  ))
                  : <div style={{ fontSize: 13, whiteSpace: "pre-line", lineHeight: 1.7 }}>{selected.description || selected.desc || "—"}</div>
                }
              </div>
              <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{selected.isQuote ? "Valid for" : "Payment due"}</div>
                <div style={{ fontSize: 13 }}>{selected.due}</div>
              </div>
              {/* Portal link — shared component, handles both quote and
                  invoice wording based on isQuote flag. */}
              <PortalLinkPanel
                token={selected.portalToken || selected.portal_token}
                isQuote={!!selected.isQuote}
                stripeReady={!!brand?.stripeAccountId}
                colors={{ muted: C.muted, text: C.text, border: C.border, surfaceHigh: C.surfaceHigh }}
                styles={{ input: S.input, btnGhost: S.btn("ghost") }}
              />
            </div>

            {/* Mark Paid — full width green button for invoices */}
            {!selected.isQuote && selected.status !== "paid" && (
              <button style={{ ...S.btn("primary"), width: "100%", justifyContent: "center", padding: "14px", fontSize: 15, background: C.green, color: "#000", marginBottom: 10 }}
                onClick={() => updateStatus(selected.id, "paid")}>
                ✓ Mark as Paid
              </button>
            )}
            {!selected.isQuote && selected.status === "paid" && (
              <div style={{ background: C.green + "18", border: `1px solid ${C.green}44`, borderRadius: 8, padding: "12px 16px", textAlign: "center", color: C.green, fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
                ✓ Invoice Paid
              </div>
            )}

            {/* Convert to Invoice — for quotes */}
            {selected.isQuote && (
              <button style={{ ...S.btn("primary"), width: "100%", justifyContent: "center", padding: "14px", fontSize: 15, marginBottom: 10 }}
                onClick={() => convertToInvoice(selected)}>
                → Convert to Invoice
              </button>
            )}

            {/* Quote accept/decline */}
            {selected.isQuote && selected.status !== "accepted" && selected.status !== "declined" && (
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", color: C.green }} onClick={() => updateStatus(selected.id, "accepted")}>✓ Mark Accepted</button>
                <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", color: C.red }} onClick={() => updateStatus(selected.id, "declined")}>✗ Mark Declined</button>
              </div>
            )}

            {/* Secondary */}
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center" }} onClick={() => downloadInvoicePDF(brand, selected)}>⬇ PDF</button>
              {!selected.isQuote && (selected.status === "overdue" || selected.status === "sent") && (
                <button style={{ ...S.btn("danger") }} disabled={chasingId === selected.id} onClick={async () => {
                  // Direct-send via the shared chase helper exposed by the AI
                  // assistant. Falls back to a status flip if the bridge isn't
                  // ready (rare — only during first render).
                  if (typeof window._tradePaChase !== "function") {
                    updateStatus(selected.id, "sent");
                    alert("Chase logic loading — status marked sent. Try again in a moment for the full email.");
                    return;
                  }
                  setChasingId(selected.id);
                  try {
                    const r = await window._tradePaChase(selected);
                    if (r?.ok) {
                      const tone = r.chaseNum <= 1 ? "Gentle reminder" : r.chaseNum === 2 ? "Firm follow-up" : "Final notice";
                      alert(`✓ ${tone} sent to ${selected.customer} (chase #${r.chaseNum}).`);
                    } else {
                      alert(r?.message || "Couldn't send the chase — check your email is connected.");
                    }
                  } finally { setChasingId(null); }
                }}>📨 {chasingId === selected.id ? "Chasing..." : "Chase"}</button>
              )}
              <button style={{ ...S.btn("ghost"), color: C.red }} onClick={() => deleteDoc(selected.id)}>Delete</button>
            </div>

            {/* Accounting sync — invoice only */}
            {!selected.isQuote && (
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", color: "#13B5EA", borderColor: "#13B5EA44", fontSize: 11 }}
                  onClick={() => {
                    fetch("/api/xero/create-invoice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user?.id, invoice: selected }) })
                      .then(r => r.json()).then(d => alert(d.error ? `Xero: ${d.error}` : "✓ Invoice sent to Xero")).catch(() => alert("Xero not connected — check Settings"));
                  }}>Xero Invoice</button>
                <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", color: "#2CA01C", borderColor: "#2CA01C44", fontSize: 11 }}
                  onClick={() => {
                    fetch("/api/quickbooks/create-invoice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user?.id, invoice: selected }) })
                      .then(r => r.json()).then(d => alert(d.error ? `QuickBooks: ${d.error}` : "✓ Invoice sent to QuickBooks")).catch(() => alert("QuickBooks not connected — check Settings"));
                  }}>QB Invoice</button>
              </div>
            )}
        </DetailPage>
      )}

      {showInvoiceModal && <InvoiceModal brand={brand} invoices={safeInvoices} user={user} customers={customers} onClose={() => setShowInvoiceModal(false)} onSent={(inv) => { setInvoices(prev => [inv, ...(prev || [])]); setShowInvoiceModal(false); syncInvoiceToAccounting(user?.id, inv); }} />}
      {showQuoteModal && <QuoteModal brand={brand} invoices={safeInvoices} user={user} customers={customers} onClose={() => setShowQuoteModal(false)} onSent={(q) => { setInvoices(prev => [q, ...(prev || [])]); setShowQuoteModal(false); setDocType("quotes"); }} />}
    </div>
  );
}

export function InvoicesView({ brand, invoices, setInvoices, user, customers, customerContacts, setContextHint }) {
  const [selected, setSelected] = useState(null);
  const [chasingInvId, setChasingInvId] = useState(null);

  // Phase 5b: publish context hint when an invoice is open.
  useEffect(() => {
    if (!setContextHint) return;
    if (selected) {
      const bits = [];
      bits.push("Invoice " + (selected.id || ""));
      if (selected.customer) bits.push(selected.customer);
      if (selected.amount) bits.push("£" + selected.amount);
      if (selected.status) bits.push(selected.status);
      setContextHint(bits.filter(Boolean).join(" · "));
    } else {
      setContextHint(null);
    }
    return () => { if (setContextHint) setContextHint(null); };
  }, [selected, setContextHint]);
  const [showModal, setShowModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [sendingId, setSendingId] = useState(null);

  const allInvoices = (invoices || []).filter(i => !i.isQuote);
  const paid = allInvoices.filter(i => i.status === "paid");
  const outstanding = allInvoices.filter(i => i.status !== "paid");
  const overdue = allInvoices.filter(i => i.status === "overdue");

  const updateStatus = (id, status) => {
    const inv = (invoices || []).find(i => i.id === id);
    setInvoices(prev => (prev || []).map(i => i.id === id ? { ...i, status, due: status === "paid" ? "Paid" : i.due } : i));
    if (selected && selected.id === id) setSelected(s => ({ ...s, status, due: status === "paid" ? "Paid" : s.due }));
    // Sync paid status to accounting software
    if (status === "paid" && inv && user?.id) {
      syncInvoiceToAccounting(user.id, { ...inv, status: "paid" });
      // Analytics parity with voice mark_invoice_paid — undercounting otherwise
      trackEvent(db, user?.id, window._companyId, "payment", "invoice_marked_paid", {
        amount: inv.amount,
        invoice_id: inv.id,
      });
    }
  };

  const deleteInvoice = (id) => {
    setInvoices(prev => (prev || []).filter(i => i.id !== id));
    setSelected(null);
  };

  // ── Phase 3: list-level controls (search / filter / sort / grouping) ───────
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [sortMode, setSortMode] = useState("recent");

  // Canonical invoice pill — amber reserved for actions/warnings per audit.
  // Routine statuses use muted/blue/red/green only.
  const INV_PILL = {
    draft:   { label: "Draft",   color: C.muted },
    sent:    { label: "Sent",    color: C.blue  },
    pending: { label: "Pending", color: C.blue  },
    due:     { label: "Due",     color: C.red   },
    overdue: { label: "Overdue", color: C.red   },
    paid:    { label: "Paid",    color: C.green },
  };
  const pillFor = (i) => INV_PILL[(i.status || "").toLowerCase()] || { label: (i.status || "—"), color: C.muted };

  // Relative timestamp + week bounds — see module-scope utilities.
  const _bounds = weekBounds();

  // Per-invoice derivations
  const isUnpaid  = (i) => (i.status || "").toLowerCase() !== "paid";
  const isOverdue = (i) => (i.status || "").toLowerCase() === "overdue";
  const isDraft   = (i) => (i.status || "").toLowerCase() === "draft";
  const invTime   = (i) => new Date(i.paidDate || i.created_at || i.date || 0).getTime();

  // Live chip counts
  const counts = {
    all:     allInvoices.length,
    unpaid:  allInvoices.filter(isUnpaid).length,
    overdue: allInvoices.filter(isOverdue).length,
    paid:    paid.length,
    draft:   allInvoices.filter(isDraft).length,
  };

  // Search + filter
  const _q = search.trim().toLowerCase();
  const filteredInvoices = allInvoices.filter(i => {
    if (_q) {
      const hay = [i.customer, i.address, i.id, i.description, i.job_ref, i.jobRef].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(_q)) return false;
    }
    switch (activeFilter) {
      case "unpaid":  return isUnpaid(i);
      case "overdue": return isOverdue(i);
      case "paid":    return (i.status || "").toLowerCase() === "paid";
      case "draft":   return isDraft(i);
      default:        return true;
    }
  });

  // Sort
  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
    switch (sortMode) {
      case "value":    return parseFloat(b.amount || 0) - parseFloat(a.amount || 0);
      case "customer": return (a.customer || "").localeCompare(b.customer || "");
      case "status":   return (a.status || "").localeCompare(b.status || "");
      default:         return invTime(b) - invTime(a);
    }
  });

  // Group by recency (recent sort only)
  const groupedInvoices = sortMode === "recent"
    ? groupByRecency(sortedInvoices, invTime, _bounds)
    : [{ key: "flat", label: null, items: sortedInvoices }];

  const CHIPS = [
    { id: "all",     label: "All",     urgent: false },
    { id: "unpaid",  label: "Unpaid",  urgent: true  },
    { id: "overdue", label: "Overdue", urgent: true  },
    { id: "paid",    label: "Paid",    urgent: false },
    { id: "draft",   label: "Draft",   urgent: false },
  ];
  const SORT_LABELS = { recent: "Recent", value: "By value", customer: "By customer", status: "By status" };
  const SORT_ORDER = ["recent", "value", "customer", "status"];
  const nextSort = () => setSortMode(s => SORT_ORDER[(SORT_ORDER.indexOf(s) + 1) % SORT_ORDER.length]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Invoices</div>
        <button style={S.btn("primary")} onClick={() => setShowModal(true)}>+ New Invoice</button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 10 }}>
        <div style={S.card}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Outstanding</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: outstanding.length > 0 ? C.amber : C.muted }}>{outstanding.length}</div>
          <div style={{ fontSize: 11, color: C.muted }}>£{outstanding.reduce((s, i) => s + (i.amount || 0), 0).toLocaleString()}</div>
        </div>
        <div style={S.card}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Overdue</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: overdue.length > 0 ? C.red : C.muted }}>{overdue.length}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{overdue.length > 0 ? "Needs chasing" : "All on time"}</div>
        </div>
        <div style={S.card}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Paid</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: C.green }}>{paid.length}</div>
          <div style={{ fontSize: 11, color: C.muted }}>£{paid.reduce((s, i) => s + (i.amount || 0), 0).toLocaleString()}</div>
        </div>
        <div style={S.card}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Total</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: C.text }}>{allInvoices.length}</div>
          <div style={{ fontSize: 11, color: C.muted }}>£{allInvoices.reduce((s, i) => s + (i.amount || 0), 0).toLocaleString()}</div>
        </div>
      </div>

      {/* Phase 3: search + filter chips + sort — always visible, persistent */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search invoices — customer, ref, address…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 13, minWidth: 0, fontFamily: "inherit" }}
          />
          {search && (
            <button onClick={() => setSearch("")} aria-label="Clear search" style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: 0, flexShrink: 0 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
          )}
        </div>

        {/* Filter chips */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
          {CHIPS.map(chip => {
            const n = counts[chip.id];
            const active = activeFilter === chip.id;
            const muted  = !active && chip.id !== "all" && n === 0;
            const urgentLive = chip.urgent && n > 0;
            const accent = urgentLive ? C.red : C.text;
            return (
              <button
                key={chip.id}
                onClick={() => setActiveFilter(chip.id)}
                disabled={muted}
                style={{
                  flexShrink: 0,
                  padding: "6px 11px",
                  borderRadius: 16,
                  border: `1px solid ${active ? accent : C.border}`,
                  background: active ? (urgentLive ? C.red + "22" : C.surfaceHigh) : "transparent",
                  color: active ? accent : (urgentLive ? C.red : C.muted),
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  fontFamily: "'DM Mono', monospace",
                  cursor: muted ? "default" : "pointer",
                  opacity: muted ? 0.4 : 1,
                  whiteSpace: "nowrap",
                  transition: "background 0.15s, border-color 0.15s, color 0.15s",
                }}
              >
                {chip.label}{n > 0 && <span style={{ marginLeft: 5, fontWeight: 700 }}>{n}</span>}
              </button>
            );
          })}
        </div>

        {/* Sort affordance */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={nextSort}
            aria-label="Change sort"
            style={{
              background: "none", border: "none",
              color: C.muted, fontSize: 11,
              fontFamily: "'DM Mono', monospace", letterSpacing: "0.04em",
              cursor: "pointer", padding: "2px 4px",
            }}
          >
            {SORT_LABELS[sortMode]} ↕
          </button>
        </div>
      </div>

      {/* Unified list — grouped by recency, filtered/sorted by chips+search */}
      {allInvoices.length > 0 && sortedInvoices.length === 0 && (
        <div style={{ ...S.card, textAlign: "center", padding: 22 }}>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>
            No invoices match {_q ? <>&ldquo;{search}&rdquo;</> : `"${CHIPS.find(c => c.id === activeFilter)?.label || activeFilter}"`}.
          </div>
          <button style={{ ...S.btn("ghost"), fontSize: 12 }} onClick={() => { setSearch(""); setActiveFilter("all"); }}>Clear filters</button>
        </div>
      )}
      {groupedInvoices.map(group => (
        <React.Fragment key={group.key}>
          {group.label && (
            <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: C.muted, letterSpacing: "0.14em", fontWeight: 700, paddingLeft: 2, paddingTop: 4 }}>
              {group.label} · {group.items.length}
            </div>
          )}
          {group.items.map(inv => {
            const pill = pillFor(inv);
            const overdue = isOverdue(inv);
            const paidRow = (inv.status || "").toLowerCase() === "paid";
            // Stripe follows urgency: overdue → red, paid → green, else pill colour
            const stripe = overdue ? C.red : paidRow ? C.green : pill.color;
            return (
              <div key={inv.id} onClick={() => setSelected(inv)} style={{ ...S.card, cursor: "pointer", borderLeft: `3px solid ${stripe}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.customer || "—"}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.id}{inv.address ? ` · ${inv.address}` : ""}</div>
                    {/* Metadata row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                      <span style={{ ...S.badge(pill.color), fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.04em" }}>{pill.label}</span>
                      {inv.due && <span style={{ fontSize: 11, color: overdue ? C.red : C.muted, fontFamily: "'DM Mono', monospace" }}>{inv.due}</span>}
                      {(inv.created_at || inv.date) && (
                        <span style={{ fontSize: 11, color: C.muted, fontFamily: "'DM Mono', monospace" }}>· {relTime(inv.created_at || inv.date)}</span>
                      )}
                      {(inv.job_ref || inv.jobRef) && <span style={{ ...S.badge(C.blue), fontFamily: "'DM Mono', monospace", fontSize: 10 }}>Job: {inv.job_ref || inv.jobRef}</span>}
                      {inv.cisEnabled && <span style={{ ...S.badge(C.purple), fontFamily: "'DM Mono', monospace", fontSize: 10 }}>CIS</span>}
                      {inv.vatEnabled && <span style={{ fontSize: 11, color: C.muted, fontFamily: "'DM Mono', monospace" }}>VAT</span>}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: "right" }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: paidRow ? C.green : overdue ? C.red : C.text, letterSpacing: "-0.01em" }}>{fmtAmount(inv.amount)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </React.Fragment>
      ))}

      {allInvoices.length === 0 && (
        <div style={{ ...S.card, textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>💰</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>No invoices yet</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>Create your first invoice or ask the AI Assistant.</div>
          <button style={S.btn("primary")} onClick={() => setShowModal(true)}>+ Create Invoice</button>
        </div>
      )}

      {/* Detail page — Phase 4 */}
      {selected && (
        <DetailPage
          title={selected.customer}
          subtitle={`Invoice · ${selected.id}`}
          onBack={() => setSelected(null)}
          maxWidth={480}
        >
          {/* Amount + status hero */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 18 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: selected.status === "paid" ? C.green : C.text, letterSpacing: "-0.01em" }}>{fmtAmount(selected.amount)}</div>
            <span style={S.badge(statusColor[selected.status] || C.muted)}>{statusLabel[selected.status] || selected.status}</span>
          </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              {selected.address && (
                <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Address</div>
                  <div style={{ fontSize: 13 }}>{selected.address}</div>
                </div>
              )}
              {selected.cisEnabled ? (
                <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>CIS Breakdown</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: C.muted }}>Labour</span><span>£{Number(selected.cisLabour || 0).toFixed(2)}</span></div>
                    {(selected.materialItems || []).filter(m => m.desc || m.description).map((m, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: C.muted }}>{m.desc || m.description}</span><span>£{Number(parseFloat(m.amount) || 0).toFixed(2)}</span></div>
                    ))}
                    {!(selected.materialItems || []).filter(m => m.desc || m.description).length && Number(selected.cisMaterials) > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: C.muted }}>Materials</span><span>£{Number(selected.cisMaterials || 0).toFixed(2)}</span></div>
                    )}
                    {selected.vatEnabled && !((selected.vatType || "").includes("drc")) && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: C.muted }}>{vatLabel(selected)}</span><span>£{((Number(selected.cisLabour) + Number(selected.cisMaterials)) * (Number(selected.vatRate) || 20) / 100).toFixed(2)}</span></div>
                    )}
                    {selected.vatEnabled && (selected.vatType || "").includes("drc") && (
                      <div style={{ fontSize: 11, color: C.muted, fontStyle: "italic" }}>{vatLabel(selected)} — contractor accounts for VAT</div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", color: C.red, paddingTop: 4, borderTop: `1px solid ${C.border}`, marginTop: 4 }}><span>CIS Deduction ({Number(selected.cisRate) || 20}% labour)</span><span>-£{Number(selected.cisDeduction || 0).toFixed(2)}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 13 }}><span>Net Payable</span><span>£{Number(selected.cisNetPayable || selected.amount || 0).toFixed(2)}</span></div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Line Items</div>
                  <LineItemsDisplay inv={selected} />
                </div>
              )}
              {selected.vatEnabled && !selected.cisEnabled && (
                <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>VAT</div>
                  <div style={{ fontSize: 13 }}>{vatLabel(selected)}</div>
                </div>
              )}
              <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Payment Due</div>
                <div style={{ fontSize: 13 }}>{selected.due}</div>
              </div>
              {selected.jobRef && (
                <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Job Reference</div>
                  <div style={{ fontSize: 13 }}>{selected.jobRef}</div>
                </div>
              )}
              {/* Portal link — lets customer view invoice and (if Stripe
                  connected) pay by card directly. Auto-included as CTA button
                  in the outgoing invoice email too. */}
              <PortalLinkPanel
                token={selected.portalToken || selected.portal_token}
                isQuote={false}
                stripeReady={!!brand?.stripeAccountId}
                colors={{ muted: C.muted, text: C.text, border: C.border, surfaceHigh: C.surfaceHigh }}
                styles={{ input: S.input, btnGhost: S.btn("ghost") }}
              />
            </div>

            {selected.status !== "paid"
              ? <button style={{ ...S.btn("primary"), width: "100%", justifyContent: "center", padding: "14px", fontSize: 15, background: C.green, color: "#000", marginBottom: 10 }} onClick={() => updateStatus(selected.id, "paid")}>✓ Mark as Paid</button>
              : <div style={{ background: C.green + "18", border: `1px solid ${C.green}44`, borderRadius: 8, padding: "12px 16px", textAlign: "center", color: C.green, fontWeight: 700, marginBottom: 10 }}>✓ Invoice Paid</div>
            }

            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center" }} onClick={() => downloadInvoicePDF(brand, selected)}>⬇ PDF</button>
              <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", color: C.blue }} onClick={() => sendDocumentEmail(selected, brand, customers, user?.id, setSendingId, customerContacts)} disabled={sendingId === selected?.id}>{sendingId === selected?.id ? "Sending..." : "✉ Send"}</button>
              <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center" }} onClick={() => setEditingInvoice(selected)}>✏ Edit</button>
              {(selected.status === "overdue" || selected.status === "sent") && (
                <button style={S.btn("danger")} disabled={chasingInvId === selected.id} onClick={async () => {
                  if (typeof window._tradePaChase !== "function") {
                    updateStatus(selected.id, "sent");
                    alert("Chase logic loading — status marked sent. Try again for the full email.");
                    return;
                  }
                  setChasingInvId(selected.id);
                  try {
                    const r = await window._tradePaChase(selected);
                    if (r?.ok) {
                      const tone = r.chaseNum <= 1 ? "Gentle reminder" : r.chaseNum === 2 ? "Firm follow-up" : "Final notice";
                      alert(`✓ ${tone} sent to ${selected.customer} (chase #${r.chaseNum}).`);
                    } else {
                      alert(r?.message || "Couldn't send the chase — check your email is connected.");
                    }
                  } finally { setChasingInvId(null); }
                }}>📨 {chasingInvId === selected.id ? "Chasing..." : "Chase"}</button>
              )}
              <button style={{ ...S.btn("ghost"), color: C.red }} onClick={() => deleteInvoice(selected.id)}>Delete</button>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", color: "#13B5EA", borderColor: "#13B5EA44", fontSize: 11 }}
                onClick={() => {
                  fetch("/api/xero/create-invoice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user?.id, invoice: selected }) })
                    .then(r => r.json()).then(d => alert(d.error ? `Xero: ${d.error}` : "✓ Invoice sent to Xero")).catch(() => alert("Xero not connected — check Settings"));
                }}>Xero Invoice</button>
              <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", color: "#2CA01C", borderColor: "#2CA01C44", fontSize: 11 }}
                onClick={() => {
                  fetch("/api/quickbooks/create-invoice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user?.id, invoice: selected }) })
                    .then(r => r.json()).then(d => alert(d.error ? `QuickBooks: ${d.error}` : "✓ Invoice sent to QuickBooks")).catch(() => alert("QuickBooks not connected — check Settings"));
                }}>QB Invoice</button>
            </div>
        </DetailPage>
      )}

      {showModal && <InvoiceModal brand={brand} invoices={invoices} user={user} customers={customers} onClose={() => setShowModal(false)} onSent={inv => { setInvoices(prev => [inv, ...(prev || [])]); setShowModal(false); syncInvoiceToAccounting(user?.id, inv); }} />}
      {editingInvoice && <InvoiceModal brand={brand} invoices={invoices} user={user} customers={customers} initialData={editingInvoice} onClose={() => setEditingInvoice(null)} onSent={updated => { setInvoices(prev => (prev || []).map(i => i.id === editingInvoice.id ? { ...i, ...updated } : i)); setSelected(updated); setEditingInvoice(null); }} />}
    </div>
  );
}

export function QuotesView({ brand, invoices, setInvoices, setView, customers, customerContacts, user, setContextHint }) {
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingQuote, setEditingQuote] = useState(null);
  const [sendingId, setSendingId] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all | pending | expired | accepted | declined
  const [sortMode, setSortMode] = useState("recent"); // recent | value | customer

  // ── Expiry calc ─────────────────────────────────────────────────────────
  // A quote is "expired" if its created_at is older than brand.quoteValidity
  // days AND it hasn't been accepted/declined yet. We compute on render rather
  // than persisting status, so changing quoteValidity in Settings retroactively
  // updates which quotes show as expired (no migration needed).
  const validityDays = parseInt(brand?.quoteValidity || "30", 10) || 30;
  const expiryInfo = (q) => {
    const createdAt = new Date(q.updated_at || q.created_at || Date.now());
    const expiresAt = new Date(createdAt.getTime() + validityDays * 86400000);
    const daysLeft = Math.ceil((expiresAt - Date.now()) / 86400000);
    const settledStatus = q.status === "accepted" || q.status === "declined";
    return {
      expiresAt,
      daysLeft,
      isExpired: !settledStatus && daysLeft < 0,
      isExpiringSoon: !settledStatus && daysLeft >= 0 && daysLeft <= 3,
    };
  };

  useEffect(() => {
    if (!setContextHint) return;
    const quotes = (invoices || []).filter(i => i.isQuote);
    const pending = quotes.filter(q => q.status !== "accepted" && q.status !== "declined").length;
    const val = quotes.reduce((s, q) => s + parseFloat(q.grossAmount || q.amount || 0), 0);
    setContextHint(`Quotes: ${quotes.length} total · ${pending} pending · £${Math.round(val).toLocaleString()} pipeline`);
    return () => { if (setContextHint) setContextHint(null); };
  }, [invoices, setContextHint]);

  // Canonical pill map — amber discipline (blue for open, green for won, red for lost)
  const QUOTE_PILL = {
    accepted: { bg: C.green, label: "Accepted" },
    declined: { bg: C.red, label: "Declined" },
    sent:     { bg: C.blue, label: "Sent" },
    draft:    { bg: C.muted, label: "Draft" },
    expired:  { bg: C.red, label: "Expired" },
  };
  const pillFor = (q) => {
    if (q.status === "accepted") return QUOTE_PILL.accepted;
    if (q.status === "declined") return QUOTE_PILL.declined;
    if (q.status === "draft") return QUOTE_PILL.draft;
    if (expiryInfo(q).isExpired) return QUOTE_PILL.expired;
    return QUOTE_PILL.sent;
  };

  const allQuotes = (invoices || []).filter(i => i.isQuote);
  const expired = allQuotes.filter(q => expiryInfo(q).isExpired);
  const pending = allQuotes.filter(q => q.status !== "accepted" && q.status !== "declined" && !expiryInfo(q).isExpired);
  const accepted = allQuotes.filter(q => q.status === "accepted");
  const declined = allQuotes.filter(q => q.status === "declined");

  // Search + filter + sort
  const qLower = search.trim().toLowerCase();
  const filteredQuotes = allQuotes.filter(q => {
    const exp = expiryInfo(q);
    if (filter === "pending"  && (q.status === "accepted" || q.status === "declined" || exp.isExpired)) return false;
    if (filter === "expired"  && !exp.isExpired) return false;
    if (filter === "accepted" && q.status !== "accepted") return false;
    if (filter === "declined" && q.status !== "declined") return false;
    if (!qLower) return true;
    return (q.customer || "").toLowerCase().includes(qLower)
        || (q.id || "").toLowerCase().includes(qLower)
        || (q.address || "").toLowerCase().includes(qLower)
        || (q.type || "").toLowerCase().includes(qLower);
  });
  const sortedQuotes = [...filteredQuotes].sort((a, b) => {
    if (sortMode === "value") return (b.amount || 0) - (a.amount || 0);
    if (sortMode === "customer") return (a.customer || "").localeCompare(b.customer || "");
    // recent — use updated_at/created_at
    const at = a.updated_at || a.created_at || 0;
    const bt = b.updated_at || b.created_at || 0;
    return new Date(bt) - new Date(at);
  });

  const updateStatus = (id, status) => {
    setInvoices(prev => (prev || []).map(i => i.id === id ? { ...i, status } : i));
    if (selected && selected.id === id) setSelected(s => ({ ...s, status }));
  };

  // Reset the validity clock on an expired (or about-to-expire) quote.
  // Bumps updated_at to now — expiryInfo() uses updated_at first then created_at,
  // so this gives the customer a fresh window without losing the original
  // creation timestamp for audit / sort.
  const extendQuote = (id) => {
    const newUpdated = new Date().toISOString();
    setInvoices(prev => (prev || []).map(i => i.id === id ? { ...i, updated_at: newUpdated } : i));
    if (selected && selected.id === id) setSelected(s => ({ ...s, updated_at: newUpdated }));
    if (user?.id) db.from("invoices").update({ updated_at: newUpdated }).eq("id", id).eq("user_id", user.id).then(() => {}).catch(() => {});
  };

  // Back-fill portal token for older docs (quotes OR invoices) that were
  // created before the portal existed. Runs silently whenever the user opens
  // a doc with no token yet — generates one and persists to DB so the URL
  // can be shared. Portal page handles quote vs invoice rendering via the
  // stored is_quote flag, so a single token back-fill works for both.
  useEffect(() => {
    if (!selected) return;
    const existingToken = selected.portalToken || selected.portal_token;
    if (existingToken) return;
    const t = generatePortalToken();
    setSelected(s => ({ ...s, portalToken: t }));
    setInvoices(prev => (prev || []).map(i => i.id === selected.id ? { ...i, portalToken: t } : i));
    if (user?.id) db.from("invoices").update({ portal_token: t }).eq("id", selected.id).eq("user_id", user.id).then(() => {}).catch(() => {});
  }, [selected?.id]);

  const convertToInvoice = async (quote) => {
    const newId = nextInvoiceId(invoices);
    // Conversion preserves the original quote (don't delete). New invoice
    // gets its own fresh portal_token. See matching logic in Payments and
    // the AI convert_quote_to_invoice tool.
    const inv = {
      ...quote,
      isQuote: false,
      id: newId,
      status: "sent",
      due: `Due in ${brand.paymentTerms || 30} days`,
      portalToken: generatePortalToken(),
    };
    const quoteNewStatus = (quote.status === "accepted") ? quote.status : "accepted";
    setInvoices(prev => {
      const withUpdatedQuote = (prev || []).map(i =>
        i.id === quote.id ? { ...i, status: quoteNewStatus } : i
      );
      return [inv, ...withUpdatedQuote];
    });
    setSelected(null);
    // Persist the invoice itself: insert new invoice row + update quote
    // status. Both non-blocking — errors logged but don't block the UI.
    if (user?.id) {
      db.from("invoices").upsert({
        id: inv.id, user_id: user?.id,
        customer: inv.customer, address: inv.address || "",
        email: inv.email || "", phone: inv.phone || "",
        amount: inv.amount, gross_amount: inv.grossAmount || inv.amount,
        status: "sent", is_quote: false,
        due: inv.due,
        description: inv.description || "",
        line_items: inv.lineItems ? JSON.stringify(inv.lineItems) : null,
        job_ref: inv.jobRef || "",
        created_at: new Date().toISOString(),
        portal_token: inv.portalToken,
      }).then(({ error }) => { if (error) console.error("convertToInvoice upsert failed:", error.message); });
      if (quote.status !== "accepted") {
        db.from("invoices").update({ status: "accepted" }).eq("id", quote.id).eq("user_id", user.id)
          .then(({ error }) => { if (error) console.error("convertToInvoice quote status update failed:", error.message); });
      }
    }
    // Build scope of work from quote line items or description
    const scopeOfWork = (quote.lineItems && quote.lineItems.length > 0)
      ? quote.lineItems.map(l => l.description || l.desc || "").filter(Boolean).join("\n")
      : (quote.description || quote.desc || "");
    // Create a job card in Supabase
    if (user?.id) {
      db.from("job_cards").insert({
        user_id: user.id,
        title: `${quote.id} — ${quote.customer}`,
        customer: quote.customer,
        address: quote.address || "",
        type: quote.type || "",
        status: "accepted",
        value: quote.amount || 0,
        quote_id: quote.id,
        invoice_id: newId,
        scope_of_work: scopeOfWork,
        notes: `Converted from quote ${quote.id} on ${new Date().toLocaleDateString("en-GB")}`,
      }).then(({ error }) => { if (error) console.error("Job card creation failed:", error.message); });
    }
    setView("Jobs");
  };

  const deleteQuote = (id) => {
    setInvoices(prev => (prev || []).filter(i => i.id !== id));
    setSelected(null);
  };

  const FilterChip = ({ id, label, count, color }) => (
    <button
      onClick={() => setFilter(id)}
      style={{
        padding: "6px 12px", borderRadius: 16, fontSize: 12, fontWeight: 600,
        background: filter === id ? (color || C.text) : "transparent",
        color: filter === id ? (color === C.text ? C.bg : "#fff") : C.textDim,
        border: `1px solid ${filter === id ? (color || C.text) : C.border}`,
        cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
      }}
    >
      {label} {count != null && <span style={{ opacity: 0.7, marginLeft: 4 }}>{count}</span>}
    </button>
  );

  const nextSort = () => {
    setSortMode(m => m === "recent" ? "value" : m === "value" ? "customer" : "recent");
  };
  const sortLabel = sortMode === "recent" ? "Recent" : sortMode === "value" ? "Value" : "Customer";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Quotes</div>
        <button style={{ ...S.btn("primary"), background: C.blue }} onClick={() => setShowModal(true)}>+ New Quote</button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 10 }}>
        <div style={S.card}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Pending</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: C.blue }}>{pending.length}</div>
          <div style={{ fontSize: 11, color: C.muted }}>£{pending.reduce((s, q) => s + (q.amount || 0), 0).toLocaleString()}</div>
        </div>
        <div style={S.card}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Accepted</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: C.green }}>{accepted.length}</div>
          <div style={{ fontSize: 11, color: C.muted }}>£{accepted.reduce((s, q) => s + (q.amount || 0), 0).toLocaleString()}</div>
        </div>
        <div style={S.card}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Declined</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: declined.length > 0 ? C.red : C.muted }}>{declined.length}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{declined.length > 0 ? "Not won" : "None lost"}</div>
        </div>
        <div style={S.card}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Pipeline</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: C.text }}>{allQuotes.length}</div>
          <div style={{ fontSize: 11, color: C.muted }}>£{allQuotes.reduce((s, q) => s + (q.amount || 0), 0).toLocaleString()}</div>
        </div>
      </div>

      {/* Search */}
      {allQuotes.length > 0 && (
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search customer, ID, address…"
          style={{ ...S.input, fontSize: 13 }}
        />
      )}

      {/* Filter + sort chips */}
      {allQuotes.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <FilterChip id="all" label="All" count={allQuotes.length} />
          <FilterChip id="pending" label="Pending" count={pending.length} color={C.blue} />
          <FilterChip id="expired" label="Expired" count={expired.length} color={C.red} />
          <FilterChip id="accepted" label="Accepted" count={accepted.length} color={C.green} />
          <FilterChip id="declined" label="Declined" count={declined.length} color={C.red} />
          <button onClick={nextSort} style={{
            marginLeft: "auto", padding: "6px 12px", borderRadius: 16,
            fontSize: 12, fontWeight: 600, background: "transparent",
            color: C.muted, border: `1px solid ${C.border}`, cursor: "pointer",
            whiteSpace: "nowrap",
          }}>↕ {sortLabel}</button>
        </div>
      )}

      {/* List */}
      <div style={S.card}>
        {allQuotes.length === 0 ? (
          <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic", padding: "8px 0" }}>No quotes yet — tap + New Quote or ask the AI Assistant.</div>
        ) : sortedQuotes.length === 0 ? (
          <div style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: "24px 8px" }}>
            {search ? `No quotes match "${search}".` : `No ${filter === "pending" ? "pending" : filter === "expired" ? "expired" : filter === "accepted" ? "accepted" : "declined"} quotes.`}
          </div>
        ) : sortedQuotes.map(q => {
          const pill = pillFor(q);
          const exp = expiryInfo(q);
          // Sub-line: replace the static "Valid for X days" label with live status when relevant
          const subLine = exp.isExpired
            ? <span style={{ color: C.red }}>Expired {Math.abs(exp.daysLeft)} day{Math.abs(exp.daysLeft) === 1 ? "" : "s"} ago</span>
            : exp.isExpiringSoon
              ? <span style={{ color: C.amber }}>Expires in {exp.daysLeft} day{exp.daysLeft === 1 ? "" : "s"}</span>
              : <span>{q.due}</span>;
          return (
            <div key={q.id} onClick={() => setSelected(q)} style={{ ...S.row, cursor: "pointer" }}>
              <div style={{ width: 4, height: 44, borderRadius: 2, background: pill.bg, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{q.customer}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{q.address || q.id} · {subLine}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, marginRight: 8, flexShrink: 0 }}>{fmtAmount(q.amount)}</div>
              <div style={{ ...S.badge(pill.bg), marginRight: 8, flexShrink: 0 }}>{pill.label}</div>
              <button onClick={e => { e.stopPropagation(); sendDocumentEmail(q, brand, customers, user?.id, setSendingId, customerContacts); }} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 8px", color: C.blue, flexShrink: 0 }} disabled={sendingId === q.id}>{sendingId === q.id ? "..." : "✉"}</button>
              <button onClick={e => { e.stopPropagation(); convertToInvoice(q); }} style={{ ...S.btn("primary"), fontSize: 11, padding: "4px 10px", flexShrink: 0 }}>→ Invoice</button>
              <div style={{ fontSize: 11, color: C.muted, marginLeft: 4 }}>→</div>
            </div>
          );
        })}
      </div>

      {/* Detail page — Phase 4 */}
      {selected && !editingQuote && (
        <DetailPage
          title={selected.customer}
          subtitle={`Quote · ${selected.id}`}
          onBack={() => setSelected(null)}
          maxWidth={480}
        >
          {/* Amount + status hero */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: selected.status === "accepted" ? C.green : C.text, letterSpacing: "-0.01em" }}>{fmtAmount(selected.amount)}</div>
            <span style={S.badge(pillFor(selected).bg)}>{pillFor(selected).label}</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Line Items</div>
              <LineItemsDisplay inv={selected} />
            </div>
            <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Valid For</div>
              <div style={{ fontSize: 13 }}>{selected.due}</div>
            </div>
            {selected.jobRef && (
              <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Job Reference</div>
                <div style={{ fontSize: 13 }}>{selected.jobRef}</div>
              </div>
            )}
            {/* Customer portal link — share this URL with the customer so
                they can view, accept or decline the quote without logging in.
                Generated on quote creation or back-filled when viewed. Uses
                the shared PortalLinkPanel component so quote/invoice detail
                pages stay in sync on wording changes. */}
            <PortalLinkPanel
              token={selected.portalToken || selected.portal_token}
              isQuote={true}
              stripeReady={!!brand?.stripeAccountId}
              colors={{ muted: C.muted, text: C.text, border: C.border, surfaceHigh: C.surfaceHigh }}
              styles={{ input: S.input, btnGhost: S.btn("ghost") }}
            />
          </div>

          <button style={{ ...S.btn("primary"), width: "100%", justifyContent: "center", padding: "14px", fontSize: 15, marginBottom: 10 }}
            onClick={() => convertToInvoice(selected)}>→ Convert to Invoice</button>

          {selected.status !== "accepted" && selected.status !== "declined" && (
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", color: C.green }} onClick={() => updateStatus(selected.id, "accepted")}>✓ Mark Accepted</button>
              <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", color: C.red }} onClick={() => updateStatus(selected.id, "declined")}>✗ Mark Declined</button>
            </div>
          )}

          {selected.status !== "accepted" && selected.status !== "declined" && (() => {
            const exp = expiryInfo(selected);
            if (!exp.isExpired && !exp.isExpiringSoon) return null;
            return (
              <div style={{ background: exp.isExpired ? "#ef444412" : C.amber + "12", border: `1px solid ${exp.isExpired ? "#ef444444" : C.amber + "44"}`, borderRadius: 8, padding: "10px 14px", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 12, color: exp.isExpired ? "#ef4444" : C.amber, flex: 1, minWidth: 180 }}>
                  {exp.isExpired
                    ? <>This quote expired {Math.abs(exp.daysLeft)} day{Math.abs(exp.daysLeft) === 1 ? "" : "s"} ago.</>
                    : <>This quote expires in {exp.daysLeft} day{exp.daysLeft === 1 ? "" : "s"}.</>}
                </div>
                <button onClick={() => extendQuote(selected.id)} style={{ ...S.btn("ghost"), fontSize: 11 }}>↻ Extend by {validityDays}d</button>
              </div>
            );
          })()}

          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center" }} onClick={() => setEditingQuote(selected)}>✏️ Edit</button>
            <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center" }} onClick={() => downloadInvoicePDF(brand, selected)}>⬇ PDF</button>
            <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", color: C.blue }} onClick={() => sendDocumentEmail(selected, brand, customers, user?.id, setSendingId, customerContacts)} disabled={sendingId === selected?.id}>{sendingId === selected?.id ? "Sending..." : "✉ Send"}</button>
            <button style={{ ...S.btn("ghost"), color: C.red }} onClick={() => deleteQuote(selected.id)}>Delete</button>
          </div>
        </DetailPage>
      )}

      {showModal && <QuoteModal brand={brand} invoices={invoices} user={user} customers={customers} onClose={() => setShowModal(false)} onSent={q => { setInvoices(prev => [q, ...(prev || [])]); setShowModal(false); }} />}
      {editingQuote && <QuoteModal brand={brand} invoices={invoices} user={user} customers={customers} initialData={editingQuote} onClose={() => setEditingQuote(null)} onSent={updated => { setInvoices(prev => (prev || []).map(i => i.id === editingQuote.id ? { ...i, ...updated } : i)); setSelected(updated); setEditingQuote(null); }} />}
    </div>
  );
}
