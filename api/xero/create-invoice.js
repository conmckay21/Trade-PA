import { withSentry, captureNonFatal } from "../lib/sentry.js";

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, invoice } = req.body;
  if (!userId || !invoice) return res.status(400).json({ error: 'Missing userId or invoice' });

  async function safeJson(r) {
    const text = await r.text();
    try { return JSON.parse(text); }
    catch { throw new Error(`Xero error (${r.status}): ${text.slice(0, 300)}`); }
  }

  // Defensive parse: line_items may arrive as a jsonb-stored JSON string,
  // a double-encoded JSON string, or an already-parsed array.
  function parseLineItems(raw) {
    if (Array.isArray(raw)) return raw;
    if (raw == null) return [];
    let v = raw;
    for (let i = 0; i < 2 && typeof v === 'string'; i++) {
      try { v = JSON.parse(v); } catch { return []; }
    }
    return Array.isArray(v) ? v : [];
  }

  try {
    // ── Validate critical invoice fields up-front ────────────────────────────
    const customerName = String(invoice.customer || '').trim();
    if (!customerName) {
      throw new Error('Invoice has no customer name — set a customer before syncing to Xero');
    }
    const grossAmount = parseFloat(invoice.grossAmount || invoice.amount) || 0;
    if (grossAmount <= 0 && !invoice.cisEnabled) {
      throw new Error(`Invoice ${invoice.id || ''} has no amount — cannot sync £0 invoice to Xero`);
    }

    // ── Look up Xero connection ──────────────────────────────────────────────
    const connRes = await fetch(
      `${process.env.VITE_SUPABASE_URL}/rest/v1/accounting_connections?user_id=eq.${userId}&provider=eq.xero&select=*`,
      { headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` } }
    );
    const conns = await connRes.json();
    const conn = conns?.[0];
    if (!conn) return res.status(404).json({ error: 'Xero not connected' });

    let accessToken = conn.access_token;
    if (new Date(conn.expires_at) < new Date()) {
      const refreshRes = await fetch('https://identity.xero.com/connect/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: conn.refresh_token,
          client_id: process.env.XERO_CLIENT_ID,
          client_secret: process.env.XERO_CLIENT_SECRET,
        }).toString(),
      });
      const tokens = await safeJson(refreshRes);
      if (!tokens.access_token) throw new Error('Failed to refresh Xero token');
      accessToken = tokens.access_token;
      await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/accounting_connections?user_id=eq.${userId}&provider=eq.xero`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` },
        body: JSON.stringify({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: new Date(Date.now() + (tokens.expires_in || 1800) * 1000).toISOString(),
        }),
      });
    }

    // ── VAT / Tax setup ──────────────────────────────────────────────────────
    // Always use EXCLUSIVE — send net amount, Xero adds VAT on top
    // Trade PA stores grossAmount (VAT-inclusive), so we extract net ourselves
    const vatEnabled = !!invoice.vatEnabled;
    const vatZeroRated = !!invoice.vatZeroRated;
    const vatType = invoice.vatType || 'income';
    const vatRate = Number(invoice.vatRate || 20);
    const isDRC = vatType.includes('drc');

    const netAmount = (vatEnabled && !vatZeroRated && !isDRC)
      ? parseFloat((grossAmount / (1 + vatRate / 100)).toFixed(2))
      : grossAmount;

    // Xero tax type — UK standard codes
    let taxType = 'NONE';
    if (vatZeroRated) {
      taxType = 'ZERORATEDOUTPUT';
    } else if (vatEnabled) {
      if (isDRC) {
        taxType = 'RROUTPUT';      // Domestic Reverse Charge (output)
      } else if (vatRate === 20) {
        taxType = 'OUTPUT2';       // Standard rate 20%
      } else if (vatRate === 5) {
        taxType = 'OUTPUT';        // 5% reduced rate (output, NOT RRINPUT which is for purchases)
      } else {
        taxType = 'OUTPUT2';
      }
    }

    const lineAmountTypes = 'Exclusive';

    // ── Build line items ─────────────────────────────────────────────────────
    let lineItems = [];

    if (invoice.cisEnabled) {
      // CIS invoice — split labour and materials
      if ((invoice.cisLabour || 0) > 0) {
        lineItems.push({
          Description: 'Labour',
          Quantity: 1,
          UnitAmount: parseFloat(invoice.cisLabour),
          AccountCode: '200',
          TaxType: taxType,
        });
      }
      if ((invoice.cisMaterials || 0) > 0) {
        lineItems.push({
          Description: 'Materials',
          Quantity: 1,
          UnitAmount: parseFloat(invoice.cisMaterials),
          AccountCode: '200',
          TaxType: taxType,
        });
      }
    } else {
      // Multi-line invoice — robust parse handles string/array/double-encoded data
      const parsed = parseLineItems(invoice.lineItems);
      if (parsed.length > 0) {
        lineItems = parsed.map(l => {
          const lineGross = parseFloat(l.amount || l.unitPrice || l.total || 0);
          const lineNet = (vatEnabled && !vatZeroRated && !isDRC)
            ? parseFloat((lineGross / (1 + vatRate / 100)).toFixed(2))
            : lineGross;
          return {
            Description: String(l.description || l.desc || 'Services').trim() || 'Services',
            Quantity: parseFloat(l.qty || l.quantity || 1) || 1,
            UnitAmount: lineNet,
            AccountCode: '200',
            TaxType: taxType,
          };
        }).filter(l => Number.isFinite(l.UnitAmount) && l.UnitAmount > 0);
      }
    }

    // Fallback — single line using net amount derived from gross
    if (lineItems.length === 0) {
      lineItems.push({
        Description: invoice.description || 'Services rendered',
        Quantity: 1,
        UnitAmount: netAmount,
        AccountCode: '200',
        TaxType: taxType,
      });
    }

    const xeroInvoice = {
      Type: 'ACCREC',
      Contact: { Name: customerName },
      LineItems: lineItems,
      Date: new Date().toISOString().split('T')[0],
      DueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      LineAmountTypes: lineAmountTypes,
      InvoiceNumber: invoice.id,
      Reference: invoice.jobRef || invoice.id,
      Status: 'AUTHORISED',
      CurrencyCode: 'GBP',
    };

    const xeroRes = await fetch('https://api.xero.com/api.xro/2.0/Invoices', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Xero-tenant-id': conn.tenant_id,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ Invoices: [xeroInvoice] }),
    });

    const xeroData = await safeJson(xeroRes);

    if (xeroData.Invoices?.[0]?.InvoiceID) {
      return res.status(200).json({ success: true, xeroId: xeroData.Invoices[0].InvoiceID });
    } else {
      const validationMsg = xeroData.Elements?.[0]?.ValidationErrors?.[0]?.Message
        || xeroData.Invoices?.[0]?.ValidationErrors?.[0]?.Message
        || JSON.stringify(xeroData);
      throw new Error(validationMsg);
    }
  } catch (err) {
    console.error('Xero create invoice error:', err.message, '— invoice:', invoice?.id);
    // Send full context to Sentry so we never lose the actual error message again
    try {
      if (typeof captureNonFatal === 'function') {
        captureNonFatal(err, {
          route: 'xero/create-invoice',
          userId,
          invoiceId: invoice?.id,
          customer: invoice?.customer,
        });
      }
    } catch (_) { /* never let logging break the response */ }
    res.status(500).json({ error: err.message });
  }
}

export default withSentry(handler, { routeName: "xero/create-invoice" });
