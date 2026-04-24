// api/lib/resend.js
// Shared Resend client + transactional email templates for Trade PA.
// Called from webhook handlers and cron jobs. Fire-and-forget: errors logged, never thrown.
//
// Imported via: import { sendWelcome, sendTrialEnding, sendPaymentFailed, sendReminder } from "../lib/resend.js";

const RESEND_API = "https://api.resend.com/emails";

// ---- Configuration ---------------------------------------------------------
const APP_URL        = process.env.APP_URL || "https://tradespa.co.uk";
const BILLING_URL    = `${APP_URL}/settings/billing`;
const SUPPORT_EMAIL  = "support@tradespa.co.uk";
const BILLING_EMAIL  = "billing@tradespa.co.uk";
const HELLO_EMAIL    = "hello@tradespa.co.uk";
const PRIVACY_URL    = `${APP_URL}/privacy`;

// Companies Act 2006 s.82 — business emails/letters must show company name,
// registered number, place of registration. Rendered in the shared footer
// of every transactional email. Single source of truth: change here, it
// propagates to welcome / trial-ending / payment-failed / reminder / auth.
const COMPANY_LEGAL = "Trade PA Ltd · Registered in England &amp; Wales · Company No. 17176983";

const FROM_HELLO   = `Trade PA <${HELLO_EMAIL}>`;
const FROM_BILLING = `Trade PA Billing <${BILLING_EMAIL}>`;

// ---- Low-level send --------------------------------------------------------
async function sendEmail({ from, to, subject, html, text, replyTo }) {
  if (!process.env.RESEND_API_KEY) {
    console.error("[resend] RESEND_API_KEY not set — email skipped");
    return false;
  }
  if (!to) {
    console.error(`[resend] no recipient for "${subject}" — skipped`);
    return false;
  }
  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
        text,
        reply_to: replyTo,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "<no body>");
      console.error(`[resend] HTTP ${res.status} for "${subject}" to ${to}: ${errText}`);
      return false;
    }
    const data = await res.json().catch(() => ({}));
    console.log(`[resend] ✓ sent id=${data.id || "?"} to=${to} subject="${subject}"`);
    return true;
  } catch (err) {
    console.error(`[resend] send error for "${subject}" to ${to}:`, err.message);
    return false;
  }
}

// ---- Helpers ---------------------------------------------------------------
function formatCurrency(amountMinor, currency = "gbp") {
  const symbol = { gbp: "£", usd: "$", eur: "€" }[String(currency).toLowerCase()] || "£";
  return `${symbol}${(Number(amountMinor || 0) / 100).toFixed(2)}`;
}

function formatDate(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Like formatDate but uses Europe/London timezone — for reminder times
// where the user expects to see the time they set, not UTC.
function formatDateLocal(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/London",
  });
}

function formatTimeLocal(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London",
  });
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncate(s, max) {
  const str = String(s || "");
  return str.length <= max ? str : str.slice(0, max - 1).trimEnd() + "…";
}

// ---- Shared HTML layout ----------------------------------------------------
function layout({ title, preheader, content, footerNote }) {
  const preheaderText = escapeHtml(preheader || "");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#1d1d1f;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#f5f5f7;opacity:0;">${preheaderText}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f7;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="padding:32px 40px 12px;">
<div style="font-size:22px;font-weight:700;color:#0066ff;letter-spacing:-0.3px;">Trade PA</div>
</td></tr>
<tr><td style="padding:4px 40px 32px;font-size:16px;line-height:1.6;color:#1d1d1f;">
${content}
</td></tr>
<tr><td style="padding:20px 40px;background:#fafafa;border-top:1px solid #e5e5ea;font-size:13px;color:#86868b;line-height:1.6;">
${footerNote ? `<p style="margin:0 0 12px;">${footerNote}</p>` : ""}
<p style="margin:0 0 4px;">${COMPANY_LEGAL}</p>
<p style="margin:0;">
<a href="mailto:${SUPPORT_EMAIL}" style="color:#0066ff;text-decoration:none;">Support</a>
&nbsp;·&nbsp;
<a href="${PRIVACY_URL}" style="color:#0066ff;text-decoration:none;">Privacy</a>
&nbsp;·&nbsp;
<a href="${APP_URL}" style="color:#0066ff;text-decoration:none;">tradespa.co.uk</a>
</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function button(href, label) {
  return `<p style="margin:24px 0;text-align:center;">
<a href="${href}" style="display:inline-block;padding:12px 28px;background:#0066ff;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;">${escapeHtml(label)}</a>
</p>`;
}

// ---- Template: Welcome -----------------------------------------------------
export async function sendWelcome({ to, firstName, planName, trialEndsAt }) {
  const greetName = firstName ? `, ${escapeHtml(firstName)}` : "";
  const plan      = escapeHtml(planName || "Trade PA");
  const trialDate = formatDate(trialEndsAt);
  const subject   = "Welcome to Trade PA — your 30-day trial is live";
  const preheader = `Your ${plan} trial has started. No charge until ${trialDate}.`;

  const content = `
<h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#1d1d1f;">Welcome${greetName} 👋</h1>
<p style="margin:0 0 16px;">Your 30-day Trade PA trial is live. You won't be charged until <strong>${trialDate}</strong> — we'll send a reminder 3 days before.</p>
<p style="margin:0 0 12px;">You can start using your AI assistant straight away. A few things worth trying from the van:</p>
<ul style="margin:0 0 16px;padding-left:20px;">
<li style="margin:0 0 6px;">Create a job by voice — <em>"New job for 12 Oak Lane, roof leak"</em></li>
<li style="margin:0 0 6px;">Log a quote hands-free while on site</li>
<li style="margin:0 0 6px;">Connect Xero or Stripe to auto-sync invoicing</li>
</ul>
${button(APP_URL, "Open Trade PA")}
<p style="margin:0;color:#86868b;font-size:14px;">Any questions, just reply to this email — it lands straight in my inbox.</p>
`;

  const text = `Welcome${greetName}!

Your 30-day Trade PA trial is live. No charge until ${trialDate} — we'll remind you 3 days before.

Open the app: ${APP_URL}

Any questions, just reply to this email.

— Trade PA`;

  return sendEmail({
    from: FROM_HELLO,
    to,
    replyTo: HELLO_EMAIL,
    subject,
    html: layout({ title: subject, preheader, content }),
    text,
  });
}

// ---- Template: Trial Ending ------------------------------------------------
export async function sendTrialEnding({ to, firstName, trialEndsAt, planName, amount, currency, hasPaymentMethod }) {
  const name       = firstName ? escapeHtml(firstName) : "there";
  const plan       = escapeHtml(planName || "subscription");
  const trialDate  = formatDate(trialEndsAt);
  const amountStr  = amount ? formatCurrency(amount, currency) : null;
  const subject    = "Your Trade PA trial ends in 3 days";
  const preheader  = hasPaymentMethod
    ? `Trial ends ${trialDate}. You'll be charged ${amountStr || "as per your plan"}.`
    : `Trial ends ${trialDate}. Add a card to keep your account.`;

  let content;
  if (hasPaymentMethod) {
    content = `
<h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#1d1d1f;">Your trial ends on ${trialDate}</h1>
<p style="margin:0 0 16px;">Hi ${name}, just a heads-up that your 30-day free trial of Trade PA ends on <strong>${trialDate}</strong>.</p>
<p style="margin:0 0 16px;">Your ${plan} plan will continue automatically and we'll charge ${amountStr || "the plan amount"} to the card on file. No action needed.</p>
<p style="margin:0 0 16px;">Want to change plan or cancel before the trial ends? You can manage your subscription anytime.</p>
${button(BILLING_URL, "Manage subscription")}
<p style="margin:0;color:#86868b;font-size:14px;">Happy with Trade PA so far? Reply and let me know what you'd like to see next.</p>
`;
  } else {
    content = `
<h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#1d1d1f;">Your trial ends on ${trialDate}</h1>
<p style="margin:0 0 16px;">Hi ${name}, your 30-day free trial of Trade PA ends on <strong>${trialDate}</strong>.</p>
<p style="margin:0 0 16px;"><strong>Action needed:</strong> to keep your account active, please add a payment method before the trial ends. Otherwise your account will be cancelled automatically.</p>
${button(BILLING_URL, "Add payment method")}
<p style="margin:0;color:#86868b;font-size:14px;">Not sure if Trade PA is right for you? Reply and tell me what's missing — I read every reply.</p>
`;
  }

  const text = hasPaymentMethod
    ? `Your Trade PA trial ends on ${trialDate}.

Your ${plan} plan will continue automatically. We'll charge ${amountStr || "the plan amount"} to your card on file.

Manage your subscription: ${BILLING_URL}

— Trade PA`
    : `Your Trade PA trial ends on ${trialDate}.

Action needed: please add a payment method to keep your account active.

Add card: ${BILLING_URL}

— Trade PA`;

  return sendEmail({
    from: FROM_HELLO,
    to,
    replyTo: HELLO_EMAIL,
    subject,
    html: layout({ title: subject, preheader, content }),
    text,
  });
}

// ---- Template: Payment Failed ----------------------------------------------
export async function sendPaymentFailed({ to, firstName, amount, currency, nextRetryDate }) {
  const name       = firstName ? escapeHtml(firstName) : "there";
  const amountStr  = amount ? formatCurrency(amount, currency) : "your subscription";
  const retryLine  = nextRetryDate
    ? ` We'll automatically try again on <strong>${formatDate(nextRetryDate)}</strong>.`
    : "";
  const retryText  = nextRetryDate
    ? ` We'll automatically try again on ${formatDate(nextRetryDate)}.`
    : "";
  const subject    = "Payment failed — please update your card";
  const preheader  = `We couldn't process your ${amountStr} payment. Update your card to keep access.`;

  const content = `
<h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#1d1d1f;">Payment issue</h1>
<p style="margin:0 0 16px;">Hi ${name}, we tried to charge <strong>${amountStr}</strong> for your Trade PA subscription but the payment didn't go through. This usually happens because of an expired card, insufficient funds, or your bank's fraud protection.</p>
<p style="margin:0 0 16px;">No immediate action — your account is still active.${retryLine} To avoid any disruption, please update your payment method now.</p>
${button(BILLING_URL, "Update payment method")}
<p style="margin:0;color:#86868b;font-size:14px;">If you think this is an error, reply to this email and we'll investigate right away.</p>
`;

  const text = `Payment issue

We couldn't process your ${amountStr} Trade PA subscription payment.${retryText}

Your account is still active. Please update your card to avoid disruption:
${BILLING_URL}

Questions? Reply to this email.

— Trade PA Billing`;

  return sendEmail({
    from: FROM_BILLING,
    to,
    replyTo: BILLING_EMAIL,
    subject,
    html: layout({ title: subject, preheader, content }),
    text,
  });
}

// ---- Template: Reminder ----------------------------------------------------
// Sent by /api/cron/process-reminders.js when a user-set reminder is due.
// From: hello@tradespa.co.uk — personal tone.
// Action buttons: Mark Done, Snooze 1h, Open App (all magic links).
//
// Action URLs include reminder_id + user_id in query string. The action
// handler (/api/reminders/action.js) verifies both UUIDs match before acting.
// No HMAC needed — 2 x UUIDv4 = 2^256 entropy, practically unguessable.
//
// relatedContext (optional): { type, data } object from the cron's enrichment
// lookup. When present, renders a context block between the reminder text
// and the action buttons showing relevant details (invoice amount + status,
// job address, customer phone, etc). When null/undefined, email renders
// exactly as before — existing plain reminders unaffected.

// Format a currency value for display. Empty string if not a number.
function formatMoney(n) {
  const num = parseFloat(n);
  if (!isFinite(num)) return "";
  return "£" + num.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Render the status pill HTML for invoices — matches the in-app colour
// vocabulary loosely (green=paid, amber=sent/overdue, grey=draft).
function invoiceStatusPill(status) {
  const s = String(status || "").toLowerCase();
  let bg = "#e8e8ed", fg = "#1d1d1f", label = s || "—";
  if (s === "paid")         { bg = "#e8f8ee"; fg = "#1e7c3a"; label = "Paid"; }
  else if (s === "overdue") { bg = "#fdecec"; fg = "#b42318"; label = "Overdue"; }
  else if (s === "sent")    { bg = "#fff4e5"; fg = "#a86200"; label = "Sent"; }
  else if (s === "draft")   { bg = "#e8e8ed"; fg = "#545458"; label = "Draft"; }
  else if (s === "accepted"){ bg = "#e8f8ee"; fg = "#1e7c3a"; label = "Accepted"; }
  return `<span style="display:inline-block;padding:2px 8px;border-radius:10px;background:${bg};color:${fg};font-size:12px;font-weight:600;">${escapeHtml(label)}</span>`;
}

// Render the context block shown in enriched reminder emails. Keep it tight
// — a few key fields per type, nothing more. If a field is missing it's
// just omitted; layout survives.
function renderRelatedContext(ctx) {
  if (!ctx || !ctx.data) return "";
  const d = ctx.data;
  let heading = "", rows = [];
  if (ctx.type === "invoice") {
    heading = d.is_quote ? "📄 Quote" : "💷 Invoice";
    const amount = d.gross_amount ?? d.amount;
    rows.push(["Customer", escapeHtml(d.customer || "—")]);
    if (amount != null && formatMoney(amount)) rows.push(["Amount", formatMoney(amount)]);
    if (d.status) rows.push(["Status", invoiceStatusPill(d.status)]);
    if (d.due) rows.push(["Due", escapeHtml(d.due)]);
  } else if (ctx.type === "job") {
    heading = "🔨 Job";
    rows.push(["Customer", escapeHtml(d.customer || "—")]);
    if (d.title || d.type) rows.push(["Job", escapeHtml(d.title || d.type)]);
    if (d.address) rows.push(["Address", escapeHtml(d.address)]);
    if (d.value) rows.push(["Value", formatMoney(d.value)]);
    if (d.status) rows.push(["Status", escapeHtml(String(d.status).replace(/_/g, " "))]);
  } else if (ctx.type === "customer") {
    heading = "👤 Customer";
    rows.push(["Name", escapeHtml(d.name || "—")]);
    if (d.phone) rows.push(["Phone", escapeHtml(d.phone)]);
    if (d.email) rows.push(["Email", escapeHtml(d.email)]);
    if (d.address) rows.push(["Address", escapeHtml(d.address)]);
  } else if (ctx.type === "enquiry") {
    heading = d.urgent ? "📩 Enquiry (urgent)" : "📩 Enquiry";
    rows.push(["From", escapeHtml(d.name || "—")]);
    if (d.source) rows.push(["Source", escapeHtml(d.source)]);
    if (d.msg) rows.push(["Message", escapeHtml(truncate(d.msg, 160))]);
    if (d.status) rows.push(["Status", escapeHtml(d.status)]);
  } else {
    return "";
  }
  const rowHtml = rows.map(([k, v]) => `
    <tr>
      <td style="padding:4px 12px 4px 0;color:#86868b;font-size:13px;vertical-align:top;width:80px;">${escapeHtml(k)}</td>
      <td style="padding:4px 0;color:#1d1d1f;font-size:14px;">${v}</td>
    </tr>`).join("");
  return `
<div style="padding:16px 20px;background:#ffffff;border:1px solid #e5e5ea;border-radius:12px;margin:0 0 20px;">
  <p style="margin:0 0 12px;font-size:13px;color:#86868b;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">${heading}</p>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">${rowHtml}</table>
</div>`;
}

// Plain-text version of the context block for email clients that show text.
function renderRelatedContextText(ctx) {
  if (!ctx || !ctx.data) return "";
  const d = ctx.data;
  const lines = [];
  if (ctx.type === "invoice") {
    const amount = d.gross_amount ?? d.amount;
    lines.push(d.is_quote ? "Quote" : "Invoice");
    if (d.customer) lines.push(`  Customer: ${d.customer}`);
    if (amount != null && formatMoney(amount)) lines.push(`  Amount:   ${formatMoney(amount)}`);
    if (d.status) lines.push(`  Status:   ${d.status}`);
    if (d.due) lines.push(`  Due:      ${d.due}`);
  } else if (ctx.type === "job") {
    lines.push("Job");
    if (d.customer) lines.push(`  Customer: ${d.customer}`);
    if (d.title || d.type) lines.push(`  Job:      ${d.title || d.type}`);
    if (d.address) lines.push(`  Address:  ${d.address}`);
    if (d.value) lines.push(`  Value:    ${formatMoney(d.value)}`);
    if (d.status) lines.push(`  Status:   ${String(d.status).replace(/_/g, " ")}`);
  } else if (ctx.type === "customer") {
    lines.push("Customer");
    if (d.name) lines.push(`  Name:     ${d.name}`);
    if (d.phone) lines.push(`  Phone:    ${d.phone}`);
    if (d.email) lines.push(`  Email:    ${d.email}`);
    if (d.address) lines.push(`  Address:  ${d.address}`);
  } else if (ctx.type === "enquiry") {
    lines.push(d.urgent ? "Enquiry (urgent)" : "Enquiry");
    if (d.name) lines.push(`  From:     ${d.name}`);
    if (d.source) lines.push(`  Source:   ${d.source}`);
    if (d.msg) lines.push(`  Message:  ${truncate(d.msg, 160)}`);
    if (d.status) lines.push(`  Status:   ${d.status}`);
  }
  return lines.length ? "\n" + lines.join("\n") + "\n" : "";
}

export async function sendReminder({ to, reminderId, userId, text: reminderText, fireAt, createdAt, relatedContext }) {
  const safeText    = String(reminderText || "").trim() || "Reminder";
  const subject     = `Reminder: ${truncate(safeText, 60)}`;
  const fireDateStr = formatDateLocal(fireAt);
  const fireTimeStr = formatTimeLocal(fireAt);
  const createdStr  = formatDateLocal(createdAt);

  const actionBase = `${APP_URL}/api/reminders/action?r=${encodeURIComponent(reminderId)}&u=${encodeURIComponent(userId)}`;
  const doneUrl    = `${actionBase}&a=done`;
  const snoozeUrl  = `${actionBase}&a=snooze`;

  const preheader = `${safeText} — ${fireDateStr} at ${fireTimeStr}`;

  const contextHtml = renderRelatedContext(relatedContext);
  const contextText = renderRelatedContextText(relatedContext);

  const content = `
<h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#1d1d1f;">⏰ Reminder</h1>
<div style="padding:20px;background:#f5f5f7;border-radius:12px;margin:0 0 20px;">
  <p style="margin:0 0 8px;font-size:17px;color:#1d1d1f;line-height:1.5;">${escapeHtml(safeText)}</p>
  <p style="margin:0;font-size:14px;color:#86868b;">Due <strong>${escapeHtml(fireDateStr)}</strong> at <strong>${escapeHtml(fireTimeStr)}</strong></p>
</div>
${contextHtml}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px;">
<tr>
  <td style="padding:0 3px 0 0;" width="33%">
    <a href="${doneUrl}" style="display:block;padding:12px 8px;background:#34c759;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;text-align:center;">✓ Mark Done</a>
  </td>
  <td style="padding:0 3px;" width="33%">
    <a href="${snoozeUrl}" style="display:block;padding:12px 8px;background:#ff9500;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;text-align:center;">Snooze 1h</a>
  </td>
  <td style="padding:0 0 0 3px;" width="33%">
    <a href="${APP_URL}" style="display:block;padding:12px 8px;background:#0066ff;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;text-align:center;">Open App</a>
  </td>
</tr>
</table>
<p style="margin:0;color:#86868b;font-size:13px;">Reminder set on ${escapeHtml(createdStr)}</p>
`;

  const text = `⏰ Reminder: ${safeText}

Due ${fireDateStr} at ${fireTimeStr}
${contextText}
Mark done:     ${doneUrl}
Snooze 1 hour: ${snoozeUrl}
Open app:      ${APP_URL}

— Trade PA`;

  return sendEmail({
    from: FROM_HELLO,
    to,
    replyTo: HELLO_EMAIL,
    subject,
    html: layout({ title: subject, preheader, content }),
    text,
  });
}
