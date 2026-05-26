import { withSentry, captureNonFatal } from "../lib/sentry.js";

const SB_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

function sbHeaders() {
  return {
    "apikey": SB_KEY,
    "Authorization": "Bearer " + SB_KEY,
    "Content-Type": "application/json",
  };
}

async function sbSelect(path) {
  const res = await fetch(SB_URL + "/rest/v1/" + path, { headers: sbHeaders() });
  if (!res.ok) throw new Error("Supabase select " + res.status + ": " + (await res.text()));
  return res.json();
}

async function sbInsert(table, row) {
  const res = await fetch(SB_URL + "/rest/v1/" + table, {
    method: "POST",
    headers: Object.assign({}, sbHeaders(), { "Prefer": "return=representation" }),
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error("Supabase insert " + res.status + ": " + (await res.text()));
  return res.json();
}

async function sbUpdate(path, patch) {
  const res = await fetch(SB_URL + "/rest/v1/" + path, {
    method: "PATCH",
    headers: sbHeaders(),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Supabase update " + res.status + ": " + (await res.text()));
}

async function getEmailToken(userId, provider) {
  const rows = await sbSelect("email_connections?user_id=eq." + userId + "&provider=eq." + provider + "&select=*");
  const conn = rows && rows[0];
  if (!conn) throw new Error("No " + provider + " connection found");

  const isExpired = new Date(conn.expires_at).getTime() < Date.now() + 60000;
  if (!isExpired) return conn.access_token;

  const tokenUrl = provider === "gmail"
    ? "https://oauth2.googleapis.com/token"
    : "https://login.microsoftonline.com/common/oauth2/v2.0/token";

  let body;
  if (provider === "gmail") {
    body = new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID,
      client_secret: process.env.GMAIL_CLIENT_SECRET,
      refresh_token: conn.refresh_token,
      grant_type: "refresh_token",
    });
  } else {
    body = new URLSearchParams({
      client_id: process.env.OUTLOOK_CLIENT_ID,
      client_secret: process.env.OUTLOOK_CLIENT_SECRET,
      refresh_token: conn.refresh_token,
      grant_type: "refresh_token",
      scope: "offline_access Mail.ReadWrite Mail.Send User.Read",
    });
  }

  const tokenRes = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tokens = await tokenRes.json();
  if (tokens.error) throw new Error(tokens.error_description || tokens.error);

  await sbUpdate(
    "email_connections?user_id=eq." + userId + "&provider=eq." + provider,
    {
      access_token: tokens.access_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }
  );

  return tokens.access_token;
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHTML(opts) {
  const kind = opts.kind;
  const tradingName = opts.tradingName;
  const items = opts.items;
  const orderNotes = opts.notes;
  const jobRef = opts.jobRef;
  const brand = opts.brand || {};
  const supplierName = opts.supplierName;

  const isOrder = kind === "order";
  const headline = isOrder
    ? "Material Order from " + escapeHtml(tradingName)
    : "Price Request from " + escapeHtml(tradingName);

  const intro = isOrder
    ? "Please could you arrange the following materials for collection or delivery"
    : "Please could you provide a price and lead time for the following materials";

  let rows = "";
  for (let i = 0; i < items.length; i++) {
    const m = items[i] || {};
    const item = escapeHtml(m.item || "(no description)");
    const qty = escapeHtml(String(m.qty != null ? m.qty : 1));
    const itemNotes = m.notes
      ? '<div style="color:#666;font-size:13px;margin-top:4px">' + escapeHtml(m.notes) + "</div>"
      : "";
    rows += '<tr>';
    rows += '<td style="padding:10px 12px;border-bottom:1px solid #eee;vertical-align:top">' + item + itemNotes + '</td>';
    rows += '<td style="padding:10px 12px;border-bottom:1px solid #eee;vertical-align:top;text-align:right;white-space:nowrap">' + qty + '</td>';
    rows += '</tr>';
  }

  let html = "";
  html += '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#0A0A0A;max-width:640px;margin:0 auto;padding:24px">';
  html += '<h2 style="margin:0 0 16px 0;font-size:20px">' + escapeHtml(headline) + '</h2>';
  html += '<p style="margin:0 0 12px 0">Hi ' + escapeHtml(supplierName || "team") + ',</p>';
  html += '<p style="margin:0 0 20px 0">' + escapeHtml(intro) + ':</p>';

  if (jobRef) {
    html += '<p style="margin:0 0 16px 0;color:#666"><strong>Job ref:</strong> ' + escapeHtml(jobRef) + '</p>';
  }

  html += '<table style="width:100%;border-collapse:collapse;margin-bottom:20px">';
  html += '<thead><tr style="background:#F0F0F0">';
  html += '<th style="padding:10px 12px;text-align:left;border-bottom:2px solid #ddd">Item</th>';
  html += '<th style="padding:10px 12px;text-align:right;border-bottom:2px solid #ddd;white-space:nowrap">Qty</th>';
  html += '</tr></thead>';
  html += '<tbody>' + rows + '</tbody>';
  html += '</table>';

  if (orderNotes) {
    html += '<p style="margin:16px 0;padding:12px;background:#F9F9F9;border-left:3px solid #F59E0B"><strong>Notes:</strong> ' + escapeHtml(orderNotes) + '</p>';
  }

  if (isOrder) {
    html += '<p style="margin:16px 0">Please confirm pricing and the earliest delivery or collection slot.</p>';
  } else {
    html += '<p style="margin:16px 0">Please confirm pricing including VAT, availability, and earliest delivery or collection date.</p>';
  }

  html += '<p style="margin:24px 0 6px 0">Many thanks,</p>';
  html += '<p style="margin:0;font-weight:bold">' + escapeHtml(tradingName) + '</p>';

  if (brand.phone) html += '<p style="margin:4px 0 0 0;color:#666;font-size:13px">' + escapeHtml(brand.phone) + '</p>';
  if (brand.email) html += '<p style="margin:2px 0 0 0;color:#666;font-size:13px">' + escapeHtml(brand.email) + '</p>';
  if (brand.website) html += '<p style="margin:2px 0 0 0;color:#666;font-size:13px">' + escapeHtml(brand.website) + '</p>';

  html += '</body></html>';
  return html;
}

function makeGmailRaw(opts) {
  const lines = [
    "From: " + opts.from,
    "To: " + opts.to,
    "Subject: " + opts.subject,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "",
    opts.body,
  ];
  const raw = lines.join("\r\n");
  return Buffer.from(raw).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function resolveTradingName(brand) {
  if (!brand) return "Trade PA User";
  if (brand.tradingName) return brand.tradingName;
  if (brand.businessName) return brand.businessName;
  if (brand.companyName) return brand.companyName;
  const fn = brand.firstName || "";
  const ln = brand.lastName || "";
  const full = (fn + " " + ln).trim();
  return full || "Trade PA User";
}

async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = req.body || {};
  const userId = body.userId;
  let supplierId = body.supplierId;
  const supplierName = body.supplierName;
  const items = body.items;
  const kind = body.kind || "order";
  const orderNotes = body.notes || "";
  const jobRef = body.jobRef || "";

  if (!userId) return res.status(400).json({ error: "userId required" });
  if (!supplierId && !supplierName) return res.status(400).json({ error: "supplierId or supplierName required" });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "items array required (at least 1 item)" });
  if (kind !== "order" && kind !== "price_request") return res.status(400).json({ error: "kind must be 'order' or 'price_request'" });

  try {
    // 1. Resolve supplier
    let supplier;
    if (supplierId) {
      const rows = await sbSelect("suppliers?id=eq." + supplierId + "&user_id=eq." + userId + "&deleted_at=is.null&select=*");
      supplier = rows && rows[0];
    } else {
      const escaped = encodeURIComponent("%" + supplierName + "%");
      const rows = await sbSelect("suppliers?user_id=eq." + userId + "&deleted_at=is.null&name=ilike." + escaped + "&select=*&limit=3");
      if (rows && rows.length === 1) {
        supplier = rows[0];
      } else if (rows && rows.length > 1) {
        return res.status(400).json({
          error: "Multiple suppliers matched '" + supplierName + "'. Please be more specific.",
          matches: rows.map(function(r) { return r.name; }),
        });
      }
    }

    if (!supplier) {
      return res.status(404).json({ error: "Supplier not found" });
    }
    if (!supplier.email || !supplier.email.trim()) {
      return res.status(400).json({
        error: "Supplier '" + supplier.name + "' has no email on file. Add an email address first.",
      });
    }

    supplierId = supplier.id;

    // 2. Load brand info
    const settingsRows = await sbSelect("user_settings?user_id=eq." + userId + "&select=brand_data");
    const brand = (settingsRows && settingsRows[0] && settingsRows[0].brand_data) || {};
    const tradingName = resolveTradingName(brand);

    // 3. Find active email provider
    const connRows = await sbSelect("email_connections?user_id=eq." + userId + "&select=provider,email&order=updated_at.desc&limit=1");
    const conn = connRows && connRows[0];
    if (!conn) {
      return res.status(400).json({ error: "No email connection. Connect Gmail or Outlook in the Inbox tab first." });
    }

    // 4. Build subject and HTML
    const subject = kind === "order"
      ? "Material order from " + tradingName
      : "Price request from " + tradingName;

    const html = buildHTML({
      kind,
      tradingName,
      items,
      notes: orderNotes,
      jobRef,
      brand,
      supplierName: supplier.name,
    });

    // 5. Send
    let sentVia;
    if (conn.provider === "gmail") {
      const token = await getEmailToken(userId, "gmail");
      const raw = makeGmailRaw({
        to: supplier.email,
        from: conn.email,
        subject,
        body: html,
      });
      const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ raw }),
      });
      const sendResult = await sendRes.json();
      if (sendResult.error) throw new Error(sendResult.error.message || "Gmail send failed");
      sentVia = "gmail";
    } else if (conn.provider === "outlook") {
      const token = await getEmailToken(userId, "outlook");
      const sendRes = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            subject,
            body: { contentType: "HTML", content: html },
            toRecipients: [{ emailAddress: { address: supplier.email } }],
          },
          saveToSentItems: true,
        }),
      });
      if (!sendRes.ok) {
        const errText = await sendRes.text();
        throw new Error("Outlook send failed: " + errText);
      }
      sentVia = "outlook";
    } else {
      return res.status(400).json({ error: "Unsupported email provider: " + conn.provider });
    }

    // 6. Log to supplier_orders (best-effort)
    try {
      await sbInsert("supplier_orders", {
        user_id: userId,
        supplier_id: supplierId,
        supplier_name: supplier.name,
        supplier_email: supplier.email,
        kind,
        items,
        notes: orderNotes || null,
        job_ref: jobRef || null,
        subject,
        body_html: html,
        sent_via: sentVia,
      });
    } catch (logErr) {
      captureNonFatal(logErr, { route: "send-material-order", phase: "log", userId });
    }

    return res.status(200).json({
      success: true,
      sentTo: supplier.email,
      supplierName: supplier.name,
      via: sentVia,
      kind,
      itemCount: items.length,
    });
  } catch (err) {
    captureNonFatal(err, { route: "send-material-order", userId, supplierId });
    return res.status(500).json({ error: err.message || "Failed to send" });
  }
}

export default withSentry(handler);
