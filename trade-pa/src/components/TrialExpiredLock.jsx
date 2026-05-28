// =============================================================
// TrialExpiredLock.jsx
// =============================================================
// Drop in: ~/Trade-PA/trade-pa/src/components/TrialExpiredLock.jsx
//
// Full-screen lock for users whose trial has ended without a payment
// method. Renders instead of children when subscription status is
// canceled / incomplete_expired / unpaid / past_due.
//
// Behaviour:
//   - iOS native: neutral copy, "Continue at tradespa.co.uk", no plan
//     names, no prices, no "choose a plan" wording. Opens external
//     browser via Capacitor Browser plugin.
//   - Web / Android native: clearer "Choose a plan" wording with link
//     to /upgrade.html. Native opens external browser.
//   - Sign out button always available.
//   - Email support visible.
// =============================================================

import React, { useState } from 'react';

const LOCKED_STATUSES = new Set([
  'canceled',
  'incomplete_expired',
  'unpaid',
  'past_due',
]);

export default function TrialExpiredLock({ subscription, supabase, children }) {
  const [signingOut, setSigningOut] = useState(false);

  const status = subscription?.status;
  const shouldLock = !!subscription && LOCKED_STATUSES.has(status);

  if (!shouldLock) {
    return <>{children}</>;
  }

  const isNative = typeof window !== 'undefined'
    && window.Capacitor?.isNativePlatform?.();
  const platform = typeof window !== 'undefined'
    ? window.Capacitor?.getPlatform?.()
    : null;
  const isIOSNative = isNative && platform === 'ios';

  const handleContinue = async () => {
    const url = isIOSNative
      ? 'https://www.tradespa.co.uk/?settings=subscription'
      : 'https://www.tradespa.co.uk/upgrade.html';
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

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (_) {}
    window.location.replace(window.location.origin + '/?login=1');
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.brandRow}>
          <div style={styles.brandMark}>TP</div>
        </div>
        <div style={styles.title}>
          {isIOSNative
            ? 'Your trial has ended'
            : 'Your trial has ended'}
        </div>
        <div style={styles.body}>
          {isIOSNative
            ? 'Continue at tradespa.co.uk to keep using Trade PA. Your data is safe.'
            : 'Pick a plan to keep using Trade PA. Your data is safe and ready when you come back.'}
        </div>
        <button onClick={handleContinue} style={styles.ctaPrimary}>
          {isIOSNative ? 'Open tradespa.co.uk →' : 'Choose a plan →'}
        </button>
        <button onClick={handleSignOut} disabled={signingOut} style={styles.ctaSecondary}>
          {signingOut ? 'Signing out...' : 'Sign out'}
        </button>
        <div style={styles.footnote}>
          Need help? Email{' '}
          <a href="mailto:support@tradespa.co.uk" style={styles.link}>
            support@tradespa.co.uk
          </a>
          {!isIOSNative ? (
            <>
              <br />
              <span style={styles.dataNote}>Data held for 90 days after trial end.</span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(10, 10, 10, 0.96)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 20,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Plus Jakarta Sans', sans-serif",
  },
  modal: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 16,
    padding: '36px 28px 28px',
    maxWidth: 420,
    width: '100%',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
    textAlign: 'center',
  },
  brandRow: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 20,
  },
  brandMark: {
    width: 56,
    height: 56,
    borderRadius: 14,
    background: '#f59e0b',
    color: '#0a0a0a',
    fontWeight: 700,
    fontSize: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    letterSpacing: 0.5,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 10,
  },
  body: {
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 1.6,
    marginBottom: 24,
  },
  ctaPrimary: {
    width: '100%',
    background: '#f59e0b',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: 8,
    padding: '14px 16px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    marginBottom: 10,
    fontFamily: 'inherit',
  },
  ctaSecondary: {
    width: '100%',
    background: 'transparent',
    color: '#9ca3af',
    border: '1px solid #2a2a2a',
    borderRadius: 8,
    padding: '12px 16px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    marginBottom: 20,
    fontFamily: 'inherit',
  },
  footnote: {
    color: '#6b7280',
    fontSize: 11,
    lineHeight: 1.7,
  },
  link: {
    color: '#f59e0b',
    textDecoration: 'none',
  },
  dataNote: {
    color: '#4b5563',
    fontSize: 10,
  },
};
