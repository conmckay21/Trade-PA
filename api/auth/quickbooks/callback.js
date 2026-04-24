import { withSentry } from "../../lib/sentry.js";

async function handler(req, res) {
  const { code, state: userId, realmId, error } = req.query;
  const APP_URL = process.env.APP_URL || 'https://trade-pa-id3s.vercel.app';

  if (error) {
    return res.redirect(`${APP_URL}/?qb=error&msg=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect(`${APP_URL}/?qb=error&msg=no_code`);
  }

  try {
    const credentials = btoa(`${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`);

    const tokenRes = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.QUICKBOOKS_REDIRECT_URI,
      }).toString(),
    });

    const tokens = await tokenRes.json();
    if (!tokens.access_token) throw new Error(`Token exchange failed: ${JSON.stringify(tokens)}`);

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
        provider: 'quickbooks',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        tenant_id: realmId,
        expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });

    res.redirect(`${APP_URL}/?qb=connected`);
  } catch (err) {
    console.error('QuickBooks callback error:', err.message);
    res.redirect(`${APP_URL}/?qb=error&msg=${encodeURIComponent(err.message)}`);
  }
}

export default withSentry(handler, { routeName: "auth/quickbooks/callback" });
