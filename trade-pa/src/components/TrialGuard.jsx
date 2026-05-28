// =============================================================
// TrialGuard.jsx
// =============================================================
// Drop in: ~/Trade-PA/trade-pa/src/components/TrialGuard.jsx
//
// Wraps AppInner. Fetches the user's subscription on mount and on
// app foreground (Capacitor native). Decides whether to render:
//   - Nothing extra (default)
//   - <TrialBanner> above children (≤5 days left in trial)
//   - <TrialExpiredLock> instead of children (status canceled/etc.)
//
// Integration in App.jsx (one-line wrap around <AppInner />):
//   <TrialGuard supabase={db}>
//     <AppInner />
//   </TrialGuard>
//
// Self-contained data fetching to avoid coupling with App.jsx state.
// =============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import TrialBanner from './TrialBanner';
import TrialExpiredLock from './TrialExpiredLock';

export default function TrialGuard({ supabase, children }) {
  const [subscription, setSubscription] = useState(null);
  const [hasPaymentMethod, setHasPaymentMethod] = useState(null);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const fetchingRef = useRef(false);

  // -----------------------------------------------------------
  // Fetch subscription row from Supabase
  // -----------------------------------------------------------
  const fetchSubscription = useCallback(async () => {
    if (!supabase) return;
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSubscription(null);
        return;
      }
      const { data, error } = await supabase
        .from('subscriptions')
        .select('plan, status, is_in_trial, trial_ends_at, stripe_subscription_id, stripe_customer_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.warn('[TrialGuard] fetch error:', error.message);
      }
      setSubscription(data || null);

      // If trialing, fetch payment-method status to know whether to show banner
      if (data && (data.is_in_trial || data.status === 'trialing') && data.trial_ends_at) {
        await fetchPaymentMethodStatus(data, user);
      } else {
        setHasPaymentMethod(null);
      }
    } catch (e) {
      console.warn('[TrialGuard] fetchSubscription threw:', e?.message);
    } finally {
      fetchingRef.current = false;
      setLoadedOnce(true);
    }
  }, [supabase]);

  // -----------------------------------------------------------
  // Check payment method via our endpoint (server-side Stripe call).
  // Only called when user is trialing and ≤5 days left, to avoid
  // unnecessary Stripe API calls.
  // -----------------------------------------------------------
  const fetchPaymentMethodStatus = useCallback(async (sub, user) => {
    if (!sub?.trial_ends_at) return;
    const trialEnd = new Date(sub.trial_ends_at);
    const daysLeft = (trialEnd - new Date()) / (1000 * 60 * 60 * 24);
    if (daysLeft >= 5 || daysLeft <= 0) {
      setHasPaymentMethod(null);
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch('/api/trial/payment-method-status', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        // Endpoint missing or errored: default to showing the banner
        setHasPaymentMethod(false);
        return;
      }
      const json = await res.json().catch(() => ({}));
      setHasPaymentMethod(!!json?.has_payment_method);
    } catch (_) {
      setHasPaymentMethod(false);
    }
  }, [supabase]);

  // -----------------------------------------------------------
  // Initial fetch + on auth state change
  // -----------------------------------------------------------
  useEffect(() => {
    fetchSubscription();
    if (!supabase) return undefined;
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      fetchSubscription();
    });
    return () => {
      try { sub?.subscription?.unsubscribe?.(); } catch (_) {}
    };
  }, [supabase, fetchSubscription]);

  // -----------------------------------------------------------
  // Capacitor: refetch when the native app comes back to foreground.
  // Important so that after a user adds a card on the website and
  // returns to the app, the lock or banner clears without needing
  // a manual refresh.
  // -----------------------------------------------------------
  useEffect(() => {
    const isNative = typeof window !== 'undefined'
      && window.Capacitor?.isNativePlatform?.();
    if (!isNative) return undefined;
    let removeListener = null;
    (async () => {
      try {
        const App = window.Capacitor?.Plugins?.App;
        if (!App) return;
        const handle = await App.addListener('appStateChange', (state) => {
          if (state && state.isActive) {
            fetchSubscription();
          }
        });
        removeListener = () => { try { handle.remove(); } catch (_) {} };
      } catch (_) {}
    })();
    return () => { if (removeListener) removeListener(); };
  }, [fetchSubscription]);

  // -----------------------------------------------------------
  // Render
  // -----------------------------------------------------------
  // While loading first time, just render children to avoid flash
  if (!loadedOnce) {
    return <>{children}</>;
  }

  return (
    <TrialExpiredLock subscription={subscription} supabase={supabase}>
      <TrialBanner subscription={subscription} hasPaymentMethod={hasPaymentMethod} />
      {children}
    </TrialExpiredLock>
  );
}
