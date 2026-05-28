// supabase/functions/notify-new-signup/index.ts
// Triggered by the tr_notify_new_signup Postgres trigger on subscriptions INSERT.
// Fetches user + promo info and sends Connor an email via Resend.
//
// Security: requires x-internal-secret header matching INTERNAL_WEBHOOK_SECRET.
// This is shared with the SQL trigger function. verify_jwt is off because the
// trigger doesn't have a real JWT — we use the shared secret instead.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const INTERNAL_SECRET = "tpa_signup_webhook_8f3a2e7d4b1c6e9d5b9a2c7f4e1d8a5b";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const PLAN_LABELS: Record<string, string> = {
  solo: "Solo", solo_monthly: "Solo",
  pro_solo: "Pro Solo", pro_solo_monthly: "Pro Solo",
  team: "Team", team_monthly: "Team",
  business: "Business", business_monthly: "Business",
};

function escapeHtml(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (req.headers.get("x-internal-secret") !== INTERNAL_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY env var not set on Edge Function");
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: { user_id?: string } = {};
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userId = payload?.user_id;
  if (!userId) {
    return new Response(JSON.stringify({ ok: true, ignored: "no user_id" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Give the promo redemption a moment to land — signup flow is
  // (1) auth.users -> (2) subscriptions [we're here] -> (3) optional promo.
  await new Promise((r) => setTimeout(r, 2000));

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await sb.auth.admin.getUserById(userId);
  if (userErr || !userData?.user) {
    console.error("User not found:", userErr?.message);
    return new Response(JSON.stringify({ ok: true, ignored: "user not found" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  const user = userData.user;
  const meta = (user.user_metadata || {}) as Record<string, string>;

  const { data: subData } = await sb.from("subscriptions")
    .select("plan, trial_ends_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: promoData } = await sb.from("promo_redemptions")
    .select("code_used, bonus_days_granted")
    .eq("user_id", userId)
    .maybeSingle();

  const firstName = (meta.first_name || "").trim();
  const lastName = (meta.last_name || "").trim();
  const fullName = `${firstName} ${lastName}`.trim() || "A new user";
  const businessName = meta.business_name || "Unknown business";
  const trade = meta.trade_type || "Not specified";
  const planLabel = PLAN_LABELS[subData?.plan ?? ""] || subData?.plan || "Trial";
  const trialEnd = subData?.trial_ends_at
    ? new Date(subData.trial_ends_at).toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric",
      })
    : "Unknown";
  const promoLine = promoData
    ? `<strong style="color:#f59e0b;">${escapeHtml(promoData.code_used)}</strong> &nbsp;<span style="color:#888;">(+${promoData.bonus_days_granted} days)</span>`
    : `<span style="color:#888;">None</span>`;

  const signedUpAt = new Date().toLocaleString("en-GB", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London",
  });
  const subject = `\u{1F389} New Trade PA signup \u2014 ${businessName}`;

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:540px;margin:0 auto;color:#0f0f0f;line-height:1.6;padding:20px;">
  <h1 style="font-size:22px;margin:0 0 4px;">${escapeHtml(fullName)} just signed up.</h1>
  <p style="font-size:13px;color:#888;margin:0 0 24px;">${signedUpAt}</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tr><td style="padding:8px 0;color:#888;width:130px;vertical-align:top;">Business</td><td style="padding:8px 0;"><strong>${escapeHtml(businessName)}</strong></td></tr>
    <tr><td style="padding:8px 0;color:#888;vertical-align:top;">Trade</td><td style="padding:8px 0;">${escapeHtml(trade)}</td></tr>
    <tr><td style="padding:8px 0;color:#888;vertical-align:top;">Email</td><td style="padding:8px 0;"><a href="mailto:${encodeURIComponent(user.email ?? "")}" style="color:#f59e0b;text-decoration:none;"><strong>${escapeHtml(user.email)}</strong></a></td></tr>
    <tr><td style="padding:8px 0;color:#888;vertical-align:top;">Plan</td><td style="padding:8px 0;">${escapeHtml(planLabel)}</td></tr>
    <tr><td style="padding:8px 0;color:#888;vertical-align:top;">Trial ends</td><td style="padding:8px 0;">${trialEnd}</td></tr>
    <tr><td style="padding:8px 0;color:#888;vertical-align:top;">Promo code</td><td style="padding:8px 0;">${promoLine}</td></tr>
  </table>
  <div style="margin:28px 0 16px;padding:14px 16px;background:#fef3c7;border-left:3px solid #f59e0b;border-radius:4px;font-size:13px;color:#78350f;line-height:1.5;">
    <strong>Reach out today.</strong> At this stage of launch every signup is worth a personal hello. Reply directly \u2014 it'll go to <strong>${escapeHtml(user.email)}</strong>.
  </div>
</div>`;

  try {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Trade PA <noreply@tradespa.co.uk>",
        to: ["connor@tradespa.co.uk"],
        reply_to: user.email,
        subject,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text().catch(() => "");
      console.error(`Resend API ${resendRes.status}:`, errText.slice(0, 500));
      return new Response(JSON.stringify({ error: "Email send failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("Resend call failed:", (err as Error).message);
    return new Response(JSON.stringify({ error: "Email send failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, sent: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
