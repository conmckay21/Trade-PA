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

  const { userId, invoice } = req.body;
  if (!userId || !invoice) return res.status(400).json({ error: 'Missing userId or invoice' });

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

    const customerQuery = await fetch(
      `${baseUrl}/v3/company/${conn.tenant_id}/query?query=SELECT * FROM Customer WHERE DisplayName = '${invoice.customer.replace(/'/g, "\\'")}'&minorversion=65`,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } }
    );
    const customerData = await customerQuery.json();
    let finalCustomerId = customerData.QueryResponse?.Customer?.[0]?.Id;

    if (!finalCustomerId) {
      const newCustomer = await fetch(
        `${baseUrl}/v3/company/${conn.tenant_id}/customer?minorversion=65`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ DisplayName: invoice.customer }),
        }
      );
      const newCustomerData = await newCustomer.json();
      finalCustomerId = newCustomerData.Customer?.Id;
    }

    const qbInvoice = {
      CustomerRef: { value: finalCustomerId },
      DocNumber: invoice.id,
      Line: [{
        DetailType: 'SalesItemLineDetail',
        Amount: invoice.amount,
        Description: invoice.description || 'Services rendered',
        SalesItemLineDetail: {
          ItemRef: { value: '1', name: 'Services' },
          Qty: 1,
          UnitPrice: invoice.amount,
        },
      }],
      CurrencyRef: { value: 'GBP' },
    };

    const qbRes = await fetch(
      `${baseUrl}/v3/company/${conn.tenant_id}/invoice?minorversion=65`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(qbInvoice),
      }
    );

    const qbData = await qbRes.json();

    if (qbData.Invoice?.Id) {
      return res.status(200).json({ success: true, qbId: qbData.Invoice.Id });
    } else {
      throw new Error(JSON.stringify(qbData));
    }
  } catch (err) {
    console.error('QuickBooks create invoice error:', err);
    res.status(500).json({ error: err.message });
  }
}
