import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  const { code, state: userId, error } = req.query;

  if (error) {
    return res.redirect(`${process.env.APP_URL}/settings?xero=error&msg=${error}`);
  }

  try {
    const tokenRes = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.XERO_REDIRECT_URI,
        client_id: process.env.XERO_CLIENT_ID,
        client_secret: process.env.XERO_CLIENT_SECRET,
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokens.access_token) throw new Error('No access token received');

    const tenantsRes = await fetch('https://api.xero.com/connections', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const tenants = await tenantsRes.json();
    const tenantId = tenants[0]?.tenantId;

    await supabase.from('accounting_connections').upsert({
      user_id: userId,
      provider: 'xero',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      tenant_id: tenantId,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });

    res.redirect(`${process.env.APP_URL}/settings?xero=connected`);
  } catch (err) {
    console.error('Xero callback error:', err);
    res.redirect(`${process.env.APP_URL}/settings?xero=error&msg=${encodeURIComponent(err.message)}`);
  }
}
