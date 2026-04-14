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
        position: "fixed", inset: 0, background: "#000c",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        zIndex: 400, padding: 16,
        paddingTop: "max(52px, env(safe-area-inset-top, 52px))",
        overflowY: "auto", fontFamily: T.font,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          width: "100%", maxWidth: 560,
          maxHeight: "calc(100vh - 80px)",
          display: "flex", flexDirection: "column",
          color: T.text, overflow: "hidden",
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
        autoFocus
        style={{
          width: "100%", boxSizing: "border-box",
          background: T.surfaceHigh, border: `1px solid ${T.border}`,
          borderRadius: 8, padding: "10px 12px",
          color: T.text, fontSize: 13, fontFamily: T.font, outline: "none",
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
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.amber; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; }}
            >
              <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{cat?.icon || "📘"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 4 }}>
                  {a.title}
                </div>
                <div style={{ fontSize: 11, color: T.textDim, lineHeight: 1.5 }}>
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
  { id: "compliance",      label: "RAMS & compliance", icon: "🦺" },
  { id: "stock",           label: "Stock & van",       icon: "🚐" },
  { id: "accounts",        label: "Accountant & Xero", icon: "📊" },
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
      "Top row: logo (tap to go home), bell for reminders, ? for help, Out to log out.",
      "Middle row: category pills (Work, Admin, etc.) — tap to switch group.",
      "Bottom row: tabs within the active category. Swipe sideways for more.",
      "Tap the TP logo any time to jump back to the AI Assistant home.",
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
      "Check the line items — materials and labour are already there.",
      "Add anything extra (call-out fee, parking, etc).",
      "Tap Send. Customer gets it by email with a pay-now link.",
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
];
