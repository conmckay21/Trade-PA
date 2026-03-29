import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function refreshXeroToken(userId, refreshToken) {
  const res = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.XERO_CLIENT_ID,
      client_secret: process.env.XERO_CLIENT_SECRET,
    }),
  });
  const tokens = await res.json();

  await supabase.from('accounting_connections').update({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId).eq('provider', 'xero');

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
      .eq('provider', 'xero')
      .single();

    if (!conn) return res.status(404).json({ error: 'Xero not connected' });

    let accessToken = conn.access_token;
    if (new Date(conn.expires_at) < new Date()) {
      accessToken = await refreshXeroToken(userId, conn.refresh_token);
    }

    const xeroInvoice = {
      Type: 'ACCREC',
      Contact: { Name: invoice.customer },
      LineItems: [{
        Description: invoice.description || 'Services rendered',
        Quantity: 1,
        UnitAmount: invoice.amount,
        AccountCode: '200',
        TaxType: invoice.vatEnabled ? 'OUTPUT2' : 'NONE',
      }],
      Date: new Date().toISOString().split('T')[0],
      DueDate: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
      InvoiceNumber: invoice.id,
      Reference: invoice.id,
      Status: 'AUTHORISED',
      CurrencyCode: 'GBP',
    };

    const xeroRes = await fetch('https://api.xero.com/api.xro/2.0/Invoices', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Xero-tenant-id': conn.tenant_id,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ Invoices: [xeroInvoice] }),
    });

    const xeroData = await xeroRes.json();

    if (xeroData.Invoices?.[0]?.InvoiceID) {
      return res.status(200).json({ success: true, xeroId: xeroData.Invoices[0].InvoiceID });
    } else {
      throw new Error(JSON.stringify(xeroData));
    }
  } catch (err) {
    console.error('Xero create invoice error:', err);
    res.status(500).json({ error: err.message });
  }
}
