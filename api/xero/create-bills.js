export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, bill } = req.body;
  if (!userId || !bill) return res.status(400).json({ error: 'Missing userId or bill' });

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

    const lineItems = (bill.items || []).map(item => ({
      Description: item.description || item.item,
      Quantity: item.qty || 1,
      UnitAmount: parseFloat(item.unitPrice || item.totalPrice || 0),
      AccountCode: '429',
      TaxType: 'NONE',
    }));

    if (lineItems.length === 0) {
      lineItems.push({ Description: bill.description || 'Supplier purchase', Quantity: 1, UnitAmount: parseFloat(bill.total || 0), AccountCode: '429', TaxType: 'NONE' });
    }

    const xeroBill = {
      Type: 'ACCPAY',
      Contact: { Name: bill.supplier || 'Unknown Supplier' },
      LineItems: lineItems,
      Date: bill.date || new Date().toISOString().split('T')[0],
      DueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      Reference: bill.jobRef || '',
      Status: 'DRAFT',
      CurrencyCode: 'GBP',
    };

    const xeroRes = await fetch('https://api.xero.com/api.xro/2.0/Invoices', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Xero-tenant-id': conn.tenant_id, 'Content-Type': 'application/json' },
      body: JSON.stringify({ Invoices: [xeroBill] }),
    });

    const xeroData = await xeroRes.json();
    if (xeroData.Invoices?.[0]?.InvoiceID) {
      return res.status(200).json({ success: true, xeroId: xeroData.Invoices[0].InvoiceID });
    } else {
      throw new Error(JSON.stringify(xeroData));
    }
  } catch (err) {
    console.error('Xero create bill error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
