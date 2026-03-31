const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function getValidToken(userId) {
  const { data, error } = await supabase
    .from("email_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "gmail")
    .single();

  if (error || !data) throw new Error("No Gmail connection found");

  const isExpired = new Date(data.expires_at) < new Date(Date.now() + 60000);
  if (!isExpired) return data.access_token;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    he
