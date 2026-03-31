async function upsertEmailConnection(userId, data) {
  const url = `${process.env.VITE_SUPABASE_URL}/rest/v1/email_connections`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "apikey": process.env.SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates",
    },
    body: JSON.stringify({ user_id: userId, ...data }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export default async function handler(req, res) {
  const { code, state: userId, error } = req.query;

  if (error) return res.redirect(`${process.env.APP_URL}?email_error=${error}`);
  if (!code || !userId) return res.status(400).json({ error: "Missing code or userId" });

  try {
    const tokenRes = await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: process.env.OUTLOOK_CLIENT_ID,
          client_secret: process.env.OUTLOOK_CLIENT_SECRET,
          redirect_uri: process.env.OUTLOOK_REDIRECT_URI,
          grant_type: "authorization_code",
          scope: "offline_access Mail.ReadWrite Mail.Send User.Read",
        }),
      }
    );

    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.error_description || tokens.error);

    const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json();

    await upsertEmailConnection(userId, {
      provider: "outlook",
      email: profile.mail || profile.userPrincipalName,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    });

    res.redirect(`${process.env.APP_URL}?email_connected=outlook`);
  } catch (err) {
    console.error("Outlook callback error:", err.message);
    res.redirect(`${process.env.APP_URL}?email_error=${encodeURIComponent(err.message)}`);
  }
}
