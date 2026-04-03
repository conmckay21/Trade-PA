// api/quickbooks/create-bill.js
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function refreshQBToken(userId, refreshToken) {
  const credentials = Buffer.from(
    `${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`
  ).toString('base64');
  const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  const tokens = await res.json();
  await supabase.from('accounting_connections').update({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId).eq('provider', 'quickbooks');
  return tokens.access_token;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, material } = req.body;
  if (!userId || !material) return res.status(400).json({ error: 'Missing userId or material' });

  try {
    const { data: conn } = await supabase
      .from('accounting_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'quickbooks')
      .single();

    if (!conn) return res.status(404).json({ error: 'QuickBooks not connected' });

    let accessToken = conn.access_token;
    if (new Date(conn.expires_at) < new Date()) {
      accessToken = await refreshQBToken(userId, conn.refresh_token);
    }

    const baseUrl = process.env.QB_SANDBOX === 'true'
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com';

    const supplierName = material.supplier || 'Unknown Supplier';
    const amount = parseFloat(material.unitPrice || 0) * parseFloat(material.qty || 1);

    // Find or create vendor (supplier) in QB
    const vendorQuery = await fetch(
      `${baseUrl}/v3/company/${conn.tenant_id}/query?query=SELECT * FROM Vendor WHERE DisplayName = '${supplierName.replace(/'/g, "\\'")}'&minorversion=65`,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } }
    );
    const vendorData = await vendorQuery.json();
    let vendorId = vendorData.QueryResponse?.Vendor?.[0]?.Id;

    if (!vendorId) {
      const newVendor = await fetch(
        `${baseUrl}/v3/company/${conn.tenant_id}/vendor?minorversion=65`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ DisplayName: supplierName }),
        }
      );
      const newVendorData = await newVendor.json();
      vendorId = newVendorData.Vendor?.Id;
    }

    // Create bill
    const bill = {
      VendorRef: { value: vendorId },
      CurrencyRef: { value: 'GBP' },
      Line: [{
        DetailType: 'AccountBasedExpenseLineDetail',
        Amount: amount,
        Description: `${material.item}${material.job ? ` — Job: ${material.job}` : ''}`,
        AccountBasedExpenseLineDetail: {
          AccountRef: { value: '1', name: 'Cost of Goods Sold' },
          BillableStatus: material.job ? 'Billable' : 'NotBillable',
          Qty: parseFloat(material.qty || 1),
          UnitPrice: parseFloat(material.unitPrice || 0),
        },
      }],
    };

    const billRes = await fetch(
      `${baseUrl}/v3/company/${conn.tenant_id}/bill?minorversion=65`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(bill),
      }
    );

    const billData = await billRes.json();
    if (billData.Bill?.Id) {
      return res.status(200).json({ success: true, billId: billData.Bill.Id });
    } else {
      throw new Error(JSON.stringify(billData));
    }
  } catch (err) {
    console.error('QuickBooks create-bill error:', err);
    return res.status(500).json({ error: err.message });
  }
}
