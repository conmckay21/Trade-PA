// =============================================================
// TrialBanner.jsx
// =============================================================
// Drop in: ~/Trade-PA/trade-pa/src/components/TrialBanner.jsx
//
// Renders a slim amber banner at the top of the app when the user
// has 5 or fewer days left on their trial.
//
// Behaviour:
//   - Renders nothing for users with no trial, >5 days left, or
//     not in a trialing state.
//   - 2-5 days left: dismissible amber banner.
//   - <2 days left: sticky non-dismissible amber banner.
//   - iOS native: neutral wording, no plan/price mentions. CTA opens
//     external browser to tradespa.co.uk/?settings=subscription.
//   - Web / Android native: same CTA, slightly more direct wording.
//
// Receives subscription as a prop from TrialGuard to avoid duplicate
// data fetching.
// =============================================================

import React, { useState, useEffect } from 'react';

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DISMISS_KEY_PREFIX = 'tpa_trial_banner_dismissed_';

export default function TrialBanner({ subscription, hasPaymentMethod }) {
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed state when we enter a new day
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const today = new Date().toISOString().slice(0, 10);
    const key = DISMISS_KEY_PREFIX + today;
    if (window.sessionStorage?.getItem(key) === '1') {
      setDismissed(true);
    }
  }, []);

  // Don't render if not in trial or no trial_ends_at
  if (!subscription) return null;
  const status = subscription.status;
  const isTrialing = subscription.is_in_trial || status === 'trialing';
  if (!isTrialing) return null;
  if (!subscription.trial_ends_at) return null;

  const trialEnd = new Date(subscription.trial_ends_at);
  const now = new Date();
  const daysLeft = (trialEnd - now) / MS_PER_DAY;

  // Hide if trial isn't ending soon, or already expired (lock handles that)
  if (daysLeft >= 5) return null;
  if (daysLeft <= 0) return null;

  // Hide if user has a payment method attached - Stripe will charge them
  // automatically, no need to nag.
  if (hasPaymentMethod === true) return null;

  const isFinalDay = daysLeft < 2;

  // Dismiss logic: 2-5 days, dismissible. Below 2, sticky.
  if (dismissed && !isFinalDay) return null;

  const isNative = typeof window !== 'undefined'
    && window.Capacitor?.isNativePlatform?.();
  const platform = typeof window !== 'undefined'
    ? window.Capacitor?.getPlatform?.()
    : null;
  const isIOSNative = isNative && platform === 'ios';

  const daysLabel = Math.max(1, Math.ceil(daysLeft));
  const daysWord = daysLabel === 1 ? 'day' : 'days';

  // Compose copy. iOS gets neutral text without "Add payment method" wording.
  const message = isIOSNative
    ? `${daysLabel} ${daysWord} left in your trial. Continue at tradespa.co.uk.`
    : `${daysLabel} ${daysWord} left in your trial. Add payment method to keep going.`;
  const ctaLabel = isIOSNative ? 'Open' : (isFinalDay ? 'Add payment' : 'Add payment →');

  const handleCta = async () => {
    const url = 'https://www.tradespa.co.uk/?settings=subscription';
    if (isNative && window.Capacitor?.Plugins?.Browser) {
      try {
        await window.Capacitor.Plugins.Browser.open({ url });
        return;
      } catch (_) {}
    }
    if (isNative) {
      window.open(url, '_blank');
    } else {
      window.location.href = url;
    }
  };

  const handleDismiss = () => {
    if (typeof window === 'undefined') return;
    const today = new Date().toISOString().slice(0, 10);
    const key = DISMISS_KEY_PREFIX + today;
    try { window.sessionStorage?.setItem(key, '1'); } catch (_) {}
    setDismissed(true);
  };

  return (
    <div style={isFinalDay ? styles.barFinal : styles.bar}>
      <div style={styles.message}>{message}</div>
      <div style={styles.actions}>
        <button onClick={handleCta} style={styles.cta}>{ctaLabel}</button>
        {!isFinalDay ? (
          <button onClick={handleDismiss} style={styles.dismiss} aria-label="Dismiss">×</button>
        ) : null}
      </div>
    </div>
  );
}

const styles = {
  bar: {
    width: '100%',
    background: 'rgba(245, 158, 11, 0.12)',
    borderBottom: '1px solid rgba(245, 158, 11, 0.35)',
    color: '#fff',
    padding: '8px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Plus Jakarta Sans', sans-serif",
    fontSize: 13,
    flexWrap: 'wrap',
  },
  barFinal: {
    width: '100%',
    background: '#f59e0b',
    color: '#0a0a0a',
    padding: '10px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Plus Jakarta Sans', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    flexWrap: 'wrap',
  },
  message: {
    flex: '1 1 auto',
    minWidth: 0,
    lineHeight: 1.45,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  cta: {
    background: '#f59e0b',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: 6,
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  dismiss: {
    background: 'transparent',
    color: 'inherit',
    border: 'none',
    fontSize: 18,
    fontWeight: 400,
    cursor: 'pointer',
    padding: '0 4px',
    opacity: 0.6,
    lineHeight: 1,
  },
};
