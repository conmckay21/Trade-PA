// ============================================================================
// HelpCentre.jsx — Trade PA in-app help & how-to centre
// ----------------------------------------------------------------------------
// Self-contained. Matches Trade PA's existing dark/amber theme and inline-style
// system. No external deps beyond React. No Tailwind.
//
// To add or edit help articles: scroll to the ARTICLES array near the bottom
// of this file. Each article is a plain object — append, edit, remove freely.
//
// ─── WIRING (4 changes to App.jsx) ──────────────────────────────────────────
//
// 1. Import (near the top of App.jsx, with the other imports):
//      import HelpCentre from "./HelpCentre.jsx";
//
// 2. State (inside `export default function App()`, with the other useState calls):
//      const [helpOpen, setHelpOpen] = useState(false);
//      const [helpSlug, setHelpSlug] = useState(null);
//
// 3. Header button (in the top row of the header, BEFORE the "Out" button):
//      <button
//        onClick={() => { setHelpSlug(null); setHelpOpen(true); }}
//        style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 8px", color: C.amber }}
//        title="Help & how-to"
//      >?</button>
//
// 4. Render at the end of the App return (just before the closing </div>):
//      <HelpCentre
//        open={helpOpen}
//        openSlug={helpSlug}
//        onClose={() => { setHelpOpen(false); setHelpSlug(null); }}
//      />
//
// ============================================================================

import React, { useEffect, useMemo, useState } from "react";

// ─── Theme tokens — uses CSS variables set by App.jsx so HelpCentre follows
// the global light/dark theme. Accent colours stay fixed (brand colours).
const T = {
  bg: "var(--c-bg)",
  surface: "var(--c-surface)",
  surfaceHigh: "var(--c-surfaceHigh)",
  border: "var(--c-border)",
  amber: "#f59e0b",
  amberDim: "#92400e",
  green: "#10b981",
  red: "#ef4444",
  blue: "#3b82f6",
  muted: "var(--c-muted)",
  text: "var(--c-text)",
  textDim: "var(--c-textDim)",
  font: "'DM Mono','Courier New',monospace",
};

// ─── Component ──────────────────────────────────────────────────────────────
export default function HelpCentre({ open = false, openSlug = null, onClose = () => {} }) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeSlug, setActiveSlug] = useState(null);

  // Deep-link to an article when openSlug changes
  useEffect(() => { if (openSlug) setActiveSlug(openSlug); }, [openSlug]);

  // Reset state when closed
  useEffect(() => {
    if (!open) { setQuery(""); setActiveCategory(null); setActiveSlug(null); }
  }, [open]);

  // ESC key closes
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
        {/* Header */}
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

        {/* Body — scrolls */}
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

        {/* Footer */}
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

// ─── Browse view ────────────────────────────────────────────────────────────
function BrowseView({ query, setQuery, activeCategory, setActiveCategory, filteredArticles, onSelect }) {
  return (
    <div style={{ padding: 16 }}>
      {/* Search input */}
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
          fontSize: 16,  // 16px prevents iOS Safari auto-zoom on focus
          fontFamily: T.font, outline: "none",
        }}
      />

      {/* Category pills */}
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

      {/* Article list */}
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

// ─── Article view ───────────────────────────────────────────────────────────
function ArticleView({ article, onSelect }) {
  const cat = CATEGORIES.find(c => c.id === article.category);
  const related = (article.related || [])
    .map(slug => ARTICLES.find(a => a.slug === slug))
    .filter(Boolean);

  return (
    <div style={{ padding: 18 }}>
      {/* Category breadcrumb */}
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

      {/* Title */}
      <div style={{
        fontSize: 18, fontWeight: 700, color: T.text,
        marginBottom: 8, lineHeight: 1.3,
      }}>
        {article.title}
      </div>

      {/* Summary */}
      <div style={{ fontSize: 13, color: T.textDim, lineHeight: 1.6, marginBottom: 18 }}>
        {article.summary}
      </div>

      {/* Steps */}
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

      {/* Voice prompts */}
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

      {/* Tips */}
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

      {/* Related */}
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
  { id: "getting-started", label: "Getting started",   icon: "🚀" },
  { id: "customers-jobs",  label: "Customers & jobs",  icon: "📋" },
  { id: "materials-pos",   label: "Materials & POs",   icon: "🧰" },
  { id: "labour-mileage",  label: "Labour & mileage",  icon: "⏱️" },
  { id: "voice-ai",        label: "Voice & AI",        icon: "🎙️" },
  { id: "invoicing",       label: "Invoicing & paid",  icon: "💷" },
  { id: "calls-messages",  label: "Calls & messages",  icon: "📞" },
  { id: "compliance",      label: "RAMS & compliance", icon: "🦺" },
  { id: "stock",           label: "Stock & van",       icon: "🚐" },
  { id: "accounts",        label: "Accountant & Xero", icon: "📊" },
  { id: "reports-data",    label: "Reports & insights", icon: "📈" },
  { id: "settings",        label: "Settings & team",   icon: "⚙️" },
  { id: "troubleshooting", label: "Troubleshooting",   icon: "🛠️" },
];

const ARTICLES = [
  // ─── Getting started ────────────────────────────────────────────────────
  {
    slug: "first-90-seconds",
    title: "Your first 90 seconds in Trade PA",
    category: "getting-started",
    summary: "The fastest path from signup to a working job card.",
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
    steps: [
      "Top row: TP logo (tap to go home), bell for reminders, ? for help, 💬 to send feedback, 👤 to edit your AI Assistant, Out to log out.",
      "Middle row: category pills — Work, Accounts, People, Site, Admin. Tap to switch group.",
      "Bottom row: tabs within the active category. Swipe sideways for more.",
      "Tap the TP logo any time to jump back to the AI Assistant home.",
      "On a desktop browser (not phone), the categories appear as a left-hand sidebar instead of pills.",
    ],
    tips: [
      "The 💬 button is for reporting bugs, suggesting improvements or sharing ideas — we read everything.",
      "Accounts holds all your money stuff: Invoices, Quotes, Payments, Expenses, CIS, Reports.",
    ],
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
      "Dave Wilson, 07700 900123, 22 Mill Lane, Reading",
      "Mrs Patel, mobile is oh-seven-seven-five-five, lives at 14 Beech Road, Slough",
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
    tips: [
      "Faster: ask the AI Assistant — \"Create a job for Mrs Patel, second-fix kitchen, two days\".",
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
  },

  // ─── Materials & POs ────────────────────────────────────────────────────
  {
    slug: "add-materials",
    title: "Add materials to a job",
    category: "materials-pos",
    summary: "Voice-fill at the merchant so nothing falls off the invoice.",
    steps: [
      "Open the job card.",
      "Tap Materials → Add.",
      "Tap the mic. Say the item, quantity, and rough cost.",
      "Save. It links to this job and pulls into the invoice automatically.",
    ],
    voicePrompts: [
      "50 metres of 2.5mm twin and earth, 75 quid",
      "Two boxes of 35mm screws, ten pounds each",
    ],
    related: ["raise-po"],
  },
  {
    slug: "raise-po",
    title: "Raise a Purchase Order (and the hidden trick)",
    category: "materials-pos",
    summary: "A PO automatically creates the matching materials entries on the job.",
    steps: [
      "Open the job. Tap Purchase Orders → New PO.",
      "Pick the supplier and add line items (voice-fill works here too).",
      "Save / send.",
      "Check the Materials tab — the PO items are already there, linked to this job.",
    ],
    tips: [
      "Most users don't realise this for weeks. One tap, two boxes ticked.",
    ],
    related: ["add-materials", "xero-sync"],
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
      "22 miles to the Mill Lane job today",
      "Round trip to Wickes, 14 miles, for the Patel job",
    ],
    tips: [
      "Average sole-trader misses ~30% of claimable mileage. At 45p a mile that adds up fast.",
      "Mileage can also be auto-calculated between two postcodes — try it.",
    ],
  },

  // ─── Voice & AI ─────────────────────────────────────────────────────────
  {
    slug: "voice-fill",
    title: "Use voice fill on any form",
    category: "voice-ai",
    summary: "Look for the mic icon on every form — speak naturally.",
    steps: [
      "Tap the mic icon (top of form, or next to a field).",
      "Speak as you would to a person — names, numbers, items, costs.",
      "The fields fill themselves. Check, fix any misheard bits, save.",
    ],
    tips: [
      "Voice is tuned for UK and regional accents. Speak normally — no need to slow down.",
      "Background noise is fine — vans, sites, traffic. It's tested in all of them.",
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
      "It builds the job, materials, labour, PO, note (whatever you asked for).",
      "When done, it takes you straight to what it made.",
    ],
    voicePrompts: [
      "Create a job for Mrs Patel at 14 Beech Road, second-fix kitchen, two days, John on labour",
      "Add 50m of 2.5mm cable and 8 single sockets to the Patel job",
      "Log 22 miles for me today on the Mill Lane job",
      "Raise a PO to Wickes for 4 sheets of 18mm ply on the Beech Road job",
    ],
    tips: [
      "Specific is better. \"Two days\" beats \"a couple of days\".",
      "Review before confirming — the AI can't undo what it does.",
    ],
  },
  {
    slug: "hands-free",
    title: "Use Trade PA hands-free",
    category: "voice-ai",
    summary: "Keep the AI listening so you never touch the screen.",
    steps: [
      "Open the AI Assistant.",
      "Switch on hands-free mode (toggle on the assistant).",
      "Wait for the prompt sound, then speak.",
      "It reads the answer back. Say \"Hey Trade PA\" to start the next request.",
    ],
    tips: [
      "Best for in the van or on site when your hands are full.",
      "Works better with the phone in a cradle near you, not in your pocket.",
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
      "For repeat customers, use the \"Pick existing customer\" dropdown above the form to auto-fill name, email and address.",
      "Check the line items — materials and labour are already there.",
      "Add anything extra (call-out fee, parking, etc).",
      "Tap Send. Customer gets it by email with a pay-now link.",
    ],
    tips: [
      "Send the same day. Invoices sent within 24 hours get paid roughly twice as fast.",
      "The customer picker also works on Quotes — same dropdown, same auto-fill.",
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
    ],
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
  },

  // ─── Accounts ───────────────────────────────────────────────────────────
  {
    slug: "xero-sync",
    title: "Push invoices and bills to Xero",
    category: "accounts",
    summary: "Invoices and supplier bills auto-sync. Your accountant gets clean books.",
    steps: [
      "Connect Xero in Settings → Integrations.",
      "Once connected, sent invoices sync automatically.",
      "Supplier bills attached to POs sync too.",
      "Check the Xero log if anything looks off.",
    ],
    tips: [
      "Tell your accountant. Most charge less when the books arrive clean.",
    ],
  },

  // ─── Troubleshooting ────────────────────────────────────────────────────
  {
    slug: "send-feedback",
    title: "Found a bug? Got an idea? Tell us",
    category: "troubleshooting",
    summary: "Send us a bug report, improvement suggestion or new feature idea — with an optional screenshot. We read every one.",
    steps: [
      "Tap the 💬 icon in the top header (between ? and 👤). Or go to Settings → Send Feedback.",
      "Pick the type: 🐛 Bug for something broken, 💡 Improvement for something that could work better, ✨ Idea for new features.",
      "Describe what happened. Be specific — what you tried, what you expected, what actually occurred.",
      "Optionally attach a screenshot — tap \"Choose file\" or paste an image with Ctrl+V.",
      "Hit Send. We get an email with everything you typed plus context about what page you were on.",
    ],
    tips: [
      "Screenshots help massively for bugs — they let us see exactly what you saw.",
      "We automatically include the page you're on, your device and browser, so we don't need to ask.",
      "Hit Reply to our email if we get back to you — your feedback comes with your email as the reply-to address.",
      "If the feedback button isn't working for some reason, you can email thetradepa@gmail.com directly.",
    ],
  },
  {
    slug: "voice-not-working",
    title: "Voice fill not working?",
    category: "troubleshooting",
    summary: "Almost always a mic permission. Here's how to fix it.",
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
    steps: [
      "Check Settings → Business Phone is activated.",
      "Make sure mic permission is granted to your browser/PWA.",
      "Try toggling mute and speaker once during the call.",
      "If still failing, hang up and try again — sometimes Twilio needs a moment.",
    ],
  },

  // ─── Getting started (extras) ───────────────────────────────────────────
  {
    slug: "enable-notifications",
    title: "Turn on push notifications",
    category: "getting-started",
    summary: "Get pinged when invoices are paid, calls come in, or the AI completes a job.",
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

  // ─── Customers & jobs (extras) ──────────────────────────────────────────
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
    related: ["create-job"],
  },
  {
    slug: "add-photos",
    title: "Add photos to a job",
    category: "customers-jobs",
    summary: "Before/after evidence ready if a customer queries the bill.",
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
    tips: [
      "Use notes for anything you'd otherwise forget — customer requests, snags, materials needed.",
    ],
  },
  {
    slug: "job-card-overview",
    title: "What's on a Job Card",
    category: "customers-jobs",
    summary: "One card per job — materials, labour, photos, notes, RAMS, invoice.",
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
    summary: "Tap the bell, set a reminder, get pinged at the right time. Reminders stay in your list until you confirm them done.",
    steps: [
      "Tap the bell icon (top of every screen).",
      "Tap Add — type or voice the reminder.",
      "Set a date/time.",
      "When it's due, the bell flashes and you get a push notification.",
      "The reminder stays in your Upcoming list as Overdue (red bar) until you mark it done.",
      "Tap Done ✓ once you've actually followed through. Tap ✕ to delete it entirely.",
    ],
    tips: [
      "The AI can also set reminders for you — \"Remind me to chase the Patel invoice on Monday\".",
      "Overdue reminders deliberately don't auto-disappear — that way you've always got a list of things you haven't followed through on yet.",
      "All your completed reminders are kept in the Completed section as a history.",
    ],
  },

  // ─── Materials & POs (extras) ───────────────────────────────────────────
  {
    slug: "scan-receipt",
    title: "Scan a receipt with AI",
    category: "materials-pos",
    summary: "Photograph a merchant receipt — the AI extracts items and adds them to a job.",
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
  {
    slug: "purchase-orders-tab",
    title: "Manage all Purchase Orders in one place",
    category: "materials-pos",
    summary: "The PO tab shows every order across every job.",
    steps: [
      "Tap Purchase Orders.",
      "Filter by status (draft, sent, received).",
      "Tap a PO to view, edit, or mark received.",
      "Marking received auto-updates linked job materials.",
    ],
    related: ["raise-po"],
  },

  // ─── Labour & mileage (extras) ──────────────────────────────────────────
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
    tips: [
      "Use this any time work goes beyond the original scope — it's the fastest way to avoid arguments later.",
    ],
  },
  {
    slug: "mileage-auto",
    title: "Auto-calculate mileage between two postcodes",
    category: "labour-mileage",
    summary: "Don't know how far it was? Trade PA works it out for you.",
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
    related: ["subcontractors"],
  },

  // ─── Voice & AI (extras) ────────────────────────────────────────────────
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
    steps: [
      "Create jobs, customers, enquiries, materials, labour entries, POs, reminders, mileage logs.",
      "Update statuses (mark paid, mark complete, change job status).",
      "Convert quotes to invoices, send invoices, mark as paid.",
      "Generate RAMS drafts and start invoice drafts.",
      "Search across customers, jobs, invoices, and materials by voice.",
    ],
    tips: [
      "If you're not sure, just ask — \"Can you do X?\" — the AI will tell you.",
    ],
  },

  // ─── Invoicing (extras) ─────────────────────────────────────────────────
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
    related: ["scan-receipt"],
  },

  // ─── Calls & messages ───────────────────────────────────────────────────
  {
    slug: "business-phone",
    title: "Activate your business phone number",
    category: "calls-messages",
    summary: "Get a Twilio business number so customers don't have your personal mobile.",
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

  // ─── Compliance (extras) ────────────────────────────────────────────────
  {
    slug: "trade-certificates",
    title: "Issue trade certificates (Gas Safe, NICEIC, OFTEC, etc.)",
    category: "compliance",
    summary: "Pre-filled with your registration numbers — issue from the job in minutes.",
    steps: [
      "Set your trade types and registration numbers in Settings → Brand & Compliance.",
      "Open the job → Certificates → New.",
      "Pick the certificate type (gas, electrical, oil, MCS, FENSA, etc.).",
      "Fill in the test results / details — your registration numbers are pre-populated.",
      "Issue the PDF — copy goes to the customer and stays on the job.",
    ],
    tips: [
      "Set up your registration numbers once. After that, every cert is pre-stamped.",
    ],
  },
  {
    slug: "compliance-docs",
    title: "Store insurance, qualifications and other compliance docs",
    category: "compliance",
    summary: "One vault for all your compliance — easy to send when a contractor asks.",
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
    steps: [
      "Open Subcontractors → tap the worker.",
      "Tap + Doc.",
      "Upload the document, set expiry date.",
      "Trade PA flags expiring docs before they lapse.",
    ],
    related: ["add-worker"],
  },

  // ─── Accounts (extras) ──────────────────────────────────────────────────
  {
    slug: "quickbooks-sync",
    title: "Connect QuickBooks instead of Xero",
    category: "accounts",
    summary: "Same auto-sync, just for QuickBooks users.",
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
    tips: [
      "Send within 24 hours of finishing — that's when satisfaction is highest.",
    ],
  },

  // ─── Settings & team ────────────────────────────────────────────────────
  {
    slug: "appearance",
    title: "Light, dark, or auto — choose how Trade PA looks",
    category: "settings",
    summary: "Pick a theme that suits where you're working. Bright sunlight outside? Light mode. Evening in the van? Dark mode.",
    steps: [
      "Tap Settings.",
      "Scroll to the Appearance section (just under Your Plan).",
      "Pick Auto, Light, or Dark.",
    ],
    tips: [
      "Auto follows your phone's system setting — switches automatically when your phone does.",
      "Light mode is much easier to read in bright outdoor sunlight on site.",
      "Dark mode is gentler on the eyes in low light — vans, evenings, lofts.",
      "Your choice is remembered across sessions and devices.",
    ],
  },
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
    tips: [
      "A clean logo on your invoices is worth more than you think — looks more professional, gets paid faster.",
    ],
  },
  {
    slug: "team-members",
    title: "Invite team members",
    category: "settings",
    summary: "Add staff or office help — set per-tab permissions for each.",
    steps: [
      "Tap Settings → Team.",
      "Tap Invite Team Member.",
      "Enter their email and pick permissions (which tabs they can see).",
      "They get an invite email — once they accept, they appear on your team.",
    ],
    tips: [
      "Permissions are per-tab — your office assistant can see Invoices but not Settings, for example.",
    ],
  },
  {
    slug: "subscription",
    title: "Manage your Trade PA subscription",
    category: "settings",
    summary: "View your plan, upgrade or downgrade, manage billing.",
    steps: [
      "Tap Settings → Subscription.",
      "See current plan and what's included.",
      "Upgrade for more team members or premium features.",
      "Update payment method or cancel from the same screen.",
    ],
  },
  {
    slug: "documents-tab",
    title: "Documents tab — what goes where",
    category: "settings",
    summary: "Central place for any document not tied to a specific job.",
    steps: [
      "Tap Documents under Admin.",
      "Upload contracts, terms & conditions, certifications, anything else.",
      "Tag with categories so they're findable.",
      "Share with customers in one tap when needed.",
    ],
    related: ["compliance-docs"],
  },

  // ─── Troubleshooting (extras) ───────────────────────────────────────────
  {
    slug: "xero-not-syncing",
    title: "Invoices not syncing to Xero",
    category: "troubleshooting",
    summary: "Usually a connection that needs reauthorising.",
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
    steps: [
      "Make sure Trade PA is installed to your home screen (not just in a browser tab).",
      "Check phone Settings → Trade PA → Notifications are on.",
      "Open the app once after granting permission so it can register the device.",
      "Test with a small AI action — confirmation push should arrive within a few seconds.",
    ],
    related: ["enable-notifications", "install-pwa"],
  },

  // ─── Gap-fill articles (profit, plans, stage pay, price work, call log) ─
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
    slug: "stage-payments",
    title: "Set up stage payments on a big job",
    category: "quotes-invoices",
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
  {
    slug: "price-work",
    title: "Price work — quick job costing",
    category: "customers-jobs",
    summary: "Rough out a price for a job before you turn it into a quote.",
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
    related: ["quote-flow"],
  },
  {
    slug: "call-log",
    title: "View your call history",
    category: "phone-calls",
    summary: "Every incoming and outgoing call through your Trade PA number is logged against the customer.",
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
    related: ["twilio-phone", "make-call"],
  },
];
