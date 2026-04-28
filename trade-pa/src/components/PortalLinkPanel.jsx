import { portalUrl } from "../lib/portal.js";

// ─── Portal link panel ──────────────────────────────────────────────────────
// Shared UI for the quote/invoice detail pages. Shows the customer portal
// URL with a copy button + context-appropriate explainer. Caller passes:
//   - token: portal token string (required — panel renders null if absent)
//   - isQuote: boolean — changes wording between accept/decline and payment
//   - stripeReady: boolean — when true, mentions card payment option in blurb
//   - colors: { muted, text, border, surfaceHigh } theme tokens
//   - styles: { input, btnGhost } shared input + button styles from parent
export function PortalLinkPanel({ token, isQuote, stripeReady, colors, styles }) {
  if (!token) return null;
  const url = portalUrl(token);
  const blurb = isQuote
    ? "Share this link — customer can view, accept or decline without signing up. You'll get a push when they open it AND when they respond. (Also auto-included as a button in your quote emails.)"
    : stripeReady
      ? "Share this link — customer can view the invoice and pay by card. You'll get a push when they open it AND when payment comes in. (Also auto-included as a button in your invoice emails.)"
      : "Share this link — customer can view the invoice and bank transfer details online. You'll get a push when they open it. (Also auto-included as a button in your invoice emails.) Connect Stripe in Settings → Integrations to accept card payments.";
  return (
    <div style={{ padding: "10px 14px", background: colors.surfaceHigh, borderRadius: 8 }}>
      <div style={{ fontSize: 10, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
        {isQuote ? "Customer Portal Link" : "Pay Online Link"}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          readOnly
          style={{ ...styles.input, fontFamily: "'DM Mono',monospace", fontSize: 11, flex: 1 }}
          value={url}
          onClick={e => e.target.select()}
        />
        <button
          onClick={() => {
            if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
          }}
          style={{ ...styles.btnGhost, fontSize: 11, flexShrink: 0 }}
        >Copy</button>
      </div>
      <div style={{ fontSize: 11, color: colors.muted, marginTop: 6, lineHeight: 1.5 }}>{blurb}</div>
    </div>
  );
}
