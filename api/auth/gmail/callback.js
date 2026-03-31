import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  const { code, state: userId, error } = req.query;

  if (error) {
    return res.redirect(`${process.env.APP_URL}?email_error=${error}`);
  }

  if (!code || !userId) {
    return res.status(400).json({ error: "Missing code or userId" });
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GMAIL_CLIENT_ID,
        client_secret: process.env.GMAIL_CLIENT_SECRET,
        redirect_uri: process.env.GMAIL_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();

    if (tokens.error) {
      throw new Error(tokens.error_description || tokens.error);
    }

    const profileRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    const profile = await profileRes.json();

    await supabase.from("email_connections").upsert({
      user_id: userId,
      provider: "gmail",
      email: profile.email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,provider" });

    res.redirect(`${process.env.APP_URL}?email_connected=gmail`);
  } catch (err) {
    console.error("Gmail callback error:", err.message);
    res.redirect(`${process.env.APP_URL}?email_error=${err.message}`);
  }
}
