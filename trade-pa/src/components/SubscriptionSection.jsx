// =============================================================
// SubscriptionSection.jsx
// =============================================================
// Drop in: ~/Trade-PA/trade-pa/src/components/SubscriptionSection.jsx
//
// Renders inside the existing Settings "Plan & billing" / "Account"
// tab. Shows current plan + status + dates, plus a single "Manage
// subscription" button that opens the Stripe Customer Portal where
// the user can:
//   - Update payment method
//   - Change plan (upgrade or downgrade)
//   - Cancel subscription
//   - View invoice history
//   - Resume a recently canceled sub (within Stripe's grace window)
//
// All purchasing/cancellation happens on Stripe's hosted page, off-app.
//
// iOS-aware:
//   - isIOSNative=true: minimal card, no plan name or pricing surface,
//     just "Manage at tradespa.co.uk" button that opens external browser.
//     App Store Guideline 3.1.3(b) safe.
//   - Web / Android: full info card with plan name, status, dates.
//     Button opens portal in same tab (web) or external browser (Android).
//
// Props:
//   user         {object}  current user (from auth)
//   planTier     {string}  current plan code (e.g. "solo", "business")
//   isIOSNative  {boolean} whether running inside iOS native app
//
// Endpoint used: POST /api/stripe/portal (already exists in repo)
// =============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/db.js';

const PLAN_NAMES = {
  solo: 'Solo',
  pro_solo: 'Pro Solo',
  team: 'Team',
  business: 'Business',
};

const STATUS_LABELS = {
  active: 'Active',
  trialing: 'Trialing',
  past_due: 'Payment failed',
  unpaid: 'Unpaid',
  canceled: 'Canceled',
  incomplete: 'Incomplete',
  incomplete_expired: 'Expired',
};

export default function SubscriptionSection({ user, planTier, isIOSNative }) {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [portalBusy, setPortalBusy] = useState(false);
  const [error, setError] = useState('');

  // -----------------------------------------------------------
  // Fetch current subscription row
  // -----------------------------------------------------------
  const fetchSub = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error: err } = await db
        .from('subscriptions')
        .select('plan, status, is_in_trial, trial_ends_at, current_period_end, user_limit, stripe_customer_id, stripe_subscription_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (err) {
        console.warn('[SubscriptionSection] fetch error:', err.message);
      }
      setSubscription(data || null);
    } catch (e) {
      console.warn('[SubscriptionSection] fetchSub threw:', e?.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchSub(); }, [fetchSub]);

  // -----------------------------------------------------------
  // Open Stripe Customer Portal
  // -----------------------------------------------------------
  const handleManage = useCallback(async () => {
    setError('');
    setPortalBusy(true);
    try {
      const { data: { session } } = await db.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError('Please sign out and back in, then try again.');
        setPortalBusy(false);
        return;
      }
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.url) {
        setError(json?.message || json?.error || 'Could not open portal. Email support@tradespa.co.uk if this keeps happening.');
        setPortalBusy(false);
        return;
      }
      const isNative = typeof window !== 'undefined'
        && window.Capacitor?.isNativePlatform?.();
      if (isNative && window.Capacitor?.Plugins?.Browser) {
        try {
          await window.Capacitor.Plugins.Browser.open({ url: json.url });
        } catch (_) {
          window.open(json.url, '_blank');
        }
        setPortalBusy(false);
      } else {
        // Web: redirect in same tab
        window.location.href = json.url;
      }
    } catch (e) {
      setError(e?.message || 'Network error. Please try again.');
      setPortalBusy(false);
    }
  }, []);

  // -----------------------------------------------------------
  // Render
  // -----------------------------------------------------------

  // iOS minimal version: no pricing or plan name shown
  if (isIOSNative) {
    return (
      <div style={styles.card}>
        <div style={styles.title}>Account</div>
        <div style={styles.body}>
          Manage your subscription, payment method, plan, invoices, or cancellation at tradespa.co.uk on the web.
        </div>
        <button
          onClick={handleManage}
          disabled={portalBusy}
          style={{ ...styles.btn, opacity: portalBusy ? 0.7 : 1 }}
        >
          {portalBusy ? 'Opening...' : 'Open tradespa.co.uk →'}
        </button>
        {error ? <div style={styles.error}>{error}</div> : null}
      </div>
    );
  }

  // Web / Android version: full info
  const plan = subscription?.plan || planTier || null;
  const planLabel = PLAN_NAMES[plan] || (plan ? plan : 'Unknown');
  const statusKey = subscription?.is_in_trial ? 'trialing' : subscription?.status;
  const statusLabel = STATUS_LABELS[statusKey] || statusKey || 'Unknown';
  const showTrialEnd = subscription?.is_in_trial && subscription?.trial_ends_at;
  const showNextBill = !subscription?.is_in_trial
    && subscription?.status === 'active'
    && subscription?.current_period_end;

  return (
    <div style={styles.card}>
      <div style={styles.title}>Subscription</div>
      {loading ? (
        <div style={styles.body}>Loading...</div>
      ) : (
        <>
          <div style={styles.rows}>
            <Row label="Plan" value={planLabel} />
            <Row label="Status" value={statusLabel} statusKey={statusKey} />
            {showTrialEnd ? (
              <Row label="Trial ends" value={formatDate(subscription.trial_ends_at)} />
            ) : null}
            {showNextBill ? (
              <Row label="Next bill" value={formatDate(subscription.current_period_end)} />
            ) : null}
          </div>
          <button
            onClick={handleManage}
            disabled={portalBusy}
            style={{ ...styles.btn, opacity: portalBusy ? 0.7 : 1 }}
          >
            {portalBusy ? 'Opening...' : 'Manage subscription →'}
          </button>
          <div style={styles.footnote}>
            Change plan, update payment method, view invoices, or cancel anytime.
          </div>
          {error ? <div style={styles.error}>{error}</div> : null}
        </>
      )}
    </div>
  );
}

// -----------------------------------------------------------
// Helpers
// -----------------------------------------------------------

function Row({ label, value, statusKey }) {
  const valueColor =
    statusKey === 'past_due' || statusKey === 'canceled' || statusKey === 'unpaid'
      ? '#fca5a5'
      : statusKey === 'trialing'
      ? '#fbbf24'
      : '#fff';
  return (
    <div style={styles.row}>
      <span style={styles.rowLabel}>{label}</span>
      <span style={{ ...styles.rowValue, color: valueColor }}>{value}</span>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(iso).slice(0, 10);
  }
}

// -----------------------------------------------------------
// Styles
// -----------------------------------------------------------
const styles = {
  card: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Plus Jakarta Sans', sans-serif",
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 12,
  },
  body: {
    color: '#d1d5db',
    fontSize: 13,
    lineHeight: 1.6,
    marginBottom: 14,
  },
  rows: {
    marginBottom: 16,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid #242424',
  },
  rowLabel: {
    color: '#9ca3af',
    fontSize: 13,
  },
  rowValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 500,
  },
  btn: {
    width: '100%',
    background: '#f59e0b',
    color: '#1a1a1a',
    border: 'none',
    borderRadius: 8,
    padding: '12px 16px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  footnote: {
    color: '#6b7280',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 1.5,
  },
  error: {
    background: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.35)',
    color: '#fca5a5',
    fontSize: 12,
    padding: '8px 12px',
    borderRadius: 6,
    marginTop: 10,
  },
};
