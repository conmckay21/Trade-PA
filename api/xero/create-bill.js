// api/xero/create-bill.js
// Creates a single purchase bill in Xero for one material item
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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, material } = req.body;
  if (!userId || !material) return res.status(400).json({ error: 'Missing userId or material' });

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

    const supplierName = material.supplier || 'Unknown Supplier';
    const qty = parseFloat(material.qty || 1);
    const unitPrice = parseFloat(material.unitPrice || 0);
    const amount = qty * unitPrice;

    // Find or create contact (supplier) in Xero
    const contactRes = await fetch(
      `https://api.xero.com/api.xro/2.0/Contacts?where=Name="${encodeURIComponent(supplierName)}"`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Xero-tenant-id': conn.tenant_id,
          Accept: 'application/json',
        },
      }
    );
    const contactData = await contactRes.json();
    let contactId = contactData.Contacts?.[0]?.ContactID;

    if (!contactId) {
      const newContactRes = await fetch('https://api.xero.com/api.xro/2.0/Contacts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Xero-tenant-id': conn.tenant_id,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ Contacts: [{ Name: supplierName }] }),
      });
      const newContactData = await newContactRes.json();
      contactId = newContactData.Contacts?.[0]?.ContactID;
    }

    // Create ACCPAY (bill) invoice in Xero
    const bill = {
      Invoices: [{
        Type: 'ACCPAY',
        Contact: { ContactID: contactId },
        LineItems: [{
          Description: `${material.item}${material.job ? ` — Job: ${material.job}` : ''}`,
          Quantity: qty,
          UnitAmount: unitPrice,
          AccountCode: '300', // Cost of Sales — change to match your Xero chart of accounts
          TaxType: 'NONE',
        }],
        CurrencyCode: 'GBP',
        Status: 'DRAFT',
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
    if (billData.Invoices?.[0]?.InvoiceID) {
      return res.status(200).json({ success: true, xeroId: billData.Invoices[0].InvoiceID });
    } else {
      throw new Error(JSON.stringify(billData));
    }
  } catch (err) {
    console.error('Xero create-bill error:', err);
    return res.status(500).json({ error: err.message });
  }
}
