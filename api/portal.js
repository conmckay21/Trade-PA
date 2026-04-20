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

// ─── HTML escaping ──────────────────────────────────────────────────────────
// Every piece of user content must pass through this before going into the
// template. Customer names, line item descriptions, business names all come
// from arbitrary user input.
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

// ─── Shared page chrome ─────────────────────────────────────────────────────
// All portal pages share this shell — branded header, content slot, footer.
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

// ─── Error page ─────────────────────────────────────────────────────────────
function errorPage(brand, heading, detail) {
  const body = `
    <h1>${esc(heading)}</h1>
    <div class="banner error">${esc(detail)}</div>
    <p style="color:#666;margin-top:18px;font-size:13px;">If you believe this is a mistake, please contact the tradesperson who sent you this link.</p>
  `;
  return pageShell({ brand, title: heading, bodyHTML: body });
}

// ─── View quote ─────────────────────────────────────────────────────────────
async function renderQuoteView(token) {
  // Fetch the invoice + the brand (user_settings row)
  const invoices = await supabaseRequest("GET", `invoices?portal_token=eq.${encodeURIComponent(token)}&select=*&limit=1`);
  if (!Array.isArray(invoices) || invoices.length === 0) {
    return { status: 404, html: errorPage(null, "Not found", "This link is invalid or has been revoked.") };
  }
  const inv = invoices[0];

  const settingsRows = await supabaseRequest("GET", `user_settings?user_id=eq.${encodeURIComponent(inv.user_id)}&select=brand_data&limit=1`);
  const brand = settingsRows?.[0]?.brand_data || {};

  const isQuote = inv.is_quote === true;

  // Expiry — quote expires after brand.quoteValidity days from updated_at/created_at
  const validityDays = parseInt(brand.quoteValidity || "30", 10) || 30;
  const refDate = new Date(inv.updated_at || inv.created_at || Date.now());
  const expiresAt = new Date(refDate.getTime() + validityDays * 86400000);
  const daysLeft = Math.ceil((expiresAt - Date.now()) / 86400000);
  const isExpired = isQuote && daysLeft < 0;

  const alreadyResponded = inv.status === "accepted" || inv.status === "declined";

  // Parse line items
  let lineItems = [];
  try {
    if (typeof inv.line_items === "string") lineItems = JSON.parse(inv.line_items);
    else if (Array.isArray(inv.line_items)) lineItems = inv.line_items;
  } catch { lineItems = []; }

  // Build banner
  let banner = "";
  if (alreadyResponded) {
    const label = inv.status === "accepted" ? "accepted" : "declined";
    banner = `<div class="banner ${inv.status === "accepted" ? "ok" : "info"}">You ${label} this quote on ${fmtDate(inv.portal_responded_at || inv.updated_at)}. The tradesperson has been notified.</div>`;
  } else if (isExpired) {
    banner = `<div class="banner error">This quote expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"} ago. Please contact the tradesperson to request a new one.</div>`;
  } else if (isQuote && daysLeft <= 3) {
    banner = `<div class="banner info">This quote expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.</div>`;
  }

  // Line items
  const itemsHTML = lineItems.length > 0 ? `
    <table>
      <thead>
        <tr><th>Description</th><th>Amount</th></tr>
      </thead>
      <tbody>
        ${lineItems.map(li => `<tr><td>${esc(li.description || li.desc || "")}</td><td>${fmtGBP(li.amount || 0)}</td></tr>`).join("")}
      </tbody>
    </table>
  ` : inv.description ? `<p style="font-size:13px;white-space:pre-line;">${esc(inv.description)}</p>` : "";

  // Bank details panel (if brand has them) — no Stripe in v1, always show bank transfer
  const bankHTML = (brand.bankName || brand.accountNumber) ? `
    <div class="panel">
      <h2>Pay by bank transfer</h2>
      <div class="bank">
        ${brand.accountName ? `<div class="bank-row"><span>Account name</span><span>${esc(brand.accountName)}</span></div>` : ""}
        ${brand.bankName ? `<div class="bank-row"><span>Bank</span><span>${esc(brand.bankName)}</span></div>` : ""}
        ${brand.sortCode ? `<div class="bank-row"><span>Sort code</span><span>${esc(brand.sortCode)}</span></div>` : ""}
        ${brand.accountNumber ? `<div class="bank-row"><span>Account number</span><span>${esc(brand.accountNumber)}</span></div>` : ""}
        <div class="bank-row"><span>Reference</span><span>${esc(inv.id)}</span></div>
      </div>
    </div>
  ` : "";

  // Action buttons — only if it's a quote, not expired, and not already responded
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
    <p style="font-size:11px;color:#999;text-align:center;margin-top:8px;">Tapping Accept will notify ${esc(brand.tradingName || "the tradesperson")} that you've agreed to proceed.</p>
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

    ${bankHTML}

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
  // Accept token from query OR body (form POST always has it in body)
  let token = req.query.token || "";
  if (!token && req.method === "POST") {
    const form = await readFormBody(req);
    token = form.token || "";
  }
  if (!/^[a-z0-9]{20,64}$/i.test(token)) {
    return sendHTML(res, 404, errorPage(null, "Not found", "This link is invalid or has expired."));
  }

  // Fetch invoice + brand for validation and notification
  const invoices = await supabaseRequest("GET", `invoices?portal_token=eq.${encodeURIComponent(token)}&select=*&limit=1`);
  if (!Array.isArray(invoices) || invoices.length === 0) {
    return sendHTML(res, 404, errorPage(null, "Not found", "This link is invalid or has been revoked."));
  }
  const inv = invoices[0];

  const settingsRows = await supabaseRequest("GET", `user_settings?user_id=eq.${encodeURIComponent(inv.user_id)}&select=brand_data&limit=1`);
  const brand = settingsRows?.[0]?.brand_data || {};

  // Guard: only quotes, not already responded, not expired
  if (!inv.is_quote) return sendHTML(res, 400, errorPage(brand, "Not a quote", "This link is for an invoice, not a quote — nothing to accept or decline."));

  const validityDays = parseInt(brand.quoteValidity || "30", 10) || 30;
  const refDate = new Date(inv.updated_at || inv.created_at || Date.now());
  const expiresAt = new Date(refDate.getTime() + validityDays * 86400000);
  if (Date.now() > expiresAt.getTime()) {
    return sendHTML(res, 410, errorPage(brand, "Expired", "This quote has expired. Please contact the tradesperson for an updated quote."));
  }

  if (inv.status === "accepted" || inv.status === "declined") {
    // Idempotent — just re-render the view page, which will show the "already responded" banner
    const view = await renderQuoteView(token);
    return sendHTML(res, view.status, view.html);
  }

  // Commit state change
  const newStatus = action === "accept" ? "accepted" : "declined";
  const nowISO = new Date().toISOString();
  await supabaseRequest("PATCH", `invoices?id=eq.${encodeURIComponent(inv.id)}&user_id=eq.${encodeURIComponent(inv.user_id)}`, {
    status: newStatus,
    portal_responded_at: nowISO,
    updated_at: nowISO,
  });

  // Fire push notification to the tradesperson. Best-effort — if the push
  // service is unavailable we still show the customer the success page.
  try {
    const title = action === "accept" ? "Quote accepted ✓" : "Quote declined";
    const body = action === "accept"
      ? `${inv.customer} accepted ${inv.id} — ${fmtGBP(inv.gross_amount || inv.amount)}`
      : `${inv.customer} declined ${inv.id}`;
    // POST to the same Vercel deployment's push endpoint. Host is taken from
    // the incoming request so this works across preview deployments too.
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const proto = req.headers["x-forwarded-proto"] || "https";
    await fetch(`${proto}://${host}/api/push/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: inv.user_id, title, body, tag: `portal-${inv.id}` }),
    }).catch(() => {});
  } catch (e) {
    console.error("[portal] push notify failed:", e.message);
  }

  // Render the success page — same view the customer sees but with the banner
  // confirming their response. We re-fetch to pick up the updated status.
  const view = await renderQuoteView(token);
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
      const { status, html } = await renderQuoteView(token);
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
