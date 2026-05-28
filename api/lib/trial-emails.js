// api/lib/trial-emails.js
//
// Three branded email templates for the trial flow, sent by the daily
// cron at /api/cron/check-trial-status. Pattern matches the auth email
// templates (dark header, amber TP brand mark, Companies Act footer).
//
// Exports:
//   fiveDayReminderHtml(name)   + fiveDayReminderSubject
//   oneDayReminderHtml(name)    + oneDayReminderSubject
//   trialExpiredHtml(name)      + trialExpiredSubject
//   ACCOUNT_URL constant
//
// All CTAs point to https://www.tradespa.co.uk/?settings=subscription
// which deep-links into the Plan & billing tab (handled by App.jsx).

const ACCOUNT_URL = "https://www.tradespa.co.uk/?settings=subscription";

const COMPANY_FOOTER = `
  <tr>
    <td style="padding: 24px 32px 32px; background: #ffffff; border-top: 1px solid #e5e5e5;">
      <p style="margin: 0 0 8px; color: #666; font-size: 11px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        Trade PA is a product of TRADEPA LTD. Registered in England and Wales, company number 17176983.
      </p>
      <p style="margin: 0; color: #999; font-size: 11px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        Registered office: 40 Blakemere Crescent, Portsmouth, PO6 3SG. ICO registration ZC132378.
      </p>
    </td>
  </tr>
`;

function wrap({ heading, body, ctaText, ctaUrl }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #f5f5f5; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 560px; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
          <tr>
            <td style="background: #0a0a0a; padding: 32px; text-align: center;">
              <div style="display: inline-block; width: 48px; height: 48px; background: #f59e0b; border-radius: 10px; line-height: 48px; color: #0a0a0a; font-size: 18px; font-weight: 700; letter-spacing: 0.5px;">TP</div>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 32px 16px;">
              <h1 style="margin: 0 0 16px; color: #0a0a0a; font-size: 22px; font-weight: 700; line-height: 1.3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${heading}</h1>
              ${body}
              ${ctaText && ctaUrl ? `
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 24px 0 8px;">
                <tr>
                  <td align="center" bgcolor="#f59e0b" style="border-radius: 8px;">
                    <a href="${ctaUrl}" style="display: inline-block; padding: 14px 28px; color: #0a0a0a; text-decoration: none; font-weight: 700; font-size: 15px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${ctaText}</a>
                  </td>
                </tr>
              </table>
              ` : ""}
            </td>
          </tr>
          ${COMPANY_FOOTER}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function firstName(name) {
  if (!name) return "there";
  return esc(String(name).split(" ")[0]);
}

// ---------- 5-day reminder ----------
const fiveDayReminderSubject = "5 days left in your Trade PA trial";

function fiveDayReminderHtml(name) {
  return wrap({
    heading: `Hi ${firstName(name)}, 5 days to go.`,
    body: `
      <p style="margin: 0 0 16px; color: #333; font-size: 15px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        Your Trade PA trial ends in 5 days. To keep using the app without interruption, add a payment method to your account.
      </p>
      <p style="margin: 0 0 8px; color: #333; font-size: 15px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        It takes about 30 seconds. You can cancel anytime.
      </p>
    `,
    ctaText: "Add payment method",
    ctaUrl: ACCOUNT_URL,
  });
}

// ---------- 1-day reminder ----------
const oneDayReminderSubject = "Your Trade PA trial ends tomorrow";

function oneDayReminderHtml(name) {
  return wrap({
    heading: `${firstName(name)}, your trial ends tomorrow.`,
    body: `
      <p style="margin: 0 0 16px; color: #333; font-size: 15px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        This is the last reminder before your Trade PA trial ends. To keep your account active and your data accessible, add a payment method today.
      </p>
      <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        If you do nothing, your account will be paused and you will lose access to your customers, jobs, and invoices.
      </p>
    `,
    ctaText: "Add payment method now",
    ctaUrl: ACCOUNT_URL,
  });
}

// ---------- Expired ----------
const trialExpiredSubject = "Your Trade PA trial has ended";

function trialExpiredHtml(name) {
  return wrap({
    heading: `${firstName(name)}, your trial has ended.`,
    body: `
      <p style="margin: 0 0 16px; color: #333; font-size: 15px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        Your Trade PA trial has ended. Your account is paused, but your data is safe and waiting for you.
      </p>
      <p style="margin: 0 0 16px; color: #333; font-size: 15px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        Pick a plan to pick up where you left off. All your customers, jobs, and invoices come back the moment you reactivate.
      </p>
      <p style="margin: 0; color: #999; font-size: 13px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        We hold your data for 90 days after trial end. After that it is deleted permanently.
      </p>
    `,
    ctaText: "Choose a plan",
    ctaUrl: "https://www.tradespa.co.uk/upgrade.html",
  });
}

module.exports = {
  ACCOUNT_URL,
  fiveDayReminderSubject,
  fiveDayReminderHtml,
  oneDayReminderSubject,
  oneDayReminderHtml,
  trialExpiredSubject,
  trialExpiredHtml,
};
