// ============================================================================
// HelpCentre.jsx — Trade PA in-app help & how-to centre
// ----------------------------------------------------------------------------
// Self-contained. Matches Trade PA's existing dark/amber theme and inline-style
// system. No external deps beyond React. No Tailwind.
//
// To add or edit help articles: scroll to the ARTICLES array near the bottom
// of this file. Each article is a plain object — append, edit, remove freely.
// ============================================================================

import React, { useEffect, useMemo, useState } from "react";

// ─── Theme tokens (matched to Trade PA's existing C palette) ────────────────
const T = {
  bg: "#0f0f0f",
  surface: "#1a1a1a",
  surfaceHigh: "#242424",
  border: "#2a2a2a",
  amber: "#f59e0b",
  amberDim: "#92400e",
  green: "#10b981",
  red: "#ef4444",
  blue: "#3b82f6",
  muted: "#6b7280",
  text: "#e5e5e5",
  textDim: "#9ca3af",
  font: "'DM Mono','Courier New',monospace",
};

// ─── Component ──────────────────────────────────────────────────────────────
export default function HelpCentre({ open = false, openSlug = null, onClose = () => {} }) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeSlug, setActiveSlug] = useState(null);

  useEffect(() => { if (openSlug) setActiveSlug(openSlug); }, [openSlug]);

  useEffect(() => {
    if (!open) { setQuery(""); setActiveCategory(null); setActiveSlug(null); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
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
        ].join(" ").toLowerCase();
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
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "#000c",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        zIndex: 400,
        padding: 16,
        paddingTop: "max(52px, env(safe-area-inset-top, 52px))",
        overflowY: "auto",
        fontFamily: T.font,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          width: "100%", maxWidth: 480,
          marginBottom: 16,
          display: "flex", flexDirection: "column",
          color: T.text, overflow: "hidden",
          minWidth: 0,
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", borderBottom: `1px solid ${T.border}`,
          background: T.surfaceHigh, flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {activeArticle && (
              <button
                onClick={() => setActiveSlug(null)}
                style={{
                  background: "transparent", border: "none",
                  color: T.amber, cursor: "pointer",
                  fontSize: 11, fontFamily: T.font, fontWeight: 600,
                  padding: "4px 6px", letterSpacing: "0.04em",
                }}
              >← BACK</button>
            )}
            <div style={{
              fontSize: 12, fontWeight: 700, color: T.amber,
              letterSpacing: "0.08em", textTransform: "uppercase",
            }}>
              {activeArticle ? "How-to" : "Help Centre"}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent", border: "none",
              color: T.muted, cursor: "pointer",
              fontSize: 22, lineHeight: 1, padding: "0 4px",
            }}
          >×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          {activeArticle
            ? <ArticleView article={activeArticle} onSelect={setActiveSlug} />
            : <BrowseView
                query={query} setQuery={setQuery}
                activeCategory={activeCategory} setActiveCategory={setActiveCategory}
                filteredArticles={filteredArticles}
                onSelect={setActiveSlug}
              />
          }
        </div>

        {!activeArticle && (
          <div style={{
            padding: "10px 16px",
            borderTop: `1px solid ${T.border}`,
            background: T.surfaceHigh,
            fontSize: 10, color: T.muted,
            display: "flex", alignItems: "center", justifyContent: "center",
            letterSpacing: "0.04em", flexShrink: 0,
          }}>
            STUCK? EMAIL SUPPORT@TRADESPA.CO.UK
          </div>
        )}
      </div>
    </div>
  );
}

function BrowseView({ query, setQuery, activeCategory, setActiveCategory, filteredArticles, onSelect }) {
  return (
    <div style={{ padding: 16 }}>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search — e.g. mileage, RAMS, voice"
        style={{
          width: "100%", boxSizing: "border-box",
          background: T.surfaceHigh, border: `1px solid ${T.border}`,
          borderRadius: 8, padding: "10px 12px",
          color: T.text,
          fontSize: 16,
          fontFamily: T.font, outline: "none",
        }}
      />

      {!query && (
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 6,
          marginTop: 12, marginBottom: 4,
        }}>
          <CategoryPill label="All" active={activeCategory === null} onClick={() => setActiveCategory(null)} />
          {CATEGORIES.map(c => (
            <CategoryPill
              key={c.id}
              label={c.label} icon={c.icon}
              active={activeCategory === c.id}
              onClick={() => setActiveCategory(activeCategory === c.id ? null : c.id)}
            />
          ))}
        </div>
      )}

      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        {filteredArticles.length === 0 ? (
          <div style={{
            padding: "32px 16px", textAlign: "center",
            color: T.muted, fontSize: 12,
          }}>
            No articles match. Try another word.
          </div>
        ) : filteredArticles.map(a => {
          const cat = CATEGORIES.find(c => c.id === a.category);
          return (
            <button
              key={a.slug}
              onClick={() => onSelect(a.slug)}
              style={{
                background: T.surfaceHigh,
                border: `1px solid ${T.border}`,
                borderRadius: 8, padding: 12,
                cursor: "pointer", textAlign: "left",
                display: "flex", gap: 10, alignItems: "flex-start",
                fontFamily: T.font, color: T.text,
                width: "100%", maxWidth: "100%",
                boxSizing: "border-box", minWidth: 0,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.amber; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; }}
            >
              <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{cat?.icon || "📘"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 4, wordBreak: "break-word" }}>
                  {a.title}
                </div>
                <div style={{ fontSize: 11, color: T.textDim, lineHeight: 1.5, wordBreak: "break-word" }}>
                  {a.summary}
                </div>
              </div>
              <span style={{ color: T.amber, fontSize: 14, flexShrink: 0 }}>›</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CategoryPill({ label, icon, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0, padding: "4px 10px", borderRadius: 16,
        border: `1px solid ${active ? T.amber : T.border}`,
        background: active ? T.amber : "transparent",
        color: active ? "#000" : T.muted,
        fontSize: 10, fontFamily: T.font,
        fontWeight: active ? 700 : 500,
        cursor: "pointer", letterSpacing: "0.04em",
        display: "inline-flex", alignItems: "center", gap: 4,
      }}
    >
      {icon && <span>{icon}</span>}{label}
    </button>
  );
}

function ArticleView({ article, onSelect }) {
  const cat = CATEGORIES.find(c => c.id === article.category);
  const related = (article.related || [])
    .map(slug => ARTICLES.find(a => a.slug === slug))
    .filter(Boolean);

  return (
    <div style={{ padding: 18 }}>
      {cat && (
        <div style={{
          fontSize: 10, color: T.muted,
          letterSpacing: "0.08em", textTransform: "uppercase",
          marginBottom: 10,
          display: "flex", alignItems: "center", gap: 4,
        }}>
          <span>{cat.icon}</span>{cat.label}
        </div>
      )}

      <div style={{
        fontSize: 18, fontWeight: 700, color: T.text,
        marginBottom: 8, lineHeight: 1.3,
      }}>
        {article.title}
      </div>

      <div style={{ fontSize: 13, color: T.textDim, lineHeight: 1.6, marginBottom: 18 }}>
        {article.summary}
      </div>

      {article.steps?.length > 0 && (
        <Section title="HOW TO DO IT">
          <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {article.steps.map((step, i) => (
              <li key={i} style={{ display: "flex", gap: 10, fontSize: 12, color: T.text, lineHeight: 1.6 }}>
                <span style={{
                  flexShrink: 0, width: 22, height: 22, borderRadius: "50%",
                  background: T.amber + "22", border: `1px solid ${T.amber}66`,
                  color: T.amber, fontWeight: 700, fontSize: 11,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginTop: 1,
                }}>{i + 1}</span>
                <span style={{ flex: 1 }}>{step}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {article.voicePrompts?.length > 0 && (
        <Section title="🎙️  TRY SAYING">
          <div style={{
            background: T.amber + "0c",
            border: `1px solid ${T.amber}33`,
            borderRadius: 8, padding: 12,
            display: "flex", flexDirection: "column", gap: 8,
          }}>
            {article.voicePrompts.map((vp, i) => (
              <div key={i} style={{
                fontSize: 12, color: T.amber, fontStyle: "italic",
                lineHeight: 1.5,
              }}>
                "{vp.replace(/^"|"$/g, "")}"
              </div>
            ))}
          </div>
        </Section>
      )}

      {article.tips?.length > 0 && (
        <Section title="PRO TIPS">
          <div style={{
            background: T.surfaceHigh,
            border: `1px solid ${T.border}`,
            borderRadius: 8, padding: 12,
            display: "flex", flexDirection: "column", gap: 6,
          }}>
            {article.tips.map((t, i) => (
              <div key={i} style={{ fontSize: 12, color: T.textDim, lineHeight: 1.5 }}>
                <span style={{ color: T.amber, marginRight: 6 }}>•</span>{t}
              </div>
            ))}
          </div>
        </Section>
      )}

      {related.length > 0 && (
        <Section title="RELATED">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {related.map(r => (
              <button
                key={r.slug}
                onClick={() => onSelect(r.slug)}
                style={{
                  background: "transparent", border: "none",
                  color: T.amber, cursor: "pointer",
                  fontSize: 12, fontFamily: T.font, fontWeight: 600,
                  textAlign: "left", padding: "4px 0", letterSpacing: "0.02em",
                }}
              >→ {r.title}</button>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 10, color: T.muted, fontWeight: 700,
        letterSpacing: "0.1em", marginBottom: 8,
      }}>{title}</div>
      {children}
    </div>
  );
}

// ============================================================================
// CONTENT — edit freely. To add an article: copy an object, change the fields.
// ============================================================================

const CATEGORIES = [
  { id: "getting-started",    label: "Getting started",      icon: "🚀" },
  { id: "plans-usage",        label: "Plans & usage",        icon: "📊" },
  { id: "customers-jobs",     label: "Customers & jobs",     icon: "📋" },
  { id: "materials-ordering", label: "Materials & ordering", icon: "🧰" },
  { id: "labour-mileage",     label: "Labour & mileage",     icon: "⏱️" },
  { id: "voice-ai",           label: "Voice & AI",           icon: "🎙️" },
  { id: "invoicing",          label: "Invoicing & paid",     icon: "💷" },
  { id: "calls-messages",     label: "Calls & messages",     icon: "📞" },
  { id: "compliance",         label: "RAMS & compliance",    icon: "🦺" },
  { id: "stock",              label: "Stock & van",          icon: "🚐" },
  { id: "accounts",           label: "Accountant & Xero",    icon: "📊" },
  { id: "reports-data",       label: "Reports & insights",   icon: "📈" },
  { id: "settings",           label: "Settings & team",      icon: "⚙️" },
  { id: "troubleshooting",    label: "Troubleshooting",      icon: "🛠️" },
];

const ARTICLES = [
  // ─── Getting started ────────────────────────────────────────────────────
  {
    slug: "first-90-seconds",
    title: "Your first 90 seconds in Trade PA",
    category: "getting-started",
    summary: "The fastest path from signup to a working job card.",
    voicePrompts: [
      "Create a customer called Dave Wilson at 22 Mill Lane, Reading",
      "Create a job for Dave Wilson to replace a boiler, two days",
      "Invoice Dave Wilson for the boiler job",
    ],
    steps: [
      "Tap Customers, then Add. Use the mic to dictate name, phone and address.",
      "Tap Jobs, then Add. Pick the customer you just made.",
      "Open the AI Assistant (the home tab) and say: \"Add 5 hours labour and 50m of 2.5mm cable.\"",
      "Tap Invoices. Send. Done.",
    ],
    tips: [
      "Voice works on every form — look for the mic icon.",
      "The AI Assistant takes you straight to whatever it just made.",
    ],
    related: ["voice-fill", "ai-assistant"],
  },
  {
    slug: "install-pwa",
    title: "Install Trade PA on your phone",
    category: "getting-started",
    summary: "Add to home screen so it behaves like a normal app.",
    voicePrompts: [
      "How do I install Trade PA on my phone?",
      "Walk me through adding this to my home screen",
      "Help me install the app",
    ],
    steps: [
      "Open tradespa.co.uk in your phone browser.",
      "iPhone: tap Share → Add to Home Screen.",
      "Android: tap the menu → Install app (or Add to Home Screen).",
      "Open from the home-screen icon. No app store needed.",
    ],
  },
  {
    slug: "navigation",
    title: "Finding your way around",
    category: "getting-started",
    summary: "How the tabs and categories are organised.",
    voicePrompts: [
      "Where do I find invoices?",
      "Take me to the jobs tab",
      "How do I get to the Materials tab?",
    ],
    steps: [
      "Top row: logo (tap to go home), bell for reminders, ? for help, Out to log out.",
      "Middle row: category pills (Work, Admin, etc.) — tap to switch group.",
      "Bottom row: tabs within the active category. Swipe sideways for more.",
      "Tap the TP logo any time to jump back to the AI Assistant home.",
    ],
  },
  {
    slug: "enable-notifications",
    title: "Turn on push notifications",
    category: "getting-started",
    summary: "Get pinged when invoices are paid, calls come in, or the AI completes a job.",
    voicePrompts: [
      "How do I turn on notifications?",
      "Enable push notifications",
      "Walk me through setting up alerts",
    ],
    steps: [
      "Install Trade PA to your home screen first (see 'Install Trade PA on your phone').",
      "Open the app and allow notifications when prompted.",
      "If you missed the prompt, go to your phone Settings → Trade PA → Notifications and enable them.",
      "Test by asking the AI to do something — you'll get a confirmation push.",
    ],
    tips: [
      "Notifications work best on installed PWAs. In a normal browser tab, they're hit-and-miss.",
    ],
    related: ["install-pwa"],
  },
  {
    slug: "dashboard",
    title: "Read your dashboard at a glance",
    category: "getting-started",
    summary: "Quote value, invoice value, overdue, new enquiries — all on the home screen.",
    voicePrompts: [
      "Show me my dashboard",
      "How am I doing this month?",
      "Give me today's summary",
      "What's happening today?",
    ],
    steps: [
      "Tap Dashboard (under the Work category).",
      "Tiles across the top show total quote value, invoice value, overdue, and new enquiries.",
      "Tap any tile to jump straight to that section.",
      "Below the tiles you'll find today's schedule, recent enquiries, outstanding invoices, and active quotes.",
    ],
    tips: [
      "Dashboard is the best 30-second check-in at the start of the day.",
    ],
  },

  // ─── Plans & usage (NEW) ────────────────────────────────────────────────
  {
    slug: "plan-differences",
    title: "Solo vs Team vs Pro — what's different",
    category: "plans-usage",
    summary: "Every plan has every feature. Tiers differ by user count and monthly usage allowance.",
    voicePrompts: [
      "What's the difference between Solo and Team?",
      "Help me pick a plan",
      "Which plan should I be on?",
      "Do I need to upgrade to Team?",
    ],
    steps: [
      "Every plan gets all 43 features — invoicing, RAMS, mileage, calls, certificates, everything.",
      "Solo (£49/mo): 1 user, 500 AI conversations, 5 hours hands-free per month.",
      "Team (£89/mo): up to 5 users, 2,000 AI conversations, 20 hours hands-free per month.",
      "Pro (£129/mo): up to 10 users, unlimited AI conversations, unlimited hands-free.",
      "Tap-to-talk voice (press-and-hold the mic) is never capped on any plan — only continuous hands-free counts.",
      "Upgrade any time from Settings → Subscription — takes effect immediately.",
    ],
    tips: [
      "Most sole traders stay on Solo — the allowances are designed for a busy daily driver.",
      "Move to Team when you bring on your first team member, or if you're consistently hitting 80%+ of Solo caps.",
      "Pro is for larger firms that want the 'never think about usage' experience.",
    ],
    related: ["fair-use-caps", "subscription"],
  },
  {
    slug: "fair-use-caps",
    title: "Your monthly usage allowance",
    category: "plans-usage",
    summary: "What the AI-conversations and hands-free allowances mean, and how to track them.",
    voicePrompts: [
      "How much of my allowance have I used?",
      "Show me my usage",
      "Am I close to my cap?",
      "How many conversations have I used this month?",
    ],
    steps: [
      "Check your current usage any time in Settings → Monthly Usage.",
      "You'll see two progress bars: AI conversations used, and hands-free minutes used.",
      "Green below 80%, amber 80–100%, red when you've hit the cap.",
      "Allowances reset on the 1st of each month.",
      "If you hit a cap mid-month, you can either upgrade (instant) or wait for reset.",
    ],
    tips: [
      "At 80% you'll get a gentle in-chat nudge — plenty of warning, no surprise cut-offs.",
      "If you're on Solo and regularly hitting 80% of conversations, moving to Team is usually cheaper than paying the same attention to usage every month.",
      "Hands-free is the one that burns quicker — 5 hours is about 15 minutes a day, 5 days a week.",
    ],
    related: ["plan-differences", "subscription", "usage-cap-hit"],
  },

  // ─── Customers & jobs ───────────────────────────────────────────────────
  {
    slug: "add-customer",
    title: "Add a customer (by voice)",
    category: "customers-jobs",
    summary: "Get a customer in the system in under 10 seconds.",
    steps: [
      "Tap the Customers tab.",
      "Tap Add (or the + icon).",
      "Tap the mic icon at the top of the form.",
      "Speak naturally — name, phone, address, anything you know.",
      "Check the fields, fix anything that misheard, tap Save.",
    ],
    voicePrompts: [
      "Add a customer — Dave Wilson, 07700 900123, 22 Mill Lane, Reading",
      "New customer Mrs Patel, mobile 07755 123456, 14 Beech Road, Slough",
      "Save a new customer called Trevor Kinsman at 45 Copper Close",
    ],
    related: ["voice-fill"],
  },
  {
    slug: "create-job",
    title: "Create a job",
    category: "customers-jobs",
    summary: "One job card holds materials, labour, photos, notes and the invoice.",
    steps: [
      "Tap Jobs, then Add.",
      "Pick the customer (or add a new one inline).",
      "Fill in scope, site address (defaults to customer address) and dates.",
      "Save. The job card is now ready for materials, labour, photos and notes.",
    ],
    voicePrompts: [
      "Create a job for Mrs Patel, second-fix kitchen, Tuesday 9am, two days",
      "Add a job card for Dave Wilson — boiler install, no date yet",
      "New job for Trevor Kinsman at 45 Copper Close, bathroom refurb, £3,500",
      "Book in the Watts extension for Monday at 8am",
    ],
    tips: [
      "Voice the scope in plain English — the AI sorts the rest.",
      "Use \"job card\" for work without a date yet, \"job\" for anything scheduled.",
    ],
    related: ["ai-assistant", "add-materials", "log-labour"],
  },
  {
    slug: "enquiries",
    title: "Turn an enquiry into a job",
    category: "customers-jobs",
    summary: "Capture leads, then convert them when they become real work.",
    steps: [
      "Tap Enquiries to see incoming leads (manual or via the AI from messages/emails).",
      "Open an enquiry, review the details.",
      "Tap Convert to Job — it carries the customer and scope across.",
      "Add dates and you're done.",
    ],
    voicePrompts: [
      "Log an enquiry — Sarah Jones, 07700 900456, kitchen rewire in Reading",
      "New lead from a Gumtree message — Mike Brown, loft conversion, Slough",
      "Add an enquiry for Mrs Patel's neighbour, she wants a quote for a rewire",
    ],
  },
  {
    slug: "schedule-view",
    title: "See your week on the Schedule",
    category: "customers-jobs",
    summary: "Calendar view of every job, colour-coded by status.",
    steps: [
      "Tap Schedule under the Work category.",
      "Toggle between day, week and month views.",
      "Tap a job to open the full job card.",
      "Drag jobs to reschedule (where supported on your device).",
    ],
    voicePrompts: [
      "What's on my schedule this week?",
      "Show me today's jobs",
      "What am I doing on Friday?",
    ],
    related: ["create-job"],
  },
  {
    slug: "add-photos",
    title: "Add photos to a job",
    category: "customers-jobs",
    summary: "Before/after evidence ready if a customer queries the bill.",
    voicePrompts: [
      "How do I add photos to a job?",
      "Attach a photo to the Smith job",
      "Walk me through taking job photos",
    ],
    steps: [
      "Open the job card.",
      "Tap the camera/photos button.",
      "Take a photo or pick from the gallery.",
      "Photos are saved against the job and visible to anyone on your team.",
    ],
    tips: [
      "Take a photo before you start AND after you finish — it ends 90% of disputes.",
    ],
  },
  {
    slug: "job-notes",
    title: "Add notes to a job",
    category: "customers-jobs",
    summary: "The 'why' of every decision, captured as it happens.",
    steps: [
      "Open the job card.",
      "Tap Notes → Add.",
      "Voice-fill works here — speak the note, save.",
      "Notes are timestamped and linked to the job.",
    ],
    voicePrompts: [
      "Add a note to the Patel job: customer wants extra sockets in the dining room",
      "Note on Beech Road — delivery delayed by a week, pushed the fit-out back",
      "Log on the Wilson job that the boss approved the kitchen extras by phone today",
    ],
    tips: [
      "Use notes for anything you'd otherwise forget — customer requests, snags, materials needed.",
    ],
  },
  {
    slug: "job-card-overview",
    title: "What's on a Job Card",
    category: "customers-jobs",
    summary: "One card per job — materials, labour, photos, notes, RAMS, invoice.",
    voicePrompts: [
      "Show me the Smith job card",
      "Open Mrs Patel's job",
      "Find the Mill Lane job",
      "Pull up the Wilson kitchen",
    ],
    steps: [
      "Open Jobs → tap any job.",
      "Top: customer, site address, scope, dates, status.",
      "Tabs/sections within: Materials, Labour, Photos, Notes, RAMS, Drawings, Invoice.",
      "Everything you do on this job lives on this one card.",
    ],
    related: ["create-job", "add-materials", "log-labour", "add-photos"],
  },
  {
    slug: "reminders",
    title: "Use reminders so nothing slips",
    category: "customers-jobs",
    summary: "Tap the bell, set a reminder, get pinged at the right time.",
    steps: [
      "Tap the bell icon (top of every screen).",
      "Tap Add — type or voice the reminder.",
      "Set a date/time.",
      "When it's due, the bell flashes and you get a push notification.",
    ],
    voicePrompts: [
      "Remind me to chase the Patel invoice on Monday",
      "Set a reminder to call Dave Wilson tomorrow at 2pm",
      "Remind me to order materials for the Beech Road job on Friday morning",
      "Remind me to book the scaffold for the Watts job next Wednesday",
    ],
  },
  {
    slug: "job-profit",
    title: "See the profit on a job",
    category: "customers-jobs",
    summary: "Materials + labour + mileage rolled up against the invoice — live profit view per job.",
    steps: [
      "Open any job card.",
      "Tap the Profit tab.",
      "You'll see: total invoiced, materials cost, labour cost, mileage cost, and profit in pounds and as a margin %.",
      "Check this before you finalise the invoice — if margin looks low, something might not have been logged.",
    ],
    voicePrompts: [
      "How much profit did I make on the Patel job?",
      "What's the margin on Mill Lane?",
    ],
    tips: [
      "If profit looks wrong, the usual cause is unlogged materials or a labour day that was forgotten.",
      "Mileage at 45p/mile adds up — make sure every trip to the job is captured.",
    ],
    related: ["log-labour", "add-materials", "log-mileage", "send-invoice"],
  },
  {
    slug: "job-plans",
    title: "Upload drawings and plans to a job",
    category: "customers-jobs",
    summary: "Keep architect drawings, floor plans and sketches with the job — always to hand on site.",
    voicePrompts: [
      "How do I upload drawings to a job?",
      "Add a plan to the Patel job",
      "Where do I put site drawings?",
    ],
    steps: [
      "Open the job, tap the Plans tab.",
      "Tap Upload Drawing or Plan.",
      "Pick a PDF or image from your phone.",
      "Saved against the job and accessible from any device.",
    ],
    tips: [
      "PDFs work best for architect drawings — they stay sharp when you pinch-zoom on site.",
      "Take a photo of any hand-drawn site sketch and upload it the same way.",
    ],
  },
  {
    slug: "price-work",
    title: "Price work — quick job costing",
    category: "customers-jobs",
    summary: "Rough out a price for a job before you turn it into a quote.",
    voicePrompts: [
      "Price up a bathroom refurb for Mrs Patel, 3 days labour, 1500 in materials",
      "Knock up a quote for Smith, 450 for the boiler service",
      "Price the Mill Lane rewire, 5 days labour",
    ],
    steps: [
      "Open the job, tap Price Work.",
      "Add expected materials and labour (rough is fine).",
      "Trade PA shows target price at your mark-up %.",
      "When you're happy, convert the price work into a formal Quote with one tap.",
    ],
    tips: [
      "Use this to sanity-check that you're not under-pricing before sending a quote.",
      "Set your default mark-up in Settings — Price Work will use it automatically.",
    ],
  },

  // ─── Materials & ordering (renamed from materials-pos) ──────────────────
  {
    slug: "add-materials",
    title: "Add materials to a job",
    category: "materials-ordering",
    summary: "Voice-add materials the way you actually talk about them — no special phrases needed.",
    steps: [
      "Open the AI Assistant, or tap the Materials tab → Add.",
      "Speak naturally — say what you need, from where, for which job.",
      "It saves as a Materials row with status 'To Order'.",
      "When you've ordered it, tap once to mark 'Ordered'. When it arrives, tap again for 'Collected'.",
      "Every material links to the job so it pulls into the invoice automatically.",
    ],
    voicePrompts: [
      "Pop to Plumb Centre for 10 copper pipes on the Patel job",
      "Need 50 metres of 2.5mm twin and earth, 75 quid, for Mill Lane",
      "Nip to Screwfix for four valves, 12 each",
      "Running low on solder — add a roll to the list",
      "Stick a bag of fixings on the list for the Watts job",
      "Order 20 litres of white emulsion from Wickes for Mrs Patel",
    ],
    tips: [
      "Always include the job or customer if you can — it links the cost to job profit.",
      "If the AI hears an unusual item, check the row before you save.",
      "Three statuses move the work along: To Order → Ordered → Collected.",
    ],
    related: ["purchase-orders-now-in-materials", "scan-receipt", "job-profit"],
  },
  {
    slug: "purchase-orders-now-in-materials",
    title: "Where did Purchase Orders go?",
    category: "materials-ordering",
    summary: "Purchase Orders is now part of Materials — same workflow, one less tab to think about.",
    voicePrompts: [
      "Order 10 copper pipes from Plumb Centre for the Smith job",
      "Pop to Plumb Centre for pipes and valves on the Patel job",
      "Put 4 boxes of screws on order from Screwfix",
      "Create a PO for Travis Perkins for 6 sheets of ply",
      "Raise an order with Jewson for 20 bags of ballast",
    ],
    steps: [
      "There's no separate Purchase Orders tab any more — it was confusing alongside Materials.",
      "Everything you order, have on order, or have collected lives in Materials now.",
      "Each material row moves through three statuses: To Order → Ordered → Collected.",
      "Say \"order 10 pipes from Plumb Centre for the Patel job\" and it creates Materials rows automatically.",
      "Materials still link to jobs, so job profit and invoices work exactly as before.",
    ],
    tips: [
      "If you used to say \"create a PO for...\" — that still works. It just makes Materials rows now.",
      "For multiple items in one supplier run, say them all in one go: \"Order 10 pipes, 4 valves and a roll of solder from Plumb Centre for the Patel job\".",
    ],
    related: ["add-materials", "xero-sync"],
  },
  {
    slug: "scan-receipt",
    title: "Scan a receipt with AI",
    category: "materials-ordering",
    summary: "Photograph a merchant receipt — the AI extracts items and adds them to a job.",
    voicePrompts: [
      "I've got a receipt to scan",
      "Scan this Screwfix receipt against the Smith job",
      "Process my Travis Perkins receipt",
    ],
    steps: [
      "Open the AI Assistant.",
      "Tap the camera/scan icon.",
      "Take a photo of the receipt (clear, flat, good light).",
      "Review the extracted line items — pick which job they go against.",
      "Save. Items appear in Materials, ready for the invoice.",
    ],
    tips: [
      "Best results in good light. If the AI misses items, edit before saving.",
    ],
    related: ["add-materials"],
  },

  // ─── Labour & mileage ───────────────────────────────────────────────────
  {
    slug: "log-labour",
    title: "Log labour to a job",
    category: "labour-mileage",
    summary: "Days, hours, worker, type. Auto-totals to the invoice.",
    steps: [
      "Open the job. Tap Labour → Add.",
      "Pick the worker (you, a sub, or team).",
      "Enter days or hours, pick labour type (first-fix, second-fix, etc).",
      "Save. The cost rolls up into the job total.",
    ],
    voicePrompts: [
      "Log 8 hours on the Patel job today, second fix",
      "I did 6 hours at Beech Road yesterday",
      "John worked 5 hours on the Mill Lane job today",
      "Put me down for a full day on the Watts extension",
    ],
    tips: [
      "Log at the end of every day, not at the end of the week. You will forget.",
    ],
  },
  {
    slug: "log-mileage",
    title: "Log mileage by voice",
    category: "labour-mileage",
    summary: "Claim every mile you drive. Voice-log from the driveway.",
    steps: [
      "Open the Mileage tab.",
      "Tap Add, then the mic icon.",
      "Say the trip — \"22 miles to Mrs Patel today\".",
      "Save. End of year, it is all there for the accountant.",
    ],
    voicePrompts: [
      "Log 22 miles for me today on the Mill Lane job",
      "Round trip to Wickes, 14 miles, for the Patel job",
      "Drove 45 miles to site today and back",
    ],
    tips: [
      "Average sole-trader misses ~30% of claimable mileage. At 45p a mile that adds up fast.",
      "Mileage can also be auto-calculated between two postcodes — try it.",
    ],
  },
  {
    slug: "mileage-auto",
    title: "Auto-calculate mileage between two postcodes",
    category: "labour-mileage",
    summary: "Don't know how far it was? Trade PA works it out for you.",
    voicePrompts: [
      "How far is RG1 4AB to SL6 7DP?",
      "Work out the mileage from my postcode to the Patel job",
      "Calculate the round trip to Mill Lane",
    ],
    steps: [
      "Open Mileage → Add.",
      "Tap the auto-calc option.",
      "Enter or pick the start and end postcodes.",
      "Trade PA fills in the distance — review and save.",
    ],
    tips: [
      "Powered by OpenStreetMap — works for any UK postcode pair.",
    ],
    related: ["log-mileage"],
  },
  {
    slug: "add-worker",
    title: "Add a worker to your team",
    category: "labour-mileage",
    summary: "Workers (employees) are separate from subcontractors — track day rates and docs.",
    steps: [
      "Tap Subcontractors → + Add Worker / Sub.",
      "Choose 'Worker' (employed) vs 'Sub' (subcontractor).",
      "Fill in name, contact, day rate, and any docs (insurance, qualifications).",
      "Save. They now appear in labour-logging dropdowns.",
    ],
    voicePrompts: [
      "Add a subbie — Mark Jenkins, plasterer, UTR 1234567890, 20% CIS",
      "New worker — Kevin, day rate £180, labourer",
    ],
    related: ["log-labour", "subcontractors"],
  },
  {
    slug: "daywork-sheets",
    title: "Use daywork sheets for ad-hoc work",
    category: "labour-mileage",
    summary: "Capture extra time/materials outside the original quote.",
    steps: [
      "Open the job → Daywork Sheet → New.",
      "Add labour, materials, and notes for the extra work.",
      "Get the customer to sign on screen if possible.",
      "Daywork rolls into the final invoice as a separate section.",
    ],
    voicePrompts: [
      "Add a daywork to the Patel job — extra 2 hours and 5m of cable",
      "Log a daywork for the Wilson boiler — spent an extra half day on the flue",
    ],
    tips: [
      "Use this any time work goes beyond the original scope — it's the fastest way to avoid arguments later.",
    ],
  },
  {
    slug: "cis-statements",
    title: "Generate a CIS statement for a sub",
    category: "labour-mileage",
    summary: "Auto-calculated from sub payments — one tap to produce, one tap to send.",
    steps: [
      "Tap CIS (under Admin).",
      "Pick the subcontractor and the period.",
      "Trade PA pulls in all payments and applies the right CIS deduction.",
      "Tap Generate → Send (PDF or email).",
    ],
    voicePrompts: [
      "Log a CIS payment of £800 to Mark Jenkins for the Patel job",
      "Generate a CIS statement for Mark for March",
    ],
    related: ["subcontractors"],
  },
  {
    slug: "subcontractors",
    title: "Add and pay subcontractors",
    category: "compliance",
    summary: "Track subbies, their rates, insurance, and CIS payments in one place.",
    steps: [
      "Tap Subcontractors.",
      "Add a sub — name, UTR, CIS rate, contact, insurance.",
      "When paying, tap + Payment, pick the sub and the job.",
      "Trade PA calculates CIS deduction and generates the statement.",
    ],
    voicePrompts: [
      "Add a subbie — Mark Jenkins, plasterer, UTR 1234567890, 20% CIS rate",
      "Paid Mark £450 for the Patel job",
      "Log a sub payment of £1,200 to Gary for the Watts extension",
    ],
  },

  // ─── Voice & AI ─────────────────────────────────────────────────────────
  {
    slug: "voice-fill",
    title: "Use voice fill on any form",
    category: "voice-ai",
    summary: "Look for the mic icon on every form — speak naturally.",
    voicePrompts: [
      "How do I use voice fill?",
      "Test my microphone",
      "Walk me through dictating a form",
    ],
    steps: [
      "Tap the mic icon (top of form, or next to a field).",
      "Speak as you would to a person — names, numbers, items, costs.",
      "The fields fill themselves. Check, fix any misheard bits, save.",
    ],
    tips: [
      "Voice is tuned for UK and regional accents. Speak normally — no need to slow down.",
      "Background noise is fine — vans, sites, traffic. It's tested in all of them.",
      "Tap-to-talk voice never counts toward your monthly hands-free allowance.",
    ],
    related: ["ai-assistant", "voice-not-working"],
  },
  {
    slug: "ai-assistant",
    title: "Tell the AI to do the work",
    category: "voice-ai",
    summary: "Lots of actions the AI can take for you, from natural language.",
    steps: [
      "Tap the AI Assistant (home) tab — or the TP logo.",
      "Type or speak what you want done, naturally, no special syntax.",
      "It builds the job, materials, labour, invoice, note (whatever you asked for).",
      "When done, it takes you straight to what it made.",
    ],
    voicePrompts: [
      "Create a job for Mrs Patel at 14 Beech Road, second-fix kitchen, two days, John on labour",
      "Add 50m of 2.5mm cable and 8 single sockets to the Patel job",
      "Log 22 miles for me today on the Mill Lane job",
      "Invoice the Patel job",
      "Pop to Plumb Centre for 10 copper pipes for the Beech Road job",
      "Remind me to chase the Wilson invoice on Monday morning",
    ],
    tips: [
      "Specific is better. \"Two days\" beats \"a couple of days\".",
      "Review before confirming — the AI can't undo what it does.",
      "Each AI action counts as one 'conversation' toward your monthly allowance.",
    ],
  },
  {
    slug: "hands-free",
    title: "Use Trade PA hands-free",
    category: "voice-ai",
    summary: "Keep the AI listening so you never touch the screen.",
    steps: [
      "Open the AI Assistant.",
      "Say \"Hey Trade PA, go hands-free\" or switch on the hands-free toggle.",
      "Wait for the prompt tone, then speak.",
      "It reads the answer back. Keep talking — no need to tap between requests.",
      "Say \"stop hands-free\" or toggle it off when done.",
    ],
    voicePrompts: [
      "Hey Trade PA, go hands-free",
      "Turn on hands-free mode",
      "Stop hands-free",
    ],
    tips: [
      "Best for in the van or on site when your hands are full.",
      "Works better with the phone in a cradle near you, not in your pocket.",
      "Hands-free time counts toward your monthly allowance. Tap-to-talk doesn't.",
    ],
    related: ["fair-use-caps"],
  },
  {
    slug: "ai-memory",
    title: "Tell the AI to remember things",
    category: "voice-ai",
    summary: "The AI builds up memory about your business so it doesn't ask twice.",
    steps: [
      "Just talk normally — \"My van is registered NK21 ABC\", \"I always charge £45/hr for second-fix\".",
      "The AI extracts and saves these as memories in the background.",
      "Or be explicit: \"Remember that I use Wickes for plywood\".",
      "Memories carry across every conversation.",
    ],
    voicePrompts: [
      "Remember that I always use Plumb Centre for copper pipe",
      "Remember my hourly rate is £55",
      "My usual mark-up on materials is 20%",
    ],
    tips: [
      "If the AI gets something wrong, correct it once — \"No, my hourly rate is £55\" — and the memory updates.",
    ],
    related: ["ai-assistant"],
  },
  {
    slug: "ai-tools-list",
    title: "What can the AI Assistant actually do?",
    category: "voice-ai",
    summary: "A non-exhaustive list of actions the AI can take.",
    voicePrompts: [
      "What can you do?",
      "What are your abilities?",
      "Show me what you can help with",
      "What features do you have?",
    ],
    steps: [
      "Create: jobs, customers, enquiries, materials, labour entries, reminders, mileage logs, invoices, quotes, variation orders, daywork sheets, stage payments, certificates, subcontractors, stock items.",
      "Update: mark invoices paid, change job status, edit invoices, update material status, convert quotes to invoices.",
      "Find/show: invoices, quotes, jobs, materials, schedule, expenses, CIS, subcontractors, reminders, enquiries, customers, mileage, stock, RAMS.",
      "Report: get a summary of your week, month, or specific job.",
      "Remember: tell it facts about your business and it keeps them between sessions.",
    ],
    tips: [
      "If you're not sure, just ask — \"Can you do X?\" — the AI will tell you.",
    ],
  },

  // ─── Invoicing ──────────────────────────────────────────────────────────
  {
    slug: "send-invoice",
    title: "Send your first invoice",
    category: "invoicing",
    summary: "Materials and labour pull through automatically. Add a Stripe link to get paid faster.",
    steps: [
      "Open the job, tap Invoice.",
      "Check the line items — materials and labour are already there.",
      "Add anything extra (call-out fee, parking, etc).",
      "Tap Send. Customer gets it by email with a pay-now link.",
    ],
    voicePrompts: [
      "Invoice the Patel job",
      "Create an invoice for Mrs Patel, £1,850 for the kitchen second fix",
      "Make an invoice from the Mill Lane job",
      "Invoice Dave Wilson £450 for the boiler service",
    ],
    tips: [
      "Send the same day. Invoices sent within 24 hours get paid roughly twice as fast.",
    ],
    related: ["take-payment", "xero-sync"],
  },
  {
    slug: "take-payment",
    title: "Take card payment via Stripe",
    category: "invoicing",
    summary: "Customer taps the link in your invoice email, pays by card. Money in days.",
    steps: [
      "Make sure Stripe is connected in Settings.",
      "When sending an invoice, leave \"Include pay-now link\" ticked.",
      "The customer's invoice email has a Pay Now button.",
      "You see paid status update in Trade PA the moment it clears.",
    ],
    voicePrompts: [
      "Mark the Patel invoice as paid",
      "Patel paid in full today",
      "Wilson paid £450 by bank transfer",
    ],
  },
  {
    slug: "quotes-to-invoices",
    title: "Convert a quote to an invoice",
    category: "invoicing",
    summary: "When the customer says yes, one tap turns the quote into the invoice.",
    steps: [
      "Open Quotes, find the accepted quote.",
      "Tap Convert to Invoice.",
      "All line items carry across. Edit if needed.",
      "Send.",
    ],
    voicePrompts: [
      "Convert the Patel quote to an invoice",
      "Turn Dave Wilson's quote into an invoice",
      "Mrs Patel accepted the quote — make the invoice",
    ],
  },
  {
    slug: "variation-orders",
    title: "Raise a Variation Order (VO)",
    category: "invoicing",
    summary: "Formal record of scope change — protects you if the customer pushes back.",
    steps: [
      "Open the job → Variation Orders → New.",
      "Describe the change in scope, the cost impact, and the time impact.",
      "Send to the customer for approval.",
      "Once approved, the VO rolls into the final invoice.",
    ],
    voicePrompts: [
      "Add a VO to the Patel job — customer wants oak skirting instead of MDF, £180 extra",
      "New variation on Mill Lane — extra day for the rewire, £250",
      "Log a VO on the Watts extension — upgraded spec on the radiators, £420 more",
    ],
    tips: [
      "Use a VO any time the customer asks for something not in the original quote — even small things.",
    ],
  },
  {
    slug: "chase-overdue",
    title: "Chase an overdue invoice",
    category: "invoicing",
    summary: "Trade PA flags overdue invoices automatically — chase from the same screen.",
    steps: [
      "Tap Invoices → filter by Overdue.",
      "Open the invoice → Send Reminder.",
      "Pick template (gentle / firm / final) — Trade PA sends the reminder email.",
      "Reminder is logged against the invoice and the customer.",
    ],
    voicePrompts: [
      "Show me my overdue invoices",
      "Who owes me money?",
      "List unpaid invoices",
    ],
    tips: [
      "Send a gentle nudge after 7 days, firm after 14, final after 21. Most pay on the firm.",
    ],
  },
  {
    slug: "expenses",
    title: "Track business expenses",
    category: "invoicing",
    summary: "Log fuel, parking, tools, anything — for the year-end accounts.",
    steps: [
      "Tap Expenses (under Admin).",
      "Tap Add → enter date, category, amount.",
      "Attach a receipt photo if you have one.",
      "End of year, export the lot for your accountant.",
    ],
    voicePrompts: [
      "Log £47 fuel today",
      "Spent £12 on parking at Reading for the Patel job",
      "Expense — £85 at Screwfix for van tools today",
    ],
    related: ["scan-receipt"],
  },
  {
    slug: "stage-payments",
    title: "Set up stage payments on a big job",
    category: "invoicing",
    summary: "Break a job into 30/40/30 (or custom) milestones — invoice each stage as you hit it.",
    steps: [
      "Open the job. Tap the invoice menu and choose Stage Payments.",
      "Accept the 30/40/30 default, or enter your own split (e.g. 50/25/25, or fixed amounts).",
      "As each stage completes, tap to generate that stage's invoice — it pulls materials and labour up to that point.",
      "Customer pays each stage separately via the pay-now link.",
    ],
    voicePrompts: [
      "Set up stage payments for the Patel kitchen, 30/40/30",
      "Add a 50% deposit stage payment to the Beech Road extension",
    ],
    tips: [
      "Default is 30/40/30 (start / mid-point / completion) — works for most domestic jobs.",
      "For bigger contract work, a 20% deposit + 4 monthly stages + 10% retention is a common pattern.",
    ],
    related: ["send-invoice", "take-payment"],
  },

  // ─── Calls & messages ───────────────────────────────────────────────────
  {
    slug: "business-phone",
    title: "Activate your business phone number",
    category: "calls-messages",
    summary: "Get a Twilio business number so customers don't have your personal mobile.",
    voicePrompts: [
      "How do I activate my business phone?",
      "Set up a business number",
      "Walk me through Twilio setup",
    ],
    steps: [
      "Tap Settings → Business Phone.",
      "Tap Activate Business Phone.",
      "Trade PA picks a UK number for you.",
      "Calls and SMS to that number now route through the app.",
    ],
    tips: [
      "Once activated, customers never see your personal number again.",
    ],
  },
  {
    slug: "make-call",
    title: "Make a call to a customer",
    category: "calls-messages",
    summary: "Tap the customer's number — call goes out from your business number.",
    voicePrompts: [
      "How do I call a customer from Trade PA?",
      "Walk me through making a call",
      "Ring Mrs Patel",
    ],
    steps: [
      "Open the customer (Customers tab or job card).",
      "Tap their phone number.",
      "Allow microphone if prompted.",
      "Call dials — your business number shows on the customer's phone.",
    ],
    related: ["business-phone", "calls-not-connecting"],
  },
  {
    slug: "receive-call",
    title: "Receive an incoming call",
    category: "calls-messages",
    summary: "Customer calls your business number — Trade PA rings inside the app.",
    voicePrompts: [
      "How do I answer incoming calls?",
      "What happens when a customer rings my business number?",
    ],
    steps: [
      "Make sure the app is open (or has notifications on if installed).",
      "Tap Answer when the incoming call appears.",
      "Mute, speaker and hang-up controls during the call.",
      "Call is logged automatically against the customer.",
    ],
    related: ["business-phone"],
  },
  {
    slug: "send-sms",
    title: "Send an SMS to a customer",
    category: "calls-messages",
    summary: "Quick text from your business number, logged against the customer.",
    voicePrompts: [
      "Text Mrs Patel to say I'll be there at 9",
      "Message Dave Wilson: running 15 minutes late",
      "Send Smith a text — job done, invoice on its way",
    ],
    steps: [
      "Open the customer or job.",
      "Tap SMS / message icon.",
      "Type the message (or use voice fill).",
      "Send. Reply comes into your Inbox.",
    ],
  },
  {
    slug: "inbox",
    title: "Inbox — emails and messages from customers",
    category: "calls-messages",
    summary: "Connected email and SMS in one stream — the AI can sort and reply.",
    voicePrompts: [
      "What's in my inbox?",
      "Show me pending emails",
      "Reply to that Smith enquiry saying I can do next week",
      "Any new messages this morning?",
    ],
    steps: [
      "Tap Inbox under Admin.",
      "Connect your email account on first use (Gmail / Outlook).",
      "Incoming customer emails and SMS appear here.",
      "Use the AI to draft replies, create enquiries, or convert messages into jobs.",
    ],
    tips: [
      "The AI scans inbound messages and flags potential enquiries automatically.",
    ],
  },
  {
    slug: "call-log",
    title: "View your call history",
    category: "calls-messages",
    summary: "Every incoming and outgoing call through your Trade PA number is logged against the customer.",
    voicePrompts: [
      "Who called today?",
      "Show me calls from Mrs Patel",
      "Any missed calls this morning?",
      "Did Smith ring me back?",
    ],
    steps: [
      "Open any customer.",
      "Tap the Calls tab on their record.",
      "See every call — date, duration, direction (in/out), and voicemail if there is one.",
      "Tap a voicemail to play it back.",
    ],
    tips: [
      "Missed calls also log here — good backup if you miss one while on a job.",
      "Voicemails are transcribed by Trade PA so you can read them at a glance.",
    ],
    related: ["business-phone", "make-call"],
  },

  // ─── Compliance ─────────────────────────────────────────────────────────
  {
    slug: "rams",
    title: "Build a RAMS in three minutes",
    category: "compliance",
    summary: "Voice-fill on Steps 1 and 5 turns the worst job of the week into a quick one.",
    steps: [
      "Open the job, tap RAMS → New.",
      "Step 1 (Hazards): tap the mic, talk through what could go wrong on this site.",
      "Steps 2–4: pick from the standard options.",
      "Step 5 (Method): tap the mic, talk through how you will do it safely.",
      "Save. Site-ready PDF available to send.",
    ],
    voicePrompts: [
      "Working at height on a dormer roof, scaffold tower, two operatives, weather is fine",
      "Hot works in a domestic loft, fire blanket and extinguisher on hand, no flammables nearby",
      "Dust-generating work, M-class vac in use, dust sheets throughout",
    ],
  },
  {
    slug: "trade-certificates",
    title: "Issue trade certificates (Gas Safe, NICEIC, OFTEC, etc.)",
    category: "compliance",
    summary: "Just ask the AI — it'll follow up for anything it needs. The signed PDF with test results is finished in the job card.",
    steps: [
      "Set your trade types and registration numbers in Settings → Brand & Compliance (one-time setup — your numbers then auto-stamp every PDF).",
      "Ask the AI to log a certificate. It'll ask follow-up questions for anything missing — cert type, customer, cert number, expiry date.",
      "Example: say 'Create me a certificate'. The AI replies 'Which one? Gas Safety, EICR, PAT, Pressure Test…' Answer and it keeps going.",
      "Once the AI has enough info, it logs the cert against the job card.",
      "For the signed PDF with test results (tightness test, pressure readings, appliance details, etc.), open the job → Certificates tab and finish there. Your registration numbers are already pre-populated.",
    ],
    voicePrompts: [
      "Create me a certificate",
      "Add a CP12 for the Patel boiler",
      "Log an EICR against the Wilson job, cert number 12345, expires March 2027",
      "Issue a PAT test for the Smith office",
      "Add an MCS certificate to the Jones solar install",
      "I need to log a pressure test for the Beech Road job",
    ],
    tips: [
      "Just start talking — you don't need to include all the details. The AI will ask what it needs.",
      "For UK dated certs (CP12, EICR, Pressure, Oil) the AI suggests a standard 12-month expiry unless you say otherwise.",
      "Test-result fields (tightness test, polarity, flue checks, etc.) still need the job card's Certificates tab — that's where the signed PDF is produced.",
      "Set up your registration numbers once in Settings → Brand & Compliance. After that, every cert PDF is pre-stamped.",
    ],
  },
  {
    slug: "compliance-docs",
    title: "Store insurance, qualifications and other compliance docs",
    category: "compliance",
    summary: "One vault for all your compliance — easy to send when a contractor asks.",
    voicePrompts: [
      "How do I upload my insurance?",
      "Where do I store my public liability cert?",
      "Add my qualifications to my documents",
    ],
    steps: [
      "Tap Documents (under Admin).",
      "Upload your public liability, employer's liability, qualifications, etc.",
      "Set expiry dates so you get reminded before they lapse.",
      "Share with a contractor in one tap when asked.",
    ],
  },
  {
    slug: "worker-docs",
    title: "Store worker / subcontractor documents",
    category: "compliance",
    summary: "Insurance, CSCS cards, qualifications — all on the worker's profile.",
    voicePrompts: [
      "How do I store John's CSCS card?",
      "Upload Mike's insurance docs",
      "Where do worker qualifications go?",
    ],
    steps: [
      "Open Subcontractors → tap the worker.",
      "Tap + Doc.",
      "Upload the document, set expiry date.",
      "Trade PA flags expiring docs before they lapse.",
    ],
    related: ["add-worker"],
  },

  // ─── Stock ──────────────────────────────────────────────────────────────
  {
    slug: "stock",
    title: "Track van stock",
    category: "stock",
    summary: "Know what is on the van before you head to the merchant.",
    steps: [
      "Tap the Stock tab.",
      "Add an item (voice fill works here too).",
      "When you use stock on a job, deduct it from the count.",
      "Check Stock before any merchant trip — stop double-buying.",
    ],
    voicePrompts: [
      "Add 20m of 2.5mm cable to the van stock",
      "Used 10m of the copper on the Patel job — update stock",
      "Stock take — 5 boxes of screws, 3 rolls of solder, 12 pipe clips",
      "Used 4 junction boxes today on the Mill Lane job",
    ],
  },

  // ─── Accounts ───────────────────────────────────────────────────────────
  {
    slug: "xero-sync",
    title: "Push invoices and bills to Xero",
    category: "accounts",
    summary: "Invoices and supplier bills auto-sync. Your accountant gets clean books.",
    voicePrompts: [
      "Connect Xero",
      "Push the Patel invoice to Xero",
      "Re-sync my invoices to Xero",
      "How do I link Xero?",
    ],
    steps: [
      "Connect Xero in Settings → Integrations.",
      "Once connected, sent invoices sync automatically.",
      "Supplier bills attached to Materials sync too.",
      "Check the Xero log if anything looks off.",
    ],
    tips: [
      "Tell your accountant. Most charge less when the books arrive clean.",
    ],
  },
  {
    slug: "quickbooks-sync",
    title: "Connect QuickBooks instead of Xero",
    category: "accounts",
    summary: "Same auto-sync, just for QuickBooks users.",
    voicePrompts: [
      "Connect QuickBooks",
      "How do I link QuickBooks?",
      "Set up QuickBooks sync",
    ],
    steps: [
      "Tap Settings → Integrations → QuickBooks.",
      "Sign in to your QuickBooks account.",
      "Approve the connection.",
      "Sent invoices and supplier bills now sync automatically.",
    ],
    related: ["xero-sync"],
  },

  // ─── Reports & insights ─────────────────────────────────────────────────
  {
    slug: "reports-overview",
    title: "Generate business reports",
    category: "reports-data",
    summary: "Income, expenses, job profitability, mileage — all exportable.",
    steps: [
      "Tap Reports under Admin.",
      "Pick a report type (income, expenses, profit by job, mileage, customer breakdown).",
      "Set the date range.",
      "View on screen or export as PDF / CSV.",
    ],
    voicePrompts: [
      "What did I invoice this month?",
      "How much have I spent on materials this quarter?",
      "Give me a report on job profit for March",
    ],
    tips: [
      "Send the year-end pack to your accountant in one go.",
    ],
  },
  {
    slug: "reviews-requests",
    title: "Ask happy customers for a review",
    category: "reports-data",
    summary: "One-tap review request — Google, Facebook, Trustpilot.",
    steps: [
      "After job complete, open the customer.",
      "Tap Request Review.",
      "Pick where (Google / Facebook / Trustpilot) and the review platform link.",
      "Customer gets a polite request with the direct link.",
    ],
    voicePrompts: [
      "Send Mrs Patel a review request for Google",
      "Ask Dave Wilson for a Trustpilot review",
      "Request a review from the Watts family",
    ],
    tips: [
      "Send within 24 hours of finishing — that's when satisfaction is highest.",
    ],
  },

  // ─── Settings & team ────────────────────────────────────────────────────
  {
    slug: "brand-setup",
    title: "Set up your business brand",
    category: "settings",
    summary: "Logo, trading name, contact details — appears on every invoice and certificate.",
    steps: [
      "Tap Settings → Brand.",
      "Upload your logo (square or wide).",
      "Fill in trading name, tagline, phone, email, website, address.",
      "Preview an invoice to check it looks right.",
    ],
    voicePrompts: [
      "Update my business name to Walsh Plumbing and Heating",
      "Change my business phone to 07700 123456",
    ],
    tips: [
      "A clean logo on your invoices is worth more than you think — looks more professional, gets paid faster.",
    ],
  },
  {
    slug: "team-members",
    title: "Invite team members",
    category: "settings",
    summary: "Add staff or office help — set per-tab permissions for each.",
    voicePrompts: [
      "How do I invite a team member?",
      "Add Sarah to my team",
      "Walk me through adding a worker",
    ],
    steps: [
      "Tap Settings → Team.",
      "Tap Invite Team Member.",
      "Enter their email and pick permissions (which tabs they can see).",
      "They get an invite email — once they accept, they appear on your team.",
    ],
    tips: [
      "Permissions are per-tab — your office assistant can see Invoices but not Settings, for example.",
      "Team plan supports up to 5 users, Pro supports up to 10.",
    ],
    related: ["plan-differences"],
  },
  {
    slug: "subscription",
    title: "Manage your Trade PA subscription",
    category: "settings",
    summary: "View your plan, check usage, upgrade or downgrade, manage billing.",
    voicePrompts: [
      "Show me my usage this month",
      "What plan am I on?",
      "How much have I used?",
      "Where do I change my subscription?",
    ],
    steps: [
      "Tap Settings → Subscription.",
      "See your current plan: Solo (£49), Team (£89) or Pro (£129).",
      "Check Monthly Usage card to see AI conversations used and hands-free minutes used this month.",
      "Upgrade any time — takes effect immediately, pro-rated.",
      "Update payment method or cancel from the same screen.",
    ],
    tips: [
      "Every plan has every feature — you're only upgrading for more users or a higher usage allowance.",
      "If you're regularly at 80%+ of Solo caps, Team usually pays for itself in saved stress.",
    ],
    related: ["plan-differences", "fair-use-caps"],
  },
  {
    slug: "documents-tab",
    title: "Documents tab — what goes where",
    category: "settings",
    summary: "Central place for any document not tied to a specific job.",
    voicePrompts: [
      "Where do I store documents?",
      "Upload my terms and conditions",
      "Add a contract to my documents",
    ],
    steps: [
      "Tap Documents under Admin.",
      "Upload contracts, terms & conditions, certifications, anything else.",
      "Tag with categories so they're findable.",
      "Share with customers in one tap when needed.",
    ],
    related: ["compliance-docs"],
  },

  // ─── Troubleshooting ────────────────────────────────────────────────────
  {
    slug: "voice-not-working",
    title: "Voice fill not working?",
    category: "troubleshooting",
    summary: "Almost always a mic permission. Here's how to fix it.",
    voicePrompts: [
      "Why isn't voice working?",
      "My mic isn't working",
      "Voice fill won't pick up what I say",
    ],
    steps: [
      "Check the mic permission for your browser (Settings → Apps → Browser → Permissions → Microphone).",
      "For installed PWA, check the same under the Trade PA app entry.",
      "Restart the app once permission is granted.",
      "Still stuck? Email support — include phone model and browser.",
    ],
  },
  {
    slug: "ai-wrong-result",
    title: "AI Assistant did the wrong thing",
    category: "troubleshooting",
    summary: "Two quick fixes plus how to give better instructions.",
    voicePrompts: [
      "That wasn't right, try again",
      "Delete what you just created",
      "Undo that last action",
    ],
    steps: [
      "Open the thing it created and edit or delete as needed.",
      "Try again with more specific wording — names, numbers, units.",
      "If it keeps misunderstanding the same thing, screenshot it and email support.",
    ],
    tips: [
      "Specific beats short. \"Two days, John on labour\" beats \"a couple of days\".",
    ],
  },
  {
    slug: "calls-not-connecting",
    title: "Twilio calls not connecting",
    category: "troubleshooting",
    summary: "Most common cause: mic permission or Twilio not activated.",
    voicePrompts: [
      "My calls aren't connecting",
      "Why won't the call go through?",
      "Twilio isn't working for me",
    ],
    steps: [
      "Check Settings → Business Phone is activated.",
      "Make sure mic permission is granted to your browser/PWA.",
      "Try toggling mute and speaker once during the call.",
      "If still failing, hang up and try again — sometimes Twilio needs a moment.",
    ],
  },
  {
    slug: "xero-not-syncing",
    title: "Invoices not syncing to Xero",
    category: "troubleshooting",
    summary: "Usually a connection that needs reauthorising.",
    voicePrompts: [
      "Xero isn't syncing",
      "Reconnect Xero",
      "Why won't this invoice push to Xero?",
    ],
    steps: [
      "Tap Settings → Integrations → Xero.",
      "Tap Disconnect, then Reconnect.",
      "Sign in to Xero again, approve.",
      "Open a recent invoice and tap Re-sync.",
    ],
    related: ["xero-sync"],
  },
  {
    slug: "notifications-not-showing",
    title: "Push notifications not showing up",
    category: "troubleshooting",
    summary: "Most common cause: notification permission or app not installed.",
    voicePrompts: [
      "I'm not getting push notifications",
      "Why don't my alerts work?",
      "Help me turn notifications back on",
    ],
    steps: [
      "Make sure Trade PA is installed to your home screen (not just in a browser tab).",
      "Check phone Settings → Trade PA → Notifications are on.",
      "Open the app once after granting permission so it can register the device.",
      "Test with a small AI action — confirmation push should arrive within a few seconds.",
    ],
    related: ["enable-notifications", "install-pwa"],
  },
  {
    slug: "usage-cap-hit",
    title: "I've hit my monthly usage cap",
    category: "troubleshooting",
    summary: "Two options: upgrade (instant) or wait for the 1st of the month.",
    voicePrompts: [
      "I've hit my usage cap, what now?",
      "How do I upgrade my plan?",
      "Show me my current usage",
      "When does my allowance reset?",
    ],
    steps: [
      "Check Settings → Monthly Usage to see which cap you've hit.",
      "If it's AI conversations: tap-to-talk voice and the rest of the app still work normally.",
      "If it's hands-free: you can still use tap-to-talk voice. Press-and-hold the mic instead.",
      "Upgrade from Settings → Subscription if you need more right now (instant, pro-rated).",
      "Or wait — allowances reset at 00:00 on the 1st of the month.",
    ],
    tips: [
      "If you're hitting caps most months, upgrading is almost always cheaper than the friction.",
    ],
    related: ["fair-use-caps", "plan-differences", "subscription"],
  },
];
