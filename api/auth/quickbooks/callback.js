import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  const { code, state: userId, realmId, error } = req.query;

  if (error) {
    return res.redirect(`${process.env.APP_URL}/settings?qb=error&msg=${error}`);
  }

  try {
    const credentials = Buffer.from(
      `${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`
    ).toString('base64');

    const tokenRes = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.QUICKBOOKS_REDIRECT_URI,
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokens.access_token) throw new Error('No access token received');

    await supabase.from('accounting_connections').upsert({
      user_id: userId,
      provider: 'quickbooks',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      tenant_id: realmId,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });

    res.redirect(`${process.env.APP_URL}/settings?qb=connected`);
  } catch (err) {
    console.error('QuickBooks callback error:', err);
    res.redirect(`${process.env.APP_URL}/settings?qb=error&msg=${encodeURIComponent(err.message)}`);
  }
}
