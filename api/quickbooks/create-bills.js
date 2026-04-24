// api/quickbooks/create-bills.js
// Bulk creates purchase bills in QuickBooks for multiple material items
import { createClient } from '@supabase/supabase-js';
import { withSentry } from "../lib/sentry.js";
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

async function getOrCreateVendor(accessToken, baseUrl, tenantId, supplierName) {
  const vendorQuery = await fetch(
    `${baseUrl}/v3/company/${tenantId}/query?query=SELECT * FROM Vendor WHERE DisplayName = '${supplierName.replace(/'/g, "\\'")}'&minorversion=65`,
    { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } }
  );
  const vendorData = await vendorQuery.json();
  if (vendorData.QueryResponse?.Vendor?.[0]?.Id) return vendorData.QueryResponse.Vendor[0].Id;

  const newVendor = await fetch(
    `${baseUrl}/v3/company/${tenantId}/vendor?minorversion=65`,
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
  return newVendorData.Vendor?.Id;
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, materials } = req.body;
  if (!userId || !materials?.length) return res.status(400).json({ error: 'Missing userId or materials' });

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

    // Group materials by supplier — one bill per supplier
    const bySupplier = {};
    for (const m of materials) {
      const supplier = m.supplier || 'Unknown Supplier';
      if (!bySupplier[supplier]) bySupplier[supplier] = [];
      bySupplier[supplier].push(m);
    }

    const results = [];

    for (const [supplierName, items] of Object.entries(bySupplier)) {
      const vendorId = await getOrCreateVendor(accessToken, baseUrl, conn.tenant_id, supplierName);

      const lines = items.map(m => ({
        DetailType: 'AccountBasedExpenseLineDetail',
        Amount: parseFloat(m.unitPrice || 0) * parseFloat(m.qty || 1),
        Description: `${m.item}${m.job ? ` — Job: ${m.job}` : ''}`,
        AccountBasedExpenseLineDetail: {
          AccountRef: { value: '1', name: 'Cost of Goods Sold' },
          BillableStatus: m.job ? 'Billable' : 'NotBillable',
          Qty: parseFloat(m.qty || 1),
          UnitPrice: parseFloat(m.unitPrice || 0),
        },
      }));

      const bill = {
        VendorRef: { value: vendorId },
        CurrencyRef: { value: 'GBP' },
        Line: lines,
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
      results.push({
        supplier: supplierName,
        billId: billData.Bill?.Id || null,
        itemCount: items.length,
        error: billData.Bill?.Id ? null : JSON.stringify(billData),
      });
    }

    const failed = results.filter(r => r.error);
    if (failed.length > 0) {
      return res.status(207).json({ results, message: `${results.length - failed.length} bills created, ${failed.length} failed` });
    }
    return res.status(200).json({ success: true, results, message: `${results.length} bill${results.length !== 1 ? 's' : ''} created in QuickBooks` });

  } catch (err) {
    console.error('QuickBooks create-bills error:', err);
    return res.status(500).json({ error: err.message });
  }
}

export default withSentry(handler, { routeName: "quickbooks/create-bills" });
