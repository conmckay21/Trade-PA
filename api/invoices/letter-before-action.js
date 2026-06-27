// api/invoices/letter-before-action.js
// Generates a Letter Before Action (LBA) for an overdue invoice, as printable
// HTML the tradesperson can read, print, save as PDF, or send.
//
// Auth: token-only, same trust model as the customer portal (api/portal.js). The
// portal_token is an unguessable per-invoice string, and the letter is a document
// addressed to the customer about their overdue invoice, so this matches the
// portal's "anyone with the link can view this invoice" model.
//
// For COMMERCIAL debts (the matched customer is marked as a company) the letter
// states the statutory entitlement under the Late Payment of Commercial Debts
// (Interest) Act 1998: interest at 8% above the Bank of England base rate, plus a
// fixed sum in compensation (40, 70 or 100 pounds by debt size). For CONSUMER
// debts no statutory interest is claimed and the letter flags the Pre-Action
// Protocol for Debt Claims. The invoice record is never modified.
//
// This is a template to help the tradesperson, not legal advice. The letter says
// so, and signposts (does not advise) the Money Claim Online route.

import { withSentry } from "../lib/sentry.js";

// Bank of England base rate. Statutory rate = base + 8%. Update when the MPC
// changes the rate (the Act fixes the reference rate at the base rate in force on
// 30 June / 31 December). Verified at 3.75% as at 18 June 2026.
const BOE_BASE_RATE = 3.75;
const STATUTORY_MARGIN = 8;

function svcKey() {
  return process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
}

async function supabaseGet(path) {
  const r = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: svcKey(), Authorization: `Bearer ${svcKey()}` },
  });
  return r.json().catch(() => null);
}

function gbp(n) {
  return `£${Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
}
function compensationBand(principal) {
  if (principal < 1000) return 40;
  if (principal < 10000) return 70;
  return 100;
}

function htmlPage(title, inner) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;max-width:720px;margin:0 auto;padding:32px 24px;line-height:1.6;}
  .toolbar{background:#f5f5f7;border-radius:10px;padding:12px 16px;margin-bottom:24px;font-size:13px;color:#555;display:flex;justify-content:space-between;align-items:center;gap:12px;}
  .toolbar button{background:#0A0A0A;color:#fff;border:0;border-radius:7px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;}
  h1{font-size:20px;margin:18px 0 4px;}
  .muted{color:#777;font-size:13px;}
  .box{background:#faf7f0;border:1px solid #eee;border-left:4px solid #F59E0B;border-radius:6px;padding:16px;margin:16px 0;}
  .row{display:flex;justify-content:space-between;padding:4px 0;}
  .row span:first-child{color:#666;}
  .total{font-size:17px;font-weight:700;border-top:1px solid #e6ddc8;margin-top:6px;padding-top:8px;}
  .caveat{background:#fff8f0;border:1px solid #f0e0c0;border-radius:6px;padding:14px;margin-top:20px;font-size:12px;color:#8a6d3b;}
  a{color:#b45309;}
  @media print{.toolbar{display:none;}}
</style></head><body>
<div class="toolbar"><span>Review this letter before sending it.</span><button onclick="window.print()">Print or save as PDF</button></div>
${inner}
</body></html>`;
}

async function handler(req, res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  const token = (req.query.token || "").toString();
  if (!token) { res.status(400).send(htmlPage("Letter before action", "<p>This link is missing its token.</p>")); return; }

  const invoices = await supabaseGet(`invoices?portal_token=eq.${encodeURIComponent(token)}&select=*&limit=1`);
  const inv = Array.isArray(invoices) ? invoices[0] : null;
  if (!inv) { res.status(404).send(htmlPage("Letter before action", "<p>Invoice not found.</p>")); return; }

  // Matched customer (by name) for company status + address.
  let customer = null;
  if (inv.customer) {
    const custs = await supabaseGet(`customers?user_id=eq.${encodeURIComponent(inv.user_id)}&select=name,address,is_company&limit=200`);
    if (Array.isArray(custs)) customer = custs.find(c => (c.name || "").toLowerCase() === inv.customer.toLowerCase()) || null;
  }
  const isCompany = !!customer?.is_company;

  // Brand (trading name, contact, bank details) from user_settings.brand_data,
  // the same source the portal uses.
  const settingsRows = await supabaseGet(`user_settings?user_id=eq.${encodeURIComponent(inv.user_id)}&select=brand_data&limit=1`);
  const brand = (Array.isArray(settingsRows) && settingsRows[0]?.brand_data) || {};

  const principal = Number(inv.gross_amount ?? inv.amount ?? 0);
  const today = new Date();
  const dueDate = inv.due_date ? new Date(inv.due_date) : null;
  const daysOverdue = dueDate ? Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / 86400000)) : null;

  // Statutory additions (commercial debts only)
  const statutoryRate = BOE_BASE_RATE + STATUTORY_MARGIN;
  let interest = 0, compensation = 0;
  if (isCompany && daysOverdue != null) {
    interest = principal * (statutoryRate / 100) * (daysOverdue / 365);
    compensation = compensationBand(principal);
  }
  const totalDue = principal + interest + compensation;

  const responseDays = isCompany ? 14 : 30; // consumer pre-action protocol expects 30 days
  const deadline = new Date(today.getTime() + responseDays * 86400000);

  const tradingName = brand.tradingName || "";
  const contactLine = [brand.phone, brand.email].filter(Boolean).map(esc).join(" &middot; ");

  const bank = (brand.bankName || brand.accountNumber) ? `
    <div class="box">
      <strong>Pay by bank transfer</strong>
      ${brand.accountName ? `<div class="row"><span>Account name</span><span>${esc(brand.accountName)}</span></div>` : ""}
      ${brand.bankName ? `<div class="row"><span>Bank</span><span>${esc(brand.bankName)}</span></div>` : ""}
      ${brand.sortCode ? `<div class="row"><span>Sort code</span><span>${esc(brand.sortCode)}</span></div>` : ""}
      ${brand.accountNumber ? `<div class="row"><span>Account number</span><span>${esc(brand.accountNumber)}</span></div>` : ""}
      <div class="row"><span>Reference</span><span>${esc(inv.id)}</span></div>
    </div>` : "";
  const portalLink = inv.portal_token ? `<p>You can also view and pay this invoice online: <a href="https://view.tradespa.co.uk/quote/${esc(inv.portal_token)}">view.tradespa.co.uk/quote/${esc(inv.portal_token)}</a></p>` : "";

  // Dated record of every prior chase, from the stored send log, so the
  // letter documents that the debtor was given clear and repeated notice
  // before any action was taken.
  const chaseLog = Array.isArray(inv.chase_history) ? inv.chase_history : [];
  const chaseLogDates = chaseLog.map(h => fmtDate(h.at)).filter(Boolean);
  const chaseLogPhrase = chaseLogDates.length > 1
    ? chaseLogDates.slice(0, -1).join(", ") + " and " + chaseLogDates[chaseLogDates.length - 1]
    : (chaseLogDates[0] || "");
  const chaseLogPara = chaseLogDates.length
    ? `<p>We have already written to you regarding this invoice on ${chaseLogPhrase}, and payment remains outstanding.</p>`
    : "";

  const sumsRows = (isCompany && daysOverdue != null) ? `
    <div class="row"><span>Original invoice</span><span>${gbp(principal)}</span></div>
    <div class="row"><span>Interest (${statutoryRate.toFixed(2)}% per year, ${daysOverdue} days)</span><span>${gbp(interest)}</span></div>
    <div class="row"><span>Compensation (Late Payment Act)</span><span>${gbp(compensation)}</span></div>
    <div class="row total"><span>Total now due</span><span>${gbp(totalDue)}</span></div>`
    : `<div class="row total"><span>Total now due</span><span>${gbp(principal)}</span></div>`;

  const commercialPara = isCompany ? `
    <p>As this is a commercial debt, we are entitled to claim interest and a fixed sum in
    compensation under the Late Payment of Commercial Debts (Interest) Act 1998. Interest is
    charged at ${statutoryRate.toFixed(2)}% per year, being ${STATUTORY_MARGIN}% above the Bank
    of England base rate of ${BOE_BASE_RATE.toFixed(2)}%, and continues to accrue daily until
    the debt is paid.</p>` : "";

  const consumerCaveat = !isCompany ? `
    <div class="caveat">
      <strong>Before you send this (consumer debt).</strong> Because this customer is an
      individual rather than a business, the Pre-Action Protocol for Debt Claims applies. You
      should normally allow 30 days for a response and include the official Information Sheet
      and Reply Form with this letter. Statutory late-payment interest does not apply to
      consumer debts unless your contract provides for it. Check the requirements at gov.uk or
      take advice before issuing a court claim.
    </div>` : "";

  const addressHtml = customer && customer.address ? `<br>${esc(customer.address).replace(/\n/g, "<br>")}` : "";

  const inner = `
    <div style="text-align:right;">
      ${tradingName ? `<h1 style="text-align:right;margin-top:0;">${esc(tradingName)}</h1>` : ""}
      ${contactLine ? `<div class="muted">${contactLine}</div>` : ""}
    </div>
    <p class="muted">${fmtDate(today)}</p>

    <p><strong>${esc(inv.customer || "")}</strong>${addressHtml}</p>

    <h1>Letter before action</h1>
    <p><strong>Re: Invoice ${esc(inv.id)}</strong>${inv.created_at ? ` dated ${fmtDate(inv.created_at)}` : ""}${dueDate ? `, payment due ${fmtDate(dueDate)}` : ""}${daysOverdue != null ? ` (now ${daysOverdue} days overdue)` : ""}.</p>

    <p>Dear ${esc(inv.customer || "Sir or Madam")},</p>
    <p>Despite previous reminders, the above invoice remains unpaid. This letter is a formal
    request for payment before any further action is taken.</p>
    ${chaseLogPara}

    ${commercialPara}

    <div class="box">${sumsRows}</div>

    <p>Please pay the total above by <strong>${fmtDate(deadline)}</strong> (within ${responseDays} days of the date of this letter).</p>

    ${bank}
    ${portalLink}

    <p>If payment is not received by ${fmtDate(deadline)}, we may take steps to recover the debt.
    This can include making a claim through the courts using Money Claim Online
    (<a href="https://www.gov.uk/make-court-claim-for-money">gov.uk/make-court-claim-for-money</a>),
    which may add court fees${isCompany ? " and further interest" : ""} to the amount owed. We would
    prefer to resolve this without taking that step.</p>

    <p>If you have already paid, or there is a problem with this invoice, please contact us
    straight away so we can sort it out.</p>

    <p>Yours faithfully,<br>${esc(tradingName || "")}</p>

    ${consumerCaveat}

    <div class="caveat">
      This letter was generated by Trade PA to help you pursue an overdue invoice. It is a
      template, not legal advice. Please review it and amend anything that is not accurate
      before you send it.
    </div>`;

  res.status(200).send(htmlPage(`Letter before action for Invoice ${inv.id}`, inner));
}

export default withSentry(handler, { routeName: "invoices/letter-before-action" });
