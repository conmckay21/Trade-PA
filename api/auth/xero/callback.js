export default async function handler(req, res) {
  const { code, state: userId, error } = req.query;
  const APP_URL = process.env.APP_URL || 'https://trade-pa-id3s.vercel.app';

  if (error) {
    return res.redirect(`${APP_URL}/?xero=error&msg=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect(`${APP_URL}/?xero=error&msg=no_code`);
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
      }).toString(),
    });

    const tokens = await tokenRes.json();
    if (!tokens.access_token) throw new Error(`Token exchange failed: ${JSON.stringify(tokens)}`);

    const tenantsRes = await fetch('https://api.xero.com/connections', {
      headers: { Authorization: `Bearer ${tokens.access_token}`, 'Content-Type': 'application/json' },
    });
    const tenants = await tenantsRes.json();
    const tenantId = Array.isArray(tenants) ? tenants[0]?.tenantId : null;

    await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/accounting_connections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        user_id: userId,
        provider: 'xero',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        tenant_id: tenantId,
        expires_at: new Date(Date.now() + (tokens.expires_in || 1800) * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });

    res.redirect(`${APP_URL}/?xero=connected`);
  } catch (err) {
    console.error('Xero callback error:', err.message);
    res.redirect(`${APP_URL}/?xero=error&msg=${encodeURIComponent(err.message)}`);
  }
}
