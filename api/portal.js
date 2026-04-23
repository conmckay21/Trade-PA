// api/portal.js
// Customer-facing portal for Trade PA quotes.
//
// URL patterns (all via vercel.json rewrites):
//   /quote/<token>         → /api/portal?action=view&token=<token>     [GET HTML]
//   /api/portal/accept     → /api/portal?action=accept                 [POST form]
//   /api/portal/decline    → /api/portal?action=decline                [POST form]
//
// Also accessible directly at /api/portal?action=<view|accept|decline>&token=<token>.
//
// Auth: token-only (no session). The portal_token is a per-quote random string
// stored in invoices.portal_token. Anyone with the link can view the quote —
// same trust model as a PDF attachment in an email. Accept/Decline are
// idempotent state changes protected by the token itself.
//
// ⚠ Zero-dependency implementation: native fetch() against Supabase REST API.
// Matches the pattern of api/tts.js and api/calendar.js.
//
// Required env vars on Vercel:
//   VITE_SUPABASE_URL (or SUPABASE_URL)                       — project URL
//   SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)       — service key
//                                                               ⚠ Server-only.

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;

const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

// ─── Response helpers ───────────────────────────────────────────────────────
function sendHTML(res, status, body) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).send(body);
}

function sendText(res, status, body) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.status(status).send(body);
}

async function supabaseRequest(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      Prefer: method === "PATCH" || method === "POST" ? "return=representation" : "",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Supabase ${res.status}: ${errText.slice(0, 200)}`);
  }
  if (method === "GET") return res.json();
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ─── Portal view tracking ───────────────────────────────────────────────────
//
// When a customer opens a portal link, we:
//   1. Record a 'portal_view' event in usage_events (for analytics)
//   2. Send a push notification to the tradesperson — UNLESS the viewer
//      is the tradesperson themselves
//
// Self-view suppression: the app sets a cookie 'tp_owner=<user_id>' on
// every device the tradesperson has logged into. When a portal request
// arrives with that cookie, and the cookie value matches the invoice's
// user_id, we know this is the tradesperson previewing their own link
// and skip the push. The event is still recorded.
//
// No dedupe by design — tradies want to see every time a customer opens
// the link, including repeat views ("they looked 4 times today, they're
// serious"). That's a feature, not noise.
async function trackPortalView(req, inv) {
  const isQuote = inv.is_quote === true;
  const docType = isQuote ? "quote" : "invoice";

  // Self-view check: parse the tp_owner cookie from the request headers.
  // If it matches the invoice's user_id, this is the tradesperson viewing
  // their own link — skip the push.
  const isSelfView = (() => {
    try {
      const cookieHeader = req.headers?.cookie || "";
      const match = cookieHeader.match(/(?:^|;\s*)tp_owner=([^;]+)/);
      if (!match) return false;
      const ownerFromCookie = decodeURIComponent(match[1]);
      return ownerFromCookie === inv.user_id;
    } catch {
      return false;
    }
  })();

  // Always record the event (analytics needs it regardless of who viewed).
  // Metadata is deliberately kept small — no PII beyond doc id and type.
  // We flag self-views in metadata so the Admin dashboard can filter them
  // out when showing "real customer views".
  try {
    await supabaseRequest("POST", "usage_events", {
      user_id: inv.user_id,
      event_type: "portal_view",
      event_name: `${docType}_viewed`,
      metadata: {
        doc_id: inv.id,
        doc_type: docType,
        amount: inv.amount || null,
        customer: inv.customer || null,
        self_view: isSelfView,
      },
    });
  } catch (e) {
    // Tracking failure must never block the portal render.
    console.error("[portal] trackPortalView insert failed:", e.message);
  }

  // Push the tradesperson — every view, but never their own.
  if (!isSelfView) {
    try {
      await notifyTradesperson(inv, docType);
    } catch (e) {
      console.error("[portal] notifyTradesperson failed:", e.message);
    }
  }
}

// Fire a push notification via /api/push/send. The endpoint is internal so
// we call it server-to-server. Using absolute URL via VERCEL_URL or
// PORTAL_SELF_URL so this works in both production and preview deployments.
//
// Also writes a row to in_app_notifications so the bell icon in the app
// shows the notification even if push is muted/blocked. The two channels
// are independent — failure in one shouldn't block the other.
async function notifyTradesperson(inv, docType) {
  const baseUrl =
    process.env.PORTAL_SELF_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "https://www.tradespa.co.uk";

  const amountText = inv.amount
    ? ` for £${Number(inv.amount).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "";
  const customer = inv.customer || "A customer";
  const title = docType === "quote" ? "👀 Quote viewed" : "👀 Invoice viewed";
  const body = `${customer} opened your ${docType}${amountText}.`;
  const deepUrl = docType === "quote" ? "/Quotes" : "/Invoices";

  // In-app notification feed (bell icon). Non-blocking; push still fires
  // even if this fails.
  try {
    await supabaseRequest("POST", "in_app_notifications", {
      user_id: inv.user_id,
      type: "portal_view",
      title,
      body,
      url: deepUrl,
      metadata: {
        doc_id: inv.id,
        doc_type: docType,
        amount: inv.amount || null,
      },
    });
  } catch (e) {
    console.error("[portal] in_app_notifications insert failed:", e.message);
  }

  // Push notification.
  await fetch(`${baseUrl}/api/push/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: inv.user_id,
      title,
      body,
      url: "/",
      type: "portal_view",
      tag: `portal-view-${inv.id}`,
    }),
  });
}

// ─── HTML escaping ──────────────────────────────────────────────────────────
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const fmtGBP = (n) => `£${(parseFloat(n) || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => {
  try { return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return ""; }
};

// ─── Line item normalisation ────────────────────────────────────────────────
// Mirror of the in-app LineItemsDisplay logic. Handles three shapes the DB
// row may present:
//   1. line_items JSON array with {description, amount} or {desc, amount}
//   2. Legacy quotes storing items in the `description` field with "|" separator
//      (format: "Supply boiler|450\nInstall boiler|350")
//   3. Single-line quote with line_items=[{description, amount:0}] but the real
//      total in top-level inv.amount/gross_amount (happens when quote was
//      created with only a total, not itemised)
//
// Returns array of {description, amount?} where amount is null if unknown.
function parseLineItems(inv) {
  let items = [];

  // Try structured line_items first
  try {
    if (typeof inv.line_items === "string") items = JSON.parse(inv.line_items);
    else if (Array.isArray(inv.line_items)) items = inv.line_items;
  } catch { items = []; }

  items = (items || []).map(l => ({
    description: l.description || l.desc || "",
    amount: l.amount != null && l.amount !== "" && !isNaN(parseFloat(l.amount)) ? parseFloat(l.amount) : null,
  })).filter(l => l.description);

  // Fallback: parse the description field with pipe separator
  if (items.length === 0 && inv.description) {
    items = String(inv.description).split(/\n|;\s*/).map(s => {
      const pipeIdx = s.lastIndexOf("|");
      if (pipeIdx > 0) {
        const amt = parseFloat(s.slice(pipeIdx + 1));
        return { description: s.slice(0, pipeIdx).trim(), amount: isNaN(amt) ? null : amt };
      }
      return { description: s.trim(), amount: null };
    }).filter(i => i.description);
  }

  // Edge case: single itemised line with zero/null amount but a real total exists.
  // Push the top-level total onto the line item so it displays meaningfully
  // rather than showing a misleading £0.00.
  if (items.length === 1 && (items[0].amount == null || items[0].amount === 0)) {
    const total = parseFloat(inv.gross_amount || inv.amount);
    if (total > 0) items[0].amount = total;
  }

  return items;
}

// ─── Shared page chrome ─────────────────────────────────────────────────────
function pageShell({ brand, title, bodyHTML }) {
  const accent = brand?.accentColor || "#f59e0b";
  const tradingName = esc(brand?.tradingName || "Trade PA");
  const logo = brand?.logo ? `<img src="${esc(brand.logo)}" alt="${tradingName}" style="max-height:50px;max-width:160px;object-fit:contain;display:block;"/>` : `<div style="font-size:22px;font-weight:700;color:#fff;">${tradingName}</div>`;

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  html,body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#1a1a1a;background:#f5f5f5;line-height:1.5;}
  .wrap{max-width:640px;margin:0 auto;padding:0;background:#fff;min-height:100vh;}
  .hdr{background:${accent};padding:28px 24px;color:#fff;}
  .ctx{padding:28px 24px;}
  h1{font-size:22px;font-weight:700;margin-bottom:8px;letter-spacing:-0.01em;}
  h2{font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#777;margin:24px 0 10px;}
  .label{font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;}
  .val{font-size:14px;color:#1a1a1a;}
  .panel{background:#fafafa;border:1px solid #eee;border-radius:10px;padding:16px 18px;margin-bottom:14px;}
  .panel h2{margin-top:0;}
  .total-big{font-size:36px;font-weight:700;color:${accent};font-family:"SF Mono",Menlo,Consolas,monospace;letter-spacing:-0.02em;}
  table{width:100%;border-collapse:collapse;font-size:13px;}
  th{text-align:left;font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em;padding:8px 0;border-bottom:1px solid #eee;font-weight:600;}
  th:last-child,td:last-child{text-align:right;}
  td{padding:10px 0;border-bottom:1px solid #f3f3f3;vertical-align:top;}
  tr:last-child td{border-bottom:0;}
  .cta-group{display:flex;gap:10px;margin:28px 0 8px;}
  .cta{flex:1;padding:16px 14px;border-radius:10px;border:0;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;letter-spacing:0.02em;}
  .cta.primary{background:${accent};color:#fff;}
  .cta.primary:hover{opacity:0.9;}
  .cta.ghost{background:transparent;color:#666;border:1.5px solid #ddd;}
  .cta.ghost:hover{background:#f5f5f5;}
  .banner{padding:12px 16px;border-radius:10px;margin-bottom:20px;font-size:13px;}
  .banner.error{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;}
  .banner.ok{background:#f0fdf4;border:1px solid #86efac;color:#166534;}
  .banner.info{background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;}
  .bank{font-family:"SF Mono",Menlo,Consolas,monospace;font-size:13px;}
  .bank-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed #eee;}
  .bank-row:last-child{border-bottom:0;}
  .bank-row span:first-child{color:#777;}
  .foot{padding:24px;text-align:center;font-size:11px;color:#999;border-top:1px solid #eee;margin-top:20px;}
  .foot a{color:${accent};text-decoration:none;}
  @media (max-width:540px){
    .cta-group{flex-direction:column;}
    .total-big{font-size:30px;}
  }
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr">${logo}</div>
  <div class="ctx">
    ${bodyHTML}
  </div>
  <div class="foot">
    Delivered securely via <a href="https://www.tradespa.co.uk" target="_blank" rel="noopener">Trade PA</a>
  </div>
</div>
</body>
</html>`;
}

function errorPage(brand, heading, detail) {
  const body = `
    <h1>${esc(heading)}</h1>
    <div class="banner error">${esc(detail)}</div>
    <p style="color:#666;margin-top:18px;font-size:13px;">If you believe this is a mistake, please contact the tradesperson who sent you this link.</p>
  `;
  return pageShell({ brand, title: heading, bodyHTML: body });
}

// ─── View quote ─────────────────────────────────────────────────────────────
async function renderQuoteView(req, token, paidParam = null) {
  const invoices = await supabaseRequest("GET", `invoices?portal_token=eq.${encodeURIComponent(token)}&select=*&limit=1`);
  if (!Array.isArray(invoices) || invoices.length === 0) {
    return { status: 404, html: errorPage(null, "Not found", "This link is invalid or has been revoked.") };
  }
  const inv = invoices[0];

  // Fire-and-forget view tracking. Deliberately not awaited — the customer's
  // page load must never depend on the tracking or notification pipeline.
  // Any failures are logged server-side via console.error inside trackPortalView.
  trackPortalView(req, inv).catch(err => console.error("[portal] trackPortalView:", err.message));

  const settingsRows = await supabaseRequest("GET", `user_settings?user_id=eq.${encodeURIComponent(inv.user_id)}&select=brand_data&limit=1`);
  const brand = settingsRows?.[0]?.brand_data || {};

  const isQuote = inv.is_quote === true;

  const validityDays = parseInt(brand.quoteValidity || "30", 10) || 30;
  const refDate = new Date(inv.updated_at || inv.created_at || Date.now());
  const expiresAt = new Date(refDate.getTime() + validityDays * 86400000);
  const daysLeft = Math.ceil((expiresAt - Date.now()) / 86400000);
  const isExpired = isQuote && daysLeft < 0;

  const alreadyResponded = inv.status === "accepted" || inv.status === "declined";

  const lineItems = parseLineItems(inv);

  // Banner
  let banner = "";
  // Stripe just-redirected-back banners take precedence over the standard
  // already-responded banner. The actual paid status arrives via webhook so
  // could lag a few seconds — we show a transitional message.
  if (paidParam === "1") {
    banner = inv.status === "paid"
      ? `<div class="banner ok">Payment received &mdash; thank you. The tradesperson has been notified.</div>`
      : `<div class="banner ok">Payment processing &mdash; thank you. You'll receive a Stripe receipt by email shortly. The tradesperson will be notified once Stripe confirms.</div>`;
  } else if (paidParam === "cancelled") {
    banner = `<div class="banner info">Payment cancelled &mdash; no charge was made. You can try again or pay by bank transfer.</div>`;
  } else if (alreadyResponded) {
    const label = inv.status === "accepted" ? "accepted" : "declined";
    banner = `<div class="banner ${inv.status === "accepted" ? "ok" : "info"}">You ${label} this quote on ${fmtDate(inv.portal_responded_at || inv.updated_at)}. The tradesperson has been notified.</div>`;
  } else if (isExpired) {
    banner = `<div class="banner error">This quote expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"} ago. Please contact the tradesperson to request a new one.</div>`;
  } else if (isQuote && daysLeft <= 3) {
    banner = `<div class="banner info">This quote expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.</div>`;
  }

  // Line items table — hide the Amount column entirely if no item has a
  // known amount (cleaner than showing a column of blanks or £0.00).
  const anyAmounts = lineItems.some(li => li.amount != null);
  const itemsHTML = lineItems.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>Description</th>
          ${anyAmounts ? "<th>Amount</th>" : ""}
        </tr>
      </thead>
      <tbody>
        ${lineItems.map(li => `
          <tr>
            <td>${esc(li.description)}</td>
            ${anyAmounts ? `<td>${li.amount != null ? fmtGBP(li.amount) : ""}</td>` : ""}
          </tr>
        `).join("")}
      </tbody>
    </table>
  ` : "";

  // Stripe Pay Now CTA — shown when the tradesperson has connected Stripe AND
  // the doc is an INVOICE (never on quotes — customer shouldn't be able to
  // pay before accepting the quote; that's the job of the invoice stage)
  // AND the invoice isn't already paid. Posts to /api/stripe/connect-checkout
  // which creates a Checkout session and 303-redirects to Stripe's hosted
  // payment page. On success Stripe sends the customer back to ?paid=1.
  const stripeReady = !isQuote && brand.stripeAccountId && inv.status !== "paid" && !isExpired;
  const stripeHTML = stripeReady ? `
    <div class="panel" style="text-align:center;padding:18px;">
      <h2 style="margin-top:0;">Pay by card</h2>
      <p style="font-size:12px;color:#666;margin-bottom:14px;">Secure payment via Stripe &middot; receipt emailed automatically</p>
      <form method="POST" action="/api/stripe/connect-checkout" style="margin:0;">
        <input type="hidden" name="token" value="${esc(token)}"/>
        <button type="submit" class="cta primary" style="width:100%;max-width:280px;">Pay ${fmtGBP(inv.gross_amount || inv.amount)} now</button>
      </form>
    </div>
  ` : "";

  // Bank transfer details — shown on INVOICES only. Quotes intentionally
  // don't show payment actions (Stripe or bank) because the customer hasn't
  // accepted yet. A single "Payment terms" info block replaces it on quotes
  // so customers still know what they're signing up for.
  const bankHTML = (!isQuote && (brand.bankName || brand.accountNumber)) ? `
    <div class="panel">
      <h2>${stripeReady ? "Or pay by bank transfer" : "Pay by bank transfer"}</h2>
      <div class="bank">
        ${brand.accountName ? `<div class="bank-row"><span>Account name</span><span>${esc(brand.accountName)}</span></div>` : ""}
        ${brand.bankName ? `<div class="bank-row"><span>Bank</span><span>${esc(brand.bankName)}</span></div>` : ""}
        ${brand.sortCode ? `<div class="bank-row"><span>Sort code</span><span>${esc(brand.sortCode)}</span></div>` : ""}
        ${brand.accountNumber ? `<div class="bank-row"><span>Account number</span><span>${esc(brand.accountNumber)}</span></div>` : ""}
        <div class="bank-row"><span>Reference</span><span>${esc(inv.id)}</span></div>
      </div>
    </div>
  ` : "";

  // Payment terms — informational only, on QUOTES only. Tells the customer
  // what to expect if they accept, without giving them a way to pay now.
  // Wording adapts to what the tradesperson has set up: card + bank,
  // card only, bank only, or neither.
  const paymentTermsDays = parseInt(brand.paymentTerms || "30", 10) || 30;
  const hasCard = !!brand.stripeAccountId;
  const hasBank = !!(brand.bankName || brand.accountNumber);
  let paymentMethodsText = "";
  if (hasCard && hasBank) paymentMethodsText = "You'll be able to pay by card or bank transfer.";
  else if (hasCard) paymentMethodsText = "You'll be able to pay by card online.";
  else if (hasBank) paymentMethodsText = "Payment will be by bank transfer.";
  else paymentMethodsText = "The tradesperson will share payment details with the invoice.";
  const paymentTermsHTML = (isQuote && !isExpired && !alreadyResponded) ? `
    <div class="panel" style="background:#fafafa;">
      <h2>Payment terms</h2>
      <p style="margin:0;color:#555;font-size:14px;line-height:1.5;">
        If you accept this quote, an invoice will be issued with payment due in ${paymentTermsDays} days.
        ${paymentMethodsText}
      </p>
    </div>
  ` : "";

  // Accept / Decline — simpler reassurance copy that doesn't repeat the
  // tradingName (already shown in the header).
  const actionsHTML = (isQuote && !isExpired && !alreadyResponded) ? `
    <div class="cta-group">
      <form method="POST" action="/api/portal?action=accept" style="flex:1;margin:0;">
        <input type="hidden" name="token" value="${esc(token)}"/>
        <button type="submit" class="cta primary">✓ Accept Quote</button>
      </form>
      <form method="POST" action="/api/portal?action=decline" style="flex:1;margin:0;">
        <input type="hidden" name="token" value="${esc(token)}"/>
        <button type="submit" class="cta ghost">Decline</button>
      </form>
    </div>
    <p style="font-size:11px;color:#999;text-align:center;margin-top:8px;">Tapping Accept confirms you'd like to proceed — the tradesperson will be notified immediately.</p>
  ` : "";

  const body = `
    ${banner}

    <div class="label">${isQuote ? "Quote" : "Invoice"}</div>
    <h1>${esc(inv.id)}</h1>
    <p style="color:#666;font-size:13px;margin-top:4px;">${isQuote ? `Valid until ${fmtDate(expiresAt)}` : `Issued ${fmtDate(inv.created_at)}`}</p>

    <div class="panel" style="text-align:center;padding:24px;margin-top:20px;">
      <div class="label">Total${inv.vatEnabled ? " (inc. VAT)" : ""}</div>
      <div class="total-big">${fmtGBP(inv.gross_amount || inv.amount)}</div>
    </div>

    <div class="panel">
      <h2>Customer</h2>
      <div class="val"><strong>${esc(inv.customer)}</strong></div>
      ${inv.address ? `<div class="val" style="color:#666;margin-top:4px;">${esc(inv.address)}</div>` : ""}
    </div>

    ${itemsHTML ? `<div class="panel"><h2>${isQuote ? "Proposed work" : "Items"}</h2>${itemsHTML}</div>` : ""}

    ${stripeHTML}

    ${bankHTML}

    ${paymentTermsHTML}

    ${actionsHTML}
  `;

  return {
    status: 200,
    html: pageShell({
      brand,
      title: `${isQuote ? "Quote" : "Invoice"} ${inv.id} — ${brand.tradingName || "Trade PA"}`,
      bodyHTML: body,
    }),
  };
}

// ─── Parse x-www-form-urlencoded body ────────────────────────────────────────
async function readFormBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => {
      const params = {};
      data.split("&").forEach((pair) => {
        const [k, v] = pair.split("=");
        if (k) params[decodeURIComponent(k)] = decodeURIComponent((v || "").replace(/\+/g, " "));
      });
      resolve(params);
    });
    req.on("error", () => resolve({}));
  });
}

// ─── Accept / decline handlers ──────────────────────────────────────────────
async function handleResponse(req, res, action) {
  let token = req.query.token || "";
  if (!token && req.method === "POST") {
    const form = await readFormBody(req);
    token = form.token || "";
  }
  if (!/^[a-z0-9]{20,64}$/i.test(token)) {
    return sendHTML(res, 404, errorPage(null, "Not found", "This link is invalid or has expired."));
  }

  const invoices = await supabaseRequest("GET", `invoices?portal_token=eq.${encodeURIComponent(token)}&select=*&limit=1`);
  if (!Array.isArray(invoices) || invoices.length === 0) {
    return sendHTML(res, 404, errorPage(null, "Not found", "This link is invalid or has been revoked."));
  }
  const inv = invoices[0];

  const settingsRows = await supabaseRequest("GET", `user_settings?user_id=eq.${encodeURIComponent(inv.user_id)}&select=brand_data&limit=1`);
  const brand = settingsRows?.[0]?.brand_data || {};

  if (!inv.is_quote) return sendHTML(res, 400, errorPage(brand, "Not a quote", "This link is for an invoice, not a quote — nothing to accept or decline."));

  const validityDays = parseInt(brand.quoteValidity || "30", 10) || 30;
  const refDate = new Date(inv.updated_at || inv.created_at || Date.now());
  const expiresAt = new Date(refDate.getTime() + validityDays * 86400000);
  if (Date.now() > expiresAt.getTime()) {
    return sendHTML(res, 410, errorPage(brand, "Expired", "This quote has expired. Please contact the tradesperson for an updated quote."));
  }

  if (inv.status === "accepted" || inv.status === "declined") {
    const view = await renderQuoteView(req, token);
    return sendHTML(res, view.status, view.html);
  }

  const newStatus = action === "accept" ? "accepted" : "declined";
  const nowISO = new Date().toISOString();
  await supabaseRequest("PATCH", `invoices?id=eq.${encodeURIComponent(inv.id)}&user_id=eq.${encodeURIComponent(inv.user_id)}`, {
    status: newStatus,
    portal_responded_at: nowISO,
    updated_at: nowISO,
  });

  try {
    const title = action === "accept" ? "Quote accepted ✓" : "Quote declined";
    const bodyMsg = action === "accept"
      ? `${inv.customer} accepted ${inv.id} — ${fmtGBP(inv.gross_amount || inv.amount)}`
      : `${inv.customer} declined ${inv.id}`;
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const proto = req.headers["x-forwarded-proto"] || "https";
    await fetch(`${proto}://${host}/api/push/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: inv.user_id, title, body: bodyMsg, tag: `portal-${inv.id}` }),
    }).catch(() => {});
  } catch (e) {
    console.error("[portal] push notify failed:", e.message);
  }

  const view = await renderQuoteView(req, token);
  return sendHTML(res, view.status, view.html);
}

// ─── Handler ────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return sendText(res, 500, "Portal service unavailable: env vars missing.");
  }

  const action = (req.query.action || "view").toLowerCase();

  try {
    if (action === "view") {
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.setHeader("Allow", "GET, HEAD");
        return res.status(405).end();
      }
      const token = req.query.token || "";
      if (!/^[a-z0-9]{20,64}$/i.test(token)) {
        return sendHTML(res, 404, errorPage(null, "Not found", "This link is invalid or has expired."));
      }
      // Read the optional paid= param so we can show the appropriate banner
      // when the customer is redirected back from Stripe Checkout. Values:
      //   "1"         → payment completed (banner depends on whether webhook
      //                 has fired yet — paid status will lag a few seconds)
      //   "cancelled" → customer cancelled out of Stripe Checkout
      const paidParam = req.query.paid || null;
      const { status, html } = await renderQuoteView(req, token, paidParam);
      return sendHTML(res, status, html);
    }

    if (action === "accept" || action === "decline") {
      if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).end();
      }
      return await handleResponse(req, res, action);
    }

    return sendText(res, 400, "Unknown action.");
  } catch (err) {
    console.error("[portal] error:", err.message);
    return sendHTML(res, 500, errorPage(null, "Something went wrong", `We couldn't load this page right now. Please try again in a moment. (${err.message.slice(0, 120)})`));
  }
}
