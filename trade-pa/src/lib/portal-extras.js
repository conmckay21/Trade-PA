// ─── Email portal CTA block ─────────────────────────────────────────────────
// Hoisted from App.jsx during P7 prelude (28 Apr 2026). Verbatim move —
// no behavioural changes. Used by AIAssistant (3 callers), CustomerForm and
// RAMSTab. Lives alongside lib/portal.js (which holds portalUrl); kept as a
// separate file to avoid touching the existing portal.js exports surface
// during the refactor. Can be merged in a later cleanup pass.
//
// Shared HTML for the "View & Pay Online" button that goes into outbound
// emails (initial send, AI send, chase). Wording adapts to quote vs invoice
// and whether Stripe is connected. Includes a plain-text URL fallback line
// below the button for email clients that block images / buttons, and for
// readability when customers forward or print the email.
//
// Call from any email body template:
//   const cta = portalCtaBlock({ token, isQuote, stripeReady, accent });
//   body: `<p>Dear ${name},</p><p>Please find your invoice attached.</p>${cta}...`
//
// Returns empty string if no token — renders nothing so templates don't
// need a conditional wrapper. Safe to interpolate unconditionally.
import { portalUrl } from "./portal.js";

export function portalCtaBlock({ token, isQuote, stripeReady, accent }) {
  if (!token) return "";
  const url = portalUrl(token);
  const label = isQuote
    ? "View &amp; Accept Online &rarr;"
    : stripeReady ? "View &amp; Pay Online &rarr;" : "View Online &rarr;";
  const subtext = isQuote
    ? "No login required &middot; one tap to accept"
    : stripeReady ? "No login required &middot; pay by card or bank transfer"
                  : "No login required &middot; view invoice and bank details";
  // tp-cta class lets buildEmailHTML's <style> block force the amber bg +
  // white text in dark-mode email clients. Inline !important on the anchor
  // is belt-and-braces for clients that strip <style> entirely (older
  // Outlook, some webmail readers).
  return `
      <p style="text-align:center;margin:20px 0 4px;">
        <a href="${url}" class="tp-cta" style="display:inline-block;background:${accent} !important;color:#ffffff !important;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;font-size:15px;letter-spacing:0.02em;">${label}</a>
      </p>
      <p style="text-align:center;color:#666 !important;font-size:12px;margin:0 0 10px;">${subtext}</p>
      <p style="text-align:center;color:#888 !important;font-size:11px;margin:0 0 20px;word-break:break-all;">Or paste this link into your browser:<br/><a href="${url}" style="color:#666 !important;text-decoration:underline;">${url}</a></p>`;
}
