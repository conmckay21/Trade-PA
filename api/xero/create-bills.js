// api/xero/create-bills.js
// Bulk creates purchase bills in Xero for multiple material items
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function refreshXeroToken(userId, refreshToken) {
  const credentials = Buffer.from(
    `${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`
  ).toString('base64');
  const res = await fetch('https://identity.xero.com/connect/token', {
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
  }).eq('user_id', userId).eq('provider', 'xero');
  return tokens.access_token;
}

async function getOrCreateContact(accessToken, tenantId, supplierName) {
  const contactRes = await fetch(
    `https://api.xero.com/api.xro/2.0/Contacts?where=Name="${encodeURIComponent(supplierName)}"`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Xero-tenant-id': tenantId,
        Accept: 'application/json',
      },
    }
  );
  const contactData = await contactRes.json();
  if (contactData.Contacts?.[0]?.ContactID) return contactData.Contacts[0].ContactID;

  const newContactRes = await fetch('https://api.xero.com/api.xro/2.0/Contacts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Xero-tenant-id': tenantId,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ Contacts: [{ Name: supplierName }] }),
  });
  const newContactData = await newContactRes.json();
  return newContactData.Contacts?.[0]?.ContactID;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, materials } = req.body;
  if (!userId || !materials?.length) return res.status(400).json({ error: 'Missing userId or materials' });

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

    // Group materials by supplier so each supplier gets one bill
    const bySupplier = {};
    for (const m of materials) {
      const supplier = m.supplier || 'Unknown Supplier';
      if (!bySupplier[supplier]) bySupplier[supplier] = [];
      bySupplier[supplier].push(m);
    }

    const results = [];

    for (const [supplierName, items] of Object.entries(bySupplier)) {
      const contactId = await getOrCreateContact(accessToken, conn.tenant_id, supplierName);

      const lineItems = items.map(m => ({
        Description: `${m.item}${m.job ? ` — Job: ${m.job}` : ''}`,
        Quantity: parseFloat(m.qty || 1),
        UnitAmount: parseFloat(m.unitPrice || 0),
        TaxType: 'NONE',
      }));

      const bill = {
        Invoices: [{
          Type: 'ACCPAY',
          Contact: { ContactID: contactId },
          LineItems: lineItems,
          CurrencyCode: 'GBP',
          Status: 'AUTHORISED',
        }],
      };

      const billRes = await fetch('https://api.xero.com/api.xro/2.0/Invoices', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Xero-tenant-id': conn.tenant_id,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(bill),
      });

      const billData = await billRes.json();
      results.push({
        supplier: supplierName,
        xeroId: billData.Invoices?.[0]?.InvoiceID || null,
        error: billData.Invoices?.[0]?.InvoiceID ? null : JSON.stringify(billData),
      });
    }

    const failed = results.filter(r => r.error);
    if (failed.length > 0) {
      return res.status(207).json({ results, message: `${results.length - failed.length} bills created, ${failed.length} failed` });
    }
    return res.status(200).json({ success: true, results, message: `${results.length} bill${results.length !== 1 ? 's' : ''} created in Xero` });

  } catch (err) {
    console.error('Xero create-bills error:', err);
    return res.status(500).json({ error: err.message });
  }
}
