export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, invoice } = req.body;
  if (!userId || !invoice) return res.status(400).json({ error: 'Missing userId or invoice' });

  async function safeJson(r) {
    const text = await r.text();
    try { return JSON.parse(text); }
    catch { throw new Error(`Xero error (${r.status}): ${text.slice(0, 300)}`); }
  }

  try {
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

    // ── VAT / Tax setup ────────────────────────────────────────────────────────
    // Trade PA invoices always store grossAmount (VAT-inclusive customer price)
    // We send INCLUSIVE amounts to Xero and let it extract VAT automatically

    const vatEnabled = !!invoice.vatEnabled;
    const vatZeroRated = !!invoice.vatZeroRated;
    const vatType = invoice.vatType || 'income';
    const vatRate = Number(invoice.vatRate || 20);
    const grossAmount = parseFloat(invoice.grossAmount || invoice.amount) || 0;
    const isDRC = vatType.includes('drc');

    // Xero tax type — UK standard codes
    let taxType = 'NONE';
    if (vatZeroRated) {
      taxType = 'ZERORATEDOUTPUT';
    } else if (vatEnabled) {
      if (isDRC) {
        // Domestic Reverse Charge — customer accounts for VAT
        taxType = 'RROUTPUT';
      } else if (vatRate === 20) {
        taxType = 'OUTPUT2';   // Standard rate 20%
      } else if (vatRate === 5) {
        taxType = 'RRINPUT';   // Reduced rate 5%
      } else {
        taxType = 'OUTPUT2';
      }
    }

    // Line amount type:
    // - If VAT enabled and inclusive → INCLUSIVE (Xero extracts VAT from gross)
    // - If no VAT → EXCLUSIVE (amount = net, no VAT)
    // - DRC → EXCLUSIVE (net amount, customer accounts for VAT)
    const lineAmountTypes = (vatEnabled && !vatZeroRated && !isDRC) ? 'INCLUSIVE' : 'EXCLUSIVE';

    // ── Build line items ───────────────────────────────────────────────────────
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
    } else if (invoice.lineItems && invoice.lineItems.length > 0) {
      // Multi-line invoice — send each line
      // Line amounts from Trade PA are already gross (VAT-inclusive)
      lineItems = invoice.lineItems.map(l => ({
        Description: l.description || l.desc || 'Services',
        Quantity: parseFloat(l.qty || l.quantity || 1),
        UnitAmount: parseFloat(l.amount || l.unitPrice || l.total || 0),
        AccountCode: '200',
        TaxType: taxType,
      })).filter(l => l.UnitAmount > 0);
    }

    // Fallback — single line using gross amount
    if (lineItems.length === 0) {
      lineItems.push({
        Description: invoice.description || 'Services rendered',
        Quantity: 1,
        UnitAmount: grossAmount,
        AccountCode: '200',
        TaxType: taxType,
      });
    }

    const xeroInvoice = {
      Type: 'ACCREC',
      Contact: { Name: invoice.customer },
      LineItems: lineItems,
      LineAmountTypes: lineAmountTypes,
      Date: new Date().toISOString().split('T')[0],
      DueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
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
    console.error('Xero create invoice error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
