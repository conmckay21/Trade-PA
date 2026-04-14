// ============================================================================
// OnboardingChecklist.jsx
// ----------------------------------------------------------------------------
// Drop-in onboarding checklist for Trade PA.
//
// Features
//  - 7 steps, each linked to a tab/action in the app.
//  - Auto-detects completion of 5 steps via Supabase counts (customers, jobs,
//    materials, labour, invoices). The remaining 2 steps (voice_used, ai_used)
//    are flagged from the app — call markOnboardingFlag('voice_used') the
//    first time a user successfully uses voice fill, and markOnboardingFlag(
//    'ai_used') the first time the AI assistant runs a tool.
//  - Persists a `dismissed` flag per user. Re-openable from the Help Centre.
//  - Reuses the existing `jobsRefreshKey` pattern: pass `refreshKey` so the
//    checklist re-checks counts after the AI creates anything.
//
// Wiring
//  1. Run onboarding_schema.sql in Supabase.
//  2. Import: `import OnboardingChecklist, { markOnboardingFlag } from './OnboardingChecklist';`
//  3. Render inside the Jobs tab (or wherever your home view lives):
//       <OnboardingChecklist
//         supabase={supabase}
//         user={user}
//         refreshKey={jobsRefreshKey}
//         onNavigate={(tab) => setActiveTab(tab)}
//         onOpenHelp={(slug) => openHelp(slug)}
//       />
//  4. In your voice handler, after a successful transcription:
//       markOnboardingFlag(supabase, user.id, 'voice_used');
//  5. In your AI tool executor, after the first successful tool call:
//       markOnboardingFlag(supabase, user.id, 'ai_used');
// ============================================================================

import React, { useEffect, useState, useCallback } from 'react';

// ---------- step definitions ----------
// `detect` is called with the supabase client and user id; returns boolean.
// `flag` steps just read the boolean column from user_onboarding.
const STEPS = [
  {
    key: 'customer',
    title: 'Add your first customer',
    blurb: 'Tap the mic on the customer form and just say their name, number and address.',
    cta: 'Add customer',
    tab: 'customers',
    helpSlug: 'add-customer',
    detect: async (sb, uid) => {
      const { count } = await sb.from('customers').select('*', { count: 'exact', head: true }).eq('user_id', uid);
      return (count ?? 0) > 0;
    },
  },
  {
    key: 'job',
    title: 'Create your first job',
    blurb: 'Every quote, visit and photo lives on the job card. One card per job.',
    cta: 'Create job',
    tab: 'jobs',
    helpSlug: 'create-job',
    detect: async (sb, uid) => {
      const { count } = await sb.from('jobs').select('*', { count: 'exact', head: true }).eq('user_id', uid);
      return (count ?? 0) > 0;
    },
  },
  {
    key: 'materials',
    title: 'Add materials to a job',
    blurb: 'Voice-fill them at the merchant. They pull through to the invoice automatically.',
    cta: 'Open materials',
    tab: 'materials',
    helpSlug: 'add-materials',
    detect: async (sb, uid) => {
      const { count } = await sb.from('materials').select('*', { count: 'exact', head: true }).eq('user_id', uid);
      return (count ?? 0) > 0;
    },
  },
  {
    key: 'labour',
    title: 'Log labour to a job',
    blurb: 'Days, hours, who did the work. Auto-totals to the invoice.',
    cta: 'Log labour',
    tab: 'labour',
    helpSlug: 'log-labour',
    detect: async (sb, uid) => {
      const { count } = await sb.from('time_logs').select('*', { count: 'exact', head: true }).eq('user_id', uid);
      return (count ?? 0) > 0;
    },
  },
  {
    key: 'voice_used',
    title: 'Try voice fill',
    blurb: 'Tap any mic icon. Speak naturally — it understands UK accents.',
    cta: 'Show me where',
    tab: 'customers',
    helpSlug: 'voice-fill',
    flag: 'voice_used',
  },
  {
    key: 'ai_used',
    title: 'Try the AI assistant',
    blurb: 'Tell it to "create a job for Mrs Patel, second-fix kitchen, two days". Watch it build.',
    cta: 'Open assistant',
    tab: 'assistant',
    helpSlug: 'ai-assistant',
    flag: 'ai_used',
  },
  {
    key: 'invoice',
    title: 'Send your first invoice',
    blurb: 'One tap. Materials and labour pull through. Add a Stripe pay-now link.',
    cta: 'Send invoice',
    tab: 'invoices',
    helpSlug: 'send-invoice',
    detect: async (sb, uid) => {
      const { count } = await sb.from('invoices').select('*', { count: 'exact', head: true }).eq('user_id', uid);
      return (count ?? 0) > 0;
    },
  },
];

// ---------- exported helper for app code ----------
export async function markOnboardingFlag(supabase, userId, flag) {
  if (!supabase || !userId) return;
  if (!['voice_used', 'ai_used'].includes(flag)) return;
  // upsert so the row is created on first call
  await supabase
    .from('user_onboarding')
    .upsert({ user_id: userId, [flag]: true }, { onConflict: 'user_id' });
}

// ---------- component ----------
export default function OnboardingChecklist({
  supabase,
  user,
  refreshKey = 0,
  onNavigate = () => {},
  onOpenHelp = () => {},
  forceOpen = false, // pass true when re-opened from Help Centre
}) {
  const [completed, setCompleted] = useState({}); // { stepKey: true }
  const [flags, setFlags] = useState({ voice_used: false, ai_used: false, dismissed: false });
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  const userId = user?.id;

  const refresh = useCallback(async () => {
    if (!supabase || !userId) return;
    setLoading(true);

    // Ensure a row exists, then fetch flags
    await supabase.from('user_onboarding').upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
    const { data: row } = await supabase
      .from('user_onboarding')
      .select('voice_used, ai_used, dismissed')
      .eq('user_id', userId)
      .single();
    const f = row || { voice_used: false, ai_used: false, dismissed: false };
    setFlags(f);

    // Run all detectors in parallel
    const results = await Promise.all(
      STEPS.map(async (s) => {
        if (s.flag) return [s.key, !!f[s.flag]];
        try {
          const ok = await s.detect(supabase, userId);
          return [s.key, !!ok];
        } catch (e) {
          // Table missing or RLS issue — fail soft, treat as incomplete
          console.warn(`Onboarding detect failed for ${s.key}:`, e?.message);
          return [s.key, false];
        }
      })
    );
    setCompleted(Object.fromEntries(results));
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => { refresh(); }, [refresh, refreshKey]);

  // Mark completed_at + auto-dismiss when all done
  useEffect(() => {
    if (loading) return;
    const total = STEPS.length;
    const done = STEPS.filter(s => completed[s.key]).length;
    if (done === total && !flags.dismissed && userId) {
      supabase
        .from('user_onboarding')
        .update({ dismissed: true, completed_at: new Date().toISOString() })
        .eq('user_id', userId)
        .then(() => setFlags(prev => ({ ...prev, dismissed: true })));
    }
  }, [completed, loading, flags.dismissed, supabase, userId]);

  const dismiss = async () => {
    if (!userId) return;
    await supabase.from('user_onboarding').update({ dismissed: true }).eq('user_id', userId);
    setFlags(prev => ({ ...prev, dismissed: true }));
  };

  // Hidden when dismissed (unless explicitly re-opened from Help Centre)
  if (!loading && flags.dismissed && !forceOpen) return null;
  if (loading) return null;

  const doneCount = STEPS.filter(s => completed[s.key]).length;
  const total = STEPS.length;
  const pct = Math.round((doneCount / total) * 100);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 mb-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold">
              {doneCount}/{total}
            </span>
            <h3 className="text-base font-semibold text-slate-900">Get the most out of Trade PA</h3>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            {doneCount === total
              ? "You're all set. Tidy work."
              : "Tick these off — most users see the benefit after step 5."}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="text-slate-500 hover:text-slate-700 text-xs px-2 py-1 rounded"
            aria-label={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? 'Show' : 'Hide'}
          </button>
          <button
            onClick={dismiss}
            className="text-slate-400 hover:text-slate-600 text-xs px-2 py-1 rounded"
            title="Dismiss (you can re-open from Help)"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Steps */}
      {!collapsed && (
        <ul className="mt-4 space-y-2">
          {STEPS.map((s) => {
            const done = !!completed[s.key];
            return (
              <li
                key={s.key}
                className={`flex items-start gap-3 p-3 rounded-xl border ${
                  done ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div
                  className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    done ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-300 text-slate-400'
                  }`}
                  aria-hidden
                >
                  {done ? '✓' : ''}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${done ? 'text-emerald-900 line-through' : 'text-slate-900'}`}>
                    {s.title}
                  </div>
                  {!done && <p className="text-xs text-slate-600 mt-0.5">{s.blurb}</p>}
                </div>
                {!done && (
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <button
                      onClick={() => onNavigate(s.tab)}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                    >
                      {s.cta}
                    </button>
                    <button
                      onClick={() => onOpenHelp(s.helpSlug)}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      How?
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
