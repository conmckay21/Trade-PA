export default function handler(req, res) {
  const clientId = process.env.OUTLOOK_CLIENT_ID;
  const redirectUri = process.env.OUTLOOK_REDIRECT_URI;
  const { userId } = req.query;

  if (!clientId || !redirectUri) {
    return res.status(500).json({ error: "Outlook OAuth not configured" });
  }

  const scopes = ["offline_access", "Mail.ReadWrite", "Mail.Send", "User.Read"].join(" ");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    response_mode: "query",
    state: userId || "",
  });

  res.redirect(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`);
}
