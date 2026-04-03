// api/xero/create-bill.js
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
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${credentials}` },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
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

async function safeJson(r) {
  const text = await r.text();
  try { return JSON.parse(text); }
  catch { throw new Error(`Xero error (${r.status}): ${text.slice(0, 300)}`); }
}

async function getOrCreateContact(accessToken, tenantId, supplierName) {
  const searchRes = await fetch(
    `https://api.xero.com/api.xro/2.0/Contacts?searchTerm=${encodeURIComponent(supplierName)}`,
    { headers: { Authorization: `Bearer ${accessToken}`, 'Xero-tenant-id': tenantId, Accept: 'application/json' } }
  );
  const searchData = await safeJson(searchRes);
  const match = searchData.Contacts?.find(c => c.Name?.toLowerCase() === supplierName.toLowerCase());
  if (match?.ContactID) return match.ContactID;

  const createRes = await fetch('https://api.xero.com/api.xro/2.0/Contacts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Xero-tenant-id': tenantId, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ Contacts: [{ Name: supplierName }] }),
  });
  const createData = await safeJson(createRes);
  return createData.Contacts?.[0]?.ContactID;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, material } = req.body;
  if (!userId || !material) return res.status(400).json({ error: 'Missing userId or material' });

  try {
    const { data: conn } = await supabase
      .from('accounting_connections').select('*')
      .eq('user_id', userId).eq('provider', 'xero').single();

    if (!conn) return res.status(404).json({ error: 'Xero not connected' });

    let accessToken = conn.access_token;
    if (new Date(conn.expires_at) < new Date()) {
      accessToken = await refreshXeroToken(userId, conn.refresh_token);
    }

    const supplierName = material.supplier || 'Unknown Supplier';
    const qty = parseFloat(material.qty || 1);
    const unitPrice = parseFloat(material.unitPrice || 0);
    const totalNet = parseFloat((qty * unitPrice).toFixed(2));

    // Build description with pre-VAT and VAT info
    const vatInfo = material.vatEnabled
      ? ` (Ex. VAT: £${totalNet.toFixed(2)} + ${material.vatRate || 20}% VAT)`
      : ` (No VAT)`;
    const description = `${material.item}${material.job ? ` — Job: ${material.job}` : ''}${vatInfo}`;

    // Due date — 30 days from today
    const today = new Date().toISOString().split('T')[0];
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const contactId = await getOrCreateContact(accessToken, conn.tenant_id, supplierName);

    const bill = {
      Invoices: [{
        Type: 'ACCPAY',
        Contact: { ContactID: contactId },
        Date: today,
        DueDate: dueDate,
        LineItems: [{
          Description: description,
          Quantity: qty,
          UnitAmount: unitPrice,
          TaxType: material.vatEnabled ? 'INPUT2' : 'NONE',
        }],
        LineAmountTypes: 'Exclusive',
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

    const billData = await safeJson(billRes);
    const xeroInvoiceId = billData.Invoices?.[0]?.InvoiceID;

    if (!xeroInvoiceId) {
      throw new Error(billData.Elements?.[0]?.ValidationErrors?.[0]?.Message || JSON.stringify(billData));
    }

    // Attach receipt image if available
    if (material.receiptImage && xeroInvoiceId) {
      try {
        // receiptImage is base64 data URL — extract the raw base64
        const base64Data = material.receiptImage.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const filename = material.receiptFilename || 'receipt.jpg';
        const mimeType = material.receiptImage.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';

        await fetch(`https://api.xero.com/api.xro/2.0/Invoices/${xeroInvoiceId}/Attachments/${encodeURIComponent(filename)}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Xero-tenant-id': conn.tenant_id,
            'Content-Type': mimeType,
            'Content-Length': imageBuffer.length,
          },
          body: imageBuffer,
        });
        console.log('Receipt attached to Xero bill');
      } catch (attachErr) {
        console.warn('Failed to attach receipt to Xero:', attachErr.message);
        // Non-fatal — bill was created, attachment failed
      }
    }

    return res.status(200).json({ success: true, xeroId: xeroInvoiceId });

  } catch (err) {
    console.error('Xero create-bill error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
