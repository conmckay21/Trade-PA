// api/reminders/action.js
// Handles clicks on action buttons in reminder emails.
//
// URLs:
//   /api/reminders/action?r=<reminder_uuid>&u=<user_uuid>&a=done
//   /api/reminders/action?r=<reminder_uuid>&u=<user_uuid>&a=snooze
//
// Security: requires both reminder_id AND user_id to match on the reminder row.
// 2 × UUIDv4 = 2^256 entropy, effectively unguessable. No HMAC needed.
//
// Returns a friendly HTML confirmation page with a link back to the app.

import { createClient } from "@supabase/supabase-js";

const APP_URL = process.env.APP_URL || "https://tradespa.co.uk";
const SNOOZE_MS = 60 * 60 * 1000; // 1 hour

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  const { r: reminderId, u: userId, a: action } = req.query;

  if (!reminderId || !userId || !action) {
    return sendHtml(res, 400, errorPage("This link is missing information."));
  }
  if (!UUID_RE.test(reminderId) || !UUID_RE.test(userId)) {
    return sendHtml(res, 400, errorPage("This link is malformed."));
  }
  if (!["done", "snooze"].includes(action)) {
    return sendHtml(res, 400, errorPage("Unknown action."));
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("[reminder-action] Supabase not configured");
    return sendHtml(res, 500, errorPage("Server error. Please contact support."));
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // Fetch reminder, verify both reminder_id AND user_id match
    const { data: reminder, error: fErr } = await supabase
      .from("reminders")
      .select("id, user_id, text, done, fire_at")
      .eq("id", reminderId)
      .eq("user_id", userId)
      .maybeSingle();

    if (fErr) {
      console.error("[reminder-action] fetch error:", fErr.message);
      return sendHtml(res, 500, errorPage("Something went wrong. Please try again."));
    }
    if (!reminder) {
      return sendHtml(res, 404, errorPage("Reminder not found. It may have been deleted."));
    }

    if (reminder.done && action === "done") {
      return sendHtml(
        res,
        200,
        successPage("Already marked done", reminder.text, "No changes needed.")
      );
    }

    if (action === "done") {
      const { error: uErr } = await supabase
        .from("reminders")
        .update({ done: true })
        .eq("id", reminderId);
      if (uErr) {
        console.error("[reminder-action] mark done error:", uErr.message);
        return sendHtml(res, 500, errorPage("Could not mark this done. Please try again."));
      }
      return sendHtml(
        res,
        200,
        successPage("Marked as done ✓", reminder.text, "Nice — one less thing on your list.")
      );
    }

    if (action === "snooze") {
      const newFireAt = new Date(Date.now() + SNOOZE_MS).toISOString();
      const { error: uErr } = await supabase
        .from("reminders")
        .update({ fire_at: newFireAt, fired: false })
        .eq("id", reminderId);
      if (uErr) {
        console.error("[reminder-action] snooze error:", uErr.message);
        return sendHtml(res, 500, errorPage("Could not snooze this. Please try again."));
      }
      const newTimeStr = new Date(newFireAt).toLocaleTimeString("en-GB", {
        hour: "numeric",
        minute: "2-digit",
        hour12: false,
        timeZone: "Europe/London",
      });
      return sendHtml(
        res,
        200,
        successPage(
          "Snoozed 1 hour",
          reminder.text,
          `We'll remind you again around ${newTimeStr}.`
        )
      );
    }
  } catch (err) {
    console.error("[reminder-action] fatal:", err.message);
    return sendHtml(res, 500, errorPage("Something went wrong. Please try again."));
  }
}

// ---- Response helpers ------------------------------------------------------
function sendHtml(res, status, html) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).send(html);
}

function successPage(heading, reminderText, subtitle) {
  return page(`
    <div style="font-size:56px;line-height:1;margin:0 0 12px;color:#34c759;">✓</div>
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:600;color:#1d1d1f;">${escapeHtml(heading)}</h1>
    <p style="margin:0 0 24px;color:#86868b;font-size:15px;line-height:1.5;">${escapeHtml(subtitle)}</p>
    <div style="padding:16px 20px;background:#f5f5f7;border-radius:10px;margin:0 0 28px;text-align:left;">
      <div style="font-size:12px;color:#86868b;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Reminder</div>
      <div style="font-size:15px;color:#1d1d1f;line-height:1.5;">${escapeHtml(reminderText)}</div>
    </div>
    <a href="${APP_URL}" style="display:inline-block;padding:12px 28px;background:#0066ff;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Open Trade PA</a>
  `);
}

function errorPage(message) {
  return page(`
    <div style="font-size:56px;line-height:1;margin:0 0 12px;color:#ff3b30;">✗</div>
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:600;color:#1d1d1f;">Something went wrong</h1>
    <p style="margin:0 0 28px;color:#86868b;font-size:15px;line-height:1.5;">${escapeHtml(message)}</p>
    <a href="${APP_URL}" style="display:inline-block;padding:12px 28px;background:#0066ff;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Open Trade PA</a>
  `);
}

function page(innerHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Trade PA</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1d1d1f;min-height:100vh;">
<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;box-sizing:border-box;">
<div style="max-width:440px;width:100%;padding:48px 32px;text-align:center;background:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.04);">
<div style="font-size:20px;font-weight:700;color:#0066ff;margin:0 0 32px;letter-spacing:-0.3px;">Trade PA</div>
${innerHtml}
</div>
</div>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
