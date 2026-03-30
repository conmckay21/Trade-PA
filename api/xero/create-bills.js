export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, materials } = req.body;
  if (!userId || !materials?.length) return res.status(400).json({ error: 'Missing userId or materials' });

  try {
    // Get Xero connection
    const connRes = await fetch(
      `${process.env.VITE_SUPABASE_URL}/rest/v1/accounting_connections?user_id=eq.${userId}&provider=eq.xero&select=*`,
      { headers: { 'apikey': process.env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}` } }
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
      await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/accounting_connections?user_id=eq.${userId}&provider=eq.xero`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'apikey': process.env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}` },
        body: JSON.stringify({ access_token: tokens.access_token, refresh_token: tokens.refresh_token, expires_at: new Date(Date.now() + (tokens.expires_in || 1800) * 1000).toISOString() }),
      });
    }

    // Group materials by supplier — create one purchase order per supplier
    const bySupplier = {};
    materials.forEach(m => {
      const supplier = m.supplier || 'Unknown Supplier';
      if (!bySupplier[supplier]) bySupplier[supplier] = [];
      bySupplier[supplier].push(m);
    });

    const purchaseOrders = Object.entries(bySupplier).map(([supplier, items]) => ({
      Contact: { Name: supplier },
      LineItems: items.map(m => ({
        Description: `${m.item}${m.job ? ` (Job: ${m.job})` : ''}`,
        Quantity: m.qty || 1,
        UnitAmount: m.unitPrice || 0,
        AccountCode: '310', // Purchases account
        TaxType: 'INPUT2',
      })),
      Date: new Date().toISOString().split('T')[0],
      DeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      Status: 'SUBMITTED',
      CurrencyCode: 'GBP',
    }));

    const xeroRes = await fetch('https://api.xero.com/api.xro/2.0/PurchaseOrders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Xero-tenant-id': conn.tenant_id,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ PurchaseOrders: purchaseOrders }),
    });

    const xeroData = await xeroRes.json();

    if (xeroData.PurchaseOrders?.length > 0) {
      return res.status(200).json({
        success: true,
        count: xeroData.PurchaseOrders.length,
        orders: xeroData.PurchaseOrders.map(po => po.PurchaseOrderNumber),
      });
    } else {
      throw new Error(JSON.stringify(xeroData));
    }
  } catch (err) {
    console.error('Xero create-bills error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
