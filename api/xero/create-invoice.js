export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, invoice } = req.body;
  if (!userId || !invoice) return res.status(400).json({ error: 'Missing userId or invoice' });

  try {
    const connRes = await fetch(
      `${process.env.VITE_SUPABASE_URL}/rest/v1/accounting_connections?user_id=eq.${userId}&provider=eq.xero&select=*`,
      { headers: { 'apikey': process.env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}` } }
    );
    const conns = await connRes.json();
    const conn = conns?.[0];
    if (!conn) return res.status(404).json({ error: 'Xero not connected' });

    let accessToken = conn.access_token;
    if (new Date(conn.expires_at) < new Date()) {
      const refreshRes = await fetch('https://identity.xero.com/connect/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: conn.refresh_token, client_id: process.env.XERO_CLIENT_ID, client_secret: process.env.XERO_CLIENT_SECRET }).toString(),
      });
      const tokens = await refreshRes.json();
      accessToken = tokens.access_token;
      await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/accounting_connections?user_id=eq.${userId}&provider=eq.xero`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'apikey': process.env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}` },
        body: JSON.stringify({ access_token: tokens.access_token, refresh_token: tokens.refresh_token, expires_at: new Date(Date.now() + (tokens.expires_in || 1800) * 1000).toISOString() }),
      });
    }

    // Map VAT type to Xero tax type
    const vatType = invoice.vatType || "income";
    let taxType = 'NONE';
    if (invoice.vatZeroRated) taxType = 'ZERORATEDOUTPUT';
    else if (invoice.vatEnabled) {
      const rate = invoice.vatRate;
      if (vatType.includes('drc')) {
        taxType = rate === 20 ? 'ECOUTPUT' : 'ECOUTPUTSERVICES'; // DRC codes
      } else if (vatType === 'expenses') {
        taxType = rate === 20 ? 'INPUT2' : 'RRINPUT';
      } else {
        taxType = rate === 20 ? 'OUTPUT2' : 'RRINPUT';
      }
    }

    let lineItems = [];
    if (invoice.cisEnabled) {
      if (invoice.cisLabour > 0) lineItems.push({ Description: 'Labour', Quantity: 1, UnitAmount: invoice.cisLabour, AccountCode: '200', TaxType: taxType });
      if (invoice.cisMaterials > 0) lineItems.push({ Description: 'Materials', Quantity: 1, UnitAmount: invoice.cisMaterials, AccountCode: '200', TaxType: taxType });
    } else {
      lineItems.push({ Description: invoice.description || 'Services rendered', Quantity: 1, UnitAmount: invoice.grossAmount || invoice.amount, AccountCode: '200', TaxType: taxType });
    }

    const xeroInvoice = {
      Type: 'ACCREC',
      Contact: { Name: invoice.customer },
      LineItems: lineItems,
      LineAmountTypes: invoice.vatEnabled && !invoice.vatZeroRated ? 'INCLUSIVE' : 'EXCLUSIVE',
      Date: new Date().toISOString().split('T')[0],
      DueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      InvoiceNumber: invoice.id,
      Reference: invoice.jobRef || invoice.id,
      Status: 'AUTHORISED',
      CurrencyCode: 'GBP',
    };

    const xeroRes = await fetch('https://api.xero.com/api.xro/2.0/Invoices', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Xero-tenant-id': conn.tenant_id, 'Content-Type': 'application/json' },
      body: JSON.stringify({ Invoices: [xeroInvoice] }),
    });

    const xeroData = await xeroRes.json();
    if (xeroData.Invoices?.[0]?.InvoiceID) {
      return res.status(200).json({ success: true, xeroId: xeroData.Invoices[0].InvoiceID });
    } else {
      throw new Error(JSON.stringify(xeroData));
    }
  } catch (err) {
    console.error('Xero create invoice error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
