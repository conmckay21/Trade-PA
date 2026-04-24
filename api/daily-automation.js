// /api/daily-automation.js
// Vercel cron: runs daily at 8am UK time
// Handles: quote follow-ups, appointment reminders, review requests
// Each user with an email connection gets checked independently

import { withSentry } from "./lib/sentry.js";

async function handler(req, res) {
  // Accept both POST (manual trigger) and GET (Vercel cron)
  if (req.method !== "POST" && req.method !== "GET") return res.status(405).json({ error: "POST or GET only" });

  const SB_URL = process.env.VITE_SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
  const sbHeaders = { "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}`, "Content-Type": "application/json" };

  // Allow manual trigger for a specific user, or run for all users via cron
  const manualUserId = req.body?.userId || req.query?.userId || null;

  try {
    // Get all users with email connections (or just the one if manual)
    const connFilter = manualUserId ? `&user_id=eq.${manualUserId}` : "";
    const connRes = await fetch(`${SB_URL}/rest/v1/email_connections?select=user_id,provider,access_token,refresh_token,expires_at,email${connFilter}`, { headers: sbHeaders });
    const connections = await connRes.json();
    if (!connections?.length) return res.json({ success: true, message: "No email connections found", results: [] });

    const results = [];

    for (const conn of connections) {
      const userId = conn.user_id;
      const userResult = { userId, quoteFollowups: 0, appointmentReminders: 0, reviewRequests: 0, errors: [] };

      try {
        // Refresh token if needed
        let accessToken = conn.access_token;
        const isExpired = new Date(conn.expires_at) < new Date(Date.now() + 60000);
        if (isExpired) {
          const isGmail = conn.provider === "gmail";
          const tokenUrl = isGmail
            ? "https://oauth2.googleapis.com/token"
            : "https://login.microsoftonline.com/common/oauth2/v2.0/token";
          const body = isGmail
            ? new URLSearchParams({ client_id: process.env.GMAIL_CLIENT_ID, client_secret: process.env.GMAIL_CLIENT_SECRET, refresh_token: conn.refresh_token, grant_type: "refresh_token" })
            : new URLSearchParams({ client_id: process.env.OUTLOOK_CLIENT_ID, client_secret: process.env.OUTLOOK_CLIENT_SECRET, refresh_token: conn.refresh_token, grant_type: "refresh_token", scope: "offline_access Mail.ReadWrite Mail.Send User.Read" });
          const tRes = await fetch(tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
          const tokens = await tRes.json();
          if (!tokens.error) {
            accessToken = tokens.access_token;
            await fetch(`${SB_URL}/rest/v1/email_connections?user_id=eq.${userId}&provider=eq.${conn.provider}`, {
              method: "PATCH", headers: sbHeaders,
              body: JSON.stringify({ access_token: tokens.access_token, expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString() }),
            });
          } else {
            userResult.errors.push("Token refresh failed");
            results.push(userResult);
            continue;
          }
        }

        // Load user's brand settings
        const brandRes = await fetch(`${SB_URL}/rest/v1/companies?owner_id=eq.${userId}&select=*&limit=1`, { headers: sbHeaders });
        const brands = await brandRes.json();
        const brand = brands?.[0]?.settings || {};
        const tradingName = brand.tradingName || "";
        const phone = brand.phone || "";
        const email = brand.email || "";
        const accent = brand.accentColor || "#f59e0b";
        const sig = `Many thanks,<br>${tradingName}${phone ? `<br>${phone}` : ""}${email ? `<br>${email}` : ""}`;

        // Helper: send email via user's connected account
        async function sendEmail(to, subject, body) {
          const endpoint = conn.provider === "outlook"
            ? `${process.env.APP_URL}/api/outlook/send`
            : `${process.env.APP_URL}/api/gmail/send`;
          return fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, to, subject, body }),
          });
        }

        // ─── 1. QUOTE FOLLOW-UPS ────────────────────────────────────────
        // Quotes sent 3+ days ago, still in "sent" status, no follow-up sent yet
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
        const quotesRes = await fetch(
          `${SB_URL}/rest/v1/invoices?user_id=eq.${userId}&is_quote=eq.true&status=eq.sent&created_at=lt.${threeDaysAgo}&followup_sent=is.null&select=id,customer,amount,gross_amount,address,created_at`,
          { headers: sbHeaders }
        );
        const staleQuotes = await quotesRes.json();

        if (Array.isArray(staleQuotes)) {
          for (const q of staleQuotes.slice(0, 5)) {
            // Look up customer email
            const custRes = await fetch(
              `${SB_URL}/rest/v1/customers?user_id=eq.${userId}&name=ilike.*${encodeURIComponent(q.customer || "")}*&select=email,name&limit=1`,
              { headers: sbHeaders }
            );
            const custs = await custRes.json();
            const custEmail = custs?.[0]?.email;
            if (!custEmail) continue;

            const amt = parseFloat(q.gross_amount || q.amount || 0);
            const fmtAmt = "£" + amt.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const daysSent = Math.floor((Date.now() - new Date(q.created_at).getTime()) / 86400000);

            const body = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
              <div style="background:${accent};padding:24px 28px;border-radius:8px 8px 0 0;">
                <h2 style="color:#fff;margin:0;font-size:20px;">${tradingName}</h2>
                <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:4px;">QUOTE FOLLOW-UP</div>
              </div>
              <div style="padding:24px 28px;background:#fff;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px;">
                <p style="font-size:15px;">Hi ${q.customer},</p>
                <p style="color:#555;">I sent over a quote (${q.id}) for ${fmtAmt} a few days ago and just wanted to check if you had any questions or if you'd like to go ahead.</p>
                <p style="color:#555;">No pressure at all — just didn't want it to get lost in your inbox. If it's not the right time, that's absolutely fine.</p>
                <p style="color:#555;font-size:13px;">If you'd like to discuss anything or need any changes to the quote, just reply to this email.</p>
                <p style="margin-top:24px;">${sig}</p>
              </div>
            </div>`;

            try {
              await sendEmail(custEmail, `Following up on quote ${q.id} — ${tradingName}`, body);
              // Mark as followed up so we don't send again
              await fetch(`${SB_URL}/rest/v1/invoices?id=eq.${q.id}&user_id=eq.${userId}`, {
                method: "PATCH", headers: sbHeaders,
                body: JSON.stringify({ followup_sent: new Date().toISOString() }),
              });
              userResult.quoteFollowups++;
            } catch (e) { userResult.errors.push(`Quote followup failed for ${q.customer}: ${e.message}`); }
          }
        }

        // ─── 2. APPOINTMENT REMINDERS ───────────────────────────────────
        // Jobs scheduled for tomorrow, not completed/cancelled, no reminder sent
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().slice(0, 10); // YYYY-MM-DD

        const jobsRes = await fetch(
          `${SB_URL}/rest/v1/job_cards?user_id=eq.${userId}&status=neq.completed&status=neq.cancelled&reminder_sent=is.null&select=id,customer,address,type,title,date,date_obj&limit=20`,
          { headers: sbHeaders }
        );
        const upcomingJobs = await jobsRes.json();

        if (Array.isArray(upcomingJobs)) {
          for (const j of upcomingJobs) {
            // Check if job is tomorrow — match against date_obj or date string
            const jobDate = j.date_obj ? new Date(j.date_obj).toISOString().slice(0, 10) : null;
            const dateMatch = jobDate === tomorrowStr || (j.date || "").includes(tomorrowStr);
            if (!dateMatch) continue;

            // Look up customer email
            const custRes = await fetch(
              `${SB_URL}/rest/v1/customers?user_id=eq.${userId}&name=ilike.*${encodeURIComponent(j.customer || "")}*&select=email,name,phone&limit=1`,
              { headers: sbHeaders }
            );
            const custs = await custRes.json();
            const custEmail = custs?.[0]?.email;
            if (!custEmail) continue;

            const jobDesc = j.type || j.title || "your appointment";
            const addressLine = j.address ? `<p style="color:#555;">Address: <strong>${j.address}</strong></p>` : "";

            const body = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
              <div style="background:${accent};padding:24px 28px;border-radius:8px 8px 0 0;">
                <h2 style="color:#fff;margin:0;font-size:20px;">${tradingName}</h2>
                <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:4px;">APPOINTMENT REMINDER</div>
              </div>
              <div style="padding:24px 28px;background:#fff;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px;">
                <p style="font-size:15px;">Hi ${j.customer},</p>
                <p style="color:#555;">Just a quick reminder that we have ${jobDesc} booked in for <strong>tomorrow</strong>.</p>
                ${addressLine}
                <p style="color:#555;">If anything has changed or you need to rearrange, just reply to this email and we'll sort it out.</p>
                <p style="color:#555;font-size:13px;">Looking forward to seeing you.</p>
                <p style="margin-top:24px;">${sig}</p>
              </div>
            </div>`;

            try {
              await sendEmail(custEmail, `Reminder: ${jobDesc} tomorrow — ${tradingName}`, body);
              await fetch(`${SB_URL}/rest/v1/job_cards?id=eq.${j.id}&user_id=eq.${userId}`, {
                method: "PATCH", headers: sbHeaders,
                body: JSON.stringify({ reminder_sent: new Date().toISOString() }),
              });
              userResult.appointmentReminders++;
            } catch (e) { userResult.errors.push(`Reminder failed for ${j.customer}: ${e.message}`); }
          }
        }

        // ─── 3. AUTO REVIEW REQUESTS ────────────────────────────────────
        // Jobs completed 2+ days ago, no review request sent yet
        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

        // Load review platform URLs from brand
        const platforms = [];
        if (brand.googleReviewUrl) platforms.push({ name: "Google", url: brand.googleReviewUrl });
        if (brand.trustpilotUrl) platforms.push({ name: "Trustpilot", url: brand.trustpilotUrl });
        if (brand.checkatradeUrl) platforms.push({ name: "Checkatrade", url: brand.checkatradeUrl });
        if (brand.ratedPeopleUrl) platforms.push({ name: "Rated People", url: brand.ratedPeopleUrl });
        if (brand.myBuilderUrl) platforms.push({ name: "MyBuilder", url: brand.myBuilderUrl });

        if (platforms.length > 0) {
          const completedRes = await fetch(
            `${SB_URL}/rest/v1/job_cards?user_id=eq.${userId}&status=eq.completed&completion_date=lt.${twoDaysAgo}&review_requested=is.null&select=id,customer,type,title&limit=5`,
            { headers: sbHeaders }
          );
          const completedJobs = await completedRes.json();

          // Also check we haven't already sent a review request for this customer recently
          const recentReviewsRes = await fetch(
            `${SB_URL}/rest/v1/review_requests?user_id=eq.${userId}&sent_at=gt.${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()}&select=customer`,
            { headers: sbHeaders }
          );
          const recentReviews = await recentReviewsRes.json();
          const recentlyAsked = new Set((recentReviews || []).map(r => (r.customer || "").toLowerCase()));

          if (Array.isArray(completedJobs)) {
            for (const j of completedJobs) {
              if (recentlyAsked.has((j.customer || "").toLowerCase())) continue;

              const custRes = await fetch(
                `${SB_URL}/rest/v1/customers?user_id=eq.${userId}&name=ilike.*${encodeURIComponent(j.customer || "")}*&select=email,name&limit=1`,
                { headers: sbHeaders }
              );
              const custs = await custRes.json();
              const custEmail = custs?.[0]?.email;
              if (!custEmail) continue;

              const buttons = platforms.map(p =>
                `<a href="${p.url}" style="display:inline-block;padding:10px 20px;background:${accent};color:#000;text-decoration:none;border-radius:8px;font-weight:600;font-size:13px;margin:4px 4px 4px 0;">${p.name}</a>`
              ).join(" ");

              const body = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
                <div style="background:${accent};padding:24px 28px;border-radius:8px 8px 0 0;">
                  <h2 style="color:#fff;margin:0;font-size:20px;">${tradingName}</h2>
                  <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:4px;">WE'D LOVE YOUR FEEDBACK</div>
                </div>
                <div style="padding:24px 28px;background:#fff;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px;">
                  <p style="font-size:15px;">Hi ${j.customer},</p>
                  <p style="color:#555;">Thank you for choosing ${tradingName} — we really appreciate your business.</p>
                  <p style="color:#555;">If you're happy with the work, we'd be really grateful if you could take a moment to leave us a review. It makes a huge difference to small businesses like ours.</p>
                  <div style="margin:20px 0;">${buttons}</div>
                  <p style="color:#888;font-size:12px;">Thank you — it only takes a minute and helps other customers find us.</p>
                  <p style="margin-top:24px;">${sig}</p>
                </div>
              </div>`;

              try {
                await sendEmail(custEmail, `${tradingName} — we'd love your feedback`, body);
                // Mark job as review-requested
                await fetch(`${SB_URL}/rest/v1/job_cards?id=eq.${j.id}&user_id=eq.${userId}`, {
                  method: "PATCH", headers: sbHeaders,
                  body: JSON.stringify({ review_requested: new Date().toISOString() }),
                });
                // Log to review_requests table
                await fetch(`${SB_URL}/rest/v1/review_requests`, {
                  method: "POST", headers: { ...sbHeaders, "Prefer": "return=minimal" },
                  body: JSON.stringify({
                    user_id: userId, job_id: j.id, customer: j.customer, email: custEmail,
                    platforms: platforms.map(p => p.name).join(","),
                    sent_at: new Date().toISOString(), created_at: new Date().toISOString(),
                  }),
                });
                userResult.reviewRequests++;
              } catch (e) { userResult.errors.push(`Review request failed for ${j.customer}: ${e.message}`); }
            }
          }
        }

      } catch (e) {
        userResult.errors.push(e.message);
      }

      results.push(userResult);
    }

    const totals = {
      quoteFollowups: results.reduce((s, r) => s + r.quoteFollowups, 0),
      appointmentReminders: results.reduce((s, r) => s + r.appointmentReminders, 0),
      reviewRequests: results.reduce((s, r) => s + r.reviewRequests, 0),
    };

    return res.json({ success: true, usersProcessed: results.length, ...totals, results });
  } catch (err) {
    console.error("Daily automation error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}

export default withSentry(handler, { routeName: "daily-automation" });
