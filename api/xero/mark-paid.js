export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, invoiceId } = req.body;
  if (!userId || !invoiceId) return res.status(400).json({ error: 'Missing userId or invoiceId' });

  try {
    // Get connection from Supabase
    const connRes = await fetch(
      `${process.env.VITE_SUPABASE_URL}/rest/v1/accounting_connections?user_id=eq.${userId}&provider=eq.xero&select=*`,
      {
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    const conns = await connRes.json();
    const conn = conns?.[0];
    if (!conn) return res.status(404).json({ error: 'Xero not connected' });

    let accessToken = conn.access_token;

    // Refresh token if expired
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
      const tokens = await refreshRes.json();
      accessToken = tokens.access_token;

      // Update stored token
      await fetch(
        `${process.env.VITE_SUPABASE_URL}/rest/v1/accounting_connections?user_id=eq.${userId}&provider=eq.xero`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: new Date(Date.now() + (tokens.expires_in || 1800) * 1000).toISOString(),
          }),
        }
      );
    }

    // Find the invoice in Xero by invoice number
    const searchRes = await fetch(
      `https://api.xero.com/api.xro/2.0/Invoices?InvoiceNumbers=${encodeURIComponent(invoiceId)}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Xero-tenant-id': conn.tenant_id,
          'Accept': 'application/json',
        },
      }
    );
    const searchData = await searchRes.json();
    const xeroInvoice = searchData.Invoices?.[0];

    if (!xeroInvoice) {
      return res.status(404).json({ error: 'Invoice not found in Xero' });
    }

    // Mark as paid by setting status to PAID
    const updateRes = await fetch('https://api.xero.com/api.xro/2.0/Invoices', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Xero-tenant-id': conn.tenant_id,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Invoices: [{
          InvoiceID: xeroInvoice.InvoiceID,
          Status: 'PAID',
          Payments: [{
            Account: { Code: '090' }, // Suspense/clearing account
            Date: new Date().toISOString().split('T')[0],
            Amount: xeroInvoice.AmountDue,
          }],
        }],
      }),
    });

    const updateData = await updateRes.json();
    return res.status(200).json({ success: true, data: updateData });

  } catch (err) {
    console.error('Xero mark-paid error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
