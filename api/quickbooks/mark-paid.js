// api/quickbooks/mark-paid.js
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

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, invoiceId } = req.body;
  if (!userId || !invoiceId) return res.status(400).json({ error: 'Missing userId or invoiceId' });

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

    // Find the QB invoice by DocNumber (which we set to invoiceId when creating)
    const queryRes = await fetch(
      `${baseUrl}/v3/company/${conn.tenant_id}/query?query=SELECT * FROM Invoice WHERE DocNumber = '${invoiceId}'&minorversion=65`,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } }
    );
    const queryData = await queryRes.json();
    const qbInvoice = queryData.QueryResponse?.Invoice?.[0];

    if (!qbInvoice) {
      return res.status(404).json({ error: `Invoice ${invoiceId} not found in QuickBooks` });
    }

    // Create a payment against the invoice
    const payment = {
      TotalAmt: qbInvoice.Balance,
      CustomerRef: qbInvoice.CustomerRef,
      CurrencyRef: { value: 'GBP' },
      Line: [{
        Amount: qbInvoice.Balance,
        LinkedTxn: [{
          TxnId: qbInvoice.Id,
          TxnType: 'Invoice',
        }],
      }],
    };

    const payRes = await fetch(
      `${baseUrl}/v3/company/${conn.tenant_id}/payment?minorversion=65`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payment),
      }
    );

    const payData = await payRes.json();
    if (payData.Payment?.Id) {
      return res.status(200).json({ success: true, paymentId: payData.Payment.Id });
    } else {
      throw new Error(JSON.stringify(payData));
    }
  } catch (err) {
    console.error('QuickBooks mark-paid error:', err);
    return res.status(500).json({ error: err.message });
  }
}

export default withSentry(handler, { routeName: "quickbooks/mark-paid" });
