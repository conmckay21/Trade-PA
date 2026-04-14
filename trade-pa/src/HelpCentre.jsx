// ============================================================================
// HelpCentre.jsx
// ----------------------------------------------------------------------------
// In-app, always-available how-to centre.
//
// Features
//  - Modal overlay, mobile-friendly.
//  - Search across title, summary, steps, voice prompts.
//  - Browse by category (defined in helpContent.js).
//  - Deep-link any article via openSlug prop (used by OnboardingChecklist
//    "How?" buttons).
//  - Re-open the onboarding checklist from inside (calls onReopenOnboarding).
//
// Wiring
//  1. Drop a Help button anywhere (header, footer, FAB):
//       <button onClick={() => setHelpOpen(true)}>?</button>
//  2. Render once at the app root:
//       <HelpCentre
//         open={helpOpen}
//         openSlug={helpSlug}              // optional, deep-link to an article
//         onClose={() => { setHelpOpen(false); setHelpSlug(null); }}
//         onReopenOnboarding={() => setShowOnboardingForce(true)}
//       />
//  3. From OnboardingChecklist's onOpenHelp callback:
//       (slug) => { setHelpSlug(slug); setHelpOpen(true); }
// ============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { ARTICLES, CATEGORIES } from './helpContent';

export default function HelpCentre({
  open = false,
  openSlug = null,
  onClose = () => {},
  onReopenOnboarding = null,
}) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeSlug, setActiveSlug] = useState(null);

  // Deep-link to an article when openSlug changes
  useEffect(() => {
    if (openSlug) setActiveSlug(openSlug);
  }, [openSlug]);

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveCategory(null);
      setActiveSlug(null);
    }
  }, [open]);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const filteredArticles = useMemo(() => {
    let list = ARTICLES;
    if (activeCategory) list = list.filter(a => a.category === activeCategory);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(a => {
        const haystack = [
          a.title, a.summary,
          ...(a.steps || []),
          ...(a.voicePrompts || []),
          ...(a.tips || []),
        ].join(' ').toLowerCase();
        return haystack.includes(q);
      });
    }
    return list;
  }, [query, activeCategory]);

  const activeArticle = useMemo(
    () => ARTICLES.find(a => a.slug === activeSlug) || null,
    [activeSlug]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-xl flex flex-col max-h-[92vh] sm:max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            {activeArticle && (
              <button
                onClick={() => setActiveSlug(null)}
                className="text-slate-500 hover:text-slate-800 text-sm px-2 py-1 -ml-2"
                aria-label="Back"
              >
                ← Back
              </button>
            )}
            <h2 className="text-lg font-semibold text-slate-900">
              {activeArticle ? activeArticle.title : 'Help Centre'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800 text-2xl leading-none px-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {activeArticle ? (
            <ArticleView article={activeArticle} onSelect={setActiveSlug} />
          ) : (
            <BrowseView
              query={query}
              setQuery={setQuery}
              activeCategory={activeCategory}
              setActiveCategory={setActiveCategory}
              filteredArticles={filteredArticles}
              onSelect={setActiveSlug}
            />
          )}
        </div>

        {/* Footer */}
        {!activeArticle && (
          <div className="p-3 border-t border-slate-200 flex items-center justify-between gap-2 text-xs text-slate-600">
            <span>Can't find what you need? Email support@tradespa.co.uk</span>
            {onReopenOnboarding && (
              <button
                onClick={() => { onReopenOnboarding(); onClose(); }}
                className="text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
              >
                Show setup checklist
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Browse view ----------
function BrowseView({ query, setQuery, activeCategory, setActiveCategory, filteredArticles, onSelect }) {
  return (
    <div className="p-4 space-y-4">
      {/* Search */}
      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search — e.g. mileage, RAMS, voice"
          className="w-full px-4 py-3 pr-10 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
      </div>

      {/* Categories (hide while searching) */}
      {!query && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={`text-xs px-3 py-1.5 rounded-full border ${
              activeCategory === null
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            All
          </button>
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id === activeCategory ? null : c.id)}
              className={`text-xs px-3 py-1.5 rounded-full border ${
                activeCategory === c.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span className="mr-1">{c.icon}</span>{c.label}
            </button>
          ))}
        </div>
      )}

      {/* Article list */}
      <ul className="space-y-2">
        {filteredArticles.length === 0 ? (
          <li className="text-sm text-slate-500 py-6 text-center">
            No articles match. Try another word, or email support@tradespa.co.uk.
          </li>
        ) : (
          filteredArticles.map(a => {
            const cat = CATEGORIES.find(c => c.id === a.category);
            return (
              <li key={a.slug}>
                <button
                  onClick={() => onSelect(a.slug)}
                  className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 transition"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl shrink-0" aria-hidden>{cat?.icon || '📘'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-900">{a.title}</div>
                      <div className="text-xs text-slate-600 mt-0.5">{a.summary}</div>
                    </div>
                    <span className="text-slate-400 text-sm shrink-0">›</span>
                  </div>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

// ---------- Article view ----------
function ArticleView({ article, onSelect }) {
  const cat = CATEGORIES.find(c => c.id === article.category);
  const related = (article.related || [])
    .map(slug => ARTICLES.find(a => a.slug === slug))
    .filter(Boolean);

  return (
    <div className="p-5 space-y-5">
      {/* Category pill */}
      {cat && (
        <div className="text-xs text-slate-500 flex items-center gap-1.5">
          <span>{cat.icon}</span><span>{cat.label}</span>
        </div>
      )}

      {/* Summary */}
      <p className="text-sm text-slate-700 leading-relaxed">{article.summary}</p>

      {/* Steps */}
      {article.steps?.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-slate-900 mb-2">How to do it</h3>
          <ol className="space-y-2">
            {article.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-slate-700">
                <span className="shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span className="flex-1">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Voice prompts */}
      {article.voicePrompts?.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <h3 className="text-xs font-semibold text-amber-900 uppercase tracking-wide mb-2">
            🎙️ Try saying
          </h3>
          <ul className="space-y-1.5">
            {article.voicePrompts.map((vp, i) => (
              <li key={i} className="text-sm text-amber-900 italic">"{vp.replace(/^"|"$/g, '')}"</li>
            ))}
          </ul>
        </section>
      )}

      {/* Tips */}
      {article.tips?.length > 0 && (
        <section className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Pro tips</h3>
          <ul className="space-y-1.5">
            {article.tips.map((t, i) => (
              <li key={i} className="text-sm text-slate-700">• {t}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Related */}
      {related.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Related</h3>
          <ul className="space-y-1.5">
            {related.map(r => (
              <li key={r.slug}>
                <button
                  onClick={() => onSelect(r.slug)}
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                >
                  → {r.title}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
