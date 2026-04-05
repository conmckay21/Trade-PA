// api/xero/create-bills.js
// Bulk creates purchase bills in Xero — one bill per supplier
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function refreshXeroToken(userId, refreshToken) {
  const credentials = Buffer.from(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${credentials}` },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  const tokens = await res.json();
  await supabase.from('accounting_connections').update({
    access_token: tokens.access_token, refresh_token: tokens.refresh_token,
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
  const { userId, materials } = req.body;
  if (!userId || !materials?.length) return res.status(400).json({ error: 'Missing userId or materials' });

  try {
    const { data: conn } = await supabase.from('accounting_connections').select('*')
      .eq('user_id', userId).eq('provider', 'xero').single();
    if (!conn) return res.status(404).json({ error: 'Xero not connected' });

    let accessToken = conn.access_token;
    if (new Date(conn.expires_at) < new Date()) {
      accessToken = await refreshXeroToken(userId, conn.refresh_token);
    }

    // Group by supplier
    const bySupplier = {};
    for (const m of materials) {
      const key = m.supplier || 'Unknown Supplier';
      if (!bySupplier[key]) bySupplier[key] = [];
      bySupplier[key].push(m);
    }

    const today = new Date().toISOString().split('T')[0];
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const results = [];

    for (const [supplierName, items] of Object.entries(bySupplier)) {
      try {
        const contactId = await getOrCreateContact(accessToken, conn.tenant_id, supplierName);

        const lineItems = items.map(m => {
          const qty = parseFloat(m.qty || 1);
          const unitPrice = parseFloat(m.unitPrice || 0);
          // Tax type: INPUT2 = 20% VAT, RRINPUT = 5% VAT, NONE = no VAT
          const taxType = m.vatEnabled
            ? (m.vatRate === 5 ? 'RRINPUT' : 'INPUT2')
            : 'NONE';
          const desc = `${m.item}${m.job ? ` — Job: ${m.job}` : ''}${m.vatEnabled ? ` (+${m.vatRate || 20}% VAT)` : ''}`;
          return {
            Description: desc,
            Quantity: qty,
            UnitAmount: unitPrice,
            TaxType: taxType,
            // No AccountCode — varies per business, user assigns in Xero when approving draft
          };
        });

        const bill = {
          Invoices: [{
            Type: 'ACCPAY',
            Contact: { ContactID: contactId },
            Date: today,
            DueDate: dueDate,
            LineAmountTypes: 'Exclusive',
            Status: 'DRAFT',  // Draft — user assigns account codes in Xero before approving
            CurrencyCode: 'GBP',
            LineItems: lineItems,
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
        const valErr = billData.Elements?.[0]?.ValidationErrors?.[0]?.Message;

        results.push({
          supplier: supplierName,
          items: items.length,
          xeroId: xeroInvoiceId || null,
          error: xeroInvoiceId ? null : (valErr || JSON.stringify(billData).slice(0, 200)),
        });
      } catch (supplierErr) {
        results.push({ supplier: supplierName, items: items.length, xeroId: null, error: supplierErr.message });
      }
    }

    const failed = results.filter(r => r.error);
    if (failed.length > 0) {
      return res.status(207).json({ results, message: `${results.length - failed.length} bills created, ${failed.length} failed` });
    }
    return res.status(200).json({ success: true, results, message: `${results.length} bill${results.length !== 1 ? 's' : ''} created in Xero` });

  } catch (err) {
    console.error('Xero create-bills error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
