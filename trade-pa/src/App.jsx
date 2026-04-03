import React, { useState, useRef, useEffect, Component } from "react";
import { supabase } from "./supabase.js";
import { Device } from "@twilio/voice-sdk";

// Error boundary to catch Settings crashes and show the actual error
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, background: "#1a1a1a", borderRadius: 12, border: "1px solid #ef4444" }}>
          <div style={{ color: "#ef4444", fontWeight: 700, marginBottom: 8, fontFamily: "'DM Mono',monospace", fontSize: 13 }}>Settings crashed — error details:</div>
          <div style={{ color: "#fca5a5", fontSize: 12, fontFamily: "'DM Mono',monospace", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{this.state.error?.message || String(this.state.error)}</div>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 12, background: "#f59e0b", color: "#000", border: "none", borderRadius: 6, padding: "8px 16px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
window._supabase = supabase;

// ─── Sync invoice to accounting software ─────────────────────────────────────
async function syncInvoiceToAccounting(userId, invoice) {
  if (!userId || !invoice) return;
  try {
    if (invoice.status === "paid") {
      // Mark as paid in Xero
      fetch("/api/xero/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, invoiceId: invoice.id }),
      }).catch(() => {});
      // Mark as paid in QuickBooks
      fetch("/api/quickbooks/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, invoiceId: invoice.id }),
      }).catch(() => {});
    } else {
      // Create invoice in both systems
      fetch("/api/xero/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, invoice }),
      }).catch(() => {});
      fetch("/api/quickbooks/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, invoice }),
      }).catch(() => {});
    }
  } catch (e) {
    console.log("Accounting sync skipped:", e.message);
  }
}

// ─── Auth Screen ──────────────────────────────────────────────────────────────
// ─── Landing Page ─────────────────────────────────────────────────────────────
function LandingPage({ onAuth }) {
  const [screen, setScreen] = useState("landing"); // landing | login | signup
  const LP = {
    wrap: { minHeight: "100vh", background: "#0a0a0a", color: "#f0f0f0", fontFamily: "'DM Sans','Helvetica Neue',sans-serif", overflowX: "hidden" },
    nav: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 28px", paddingTop: "max(20px, env(safe-area-inset-top, 20px))", borderBottom: "1px solid #1a1a1a", position: "sticky", top: 0, background: "rgba(10,10,10,0.95)", backdropFilter: "blur(8px)", zIndex: 100 },
    logo: { display: "flex", alignItems: "center", gap: 10, fontFamily: "'DM Mono',monospace", fontSize: 14, color: "#f59e0b", letterSpacing: "0.06em" },
    logoIcon: { width: 30, height: 30, background: "#f59e0b", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, color: "#000" },
    hero: { textAlign: "center", padding: "80px 24px 60px", position: "relative" },
    h1: { fontSize: "clamp(36px, 7vw, 72px)", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.03em", marginBottom: 24, fontFamily: "'DM Mono',monospace" },
    sub: { fontSize: "clamp(15px, 2.5vw, 19px)", color: "#888", maxWidth: 540, margin: "0 auto 40px", lineHeight: 1.7 },
    btnPrimary: { display: "inline-flex", alignItems: "center", gap: 8, background: "#f59e0b", color: "#000", padding: "14px 32px", borderRadius: 10, fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "'DM Mono',monospace", letterSpacing: "0.02em", transition: "all 0.15s" },
    btnGhost: { display: "inline-flex", alignItems: "center", background: "transparent", color: "#888", padding: "14px 24px", borderRadius: 10, fontSize: 14, fontWeight: 500, border: "1px solid #2a2a2a", cursor: "pointer", fontFamily: "'DM Mono',monospace", transition: "all 0.15s", textDecoration: "none" },
    section: { padding: "72px 24px", maxWidth: 1040, margin: "0 auto" },
    sectionLabel: { fontFamily: "'DM Mono',monospace", fontSize: 11, color: "#f59e0b", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 },
    h2: { fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 16, fontFamily: "'DM Mono',monospace" },
    card: { background: "#141414", border: "1px solid #222", borderRadius: 14, padding: "28px 24px" },
    featureGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 2, background: "#1a1a1a", borderRadius: 14, overflow: "hidden" },
    feature: { background: "#0a0a0a", padding: "32px 28px" },
    featureIcon: { width: 40, height: 40, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginBottom: 16 },
    pricingCard: { background: "#141414", border: "1px solid #222", borderRadius: 20, padding: "44px 36px", maxWidth: 440, margin: "0 auto", position: "relative", overflow: "hidden" },
  };

  if (screen === "login" || screen === "signup") {
    return <AuthScreen onAuth={onAuth} initialMode={screen === "signup" ? "signup" : "login"} onBack={() => setScreen("landing")} />;
  }

  return (
    <div style={LP.wrap}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;700&family=DM+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        .lp-btn-primary:hover{background:#fbbf24!important;transform:translateY(-2px);box-shadow:0 12px 32px rgba(245,158,11,0.3);}
        .lp-btn-ghost:hover{border-color:#f59e0b!important;color:#f59e0b!important;}
        .lp-feature:hover{background:#111!important;}
        .lp-trade-pill:hover{border-color:#f59e0b;color:#f59e0b;background:rgba(245,158,11,0.08);}
        .lp-plan-btn.active{border-color:#f59e0b!important;background:rgba(245,158,11,0.06)!important;}
      `}</style>

      {/* NAV */}
      <nav style={LP.nav}>
        <div style={LP.logo}><div style={LP.logoIcon}>TP</div>TRADE PA</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setScreen("login")} style={{ ...LP.btnGhost, padding: "8px 18px", fontSize: 13 }} className="lp-btn-ghost">Log in</button>
          <button onClick={() => window.location.href="/signup.html"} style={{ ...LP.btnPrimary, padding: "8px 20px", fontSize: 13 }} className="lp-btn-primary">Get started →</button>
        </div>
      </nav>

      {/* HERO */}
      <div style={LP.hero}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(245,158,11,0.04) 1px, transparent 1px),linear-gradient(90deg,rgba(245,158,11,0.04) 1px,transparent 1px)", backgroundSize: "56px 56px", WebkitMaskImage: "radial-gradient(ellipse at center, black 0%, transparent 70%)", maskImage: "radial-gradient(ellipse at center, black 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: 500, height: 500, background: "radial-gradient(circle, rgba(245,158,11,0.1) 0%, transparent 70%)", top: "50%", left: "50%", transform: "translate(-50%,-60%)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 100, padding: "6px 16px", fontFamily: "'DM Mono',monospace", fontSize: 11, color: "#f59e0b", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 28 }}>
            <div style={{ width: 6, height: 6, background: "#f59e0b", borderRadius: "50%", animation: "pulse 2s infinite" }} />
            Built for UK Tradespeople
          </div>
          <h1 style={LP.h1}>The admin assistant<br/><span style={{ color: "#f59e0b" }}>that works when you do.</span></h1>
          <p style={LP.sub}>Speak a quote into existence on the drive home. Dictate a Gas Safe cert on site. Let the AI handle your inbox while you're under a boiler. Trade PA does the work you don't have time for.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 16 }}>
            <button onClick={() => window.location.href="/signup.html"} style={LP.btnPrimary} className="lp-btn-primary">Get started — from £49/month →</button>
            <button onClick={() => setScreen("login")} style={LP.btnGhost} className="lp-btn-ghost">Log in</button>
          </div>
          <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "#555", letterSpacing: "0.06em" }}>Works with Gmail & Outlook · Built-in business phone · UK-built</p>
        </div>
      </div>

      {/* AI ACTIONS DEMO */}
      <div style={{ maxWidth: 680, margin: "0 auto 72px", padding: "0 24px" }}>
        <div style={{ background: "#141414", border: "1px solid #222", borderRadius: 16, padding: 20, boxShadow: "0 32px 80px rgba(0,0,0,0.5)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 14, borderBottom: "1px solid #1e1e1e", marginBottom: 14 }}>
            <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#ef4444" }} />
            <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#f59e0b" }} />
            <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#10b981" }} />
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "#444", marginLeft: 8 }}>Trade PA — AI Actions</span>
          </div>
          {[
            { icon: "📋", title: "Create an invoice & create a job — Lisa Thompson", body: "Is happy with quote for 42 Maple Avenue and would like to go ahead.", color: "#3b82f6" },
            { icon: "🔧", title: "Material — City Plumbing", body: "2× copper tube 22mm × 3m @ £29.70 — total £59.40. Upload invoice and create material note.", color: "#f59e0b" },
            { icon: "🏗", title: "CIS statement — ABC Construction", body: "Gross £4,200 · Deduction £840 · Net £3,360 — PDF attached.", color: "#10b981" },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.12)", borderRadius: 10, marginBottom: i < 2 ? 8 : 0 }}>
              <div style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: item.color, marginBottom: 2 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.body}</div>
              </div>
              <div style={{ background: "#10b981", color: "#000", padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono',monospace", flexShrink: 0 }}>✓ Approve</div>
            </div>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div style={{ ...LP.section, borderTop: "1px solid #1a1a1a" }}>
        <div style={LP.sectionLabel}>How it works</div>
        <h2 style={LP.h2}>Three taps.<br/>Everything handled.</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 2, background: "#1a1a1a", borderRadius: 14, overflow: "hidden", marginTop: 40 }}>
          {[
            { num: "01", icon: "📧", title: "Connect your inbox", body: "Link Gmail or Outlook in 30 seconds. Trade PA reads every email as it arrives." },
            { num: "02", icon: "🤖", title: "AI suggests actions", body: "New booking? Creates the job. CIS statement? Logs it. Payment in? Marks invoice paid." },
            { num: "03", icon: "⚡", title: "One tap to confirm", body: "Review what the AI suggests and approve. Reply emails send automatically." },
            { num: "04", icon: "🧠", title: "Gets smarter over time", body: "Dismiss something wrong, tell it why. It learns your suppliers, contractors, regulars." },
          ].map((s, i) => (
            <div key={i} style={{ background: "#0a0a0a", padding: "32px 24px" }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 52, fontWeight: 700, color: "rgba(245,158,11,0.07)", lineHeight: 1, marginBottom: 16 }}>{s.num}</div>
              <div style={{ fontSize: 24, marginBottom: 12 }}>{s.icon}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: "#666", lineHeight: 1.7 }}>{s.body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <div style={{ padding: "72px 24px", background: "#0d0d0d", borderTop: "1px solid #1a1a1a", borderBottom: "1px solid #1a1a1a" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto" }}>
          <div style={LP.sectionLabel}>Everything included</div>
          <h2 style={LP.h2}>The full toolkit.<br/>One price.</h2>
          <div style={{ ...LP.featureGrid, marginTop: 40 }}>
            {[
              { icon: "🎙", title: "Voice dictation everywhere", body: "Tap the mic on any form — jobs, quotes, invoices, certificates, time logs. Speak and the AI fills it in.", badge: "Unique to Trade PA", badgeColor: "#10b981", badgeBg: "rgba(16,185,129,0.1)", badgeBorder: "rgba(16,185,129,0.2)" },
              { icon: "📋", title: "All-trades certificates", body: "CP12, EICR, EIC, PAT, Pressure Test, Unvented HW, CD/11, CD/12, Fire Alarm, Emergency Lighting, Part P." },
              { icon: "🏗", title: "Deep CIS support", body: "Domestic Reverse Charge invoicing, UTR on all documents, CIS monthly statement logging with PDF storage." },
              { icon: "💷", title: "Quotes & invoices", body: "Professional branded documents sent from your Gmail or Outlook. Xero and QuickBooks sync built in." },
              { icon: "📅", title: "Jobs & scheduling", body: "Full job cards with notes, photos, time logs, variation orders, daywork sheets and customer sign-off." },
              { icon: "💸", title: "Overdue payment chasing", body: "Trade PA automatically sends professional chase emails weekly until overdue invoices are paid." },
              { icon: "📞", title: "Business phone, built in", body: "Get a dedicated business number that rings inside the app. Every call recorded, transcribed and AI-logged against the job. No second SIM needed.", badge: "Add-on · Any plan", badgeColor: "#f59e0b", badgeBg: "rgba(245,158,11,0.1)", badgeBorder: "rgba(245,158,11,0.2)" },
              { icon: "📍", title: "GPS job tracking", body: "Auto-arrives when you reach site, auto-logs your departure. Time tracked in the background while you work — no timesheets to fill in.", badge: "Team & Pro", badgeColor: "#3b82f6", badgeBg: "rgba(59,130,246,0.1)", badgeBorder: "rgba(59,130,246,0.2)" },
            ].map((f, i) => (
              <div key={i} style={{ ...LP.feature }} className="lp-feature">
                <div style={LP.featureIcon}>{f.icon}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: "#666", lineHeight: 1.7 }}>{f.body}</div>
                {f.badge && <div style={{ display: "inline-block", marginTop: 10, background: f.badgeBg, color: f.badgeColor, border: `1px solid ${f.badgeBorder}`, borderRadius: 100, fontFamily: "'DM Mono',monospace", fontSize: 9, padding: "3px 10px", letterSpacing: "0.06em", textTransform: "uppercase" }}>{f.badge}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* COMPARISON */}
      <div style={{ ...LP.section }}>
        <div style={LP.sectionLabel}>How we compare</div>
        <h2 style={LP.h2}>More intelligent.<br/>Better value.</h2>
        <p style={{ fontSize: 16, color: "#666", marginBottom: 40, lineHeight: 1.7, maxWidth: 560 }}>Tradify is £34/month with no AI. Trade PA Solo is £49/month — with an AI that runs your entire inbox, answers calls and tracks jobs for you.</p>
        <div style={{ background: "#141414", border: "1px solid #222", borderRadius: 14, overflow: "hidden" }}>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", borderBottom: "1px solid #222" }}>
            <div style={{ padding: "16px 20px" }} />
            <div style={{ padding: "16px 20px", fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#f59e0b", background: "rgba(245,158,11,0.08)", borderLeft: "1px solid rgba(245,158,11,0.2)", borderRight: "1px solid rgba(245,158,11,0.2)" }}>Trade PA</div>
            <div style={{ padding: "16px 20px", fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#555" }}>Tradify</div>
          </div>
          {[
            ["AI email agent (reads & processes inbox)", true, false],
            ["Built-in business phone with call recording", true, false],
            ["GPS job tracking & auto time logs", true, false],
            ["Voice dictation on all forms", true, false],
            ["AI that learns from your corrections", true, false],
            ["Domestic Reverse Charge invoicing", true, false],
            ["CIS statement storage with PDF", true, false],
            ["Quotes & invoicing", true, true],
            ["Digital certificates (CP12, EICR etc)", true, true],
            ["Xero & QuickBooks sync", true, true],
          ].map(([label, tp, tr], i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", borderBottom: i < 9 ? "1px solid #1e1e1e" : "none" }}>
              <div style={{ padding: "14px 20px", fontSize: 13, color: "#666" }}>{label}</div>
              <div style={{ padding: "14px 20px", fontSize: 16, background: "rgba(245,158,11,0.04)", borderLeft: "1px solid rgba(245,158,11,0.1)", borderRight: "1px solid rgba(245,158,11,0.1)", color: tp ? "#10b981" : "#444" }}>{tp ? "✓" : "✗"}</div>
              <div style={{ padding: "14px 20px", fontSize: 16, color: tr ? "#10b981" : "#444" }}>{tr ? "✓" : "✗"}</div>
            </div>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr" }}>
            <div style={{ padding: "14px 20px", fontSize: 13, color: "#666" }}>Monthly price (sole trader)</div>
            <div style={{ padding: "14px 20px", fontFamily: "'DM Mono',monospace", fontSize: 18, fontWeight: 700, color: "#f59e0b", background: "rgba(245,158,11,0.04)", borderLeft: "1px solid rgba(245,158,11,0.1)", borderRight: "1px solid rgba(245,158,11,0.1)" }}>from £49</div>
            <div style={{ padding: "14px 20px", fontSize: 13, color: "#555" }}>£34</div>
          </div>
        </div>
      </div>

      {/* TRADES */}
      <div style={LP.section}>
        <div style={LP.sectionLabel}>Every trade welcome</div>
        <h2 style={LP.h2}>Built for how<br/>you actually work.</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 32 }}>
          {["⚡ Electricians","🔧 Plumbers","🔥 Gas Engineers","🛢 Oil Heating","❄ HVAC","🏗 Builders","🪟 Window & Door","🎨 Decorators","🔩 Multi-trade","🏠 Property Maintenance","🌿 Landscapers","🪛 General Contractors"].map(t => (
            <div key={t} style={{ background: "#141414", border: "1px solid #222", borderRadius: 100, padding: "8px 16px", fontSize: 13, color: "#666", fontFamily: "'DM Mono',monospace", cursor: "default", transition: "all 0.15s" }} className="lp-trade-pill">{t}</div>
          ))}
        </div>
      </div>

      {/* PRICING */}
      <div style={{ padding: "72px 24px", background: "#0d0d0d", borderTop: "1px solid #1a1a1a", borderBottom: "1px solid #1a1a1a" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto" }}>
          <div style={{ ...LP.sectionLabel, textAlign: "center" }}>Pricing</div>
          <h2 style={{ ...LP.h2, textAlign: "center" }}>Plans for every tradesperson.</h2>
          <p style={{ fontSize: 17, color: "#666", margin: "0 auto 48px", maxWidth: 520, lineHeight: 1.7, textAlign: "center" }}>Start as a sole trader, scale as you grow. All plans include every feature.</p>

          {/* Three plan cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 32 }}>
            {[
              { name: "Solo", price: "£49", period: "/month", annual: "£500/year", users: "1 user", features: ["AI email agent","Voice dictation everywhere","All trade certificates","Jobs, quotes & invoices","CIS, DRC, Xero & QuickBooks","Overdue payment chasing","Annual service reminders","Digital signatures","Unlimited everything"], popular: false },
              { name: "Team", price: "£89", period: "/month", annual: "£890/year", users: "Up to 5 users", features: ["Everything in Solo","GPS job tracking","Job assignment to team","Team scheduling","Permission controls","Staff timesheets"], popular: true },
              { name: "Pro", price: "£129", period: "/month", annual: "£1,290/year", users: "Up to 10 users", features: ["Everything in Team","Up to 10 users","Priority support"], popular: false },
            ].map(plan => (
              <div key={plan.name} style={{ ...LP.pricingCard, maxWidth: "100%", border: plan.popular ? "2px solid #f59e0b" : "1px solid #222", position: "relative" }}>
                {plan.popular && <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#f59e0b", color: "#000", fontFamily: "'DM Mono',monospace", fontSize: 10, fontWeight: 700, padding: "3px 14px", borderRadius: 100, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>MOST POPULAR</div>}
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#f59e0b" }} />
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>{plan.name}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 52, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.03em", color: "#f59e0b", marginBottom: 4 }}>
                  {plan.price}<span style={{ fontSize: 16, color: "#666", fontWeight: 400 }}>{plan.period}</span>
                </div>
                <p style={{ color: "#666", fontSize: 12, marginBottom: 6 }}>{plan.annual}</p>
                <p style={{ color: "#f59e0b", fontSize: 12, fontFamily: "'DM Mono',monospace", marginBottom: 20 }}>{plan.users}</p>
                <ul style={{ listStyle: "none", textAlign: "left", display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#ccc" }}>
                      <span style={{ color: "#10b981", fontWeight: 700, flexShrink: 0 }}>✓</span>{f}
                    </li>
                  ))}
                </ul>
                <button onClick={() => window.location.href="/signup.html"} style={{ ...LP.btnPrimary, width: "100%", justifyContent: "center", fontSize: 14, padding: 14 }} className="lp-btn-primary">Get started →</button>
              </div>
            ))}
          </div>

          {/* Business Phone add-on */}
          <div style={{ background: "#141414", border: "1px solid #222", borderRadius: 16, padding: "32px 28px", textAlign: "center" }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>📞 Add-on · Any Plan</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Business Phone, Built In</div>
            <p style={{ color: "#666", fontSize: 14, maxWidth: 560, margin: "0 auto 24px", lineHeight: 1.7 }}>Get a dedicated business number that rings directly inside the Trade PA app — no second SIM, no extra hardware. Every call from a known customer is recorded, transcribed and automatically logged against their job. Missed a call? It falls back to your mobile so you never lose a lead.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, maxWidth: 700, margin: "0 auto 24px" }}>
              {[
                { icon: "📱", label: "Rings in Trade PA app", desc: "Answer without a second SIM" },
                { icon: "🎙️", label: "Auto-recorded & transcribed", desc: "AI logs every conversation" },
                { icon: "🔗", label: "Linked to jobs & customers", desc: "Full call history in one place" },
                { icon: "📲", label: "30s mobile fallback", desc: "Never miss a call on site" },
              ].map(({ icon, label, desc }) => (
                <div key={label} style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: "14px 12px", textAlign: "left" }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 700, color: "#f0f0f0", marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 11, color: "#555" }}>{desc}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, maxWidth: 640, margin: "0 auto 16px" }}>
              {[["100 mins","£20"],["300 mins","£40"],["600 mins","£65"],["Unlimited","£104"]].map(([mins, price]) => (
                <div key={mins} style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: "14px 12px" }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "#666", marginBottom: 6 }}>{mins}/month</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 700, color: "#f59e0b" }}>{price}</div>
                  <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>per month</div>
                </div>
              ))}
            </div>
            <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "#555" }}>Dedicated UK number included · Want to keep your existing number? We support porting · UK GDPR compliant</p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: "72px 24px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", width: 400, height: 400, background: "radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)", top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <h2 style={{ ...LP.h2, marginBottom: 20 }}>Stop doing admin<br/>after hours.</h2>
          <p style={{ fontSize: 17, color: "#666", marginBottom: 40, maxWidth: 440, margin: "0 auto 40px", lineHeight: 1.7 }}>Trade PA handles the calls, the paperwork and the chasing while you handle the jobs.</p>
          <button onClick={() => window.location.href="/signup.html"} style={{ ...LP.btnPrimary, fontSize: 16, padding: "16px 40px" }} className="lp-btn-primary">Get started →</button>
          <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "#555", marginTop: 16 }}>Works with Gmail · Works with Outlook · Built-in business phone · UK-built for UK trades</p>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ padding: "28px 28px", borderTop: "1px solid #1a1a1a", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div style={LP.logo}><div style={LP.logoIcon}>TP</div>TRADE PA</div>
        <div style={{ display: "flex", gap: 24 }}>
          {[["Privacy Policy","privacy-policy.html"],["Terms of Service","terms.html"],["Contact","mailto:hello@tradespa.co.uk"]].map(([l,h]) => (
            <a key={l} href={h} style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#555", textDecoration: "none" }}>{l}</a>
          ))}
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#444" }}>© 2026 Trade PA</div>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  );
}


function AuthScreen({ onAuth, initialMode = "login", onBack }) {
  const [mode, setMode] = useState(initialMode); // login | signup | reset
  const [form, setForm] = useState({ email: "", password: "", name: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const authStyles = {
    wrap: { minHeight: "100vh", background: "#0f0f0f", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono','Courier New',monospace", padding: 16 },
    box: { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 14, padding: 40, width: "100%", maxWidth: 400 },
    logo: { display: "flex", alignItems: "center", gap: 10, marginBottom: 32, justifyContent: "center" },
    logoIcon: { width: 36, height: 36, background: "#f59e0b", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: "#000", letterSpacing: "-0.02em" },
    logoText: { fontSize: 20, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.05em" },
    title: { fontSize: 16, fontWeight: 700, color: "#e5e5e5", marginBottom: 6, textAlign: "center" },
    sub: { fontSize: 12, color: "#6b7280", marginBottom: 28, textAlign: "center", lineHeight: 1.6 },
    label: { fontSize: 11, color: "#6b7280", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6, display: "block" },
    input: { width: "100%", background: "#242424", border: "1px solid #2a2a2a", borderRadius: 8, padding: "10px 14px", color: "#e5e5e5", fontSize: 13, fontFamily: "'DM Mono',monospace", outline: "none", boxSizing: "border-box", marginBottom: 16 },
    btn: { width: "100%", padding: "11px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontFamily: "'DM Mono',monospace", fontWeight: 700, letterSpacing: "0.04em", background: "#f59e0b", color: "#000", marginTop: 4 },
    ghost: { background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 12, fontFamily: "'DM Mono',monospace", textDecoration: "underline", padding: 0 },
    error: { background: "#ef444422", border: "1px solid #ef444444", borderRadius: 6, padding: "10px 14px", fontSize: 12, color: "#ef4444", marginBottom: 16, lineHeight: 1.5 },
    success: { background: "#10b98122", border: "1px solid #10b98144", borderRadius: 6, padding: "10px 14px", fontSize: 12, color: "#10b981", marginBottom: 16, lineHeight: 1.5 },
    divider: { display: "flex", alignItems: "center", gap: 12, margin: "20px 0" },
    dividerLine: { flex: 1, height: 1, background: "#2a2a2a" },
    dividerText: { fontSize: 11, color: "#6b7280" },
  };

  const handleLogin = async () => {
    if (!form.email || !form.password) { setError("Please enter your email and password."); return; }
    setLoading(true); setError("");
    const { data, error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
    if (error) setError(error.message);
    else onAuth(data.user);
    setLoading(false);
  };

  const handleSignup = async () => {
    if (!form.name) { setError("Please enter your name."); return; }
    if (!form.email) { setError("Please enter your email."); return; }
    if (form.password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (form.password !== form.confirm) { setError("Passwords don't match."); return; }
    setLoading(true); setError("");
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.name } }
    });
    if (error) setError(error.message);
    else if (data.user && !data.session) setError("Check your email to confirm your account, then log in.");
    else if (data.user) onAuth(data.user);
    setLoading(false);
  };

  const handleReset = async () => {
    if (!form.email) { setError("Please enter your email address."); return; }
    setLoading(true); setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
      redirectTo: window.location.origin,
    });
    if (error) setError(error.message);
    else setResetSent(true);
    setLoading(false);
  };

  const handleKey = (e, action) => { if (e.key === "Enter") action(); };

  return (
    <div style={authStyles.wrap}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;700&display=swap'); *{box-sizing:border-box;margin:0;padding:0;} input:focus{border-color:#f59e0b !important;outline:none;}`}</style>
      <div style={authStyles.box}>
        {onBack && (
          <button onClick={onBack} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 12, fontFamily: "'DM Mono',monospace", marginBottom: 20, display: "flex", alignItems: "center", gap: 6, padding: 0 }}>← Back to home</button>
        )}
        <div style={authStyles.logo}>
          <div style={authStyles.logoIcon}>TP</div>
          <div style={authStyles.logoText}>TRADE PA</div>
        </div>

        {mode === "login" && (
          <>
            <div style={authStyles.title}>Welcome back</div>
            <div style={authStyles.sub}>Sign in to your Trade PA account</div>
            {error && <div style={authStyles.error}>{error}</div>}
            <label style={authStyles.label}>Email</label>
            <input style={authStyles.input} type="email" placeholder="dave@davesplumbing.co.uk" value={form.email} onChange={set("email")} onKeyDown={e => handleKey(e, handleLogin)} autoComplete="email" />
            <label style={authStyles.label}>Password</label>
            <input style={authStyles.input} type="password" placeholder="••••••••" value={form.password} onChange={set("password")} onKeyDown={e => handleKey(e, handleLogin)} autoComplete="current-password" />
            <div style={{ textAlign: "right", marginTop: -10, marginBottom: 20 }}>
              <button style={authStyles.ghost} onClick={() => { setMode("reset"); setError(""); }}>Forgot password?</button>
            </div>
            <button style={{ ...authStyles.btn, opacity: loading ? 0.7 : 1 }} onClick={handleLogin} disabled={loading}>{loading ? "Signing in..." : "Sign In →"}</button>
            <div style={authStyles.divider}><div style={authStyles.dividerLine} /><div style={authStyles.dividerText}>or</div><div style={authStyles.dividerLine} /></div>
            <div style={{ textAlign: "center", fontSize: 12, color: "#6b7280" }}>
              New to Trade PA?{" "}
              <button style={{ ...authStyles.ghost, color: "#f59e0b" }} onClick={() => { setMode("signup"); setError(""); }}>Create an account</button>
            </div>
          </>
        )}

        {mode === "signup" && (
          <>
            <div style={authStyles.title}>Create your account</div>
            <div style={authStyles.sub}>Get Trade PA set up for your business in 30 seconds</div>
            {error && <div style={error.includes("Check your email") ? authStyles.success : authStyles.error}>{error}</div>}
            <label style={authStyles.label}>Your Name</label>
            <input style={authStyles.input} placeholder="Dave Hughes" value={form.name} onChange={set("name")} autoComplete="name" />
            <label style={authStyles.label}>Email Address</label>
            <input style={authStyles.input} type="email" placeholder="dave@davesplumbing.co.uk" value={form.email} onChange={set("email")} autoComplete="email" />
            <label style={authStyles.label}>Password</label>
            <input style={authStyles.input} type="password" placeholder="Min. 6 characters" value={form.password} onChange={set("password")} autoComplete="new-password" />
            <label style={authStyles.label}>Confirm Password</label>
            <input style={authStyles.input} type="password" placeholder="Repeat password" value={form.confirm} onChange={set("confirm")} onKeyDown={e => handleKey(e, handleSignup)} autoComplete="new-password" />
            <button style={{ ...authStyles.btn, opacity: loading ? 0.7 : 1 }} onClick={handleSignup} disabled={loading}>{loading ? "Creating account..." : "Create Account →"}</button>
            <div style={{ ...authStyles.divider }}><div style={authStyles.dividerLine} /><div style={authStyles.dividerText}>or</div><div style={authStyles.dividerLine} /></div>
            <div style={{ textAlign: "center", fontSize: 12, color: "#6b7280" }}>
              Already have an account?{" "}
              <button style={{ ...authStyles.ghost, color: "#f59e0b" }} onClick={() => { setMode("login"); setError(""); }}>Sign in</button>
            </div>
          </>
        )}

        {mode === "reset" && (
          <>
            <div style={authStyles.title}>Reset password</div>
            <div style={authStyles.sub}>Enter your email and we'll send a reset link</div>
            {error && <div style={authStyles.error}>{error}</div>}
            {resetSent
              ? <div style={authStyles.success}>✓ Reset link sent — check your email inbox.</div>
              : <>
                  <label style={authStyles.label}>Email Address</label>
                  <input style={authStyles.input} type="email" placeholder="dave@davesplumbing.co.uk" value={form.email} onChange={set("email")} onKeyDown={e => handleKey(e, handleReset)} />
                  <button style={{ ...authStyles.btn, opacity: loading ? 0.7 : 1 }} onClick={handleReset} disabled={loading}>{loading ? "Sending..." : "Send Reset Link →"}</button>
                </>
            }
            <div style={{ ...authStyles.divider }}><div style={authStyles.dividerLine} /><div style={authStyles.dividerText}>or</div><div style={authStyles.dividerLine} /></div>
            <div style={{ textAlign: "center", fontSize: 12, color: "#6b7280" }}>
              <button style={{ ...authStyles.ghost, color: "#f59e0b" }} onClick={() => { setMode("login"); setError(""); setResetSent(false); }}>Back to sign in</button>
            </div>
          </>
        )}

        <div style={{ marginTop: 28, padding: "14px 16px", background: "#242424", borderRadius: 8, fontSize: 11, color: "#4b5563", lineHeight: 1.6 }}>
          🔒 Your data is private and only visible to you. Each account is completely separate.
        </div>
      </div>
    </div>
  );
}
// ─── Whisper Voice Recording Hook ─────────────────────────────────────────────
function useWhisper(onTranscript) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const startRecording = async () => {
    try {
      // Must be called directly from user gesture — no await before getUserMedia
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // iOS Safari only supports mp4, Chrome/Firefox support webm
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size < 500) { setTranscribing(false); return; }
        setTranscribing(true);
        try {
          const ext = mimeType.includes("webm") ? "webm" : "mp4";
          const fd = new FormData();
          fd.append("file", blob, `rec.${ext}`);
          fd.append("model", "whisper-1");
          fd.append("language", "en");
          const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${import.meta.env.VITE_OPENAI_KEY}` },
            body: fd,
          });
          const data = await res.json();
          if (data.text) onTranscript(data.text.trim());
        } catch (e) { console.error("Whisper:", e); }
        setTranscribing(false);
      };

      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch (err) {
      console.error("Mic:", err);
      if (err.name === "NotAllowedError") {
        alert("Microphone blocked.\n\nOn iPhone: Settings → Safari → Microphone → Allow your site.\n\nThen reload and try again.");
      } else {
        alert(`Mic error: ${err.message}`);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  // Tap toggle — tap once to start, tap again to stop and transcribe
  const toggle = () => {
    if (recording) stopRecording();
    else startRecording();
  };

  return { recording, transcribing, toggle };
}

const C = {
  bg: "#0f0f0f", surface: "#1a1a1a", surfaceHigh: "#242424",
  border: "#2a2a2a", amber: "#f59e0b", amberDim: "#92400e",
  green: "#10b981", red: "#ef4444", blue: "#3b82f6", purple: "#8b5cf6",
  muted: "#6b7280", text: "#e5e5e5", textDim: "#9ca3af",
};

const S = {
  app: { fontFamily: "'DM Mono','Courier New',monospace", background: C.bg, minHeight: "-webkit-fill-available", color: C.text, width: "100%", overflowX: "hidden" },
  header: { background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 12px", paddingTop: "env(safe-area-inset-top, 0px)", display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 56, position: "sticky", top: 0, zIndex: 100, width: "100%", boxSizing: "border-box" },
  logo: { display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", color: C.amber },
  logoIcon: { width: 28, height: 28, background: C.amber, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: "#000", fontSize: 10, fontWeight: 900, letterSpacing: "-0.02em", flexShrink: 0 },
  nav: { display: "flex", gap: 2, overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", flexShrink: 0 },
  navBtn: (a) => ({ padding: "6px 8px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 10, fontFamily: "'DM Mono',monospace", fontWeight: a ? 700 : 400, letterSpacing: "0.04em", background: a ? C.amber : "transparent", color: a ? "#000" : C.textDim, transition: "all 0.15s", whiteSpace: "nowrap", flexShrink: 0 }),
  main: { flex: 1, padding: "12px", maxWidth: 600, width: "100%", margin: "0 auto", boxSizing: "border-box", overflowX: "hidden" },
  card: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, minWidth: 0, boxSizing: "border-box" },
  grid2: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 },
  grid3: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 },
  grid4: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 },
  sectionTitle: { fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginBottom: 14 },
  badge: (color) => ({ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", background: color + "22", color, border: `1px solid ${color}44`, whiteSpace: "nowrap" }),
  pill: (color, active) => ({ padding: "6px 12px", borderRadius: 6, border: `1px solid ${active ? color : C.border}`, background: active ? color + "22" : C.surfaceHigh, color: active ? color : C.textDim, cursor: "pointer", fontSize: 11, fontFamily: "'DM Mono',monospace", fontWeight: 600 }),
  btn: (v = "primary", dis = false) => ({ padding: "8px 14px", borderRadius: 6, border: v === "ghost" ? `1px solid ${C.border}` : "none", cursor: dis ? "not-allowed" : "pointer", fontSize: 11, fontFamily: "'DM Mono',monospace", fontWeight: 600, letterSpacing: "0.04em", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6, background: dis ? C.surfaceHigh : v === "primary" ? C.amber : v === "stripe" ? "#635bff" : v === "danger" ? C.red : v === "green" ? C.green : C.surfaceHigh, color: dis ? C.muted : v === "primary" ? "#000" : v === "green" ? "#000" : C.text, opacity: dis ? 0.6 : 1, transition: "all 0.15s", flexShrink: 0 }),
  input: { width: "100%", background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", color: C.text, fontSize: 13, fontFamily: "'DM Mono',monospace", outline: "none", boxSizing: "border-box" },
  label: { fontSize: 11, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6, display: "block" },
  row: { display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderBottom: `1px solid ${C.border}`, minWidth: 0, overflow: "hidden" },
  statCard: (accent) => ({ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${accent}`, borderRadius: 10, padding: 16 }),
  aiMsg: (r) => ({ display: "flex", gap: 10, marginBottom: 16, flexDirection: r === "user" ? "row-reverse" : "row" }),
  aiBubble: (r) => ({ maxWidth: "85%", padding: "10px 14px", borderRadius: r === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px", background: r === "user" ? C.amberDim : C.surfaceHigh, border: `1px solid ${r === "user" ? C.amber + "44" : C.border}`, fontSize: 13, lineHeight: 1.6, color: C.text, whiteSpace: "pre-wrap" }),
  avatar: (r) => ({ width: 28, height: 28, borderRadius: "50%", background: r === "user" ? C.amber : C.surface, border: `1px solid ${r === "user" ? C.amber : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: r === "user" ? "#000" : C.amber, flexShrink: 0 }),
};

const JOBS = [];
const INVOICES_INIT = [];
const ENQUIRIES = [];
const MATERIALS = [];
const statusColor = { confirmed: C.green, pending: C.amber, quote_sent: C.blue, overdue: C.red, due: C.amber, paid: C.green, to_order: C.red, ordered: C.amber, collected: C.green, sent: C.amber, draft: C.muted };
const statusLabel = { confirmed: "Confirmed", pending: "Pending", quote_sent: "Quote Sent", overdue: "Overdue", due: "Due Today", paid: "Paid", to_order: "To Order", ordered: "Ordered", collected: "Collected", sent: "Sent", draft: "Draft" };

const DEFAULT_BRAND = {
  logo: null,
  tradingName: "",
  tagline: "",
  phone: "",
  email: "",
  website: "",
  address: "",
  // Trade types (which registrations to show)
  tradeTypes: [],             // e.g. ["gas","electrical","oil","renewables","plumbing","glazing"]
  // Registration numbers — fed onto certificates automatically
  gasSafeNumber: "",          // Gas Safe Register — gas certs
  gasSafeLogo: null,
  niceicNumber: "",            // NICEIC — electrical certs
  napitNumber: "",             // NAPIT — electrical certs (alternative to NICEIC)
  elecsaNumber: "",            // ELECSA — electrical certs (alternative)
  oftecNumber: "",             // OFTEC — oil certs
  hetasNumber: "",             // HETAS — solid fuel certs
  fgasNumber: "",              // F-Gas — refrigeration/AC/heat pump certs
  mcsNumber: "",               // MCS — renewables certs
  aphcNumber: "",              // APHC/WaterSafe — plumbing certs
  fensaNumber: "",             // FENSA — window/glazing certs
  cscsNumber: "",              // CSCS card — general building
  // Verification status (stored per field)
  registrationVerifications: {}, // { gasSafeNumber: { verified: true, date: "2026-04-03", method: "manual" } }
  // Certificate numbering
  certNextNumber: 1,
  certPrefix: "CERT",
  // Financial
  gasSafeLogo: null,
  vatNumber: "",
  utrNumber: "",
  bankName: "",
  sortCode: "",
  accountNumber: "",
  accountName: "",
  accentColor: "#f59e0b",
  paymentTerms: "14",
  invoiceNote: "Thank you for your business. Payment due within 30 days.",
  refFormat: "invoice_number",
  refPrefix: "",
  defaultPaymentMethod: "both",
};

// Helper: build the payment reference string for a given invoice
function vatLabel(inv) {
  if (!inv.vatEnabled) return "";
  if (inv.vatZeroRated) return "Zero Rate 0% — New Build";
  const t = inv.vatType || "income";
  const r = inv.vatRate || 20;
  if (t === "drc_income") return `Domestic Reverse Charge @ ${r}% Income`;
  if (t === "drc_expenses") return `Domestic Reverse Charge @ ${r}% Expenses`;
  if (t === "expenses") return `${r}% Expenses`;
  return `${r}% Income`;
}

function buildRef(brand, inv) {
  const num = (inv.id || "INV-001").replace(/\D/g, "");
  const surname = (inv.customer || "").split(" ").pop().toUpperCase();
  switch (brand.refFormat) {
    case "surname_invoice": return `${surname}-${inv.id || "INV-001"}`;
    case "custom_prefix":   return `${brand.refPrefix || "REF"}-${num}`;
    case "number_only":     return num;
    default:                return inv.id || "INV-001";
  }
}

// ─── PDF Generator ────────────────────────────────────────────────────────────
function downloadInvoicePDF(brand, inv) {
  try {
  const accent = brand.accentColor || "#f59e0b";
  const ref = buildRef(brand, inv);
  const payMethod = inv.paymentMethod || brand.defaultPaymentMethod || "both";
  const showBacs = payMethod === "bacs" || payMethod === "both";
  const showCard = payMethod === "card" || payMethod === "both";
  const vatEnabled = inv.vatEnabled && brand.vatNumber;
  const vatRate = Number(inv.vatZeroRated ? 0 : (inv.vatRate || 20));
  const grossAmount = parseFloat(inv.grossAmount || inv.amount) || 0;
  const netAmount = (vatEnabled && !inv.vatZeroRated) ? parseFloat((grossAmount / (1 + vatRate / 100)).toFixed(2)) : grossAmount;
  const vatAmount = (vatEnabled && !inv.vatZeroRated) ? parseFloat((grossAmount - netAmount).toFixed(2)) : 0;
  const date = inv.date || new Date().toLocaleDateString("en-GB");
  const isQuote = inv.isQuote;
  const cisEnabled = inv.cisEnabled;
  const cisLabour = parseFloat(inv.cisLabour) || 0;
  const cisMaterials = parseFloat(inv.cisMaterials) || 0;
  const cisGross = cisLabour + cisMaterials;
  const cisDeduction = parseFloat(inv.cisDeduction) || 0;
  const cisNetPayable = parseFloat(inv.cisNetPayable) || 0;
  const cisRate = Number(inv.cisRate) || 20;

  const rawDesc = inv.desc || inv.description || "Service";

  // Parse line items — support stored lineItems array, or pipe-separated "desc|amount" format, or plain text
  let lineItems;
  if (cisEnabled) {
    // CIS invoices: labour as single line, materials as individual items
    lineItems = [];
    if (cisLabour > 0) lineItems.push({ description: "Labour", amount: cisLabour });
    const matItems = inv.materialItems && inv.materialItems.filter(m => m.desc || m.description).length > 0
      ? inv.materialItems.filter(m => m.desc || m.description)
      : cisMaterials > 0 ? [{ description: "Materials", amount: cisMaterials }] : [];
    matItems.forEach(m => lineItems.push({ description: m.description || m.desc, amount: parseFloat(m.amount) || 0 }));
    if (lineItems.length === 0) lineItems.push({ description: rawDesc, amount: grossAmount });
  } else if (inv.lineItems && inv.lineItems.length > 0) {
    lineItems = inv.lineItems.map(l => ({
      description: l.description || l.desc || "",
      amount: l.amount !== "" && l.amount != null && !isNaN(parseFloat(l.amount)) ? parseFloat(l.amount) : null,
    })).filter(l => l.description);
  } else {
    lineItems = rawDesc
      .split(/\n|;\s*/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => {
        const pipeIdx = s.lastIndexOf("|");
        if (pipeIdx > 0) {
          const desc = s.slice(0, pipeIdx).trim();
          const amt = parseFloat(s.slice(pipeIdx + 1));
          if (!isNaN(amt)) return { description: desc, amount: amt };
        }
        return { description: s, amount: null };
      });
  }

  // If only one item with no price, use the total
  if (!cisEnabled && lineItems.length === 1 && lineItems[0].amount === null) {
    lineItems[0].amount = grossAmount;
  }

  const hasIndividualPrices = lineItems.some(l => l.amount !== null && lineItems.length > 1);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${isQuote ? "Quote" : "Invoice"} ${inv.id} — ${inv.customer}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:Arial,sans-serif;color:#1a1a1a;background:#fff;padding:0;}
  .page{max-width:800px;margin:0 auto;padding:0;}
  .header{background:${accent};padding:28px 36px;display:flex;justify-content:space-between;align-items:flex-start;}
  .header-left .biz-name{font-size:22px;font-weight:700;color:#fff;margin-bottom:4px;}
  .header-left .tagline{font-size:12px;color:rgba(255,255,255,0.8);}
  .header-right{text-align:right;}
  .header-right .doc-type{font-size:24px;font-weight:700;color:#fff;letter-spacing:0.05em;}
  .header-right .doc-id{font-size:14px;color:rgba(255,255,255,0.8);margin-top:4px;}
  .logo{max-height:60px;max-width:180px;object-fit:contain;margin-bottom:6px;display:block;}
  .infobar{background:#f8f8f8;padding:12px 36px;display:flex;justify-content:space-between;border-bottom:1px solid #eee;font-size:12px;}
  .infobar span{color:#999;margin-right:4px;}
  .addresses{padding:24px 36px;display:grid;grid-template-columns:1fr 1fr;gap:28px;border-bottom:1px solid #eee;}
  .addr-label{font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px;}
  .addr-name{font-size:14px;font-weight:700;margin-bottom:4px;}
  .addr-detail{font-size:12px;color:#555;line-height:1.7;}
  .addr-accent{color:${accent};}
  .items{padding:0 36px;}
  table{width:100%;border-collapse:collapse;}
  th{text-align:left;padding:12px 0 8px;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#999;font-weight:400;border-bottom:2px solid ${accent};}
  th.right,td.right{text-align:right;}
  td{padding:11px 0;font-size:13px;border-bottom:1px solid #f0f0f0;}
  td.muted{color:#999;}
  .totals{padding:12px 36px 0;display:flex;flex-direction:column;align-items:flex-end;gap:5px;border-top:2px solid ${accent};margin:0 36px;}
  .total-row{display:flex;gap:40px;font-size:13px;color:#888;}
  .total-row.grand{font-size:20px;font-weight:700;color:${accent};border-top:1px solid #eee;padding-top:8px;margin-top:4px;}
  .payment{margin:16px 36px 0;display:flex;flex-direction:column;gap:10px;}
  .pay-block{background:#f8f8f8;border-radius:6px;padding:14px 16px;border:1px solid #eee;}
  .pay-block.stripe{background:rgba(99,91,255,0.06);border-color:rgba(99,91,255,0.2);}
  .pay-title{font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#888;margin-bottom:10px;}
  .pay-title.stripe-title{color:#635bff;}
  .pay-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px 20px;font-size:12px;color:#555;}
  .pay-grid strong{color:#1a1a1a;}
  .ref-box{margin-top:10px;padding:8px 12px;background:${accent}18;border-radius:4px;border:1px solid ${accent}44;font-size:12px;}
  .ref-box span{color:#999;}
  .ref-box strong{letter-spacing:0.04em;}
  .ref-box small{color:#bbb;margin-left:8px;}
  .stripe-btn{display:inline-block;padding:8px 20px;background:#635bff;border-radius:5px;font-size:12px;font-weight:700;color:#fff;margin-top:10px;}
  .stripe-url{font-size:10px;color:#bbb;margin-top:6px;}
  .note{font-size:11px;color:#999;margin-top:4px;}
  .footer{background:${accent}18;padding:10px 36px;display:flex;justify-content:space-between;border-top:1px solid ${accent}44;font-size:11px;color:#888;margin-top:20px;}
  .validity{background:#fff8e8;border:1px solid ${accent}44;border-radius:6px;padding:10px 16px;margin:0 36px;font-size:12px;color:#888;}
  @media print{
    .back-bar{display:none !important;}
    body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  }
  .back-bar{background:#1a1a1a;padding:max(10px, env(safe-area-inset-top, 10px)) 36px 10px;display:flex;gap:16px;align-items:center;position:sticky;top:0;z-index:10;}
  .back-bar a{color:#f59e0b;font-size:13px;text-decoration:none;font-weight:600;cursor:pointer;}
</style>
</head>
<body>
<div class="back-bar">
  <a onclick="try{window.parent.postMessage('close-pdf','*')}catch(e){}; try{if(window.opener||window.history.length<=1){window.close();}else{window.history.back();}}catch(e){}">← Back to Trade PA</a>
  <a onclick="window.print()" style="color:#aaa;">🖨 Print / Save PDF</a>
</div>
<div class="page">
  <div class="header">
    <div class="header-left">
      ${brand.logo ? `<img src="${brand.logo}" class="logo" alt="logo"/>` : `<div class="biz-name">${brand.tradingName}</div>`}
      ${brand.tagline ? `<div class="tagline">${brand.tagline}</div>` : ""}
    </div>
    <div class="header-right">
      <div class="doc-type">${isQuote ? "QUOTE" : "INVOICE"}</div>
      <div class="doc-id">${inv.id}</div>
    </div>
  </div>

  <div class="infobar">
    <div>
      <div><span>Date:</span>${date}</div>
      <div style="margin-top:3px"><span>${isQuote ? "Valid for:" : "Payment due:"}</span>${isQuote ? (inv.due || "30 days") : (inv.due || `${brand.paymentTerms || 30} days`)}</div>
    </div>
    ${(brand.vatNumber && (brand._exemptBypass || brand.registrationVerifications?.vatNumber?.verified)) ? `<div><span>VAT No:</span>${brand.vatNumber}</div>` : ""}
    <div><span>Ref:</span>${ref}</div>
    ${inv.jobRef ? `<div><span>Job Ref:</span>${inv.jobRef}</div>` : ""}
    ${inv.poNumber ? `<div><span>PO Number:</span>${inv.poNumber}</div>` : ""}
  </div>

  <div class="addresses">
    <div>
      <div class="addr-label">From</div>
      <div class="addr-name">${brand.tradingName}</div>
      <div class="addr-detail" style="white-space:pre-line">${brand.address || ""}</div>
      ${brand.phone ? `<div class="addr-detail">${brand.phone}</div>` : ""}
      ${brand.email ? `<div class="addr-detail addr-accent">${brand.email}</div>` : ""}
      ${brand.gasSafeNumber ? `<div class="addr-detail" style="font-size:11px;color:#999;margin-top:6px">Gas Safe: ${brand.gasSafeNumber}</div>` : ""}
      ${brand.utrNumber ? `<div class="addr-detail" style="font-size:11px;color:#999;margin-top:2px">UTR: ${brand.utrNumber}</div>` : ""}
    </div>
    <div>
      <div class="addr-label">To</div>
      <div class="addr-name">${inv.customer}</div>
      <div class="addr-detail" style="white-space:pre-line">${inv.address || ""}</div>
    </div>
  </div>

  <div class="items">
    <table>
      <thead>
        <tr>
          <th>Description</th>
          ${cisEnabled ? `<th class="right">Amount</th>` : vatEnabled ? `<th class="right">Net</th><th class="right">VAT ${vatRate}%</th><th class="right">Gross</th>` : `<th class="right">Amount</th>`}
        </tr>
      </thead>
      <tbody>
        ${lineItems.map((line, i) => {
          const isLast = i === lineItems.length - 1;
          const lineAmt = line.amount !== null && line.amount !== undefined ? Number(line.amount) : (isLast && !hasIndividualPrices ? grossAmount : null);
          const lineNet = !cisEnabled && vatEnabled && lineAmt !== null ? parseFloat((lineAmt / (1 + vatRate / 100)).toFixed(2)) : null;
          const lineVat = !cisEnabled && vatEnabled && lineAmt !== null ? parseFloat((lineAmt - lineNet).toFixed(2)) : null;
          return `
        <tr>
          <td>${line.description || line}</td>
          ${cisEnabled
            ? `<td class="right">${lineAmt !== null ? "£" + Number(lineAmt).toFixed(2) : "—"}</td>`
            : vatEnabled
              ? `<td class="right">${lineNet !== null ? "£" + Number(lineNet).toFixed(2) : "—"}</td>
                 <td class="right">${lineVat !== null ? "£" + Number(lineVat).toFixed(2) : "—"}</td>
                 <td class="right">${lineAmt !== null ? "£" + Number(lineAmt).toFixed(2) : "—"}</td>`
              : `<td class="right">${lineAmt !== null ? "£" + Number(lineAmt).toFixed(2) : "—"}</td>`
          }
        </tr>`;
        }).join("")}
      </tbody>
    </table>
  </div>

  <div class="totals">
    ${cisEnabled ? (() => {
      const isDrc = (inv.vatType || "").includes("drc");
      const cisVat = vatEnabled && !isDrc ? parseFloat((cisGross * vatRate / 100).toFixed(2)) : 0;
      const cisNetTotal = cisGross + cisVat - cisDeduction;
      return `
    <div class="total-row"><span>Labour</span><span>£${cisLabour.toFixed(2)}</span></div>
    ${cisMaterials > 0 ? `<div class="total-row"><span>Materials (no CIS deduction)</span><span>£${cisMaterials.toFixed(2)}</span></div>` : ""}
    <div class="total-row"><span>Gross (labour + materials)</span><span>£${cisGross.toFixed(2)}</span></div>
    ${vatEnabled && !isDrc ? `<div class="total-row"><span>${vatLabel(inv)}</span><span>£${cisVat.toFixed(2)}</span></div>` : ""}
    ${vatEnabled && isDrc ? `<div class="total-row" style="color:#888"><span>${vatLabel(inv)} — contractor accounts for VAT</span><span>£0.00</span></div>` : ""}
    <div class="total-row" style="color:#c0392b"><span>CIS Deduction @ ${cisRate}% (labour only)</span><span>-£${cisDeduction.toFixed(2)}</span></div>
    <div class="total-row grand"><span>Net Amount Payable</span><span>£${cisNetTotal.toFixed(2)}</span></div>`;
    })() : vatEnabled ? `
    <div class="total-row"><span>Net amount</span><span>£${netAmount.toFixed(2)}</span></div>
    <div class="total-row"><span>${vatLabel(inv)}</span><span>£${vatAmount.toFixed(2)}</span></div>
    <div class="total-row grand"><span>${isQuote ? "Quote Total (inc. VAT)" : "Total Due (inc. VAT)"}</span><span>£${grossAmount.toFixed(2)}</span></div>
    ` : `
    <div class="total-row grand"><span>${isQuote ? "Quote Total" : "Total Due"}</span><span>£${grossAmount.toFixed(2)}</span></div>
    `}
    ${cisEnabled ? `<div style="font-size:10px;color:#888;margin-top:8px;padding-top:8px;border-top:1px solid #eee">CIS tax deducted by contractor under the Construction Industry Scheme. This statement will be provided by the contractor.</div>` : ""}
    ${inv.vatZeroRated ? `<div style="font-size:10px;color:#888;margin-top:8px">Zero-rated VAT — new residential construction (VATA 1994, Group 5)</div>` : ""}
  </div>

  ${isQuote ? `
  <div class="validity">
    This quote is valid for 30 days from the date above. Prices may be subject to change after this period. Please contact us to proceed or if you have any questions.
  </div>` : ""}

  <div class="payment">
    ${!isQuote && showBacs && brand.bankName ? `
    <div class="pay-block">
      <div class="pay-title">${showCard ? "Option 1 — Pay by Bank Transfer (BACS)" : "Pay by Bank Transfer (BACS)"}</div>
      <div class="pay-grid">
        <div><span style="color:#999">Bank: </span><strong>${brand.bankName}</strong></div>
        <div><span style="color:#999">Account name: </span><strong>${brand.accountName}</strong></div>
        <div><span style="color:#999">Sort code: </span><strong>${brand.sortCode}</strong></div>
        <div><span style="color:#999">Account no: </span><strong>${brand.accountNumber}</strong></div>
      </div>
      <div class="ref-box">
        <span>Payment reference: </span><strong>${ref}</strong><small>(please use exactly as shown)</small>
      </div>
    </div>` : ""}

    ${!isQuote && showCard ? `
    <div class="pay-block stripe">
      <div class="pay-title stripe-title">${showBacs ? "Option 2 — Pay by Card (Stripe)" : "Pay by Card (Stripe)"}</div>
      <div style="font-size:12px;color:#555;margin-bottom:10px">Pay securely online by debit or credit card. Takes 30 seconds.</div>
      <div class="stripe-btn">Pay £${grossAmount.toFixed(2)} online</div>
      <div class="stripe-url">Payment link sent separately by email</div>
    </div>` : ""}

    <div class="note">${brand.invoiceNote || ""}</div>
  </div>

  <div class="footer">
    ${brand.website ? `<span>${brand.website}</span>` : "<span></span>"}
    ${brand.phone ? `<span>${brand.phone}</span>` : "<span></span>"}
    ${brand.email ? `<span>${brand.email}</span>` : "<span></span>"}
  </div>

  <!-- Back to app button — hidden when printing -->
  <div class="no-print" style="text-align:center;padding:20px;margin-top:10px;">
    <button onclick="try{window.parent.postMessage('close-pdf','*')}catch(e){}; try{if(window.opener||window.history.length<=1){window.close();}else{window.history.back();}}catch(e){}" style="padding:10px 24px;background:#f59e0b;color:#000;border:none;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;margin-right:10px;">← Back to Trade PA</button>
    <button onclick="window.print()" style="padding:10px 24px;background:#1a1a1a;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;">🖨 Print / Save PDF</button>
  </div>
</div>
</body>
</html>`;

  // iOS PWA mode (navigator.standalone) skips window.open entirely
  const isIOSPWA = window.navigator.standalone === true;

  if (!isIOSPWA) {
    try {
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(html);
        win.document.close();
        return;
      }
    } catch (e) {}
  }

  // Fallback: React PDFOverlay via custom event
  window.dispatchEvent(new CustomEvent("trade-pa-show-pdf", { detail: html }));

  } catch (err) {
    console.error("PDF generation error:", err);
    alert("Could not generate PDF: " + err.message);
  }
}

// ─── PDF Overlay (iOS PWA fallback) ──────────────────────────────────────────
function PDFOverlay({ html, onClose }) {
  const iframeRef = useRef();
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) { doc.open(); doc.write(html); doc.close(); }
  }, [html]);
  useEffect(() => {
    const handler = (e) => { if (e.data === "close-pdf") onClose(); };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onClose]);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", flexDirection: "column", background: "#fff" }}>
      <div style={{ display: "flex", gap: 8, padding: "12px 16px", background: "#1a1a1a", flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: C.amber, border: "none", padding: "10px 18px", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: 14, color: "#000" }}>✕ Close</button>
        <button onClick={() => { try { iframeRef.current?.contentWindow?.print(); } catch(e) {} }} style={{ background: "#444", color: "#fff", border: "none", padding: "10px 18px", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>🖨 Print / Save</button>
      </div>
      <iframe ref={iframeRef} style={{ flex: 1, border: "none", width: "100%" }} />
    </div>
  );
}

// ─── Invoice Preview ──────────────────────────────────────────────────────────
function InvoicePreview({ brand, invoice }) {
  const inv = invoice || { id: "INV-042", customer: "John Smith", address: "5 High Street\nGuildford GU1 3AA", desc: "Annual boiler service\nFlue check and clean\nPressure test", amount: 120, date: new Date().toLocaleDateString("en-GB"), due: "30 days", paymentMethod: brand.defaultPaymentMethod || "both", vatEnabled: false };
  const accent = brand.accentColor || "#f59e0b";
  const ref = buildRef(brand, inv);
  const payMethod = inv.paymentMethod || brand.defaultPaymentMethod || "both";
  const showBacs = payMethod === "bacs" || payMethod === "both";
  const showCard = payMethod === "card" || payMethod === "both";

  // VAT calculations — only if VAT number is set AND invoice has VAT enabled
  const vatEnabled = inv.vatEnabled && brand.vatNumber;
  const vatRate = inv.vatRate || 20;
  const netAmount = vatEnabled ? parseFloat((inv.amount / (1 + vatRate / 100)).toFixed(2)) : inv.amount;
  const vatAmount = vatEnabled ? parseFloat((inv.amount - netAmount).toFixed(2)) : 0;
  const grossAmount = inv.amount;

  return (
    <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden", fontFamily: "Georgia, serif", color: "#1a1a1a", boxShadow: "0 4px 24px #0008", maxWidth: 560, width: "100%" }}>
      {/* Header */}
      <div style={{ background: accent, padding: "24px 28px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          {brand.logo
            ? <img src={brand.logo} alt="logo" style={{ maxHeight: 56, maxWidth: 160, objectFit: "contain", marginBottom: 6, display: "block" }} />
            : <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em", marginBottom: 4 }}>{brand.tradingName}</div>}
          {brand.tagline && <div style={{ fontSize: 11, color: "#ffffffcc", fontFamily: "Arial,sans-serif" }}>{brand.tagline}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "0.05em" }}>INVOICE</div>
          <div style={{ fontSize: 13, color: "#ffffffcc", fontFamily: "Arial,sans-serif", marginTop: 4 }}>{inv.id}</div>
        </div>
      </div>

      {/* Info bar */}
      <div style={{ background: "#f8f8f8", padding: "14px 28px", display: "flex", justifyContent: "space-between", borderBottom: "1px solid #eee" }}>
        <div style={{ fontFamily: "Arial,sans-serif", fontSize: 12 }}>
          <span style={{ color: "#888", marginRight: 6 }}>Date:</span>{inv.date}
        </div>
        <div style={{ fontFamily: "Arial,sans-serif", fontSize: 12 }}>
          <span style={{ color: "#888", marginRight: 6 }}>Payment due:</span>{brand.paymentTerms || "30"} days
        </div>
        {brand.vatNumber && (brand._exemptBypass || brand.registrationVerifications?.vatNumber?.verified) && (
          <div style={{ fontFamily: "Arial,sans-serif", fontSize: 12 }}>
            <span style={{ color: "#888", marginRight: 6 }}>VAT No:</span>{brand.vatNumber}
          </div>
        )}
      </div>

      {/* Addresses */}
      <div style={{ padding: "20px 28px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, borderBottom: "1px solid #eee" }}>
        <div>
          <div style={{ fontSize: 10, fontFamily: "Arial,sans-serif", textTransform: "uppercase", letterSpacing: "0.08em", color: "#888", marginBottom: 8 }}>From</div>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "Arial,sans-serif", marginBottom: 4 }}>{brand.tradingName}</div>
          <div style={{ fontSize: 12, fontFamily: "Arial,sans-serif", color: "#444", lineHeight: 1.7, whiteSpace: "pre-line" }}>{brand.address}</div>
          {brand.phone && <div style={{ fontSize: 12, fontFamily: "Arial,sans-serif", color: "#444", marginTop: 4 }}>{brand.phone}</div>}
          {brand.email && <div style={{ fontSize: 12, fontFamily: "Arial,sans-serif", color: accent }}>{brand.email}</div>}
          {brand.gasSafeNumber && <div style={{ fontSize: 11, fontFamily: "Arial,sans-serif", color: "#888", marginTop: 6 }}>Gas Safe: {brand.gasSafeNumber}</div>}
        </div>
        <div>
          <div style={{ fontSize: 10, fontFamily: "Arial,sans-serif", textTransform: "uppercase", letterSpacing: "0.08em", color: "#888", marginBottom: 8 }}>To</div>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "Arial,sans-serif", marginBottom: 4 }}>{inv.customer}</div>
          <div style={{ fontSize: 12, fontFamily: "Arial,sans-serif", color: "#444", lineHeight: 1.7, whiteSpace: "pre-line" }}>{inv.address}</div>
        </div>
      </div>

      {/* Line items */}
      <div style={{ padding: "0 28px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Arial,sans-serif" }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${accent}` }}>
              <th style={{ textAlign: "left", padding: "12px 0 8px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "#888" }}>Description</th>
              {vatEnabled && <th style={{ textAlign: "right", padding: "12px 0 8px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "#888" }}>Net</th>}
              {vatEnabled && <th style={{ textAlign: "right", padding: "12px 0 8px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "#888" }}>VAT {vatRate}%</th>}
              <th style={{ textAlign: "right", padding: "12px 0 8px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "#888" }}>{vatEnabled ? "Gross" : "Amount"}</th>
            </tr>
          </thead>
          <tbody>
            {(inv.desc || "").split("\n").filter(Boolean).map((line, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "10px 0", fontSize: 13 }}>{line}</td>
                {vatEnabled && <td style={{ padding: "10px 0", fontSize: 13, textAlign: "right", color: i === 0 ? "#1a1a1a" : "#888" }}>{i === 0 ? `£${netAmount.toFixed(2)}` : "—"}</td>}
                {vatEnabled && <td style={{ padding: "10px 0", fontSize: 13, textAlign: "right", color: i === 0 ? "#1a1a1a" : "#888" }}>{i === 0 ? `£${vatAmount.toFixed(2)}` : "—"}</td>}
                <td style={{ padding: "10px 0", fontSize: 13, textAlign: "right", color: i === 0 ? "#1a1a1a" : "#888" }}>{i === 0 ? `£${parseFloat(grossAmount).toFixed(2)}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div style={{ margin: "0 28px", borderTop: `2px solid ${accent}`, padding: "14px 0" }}>
        {vatEnabled ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, fontFamily: "Arial,sans-serif" }}>
            <div style={{ display: "flex", gap: 32, fontSize: 12, color: "#888" }}>
              <span>Net amount</span>
              <span style={{ minWidth: 80, textAlign: "right" }}>£{netAmount.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", gap: 32, fontSize: 12, color: "#888" }}>
              <span>VAT @ {vatRate}%</span>
              <span style={{ minWidth: 80, textAlign: "right" }}>£{vatAmount.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", gap: 32, fontSize: 16, fontWeight: 700, color: accent, borderTop: `1px solid #eee`, paddingTop: 8, marginTop: 4 }}>
              <span>Total due (inc. VAT)</span>
              <span style={{ minWidth: 80, textAlign: "right" }}>£{parseFloat(grossAmount).toFixed(2)}</span>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 20 }}>
            <div style={{ fontFamily: "Arial,sans-serif", fontSize: 13, color: "#888" }}>Total Due</div>
            <div style={{ fontFamily: "Arial,sans-serif", fontSize: 22, fontWeight: 900, color: accent }}>£{parseFloat(grossAmount).toFixed(2)}</div>
          </div>
        )}
      </div>

      {/* Payment section */}
      <div style={{ margin: "0 28px 20px", display: "flex", flexDirection: "column", gap: 10 }}>

        {/* BACS block */}
        {showBacs && (
          <div style={{ background: "#f8f8f8", borderRadius: 6, padding: "14px 16px", border: "1px solid #eee" }}>
            <div style={{ fontSize: 10, fontFamily: "Arial,sans-serif", textTransform: "uppercase", letterSpacing: "0.08em", color: "#888", marginBottom: 10 }}>
              {showCard ? "Option 1 — Pay by Bank Transfer (BACS)" : "Pay by Bank Transfer (BACS)"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px", fontFamily: "Arial,sans-serif", fontSize: 12 }}>
              <div><span style={{ color: "#888" }}>Bank: </span><strong>{brand.bankName}</strong></div>
              <div><span style={{ color: "#888" }}>Account name: </span><strong>{brand.accountName}</strong></div>
              <div><span style={{ color: "#888" }}>Sort code: </span><strong>{brand.sortCode}</strong></div>
              <div><span style={{ color: "#888" }}>Account no: </span><strong>{brand.accountNumber}</strong></div>
            </div>
            <div style={{ marginTop: 10, padding: "8px 12px", background: accent + "18", borderRadius: 4, border: `1px solid ${accent}44`, fontFamily: "Arial,sans-serif", fontSize: 12 }}>
              <span style={{ color: "#888" }}>⚠ Payment reference: </span>
              <strong style={{ color: "#1a1a1a", letterSpacing: "0.04em" }}>{ref}</strong>
              <span style={{ color: "#888", fontSize: 11, marginLeft: 8 }}>(please use exactly as shown)</span>
            </div>
          </div>
        )}

        {/* Card / Stripe block */}
        {showCard && (
          <div style={{ background: "#635bff11", borderRadius: 6, padding: "14px 16px", border: "1px solid #635bff33" }}>
            <div style={{ fontSize: 10, fontFamily: "Arial,sans-serif", textTransform: "uppercase", letterSpacing: "0.08em", color: "#635bff", marginBottom: 8 }}>
              {showBacs ? "Option 2 — Pay by Card (Stripe)" : "Pay by Card (Stripe)"}
            </div>
            <div style={{ fontFamily: "Arial,sans-serif", fontSize: 12, color: "#444", marginBottom: 10 }}>
              Pay securely online by debit or credit card. Takes 30 seconds.
            </div>
            <div style={{ display: "inline-block", padding: "8px 18px", background: "#635bff", borderRadius: 5, fontFamily: "Arial,sans-serif", fontSize: 12, fontWeight: 700, color: "#fff", letterSpacing: "0.04em" }}>
              Pay £{inv.amount} online →
            </div>
            <div style={{ fontFamily: "Arial,sans-serif", fontSize: 10, color: "#888", marginTop: 8 }}>
              https://pay.stripe.com/i/acct_1Ox8.../inv_sample
            </div>
          </div>
        )}

        <div style={{ fontFamily: "Arial,sans-serif", fontSize: 11, color: "#888" }}>{brand.invoiceNote}</div>
      </div>

      {/* Footer */}
      <div style={{ background: accent + "22", padding: "10px 28px", display: "flex", justifyContent: "space-between", fontFamily: "Arial,sans-serif", fontSize: 11, color: "#666", borderTop: `1px solid ${accent}44` }}>
        {brand.website && <span>{brand.website}</span>}
        {brand.phone && <span>{brand.phone}</span>}
        {brand.email && <span>{brand.email}</span>}
      </div>
    </div>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────
// ─── Team Invite ──────────────────────────────────────────────────────────────
// ─── Call Tracking Settings ────────────────────────────────────────────────────
function CallTrackingSettings({ user }) {
  const [callTracking, setCallTracking] = useState(null);
  const [forwardTo, setForwardTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [showPortInfo, setShowPortInfo] = useState(false);
  const [micStatus, setMicStatus] = useState(null); // granted | denied | prompt | unknown

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("call_tracking")
      .select("*")
      .eq("user_id", user.id)
      .limit(1)
      .then(({ data }) => {
        setCallTracking(data?.[0] || null);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [user?.id]);

  // Check mic permission status whenever call tracking is active
  useEffect(() => {
    if (!callTracking?.twilio_number) return;
    navigator.permissions?.query({ name: "microphone" })
      .then(result => {
        setMicStatus(result.state);
        result.onchange = () => setMicStatus(result.state);
      })
      .catch(() => setMicStatus("unknown"));
  }, [callTracking?.twilio_number]);

  const activate = async () => {
    if (!forwardTo.trim()) { setError("Please enter your mobile number for missed call fallback"); return; }

    // Request microphone permission before provisioning
    // This ensures the user grants access upfront rather than failing silently on first call
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop()); // release immediately
    } catch (err) {
      setError("Microphone access is required to receive calls. Please tap Allow when your browser asks, or enable it in your browser settings.");
      return;
    }

    setSaving(true); setError("");
    try {
      const res = await fetch("/api/calls/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, forwardTo: forwardTo.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCallTracking({ twilio_number: data.twilioNumber, forwarding_code: data.forwardingCode, disable_code: data.disableCode, forward_to: forwardTo.trim() });
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  if (!loaded) return <div style={{ fontSize: 12, color: C.muted }}>Loading...</div>;

  if (callTracking?.twilio_number) return (
    <div>
      {/* Microphone blocked warning */}
      {micStatus === "denied" && (
        <div style={{ background: "#ef444418", border: "1px solid #ef444444", borderRadius: 8, padding: 12, marginBottom: 14, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>🎙️</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#ef4444", marginBottom: 4 }}>Microphone access blocked</div>
            <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>Calls can't come through without microphone access. On iPhone: Settings → Safari → Microphone → Allow. On desktop: click the lock icon in your browser address bar and allow microphone.</div>
          </div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={S.badge(C.green)}>✓ Active</div>
        <div style={{ fontSize: 12, color: C.muted }}>Business phone is live</div>
      </div>
      <div style={{ background: C.surfaceHigh, borderRadius: 8, padding: 14, marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Your business number</div>
        <div style={{ fontSize: 17, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: C.amber, marginBottom: 4 }}>{callTracking.twilio_number}</div>
        <div style={{ fontSize: 11, color: C.muted }}>Give this number to customers — all calls ring inside the Trade PA app</div>
      </div>
      <div style={{ background: C.surfaceHigh, borderRadius: 8, padding: 14, marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>How calls work</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { icon: "📱", label: "Rings in Trade PA app", desc: "Answer directly — no second SIM needed" },
            { icon: "⏱️", label: "30s fallback", desc: `If you don't answer, rings ${callTracking.forward_to || "your mobile"}` },
            { icon: "🎙️", label: "Auto-recorded", desc: "Known customers are recorded, transcribed & logged" },
            { icon: "🤖", label: "AI classified", desc: "Every call summarised and actioned automatically" },
          ].map(({ icon, label, desc }) => (
            <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>{icon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{label}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div onClick={() => setShowPortInfo(p => !p)} style={{ background: C.surfaceHigh, borderRadius: 8, padding: 12, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 12, color: C.muted }}>Want to use your existing number?</div>
        <div style={{ fontSize: 11, color: C.amber }}>{showPortInfo ? "▲ Hide" : "▼ Show"}</div>
      </div>
      {showPortInfo && (
        <div style={{ background: C.surfaceHigh, borderRadius: 8, padding: 14, marginTop: 2, borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 12, color: C.text, lineHeight: 1.7, marginBottom: 8 }}>You can port your existing mobile or landline number into Trade PA so customers keep calling the same number they always have.</div>
          <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>UK number porting typically takes 2–4 weeks. Contact us at <span style={{ color: C.amber }}>thetradepa@gmail.com</span> to get started — we'll handle the process with you.</div>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div style={{ background: `${C.amber}12`, border: `1px solid ${C.amber}30`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.amber, marginBottom: 8 }}>📞 Business Phone, Built In</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            "Get a dedicated business number instantly",
            "Calls ring inside the Trade PA app — no second SIM",
            "Every call recorded, transcribed & AI-classified",
            "Missed calls fall back to your real mobile",
            "Full call history logged against customers & jobs",
          ].map(f => (
            <div key={f} style={{ fontSize: 12, color: C.text, display: "flex", gap: 8 }}>
              <span style={{ color: C.green, flexShrink: 0 }}>✓</span>
              <span>{f}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 1.6 }}>
        Enter your personal mobile as a fallback. If you don't answer in the app within 30 seconds, the call will ring your mobile instead so you never miss anything.
      </div>
      <label style={S.label}>Fallback mobile number</label>
      <input style={{ ...S.input, marginBottom: 10 }} placeholder="e.g. 07700 900123" value={forwardTo} onChange={e => setForwardTo(e.target.value)} />
      {error && <div style={{ fontSize: 12, color: C.red, marginBottom: 8 }}>{error}</div>}
      <button style={S.btn("primary")} disabled={saving} onClick={activate}>{saving ? "Setting up your number..." : "Activate Business Phone →"}</button>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 10 }}>100 mins £20/mo · 300 mins £40/mo · 600 mins £65/mo · Unlimited £104/mo</div>
      <div style={{ marginTop: 14, padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
        <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>Already have a business number? You can port it across so customers keep calling the same number. Email <span style={{ color: C.amber }}>thetradepa@gmail.com</span> to get started.</div>
      </div>
    </div>
  );
}

function TeamInvite({ companyId, planTier, currentMemberCount }) {
  const ALL_SECTIONS = ["Dashboard", "Schedule", "Jobs", "Customers", "Invoices", "Quotes", "Materials", "Expenses", "CIS", "AI Assistant", "Reminders", "Payments", "Inbox"];
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [permissions, setPermissions] = useState(() => {
    const p = {};
    ALL_SECTIONS.forEach(s => p[s] = true);
    return p;
  });

  const togglePerm = (section) => setPermissions(p => ({ ...p, [section]: !p[section] }));

  const sendInvite = async () => {
    if (!email || !companyId) return;

    // Check user limit based on plan
    const PLAN_LIMITS = { solo: 1, team: 5, pro: 10 };
    const maxUsers = PLAN_LIMITS[planTier] || 1;
    if (currentMemberCount >= maxUsers) {
      setError(`Your ${planTier} plan allows up to ${maxUsers} user${maxUsers === 1 ? "" : "s"}. Upgrade your plan to add more team members.`);
      return;
    }

    setSending(true); setError("");
    try {
      const { data: existing } = await supabase
        .from("invites")
        .select("id")
        .eq("company_id", companyId)
        .eq("email", email.toLowerCase())
        .eq("accepted", false);

      if (existing && existing.length > 0) {
        setError("An invite has already been sent to this email.");
        setSending(false);
        return;
      }

      await supabase.from("invites").insert({
        company_id: companyId,
        invited_by: (await supabase.auth.getUser()).data.user.id,
        email: email.toLowerCase(),
        role,
        permissions: role === "owner" ? null : permissions,
        accepted: false,
      });

      setSent(true);
      setEmail("");
      setTimeout(() => { setSent(false); setShowForm(false); }, 3000);
    } catch (e) {
      setError("Failed to send invite. Please try again.");
    }
    setSending(false);
  };

  if (!showForm) return (
    <button style={S.btn("primary")} onClick={() => setShowForm(true)}>+ Invite Team Member</button>
  );

  return (
    <div style={{ ...S.card, background: C.surfaceHigh, padding: 16 }}>
      {sent ? (
        <div style={{ fontSize: 12, color: C.green }}>✓ Invite sent — they'll join when they sign up with this email.</div>
      ) : (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Invite a team member</div>
          {error && <div style={{ fontSize: 11, color: C.red, marginBottom: 8 }}>{error}</div>}

          <label style={S.label}>Email address</label>
          <input
            style={{ ...S.input, marginBottom: 14 }}
            type="email"
            placeholder="colleague@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />

          <label style={S.label}>Role</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {[["member", "Member"], ["owner", "Owner"]].map(([v, l]) => (
              <button key={v} onClick={() => setRole(v)} style={S.pill(C.amber, role === v)}>{l}</button>
            ))}
          </div>

          {role === "member" && (
            <>
              <label style={S.label}>Section Access</label>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>
                Choose which sections this member can see. Toggle off to restrict access.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                {ALL_SECTIONS.map(section => {
                  const allowed = permissions[section] !== false;
                  return (
                    <button
                      key={section}
                      onClick={() => togglePerm(section)}
                      style={{
                        padding: "5px 12px", borderRadius: 12, fontSize: 11,
                        fontFamily: "'DM Mono',monospace", fontWeight: 600, cursor: "pointer",
                        border: `1px solid ${allowed ? C.green + "66" : C.border}`,
                        background: allowed ? C.green + "18" : C.surface,
                        color: allowed ? C.green : C.muted,
                      }}
                    >
                      {allowed ? "✓" : "✗"} {section}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>
                {Object.values(permissions).filter(Boolean).length} of {ALL_SECTIONS.length} sections enabled
              </div>
            </>
          )}

          {role === "owner" && (
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>
              Owners have full access to all sections including Settings.
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button style={S.btn("primary", !email || sending)} disabled={!email || sending} onClick={sendInvite}>
              {sending ? "Sending..." : "Send Invite →"}
            </button>
            <button style={S.btn("ghost")} onClick={() => { setShowForm(false); setError(""); }}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}

const ALL_CERTS = [
  { label: "Gas Safe Registered", icon: "🔥", key: "cert_gassafe" },
  { label: "OFTEC Registered", icon: "🛢", key: "cert_oftec" },
  { label: "NICEIC Approved", icon: "⚡", key: "cert_niceic" },
  { label: "NAPIT Registered", icon: "🔌", key: "cert_napit" },
  { label: "Which? Trusted Trader", icon: "✓", key: "cert_which" },
  { label: "Federation of Master Builders", icon: "🏗", key: "cert_fmb" },
  { label: "TrustMark Registered", icon: "🛡", key: "cert_trustmark" },
  { label: "CORGI Registered", icon: "🔧", key: "cert_corgi" },
  { label: "CHAS Accredited", icon: "📋", key: "cert_chas" },
  { label: "SAFEcontractor Approved", icon: "🦺", key: "cert_safecontractor" },
  { label: "Checkatrade Member", icon: "🏠", key: "cert_checkatrade" },
  { label: "F-Gas Certified", icon: "❄", key: "cert_fgas" },
];

function CertificationsCard({ brand, setBrand }) {
  const [expanded, setExpanded] = useState(false);
  const enabledCerts = ALL_CERTS.filter(c => brand[c.key]);
  const visibleCerts = expanded ? ALL_CERTS : (enabledCerts.length > 0 ? enabledCerts : ALL_CERTS.slice(0, 4));
  return (
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={S.sectionTitle}>Certifications & Compliance</div>
        <button onClick={() => setExpanded(e => !e)} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px" }}>
          {expanded ? "Show less ↑" : `Show all (${ALL_CERTS.length}) ↓`}
        </button>
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>
        {enabledCerts.length > 0 ? `${enabledCerts.length} shown on invoices & quotes` : "Tap to enable certifications shown on your invoices."}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {visibleCerts.map((cert) => {
          const on = brand[cert.key] || false;
          return (
            <div key={cert.key}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 14px", background: on ? brand.accentColor + "11" : C.surfaceHigh, border: `1px solid ${on ? brand.accentColor + "44" : C.border}`, borderRadius: 8, cursor: "pointer", transition: "all 0.15s" }}
              onClick={() => setBrand(b => ({ ...b, [cert.key]: !on }))}>
              <div style={{ fontSize: 18, flexShrink: 0, width: 24, textAlign: "center" }}>{cert.icon}</div>
              <div style={{ flex: 1, fontSize: 13, fontWeight: on ? 600 : 400, color: on ? C.text : C.textDim }}>{cert.label}</div>
              <div style={{ width: 36, height: 20, borderRadius: 10, background: on ? brand.accentColor : C.border, position: "relative", flexShrink: 0, transition: "all 0.2s" }}>
                <div style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "all 0.2s" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Settings({ brand, setBrand, companyId, companyName, userRole, members, user, planTier, userLimit }) {
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState(false);
  const [xeroConnected, setXeroConnected] = useState(false);
  const [qbConnected, setQbConnected] = useState(false);
  const logoRef = useRef();
  const set = (k) => (e) => setBrand(b => ({ ...b, [k]: e.target.value }));

  // Check connection status — from Supabase DB on load (persists across reloads)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('xero') || params.has('qb')) {
      if (params.get('xero') === 'error') alert(`Xero connection failed: ${params.get('msg') || 'unknown error'}`);
      if (params.get('qb') === 'error') alert(`QuickBooks connection failed: ${params.get('msg') || 'unknown error'}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
    // Always check DB for actual connection status
    if (!user?.id) return;
    supabase
      .from("accounting_connections")
      .select("provider")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (data) {
          setXeroConnected(data.some(r => r.provider === "xero"));
          setQbConnected(data.some(r => r.provider === "quickbooks"));
        }
      });
  }, [user?.id]);

  const handleLogo = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Compress image before storing to prevent localStorage overflow
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 400; // max dimension px
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const ratio = Math.min(MAX / width, MAX / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL("image/jpeg", 0.8);
      setBrand(b => ({ ...b, logo: compressed }));
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const ACCENT_PRESETS = ["#f59e0b", "#3b82f6", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#0ea5e9", "#1a1a1a"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Branding & Settings</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>These details appear on every invoice and customer communication.</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={S.btn("ghost")} onClick={() => setPreview(true)}>Preview Invoice →</button>
          <button style={S.btn(saved ? "green" : "primary")} onClick={save}>{saved ? "✓ Saved" : "Save Changes"}</button>
        </div>
      </div>

      <div style={S.grid2}>
        {/* Logo upload */}
        <div style={S.card}>
          <div style={S.sectionTitle}>Logo</div>
          <div
            onClick={() => logoRef.current.click()}
            style={{ border: `2px dashed ${brand.logo ? C.green : C.border}`, borderRadius: 10, padding: 24, textAlign: "center", cursor: "pointer", transition: "all 0.2s", background: brand.logo ? C.green + "08" : "transparent" }}
          >
            {brand.logo
              ? <img src={brand.logo} alt="logo" style={{ maxHeight: 80, maxWidth: 200, objectFit: "contain", margin: "0 auto 10px", display: "block" }} />
              : <div style={{ fontSize: 32, marginBottom: 8 }}>🖼</div>}
            <div style={{ fontSize: 12, color: brand.logo ? C.green : C.muted }}>{brand.logo ? "Click to change logo" : "Click to upload logo"}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>PNG or JPG, max 2MB. Transparent PNG works best.</div>
            <input ref={logoRef} type="file" accept="image/*" onChange={handleLogo} style={{ display: "none" }} />
          </div>
          {brand.logo && (
            <button style={{ ...S.btn("ghost"), marginTop: 10, fontSize: 11 }} onClick={() => setBrand(b => ({ ...b, logo: null }))}>Remove logo</button>
          )}
        </div>

        {/* Accent colour */}
        <div style={S.card}>
          <div style={S.sectionTitle}>Brand Colour</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            {ACCENT_PRESETS.map(col => (
              <div key={col} onClick={() => setBrand(b => ({ ...b, accentColor: col }))} style={{ width: 36, height: 36, borderRadius: 8, background: col, cursor: "pointer", border: `3px solid ${brand.accentColor === col ? "#fff" : "transparent"}`, transition: "all 0.15s", boxShadow: brand.accentColor === col ? `0 0 0 1px ${col}` : "none" }} />
            ))}
          </div>
          <label style={S.label}>Custom Colour</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="color" value={brand.accentColor} onChange={e => setBrand(b => ({ ...b, accentColor: e.target.value }))} style={{ width: 44, height: 36, borderRadius: 8, border: `1px solid ${C.border}`, background: "none", cursor: "pointer", padding: 2 }} />
            <input style={{ ...S.input, flex: 1 }} value={brand.accentColor} onChange={set("accentColor")} placeholder="#f59e0b" />
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={S.sectionTitle}>Preview</div>
            <div style={{ height: 6, borderRadius: 3, background: brand.accentColor, marginBottom: 8 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ padding: "6px 14px", borderRadius: 6, background: brand.accentColor, color: "#fff", fontSize: 12, fontWeight: 700 }}>Button</div>
              <div style={{ padding: "6px 14px", borderRadius: 6, background: brand.accentColor + "22", border: `1px solid ${brand.accentColor}`, color: brand.accentColor, fontSize: 12, fontWeight: 700 }}>Badge</div>
            </div>
          </div>
        </div>
      </div>

      {/* Business Info */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Your Plan</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: C.surfaceHigh, borderRadius: 10, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: "capitalize" }}>Trade PA {planTier}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
              {planTier === "solo" ? "1 user" : planTier === "team" ? "Up to 5 users" : "Up to 10 users"}
            </div>
          </div>
          <div style={S.badge(planTier === "pro" ? C.blue : planTier === "team" ? C.green : C.amber)}>
            {planTier === "pro" ? "PRO" : planTier === "team" ? "TEAM" : "SOLO"}
          </div>
        </div>
        {planTier === "solo" && (
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
            Need to add team members? Upgrade to <strong style={{ color: C.amber }}>Team (£89/mo)</strong> for up to 5 users or <strong style={{ color: C.amber }}>Pro (£129/mo)</strong> for up to 10 users.
            <br/><a href="mailto:hello@tradespa.co.uk" style={{ color: C.amber }}>Contact us to upgrade →</a>
          </div>
        )}
        {planTier === "team" && (
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
            Need more than 5 users? Upgrade to <strong style={{ color: C.amber }}>Pro (£129/mo)</strong> for up to 10 users.
            <br/><a href="mailto:hello@tradespa.co.uk" style={{ color: C.amber }}>Contact us to upgrade →</a>
          </div>
        )}
      </div>

      {/* Business Info */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Business Information</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { k: "tradingName", l: "Trading Name" },
            { k: "tagline", l: "Tagline (shown on invoice)" },
            { k: "phone", l: "Phone Number" },
            { k: "email", l: "Email Address" },
            { k: "website", l: "Website" },
            { k: "utrNumber", l: "UTR Number (Unique Taxpayer Reference)" },
          ].map(({ k, l }) => (
            <div key={k}>
              <label style={S.label}>{l}</label>
              <input style={S.input} value={brand[k]} onChange={set(k)} />
            </div>
          ))}

          {/* VAT Number — with live verification */}
          {(() => {
            const [vatChecking, setVatChecking] = React.useState(false);
            const [vatError, setVatError] = React.useState("");
            const vatVerif = brand.registrationVerifications?.vatNumber;
            const exempt = isExemptAccount(user?.email);
            const isVerified = exempt || vatVerif?.verified;

            const checkVat = async () => {
              const num = (brand.vatNumber || "").replace(/\s/g, "").replace(/^GB/i, "");
              if (!num || num.length < 9) { setVatError("Enter a valid UK VAT number (9 digits)"); return; }
              setVatChecking(true); setVatError("");
              try {
                // VAT Sense free API — validates against HMRC
                const res = await fetch(`https://api.vatsense.com/1.0/validate?vat_number=GB${num}`, {
                  headers: { "Authorization": `Basic ${btoa("user:" + (import.meta.env.VITE_VAT_SENSE_KEY || ""))}` }
                });
                const data = await res.json();
                if (data.success && data.data?.valid) {
                  const companyName = data.data?.company?.company_name || "";
                  setBrand(b => ({ ...b,
                    registrationVerifications: { ...(b.registrationVerifications || {}),
                      vatNumber: { verified: true, date: new Date().toISOString(), method: "auto", companyName }
                    }
                  }));
                  setVatError("");
                } else {
                  setVatError("VAT number not found on HMRC register — check it's correct");
                }
              } catch {
                setVatError("Could not reach verification service — check your connection");
              }
              setVatChecking(false);
            };

            return (
              <div>
                <label style={S.label}>VAT Number</label>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <input
                      style={{ ...S.input, borderColor: (isVerified || exempt) ? C.green + "66" : brand.vatNumber ? C.amber + "66" : C.border }}
                      placeholder="e.g. GB123456789"
                      value={brand.vatNumber}
                      onChange={e => {
                        setBrand(b => ({ ...b, vatNumber: e.target.value,
                          registrationVerifications: { ...(b.registrationVerifications || {}), vatNumber: undefined }
                        }));
                        setVatError("");
                      }}
                    />
                    {!exempt && isVerified && (
                      <div style={{ fontSize: 11, color: C.green, marginTop: 4 }}>
                        ✓ Verified against HMRC · {vatVerif.companyName && <strong>{vatVerif.companyName}</strong>} · {new Date(vatVerif.date).toLocaleDateString("en-GB")}
                      </div>
                    )}
                    {!exempt && !isVerified && brand.vatNumber && (
                      <div style={{ fontSize: 11, color: C.amber, marginTop: 4 }}>
                        ⚠ VAT number not yet verified — it will not appear on invoices until confirmed
                      </div>
                    )}
                    {vatError && <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>{vatError}</div>}
                  </div>
                  {exempt && brand.vatNumber && (
                    <span style={{ ...S.badge(C.blue), fontSize: 10, marginTop: 2 }}>✓ Test account</span>
                  )}
                  {!exempt && brand.vatNumber && !isVerified && (
                    <button style={{ ...S.btn("primary"), fontSize: 11, flexShrink: 0, marginTop: 2 }} disabled={vatChecking} onClick={checkVat}>
                      {vatChecking ? "Checking..." : "Verify with HMRC →"}
                    </button>
                  )}
                  {!exempt && isVerified && (
                    <button style={{ ...S.btn("ghost"), fontSize: 10, flexShrink: 0, marginTop: 2, color: C.muted }}
                      onClick={() => setBrand(b => ({ ...b, registrationVerifications: { ...(b.registrationVerifications || {}), vatNumber: undefined } }))}>
                      Re-check
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
          <div>
            <label style={S.label}>Business Address</label>
            <textarea style={{ ...S.input, resize: "vertical", minHeight: 80 }} value={brand.address} onChange={set("address")} />
          </div>
        </div>
      </div>

      {/* Payment + Invoice Settings */}
      <div style={S.grid2}>
        <div style={S.card}>
          <div style={S.sectionTitle}>Bank Details (shown on invoice)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { k: "bankName", l: "Bank Name" },
              { k: "sortCode", l: "Sort Code" },
              { k: "accountNumber", l: "Account Number" },
              { k: "accountName", l: "Account Name" },
            ].map(({ k, l }) => (
              <div key={k}>
                <label style={S.label}>{l}</label>
                <input style={S.input} value={brand[k]} onChange={set(k)} />
              </div>
            ))}
          </div>
        </div>

        <div style={S.card}>
          <div style={S.sectionTitle}>Invoice Defaults</div>

          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Default Payment Terms</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["0", "7", "14"].map(d => (
                <button key={d} onClick={() => setBrand(b => ({ ...b, paymentTerms: d }))} style={S.pill(brand.accentColor, brand.paymentTerms === d)}>{d} days</button>
              ))}
              <button onClick={() => setBrand(b => ({ ...b, paymentTerms: "custom" }))} style={S.pill(brand.accentColor, !["0","7","14"].includes(brand.paymentTerms))}>Custom</button>
            </div>
            {!["0","7","14"].includes(brand.paymentTerms) && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <input
                  style={{ ...S.input, width: 80 }}
                  type="number"
                  min="1"
                  placeholder="e.g. 60"
                  value={["0","7","14","custom"].includes(brand.paymentTerms) ? "" : brand.paymentTerms}
                  onChange={e => setBrand(b => ({ ...b, paymentTerms: e.target.value }))}
                />
                <span style={{ fontSize: 12, color: C.muted }}>days</span>
              </div>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Payment Method on Invoices</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { v: "bacs", label: "🏦 BACS only" },
                { v: "card", label: "💳 Card only" },
                { v: "both", label: "🏦💳 Both options" },
              ].map(({ v, label }) => (
                <button key={v} onClick={() => setBrand(b => ({ ...b, defaultPaymentMethod: v }))} style={S.pill(brand.accentColor, brand.defaultPaymentMethod === v)}>{label}</button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
              {brand.defaultPaymentMethod === "bacs" && "Invoice shows bank details only. Good for customers who prefer traditional bank transfer."}
              {brand.defaultPaymentMethod === "card" && "Invoice shows a Stripe payment link only. Fastest way to get paid."}
              {brand.defaultPaymentMethod === "both" && "Invoice shows both options. Customer chooses. Recommended for mixed customer base."}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Payment Reference Format</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { v: "invoice_number", label: "Invoice number", example: "INV-041" },
                { v: "surname_invoice", label: "Surname + invoice", example: "OLIVER-INV-041" },
                { v: "custom_prefix", label: "Custom prefix + number", example: `${brand.refPrefix || "DPH"}-041` },
                { v: "number_only", label: "Number only", example: "041" },
              ].map(({ v, label, example }) => (
                <div key={v} onClick={() => setBrand(b => ({ ...b, refFormat: v }))} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 8, border: `1px solid ${brand.refFormat === v ? brand.accentColor : C.border}`, background: brand.refFormat === v ? brand.accentColor + "11" : C.surfaceHigh, cursor: "pointer", transition: "all 0.15s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${brand.refFormat === v ? brand.accentColor : C.muted}`, background: brand.refFormat === v ? brand.accentColor : "transparent", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: brand.refFormat === v ? C.text : C.textDim }}>{label}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: brand.refFormat === v ? brand.accentColor : C.muted, letterSpacing: "0.04em" }}>{example}</span>
                </div>
              ))}
            </div>
            {brand.refFormat === "custom_prefix" && (
              <div style={{ marginTop: 10 }}>
                <label style={S.label}>Your Custom Prefix</label>
                <input style={S.input} value={brand.refPrefix || ""} onChange={e => setBrand(b => ({ ...b, refPrefix: e.target.value.toUpperCase() }))} placeholder="e.g. DPH, DAVE, PLB" maxLength={8} />
              </div>
            )}
            <div style={{ marginTop: 10, padding: "8px 12px", background: C.surfaceHigh, borderRadius: 6, border: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 11, color: C.muted }}>Preview: </span>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", color: C.text }}>{buildRef(brand, { id: "INV-041", customer: "James Oliver" })}</span>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Invoice Footer Note</label>
            <textarea style={{ ...S.input, resize: "vertical", minHeight: 70 }} value={brand.invoiceNote} onChange={set("invoiceNote")} />
          </div>
          <div>
            <label style={S.label}>Next Invoice Number</label>
            <input style={S.input} defaultValue="INV-043" />
          </div>
        </div>
      </div>

      {/* Certifications */}
      <CertificationsCard brand={brand} setBrand={setBrand} />

      {/* Accounting Integrations */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Accounting Integrations</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
          Connect your accounting software. Invoices created in Trade PA will automatically sync across.
        </div>

        {/* Xero */}
        <div style={{ padding: "14px 16px", background: C.surfaceHigh, borderRadius: 8, marginBottom: 10, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: "#13B5EA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ color: "#fff", fontWeight: 900, fontSize: 14 }}>X</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Xero</div>
            <div style={{ fontSize: 11, color: C.muted }}>
              {xeroConnected ? "Connected — invoices will sync automatically" : "Not connected"}
            </div>
          </div>
          {xeroConnected
            ? <div style={S.badge(C.green)}>✓ Connected</div>
            : <a
                href={`/api/auth/xero/connect?userId=${user?.id}`}
                style={{ ...S.btn("primary"), textDecoration: "none", background: "#13B5EA", fontSize: 12 }}
              >Connect Xero</a>
          }
        </div>

        {/* QuickBooks */}
        <div style={{ padding: "14px 16px", background: C.surfaceHigh, borderRadius: 8, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: "#2CA01C", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ color: "#fff", fontWeight: 900, fontSize: 11 }}>QB</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>QuickBooks</div>
            <div style={{ fontSize: 11, color: C.muted }}>
              {qbConnected ? "Connected — invoices will sync automatically" : "Not connected"}
            </div>
          </div>
          {qbConnected
            ? <div style={S.badge(C.green)}>✓ Connected</div>
            : <a
                href={`/api/auth/quickbooks/connect?userId=${user?.id}`}
                style={{ ...S.btn("primary"), textDecoration: "none", background: "#2CA01C", fontSize: 12 }}
              >Connect QuickBooks</a>
          }
        </div>
      </div>

      {/* Trade Registrations */}
      <div style={S.card}>
        <div style={S.sectionTitle}>🏗 Trade Registrations</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
          Select your trade types. Registration numbers feed directly onto certificates — they cannot be edited on the certificate itself. Verify each number to build your compliance audit trail.
        </div>

        {/* Trade type selector */}
        <div style={{ marginBottom: 20 }}>
          <label style={S.label}>Your Trade Types</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[
              { k: "gas", l: "🔥 Gas" },
              { k: "electrical", l: "⚡ Electrical" },
              { k: "oil", l: "🛢 Oil" },
              { k: "solidfuel", l: "🪵 Solid Fuel" },
              { k: "renewables", l: "☀️ Renewables" },
              { k: "plumbing", l: "💧 Plumbing" },
              { k: "glazing", l: "🪟 Glazing/Windows" },
              { k: "refrigeration", l: "❄️ Refrigeration/AC" },
              { k: "general", l: "🏗 General Building" },
            ].map(({ k, l }) => {
              const active = (brand.tradeTypes || []).includes(k);
              return (
                <button key={k}
                  onClick={() => setBrand(b => ({ ...b, tradeTypes: active ? (b.tradeTypes || []).filter(t => t !== k) : [...(b.tradeTypes || []), k] }))}
                  style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${active ? C.amber + "88" : C.border}`, background: active ? C.amber + "18" : C.surfaceHigh, color: active ? C.amber : C.muted, fontSize: 12, cursor: "pointer", fontFamily: "'DM Mono',monospace", fontWeight: active ? 700 : 400 }}>
                  {l}
                </button>
              );
            })}
          </div>
        </div>

        {/* Registration fields per trade */}
        {(brand.tradeTypes || []).length === 0 && (
          <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>Select your trade types above to see relevant registration fields.</div>
        )}

        {(() => {
          const trades = brand.tradeTypes || [];
          const verifs = brand.registrationVerifications || {};
          const fields = [];
          const exemptUser = isExemptAccount(user?.email);

          const RegField = ({ fieldKey, label, registerUrl, verifyLabel, placeholder }) => {
            const val = brand[fieldKey] || "";
            const v = verifs[fieldKey];
            const verified = exemptUser || v?.verified;
            const verifiedDate = v?.date ? new Date(v.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
            const isAutoVerified = v?.method === "auto";
            return (
              <div style={{ background: C.surfaceHigh, borderRadius: 10, padding: 14, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label style={{ ...S.label, margin: 0 }}>{label}</label>
                  {verified && !exemptUser && <span style={{ ...S.badge(C.green), fontSize: 10 }}>{isAutoVerified ? "✓ Auto-verified" : "✓ Confirmed"} {verifiedDate}</span>}
                  {exemptUser && val && <span style={{ ...S.badge(C.blue), fontSize: 10 }}>✓ Test account</span>}
                  {!verified && !exemptUser && val && <span style={{ ...S.badge(C.amber), fontSize: 10 }}>⚠ Not yet verified</span>}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    style={{ ...S.input, flex: 1, borderColor: verified ? C.green + "66" : val && !verified ? C.amber + "66" : C.border }}
                    placeholder={placeholder || "Enter number"}
                    value={val}
                    onChange={e => setBrand(b => ({ ...b, [fieldKey]: e.target.value, registrationVerifications: { ...(b.registrationVerifications || {}), [fieldKey]: undefined } }))}
                  />
                  {!exemptUser && val && !verified && registerUrl && (
                    <button
                      style={{ ...S.btn("ghost"), fontSize: 11, flexShrink: 0 }}
                      onClick={() => window.open(registerUrl, "_blank", "width=900,height=700")}
                    >🔍 Verify →</button>
                  )}
                  {!exemptUser && val && !verified && (
                    <button
                      style={{ ...S.btn("primary"), fontSize: 11, flexShrink: 0 }}
                      onClick={() => setBrand(b => ({ ...b, registrationVerifications: { ...(b.registrationVerifications || {}), [fieldKey]: { verified: true, date: new Date().toISOString(), method: "manual" } } }))}
                    >✓ Confirmed</button>
                  )}
                  {!exemptUser && val && verified && !isAutoVerified && (
                    <button style={{ ...S.btn("ghost"), fontSize: 10, flexShrink: 0, color: C.muted }}
                      onClick={() => setBrand(b => ({ ...b, registrationVerifications: { ...(b.registrationVerifications || {}), [fieldKey]: undefined } }))}>
                      Re-check
                    </button>
                  )}
                </div>
                {!exemptUser && val && !verified && registerUrl && (
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
                    Tap Verify → to open the official register in a new window, then tap Confirmed once you've checked your number is valid and active.
                  </div>
                )}
              </div>
            );
          };

          if (trades.includes("gas")) fields.push(
            <RegField key="gas" fieldKey="gasSafeNumber" label="🔥 Gas Safe Register Number"
              registerUrl={`https://www.gassaferegister.co.uk/find-an-engineer-or-check-the-register/check-an-engineer/?licenceNumber=${brand.gasSafeNumber || ""}`}
              placeholder="7-digit licence number e.g. 1234567" />
          );
          if (trades.includes("electrical")) {
            fields.push(<div key="elec-header" style={{ fontSize: 11, color: C.muted, marginBottom: 6, marginTop: 4 }}>Add whichever electrical scheme you belong to:</div>);
            fields.push(<RegField key="niceic" fieldKey="niceicNumber" label="⚡ NICEIC Number"
              registerUrl={`https://www.niceic.com/find-a-contractor`} placeholder="e.g. 7654321" />);
            fields.push(<RegField key="napit" fieldKey="napitNumber" label="⚡ NAPIT Number"
              registerUrl="https://www.napit.org.uk/find-a-member" placeholder="e.g. NAP/12345" />);
            fields.push(<RegField key="elecsa" fieldKey="elecsaNumber" label="⚡ ELECSA Number"
              registerUrl="https://www.elecsa.co.uk/find-a-member" placeholder="e.g. 12345" />);
          }
          if (trades.includes("oil")) fields.push(
            <RegField key="oftec" fieldKey="oftecNumber" label="🛢 OFTEC Registration Number"
              registerUrl="https://www.oftec.org/consumers/find-a-registered-technician" placeholder="e.g. C12345" />
          );
          if (trades.includes("solidfuel")) fields.push(
            <RegField key="hetas" fieldKey="hetasNumber" label="🪵 HETAS Registration Number"
              registerUrl="https://www.hetas.co.uk/find-an-approved-business" placeholder="e.g. H12345" />
          );
          if (trades.includes("renewables")) fields.push(
            <RegField key="mcs" fieldKey="mcsNumber" label="☀️ MCS Certification Number"
              registerUrl="https://mcscertified.com/find-an-installer" placeholder="e.g. NAP-12345-678" />
          );
          if (trades.includes("refrigeration")) fields.push(
            <RegField key="fgas" fieldKey="fgasNumber" label="❄️ F-Gas Certificate Number"
              registerUrl="https://www.fgas.org.uk" placeholder="Company cert number" />
          );
          if (trades.includes("plumbing")) fields.push(
            <RegField key="aphc" fieldKey="aphcNumber" label="💧 APHC / WaterSafe Number"
              registerUrl="https://watersafe.org.uk/find-a-plumber" placeholder="e.g. WS12345" />
          );
          if (trades.includes("glazing")) fields.push(
            <RegField key="fensa" fieldKey="fensaNumber" label="🪟 FENSA Registration Number"
              registerUrl="https://www.fensa.org.uk/homeowner/find-a-fensa-installer" placeholder="e.g. 12345" />
          );
          if (trades.includes("general")) fields.push(
            <RegField key="cscs" fieldKey="cscsNumber" label="🏗 CSCS Card Number"
              registerUrl="https://www.cscs.uk.com/checking-cards/check-a-cscs-card" placeholder="e.g. 1234567890" />
          );

          return fields;
        })()}

        {/* Gas Safe Logo Upload — only if gas trade selected */}
        {(brand.tradeTypes || []).includes("gas") && (
          <div style={{ marginTop: 16 }}>
            <label style={S.label}>Gas Safe Logo</label>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, lineHeight: 1.6 }}>
              Contact Gas Safe Register on 0800 408 5500 to request authorisation to use their logo digitally. Once approved, upload it here and it will appear on all gas safety certificates.
            </div>
            {brand.gasSafeLogo ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <img src={brand.gasSafeLogo} alt="Gas Safe logo" style={{ height: 48, objectFit: "contain", background: "#fff", padding: 6, borderRadius: 6 }} />
                <div style={{ flex: 1 }}>
                  <div style={S.badge(C.green)}>✓ Logo uploaded</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Appears on all gas safety certificates</div>
                </div>
                <button style={{ ...S.btn("ghost"), fontSize: 11, color: C.red }} onClick={() => setBrand(b => ({ ...b, gasSafeLogo: null }))}>Remove</button>
              </div>
            ) : (
              <div>
                <input type="file" accept="image/*" style={{ display: "none" }} id="gasSafeLogoInput"
                  onChange={e => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const img = new Image();
                    const url = URL.createObjectURL(file);
                    img.onload = () => {
                      const canvas = document.createElement("canvas");
                      const scale = Math.min(1, 200 / img.width, 80 / img.height);
                      canvas.width = img.width * scale;
                      canvas.height = img.height * scale;
                      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
                      setBrand(b => ({ ...b, gasSafeLogo: canvas.toDataURL("image/png") }));
                      URL.revokeObjectURL(url);
                    };
                    img.src = url;
                    e.target.value = "";
                  }}
                />
                <button style={S.btn("ghost")} onClick={() => document.getElementById("gasSafeLogoInput").click()}>📤 Upload Gas Safe Logo</button>
                <div style={{ fontSize: 11, color: C.amber, marginTop: 8 }}>⚠️ Only upload once Gas Safe Register has authorised you to use it digitally.</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Gas Safe Certificates — Sequential Numbering */}
      <div style={S.card}>
        <div style={S.sectionTitle}>🔢 Certificate Numbering</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
          Sequential certificate reference numbers for your audit trail. Each certificate gets the next number automatically.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <label style={S.label}>Certificate Prefix</label>
            <input style={S.input} placeholder="e.g. GS or your initials" value={brand.certPrefix || "CERT"} onChange={set("certPrefix")} />
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Creates: {(brand.certPrefix || "CERT")}-001</div>
          </div>
          <div>
            <label style={S.label}>Next Certificate Number</label>
            <input style={S.input} type="number" min="1" value={brand.certNextNumber || 1} onChange={e => setBrand(b => ({ ...b, certNextNumber: parseInt(e.target.value) || 1 }))} />
          </div>
        </div>
        <div style={{ background: C.surfaceHigh, borderRadius: 8, padding: 14 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Next certificate will be:</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: C.amber }}>
            {(brand.certPrefix || "CERT")}-{String(brand.certNextNumber || 1).padStart(3, "0")}
          </div>
        </div>
      </div>

      {/* Call Tracking */}
      <div style={S.card}>
        <div style={S.sectionTitle}>📞 Call Tracking</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
          AI-powered call recording and transcription. Known customers who call are automatically recorded, transcribed and linked to their job or customer record. Unknown callers pass straight through unrecorded.
        </div>
        <CallTrackingSettings user={user} />
      </div>

      {/* Team Management */}
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={S.sectionTitle}>Team Access</div>
          {userRole === "owner" && <TeamInvite companyId={companyId} planTier={planTier} currentMemberCount={members.length} userLimit={userLimit} />}
        </div>

        <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8, marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>Company Workspace</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{companyName || "Your Business"}</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>All team members share the same data. Owners can control which sections each member can access.</div>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>Team Members</div>
        {members.map((m, i) => {
          const isMe = m.user_id === user?.id;
          const isOwner = m.role === "owner";
          const email = m.invited_email || m.users?.email || "Team member";
          const initials = email[0].toUpperCase();
          const perms = m.permissions || {};
          const ALL_SECTIONS = ["Dashboard", "Schedule", "Jobs", "Customers", "Invoices", "Quotes", "Materials", "Expenses", "CIS", "AI Assistant", "Reminders", "Payments", "Inbox"];

          return (
            <div key={i} style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 14, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: isOwner || isMe ? 0 : 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: isMe ? C.amber + "22" : C.surfaceHigh, border: `1px solid ${isMe ? C.amber + "44" : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: isMe ? C.amber : C.muted, flexShrink: 0 }}>
                  {initials}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13 }}>{email}{isMe ? " (You)" : ""}</div>
                </div>
                <div style={S.badge(isOwner ? C.amber : C.blue)}>{m.role}</div>
              </div>

              {/* Permission toggles — only shown for non-owners, only editable by the account owner */}
              {!isOwner && (
                <div style={{ marginTop: 12, paddingLeft: 44 }}>
                  <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Section Access</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {ALL_SECTIONS.map(section => {
                      const allowed = perms[section] !== false;
                      const canEdit = userRole === "owner" && !isMe;
                      return (
                        <button
                          key={section}
                          disabled={!canEdit}
                          onClick={async () => {
                            if (!canEdit) return;
                            const newPerms = { ...perms, [section]: !allowed };
                            const updated = members.map((mem, j) => j === i ? { ...mem, permissions: newPerms } : mem);
                            // Update in Supabase
                            try {
                              await supabase.from("company_members")
                                .update({ permissions: newPerms })
                                .eq("company_id", companyId)
                                .eq("user_id", m.user_id);
                            } catch (e) { console.error("Permission update failed:", e); }
                          }}
                          style={{
                            padding: "3px 10px", borderRadius: 12, fontSize: 10, fontFamily: "'DM Mono',monospace", fontWeight: 600,
                            border: `1px solid ${allowed ? C.green + "66" : C.border}`,
                            background: allowed ? C.green + "18" : C.surfaceHigh,
                            color: allowed ? C.green : C.muted,
                            cursor: canEdit ? "pointer" : "default",
                            opacity: canEdit ? 1 : 0.7,
                          }}
                        >
                          {allowed ? "✓" : "✗"} {section}
                        </button>
                      );
                    })}
                  </div>
                  {!userRole === "owner" && <div style={{ fontSize: 10, color: C.muted, marginTop: 6 }}>Only the owner can change permissions.</div>}
                </div>
              )}
              {isOwner && !isMe && (
                <div style={{ paddingLeft: 44, marginTop: 6, fontSize: 11, color: C.muted }}>Owners always have full access to all sections.</div>
              )}
            </div>
          );
        })}

        {userRole !== "owner" && (
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Contact the account owner to change your access permissions.</div>
        )}
      </div>

      {/* Preview Modal */}
      {preview && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 24 }} onClick={() => setPreview(false)}>
          <div onClick={e => e.stopPropagation()} style={{ maxHeight: "90vh", overflowY: "auto", borderRadius: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: C.muted, fontFamily: "'DM Mono',monospace" }}>INVOICE PREVIEW</div>
              <button onClick={() => setPreview(false)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22 }}>×</button>
            </div>
            <InvoicePreview brand={brand} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ setView, jobs, invoices, enquiries, brand }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const todayJobs = jobs.filter(j => j.dateObj && isSameDay(new Date(j.dateObj), today));

  const allInvoices = invoices.filter(i => !i.isQuote);
  const allQuotes = invoices.filter(i => i.isQuote);
  const totalInvoiceValue = allInvoices.reduce((s, i) => s + (i.amount || 0), 0);
  const totalQuoteValue = allQuotes.reduce((s, q) => s + (q.amount || 0), 0);
  const overdueInvoices = allInvoices.filter(i => i.status === "overdue" || i.status === "due");
  const overdueValue = overdueInvoices.reduce((s, i) => s + (i.amount || 0), 0);
  const newEnquiries = (enquiries || []).filter(e => !e.status || e.status === "new");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[
          { label: "Total Quote Value", value: `£${totalQuoteValue.toLocaleString()}`, sub: `${allQuotes.length} quote${allQuotes.length !== 1 ? "s" : ""}`, color: C.blue, onClick: () => setView("Quotes") },
          { label: "Total Invoice Value", value: `£${totalInvoiceValue.toLocaleString()}`, sub: `${allInvoices.filter(i => i.status !== "paid").length} outstanding`, color: C.amber, onClick: () => setView("Invoices") },
          { label: "Overdue Invoices", value: `£${overdueValue.toLocaleString()}`, sub: `${overdueInvoices.length} invoice${overdueInvoices.length !== 1 ? "s" : ""} overdue`, color: overdueValue > 0 ? C.red : C.muted, onClick: () => setView("Invoices") },
          { label: "New Enquiries", value: newEnquiries.length, sub: `${(enquiries || []).filter(e => e.urgent).length} urgent`, color: C.green, onClick: () => setView("Enquiries") },
        ].map((stat, i) => (
          <div key={i} style={{ ...S.statCard(stat.color), cursor: "pointer" }} onClick={stat.onClick}>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>{stat.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{stat.sub}</div>
          </div>
        ))}
      </div>
      <div style={S.grid2}>
        <div style={S.card}>
          <div style={S.sectionTitle}>Today's Jobs</div>
          {todayJobs.length === 0
            ? <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic", padding: "8px 0" }}>No jobs today — add one in Schedule or via the AI Assistant.</div>
            : todayJobs.map(job => (
              <div key={job.id} style={S.row}>
                <div style={{ width: 4, height: 36, borderRadius: 2, background: statusColor[job.status] || C.muted, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{job.customer}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{job.type} · {new Date(job.dateObj).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
                {job.value > 0 && <div style={{ fontSize: 13, fontWeight: 700, color: C.amber }}>£{job.value}</div>}
              </div>
            ))
          }
          <div style={{ marginTop: 12 }}><button style={S.btn("ghost")} onClick={() => setView("Schedule")}>View Schedule →</button></div>
        </div>
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={S.sectionTitle}>New Enquiries</div>
            <button style={S.btn("ghost")} onClick={() => setView("Enquiries")}>Manage →</button>
          </div>
          {(enquiries || []).length === 0
            ? <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic", padding: "8px 0" }}>No enquiries yet — log one via the AI Assistant.</div>
            : (enquiries || []).slice(0, 3).map((e, i) => (
              <div key={i} style={{ ...S.row, alignItems: "flex-start" }}>
                <div style={{ width: 4, height: 36, borderRadius: 2, background: e.urgent ? C.red : C.blue, flexShrink: 0, marginTop: 4 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{e.name}</span>
                    <span style={S.badge(C.muted)}>{e.source}</span>
                    {e.urgent && <span style={S.badge(C.red)}>Urgent</span>}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.msg}</div>
                </div>
                <div style={{ fontSize: 10, color: C.muted, flexShrink: 0 }}>{e.time}</div>
              </div>
            ))
          }
        </div>
      </div>
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={S.sectionTitle}>Invoice Pipeline</div>
          <button style={S.btn("ghost")} onClick={() => setView("Invoices")}>Manage →</button>
        </div>
        {allInvoices.length === 0
          ? <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No invoices yet — create one in Invoices or via the AI Assistant.</div>
          : allInvoices.slice(0, 4).map(inv => (
            <div key={inv.id} style={S.row}>
              <div style={{ fontSize: 12, color: C.muted, width: 70, flexShrink: 0 }}>{inv.id}</div>
              <div style={{ flex: 1, minWidth: 0 }}><span style={{ fontSize: 13, fontWeight: 600 }}>{inv.customer}</span></div>
              <div style={{ fontSize: 13, fontWeight: 700, marginRight: 12, flexShrink: 0 }}>£{inv.amount}</div>
              <div style={{ flexShrink: 0, textAlign: "right", marginRight: 10 }}>
                <div style={S.badge(statusColor[inv.status] || C.muted)}>{statusLabel[inv.status] || inv.status}</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{inv.due}</div>
              </div>
              <button style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px", flexShrink: 0 }} onClick={() => downloadInvoicePDF(brand, inv)}>⬇ PDF</button>
            </div>
          ))
        }
      </div>

      {allQuotes.length > 0 && (
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={S.sectionTitle}>Quotes ({allQuotes.length})</div>
            <button style={S.btn("ghost")} onClick={() => setView("Quotes")}>Manage →</button>
          </div>
          {allQuotes.slice(0, 4).map(q => (
            <div key={q.id} style={S.row}>
              <div style={{ fontSize: 12, color: C.blue, width: 70, flexShrink: 0 }}>{q.id}</div>
              <div style={{ flex: 1, minWidth: 0 }}><span style={{ fontSize: 13, fontWeight: 600 }}>{q.customer}</span></div>
              <div style={{ fontSize: 13, fontWeight: 700, marginRight: 12, flexShrink: 0 }}>£{q.amount}</div>
              <div style={{ flexShrink: 0, textAlign: "right", marginRight: 10 }}>
                <div style={S.badge(C.blue)}>Quote</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{q.due}</div>
              </div>
              <button style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px", flexShrink: 0 }} onClick={() => downloadInvoicePDF(brand, q)}>⬇ PDF</button>
            </div>
          ))}
        </div>
      )}

      {jobs.length === 0 && invoices.length === 0 && (enquiries || []).length === 0 && (
        <div style={{ ...S.card, textAlign: "center", padding: 40, borderColor: C.amber + "44", background: C.amber + "08" }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>⚡</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Welcome to Trade PA</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 24, lineHeight: 1.7 }}>
            Get started by heading to <strong style={{ color: C.text }}>Settings</strong> to add your business details,<br />
            then try the <strong style={{ color: C.text }}>AI Assistant</strong> to book your first job.
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button style={S.btn("primary")} onClick={() => setView("Settings")}>Set up my business →</button>
            <button style={S.btn("ghost")} onClick={() => setView("AI Assistant")}>Try AI Assistant</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Schedule ─────────────────────────────────────────────────────────────────
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDayLabel(date) {
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function Schedule({ jobs, setJobs }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [showAddJob, setShowAddJob] = useState(false);
  const [addJobDate, setAddJobDate] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [editingJob, setEditingJob] = useState(null);
  const [form, setForm] = useState({ customer: "", address: "", type: "", time: "09:00", value: "", status: "confirmed", notes: "" });

  const weekStart = new Date(getWeekStart(new Date()));
  weekStart.setDate(weekStart.getDate() + weekOffset * 7);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const jobsForDay = (day) => jobs.filter(j => j.dateObj && isSameDay(new Date(j.dateObj), day));

  const weekLabel = () => {
    const end = new Date(weekStart); end.setDate(end.getDate() + 6);
    return `${weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
  };

  const openAdd = (day) => {
    setAddJobDate(day);
    setForm({ customer: "", address: "", type: "", time: "09:00", value: "", status: "confirmed", notes: "" });
    setShowAddJob(true);
  };

  const saveJob = () => {
    if (!form.customer || !form.type) return;
    const dateObj = new Date(addJobDate);
    const [h, m] = form.time.split(":");
    dateObj.setHours(parseInt(h), parseInt(m));
    const newJob = {
      id: Date.now(),
      customer: form.customer,
      address: form.address,
      type: form.type,
      date: `${formatDayLabel(addJobDate)} ${form.time}`,
      dateObj: dateObj.toISOString(),
      status: form.status,
      value: parseInt(form.value) || 0,
      notes: form.notes,
    };
    setJobs(prev => [...prev, newJob]);
    setShowAddJob(false);
  };

  const saveEdit = () => {
    setJobs(prev => prev.map(j => j.id === editingJob.id ? {
      ...j,
      customer: form.customer,
      address: form.address,
      type: form.type,
      status: form.status,
      value: parseInt(form.value) || 0,
      notes: form.notes,
    } : j));
    setEditingJob(null);
    setSelectedJob(null);
  };

  const deleteJob = (id) => {
    setJobs(prev => prev.filter(j => j.id !== id));
    setSelectedJob(null);
  };

  const allWeekJobs = jobs.filter(j => {
    if (!j.dateObj) return false;
    const d = new Date(j.dateObj); d.setHours(0,0,0,0);
    return weekDays.some(wd => isSameDay(wd, d));
  }).sort((a, b) => new Date(a.dateObj) - new Date(b.dateObj));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Week nav */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setWeekOffset(o => o - 1)} style={{ ...S.btn("ghost"), padding: "6px 12px" }}>← Prev</button>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{weekLabel()}</div>
          <button onClick={() => setWeekOffset(o => o + 1)} style={{ ...S.btn("ghost"), padding: "6px 12px" }}>Next →</button>
          {weekOffset !== 0 && <button onClick={() => setWeekOffset(0)} style={{ ...S.btn("ghost"), padding: "6px 10px", fontSize: 11 }}>Today</button>}
        </div>
        <button style={S.btn("primary")} onClick={() => openAdd(weekDays[0])}>+ Add Job</button>
      </div>

      {/* Calendar grid — 7 days, jobs show name + time only, tap to see detail */}
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8, minWidth: 560 }}>
          {weekDays.map((day, i) => {
            const dayJobs = jobsForDay(day);
            const isToday = isSameDay(day, today);
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            return (
              <div key={i} style={{ ...S.card, padding: 10, borderColor: isToday ? C.amber + "66" : C.border, background: isToday ? C.amber + "08" : isWeekend ? C.surfaceHigh : C.surface }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: isToday ? C.amber : isWeekend ? C.blue : C.muted, textTransform: "uppercase" }}>
                    {day.toLocaleDateString("en-GB", { weekday: "short" })} {day.getDate()}
                  </div>
                  <button onClick={() => openAdd(day)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 15, lineHeight: 1, padding: "0 2px" }}>+</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {dayJobs.length === 0 && <div style={{ fontSize: 9, color: C.border, fontStyle: "italic" }}>Free</div>}
                  {dayJobs.map(job => (
                    <div
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      style={{ padding: "5px 7px", background: C.surfaceHigh, borderRadius: 5, borderLeft: `2px solid ${statusColor[job.status] || C.muted}`, cursor: "pointer", transition: "opacity 0.15s" }}
                      title="Tap for details"
                    >
                      {/* Calendar card — name and time ONLY */}
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {job.customer.split(" ")[0]} {job.customer.split(" ").slice(-1)[0]}
                      </div>
                      <div style={{ fontSize: 9, color: C.muted, marginTop: 1 }}>
                        {job.dateObj ? new Date(job.dateObj).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Jobs list this week — name and address, tap for detail */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Jobs This Week ({allWeekJobs.length})</div>
        {allWeekJobs.length === 0 && <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No jobs this week. Hit + to add one.</div>}
        {allWeekJobs.map(job => (
          <div key={job.id} onClick={() => setSelectedJob(job)} style={{ ...S.row, cursor: "pointer" }}>
            <div style={{ width: 4, height: 44, borderRadius: 2, background: statusColor[job.status] || C.muted, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{job.customer}</div>
              <div style={{ fontSize: 11, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{job.address || "No address"}</div>
            </div>
            <div style={{ fontSize: 11, color: C.textDim, marginRight: 12, flexShrink: 0 }}>
              {job.dateObj ? new Date(job.dateObj).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" }) : ""}<br />
              <span style={{ fontSize: 10 }}>{job.dateObj ? new Date(job.dateObj).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : ""}</span>
            </div>
            <div style={S.badge(statusColor[job.status] || C.muted)}>{statusLabel[job.status] || job.status}</div>
            <div style={{ fontSize: 11, color: C.muted, marginLeft: 12 }}>→</div>
          </div>
        ))}
      </div>

      {/* ── Job Detail Modal ── */}
      {selectedJob && !editingJob && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }} onClick={() => setSelectedJob(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.card, maxWidth: 480, width: "100%", marginBottom: 16 }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{selectedJob.customer}</div>
                <div style={S.badge(statusColor[selectedJob.status] || C.muted)}>{statusLabel[selectedJob.status] || selectedJob.status}</div>
              </div>
              <button onClick={() => setSelectedJob(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22, lineHeight: 1 }}>×</button>
            </div>

            {/* Details grid */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              {[
                { label: "Job Type", value: selectedJob.type },
                { label: "Date & Time", value: selectedJob.dateObj ? new Date(selectedJob.dateObj).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) + " at " + new Date(selectedJob.dateObj).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : selectedJob.date },
                { label: "Address", value: selectedJob.address || "Not set" },
                { label: "Value", value: selectedJob.value > 0 ? `£${selectedJob.value}` : "Not set" },
              ].map(({ label, value }) => (
                <div key={label} style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 13, color: C.text }}>{value}</div>
                </div>
              ))}

              {/* Notes */}
              <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>Notes</div>
                <div style={{ fontSize: 13, color: selectedJob.notes ? C.text : C.muted, fontStyle: selectedJob.notes ? "normal" : "italic" }}>
                  {selectedJob.notes || "No notes added"}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button style={S.btn("primary")} onClick={() => {
                setEditingJob(selectedJob);
                setForm({ customer: selectedJob.customer, address: selectedJob.address || "", type: selectedJob.type, time: selectedJob.dateObj ? new Date(selectedJob.dateObj).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }).replace(":", ":") : "09:00", value: selectedJob.value || "", status: selectedJob.status, notes: selectedJob.notes || "" });
              }}>Edit Job</button>
              {selectedJob.status !== "confirmed" && (
                <button style={S.btn("green")} onClick={() => { setJobs(prev => prev.map(j => j.id === selectedJob.id ? { ...j, status: "confirmed" } : j)); setSelectedJob(null); }}>Mark Confirmed</button>
              )}
              {selectedJob.address && (
                <a href={`https://maps.google.com/?q=${encodeURIComponent(selectedJob.address)}`} target="_blank" rel="noreferrer" style={{ ...S.btn("ghost"), textDecoration: "none" }}>📍 Directions</a>
              )}
              <button style={{ ...S.btn("ghost"), color: C.red, marginLeft: "auto" }} onClick={() => deleteJob(selectedJob.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Job Modal ── */}
      {editingJob && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 310, padding: 16 }}>
          <div style={{ ...S.card, maxWidth: 440, width: "100%", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Edit Job</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <VoiceFillButton form={form} setForm={setForm} fieldDescriptions="customer (full name), address (property address), type (job type e.g. Boiler Service), value (£ amount), notes (any details)" />
                <button onClick={() => setEditingJob(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22 }}>×</button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { k: "customer", l: "Customer Name", p: "e.g. John Smith" },
                { k: "address", l: "Address", p: "e.g. 5 High Street, Guildford" },
                { k: "type", l: "Job Type", p: "e.g. Boiler Service" },
                { k: "value", l: "Value (£)", p: "e.g. 120" },
              ].map(({ k, l, p }) => (
                <div key={k}>
                  <label style={S.label}>{l}</label>
                  <input style={S.input} placeholder={p} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label style={S.label}>Notes</label>
                <textarea style={{ ...S.input, resize: "vertical", minHeight: 80 }} placeholder="Any notes about this job..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Status</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["confirmed", "pending", "quote_sent"].map(st => (
                    <button key={st} onClick={() => setForm(f => ({ ...f, status: st }))} style={S.pill(statusColor[st], form.status === st)}>{statusLabel[st]}</button>
                  ))}
                </div>
              </div>
              <button style={S.btn("primary", !form.customer || !form.type)} disabled={!form.customer || !form.type} onClick={saveEdit}>Save Changes →</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Job Modal ── */}
      {showAddJob && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }}>
          <div style={{ ...S.card, maxWidth: 440, width: "100%", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Add Job — {addJobDate?.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <VoiceFillButton form={form} setForm={setForm} fieldDescriptions="customer (full name), address (property address), type (job type e.g. Boiler Service), value (£ amount), notes (any details)" />
                <button onClick={() => setShowAddJob(false)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22 }}>×</button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { k: "customer", l: "Customer Name", p: "e.g. John Smith" },
                { k: "address", l: "Address", p: "e.g. 5 High Street, Guildford" },
                { k: "type", l: "Job Type", p: "e.g. Boiler Service" },
                { k: "value", l: "Value (£)", p: "e.g. 120" },
              ].map(({ k, l, p }) => (
                <div key={k}>
                  <label style={S.label}>{l}</label>
                  <input style={S.input} placeholder={p} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label style={S.label}>Time</label>
                <input type="time" style={S.input} value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Notes</label>
                <textarea style={{ ...S.input, resize: "vertical", minHeight: 72 }} placeholder="Any notes about this job..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Status</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["confirmed", "pending", "quote_sent"].map(st => (
                    <button key={st} onClick={() => setForm(f => ({ ...f, status: st }))} style={S.pill(statusColor[st], form.status === st)}>{statusLabel[st]}</button>
                  ))}
                </div>
              </div>
              <button style={S.btn("primary", !form.customer || !form.type)} disabled={!form.customer || !form.type} onClick={saveJob}>Save Job →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Materials ────────────────────────────────────────────────────────────────
const DEFAULT_SUPPLIERS = [
  { name: "City Plumbing", phone: "01483 123456", email: "", notes: "Main plumbing supplies" },
  { name: "Screwfix", phone: "03330 112112", email: "", notes: "Tools and fixings" },
  { name: "Wolseley", phone: "01926 701600", email: "", notes: "Heating and plumbing" },
  { name: "Toolstation", phone: "0330 333 3303", email: "", notes: "Tools and building supplies" },
  { name: "BSS", phone: "0115 953 0500", email: "", notes: "Commercial heating" },
  { name: "Plumb Center", phone: "0330 123 1456", email: "", notes: "Plumbing wholesale" },
];

function Materials({ materials, setMaterials, user }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showSuppliers, setShowSuppliers] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanImageData, setScanImageData] = useState(null); // base64 data URL of receipt
  const [scanImageType, setScanImageType] = useState("image/jpeg");
  const [scanError, setScanError] = useState("");
  const fileRef = useRef();
  const uploadRef = useRef();
  const suppliers = DEFAULT_SUPPLIERS;
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [supplierForm, setSupplierForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const [filterJob, setFilterJob] = useState("all");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const [editingMaterial, setEditingMaterial] = useState(null); // {index, ...fields}
  const emptyRow = () => ({ item: "", qty: 1, unitPrice: "", supplier: "", job: "", status: "to_order" });
  const [rows, setRows] = useState([emptyRow()]);
  const updateRow = (i, k, v) => setRows(prev => prev.map((r, j) => j === i ? { ...r, [k]: v } : r));
  const addRow = () => setRows(prev => [...prev, emptyRow()]);
  const removeRow = (i) => setRows(prev => prev.filter((_, j) => j !== i));

  const scanReceipt = async (file) => {
    if (!file) return;
    setScanning(true);
    setScanError("");
    setScanResult(null);
    setScanImageData(null);
    try {
      const isPdf = file.type === "application/pdf" || file.name?.toLowerCase().endsWith(".pdf");

      const { base64, dataUrl } = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = e => {
          const full = e.target.result;
          res({ base64: full.split(",")[1], dataUrl: full });
        };
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });

      setScanImageData(dataUrl);
      setScanImageType(file.type || "image/jpeg");

      // Build the content block — PDFs as document, images as image
      const fileContent = isPdf
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
        : { type: "image", source: { type: "base64", media_type: file.type || "image/jpeg", data: base64 } };

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              fileContent,
              { type: "text", text: `Read this supplier receipt or invoice. Extract all line items and return ONLY valid JSON:
{
  "supplier": "supplier name",
  "date": "YYYY-MM-DD or empty string",
  "total": 123.45,
  "items": [
    { "item": "item name", "qty": 1, "unitPrice": 12.50 }
  ]
}
Return only JSON, no other text.` },
            ],
          }],
        }),
      });

      const data = await response.json();
      const text = data.content?.[0]?.text || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Could not parse receipt");
      const parsed = JSON.parse(jsonMatch[0]);
      setScanResult(parsed);
      setShowScanner(true);
    } catch (e) {
      console.error("Scan error:", e);
      setScanError("Could not read receipt — try a clearer photo or different file");
    }
    setScanning(false);
  };

  const addScannedMaterials = async () => {
    if (!scanResult) return;
    const receiptId = `rcpt_${Date.now()}`;
    // Store image in localStorage as backup
    if (scanImageData) {
      try { localStorage.setItem(`trade-pa-receipt-${receiptId}`, scanImageData); } catch {}
    }
    const newMaterials = (scanResult.items || []).map(item => ({
      item: item.item,
      qty: item.qty || 1,
      unitPrice: item.unitPrice || 0,
      supplier: scanResult.supplier || "",
      job: scanResult.jobRef || "",
      status: "ordered", // Invoice scanned = already purchased
      receiptId,
      receiptImage: scanImageData || "", // Store base64 in Supabase for persistence
      receiptDate: scanResult.date || "",
    }));
    setMaterials(prev => [...(prev || []), ...newMaterials]);
    // Sync to Xero as bill, attaching the image
    if (user?.id) {
      fetch("/api/xero/create-bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          bill: { ...scanResult, jobRef: "" },
          receiptImage: scanImageData,
          receiptImageType: scanImageType,
        }),
      }).catch(() => {});
    }
    setScanResult(null);
    setScanImageData(null);
    setShowScanner(false);
    setSyncMsg(`✓ ${newMaterials.length} items added from receipt`);
    setTimeout(() => setSyncMsg(""), 3000);
  };

  const saveAll = () => {
    const valid = rows.filter(r => r.item.trim());
    if (!valid.length) return;
    setMaterials(prev => [...(prev || []), ...valid.map(r => ({ ...r, qty: parseInt(r.qty) || 1, unitPrice: parseFloat(r.unitPrice) || 0 }))]);
    setRows([emptyRow()]);
    setShowAdd(false);
  };

  const saveSupplier = () => {
    if (!supplierForm.name) return;
    if (editingSupplier !== null) {
      setSuppliers(prev => prev.map((s, i) => i === editingSupplier ? supplierForm : s));
    } else {
      setSuppliers(prev => [...prev, supplierForm]);
    }
    setEditingSupplier(null);
    setSupplierForm({ name: "", phone: "", email: "", notes: "" });
  };

  const deleteSupplier = (i) => setSuppliers(prev => prev.filter((_, j) => j !== i));
  const dial = (phone) => { if (phone) window.location.href = `tel:${phone.replace(/\s/g, "")}`; };
  const cycleStatus = (i) => setMaterials(prev => (prev || []).map((x, j) => j === i ? { ...x, status: x.status === "to_order" ? "ordered" : x.status === "ordered" ? "collected" : "to_order" } : x));
  const deleteMaterial = (i) => setMaterials(prev => (prev || []).filter((_, j) => j !== i));

  const jobList = [...new Set((materials || []).map(m => m.job).filter(Boolean))];
  const filtered = filterJob === "all" ? (materials || []) : (materials || []).filter(m => m.job === filterJob);
  const totalCost = (materials || []).reduce((s, m) => s + (m.unitPrice || 0) * (m.qty || 1), 0);
  const toOrderCost = (materials || []).filter(m => m.status === "to_order").reduce((s, m) => s + (m.unitPrice || 0) * (m.qty || 1), 0);

  const syncToXero = async () => {
    const toSync = (materials || []).filter(m => m.unitPrice > 0);
    if (!toSync.length) { setSyncMsg("No priced materials to sync — add unit prices first"); setTimeout(() => setSyncMsg(""), 3000); return; }
    setSyncing(true);
    try {
      const res = await fetch("/api/xero/create-bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id, materials: toSync }),
      });
      const data = await res.json();
      if (data.success) {
        setSyncMsg(`✓ ${toSync.length} material${toSync.length !== 1 ? "s" : ""} synced to Xero as purchase orders`);
      } else {
        setSyncMsg(`Error: ${data.error || "Sync failed"}`);
      }
    } catch (e) {
      setSyncMsg("Connection error — check Xero is connected in Settings");
    }
    setSyncing(false);
    setTimeout(() => setSyncMsg(""), 4000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Materials & Orders</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={S.btn("ghost")} onClick={() => setShowSuppliers(true)}>Suppliers</button>
            <button style={{ ...S.btn("ghost"), color: "#13B5EA", borderColor: "#13B5EA44" }} onClick={syncToXero} disabled={syncing}>{syncing ? "Syncing..." : "↑ Xero"}</button>
            <button style={{ ...S.btn("ghost"), color: "#2CA01C", borderColor: "#2CA01C44" }} onClick={async () => {
              try {
                const toSync = materials.filter(m => m.status === "ordered" || m.status === "to_order");
                if (toSync.length === 0) { alert("No materials to sync"); return; }
                await fetch("/api/quickbooks/create-bills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user?.id, materials: toSync }) });
                alert(`✓ ${toSync.length} material${toSync.length !== 1 ? "s" : ""} synced to QuickBooks`);
              } catch { alert("QuickBooks sync failed — check QuickBooks is connected in Settings"); }
            }}>↑ QB</button>
            <button style={S.btn("primary")} onClick={() => setShowAdd(true)}>+ Add</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...S.btn("ghost"), color: C.amber, flex: 1, justifyContent: "center" }} onClick={() => fileRef.current?.click()} disabled={scanning}>{scanning ? "⏳ Scanning..." : "📷 Scan Receipt"}</button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => { scanReceipt(e.target.files?.[0]); e.target.value = ""; }} />
          <button style={{ ...S.btn("ghost"), color: C.amber, flex: 1, justifyContent: "center" }} onClick={() => uploadRef.current?.click()} disabled={scanning}>⬆ Upload Receipt</button>
          <input ref={uploadRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={e => { scanReceipt(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
      </div>

      {scanError && (
        <div style={{ padding: "10px 14px", background: C.red + "18", border: `1px solid ${C.red}44`, borderRadius: 8, fontSize: 12, color: C.red }}>{scanError}</div>
      )}

      {/* Receipt scanner result modal — fully editable */}
      {showScanner && scanResult && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }}>
          <div style={{ ...S.card, maxWidth: 520, width: "100%", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Receipt Scanned ✓</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Review and edit before saving</div>
              </div>
              <button onClick={() => { setShowScanner(false); setScanResult(null); setScanImageData(null); }} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22 }}>×</button>
            </div>

            {/* Receipt image thumbnail */}
            {scanImageData && (
              <div style={{ marginBottom: 14 }}>
                <img src={scanImageData} alt="Receipt" style={{ width: "100%", maxHeight: 160, objectFit: "contain", borderRadius: 8, border: `1px solid ${C.border}`, background: "#111" }} />
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              {/* Editable supplier */}
              <div>
                <label style={S.label}>Supplier</label>
                <input style={S.input} value={scanResult.supplier || ""} onChange={e => setScanResult(r => ({ ...r, supplier: e.target.value }))} placeholder="Supplier name" />
              </div>

              {/* Editable date */}
              <div>
                <label style={S.label}>Date</label>
                <input style={S.input} type="date" value={scanResult.date || ""} onChange={e => setScanResult(r => ({ ...r, date: e.target.value }))} />
              </div>

              {/* Job reference */}
              <div>
                <label style={S.label}>Job Reference <span style={{ color: C.muted, fontWeight: 400 }}>(optional)</span></label>
                <input style={S.input} placeholder="e.g. Kitchen refurb, Job #1042" value={scanResult.jobRef || ""} onChange={e => setScanResult(r => ({ ...r, jobRef: e.target.value }))} />
              </div>

              {/* Editable line items */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label style={S.label}>Items</label>
                  <button onClick={() => setScanResult(r => ({ ...r, items: [...(r.items || []), { item: "", qty: 1, unitPrice: 0 }] }))} style={{ ...S.btn("ghost"), fontSize: 11, padding: "3px 10px" }}>+ Add line</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {/* Header row */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 80px 28px", gap: 6 }}>
                    <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Item</div>
                    <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Qty</div>
                    <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Unit £</div>
                    <div />
                  </div>
                  {(scanResult.items || []).map((item, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 60px 80px 28px", gap: 6, alignItems: "center" }}>
                      <input style={{ ...S.input, fontSize: 12 }} value={item.item} onChange={e => setScanResult(r => ({ ...r, items: r.items.map((x, j) => j === i ? { ...x, item: e.target.value } : x) }))} placeholder="Item name" />
                      <input style={{ ...S.input, fontSize: 12, textAlign: "center" }} type="number" min="1" value={item.qty} onChange={e => setScanResult(r => ({ ...r, items: r.items.map((x, j) => j === i ? { ...x, qty: parseFloat(e.target.value) || 1 } : x) }))} />
                      <input style={{ ...S.input, fontSize: 12 }} type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => setScanResult(r => ({ ...r, items: r.items.map((x, j) => j === i ? { ...x, unitPrice: parseFloat(e.target.value) || 0 } : x) }))} />
                      <button onClick={() => setScanResult(r => ({ ...r, items: r.items.filter((_, j) => j !== i) }))} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16, padding: 0, textAlign: "center" }}>×</button>
                    </div>
                  ))}
                </div>
                {/* Running total */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10, fontSize: 13, fontWeight: 700, color: C.amber }}>
                  Total: £{(scanResult.items || []).reduce((s, x) => s + (x.unitPrice || 0) * (x.qty || 1), 0).toFixed(2)}
                </div>
              </div>
            </div>

            <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>
              Items will be added to Materials{user?.id ? " and a draft bill with the receipt image sent to Xero." : "."}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn("primary"), flex: 1, justifyContent: "center" }} onClick={addScannedMaterials}>✓ Save to Materials</button>
              <button style={S.btn("ghost")} onClick={() => { setShowScanner(false); setScanResult(null); setScanImageData(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {syncMsg && (
        <div style={{ padding: "10px 14px", background: syncMsg.startsWith("✓") ? C.green + "18" : C.red + "18", border: `1px solid ${syncMsg.startsWith("✓") ? C.green + "44" : C.red + "44"}`, borderRadius: 8, fontSize: 12, color: syncMsg.startsWith("✓") ? C.green : C.red }}>
          {syncMsg}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 10 }}>
        {[
          { l: "To Order", v: (materials || []).filter(m => m.status === "to_order").length, sub: toOrderCost > 0 ? `Est. £${toOrderCost.toFixed(2)}` : "No prices set", c: C.red },
          { l: "Ordered", v: (materials || []).filter(m => m.status === "ordered").length, sub: "Awaiting delivery", c: C.amber },
          { l: "Collected", v: (materials || []).filter(m => m.status === "collected").length, sub: "Ready to use", c: C.green },
          { l: "Total Cost", v: totalCost > 0 ? `£${totalCost.toFixed(2)}` : "—", sub: "All materials", c: C.text },
        ].map((st, i) => (
          <div key={i} style={S.card}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{st.l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: st.c }}>{st.v}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{st.sub}</div>
          </div>
        ))}
      </div>

      {jobList.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => setFilterJob("all")} style={S.pill(C.amber, filterJob === "all")}>All Jobs</button>
          {jobList.map(j => <button key={j} onClick={() => setFilterJob(j)} style={S.pill(C.amber, filterJob === j)}>{j}</button>)}
        </div>
      )}

      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={S.sectionTitle}>Material List ({filtered.length})</div>
          {filterJob !== "all" && totalCost > 0 && (
            <div style={{ fontSize: 11, color: C.muted }}>
              Job cost: £{filtered.reduce((s, m) => s + (m.unitPrice || 0) * (m.qty || 1), 0).toFixed(2)}
            </div>
          )}
        </div>
        {filtered.length === 0
          ? <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No materials yet — tap + Add Materials above or ask the AI Assistant.</div>
          : filtered.map((m, rawI) => {
            const i = (materials || []).indexOf(m);
            const [expanded, setExpanded] = React.useState(false);
            return (
              <div key={i} style={{ background: C.surfaceHigh, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}` }}>
                {/* Main row */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }} onClick={() => setExpanded(e => !e)}>
                  <div style={{ width: 4, alignSelf: "stretch", borderRadius: 2, background: statusColor[m.status] || C.muted, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{m.item}</div>
                    <div style={{ fontSize: 11, color: C.muted, display: "flex", flexWrap: "wrap", gap: "2px 8px" }}>
                      {m.qty > 1 && <span>×{m.qty}</span>}
                      {m.supplier && <span>🏪 {m.supplier}</span>}
                      {m.job && <span>📋 {m.job}</span>}
                      {m.unitPrice > 0 && <span style={{ color: C.amber }}>£{((m.unitPrice || 0) * (m.qty || 1)).toFixed(2)}</span>}
                    </div>
                  </div>
                  <div style={{ ...S.badge(statusColor[m.status] || C.muted), flexShrink: 0 }}>{statusLabel[m.status] || m.status}</div>
                  <div style={{ color: C.muted, fontSize: 12, flexShrink: 0 }}>{expanded ? "▲" : "▼"}</div>
                </div>

                {/* Expanded actions */}
                {expanded && (
                  <div style={{ borderTop: `1px solid ${C.border}`, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {/* Status + edit row */}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => cycleStatus(i)} style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", fontSize: 12 }}>
                        {m.status === "to_order" ? "✓ Mark Ordered" : m.status === "ordered" ? "✓ Mark Collected" : "↺ Reset Status"}
                      </button>
                      <button onClick={() => setEditingMaterial({ index: i, item: m.item, qty: String(m.qty || 1), unitPrice: String(m.unitPrice || ""), supplier: m.supplier || "", job: m.job || "", status: m.status || "to_order" })} style={{ ...S.btn("ghost"), fontSize: 12, padding: "6px 14px" }}>✏ Edit</button>
                      <button onClick={() => deleteMaterial(i)} style={{ ...S.btn("ghost"), fontSize: 12, padding: "6px 14px", color: C.red, borderColor: C.red + "44" }}>Delete</button>
                    </div>

                    {/* Accounting row */}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => {
                        fetch("/api/xero/create-bill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user?.id, material: m }) })
                          .then(r => r.json()).then(d => alert(d.error ? `Xero: ${d.error}` : "✓ Bill created in Xero")).catch(() => alert("Xero not connected — check Settings"));
                      }} style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", fontSize: 12, color: "#13B5EA", borderColor: "#13B5EA44" }}>↑ Xero Bill</button>
                      <button onClick={() => {
                        fetch("/api/quickbooks/create-bill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user?.id, material: m }) })
                          .then(r => r.json()).then(d => alert(d.error ? `QuickBooks: ${d.error}` : "✓ Bill created in QuickBooks")).catch(() => alert("QuickBooks not connected — check Settings"));
                      }} style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", fontSize: 12, color: "#2CA01C", borderColor: "#2CA01C44" }}>↑ QB Bill</button>
                    </div>

                    {/* Receipt */}
                    {(m.receiptId || m.receiptSource || m.receiptImage) && (
                      <div
                        style={{ fontSize: 12, background: C.green + "22", color: C.green, border: `1px solid ${C.green}44`, borderRadius: 6, padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                        onClick={e => {
                          e.stopPropagation();
                          const img = m.receiptImage || localStorage.getItem(`trade-pa-receipt-${m.receiptId}`);
                          if (img) {
                            const overlay = document.createElement("div");
                            overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;overflow-y:auto;padding:16px";
                            const closeBtn = document.createElement("button");
                            closeBtn.textContent = "← Back to app";
                            closeBtn.style.cssText = "position:sticky;top:0;align-self:flex-start;background:#f59e0b;color:#000;border:none;border-radius:8px;padding:10px 18px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:16px;font-family:'DM Mono',monospace;z-index:10;margin-top:max(16px, env(safe-area-inset-top, 16px))";
                            closeBtn.onclick = () => document.body.removeChild(overlay);
                            const imgEl = document.createElement("img");
                            imgEl.src = img;
                            imgEl.style.cssText = "max-width:100%;border-radius:8px;background:#fff";
                            overlay.appendChild(closeBtn);
                            overlay.appendChild(imgEl);
                            document.body.appendChild(overlay);
                          } else if (m.receiptSource === "email" && m.receiptFilename) {
                            alert(`Invoice: ${m.receiptFilename}\n\nThis invoice was received via email. Open your Inbox to view the original.`);
                          } else {
                            alert("Invoice image not available.");
                          }
                        }}
                      >🧾 {m.receiptFilename || "View Invoice"}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        }
      </div>

      {/* Material edit modal */}
      {editingMaterial && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }} onClick={() => setEditingMaterial(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.card, maxWidth: 480, width: "100%", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Edit Material</div>
              <button onClick={() => setEditingMaterial(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22 }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><label style={S.label}>Item Description</label><input style={S.input} value={editingMaterial.item} onChange={e => setEditingMaterial(m => ({ ...m, item: e.target.value }))} placeholder="e.g. 22mm copper pipe" /></div>
              <div style={S.grid2}>
                <div><label style={S.label}>Qty</label><input style={S.input} type="number" min="1" value={editingMaterial.qty} onChange={e => setEditingMaterial(m => ({ ...m, qty: e.target.value }))} /></div>
                <div><label style={S.label}>Unit Price (£)</label><input style={S.input} type="number" min="0" step="0.01" value={editingMaterial.unitPrice} onChange={e => setEditingMaterial(m => ({ ...m, unitPrice: e.target.value }))} placeholder="0.00" /></div>
              </div>
              <div><label style={S.label}>Supplier</label><input style={S.input} value={editingMaterial.supplier} onChange={e => setEditingMaterial(m => ({ ...m, supplier: e.target.value }))} placeholder="e.g. Screwfix" /></div>
              <div><label style={S.label}>Job Reference</label><input style={S.input} value={editingMaterial.job} onChange={e => setEditingMaterial(m => ({ ...m, job: e.target.value }))} placeholder="e.g. Kitchen refurb" /></div>
              <div>
                <label style={S.label}>Status</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[["to_order", "To Order"], ["ordered", "Ordered"], ["collected", "Collected"]].map(([v, l]) => (
                    <button key={v} onClick={() => setEditingMaterial(m => ({ ...m, status: v }))} style={S.pill(C.amber, editingMaterial.status === v)}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button style={{ ...S.btn("primary"), flex: 1, justifyContent: "center" }} onClick={() => {
                const { index, ...fields } = editingMaterial;
                setMaterials(prev => (prev || []).map((m, j) => j === index ? { ...m, item: fields.item, qty: parseInt(fields.qty) || 1, unitPrice: parseFloat(fields.unitPrice) || 0, supplier: fields.supplier, job: fields.job, status: fields.status } : m));
                setEditingMaterial(null);
              }}>Save Changes</button>
              <button style={S.btn("ghost")} onClick={() => setEditingMaterial(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={S.sectionTitle}>Supplier Quick Dial</div>
          <button style={{ ...S.btn("ghost"), fontSize: 11 }} onClick={() => setShowSuppliers(true)}>+ Add Supplier</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          {suppliers.map((sup, i) => (
            <div key={i} style={{ padding: "12px 14px", background: C.surfaceHigh, borderRadius: 8, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{sup.name}</div>
              {sup.notes && <div style={{ fontSize: 10, color: C.muted, marginBottom: 8 }}>{sup.notes}</div>}
              {sup.phone ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <button onClick={() => dial(sup.phone)} style={{ ...S.btn("primary"), fontSize: 11, padding: "5px 12px" }}>📞 {sup.phone}</button>
                  {sup.email && <a href={`mailto:${sup.email}`} style={{ ...S.btn("ghost"), fontSize: 11, padding: "5px 12px", textDecoration: "none", textAlign: "center" }}>✉ Email</a>}
                </div>
              ) : (
                <button onClick={() => { setEditingSupplier(i); setSupplierForm(sup); setShowSuppliers(true); }} style={{ ...S.btn("ghost"), fontSize: 11, padding: "5px 10px", width: "100%" }}>Add number</button>
              )}
            </div>
          ))}
        </div>
      </div>

      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }} onClick={() => { setShowAdd(false); setRows([emptyRow()]); }}>
          <div style={{ ...S.card, maxWidth: 700, width: "100%", marginBottom: 16 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Add Materials</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Add multiple items at once — one row per material</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <VoiceFillButton
                  form={{ item: "", qty: 1, unitPrice: "", job: "", supplier: "" }}
                  setForm={updates => {
                    setRows(prev => {
                      const lastEmpty = prev.findIndex(r => !r.item);
                      if (lastEmpty >= 0) {
                        const next = [...prev];
                        next[lastEmpty] = { ...next[lastEmpty], ...updates };
                        return next;
                      }
                      return [...prev, { ...emptyRow(), ...updates }];
                    });
                  }}
                  fieldDescriptions="item (material name e.g. Copper pipe 22mm), qty (quantity as number), unitPrice (unit price in £ as number), job (job name if mentioned), supplier (supplier name if mentioned)"
                />
                <button onClick={() => { setShowAdd(false); setRows([emptyRow()]); }} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22 }}>×</button>
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: 560 }}>
                <div style={{ display: "grid", gridTemplateColumns: "3fr 50px 70px 2fr 2fr 90px 24px", gap: 6, marginBottom: 6 }}>
                  {["Item", "Qty", "Unit £", "Job", "Supplier", "Status", ""].map(h => (
                    <div key={h} style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</div>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  {rows.map((row, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "3fr 50px 70px 2fr 2fr 90px 24px", gap: 6, alignItems: "center" }}>
                      <input style={{ ...S.input, fontSize: 12 }} placeholder="e.g. Copper pipe 22mm" value={row.item} onChange={e => updateRow(i, "item", e.target.value)} />
                      <input style={{ ...S.input, fontSize: 12 }} type="number" min="1" value={row.qty} onChange={e => updateRow(i, "qty", e.target.value)} />
                      <input style={{ ...S.input, fontSize: 12 }} type="number" placeholder="0.00" value={row.unitPrice} onChange={e => updateRow(i, "unitPrice", e.target.value)} />
                      <input style={{ ...S.input, fontSize: 12 }} placeholder="Job name" value={row.job} onChange={e => updateRow(i, "job", e.target.value)} />
                      <select style={{ ...S.input, fontSize: 11 }} value={row.supplier} onChange={e => updateRow(i, "supplier", e.target.value)}>
                        <option value="">Supplier...</option>
                        {suppliers.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                        <option value="other">Other</option>
                      </select>
                      <select style={{ ...S.input, fontSize: 11 }} value={row.status} onChange={e => updateRow(i, "status", e.target.value)}>
                        <option value="to_order">To Order</option>
                        <option value="ordered">Ordered</option>
                        <option value="collected">Collected</option>
                      </select>
                      <button onClick={() => removeRow(i)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16 }} disabled={rows.length === 1}>×</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button onClick={addRow} style={{ ...S.btn("ghost"), fontSize: 12 }}>+ Add Row</button>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {rows.some(r => r.unitPrice > 0) && (
                  <div style={{ fontSize: 11, color: C.muted }}>
                    Total: £{rows.reduce((s, r) => s + (parseFloat(r.unitPrice) || 0) * (parseInt(r.qty) || 1), 0).toFixed(2)}
                  </div>
                )}
                <button style={S.btn("primary", !rows.some(r => r.item.trim()))} disabled={!rows.some(r => r.item.trim())} onClick={saveAll}>
                  Save {rows.filter(r => r.item.trim()).length} Item{rows.filter(r => r.item.trim()).length !== 1 ? "s" : ""} →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSuppliers && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }}>
          <div style={{ ...S.card, maxWidth: 520, width: "100%", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Manage Suppliers</div>
              <button onClick={() => { setShowSuppliers(false); setEditingSupplier(null); setSupplierForm({ name: "", phone: "", notes: "" }); }} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22 }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {suppliers.map((sup, i) => (
                <div key={i} style={{ ...S.card, padding: "12px 14px", background: editingSupplier === i ? C.amber + "11" : C.surfaceHigh, borderColor: editingSupplier === i ? C.amber + "66" : C.border }}>
                  {editingSupplier === i ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {[{ k: "name", l: "Name", p: "City Plumbing" }, { k: "phone", l: "Phone", p: "01483 123456" }, { k: "email", l: "Email", p: "orders@cityplumbing.co.uk" }, { k: "notes", l: "Notes", p: "Main plumbing supplies" }].map(({ k, l, p }) => (
                        <div key={k}><label style={S.label}>{l}</label><input style={S.input} placeholder={p} value={supplierForm[k] || ""} onChange={e => setSupplierForm(f => ({ ...f, [k]: e.target.value }))} /></div>
                      ))}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button style={S.btn("primary", !supplierForm.name)} disabled={!supplierForm.name} onClick={saveSupplier}>Save</button>
                        <button style={S.btn("ghost")} onClick={() => { setEditingSupplier(null); setSupplierForm({ name: "", phone: "", notes: "" }); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{sup.name}</div>
                        <div style={{ fontSize: 11, color: sup.phone ? C.amber : C.muted }}>{sup.phone || "No phone number"}</div>
                        {sup.email && <div style={{ fontSize: 11, color: C.blue }}>{sup.email}</div>}
                        {sup.notes && <div style={{ fontSize: 11, color: C.muted }}>{sup.notes}</div>}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        {sup.phone && <button onClick={() => dial(sup.phone)} style={{ ...S.btn("primary"), fontSize: 11, padding: "5px 12px" }}>📞 Call</button>}
                        {sup.email && <a href={`mailto:${sup.email}`} style={{ ...S.btn("ghost"), fontSize: 11, padding: "5px 10px", textDecoration: "none" }}>✉</a>}
                      </div>
                      <button onClick={() => { setEditingSupplier(i); setSupplierForm(sup); }} style={{ ...S.btn("ghost"), fontSize: 11, padding: "5px 10px" }}>Edit</button>
                      <button onClick={() => deleteSupplier(i)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16 }}>×</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {editingSupplier === null && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 12 }}>Add New Supplier</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[{ k: "name", l: "Name", p: "National Plumbing Supplies" }, { k: "phone", l: "Phone", p: "01234 567890" }, { k: "email", l: "Email", p: "orders@supplier.co.uk" }, { k: "notes", l: "Notes", p: "Good for copper fittings" }].map(({ k, l, p }) => (
                    <div key={k}><label style={S.label}>{l}</label><input style={S.input} placeholder={p} value={supplierForm[k] || ""} onChange={e => setSupplierForm(f => ({ ...f, [k]: e.target.value }))} /></div>
                  ))}
                  <button style={S.btn("primary", !supplierForm.name)} disabled={!supplierForm.name} onClick={saveSupplier}>Add Supplier →</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
function AIAssistant({ brand, jobs, setJobs, invoices, setInvoices, enquiries, setEnquiries, materials, setMaterials, customers, setCustomers, onAddReminder, setView, user }) {
  const [messages, setMessages] = useState([{ role: "assistant", content: `Hi! I'm your Trade PA assistant for ${brand.tradingName || "your business"}.\n\nI can handle everything in the app. Try:\n• "Book in John Smith, boiler service, Friday 10am, £120"\n• "Quote Sarah Chen £450 for new bathroom"\n• "Invoice Kevin Nash £85 for leak repair"\n• "Mark the invoice for Kevin as paid"\n• "Convert Sarah's quote to an invoice"\n• "Confirm the boiler service for John"\n• "Mark copper pipe as ordered"\n• "Delete the enquiry from Dave"\n• "Save Emma Taylor, 07700 900123, emma@email.com"\n\nOr tap 🎙 and speak naturally.` }]);

  const quick = [
    "Mark the invoice for John Smith as paid",
    "Convert Sarah Chen's quote to an invoice",
    "Mark copper pipe as ordered",
    "Confirm the boiler service for Dave",
  ];
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastAction, setLastAction] = useState(null);
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const { recording, transcribing, toggle } = useWhisper((text) => {
    if (text) setInput(text);
  });

  // ── Tool definitions ──────────────────────────────────────────────────────
  const TOOLS = [
    {
      name: "create_job",
      description: "Create a new job in the schedule. Use when the user mentions booking in a customer, scheduling work, or adding a job.",
      input_schema: {
        type: "object",
        properties: {
          customer: { type: "string", description: "Customer full name" },
          address: { type: "string", description: "Job address" },
          type: { type: "string", description: "Type of job e.g. Boiler Service, Leak Repair" },
          date_iso: { type: "string", description: "ISO date string for the job e.g. 2026-03-30" },
          time: { type: "string", description: "Time in HH:MM format e.g. 09:00" },
          value: { type: "number", description: "Job value in pounds" },
          status: { type: "string", enum: ["confirmed", "pending", "quote_sent"], description: "Job status" },
        },
        required: ["customer", "type", "date_iso", "time"],
      },
    },
    {
      name: "create_invoice",
      description: "Create a new invoice. Use when the user mentions invoicing a customer, charging for completed work, or sending a bill. Extract each individual item/service as a separate line item with its own price. Never combine everything into one line.",
      input_schema: {
        type: "object",
        properties: {
          customer: { type: "string", description: "Customer full name" },
          line_items: {
            type: "array",
            description: "Individual line items — one per service or product. Each has a description and price.",
            items: {
              type: "object",
              properties: {
                description: { type: "string", description: "What this line item is e.g. Boiler Service, Call Out Charge" },
                amount: { type: "number", description: "Price for this line item in pounds" },
              },
              required: ["description", "amount"],
            },
          },
          due_days: { type: "number", description: "Days until payment due, default 30" },
        },
        required: ["customer", "line_items"],
      },
    },
    {
      name: "create_quote",
      description: "Create a price quote for a customer. Use when the user mentions quoting, giving a price, or sending an estimate. Extract each individual item/service as a separate line item with its own price.",
      input_schema: {
        type: "object",
        properties: {
          customer: { type: "string", description: "Customer full name" },
          line_items: {
            type: "array",
            description: "Individual line items — one per service or product. Each has a description and price.",
            items: {
              type: "object",
              properties: {
                description: { type: "string", description: "What this line item is e.g. Supply and fit boiler, Labour" },
                amount: { type: "number", description: "Price for this line item in pounds" },
              },
              required: ["description", "amount"],
            },
          },
          valid_days: { type: "number", description: "Days quote is valid for, default 30" },
        },
        required: ["customer", "line_items"],
      },
    },
    {
      name: "log_enquiry",
      description: "Log a new customer enquiry. Use when someone has contacted the tradesperson asking about work.",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Customer name" },
          source: { type: "string", description: "How they got in touch e.g. WhatsApp, Phone, Email, Facebook" },
          message: { type: "string", description: "What they want" },
          urgent: { type: "boolean", description: "Whether this is urgent" },
        },
        required: ["name", "source", "message"],
      },
    },
    {
      name: "set_reminder",
      description: "Set a reminder. Use when the user asks to be reminded about something at a specific time.",
      input_schema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What to remind them about" },
          minutes_from_now: { type: "number", description: "How many minutes from now to fire the reminder" },
          time_label: { type: "string", description: "Human readable time e.g. 3:00 PM today" },
        },
        required: ["text", "minutes_from_now"],
      },
    },
    {
      name: "create_material",
      description: "Add a material or item to the materials list to order or track.",
      input_schema: {
        type: "object",
        properties: {
          item: { type: "string", description: "Material or item name" },
          qty: { type: "number", description: "Quantity needed" },
          supplier: { type: "string", description: "Preferred supplier" },
          job: { type: "string", description: "Which job this is for" },
        },
        required: ["item", "qty"],
      },
    },
    {
      name: "delete_job",
      description: "Delete or cancel a job. Use when the user says to remove, cancel, or delete a job. Match by customer name or job type.",
      input_schema: {
        type: "object",
        properties: {
          customer: { type: "string", description: "Customer name to match" },
          job_type: { type: "string", description: "Job type to help identify it" },
        },
        required: ["customer"],
      },
    },
    {
      name: "delete_invoice",
      description: "Delete an invoice. Use when the user says to remove or delete an invoice. Match by invoice ID or customer name.",
      input_schema: {
        type: "object",
        properties: {
          invoice_id: { type: "string", description: "Invoice ID e.g. INV-042" },
          customer: { type: "string", description: "Customer name if no ID given" },
        },
        required: [],
      },
    },
    {
      name: "delete_enquiry",
      description: "Delete or dismiss an enquiry. Use when the user says to remove, dismiss, or delete an enquiry.",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Customer name to match" },
        },
        required: ["name"],
      },
    },
    {
      name: "create_customer",
      description: "Save a customer's contact details. Use when the user provides a customer's phone number, email, or address to store.",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Customer full name" },
          phone: { type: "string", description: "Phone number" },
          email: { type: "string", description: "Email address" },
          address: { type: "string", description: "Address" },
          notes: { type: "string", description: "Any notes about this customer" },
        },
        required: ["name"],
      },
    },
    {
      name: "delete_customer",
      description: "Delete a customer record. Use when the user says to remove or delete a customer.",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Customer name to match" },
        },
        required: ["name"],
      },
    },
    {
      name: "delete_material",
      description: "Delete a material from the materials list. Use when the user says to remove or delete a material.",
      input_schema: {
        type: "object",
        properties: {
          item: { type: "string", description: "Material item name to match" },
        },
        required: ["item"],
      },
    },
    {
      name: "mark_invoice_paid",
      description: "Mark an invoice as paid. Use when the user says a customer has paid, money has arrived, or to mark something as paid.",
      input_schema: {
        type: "object",
        properties: {
          invoice_id: { type: "string", description: "Invoice ID e.g. INV-042" },
          customer: { type: "string", description: "Customer name if no ID given" },
        },
        required: [],
      },
    },
    {
      name: "update_job_status",
      description: "Update the status of a job. Use when the user wants to confirm, mark as pending, or update a job's status.",
      input_schema: {
        type: "object",
        properties: {
          customer: { type: "string", description: "Customer name to identify the job" },
          job_type: { type: "string", description: "Job type to help identify it" },
          status: { type: "string", enum: ["confirmed", "pending", "quote_sent"], description: "New status for the job" },
        },
        required: ["customer", "status"],
      },
    },
    {
      name: "convert_quote_to_invoice",
      description: "Convert a quote into an invoice. Use when the user says a customer has accepted a quote, or wants to raise an invoice from a quote.",
      input_schema: {
        type: "object",
        properties: {
          quote_id: { type: "string", description: "Quote ID e.g. QTE-042" },
          customer: { type: "string", description: "Customer name if no ID given" },
        },
        required: [],
      },
    },
    {
      name: "update_material_status",
      description: "Update the status of a material — mark as ordered or collected. Use when the user says materials have been ordered or collected/arrived.",
      input_schema: {
        type: "object",
        properties: {
          item: { type: "string", description: "Material item name to match" },
          status: { type: "string", enum: ["to_order", "ordered", "collected"], description: "New status" },
        },
        required: ["item", "status"],
      },
    },
  ];

  // ── Execute tool calls ────────────────────────────────────────────────────
  const executeTool = (name, input) => {
    try {
      switch (name) {
        case "create_customer": {
          const existing = (customers || []).find(c => c.name.toLowerCase() === input.name.toLowerCase());
          if (existing) {
            setCustomers(prev => (prev || []).map(c => c.id === existing.id ? { ...c, ...input } : c));
            setLastAction({ type: "enquiry", label: `Updated: ${input.name}`, view: "Customers" });
            return `Customer updated: ${input.name}${input.phone ? ` · ${input.phone}` : ""}${input.email ? ` · ${input.email}` : ""}.`;
          } else {
            const newCustomer = { name: input.name, phone: input.phone || "", email: input.email || "", address: input.address || "", notes: input.notes || "", id: Date.now() };
            setCustomers(prev => [...(prev || []), newCustomer]);
            setLastAction({ type: "enquiry", label: `Saved: ${input.name}`, view: "Customers" });
            return `Customer saved: ${input.name}${input.phone ? ` · ${input.phone}` : ""}${input.email ? ` · ${input.email}` : ""}.`;
          }
        }
        case "create_job": {
          const dateObj = new Date(`${input.date_iso}T${input.time || "09:00"}`);
          const job = {
            id: Date.now(),
            customer: input.customer,
            address: input.address || "",
            type: input.type,
            date: dateObj.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) + " " + input.time,
            dateObj: dateObj.toISOString(),
            status: input.status || "confirmed",
            value: input.value || 0,
          };
          setJobs(prev => [...(prev || []), job]);
          setLastAction({ type: "job", label: `${input.type} — ${input.customer}`, view: "Schedule" });
          return `Job created: ${input.type} for ${input.customer} on ${dateObj.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} at ${input.time}.`;
        }
        case "create_invoice": {
          const id = nextInvoiceId(invoices);
          const lineItems = input.line_items || [{ description: input.description || "Services", amount: input.amount || 0 }];
          const totalAmount = lineItems.reduce((s, l) => s + (l.amount || 0), 0);
          const inv = {
            id,
            customer: input.customer,
            amount: totalAmount,
            due: `Due in ${input.due_days || 30} days`,
            status: "sent",
            description: lineItems.map(l => `${l.description}|${l.amount}`).join("\n"),
            lineItems,
            isQuote: false,
          };
          setInvoices(prev => [inv, ...(prev || [])]);
          syncInvoiceToAccounting(user?.id, inv);
          setLastAction({ type: "invoice", label: `${id} — £${totalAmount} — ${input.customer}`, view: "Invoices" });
          return `Invoice ${id} created for ${input.customer} — £${totalAmount} total (${lineItems.length} line item${lineItems.length > 1 ? "s" : ""}).`;
        }
        case "create_quote": {
          const id = nextQuoteId(invoices);
          const lineItems = input.line_items || [{ description: input.description || "Services", amount: input.amount || 0 }];
          const totalAmount = lineItems.reduce((s, l) => s + (l.amount || 0), 0);
          const quote = {
            id,
            customer: input.customer,
            amount: totalAmount,
            due: `Valid for ${input.valid_days || 30} days`,
            status: "sent",
            description: lineItems.map(l => `${l.description}|${l.amount}`).join("\n"),
            lineItems,
            isQuote: true,
          };
          setInvoices(prev => [quote, ...(prev || [])]);
          setLastAction({ type: "invoice", label: `${id} — £${totalAmount} — ${input.customer}`, view: "Quotes" });
          return `Quote ${id} created for ${input.customer} — £${totalAmount} total (${lineItems.length} line item${lineItems.length > 1 ? "s" : ""}).`;
        }
        case "log_enquiry": {
          const enq = { name: input.name, source: input.source, msg: input.message, time: "Just now", urgent: input.urgent || false };
          setEnquiries(prev => [enq, ...(prev || [])]);
          setLastAction({ type: "enquiry", label: `${input.name} via ${input.source}`, view: "Dashboard" });
          return `Enquiry logged from ${input.name} via ${input.source}.`;
        }
        case "set_reminder": {
          const reminder = { id: `r${Date.now()}`, text: input.text, time: Date.now() + (input.minutes_from_now * 60000), timeLabel: input.time_label || "", done: false };
          onAddReminder(reminder);
          setLastAction({ type: "reminder", label: input.text, view: "Reminders" });
          return `Reminder set: "${input.text}" — ${input.time_label || `in ${input.minutes_from_now} minutes`}.`;
        }
        case "create_material": {
          const mat = { item: input.item, qty: input.qty || 1, supplier: input.supplier || "", job: input.job || "", status: "to_order" };
          setMaterials(prev => [...(prev || []), mat]);
          setLastAction({ type: "material", label: `${input.item} x${input.qty || 1}`, view: "Materials" });
          return `Material added: ${input.item} x${input.qty || 1}${input.supplier ? ` from ${input.supplier}` : ""}${input.job ? ` for ${input.job}` : ""}.`;
        }
        case "delete_job": {
          const match = (jobs || []).find(j => j.customer.toLowerCase().includes(input.customer.toLowerCase()) && (!input.job_type || j.type.toLowerCase().includes(input.job_type.toLowerCase())));
          if (!match) return `Couldn't find a job for "${input.customer}". Check the Schedule tab.`;
          setJobs(prev => (prev || []).filter(j => j.id !== match.id));
          setLastAction({ type: "job", label: `Deleted: ${match.type} — ${match.customer}`, view: "Schedule" });
          return `Job deleted: ${match.type} for ${match.customer}.`;
        }
        case "delete_invoice": {
          const match = (invoices || []).find(i =>
            (input.invoice_id && i.id.toLowerCase() === input.invoice_id.toLowerCase()) ||
            (input.customer && i.customer.toLowerCase().includes(input.customer.toLowerCase()))
          );
          if (!match) return `Couldn't find that invoice. Check the Invoices tab.`;
          setInvoices(prev => (prev || []).filter(i => i.id !== match.id));
          setLastAction({ type: "invoice", label: `Deleted: ${match.id} — ${match.customer}`, view: "Invoices" });
          return `Invoice ${match.id} for ${match.customer} (£${match.amount}) deleted.`;
        }
        case "delete_enquiry": {
          const match = (enquiries || []).find(e => e.name.toLowerCase().includes(input.name.toLowerCase()));
          if (!match) return `Couldn't find an enquiry from "${input.name}".`;
          setEnquiries(prev => (prev || []).filter(e => e !== match));
          setLastAction({ type: "enquiry", label: `Deleted: ${match.name}`, view: "Dashboard" });
          return `Enquiry from ${match.name} deleted.`;
        }
        case "delete_customer": {
          const match = (customers || []).find(c => c.name.toLowerCase().includes(input.name.toLowerCase()));
          if (!match) return `Couldn't find a customer named "${input.name}". Check the Customers tab.`;
          setCustomers(prev => (prev || []).filter(c => c.id !== match.id));
          setLastAction({ type: "enquiry", label: `Deleted: ${match.name}`, view: "Customers" });
          return `Customer ${match.name} deleted.`;
        }
        case "delete_material": {
          const match = (materials || []).find(m => m.item.toLowerCase().includes(input.item.toLowerCase()));
          if (!match) return `Couldn't find a material matching "${input.item}". Check the Materials tab.`;
          setMaterials(prev => (prev || []).filter(m => m !== match));
          setLastAction({ type: "material", label: `Deleted: ${match.item}`, view: "Materials" });
          return `Material "${match.item}" deleted.`;
        }
        case "mark_invoice_paid": {
          const match = (invoices || []).find(i =>
            !i.isQuote && (
              (input.invoice_id && i.id.toLowerCase() === input.invoice_id.toLowerCase()) ||
              (input.customer && i.customer.toLowerCase().includes(input.customer.toLowerCase()) && i.status !== "paid")
            )
          );
          if (!match) return `Couldn't find an unpaid invoice matching that. Check the Invoices tab.`;
          setInvoices(prev => (prev || []).map(i => i.id === match.id ? { ...i, status: "paid", due: "Paid" } : i));
          syncInvoiceToAccounting(user?.id, { ...match, status: "paid" });
          sendPush({ title: "💰 Invoice Paid", body: `${match.customer} paid £${match.amount}`, url: "/", type: "invoice_paid", tag: "invoice-paid" });
          setLastAction({ type: "invoice", label: `Paid: ${match.id} — ${match.customer}`, view: "Invoices" });
          return `Invoice ${match.id} for ${match.customer} (£${match.amount}) marked as paid.`;
        }
        case "update_job_status": {
          const match = (jobs || []).find(j => j.customer.toLowerCase().includes(input.customer.toLowerCase()) && (!input.job_type || j.type.toLowerCase().includes(input.job_type.toLowerCase())));
          if (!match) return `Couldn't find a job for "${input.customer}". Check the Schedule tab.`;
          setJobs(prev => (prev || []).map(j => j.id === match.id ? { ...j, status: input.status } : j));
          setLastAction({ type: "job", label: `${input.status}: ${match.type} — ${match.customer}`, view: "Schedule" });
          return `Job "${match.type}" for ${match.customer} updated to ${input.status}.`;
        }
        case "convert_quote_to_invoice": {
          const match = (invoices || []).find(i =>
            i.isQuote && (
              (input.quote_id && i.id.toLowerCase() === input.quote_id.toLowerCase()) ||
              (input.customer && i.customer.toLowerCase().includes(input.customer.toLowerCase()))
            )
          );
          if (!match) return `Couldn't find a quote matching that. Check the Quotes tab.`;
          const newId = nextInvoiceId(invoices);
          const inv = { ...match, id: newId, isQuote: false, status: "sent", due: `Due in ${brand.paymentTerms || 30} days` };
          setInvoices(prev => [inv, ...(prev || []).filter(i => i.id !== match.id)]);
          setLastAction({ type: "invoice", label: `Converted: ${newId} — ${match.customer}`, view: "Invoices" });
          return `Quote ${match.id} converted to invoice ${newId} for ${match.customer} — £${match.amount}.`;
        }
        case "update_material_status": {
          const match = (materials || []).find(m => m.item.toLowerCase().includes(input.item.toLowerCase()));
          if (!match) return `Couldn't find a material matching "${input.item}". Check the Materials tab.`;
          setMaterials(prev => (prev || []).map(m => m === match ? { ...m, status: input.status } : m));
          setLastAction({ type: "material", label: `${input.status}: ${match.item}`, view: "Materials" });
          return `Material "${match.item}" marked as ${input.status}.`;
        }
        default:
          return `Unknown action: ${name}`;
      }
    } catch (err) {
      console.error("Tool execution error:", name, err);
      return `Error executing ${name}: ${err.message}`;
    }
  };

  const SYSTEM = `You are a smart admin assistant for ${brand.tradingName}, a UK sole trader trades business. Today is ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.

Current data you can act on:
- Jobs: ${jobs.length === 0 ? "none" : jobs.map(j => `${j.customer} (${j.type}, ${j.status})`).join(", ")}
- Invoices: ${invoices.filter(i => !i.isQuote).length === 0 ? "none" : invoices.filter(i => !i.isQuote).map(i => `${i.id} ${i.customer} £${i.amount} (${i.status})`).join(", ")}
- Quotes: ${invoices.filter(i => i.isQuote).length === 0 ? "none" : invoices.filter(i => i.isQuote).map(i => `${i.id} ${i.customer} £${i.amount} (${i.status})`).join(", ")}
- Enquiries: ${enquiries.length === 0 ? "none" : enquiries.map(e => e.name).join(", ")}
- Materials: ${materials.length === 0 ? "none" : materials.map(m => `${m.item} x${m.qty} (${m.status})`).join(", ")}
- Customers: ${customers.length === 0 ? "none" : customers.map(c => `${c.name}${c.phone ? ` (${c.phone})` : ""}${c.email ? ` <${c.email}>` : ""}`).join(", ")}

You can perform ALL of the following actions — always use a tool, never just describe what you'd do:

CREATE: create_job, create_invoice, create_quote, log_enquiry, set_reminder, create_material, create_customer
DELETE: delete_job, delete_invoice, delete_enquiry, delete_customer, delete_material
UPDATE: mark_invoice_paid, update_job_status, update_material_status, convert_quote_to_invoice

Rules:
- For jobs: if no year given assume ${new Date().getFullYear()}. Calculate actual dates from "Friday", "next Monday" etc.
- For reminders: calculate minutes_from_now from the time mentioned.
- For updates/deletes: match by name or ID. If no match, say so clearly.
- After every tool use: confirm in 1-2 sentences what you did. Use £ not $. Be concise.
- For invoices/quotes: ALWAYS use the line_items array — one object per item with description and amount. If someone says "invoice for labour £200 and materials £150" create TWO line items: [{description:"Labour",amount:200},{description:"Materials",amount:150}]. Never put multiple items in one description string. Total amount is calculated automatically from the line items.`;

  const send = async (text) => {
    if (!text.trim() || loading) return;
    const userMsg = { role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);
    setLastAction(null);

    try {
      const apiMessages = updated
        .filter(m => m.role === "user" || m.role === "assistant")
        .filter(m => typeof m.content === "string")
        .map(m => ({ role: m.role, content: m.content }));

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: SYSTEM,
          tools: TOOLS,
          messages: apiMessages,
        }),
      });

      const data = await res.json();

      // Surface API errors clearly
      if (data.error) {
        console.error("API error:", data.error);
        setMessages(prev => [...prev, { role: "assistant", content: `API Error: ${data.error.message || JSON.stringify(data.error)}` }]);
        setLoading(false);
        return;
      }

      if (!data.content || data.content.length === 0) {
        console.error("Empty response:", data);
        setMessages(prev => [...prev, { role: "assistant", content: `No response received. Stop reason: ${data.stop_reason || "unknown"}` }]);
        setLoading(false);
        return;
      }

      let replyText = "";
      const toolResults = [];

      for (const block of data.content) {
        if (block.type === "text") {
          replyText += block.text;
        } else if (block.type === "tool_use") {
          const result = executeTool(block.name, block.input);
          toolResults.push(result);
        }
      }

      const finalReply = replyText || toolResults.join("\n") || "Done.";
      setMessages(prev => [...prev, { role: "assistant", content: finalReply }]);

    } catch (e) {
      console.error("AI send error:", e);
      setMessages(prev => [...prev, { role: "assistant", content: `Connection error: ${e.message}. Check your internet connection and try again.` }]);
    }
    setLoading(false);
  };

  const micLabel = transcribing ? "⏳ Transcribing..." : recording ? "⏹ Tap to stop" : "🎙 Voice note";

  const actionIcons = { job: "📅", invoice: "💰", enquiry: "📩", reminder: "🔔", material: "🔧" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 140px)", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {quick.map((q, i) => (
          <button key={i} onClick={() => send(q)} style={{ padding: "5px 12px", background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 20, color: C.textDim, fontSize: 11, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>{q}</button>
        ))}
      </div>

      {/* Last action confirmation banner */}
      {lastAction && (
        <div style={{ background: C.green + "18", border: `1px solid ${C.green}44`, borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
          <span style={{ fontSize: 16 }}>{actionIcons[lastAction.type]}</span>
          <span style={{ color: C.green, fontWeight: 600 }}>{lastAction.label}</span>
          <span style={{ color: C.muted }}>saved successfully</span>
          <button onClick={() => setView(lastAction.view)} style={{ ...S.btn("ghost"), fontSize: 11, padding: "3px 10px", marginLeft: "auto" }}>View →</button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        {messages.map((m, i) => (
          <div key={i} style={S.aiMsg(m.role)}>
            <div style={S.avatar(m.role)}>{m.role === "user" ? brand.tradingName[0] : "⚡"}</div>
            <div style={S.aiBubble(m.role)}>{m.content}</div>
          </div>
        ))}
        {loading && (
          <div style={S.aiMsg("assistant")}>
            <div style={S.avatar("assistant")}>⚡</div>
            <div style={{ ...S.aiBubble("assistant"), color: C.muted }}>Working on it...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {recording && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: C.red + "18", border: `1px solid ${C.red}44`, borderRadius: 6, fontSize: 12, color: C.red }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.red, animation: "bellPulse 1s ease infinite" }} />
          Recording — tap Stop when done
        </div>
      )}
      {transcribing && (
        <div style={{ padding: "6px 12px", background: C.amber + "18", border: `1px solid ${C.amber}44`, borderRadius: 6, fontSize: 12, color: C.amber }}>
          ⏳ Transcribing your voice note...
        </div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea
          style={{ ...S.input, flex: 1, minHeight: 44, maxHeight: 120, resize: "none" }}
          placeholder="Type here, or tap 🎙 to speak..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          rows={2}
        />
        <button
          onClick={toggle}
          disabled={transcribing}
          style={{ padding: "8px 10px", borderRadius: 6, border: `1px solid ${recording ? C.red : C.border}`, background: recording ? C.red + "22" : C.surfaceHigh, color: recording ? C.red : C.muted, fontSize: 11, fontFamily: "'DM Mono',monospace", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
        >{transcribing ? "⏳" : recording ? "⏹ Stop" : "🎙"}</button>
        <button onClick={() => send(input)} style={{ ...S.btn("primary"), padding: "10px 16px" }} disabled={loading || !input.trim()}>Send</button>
      </div>
    </div>
  );
}

// ─── Payments ─────────────────────────────────────────────────────────────────
function Payments({ brand, invoices, setInvoices, customers, user, sendPush }) {
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [docType, setDocType] = useState("invoices");
  const [selected, setSelected] = useState(null);

  const safeInvoices = invoices || [];
  const allInvoices = safeInvoices.filter(i => !i.isQuote);
  const allQuotes = safeInvoices.filter(i => i.isQuote);

  // Invoice breakdowns
  const paidInvoices = allInvoices.filter(i => i.status === "paid");
  const outstandingInvoices = allInvoices.filter(i => i.status !== "paid");
  const overdueInvoices = allInvoices.filter(i => i.status === "overdue");

  // Quote breakdowns
  const acceptedQuotes = allQuotes.filter(q => q.status === "accepted");
  const pendingQuotes = allQuotes.filter(q => q.status !== "accepted" && q.status !== "declined");
  const declinedQuotes = allQuotes.filter(q => q.status === "declined");

  const updateStatus = (id, status) => {
    const inv = (invoices || []).find(i => i.id === id);
    setInvoices(prev => (prev || []).map(i => i.id === id ? { ...i, status, due: status === "paid" ? "Paid" : i.due } : i));
    if (selected && selected.id === id) setSelected(s => ({ ...s, status, due: status === "paid" ? "Paid" : s.due }));
    if (status === "paid" && inv) {
      syncInvoiceToAccounting(user?.id, { ...inv, status: "paid" });
      if (sendPush) sendPush({
        title: "💰 Invoice Paid",
        body: `${inv.customer} paid £${inv.amount}`,
        url: "/",
        type: "invoice_paid",
        tag: "invoice-paid",
      });
    }
  };

  const convertToInvoice = (quote) => {
    const newId = nextInvoiceId(invoices);
    const inv = { ...quote, isQuote: false, id: newId, status: "sent", due: `Due in ${brand.paymentTerms || 30} days` };
    setInvoices(prev => [inv, ...(prev || []).filter(i => i.id !== quote.id)]);
    setSelected(null);
    setDocType("invoices");
  };

  const deleteDoc = (id) => {
    setInvoices(prev => (prev || []).filter(i => i.id !== id));
    setSelected(null);
  };

  const accent = brand.accentColor || "#f59e0b";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Tab switcher */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => { setDocType("invoices"); setSelected(null); }} style={S.pill(accent, docType === "invoices")}>
            💰 Invoices ({allInvoices.length})
          </button>
          <button onClick={() => { setDocType("quotes"); setSelected(null); }} style={S.pill(accent, docType === "quotes")}>
            📋 Quotes ({allQuotes.length})
          </button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={S.btn("ghost")} onClick={() => setShowQuoteModal(true)}>+ Quote</button>
          <button style={S.btn("primary")} onClick={() => setShowInvoiceModal(true)}>+ Invoice</button>
        </div>
      </div>

      {/* ── INVOICES VIEW ── */}
      {docType === "invoices" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 10 }}>
            <div style={S.card}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Outstanding</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: outstandingInvoices.length > 0 ? C.amber : C.muted }}>{outstandingInvoices.length}</div>
              <div style={{ fontSize: 11, color: C.muted }}>£{outstandingInvoices.reduce((s, i) => s + (i.amount || 0), 0).toLocaleString()}</div>
            </div>
            <div style={S.card}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Overdue</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: overdueInvoices.length > 0 ? C.red : C.muted }}>{overdueInvoices.length}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{overdueInvoices.length > 0 ? "Needs chasing" : "None"}</div>
            </div>
            <div style={S.card}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Paid</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.green }}>{paidInvoices.length}</div>
              <div style={{ fontSize: 11, color: C.muted }}>£{paidInvoices.reduce((s, i) => s + (i.amount || 0), 0).toLocaleString()}</div>
            </div>
            <div style={S.card}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Total</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.text }}>{allInvoices.length}</div>
              <div style={{ fontSize: 11, color: C.muted }}>£{allInvoices.reduce((s, i) => s + (i.amount || 0), 0).toLocaleString()}</div>
            </div>
          </div>

          {/* Outstanding */}
          <div style={S.card}>
            <div style={S.sectionTitle}>Outstanding ({outstandingInvoices.length})</div>
            {outstandingInvoices.length === 0
              ? <div style={{ fontSize: 12, color: C.green, fontStyle: "italic" }}>All invoices paid!</div>
              : outstandingInvoices.map(inv => (
                <div key={inv.id} onClick={() => setSelected(inv)} style={{ ...S.row, cursor: "pointer" }}>
                  <div style={{ width: 4, height: 44, borderRadius: 2, background: inv.status === "overdue" ? C.red : C.amber, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{inv.customer}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>{inv.id} · {inv.due}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: inv.status === "overdue" ? C.red : C.text, marginRight: 8, flexShrink: 0 }}>£{inv.amount}</div>
                  <div style={{ ...S.badge(statusColor[inv.status] || C.muted), marginRight: 8, flexShrink: 0 }}>{statusLabel[inv.status] || inv.status}</div>
                  <button onClick={e => { e.stopPropagation(); updateStatus(inv.id, "paid"); }} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px", color: C.green, flexShrink: 0 }}>✓ Paid</button>
                  <div style={{ fontSize: 11, color: C.muted, marginLeft: 4 }}>→</div>
                </div>
              ))
            }
          </div>

          {/* Paid */}
          {paidInvoices.length > 0 && (
            <div style={S.card}>
              <div style={S.sectionTitle}>Paid ({paidInvoices.length})</div>
              {paidInvoices.map(inv => (
                <div key={inv.id} onClick={() => setSelected(inv)} style={{ ...S.row, cursor: "pointer" }}>
                  <div style={{ width: 4, height: 44, borderRadius: 2, background: C.green, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{inv.customer}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>{inv.id}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.green, marginRight: 8, flexShrink: 0 }}>£{inv.amount}</div>
                  <div style={S.badge(C.green)}>Paid</div>
                  <div style={{ fontSize: 11, color: C.muted, marginLeft: 8 }}>→</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── QUOTES VIEW ── */}
      {docType === "quotes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 10 }}>
            <div style={S.card}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Pending</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.blue }}>{pendingQuotes.length}</div>
              <div style={{ fontSize: 11, color: C.muted }}>£{pendingQuotes.reduce((s, q) => s + (q.amount || 0), 0).toLocaleString()}</div>
            </div>
            <div style={S.card}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Accepted</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.green }}>{acceptedQuotes.length}</div>
              <div style={{ fontSize: 11, color: C.muted }}>£{acceptedQuotes.reduce((s, q) => s + (q.amount || 0), 0).toLocaleString()}</div>
            </div>
            <div style={S.card}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Declined</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: declinedQuotes.length > 0 ? C.red : C.muted }}>{declinedQuotes.length}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{declinedQuotes.length > 0 ? "Not won" : "None"}</div>
            </div>
            <div style={S.card}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Pipeline</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.text }}>{allQuotes.length}</div>
              <div style={{ fontSize: 11, color: C.muted }}>£{allQuotes.reduce((s, q) => s + (q.amount || 0), 0).toLocaleString()}</div>
            </div>
          </div>

          {/* All quotes */}
          <div style={S.card}>
            <div style={S.sectionTitle}>All Quotes ({allQuotes.length})</div>
            {allQuotes.length === 0
              ? <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No quotes yet — tap + Quote above or ask the AI Assistant.</div>
              : allQuotes.map(q => (
                <div key={q.id} onClick={() => setSelected(q)} style={{ ...S.row, cursor: "pointer" }}>
                  <div style={{ width: 4, height: 44, borderRadius: 2, background: q.status === "accepted" ? C.green : q.status === "declined" ? C.red : C.blue, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{q.customer}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>{q.address || q.id} · {q.due}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginRight: 8, flexShrink: 0 }}>£{q.amount}</div>
                  <div style={{ ...S.badge(q.status === "accepted" ? C.green : q.status === "declined" ? C.red : C.blue), marginRight: 8, flexShrink: 0 }}>
                    {q.status === "accepted" ? "Accepted" : q.status === "declined" ? "Declined" : "Sent"}
                  </div>
                  <button onClick={e => { e.stopPropagation(); convertToInvoice(q); }} style={{ ...S.btn("primary"), fontSize: 11, padding: "4px 10px", flexShrink: 0 }}>→ Invoice</button>
                  <div style={{ fontSize: 11, color: C.muted, marginLeft: 4 }}>→</div>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }} onClick={() => setSelected(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.card, maxWidth: 480, width: "100%", marginBottom: 16 }}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                  {selected.isQuote ? "Quote" : "Invoice"} · {selected.id}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{selected.customer}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: selected.status === "paid" ? C.green : selected.isQuote ? C.blue : C.amber }}>£{selected.amount}</div>
                  <span style={S.badge(statusColor[selected.status] || C.muted)}>{statusLabel[selected.status] || selected.status}</span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 24 }}>×</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Line Items</div>
                {(selected.lineItems && selected.lineItems.length > 0)
                  ? selected.lineItems.map((l, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingTop: i > 0 ? 6 : 0, borderTop: i > 0 ? `1px solid ${C.border}` : "none", marginTop: i > 0 ? 6 : 0 }}>
                      <span>{l.description || l.desc || ""}</span>
                      {(l.amount || l.amount === 0) && <span style={{ fontWeight: 600, flexShrink: 0, marginLeft: 12 }}>£{(parseFloat(l.amount) || 0).toFixed(2)}</span>}
                    </div>
                  ))
                  : <div style={{ fontSize: 13, whiteSpace: "pre-line", lineHeight: 1.7 }}>{selected.description || selected.desc || "—"}</div>
                }
              </div>
              <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{selected.isQuote ? "Valid for" : "Payment due"}</div>
                <div style={{ fontSize: 13 }}>{selected.due}</div>
              </div>
            </div>

            {/* Mark Paid — full width green button for invoices */}
            {!selected.isQuote && selected.status !== "paid" && (
              <button style={{ ...S.btn("primary"), width: "100%", justifyContent: "center", padding: "14px", fontSize: 15, background: C.green, color: "#000", marginBottom: 10 }}
                onClick={() => updateStatus(selected.id, "paid")}>
                ✓ Mark as Paid
              </button>
            )}
            {!selected.isQuote && selected.status === "paid" && (
              <div style={{ background: C.green + "18", border: `1px solid ${C.green}44`, borderRadius: 8, padding: "12px 16px", textAlign: "center", color: C.green, fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
                ✓ Invoice Paid
              </div>
            )}

            {/* Convert to Invoice — for quotes */}
            {selected.isQuote && (
              <button style={{ ...S.btn("primary"), width: "100%", justifyContent: "center", padding: "14px", fontSize: 15, marginBottom: 10 }}
                onClick={() => convertToInvoice(selected)}>
                → Convert to Invoice
              </button>
            )}

            {/* Quote accept/decline */}
            {selected.isQuote && selected.status !== "accepted" && selected.status !== "declined" && (
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", color: C.green }} onClick={() => updateStatus(selected.id, "accepted")}>✓ Mark Accepted</button>
                <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", color: C.red }} onClick={() => updateStatus(selected.id, "declined")}>✗ Mark Declined</button>
              </div>
            )}

            {/* Secondary */}
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center" }} onClick={() => downloadInvoicePDF(brand, selected)}>⬇ PDF</button>
              {!selected.isQuote && selected.status === "overdue" && (
                <button style={{ ...S.btn("danger") }} onClick={() => updateStatus(selected.id, "sent")}>📨 Chase</button>
              )}
              <button style={{ ...S.btn("ghost"), color: C.red }} onClick={() => deleteDoc(selected.id)}>Delete</button>
            </div>

            {/* Accounting sync — invoice only */}
            {!selected.isQuote && (
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", color: "#13B5EA", borderColor: "#13B5EA44", fontSize: 11 }}
                  onClick={() => {
                    fetch("/api/xero/create-invoice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user?.id, invoice: selected }) })
                      .then(r => r.json()).then(d => alert(d.error ? `Xero: ${d.error}` : "✓ Invoice sent to Xero")).catch(() => alert("Xero not connected — check Settings"));
                  }}>Xero Invoice</button>
                <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", color: "#2CA01C", borderColor: "#2CA01C44", fontSize: 11 }}
                  onClick={() => {
                    fetch("/api/quickbooks/create-invoice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user?.id, invoice: selected }) })
                      .then(r => r.json()).then(d => alert(d.error ? `QuickBooks: ${d.error}` : "✓ Invoice sent to QuickBooks")).catch(() => alert("QuickBooks not connected — check Settings"));
                  }}>QB Invoice</button>
              </div>
            )}
          </div>
        </div>
      )}

      {showInvoiceModal && <InvoiceModal brand={brand} invoices={safeInvoices} user={user} onClose={() => setShowInvoiceModal(false)} onSent={(inv) => { setInvoices(prev => [inv, ...(prev || [])]); setShowInvoiceModal(false); syncInvoiceToAccounting(user?.id, inv); }} />}
      {showQuoteModal && <QuoteModal brand={brand} invoices={safeInvoices} user={user} onClose={() => setShowQuoteModal(false)} onSent={(q) => { setInvoices(prev => [q, ...(prev || [])]); setShowQuoteModal(false); setDocType("quotes"); }} />}
    </div>
  );
}

// ─── Mic Button for Modals ────────────────────────────────────────────────────
function MicButton({ form, setForm, accentColor }) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setRecording(false);
        setProcessing(true);
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const fd = new FormData();
          fd.append("file", blob, "audio.webm");
          fd.append("model", "whisper-1");
          const wr = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST", headers: { Authorization: `Bearer ${import.meta.env.VITE_OPENAI_KEY}` }, body: fd,
          });
          const { text } = await wr.json();
          if (!text) { setProcessing(false); return; }

          // Ask Claude to interpret the voice and return updated fields
          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
            body: JSON.stringify({
              model: "claude-sonnet-4-6",
              max_tokens: 400,
              messages: [{
                role: "user",
                content: `You are helping fill in an invoice/quote form. Current form: ${JSON.stringify({ customer: form.customer, email: form.email, address: form.address, amount: form.amount, desc: form.desc, jobRef: form.jobRef, poNumber: form.poNumber || "", due: form.due })}.
Voice instruction: "${text}"
Return ONLY a JSON object with ONLY the fields to update (use exact same keys). Example: {"customer":"John Smith","amount":"450"}.
Do not include fields that aren't being changed.`,
              }],
            }),
          });
          const data = await res.json();
          const raw = data.content?.[0]?.text || "";
          const match = raw.match(/\{[\s\S]*\}/);
          if (match) {
            const updates = JSON.parse(match[0]);
            setForm(f => ({ ...f, ...updates }));
          }
        } catch (e) { console.error("Mic error:", e); }
        setProcessing(false);
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
    } catch (e) { console.error("Mic access denied"); }
  };

  const stop = () => { if (mediaRef.current?.state === "recording") mediaRef.current.stop(); };

  const label = processing ? "⏳" : recording ? "⏹" : "🎙";
  const color = recording ? C.red : processing ? C.amber : C.muted;

  return (
    <button
      onClick={recording ? stop : start}
      disabled={processing}
      title={recording ? "Tap to stop" : "Voice edit"}
      style={{ background: recording ? C.red + "22" : "none", border: `1px solid ${recording ? C.red + "66" : C.border}`, borderRadius: 6, color, cursor: processing ? "wait" : "pointer", fontSize: 15, padding: "4px 8px", transition: "all 0.2s", flexShrink: 0 }}
    >{label}</button>
  );
}

// ─── Generic Voice Fill Button ────────────────────────────────────────────────
// Works with any form — pass fieldDescriptions like:
// "customer (full name), address, type (job type e.g. Boiler Service), value (£ amount), notes"
function VoiceFillButton({ form, setForm, fieldDescriptions, color }) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const accentColor = color || C.amber;

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setRecording(false);
        setProcessing(true);
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const fd = new FormData();
          fd.append("file", blob, "audio.webm");
          fd.append("model", "whisper-1");
          const wr = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: { Authorization: `Bearer ${import.meta.env.VITE_OPENAI_KEY}` },
            body: fd,
          });
          const { text } = await wr.json();
          if (!text) { setProcessing(false); return; }

          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
            body: JSON.stringify({
              model: "claude-sonnet-4-6",
              max_tokens: 400,
              messages: [{
                role: "user",
                content: `Fill in a form from a voice instruction. 
Form fields: ${fieldDescriptions}
Current values: ${JSON.stringify(form)}
Voice instruction: "${text}"
Return ONLY a JSON object with ONLY the fields to update, using the exact same keys as the form. Example: {"customer":"John Smith","address":"5 High Street"}.
Do not include fields not being changed. Do not include any explanation.`,
              }],
            }),
          });
          const data = await res.json();
          const raw = data.content?.[0]?.text || "";
          const match = raw.match(/\{[\s\S]*\}/);
          if (match) {
            try {
              const updates = JSON.parse(match[0]);
              setForm(f => ({ ...f, ...updates }));
            } catch {}
          }
        } catch (e) { console.error("Voice fill error:", e); }
        setProcessing(false);
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
    } catch (e) { alert("Microphone access denied. Please allow mic access in your browser settings."); }
  };

  const stop = () => { if (mediaRef.current?.state === "recording") mediaRef.current.stop(); };
  const label = processing ? "⏳" : recording ? "⏹ Stop" : "🎙 Dictate";

  return (
    <button
      onClick={recording ? stop : start}
      disabled={processing}
      title={recording ? "Tap to stop recording" : "Fill form by voice"}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "6px 12px", borderRadius: 20, border: "none",
        cursor: processing ? "wait" : "pointer",
        fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 700,
        background: recording ? C.red : processing ? C.amber + "33" : accentColor + "22",
        color: recording ? "#fff" : processing ? C.amber : accentColor,
        transition: "all 0.2s", flexShrink: 0,
      }}
    >{label}</button>
  );
}
function LineItemsBuilder({ form, setForm, accentColor, isQuote }) {
  // Normalise lineItems — support both {desc} and {description} keys
  const items = form.lineItems && form.lineItems.length > 0
    ? form.lineItems.map(l => ({ desc: l.desc ?? l.description ?? "", amount: l.amount ?? "" }))
    : [{ desc: form.desc || "", amount: "" }];

  const [useIndividualPrices, setUseIndividualPrices] = useState(
    form.lineItems && form.lineItems.some(l => l.amount && l.amount !== "")
  );

  const updateItem = (i, key, val) => {
    const next = items.map((item, idx) => idx === i ? { ...item, [key]: val } : item);
    setForm(f => ({ ...f, lineItems: next, desc: next.map(l => l.desc).filter(Boolean).join("\n") }));
  };

  const addItem = () => {
    const next = [...items, { desc: "", amount: "" }];
    setForm(f => ({ ...f, lineItems: next }));
  };

  const removeItem = (i) => {
    const next = items.filter((_, idx) => idx !== i);
    setForm(f => ({ ...f, lineItems: next, desc: next.map(l => l.desc).filter(Boolean).join("\n") }));
  };

  const total = useIndividualPrices ? items.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0) : null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <label style={S.label}>{isQuote ? "Scope of Work" : "Line Items"}</label>
        <button
          onClick={() => {
            const next = !useIndividualPrices;
            setUseIndividualPrices(next);
            if (!next) setForm(f => ({ ...f, lineItems: items.map(l => ({ ...l, amount: "" })) }));
          }}
          style={{ ...S.btn("ghost"), fontSize: 10, padding: "3px 10px" }}
        >
          {useIndividualPrices ? "✓ Individual prices" : "Add individual prices"}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              style={{ ...S.input, flex: 1 }}
              placeholder={isQuote ? `e.g. Supply and fit new boiler` : `e.g. Boiler service`}
              value={item.desc}
              onChange={e => updateItem(i, "desc", e.target.value)}
            />
            {useIndividualPrices && (
              <input
                style={{ ...S.input, width: 90, flexShrink: 0 }}
                type="number"
                placeholder="£"
                value={item.amount}
                onChange={e => updateItem(i, "amount", e.target.value)}
              />
            )}
            {items.length > 1 && (
              <button onClick={() => removeItem(i)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 18, padding: "0 4px", flexShrink: 0 }}>×</button>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
        <button onClick={addItem} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px" }}>+ Add line</button>
        {useIndividualPrices && total !== null && (
          <div style={{ fontSize: 12, color: C.muted }}>
            Total: <span style={{ fontWeight: 700, color: C.text }}>£{total.toFixed(2)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Invoice Modal ────────────────────────────────────────────────────────────
function InvoiceModal({ brand, onClose, onSent, initialData, invoices, user }) {
  const [form, setForm] = useState(() => initialData ? {
    customer: initialData.customer || "",
    email: initialData.email || "",
    address: initialData.address || "",
    amount: initialData.amount ? String(initialData.amount) : "",
    labour: initialData.cisLabour ? String(initialData.cisLabour) : "",
    materials: initialData.cisMaterials ? String(initialData.cisMaterials) : "",
    desc: initialData.description || initialData.desc || "",
    due: initialData.due?.replace(/\D/g, "") || brand.paymentTerms || "14",
    paymentMethod: initialData.paymentMethod || brand.defaultPaymentMethod || "both",
    vatEnabled: initialData.vatEnabled || false,
    vatRate: initialData.vatRate || 20,
    vatType: initialData.vatType || "income",
    vatZeroRated: initialData.vatZeroRated || false,
    cisEnabled: initialData.cisEnabled || false,
    cisRate: initialData.cisRate || 20,
    jobRef: initialData?.jobRef || "",
    poNumber: initialData?.poNumber || "",
    lineItems: initialData?.lineItems || [],
    materialItems: initialData?.materialItems || [{ desc: "", amount: "" }],
  } : { customer: "", email: "", address: "", amount: "", labour: "", materials: "", desc: "", due: brand.paymentTerms || "14", paymentMethod: brand.defaultPaymentMethod || "both", vatEnabled: false, vatRate: 20, vatType: "income", vatZeroRated: false, cisEnabled: false, cisRate: 20, jobRef: "", lineItems: [], materialItems: [{ desc: "", amount: "" }] });
  const isEditing = !!initialData;
  const [tab, setTab] = useState("form");
  const [sent, setSent] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const isVatRegistered = !!(brand.vatNumber && (isExemptAccount(user?.email) || brand.registrationVerifications?.vatNumber?.verified));

  // CIS calculations
  const labourAmt = parseFloat(form.labour) || 0;
  const materialsAmt = parseFloat(form.materials) || 0;
  const cisDeduction = form.cisEnabled ? parseFloat(((labourAmt * form.cisRate) / 100).toFixed(2)) : 0;
  const cisGross = form.cisEnabled ? labourAmt + materialsAmt : 0;
  const cisNetPayable = form.cisEnabled ? parseFloat((cisGross - cisDeduction).toFixed(2)) : 0;

  // Compute total from line items if individual prices set
  const lineItemsTotal = form.lineItems && form.lineItems.length > 0 && form.lineItems.some(l => l.amount && l.amount !== "")
    ? form.lineItems.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)
    : null;

  // grossAmount uses lineItemsTotal when available
  const grossAmount = form.cisEnabled ? cisGross : (lineItemsTotal !== null ? lineItemsTotal : (parseFloat(form.amount) || 0));
  const vatRate = form.vatZeroRated ? 0 : (form.vatRate || 20);
  const netAmount = (form.vatEnabled && !form.vatZeroRated) ? parseFloat((grossAmount / (1 + vatRate / 100)).toFixed(2)) : grossAmount;
  const vatAmount = (form.vatEnabled && !form.vatZeroRated) ? parseFloat((grossAmount - netAmount).toFixed(2)) : 0;

  const previewRef = buildRef(brand, { id: "INV-043", customer: form.customer || "Customer Name" });

  // Valid if customer + (email required for new, optional for edits) + some amount source
  const hasAmount = form.cisEnabled ? (form.labour || form.materials) : (lineItemsTotal !== null || !!form.amount);
  const valid = form.customer && (isEditing || form.email) && hasAmount;

  const send = () => {
    try {
      const finalDesc = form.lineItems && form.lineItems.length > 0
        ? form.lineItems.map(l => l.amount && l.amount !== "" ? `${l.desc || l.description}|${l.amount}` : (l.desc || l.description || "")).filter(Boolean).join("\n")
        : form.desc;
      const finalAmount = form.cisEnabled ? cisNetPayable : (lineItemsTotal !== null ? lineItemsTotal : grossAmount);
      const payload = {
        id: initialData?.id || nextInvoiceId(invoices),
        customer: form.customer, email: form.email, address: form.address,
        amount: finalAmount,
        grossAmount: form.cisEnabled ? cisGross : (lineItemsTotal !== null ? lineItemsTotal : grossAmount),
        due: `Due in ${form.due} days`, status: initialData?.status || "sent",
        description: finalDesc, paymentMethod: form.paymentMethod || "bacs",
        lineItems: form.lineItems || [],
        vatEnabled: form.vatEnabled, vatRate: form.vatZeroRated ? 0 : vatRate,
        vatZeroRated: form.vatZeroRated, vatType: form.vatType || "",
        cisEnabled: form.cisEnabled, cisRate: form.cisRate,
        cisLabour: labourAmt, cisMaterials: materialsAmt, cisDeduction, cisNetPayable,
        jobRef: form.jobRef || "", poNumber: form.poNumber || "",
        materialItems: form.materialItems || [],
      };
      if (isEditing) {
        onSent(payload);
      } else {
        setSent(true);
        setTimeout(() => onSent(payload), 1500);
      }
    } catch (e) {
      console.error("Invoice save error:", e);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }}>
      <div style={{ ...S.card, maxWidth: 880, width: "100%", marginBottom: 16 }}>
        {sent ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{isEditing ? "✅" : "✅"}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.green, marginBottom: 8 }}>{isEditing ? "Invoice Updated!" : "Invoice Sent!"}</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
              {isEditing ? "Changes saved successfully." : (form.paymentMethod === "card" || form.paymentMethod === "both") ? `Payment link sent to ${form.email}` : `BACS details sent to ${form.email}`}
            </div>
            {form.vatEnabled && (
              <div style={{ ...S.card, background: C.surfaceHigh, padding: 14, display: "inline-block", textAlign: "left", marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 8 }}>VAT BREAKDOWN</div>
                <div style={{ fontSize: 12, color: C.textDim }}>Net: £{netAmount.toFixed(2)} · VAT @ {form.vatRate}%: £{vatAmount.toFixed(2)} · Gross: £{grossAmount.toFixed(2)}</div>
              </div>
            )}
            <div style={{ ...S.card, background: C.surfaceHigh, textAlign: "left", marginBottom: 16, padding: 14, display: "inline-block" }}>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>PAYMENT REFERENCE</div>
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.06em", color: C.amber }}>{previewRef}</div>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{isEditing ? `Edit Invoice · ${initialData.id}` : "New Invoice"}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <MicButton form={form} setForm={setForm} accentColor={brand.accentColor} />
                <button onClick={() => {
                    const finalDesc = form.lineItems && form.lineItems.length > 0
                      ? form.lineItems.map(l => l.amount && l.amount !== "" ? `${l.desc||l.description}|${l.amount}` : (l.desc||l.description||"")).filter(Boolean).join("\n")
                      : form.desc;
                    downloadInvoicePDF(brand, {
                      id: isEditing ? initialData.id : "INV-043",
                      customer: form.customer || "Customer Name", email: form.email, address: form.address,
                      description: finalDesc, lineItems: form.lineItems || [], materialItems: form.materialItems || [],
                      amount: form.cisEnabled ? cisNetPayable : (lineItemsTotal !== null ? lineItemsTotal : grossAmount),
                      grossAmount: form.cisEnabled ? cisGross : (lineItemsTotal !== null ? lineItemsTotal : grossAmount),
                      due: `Due in ${form.due} days`, paymentMethod: form.paymentMethod,
                      vatEnabled: form.vatEnabled, vatRate: form.vatRate, vatType: form.vatType, vatZeroRated: form.vatZeroRated,
                      cisEnabled: form.cisEnabled, cisRate: form.cisRate,
                      cisLabour: labourAmt, cisMaterials: materialsAmt, cisDeduction, cisNetPayable,
                      jobRef: form.jobRef, poNumber: form.poNumber || "",
                    });
                  }} style={S.pill(brand.accentColor, false)} disabled={!valid}>Preview PDF</button>
                <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22 }}>×</button>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={S.grid2}>
                  {[
                    { k: "customer", l: "Customer Name", p: "e.g. James Oliver" },
                    { k: "email", l: "Customer Email", p: "james@email.com" },
                    { k: "address", l: "Customer Address", p: "5 High Street, Guildford GU1 3AA" },
                  ].map(({ k, l, p }) => (
                    <div key={k}><label style={S.label}>{l}</label>
                      {k === "address" ? <textarea style={{ ...S.input, resize: "none", height: 60 }} placeholder={p} value={form[k]} onChange={set(k)} />
                        : <input style={S.input} placeholder={p} value={form[k]} onChange={set(k)} />}
                    </div>
                  ))}
                  {!form.cisEnabled && lineItemsTotal === null && (
                    <div><label style={S.label}>{form.vatEnabled && !form.vatZeroRated ? `Amount inc. VAT @ ${vatRate}% (£)` : "Amount (£)"}</label>
                      <input style={S.input} placeholder="e.g. 480" value={form.amount} onChange={set("amount")} />
                    </div>
                  )}
                  {!form.cisEnabled && lineItemsTotal !== null && (
                    <div>
                      <label style={S.label}>Total from line items</label>
                      <div style={{ ...S.input, color: C.amber, fontWeight: 700, cursor: "default" }}>£{lineItemsTotal.toFixed(2)}</div>
                    </div>
                  )}
                </div>

                {/* CIS toggle */}
                <div style={{ padding: "14px 16px", background: form.cisEnabled ? "#f59e0b11" : C.surfaceHigh, borderRadius: 8, border: `1px solid ${form.cisEnabled ? "#f59e0b66" : C.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: form.cisEnabled ? 14 : 0 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>CIS — Construction Industry Scheme</div>
                      <div style={{ fontSize: 11, color: C.muted }}>For subcontracting to contractors who deduct CIS tax from labour</div>
                    </div>
                    <button onClick={() => setForm(f => ({ ...f, cisEnabled: !f.cisEnabled }))} style={{ padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontFamily: "'DM Mono',monospace", fontWeight: 700, background: form.cisEnabled ? C.amber : C.border, color: form.cisEnabled ? "#000" : C.muted, transition: "all 0.2s", flexShrink: 0, marginLeft: 12 }}>
                      {form.cisEnabled ? "CIS On ✓" : "Enable CIS"}
                    </button>
                  </div>
                  {form.cisEnabled && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div>
                        <label style={S.label}>Labour (£)</label>
                        <input style={S.input} type="number" placeholder="e.g. 400" value={form.labour} onChange={set("labour")} />
                      </div>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <label style={S.label}>Materials <span style={{ color: C.muted, fontWeight: 400 }}>(no CIS deduction)</span></label>
                          <button onClick={() => setForm(f => ({ ...f, materialItems: [...(f.materialItems || [{ desc: "", amount: "" }]), { desc: "", amount: "" }] }))} style={{ ...S.btn("ghost"), fontSize: 11, padding: "3px 10px" }}>+ Add line</button>
                        </div>
                        {(form.materialItems || [{ desc: "", amount: "" }]).map((item, i) => (
                          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
                            <input style={{ ...S.input, flex: 1 }} placeholder="e.g. Boiler unit" value={item.desc} onChange={e => setForm(f => { const next = [...(f.materialItems || [{ desc: "", amount: "" }])]; next[i] = { ...next[i], desc: e.target.value }; return { ...f, materialItems: next, materials: String(next.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0)) }; })} />
                            <input style={{ ...S.input, width: 90, flexShrink: 0 }} type="number" placeholder="£" value={item.amount} onChange={e => setForm(f => { const next = [...(f.materialItems || [{ desc: "", amount: "" }])]; next[i] = { ...next[i], amount: e.target.value }; return { ...f, materialItems: next, materials: String(next.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0)) }; })} />
                            {(form.materialItems || []).length > 1 && <button onClick={() => setForm(f => { const next = f.materialItems.filter((_, j) => j !== i); return { ...f, materialItems: next, materials: String(next.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0)) }; })} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 18, padding: "0 4px", flexShrink: 0 }}>×</button>}
                          </div>
                        ))}
                      </div>
                      <div>
                        <label style={S.label}>CIS Deduction Rate</label>
                        <div style={{ display: "flex", gap: 8 }}>
                          {[{ v: 20, l: "20% — Registered" }, { v: 30, l: "30% — Unregistered" }].map(({ v, l }) => (
                            <button key={v} onClick={() => setForm(f => ({ ...f, cisRate: v }))} style={{ ...S.pill(C.amber, form.cisRate === v), fontSize: 11 }}>{l}</button>
                          ))}
                        </div>
                      </div>
                      {(labourAmt > 0 || materialsAmt > 0) && (
                        <div style={{ background: C.surface, borderRadius: 8, padding: "12px 14px", border: `1px solid ${C.border}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span style={{ color: C.muted }}>Labour</span><span>£{labourAmt.toFixed(2)}</span></div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span style={{ color: C.muted }}>Materials</span><span>£{materialsAmt.toFixed(2)}</span></div>
                          {form.vatEnabled && !form.vatZeroRated && !form.vatType?.includes("drc") && (
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span style={{ color: C.muted }}>VAT @ {form.vatRate}%</span><span>£{(cisGross * form.vatRate / 100).toFixed(2)}</span></div>
                          )}
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}><span style={{ color: C.muted }}>Gross Total</span><span>£{(cisGross + (form.vatEnabled && !form.vatType?.includes("drc") ? cisGross * form.vatRate / 100 : 0)).toFixed(2)}</span></div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4, color: C.red }}><span>CIS Deduction ({form.cisRate}% of labour)</span><span>-£{cisDeduction.toFixed(2)}</span></div>
                          {form.vatEnabled && form.vatType?.includes("drc") && (
                            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>DRC — contractor accounts for VAT @ {form.vatRate}%</div>
                          )}
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, color: C.green }}><span>Net Payable to You</span><span>£{(cisNetPayable + (form.vatEnabled && !form.vatType?.includes("drc") ? cisGross * form.vatRate / 100 : 0)).toFixed(2)}</span></div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Line items */}
                <LineItemsBuilder form={form} setForm={setForm} accentColor={brand.accentColor} />

                {/* VAT toggle */}
                {isVatRegistered ? (
                  <div style={{ padding: "14px 16px", background: C.surfaceHigh, borderRadius: 8, border: `1px solid ${(form.vatEnabled || form.vatZeroRated) ? C.amber + "66" : C.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: (form.vatEnabled && !form.vatZeroRated && grossAmount > 0) || form.vatZeroRated ? 8 : 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>VAT</div>
                      <select
                        value={form.vatZeroRated ? "zero" : form.vatEnabled ? `${form.vatRate}_${form.vatType || "income"}` : "none"}
                        onChange={e => {
                          const v = e.target.value;
                          if (v === "none") setForm(f => ({ ...f, vatEnabled: false, vatZeroRated: false, vatType: "" }));
                          else if (v === "zero") setForm(f => ({ ...f, vatEnabled: true, vatZeroRated: true, vatRate: 0, vatType: "zero" }));
                          else {
                            const parts = v.split("_");
                            const rate = parseInt(parts[0]);
                            const type = parts.slice(1).join("_"); // handles "income", "expenses", "drc_income", "drc_expenses"
                            setForm(f => ({ ...f, vatEnabled: true, vatZeroRated: false, vatRate: rate, vatType: type }));
                          }
                        }}
                        style={{ ...S.input, width: "auto", minWidth: 260, padding: "6px 10px" }}
                      >
                        <option value="none">No VAT</option>
                        <option value="5_income">5% Income</option>
                        <option value="5_expenses">5% Expenses</option>
                        <option value="20_income">20% Income</option>
                        <option value="20_expenses">20% Expenses</option>
                        <option value="zero">Zero Rate 0% — New Build</option>
                        <option value="5_drc_income">Domestic Reverse Charge @ 5% Income</option>
                        <option value="5_drc_expenses">Domestic Reverse Charge @ 5% Expenses</option>
                        <option value="20_drc_income">Domestic Reverse Charge @ 20% Income</option>
                        <option value="20_drc_expenses">Domestic Reverse Charge @ 20% Expenses</option>
                      </select>
                    </div>
                    {form.vatZeroRated && (
                      <div style={{ fontSize: 11, color: C.green }}>✓ Zero-rated — new residential build. Xero code: ZERORATEDOUTPUT</div>
                    )}
                    {form.vatEnabled && !form.vatZeroRated && grossAmount > 0 && (
                      <div style={{ fontSize: 11, color: C.muted }}>Net: £{netAmount.toFixed(2)} + VAT £{vatAmount.toFixed(2)} = Gross £{grossAmount.toFixed(2)}</div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 11, color: C.muted }}>
                    VAT registered? Add your VAT number in Settings to enable VAT invoices. Zero-rated new build option also available.
                  </div>
                )}

                <div style={S.grid2}>
                  <div>
                    <label style={S.label}>Payment Due</label>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {["0", "7", "14"].map(d => <button key={d} onClick={() => setForm(f => ({ ...f, due: d }))} style={S.pill(brand.accentColor, form.due === d)}>{d} days</button>)}
                      <button onClick={() => setForm(f => ({ ...f, due: "custom" }))} style={S.pill(brand.accentColor, !["0","7","14"].includes(form.due))}>Custom</button>
                    </div>
                    {!["0","7","14"].includes(form.due) && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                        <input
                          style={{ ...S.input, width: 80 }}
                          type="number"
                          min="1"
                          placeholder="e.g. 60"
                          value={form.due === "custom" ? "" : form.due}
                          onChange={e => setForm(f => ({ ...f, due: e.target.value }))}
                        />
                        <span style={{ fontSize: 12, color: C.muted }}>days</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={S.label}>Payment Method</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {[{ v: "bacs", label: "🏦 BACS" }, { v: "card", label: "💳 Card" }, { v: "both", label: "🏦💳 Both" }].map(({ v, label }) => (
                        <button key={v} onClick={() => setForm(f => ({ ...f, paymentMethod: v }))} style={S.pill(brand.accentColor, form.paymentMethod === v)}>{label}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8, border: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>PAYMENT REFERENCE CUSTOMER MUST USE</div>
                    <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.06em", color: brand.accentColor }}>{previewRef}</div>
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, textAlign: "right" }}>
                    Format: {brand.refFormat?.replace(/_/g, " ")}<br />
                    <span style={{ fontSize: 10 }}>Change in Settings</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  {isEditing
                    ? <button style={S.btn("primary", !valid)} disabled={!valid} onClick={send}>Save Changes →</button>
                    : (form.paymentMethod === "card" || form.paymentMethod === "both")
                      ? <button style={S.btn("stripe", !valid)} disabled={!valid} onClick={send}><span style={{ fontWeight: 900 }}>S</span> Send via Stripe →</button>
                      : <button style={S.btn("primary", !valid)} disabled={!valid} onClick={send}>Send Invoice →</button>
                  }
                </div>
              </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Quote Modal ──────────────────────────────────────────────────────────────
function QuoteModal({ brand, onClose, onSent, initialData, invoices, user }) {
  const [form, setForm] = useState(() => initialData ? {
    customer: initialData.customer || "",
    email: initialData.email || "",
    address: initialData.address || "",
    amount: initialData.amount ? String(initialData.amount) : "",
    desc: initialData.description || initialData.desc || "",
    validDays: initialData.due?.replace(/\D/g, "") || "30",
    vatEnabled: initialData.vatEnabled || false,
    vatRate: initialData.vatRate || 20,
    vatType: initialData.vatType || "income",
    jobRef: initialData.jobRef || "",
    lineItems: initialData.lineItems || [],
    cisEnabled: initialData.cisEnabled || false,
    cisRate: initialData.cisRate || 20,
    labour: initialData.cisLabour ? String(initialData.cisLabour) : "",
    materials: initialData.cisMaterials ? String(initialData.cisMaterials) : "",
    materialItems: initialData.materialItems || [{ desc: "", amount: "" }],
  } : { customer: "", email: "", address: "", amount: "", desc: "", validDays: "30", vatEnabled: false, vatRate: 20, vatType: "income", jobRef: "", lineItems: [], cisEnabled: false, cisRate: 20, labour: "", materials: "", materialItems: [{ desc: "", amount: "" }] });
  const isEditing = !!initialData;
  const [tab, setTab] = useState("form");
  const [sent, setSent] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const isVatRegistered = !!(brand.vatNumber && (isExemptAccount(user?.email) || brand.registrationVerifications?.vatNumber?.verified));

  const labourAmt = parseFloat(form.labour) || 0;
  const materialsAmt = parseFloat(form.materials) || 0;
  const cisDeduction = form.cisEnabled ? parseFloat(((labourAmt * form.cisRate) / 100).toFixed(2)) : 0;
  const cisGross = form.cisEnabled ? labourAmt + materialsAmt : 0;
  const cisNetPayable = form.cisEnabled ? parseFloat((cisGross - cisDeduction).toFixed(2)) : 0;

  const lineItemsTotal = form.lineItems && form.lineItems.some(l => l.amount && l.amount !== "")
    ? form.lineItems.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)
    : null;

  const grossAmount = form.cisEnabled ? cisGross : (lineItemsTotal !== null ? lineItemsTotal : (parseFloat(form.amount) || 0));
  const netAmount = form.vatEnabled ? parseFloat((grossAmount / (1 + form.vatRate / 100)).toFixed(2)) : grossAmount;
  const vatAmount = form.vatEnabled ? parseFloat((grossAmount - netAmount).toFixed(2)) : 0;

  const hasAmount = form.cisEnabled ? (form.labour || form.materials) : (lineItemsTotal !== null || !!form.amount);
  const valid = form.customer && hasAmount;

  const send = () => {
    try {
      const id = initialData?.id || nextQuoteId(invoices);
      const finalDesc = form.lineItems && form.lineItems.length > 0
        ? form.lineItems.map(l => l.amount && l.amount !== "" ? `${l.desc || l.description}|${l.amount}` : (l.desc || l.description || "")).filter(Boolean).join("\n")
        : form.desc;
      const finalAmount = form.cisEnabled ? cisNetPayable : (lineItemsTotal !== null ? lineItemsTotal : grossAmount);
      const payload = {
        id, customer: form.customer, email: form.email, address: form.address,
        amount: finalAmount,
        grossAmount: form.cisEnabled ? cisGross : grossAmount,
        due: `Valid for ${form.validDays} days`, status: initialData?.status || "sent",
        description: finalDesc, lineItems: form.lineItems || [], isQuote: true,
        vatEnabled: form.vatEnabled, vatRate: form.vatRate, vatType: form.vatType,
        jobRef: form.jobRef || "", poNumber: form.poNumber || "",
        cisEnabled: form.cisEnabled, cisRate: form.cisRate,
        cisLabour: labourAmt, cisMaterials: materialsAmt, cisDeduction, cisNetPayable,
        materialItems: form.materialItems || [],
      };
      if (isEditing) {
        onSent(payload);
      } else {
        setSent(true);
        setTimeout(() => onSent(payload), 1000);
      }
    } catch (e) {
      console.error("Quote save error:", e);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }}>
      <div style={{ ...S.card, maxWidth: 880, width: "100%", marginBottom: 16 }}>
        {sent ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.blue, marginBottom: 8 }}>{isEditing ? "Quote Updated!" : "Quote Created!"}</div>
            <div style={{ fontSize: 12, color: C.muted }}>{isEditing ? "Changes saved successfully." : `Quote sent to ${form.email || form.customer}. Valid for ${form.validDays} days.`}</div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{isEditing ? `Edit Quote · ${initialData.id}` : "New Quote"}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <MicButton form={form} setForm={setForm} accentColor={C.blue} />
                <div style={{ display: "flex", gap: 4 }}>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => {
                    const finalDesc = form.lineItems && form.lineItems.length > 0
                      ? form.lineItems.map(l => l.amount && l.amount !== "" ? `${l.desc||l.description}|${l.amount}` : (l.desc||l.description||"")).filter(Boolean).join("\n")
                      : form.desc;
                    downloadInvoicePDF(brand, {
                      id: isEditing ? initialData.id : "QTE-001",
                      customer: form.customer || "Customer Name", email: form.email, address: form.address,
                      description: finalDesc, lineItems: form.lineItems || [], materialItems: form.materialItems || [],
                      amount: form.cisEnabled ? cisNetPayable : (lineItemsTotal !== null ? lineItemsTotal : grossAmount),
                      grossAmount: form.cisEnabled ? cisGross : (lineItemsTotal !== null ? lineItemsTotal : grossAmount),
                      due: `Valid for ${form.validDays} days`, isQuote: true,
                      vatEnabled: form.vatEnabled, vatRate: form.vatRate, vatType: form.vatType, vatZeroRated: form.vatZeroRated,
                      cisEnabled: form.cisEnabled, cisRate: form.cisRate,
                      cisLabour: labourAmt, cisMaterials: materialsAmt, cisDeduction, cisNetPayable,
                      jobRef: form.jobRef, poNumber: form.poNumber || "",
                    });
                  }} style={S.pill(C.blue, false)} disabled={!valid}>Preview PDF</button>
                </div>
                </div>
                <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22 }}>×</button>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={S.grid2}>
                  {[
                    { k: "customer", l: "Customer Name", p: "e.g. James Oliver" },
                    { k: "email", l: "Customer Email", p: "james@email.com" },
                    { k: "address", l: "Customer Address", p: "5 High Street, Guildford GU1 3AA" },
                  ].map(({ k, l, p }) => (
                    <div key={k}><label style={S.label}>{l}</label>
                      {k === "address" ? <textarea style={{ ...S.input, resize: "none", height: 60 }} placeholder={p} value={form[k]} onChange={set(k)} />
                        : <input style={S.input} placeholder={p} value={form[k]} onChange={set(k)} />}
                    </div>
                  ))}
                  {!form.cisEnabled && lineItemsTotal === null && (
                    <div><label style={S.label}>{form.vatEnabled ? `Total inc. VAT @ ${form.vatRate}% (£)` : "Quote Amount (£)"}</label>
                      <input style={S.input} placeholder="e.g. 480" value={form.amount} onChange={set("amount")} />
                    </div>
                  )}
                  {!form.cisEnabled && lineItemsTotal !== null && (
                    <div><label style={S.label}>Total from line items</label>
                      <div style={{ ...S.input, color: C.amber, fontWeight: 700, cursor: "default" }}>£{lineItemsTotal.toFixed(2)}</div>
                    </div>
                  )}
                </div>

                {/* CIS toggle */}
                <div style={{ padding: "14px 16px", background: form.cisEnabled ? "#f59e0b11" : C.surfaceHigh, borderRadius: 8, border: `1px solid ${form.cisEnabled ? "#f59e0b66" : C.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: form.cisEnabled ? 14 : 0 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>CIS — Construction Industry Scheme</div>
                      <div style={{ fontSize: 11, color: C.muted }}>For subcontracting to contractors who deduct CIS tax from labour</div>
                    </div>
                    <button onClick={() => setForm(f => ({ ...f, cisEnabled: !f.cisEnabled }))} style={{ padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontFamily: "'DM Mono',monospace", fontWeight: 700, background: form.cisEnabled ? C.amber : C.border, color: form.cisEnabled ? "#000" : C.muted, transition: "all 0.2s", flexShrink: 0, marginLeft: 12 }}>
                      {form.cisEnabled ? "CIS On ✓" : "Enable CIS"}
                    </button>
                  </div>
                  {form.cisEnabled && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div>
                        <label style={S.label}>Labour (£)</label>
                        <input style={S.input} type="number" placeholder="e.g. 400" value={form.labour} onChange={set("labour")} />
                      </div>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <label style={S.label}>Materials <span style={{ color: C.muted, fontWeight: 400 }}>(no CIS deduction)</span></label>
                          <button onClick={() => setForm(f => ({ ...f, materialItems: [...(f.materialItems || [{ desc: "", amount: "" }]), { desc: "", amount: "" }] }))} style={{ ...S.btn("ghost"), fontSize: 11, padding: "3px 10px" }}>+ Add line</button>
                        </div>
                        {(form.materialItems || [{ desc: "", amount: "" }]).map((item, i) => (
                          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
                            <input style={{ ...S.input, flex: 1 }} placeholder="e.g. Boiler unit" value={item.desc} onChange={e => setForm(f => { const next = [...(f.materialItems || [])]; next[i] = { ...next[i], desc: e.target.value }; return { ...f, materialItems: next, materials: String(next.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0)) }; })} />
                            <input style={{ ...S.input, width: 90, flexShrink: 0 }} type="number" placeholder="£" value={item.amount} onChange={e => setForm(f => { const next = [...(f.materialItems || [])]; next[i] = { ...next[i], amount: e.target.value }; return { ...f, materialItems: next, materials: String(next.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0)) }; })} />
                            {(form.materialItems || []).length > 1 && <button onClick={() => setForm(f => { const next = f.materialItems.filter((_, j) => j !== i); return { ...f, materialItems: next, materials: String(next.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0)) }; })} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 18, padding: "0 4px", flexShrink: 0 }}>×</button>}
                          </div>
                        ))}
                      </div>
                      <div>
                        <label style={S.label}>CIS Deduction Rate</label>
                        <div style={{ display: "flex", gap: 8 }}>
                          {[{ v: 20, l: "20% — Registered" }, { v: 30, l: "30% — Unregistered" }].map(({ v, l }) => (
                            <button key={v} onClick={() => setForm(f => ({ ...f, cisRate: v }))} style={{ ...S.pill(C.amber, form.cisRate === v), fontSize: 11 }}>{l}</button>
                          ))}
                        </div>
                      </div>
                      {(labourAmt > 0 || materialsAmt > 0) && (
                        <div style={{ background: C.surface, borderRadius: 8, padding: "12px 14px", border: `1px solid ${C.border}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span style={{ color: C.muted }}>Labour</span><span>£{labourAmt.toFixed(2)}</span></div>
                          {materialsAmt > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span style={{ color: C.muted }}>Materials</span><span>£{materialsAmt.toFixed(2)}</span></div>}
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}><span style={{ color: C.muted }}>Gross Total</span><span>£{cisGross.toFixed(2)}</span></div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4, color: C.red }}><span>CIS Deduction ({form.cisRate}% of labour)</span><span>-£{cisDeduction.toFixed(2)}</span></div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, color: C.green }}><span>Net Payable to You</span><span>£{cisNetPayable.toFixed(2)}</span></div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Line items */}
                <LineItemsBuilder form={form} setForm={setForm} accentColor={brand.accentColor} isQuote />

                <div><label style={S.label}>Job Reference <span style={{ color: C.muted, fontWeight: 400 }}>(optional)</span></label>
                  <input style={S.input} placeholder="e.g. Kitchen refurb Phase 2, Job #1042" value={form.jobRef || ""} onChange={set("jobRef")} />
                </div>

                <div><label style={S.label}>PO Number <span style={{ color: C.muted, fontWeight: 400 }}>(optional — for B2B/contractor work)</span></label>
                  <input style={S.input} placeholder="e.g. PO-12345" value={form.poNumber || ""} onChange={set("poNumber")} />
                </div>

                {/* VAT toggle */}
                {isVatRegistered && (
                  <div style={{ padding: "14px 16px", background: C.surfaceHigh, borderRadius: 8, border: `1px solid ${form.vatEnabled ? C.blue + "66" : C.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: form.vatEnabled && grossAmount > 0 ? 8 : 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>VAT</div>
                      <select
                        value={form.vatEnabled ? `${form.vatRate}_${form.vatType || "income"}` : "none"}
                        onChange={e => {
                          const v = e.target.value;
                          if (v === "none") setForm(f => ({ ...f, vatEnabled: false, vatType: "" }));
                          else {
                            const parts = v.split("_");
                            const rate = parseInt(parts[0]);
                            const type = parts.slice(1).join("_");
                            setForm(f => ({ ...f, vatEnabled: true, vatRate: rate, vatType: type }));
                          }
                        }}
                        style={{ ...S.input, width: "auto", minWidth: 260, padding: "6px 10px" }}
                      >
                        <option value="none">No VAT</option>
                        <option value="5_income">5% Income</option>
                        <option value="5_expenses">5% Expenses</option>
                        <option value="20_income">20% Income</option>
                        <option value="20_expenses">20% Expenses</option>
                        <option value="0_zero">Zero Rate 0% — New Build</option>
                        <option value="5_drc_income">Domestic Reverse Charge @ 5% Income</option>
                        <option value="5_drc_expenses">Domestic Reverse Charge @ 5% Expenses</option>
                        <option value="20_drc_income">Domestic Reverse Charge @ 20% Income</option>
                        <option value="20_drc_expenses">Domestic Reverse Charge @ 20% Expenses</option>
                      </select>
                    </div>
                    {form.vatEnabled && grossAmount > 0 && (
                      <div style={{ fontSize: 11, color: C.muted }}>Net: £{netAmount.toFixed(2)} + VAT £{vatAmount.toFixed(2)} = Total £{grossAmount.toFixed(2)}</div>
                    )}
                  </div>
                )}

                <div>
                  <label style={S.label}>Quote Valid For</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {["0", "7", "14"].map(d => <button key={d} onClick={() => setForm(f => ({ ...f, validDays: d }))} style={S.pill(C.blue, form.validDays === d)}>{d} days</button>)}
                      <button onClick={() => setForm(f => ({ ...f, validDays: "custom" }))} style={S.pill(C.blue, !["0","7","14"].includes(form.validDays))}>Custom</button>
                    </div>
                    {!["0","7","14"].includes(form.validDays) && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                        <input
                          style={{ ...S.input, width: 80 }}
                          type="number"
                          min="1"
                          placeholder="e.g. 90"
                          value={form.validDays === "custom" ? "" : form.validDays}
                          onChange={e => setForm(f => ({ ...f, validDays: e.target.value }))}
                        />
                        <span style={{ fontSize: 12, color: C.muted }}>days</span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button style={{ ...S.btn("primary", !valid), background: valid ? C.blue : undefined }} disabled={!valid} onClick={send}>{isEditing ? "Save Changes →" : "Send Quote →"}</button>
                </div>
              </div>
          </>
        )}
      </div>
    </div>
  );
}
function useReminders(userId) {
  const [reminders, setRemindersRaw] = useState([]);

  // Load from localStorage once userId is known
  useEffect(() => {
    if (!userId) return;
    try {
      const saved = localStorage.getItem(`trade-pa-reminders-${userId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Only restore reminders that haven't fired yet or are completed
        const valid = parsed.filter(r => r.done || r.time > Date.now() - 1000 * 60 * 60);
        setRemindersRaw(valid);
      }
    } catch {}
  }, [userId]);

  const persist = (next) => {
    if (userId) {
      try { localStorage.setItem(`trade-pa-reminders-${userId}`, JSON.stringify(next)); } catch {}
    }
  };

  const add = (reminder) => setRemindersRaw(prev => {
    const next = [reminder, ...prev];
    persist(next);
    return next;
  });
  const dismiss = (id) => setRemindersRaw(prev => {
    const next = prev.map(r => r.id === id ? { ...r, done: true } : r);
    persist(next);
    return next;
  });
  const remove = (id) => setRemindersRaw(prev => {
    const next = prev.filter(r => r.id !== id);
    persist(next);
    return next;
  });

  return { reminders, add, dismiss, remove };
}

function formatCountdown(ms) {
  if (ms <= 0) return "Now";
  const mins = Math.floor(ms / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `in ${days}d ${hrs % 24}h`;
  if (hrs > 0) return `in ${hrs}h ${mins % 60}m`;
  if (mins > 0) return `in ${mins}m`;
  return "in <1m";
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function formatDate(ts) {
  const d = new Date(ts);
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function Reminders({ reminders, onAdd, onDismiss, onRemove, dueNow, onClearDue }) {
  const [input, setInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [notifStatus, setNotifStatus] = useState("unknown");

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if ("Notification" in window) setNotifStatus(Notification.permission);
  }, []);

  const requestNotifPermission = async () => {
    try {
      const result = await Notification.requestPermission();
      setNotifStatus(result);
    } catch {
      setNotifStatus("denied");
    }
  };

  const SYSTEM_PROMPT = `You are a reminder parser. The user is a UK tradesperson. Extract a reminder from their natural language input.

Return ONLY valid JSON, no other text:
{
  "text": "short reminder title (max 60 chars)",
  "minutesFromNow": <integer — minutes from now until reminder should fire>,
  "timeLabel": "human readable time e.g. '3:00 PM today' or 'tomorrow 9 AM'"
}

Rules:
- "in 10 minutes" = 10
- "at 3pm" = minutes until 3pm today (if already past, assume tomorrow)
- "tomorrow morning" = assume 9:00 AM tomorrow
- "tomorrow at 2" = 2:00 PM tomorrow
- "end of day" = 5:00 PM today
- "in an hour" = 60
- If no time given, default to 30 minutes
- Current time is ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;

  const parseReminder = async (text) => {
    if (!text.trim()) return;
    setParsing(true);
    setParseError("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 200,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: text }],
        }),
      });
      const data = await res.json();
      const raw = data.content?.[0]?.text || "{}";
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);

      const fireAt = Date.now() + (parsed.minutesFromNow || 30) * 60000;
      const reminder = {
        id: `r${Date.now()}`,
        text: parsed.text || text,
        time: fireAt,
        timeLabel: parsed.timeLabel || "",
        done: false,
        raw: text,
      };

      onAdd(reminder);
      setInput("");

      // Schedule notification
      const delay = fireAt - Date.now();
      if (delay > 0) {
        setTimeout(() => {
          // Try browser notification
          if ("Notification" in window && Notification.permission === "granted") {
            try {
              new Notification("Trade PA Reminder 🔔", {
                body: reminder.text,
                icon: "/favicon.ico",
              });
            } catch {}
          }
          // Always trigger in-app
          onAdd({ ...reminder, _due: true });
        }, delay);
      }
    } catch (e) {
      setParseError("Couldn't parse that — try again or type more clearly, e.g. 'remind me to call Dave at 3pm'");
    }
    setParsing(false);
  };

  const { recording: recRecording, transcribing: recTranscribing, toggle: recToggle } = useWhisper((text) => {
    if (text) setInput(text);
  });

  const upcoming = reminders.filter(r => !r.done && !r._due).sort((a, b) => a.time - b.time);
  const overdue = reminders.filter(r => !r.done && !r._due && r.time < now);
  const done = reminders.filter(r => r.done);

  const examples = [
    "Remind me to chase James Oliver at 3pm",
    "Call Emma Taylor back in 2 hours",
    "Order copper pipe tomorrow morning",
    "Check boiler parts invoice end of day",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Due now alert */}
      {dueNow.length > 0 && (
        <div style={{ background: C.red + "18", border: `1px solid ${C.red}44`, borderRadius: 10, padding: 16, display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ fontSize: 28 }}>🔔</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.red, marginBottom: 6 }}>Reminder Due</div>
            {dueNow.map((r, i) => (
              <div key={i} style={{ fontSize: 13, color: C.text, marginBottom: 4 }}>— {r.text}</div>
            ))}
          </div>
          <button style={S.btn("ghost")} onClick={onClearDue}>Dismiss all</button>
        </div>
      )}

      {/* Notification permission banner */}
      {notifStatus === "default" && (
        <div style={{ ...S.card, borderColor: C.amber + "44", background: C.amber + "08", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 24 }}>🔔</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Enable push notifications</div>
            <div style={{ fontSize: 12, color: C.muted }}>Get a browser notification when a reminder fires — even if the app isn't open.</div>
          </div>
          <button style={S.btn("primary")} onClick={requestNotifPermission}>Enable →</button>
        </div>
      )}
      {notifStatus === "denied" && (
        <div style={{ ...S.card, borderColor: C.muted + "44", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 20 }}>⚠️</div>
          <div style={{ flex: 1, fontSize: 12, color: C.muted }}>Browser notifications are blocked. Reminders will show in-app only. Allow notifications in your browser settings to get push alerts.</div>
        </div>
      )}
      {notifStatus === "granted" && (
        <div style={{ ...S.card, borderColor: C.green + "44", background: C.green + "08", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 20 }}>✅</div>
          <div style={{ fontSize: 12, color: C.green }}>Push notifications enabled — you'll get alerted even when the app isn't in focus.</div>
        </div>
      )}

      {/* Input */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Set a Reminder</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
          Speak or type naturally — "remind me to call Kevin at 3pm" or "chase Paul Wright invoice in 2 hours"
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {examples.map((ex, i) => (
            <button key={i} onClick={() => setInput(ex)} style={{ padding: "5px 12px", background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 20, color: C.textDim, fontSize: 11, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>{ex}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <input
            style={{ ...S.input, flex: 1 }}
            placeholder="e.g. Remind me to call Kevin Nash at 3pm today..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") parseReminder(input); }}
          />
          <button
            onClick={recToggle}
            disabled={recTranscribing}
            style={{ ...S.btn("ghost"), padding: "10px 14px", fontSize: 14, background: recRecording ? C.red + "33" : C.surfaceHigh, border: `1px solid ${recRecording ? C.red : C.border}`, color: recRecording ? C.red : C.textDim, whiteSpace: "nowrap" }}
          >{recTranscribing ? "⏳" : recRecording ? "⏹ Stop" : "🎙 Record"}</button>
          <button onClick={() => parseReminder(input)} style={{ ...S.btn("primary"), padding: "10px 20px" }} disabled={parsing || !input.trim()}>
            {parsing ? "Parsing..." : "Set →"}
          </button>
        </div>
        {parseError && <div style={{ fontSize: 12, color: C.red, marginTop: 10 }}>{parseError}</div>}
      </div>

      {/* Upcoming reminders */}
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={S.sectionTitle}>Upcoming ({upcoming.length})</div>
        </div>
        {upcoming.length === 0 && <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No upcoming reminders. Set one above.</div>}
        {upcoming.map(r => {
          const ms = r.time - now;
          const isUrgent = ms < 1000 * 60 * 15;
          const isPast = ms <= 0;
          return (
            <div key={r.id} style={{ ...S.row, alignItems: "flex-start" }}>
              <div style={{ width: 4, height: 40, borderRadius: 2, background: isPast ? C.red : isUrgent ? C.amber : C.green, flexShrink: 0, marginTop: 4 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{r.text}</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: C.muted }}>{formatDate(r.time)} at {formatTime(r.time)}</span>
                  <span style={{ ...S.badge(isPast ? C.red : isUrgent ? C.amber : C.blue) }}>
                    {isPast ? "Overdue" : formatCountdown(ms)}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button onClick={() => onDismiss(r.id)} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px" }}>Done ✓</button>
                <button onClick={() => onRemove(r.id)} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px", color: C.muted }}>✕</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Completed */}
      {done.length > 0 && (
        <div style={{ ...S.card, opacity: 0.7 }}>
          <div style={S.sectionTitle}>Completed ({done.length})</div>
          {done.map(r => (
            <div key={r.id} style={{ ...S.row, alignItems: "center" }}>
              <div style={{ fontSize: 13, color: C.muted, textDecoration: "line-through", flex: 1 }}>{r.text}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{formatDate(r.time)} {formatTime(r.time)}</div>
              <button onClick={() => onRemove(r.id)} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px", marginLeft: 10, color: C.muted }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Sandbox note */}
      <div style={{ ...S.card, background: C.surfaceHigh, borderStyle: "dashed" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ fontSize: 20 }}>ℹ️</div>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
            <strong style={{ color: C.textDim }}>Voice notes:</strong> Hold the 🎙 button, speak, then release. Works on iPhone, Android, and all browsers. Transcription takes about 2 seconds via Whisper AI. Try it now — type "remind me in 1 minute" to test the reminder system.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
// ─── Customers ────────────────────────────────────────────────────────────────
function Customers({ customers, setCustomers, jobs, invoices, setView, user, makeCall, hasTwilio }) {
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", notes: "" });
  const [callLogs, setCallLogs] = useState([]);
  const [customerTab, setCustomerTab] = useState("overview"); // overview | calls
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  // Load call logs when customer selected
  useEffect(() => {
    if (!selected || !user?.id) return;
    setCustomerTab("overview");
    supabase.from("call_logs")
      .select("*")
      .eq("user_id", user.id)
      .ilike("customer_name", selected.name)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setCallLogs(data || []));
  }, [selected, user?.id]);

  const save = () => {
    if (!form.name) return;
    if (editing) {
      setCustomers(prev => prev.map(c => c.id === selected.id ? { ...c, ...form } : c));
      setSelected({ ...selected, ...form });
      setEditing(false);
    } else {
      const c = { ...form, id: Date.now() };
      setCustomers(prev => [...prev, c]);
      setShowAdd(false);
      setForm({ name: "", phone: "", email: "", address: "", notes: "" });
    }
  };

  const del = (id) => { setCustomers(prev => prev.filter(c => c.id !== id)); setSelected(null); };

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || "").includes(search)
  );

  const jobsForCustomer = (name) => jobs.filter(j => j.customer?.toLowerCase() === name?.toLowerCase());
  const invoicesForCustomer = (name) => invoices.filter(i => i.customer?.toLowerCase() === name?.toLowerCase());

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Customers</div>
        <button style={S.btn("primary")} onClick={() => { setForm({ name: "", phone: "", email: "", address: "", notes: "" }); setShowAdd(true); }}>+ Add Customer</button>
      </div>

      {/* Search */}
      <input
        style={S.input}
        placeholder="Search by name, email or phone..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Customer list */}
      <div style={S.card}>
        <div style={S.sectionTitle}>All Customers ({customers.length})</div>
        {customers.length === 0
          ? <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No customers yet. Add one above or they'll be added automatically when you book jobs via the AI Assistant.</div>
          : filtered.length === 0
          ? <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No customers match your search.</div>
          : filtered.map(c => {
            const cJobs = jobsForCustomer(c.name);
            const cInvoices = invoicesForCustomer(c.name);
            const totalSpend = cInvoices.reduce((s, i) => s + (i.amount || 0), 0);
            return (
              <div key={c.id} onClick={() => setSelected(c)} style={{ ...S.row, cursor: "pointer" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.amber + "22", border: `1px solid ${C.amber}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: C.amber, flexShrink: 0 }}>
                  {c.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>
                    {[c.phone, c.email].filter(Boolean).join(" · ") || "No contact details"}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: C.muted, textAlign: "right", flexShrink: 0 }}>
                  {cJobs.length > 0 && <div>{cJobs.length} job{cJobs.length !== 1 ? "s" : ""}</div>}
                  {totalSpend > 0 && <div style={{ color: C.amber }}>£{totalSpend.toLocaleString()}</div>}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginLeft: 10 }}>→</div>
              </div>
            );
          })
        }
      </div>

      {/* Customer Detail Modal */}
      {selected && !editing && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }} onClick={() => setSelected(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.card, maxWidth: 500, width: "100%", marginBottom: 16 }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: C.amber + "22", border: `1px solid ${C.amber}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: C.amber, flexShrink: 0 }}>
                  {selected.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>{selected.name}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{selected.address || "No address"}</div>
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22 }}>×</button>
            </div>

            {/* Tab switcher */}
            <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
              {["overview", "calls"].map(t => (
                <button key={t} onClick={() => setCustomerTab(t)} style={{ ...S.btn(customerTab === t ? "primary" : "ghost"), fontSize: 11, padding: "4px 12px", textTransform: "capitalize" }}>{t === "calls" ? `📞 Calls${callLogs.length > 0 ? ` (${callLogs.length})` : ""}` : "Overview"}</button>
              ))}
            </div>

            {customerTab === "calls" && (
              <div>
                {callLogs.length === 0 ? (
                  <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>
                    No recorded calls yet.<br/>
                    <span style={{ fontSize: 11 }}>Calls are recorded when this customer rings through your Trade PA number.</span>
                  </div>
                ) : callLogs.map(log => (
                  <div key={log.id} style={{ background: C.surfaceHigh, borderRadius: 10, padding: 14, marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 16 }}>{log.direction === "outbound" ? "📲" : "📞"}</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{new Date(log.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>{log.direction === "outbound" ? "Outbound · " : "Inbound · "}{Math.floor((log.duration_seconds || 0) / 60)}m {(log.duration_seconds || 0) % 60}s</div>
                        </div>
                      </div>
                      <span style={S.badge(
                        log.category === "existing_job" ? C.green :
                        log.category === "new_enquiry" ? C.blue :
                        log.category === "invoice_payment" ? C.amber : C.muted
                      )}>{log.category?.replace(/_/g, " ")}</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6, marginBottom: 6 }}>{log.summary}</div>
                    {log.key_details && <div style={{ fontSize: 11, color: C.amber, fontStyle: "italic" }}>📌 {log.key_details}</div>}
                    {log.action_needed && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Action: {log.action_needed}</div>}
                    {log.recording_url && (
                      <audio controls style={{ width: "100%", marginTop: 8, height: 32 }}
                        src={`/api/calls/audio?url=${encodeURIComponent(log.recording_url)}`}>
                        Your browser does not support audio playback.
                      </audio>
                    )}
                  </div>
                ))}
              </div>
            )}

            {customerTab === "overview" && (<>
            {/* Contact details */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>Phone</div>
                {selected.phone
                  ? hasTwilio
                    ? <div onClick={() => makeCall(selected.phone, selected.name)} style={{ fontSize: 13, color: C.green, fontFamily: "'DM Mono',monospace", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>📞 {selected.phone} <span style={{ fontSize: 10, color: C.muted }}>(tap to call)</span></div>
                    : <a href={`tel:${selected.phone.replace(/\s/g, "")}`} style={{ fontSize: 13, color: C.amber, textDecoration: "none", fontFamily: "'DM Mono',monospace" }}>📞 {selected.phone}</a>
                  : <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>Not set</div>}
              </div>
              <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>Email</div>
                {selected.email
                  ? <a href={`mailto:${selected.email}`} style={{ fontSize: 12, color: C.blue, textDecoration: "none", wordBreak: "break-all" }}>✉ {selected.email}</a>
                  : <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>Not set</div>}
              </div>
            </div>

            {/* Notes */}
            {selected.notes && (
              <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8, marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>Notes</div>
                <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{selected.notes}</div>
              </div>
            )}

            {/* Job history */}
            {jobsForCustomer(selected.name).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>Job History</div>
                {jobsForCustomer(selected.name).map(j => (
                  <div key={j.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                    <span style={{ color: C.text }}>{j.type}</span>
                    <span style={{ color: C.muted }}>{j.dateObj ? new Date(j.dateObj).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : j.date}</span>
                    {j.value > 0 && <span style={{ color: C.amber }}>£{j.value}</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Invoice history */}
            {invoicesForCustomer(selected.name).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>Invoice History</div>
                {invoicesForCustomer(selected.name).map(i => (
                  <div key={i.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                    <span style={{ color: C.muted }}>{i.id}</span>
                    <span style={{ color: C.text }}>£{i.amount}</span>
                    <span style={S.badge(statusColor[i.status] || C.muted)}>{statusLabel[i.status] || i.status}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            {customerTab === "overview" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button style={S.btn("primary")} onClick={() => { setEditing(true); setForm({ name: selected.name, phone: selected.phone || "", email: selected.email || "", address: selected.address || "", notes: selected.notes || "" }); }}>Edit</button>
              {selected.phone && <a href={`tel:${selected.phone.replace(/\s/g, "")}`} style={{ ...S.btn("ghost"), textDecoration: "none" }}>📞 Call</a>}
              {selected.email && <a href={`mailto:${selected.email}`} style={{ ...S.btn("ghost"), textDecoration: "none" }}>✉ Email</a>}
              <button style={{ ...S.btn("ghost"), color: C.red, marginLeft: "auto" }} onClick={() => del(selected.id)}>Delete</button>
            </div>
            )}
            </>)}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {selected && editing && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 310, padding: 16 }}>
          <div style={{ ...S.card, maxWidth: 440, width: "100%", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Edit Customer</div>
              <button onClick={() => setEditing(false)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22 }}>×</button>
            </div>
            <CustomerForm form={form} set={set} onSave={save} onCancel={() => setEditing(false)} />
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }}>
          <div style={{ ...S.card, maxWidth: 440, width: "100%", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Add Customer</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <VoiceFillButton form={form} setForm={f => Object.keys(f).forEach(k => set(k)({ target: { value: f[k] } }))} fieldDescriptions="name (full name), phone (phone number), email (email address), address (full address), notes (any extra details)" />
                <button onClick={() => setShowAdd(false)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22 }}>×</button>
              </div>
            </div>
            <CustomerForm form={form} set={set} onSave={save} onCancel={() => setShowAdd(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerForm({ form, set, onSave, onCancel }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {[
        { k: "name", l: "Full Name", p: "e.g. John Smith", required: true },
        { k: "phone", l: "Phone Number", p: "e.g. 07700 900123" },
        { k: "email", l: "Email Address", p: "e.g. john@email.com" },
        { k: "address", l: "Address", p: "e.g. 5 High Street, Guildford, GU1 3AA" },
      ].map(({ k, l, p, required }) => (
        <div key={k}>
          <label style={S.label}>{l}{required && <span style={{ color: C.red }}> *</span>}</label>
          <input style={S.input} placeholder={p} value={form[k]} onChange={set(k)} />
        </div>
      ))}
      <div>
        <label style={S.label}>Notes</label>
        <textarea style={{ ...S.input, resize: "vertical", minHeight: 72 }} placeholder="e.g. Prefers morning appointments, gate code 1234..." value={form.notes} onChange={set("notes")} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={S.btn("primary", !form.name)} disabled={!form.name} onClick={onSave}>Save →</button>
        <button style={S.btn("ghost")} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Invoices View ────────────────────────────────────────────────────────────
// ─── Send Invoice/Quote by Email ─────────────────────────────────────────────
async function sendDocumentEmail(doc, brand, customers, userId, setSending) {
  if (!userId) { alert("Please log in first."); return false; }

  // Check email connection
  const connRes = await fetch(
    `${window._supabaseUrl || ""}/rest/v1/email_connections?user_id=eq.${userId}&select=provider,email`,
    {
      headers: {
        "apikey": window._supabaseAnonKey || "",
        "Authorization": `Bearer ${window._supabaseToken || ""}`,
      },
    }
  ).catch(() => null);

  // Use supabase client directly instead
  const { data: conns } = await window._supabase
    .from("email_connections")
    .select("provider, email")
    .eq("user_id", userId);

  if (!conns?.length) {
    alert("No email account connected. Go to the Inbox tab to connect Gmail or Outlook first.");
    return false;
  }

  const provider = conns[0].provider;

  // Look up customer email
  const customerRecord = (customers || []).find(c =>
    c.name?.toLowerCase() === doc.customer?.toLowerCase()
  );
  let toEmail = customerRecord?.email || doc.customerEmail || "";

  if (!toEmail) {
    toEmail = prompt(`Enter email address for ${doc.customer}:`);
    if (!toEmail) return false;
  }

  const isQuote = doc.isQuote;
  const docType = isQuote ? "Quote" : "Invoice";
  const subject = `${docType} ${doc.id} from ${brand.tradingName} — £${doc.amount}`;
  const body = `<p>Dear ${doc.customer},</p>
<p>Please find your ${docType.toLowerCase()} ${doc.id} for £${doc.amount} attached below.</p>
${!isQuote && brand.bankName ? `<p><strong>Payment details:</strong><br>
Bank: ${brand.bankName}<br>
Sort code: ${brand.sortCode}<br>
Account number: ${brand.accountNumber}<br>
Reference: ${doc.id}</p>` : ""}
${isQuote ? `<p>This quote is valid for 30 days. Please get in touch to proceed or if you have any questions.</p>` : `<p>Payment is due within ${brand.paymentTerms || 30} days.</p>`}
<p>Many thanks,<br>${brand.tradingName}${brand.phone ? `<br>${brand.phone}` : ""}${brand.email ? `<br>${brand.email}` : ""}</p>`;

  if (setSending) setSending(doc.id);
  try {
    const endpoint = provider === "outlook" ? "/api/outlook/send" : "/api/gmail/send";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, to: toEmail, subject, body }),
    });
    const result = await res.json();
    if (result.error) throw new Error(result.error);
    alert(`✓ ${docType} sent to ${toEmail}`);
    return true;
  } catch (err) {
    alert(`Failed to send: ${err.message}`);
    return false;
  } finally {
    if (setSending) setSending(null);
  }
}

function InvoicesView({ brand, invoices, setInvoices, user, customers }) {
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [sendingId, setSendingId] = useState(null);

  const allInvoices = (invoices || []).filter(i => !i.isQuote);
  const paid = allInvoices.filter(i => i.status === "paid");
  const outstanding = allInvoices.filter(i => i.status !== "paid");
  const overdue = allInvoices.filter(i => i.status === "overdue");

  const updateStatus = (id, status) => {
    const inv = (invoices || []).find(i => i.id === id);
    setInvoices(prev => (prev || []).map(i => i.id === id ? { ...i, status, due: status === "paid" ? "Paid" : i.due } : i));
    if (selected && selected.id === id) setSelected(s => ({ ...s, status, due: status === "paid" ? "Paid" : s.due }));
    // Sync paid status to accounting software
    if (status === "paid" && inv && user?.id) {
      syncInvoiceToAccounting(user.id, { ...inv, status: "paid" });
    }
  };

  const deleteInvoice = (id) => {
    setInvoices(prev => (prev || []).filter(i => i.id !== id));
    setSelected(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Invoices</div>
        <button style={S.btn("primary")} onClick={() => setShowModal(true)}>+ New Invoice</button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 10 }}>
        <div style={S.card}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Outstanding</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: outstanding.length > 0 ? C.amber : C.muted }}>{outstanding.length}</div>
          <div style={{ fontSize: 11, color: C.muted }}>£{outstanding.reduce((s, i) => s + (i.amount || 0), 0).toLocaleString()}</div>
        </div>
        <div style={S.card}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Overdue</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: overdue.length > 0 ? C.red : C.muted }}>{overdue.length}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{overdue.length > 0 ? "Needs chasing" : "All on time"}</div>
        </div>
        <div style={S.card}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Paid</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: C.green }}>{paid.length}</div>
          <div style={{ fontSize: 11, color: C.muted }}>£{paid.reduce((s, i) => s + (i.amount || 0), 0).toLocaleString()}</div>
        </div>
        <div style={S.card}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Total</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: C.text }}>{allInvoices.length}</div>
          <div style={{ fontSize: 11, color: C.muted }}>£{allInvoices.reduce((s, i) => s + (i.amount || 0), 0).toLocaleString()}</div>
        </div>
      </div>

      {/* Outstanding list */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Outstanding ({outstanding.length})</div>
        {outstanding.length === 0
          ? <div style={{ fontSize: 12, color: C.green, fontStyle: "italic" }}>All invoices paid — great work!</div>
          : outstanding.map(inv => (
            <div key={inv.id} onClick={() => setSelected(inv)} style={{ ...S.row, cursor: "pointer" }}>
              <div style={{ width: 4, height: 44, borderRadius: 2, background: inv.status === "overdue" ? C.red : C.amber, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{inv.customer}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{inv.address || inv.id} · {inv.due}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: inv.status === "overdue" ? C.red : C.text, marginRight: 8, flexShrink: 0 }}>£{inv.amount}</div>
              <div style={{ ...S.badge(statusColor[inv.status] || C.muted), marginRight: 8, flexShrink: 0 }}>{statusLabel[inv.status] || inv.status}</div>
              <button onClick={e => { e.stopPropagation(); sendDocumentEmail(inv, brand, customers, user?.id, setSendingId); }} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 8px", color: C.blue, flexShrink: 0 }} disabled={sendingId === inv.id}>{sendingId === inv.id ? "..." : "✉"}</button>
              <button onClick={e => { e.stopPropagation(); updateStatus(inv.id, "paid"); }} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px", color: C.green, flexShrink: 0 }}>✓ Paid</button>
              <div style={{ fontSize: 11, color: C.muted, marginLeft: 4 }}>→</div>
            </div>
          ))
        }
      </div>

      {/* Paid list */}
      {paid.length > 0 && (
        <div style={S.card}>
          <div style={S.sectionTitle}>Paid ({paid.length})</div>
          {paid.map(inv => (
            <div key={inv.id} onClick={() => setSelected(inv)} style={{ ...S.row, cursor: "pointer" }}>
              <div style={{ width: 4, height: 44, borderRadius: 2, background: C.green, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{inv.customer}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{inv.address || inv.id}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.green, marginRight: 8, flexShrink: 0 }}>£{inv.amount}</div>
              <div style={S.badge(C.green)}>Paid</div>
              <div style={{ fontSize: 11, color: C.muted, marginLeft: 8 }}>→</div>
            </div>
          ))}
        </div>
      )}

      {allInvoices.length === 0 && (
        <div style={{ ...S.card, textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>💰</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>No invoices yet</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>Create your first invoice or ask the AI Assistant.</div>
          <button style={S.btn("primary")} onClick={() => setShowModal(true)}>+ Create Invoice</button>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }} onClick={() => setSelected(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.card, maxWidth: 480, width: "100%", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Invoice · {selected.id}</div>
                <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{selected.customer}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: selected.status === "paid" ? C.green : C.amber }}>£{selected.amount}</div>
                  <span style={S.badge(statusColor[selected.status] || C.muted)}>{statusLabel[selected.status] || selected.status}</span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 24 }}>×</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              {selected.address && (
                <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Address</div>
                  <div style={{ fontSize: 13 }}>{selected.address}</div>
                </div>
              )}
              {selected.cisEnabled ? (
                <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>CIS Breakdown</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: C.muted }}>Labour</span><span>£{Number(selected.cisLabour || 0).toFixed(2)}</span></div>
                    {(selected.materialItems || []).filter(m => m.desc || m.description).map((m, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: C.muted }}>{m.desc || m.description}</span><span>£{Number(parseFloat(m.amount) || 0).toFixed(2)}</span></div>
                    ))}
                    {!(selected.materialItems || []).filter(m => m.desc || m.description).length && Number(selected.cisMaterials) > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: C.muted }}>Materials</span><span>£{Number(selected.cisMaterials || 0).toFixed(2)}</span></div>
                    )}
                    {selected.vatEnabled && !((selected.vatType || "").includes("drc")) && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: C.muted }}>{vatLabel(selected)}</span><span>£{((Number(selected.cisLabour) + Number(selected.cisMaterials)) * (Number(selected.vatRate) || 20) / 100).toFixed(2)}</span></div>
                    )}
                    {selected.vatEnabled && (selected.vatType || "").includes("drc") && (
                      <div style={{ fontSize: 11, color: C.muted, fontStyle: "italic" }}>{vatLabel(selected)} — contractor accounts for VAT</div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", color: C.red, paddingTop: 4, borderTop: `1px solid ${C.border}`, marginTop: 4 }}><span>CIS Deduction ({Number(selected.cisRate) || 20}% labour)</span><span>-£{Number(selected.cisDeduction || 0).toFixed(2)}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 13 }}><span>Net Payable</span><span>£{Number(selected.cisNetPayable || selected.amount || 0).toFixed(2)}</span></div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Line Items</div>
                  <LineItemsDisplay inv={selected} />
                </div>
              )}
              {selected.vatEnabled && !selected.cisEnabled && (
                <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>VAT</div>
                  <div style={{ fontSize: 13 }}>{vatLabel(selected)}</div>
                </div>
              )}
              <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Payment Due</div>
                <div style={{ fontSize: 13 }}>{selected.due}</div>
              </div>
              {selected.jobRef && (
                <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Job Reference</div>
                  <div style={{ fontSize: 13 }}>{selected.jobRef}</div>
                </div>
              )}
            </div>

            {selected.status !== "paid"
              ? <button style={{ ...S.btn("primary"), width: "100%", justifyContent: "center", padding: "14px", fontSize: 15, background: C.green, color: "#000", marginBottom: 10 }} onClick={() => updateStatus(selected.id, "paid")}>✓ Mark as Paid</button>
              : <div style={{ background: C.green + "18", border: `1px solid ${C.green}44`, borderRadius: 8, padding: "12px 16px", textAlign: "center", color: C.green, fontWeight: 700, marginBottom: 10 }}>✓ Invoice Paid</div>
            }

            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center" }} onClick={() => downloadInvoicePDF(brand, selected)}>⬇ PDF</button>
              <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", color: C.blue }} onClick={() => sendDocumentEmail(selected, brand, customers, user?.id, setSendingId)} disabled={sendingId === selected?.id}>{sendingId === selected?.id ? "Sending..." : "✉ Send"}</button>
              <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center" }} onClick={() => setEditingInvoice(selected)}>✏ Edit</button>
              {selected.status === "overdue" && <button style={S.btn("danger")} onClick={() => updateStatus(selected.id, "sent")}>📨 Chase</button>}
              <button style={{ ...S.btn("ghost"), color: C.red }} onClick={() => deleteInvoice(selected.id)}>Delete</button>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", color: "#13B5EA", borderColor: "#13B5EA44", fontSize: 11 }}
                onClick={() => {
                  fetch("/api/xero/create-invoice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user?.id, invoice: selected }) })
                    .then(r => r.json()).then(d => alert(d.error ? `Xero: ${d.error}` : "✓ Invoice sent to Xero")).catch(() => alert("Xero not connected — check Settings"));
                }}>Xero Invoice</button>
              <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", color: "#2CA01C", borderColor: "#2CA01C44", fontSize: 11 }}
                onClick={() => {
                  fetch("/api/quickbooks/create-invoice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user?.id, invoice: selected }) })
                    .then(r => r.json()).then(d => alert(d.error ? `QuickBooks: ${d.error}` : "✓ Invoice sent to QuickBooks")).catch(() => alert("QuickBooks not connected — check Settings"));
                }}>QB Invoice</button>
            </div>
          </div>
        </div>
      )}

      {showModal && <InvoiceModal brand={brand} invoices={invoices} user={user} onClose={() => setShowModal(false)} onSent={inv => { setInvoices(prev => [inv, ...(prev || [])]); setShowModal(false); syncInvoiceToAccounting(user?.id, inv); }} />}
      {editingInvoice && <InvoiceModal brand={brand} invoices={invoices} user={user} initialData={editingInvoice} onClose={() => setEditingInvoice(null)} onSent={updated => { setInvoices(prev => (prev || []).map(i => i.id === editingInvoice.id ? { ...i, ...updated } : i)); setSelected(updated); setEditingInvoice(null); }} />}
    </div>
  );
}

// ─── Quotes View ──────────────────────────────────────────────────────────────
function QuotesView({ brand, invoices, setInvoices, setView, customers, user }) {
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingQuote, setEditingQuote] = useState(null);
  const [sendingId, setSendingId] = useState(null);

  const allQuotes = (invoices || []).filter(i => i.isQuote);
  const pending = allQuotes.filter(q => q.status !== "accepted" && q.status !== "declined");
  const accepted = allQuotes.filter(q => q.status === "accepted");
  const declined = allQuotes.filter(q => q.status === "declined");

  const updateStatus = (id, status) => {
    setInvoices(prev => (prev || []).map(i => i.id === id ? { ...i, status } : i));
    if (selected && selected.id === id) setSelected(s => ({ ...s, status }));
  };

  const convertToInvoice = async (quote) => {
    const newId = nextInvoiceId(invoices);
    const inv = { ...quote, isQuote: false, id: newId, status: "sent", due: `Due in ${brand.paymentTerms || 30} days` };
    setInvoices(prev => [inv, ...(prev || []).filter(i => i.id !== quote.id)]);
    setSelected(null);
    // Build scope of work from quote line items or description
    const scopeOfWork = (quote.lineItems && quote.lineItems.length > 0)
      ? quote.lineItems.map(l => l.description || l.desc || "").filter(Boolean).join("\n")
      : (quote.description || quote.desc || "");
    // Create a job card in Supabase
    if (user?.id) {
      supabase.from("job_cards").insert({
        user_id: user.id,
        title: `${quote.id} — ${quote.customer}`,
        customer: quote.customer,
        address: quote.address || "",
        type: quote.type || "",
        status: "accepted",
        value: quote.amount || 0,
        quote_id: quote.id,
        invoice_id: newId,
        scope_of_work: scopeOfWork,
        notes: `Converted from quote ${quote.id} on ${new Date().toLocaleDateString("en-GB")}`,
      }).then(({ error }) => { if (error) console.error("Job card creation failed:", error.message); });
    }
    setView("Jobs");
  };

  const deleteQuote = (id) => {
    setInvoices(prev => (prev || []).filter(i => i.id !== id));
    setSelected(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Quotes</div>
        <button style={{ ...S.btn("primary"), background: C.blue }} onClick={() => setShowModal(true)}>+ New Quote</button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 10 }}>
        <div style={S.card}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Pending</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: C.blue }}>{pending.length}</div>
          <div style={{ fontSize: 11, color: C.muted }}>£{pending.reduce((s, q) => s + (q.amount || 0), 0).toLocaleString()}</div>
        </div>
        <div style={S.card}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Accepted</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: C.green }}>{accepted.length}</div>
          <div style={{ fontSize: 11, color: C.muted }}>£{accepted.reduce((s, q) => s + (q.amount || 0), 0).toLocaleString()}</div>
        </div>
        <div style={S.card}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Declined</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: declined.length > 0 ? C.red : C.muted }}>{declined.length}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{declined.length > 0 ? "Not won" : "None lost"}</div>
        </div>
        <div style={S.card}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Pipeline</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: C.text }}>{allQuotes.length}</div>
          <div style={{ fontSize: 11, color: C.muted }}>£{allQuotes.reduce((s, q) => s + (q.amount || 0), 0).toLocaleString()}</div>
        </div>
      </div>

      {/* All quotes */}
      <div style={S.card}>
        <div style={S.sectionTitle}>All Quotes ({allQuotes.length})</div>
        {allQuotes.length === 0
          ? <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic", padding: "8px 0" }}>No quotes yet — tap + New Quote or ask the AI Assistant.</div>
          : allQuotes.map(q => (
            <div key={q.id} onClick={() => setSelected(q)} style={{ ...S.row, cursor: "pointer" }}>
              <div style={{ width: 4, height: 44, borderRadius: 2, background: q.status === "accepted" ? C.green : q.status === "declined" ? C.red : C.blue, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{q.customer}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{q.address || q.id} · {q.due}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, marginRight: 8, flexShrink: 0 }}>£{q.amount}</div>
              <div style={{ ...S.badge(q.status === "accepted" ? C.green : q.status === "declined" ? C.red : C.blue), marginRight: 8, flexShrink: 0 }}>
                {q.status === "accepted" ? "Accepted" : q.status === "declined" ? "Declined" : "Sent"}
              </div>
              <button onClick={e => { e.stopPropagation(); sendDocumentEmail(q, brand, customers, user?.id, setSendingId); }} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 8px", color: C.blue, flexShrink: 0 }} disabled={sendingId === q.id}>{sendingId === q.id ? "..." : "✉"}</button>
              <button onClick={e => { e.stopPropagation(); convertToInvoice(q); }} style={{ ...S.btn("primary"), fontSize: 11, padding: "4px 10px", flexShrink: 0 }}>→ Invoice</button>
              <div style={{ fontSize: 11, color: C.muted, marginLeft: 4 }}>→</div>
            </div>
          ))
        }
      </div>

      {/* Detail modal */}
      {selected && !editingQuote && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }} onClick={() => setSelected(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.card, maxWidth: 480, width: "100%", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: C.blue, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Quote · {selected.id}</div>
                <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{selected.customer}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: selected.status === "accepted" ? C.green : C.blue }}>£{selected.amount}</div>
                  <span style={S.badge(selected.status === "accepted" ? C.green : selected.status === "declined" ? C.red : C.blue)}>
                    {selected.status === "accepted" ? "Accepted" : selected.status === "declined" ? "Declined" : "Sent"}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 24 }}>×</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Line Items</div>
                <LineItemsDisplay inv={selected} />
              </div>
              <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Valid For</div>
                <div style={{ fontSize: 13 }}>{selected.due}</div>
              </div>
              {selected.jobRef && (
                <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Job Reference</div>
                  <div style={{ fontSize: 13 }}>{selected.jobRef}</div>
                </div>
              )}
            </div>

            <button style={{ ...S.btn("primary"), width: "100%", justifyContent: "center", padding: "14px", fontSize: 15, marginBottom: 10 }}
              onClick={() => convertToInvoice(selected)}>→ Convert to Invoice</button>

            {selected.status !== "accepted" && selected.status !== "declined" && (
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", color: C.green }} onClick={() => updateStatus(selected.id, "accepted")}>✓ Mark Accepted</button>
                <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", color: C.red }} onClick={() => updateStatus(selected.id, "declined")}>✗ Mark Declined</button>
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center" }} onClick={() => setEditingQuote(selected)}>✏️ Edit</button>
              <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center" }} onClick={() => downloadInvoicePDF(brand, selected)}>⬇ PDF</button>
              <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", color: C.blue }} onClick={() => sendDocumentEmail(selected, brand, customers, user?.id, setSendingId)} disabled={sendingId === selected?.id}>{sendingId === selected?.id ? "Sending..." : "✉ Send"}</button>
              <button style={{ ...S.btn("ghost"), color: C.red }} onClick={() => deleteQuote(selected.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {showModal && <QuoteModal brand={brand} invoices={invoices} user={user} onClose={() => setShowModal(false)} onSent={q => { setInvoices(prev => [q, ...(prev || [])]); setShowModal(false); }} />}
      {editingQuote && <QuoteModal brand={brand} invoices={invoices} user={user} initialData={editingQuote} onClose={() => setEditingQuote(null)} onSent={updated => { setInvoices(prev => (prev || []).map(i => i.id === editingQuote.id ? { ...i, ...updated } : i)); setSelected(updated); setEditingQuote(null); }} />}
    </div>
  );
}

// ─── Line Items Display ───────────────────────────────────────────────────────
function LineItemsDisplay({ inv }) {
  if (!inv) return null;

  // Normalise items — handle both {desc, amount} from builder and {description, amount} from legacy
  const rawItems = inv.lineItems && inv.lineItems.length > 0
    ? inv.lineItems.map(l => ({
        description: l.description || l.desc || "",
        amount: l.amount !== "" && l.amount != null && !isNaN(parseFloat(l.amount)) ? parseFloat(l.amount) : null,
      })).filter(l => l.description)
    : (inv.description || inv.desc || "").split(/\n|;\s*/).map(s => {
        const pipeIdx = s.lastIndexOf("|");
        if (pipeIdx > 0) return { description: s.slice(0, pipeIdx).trim(), amount: parseFloat(s.slice(pipeIdx + 1)) || null };
        return { description: s.trim(), amount: null };
      }).filter(i => i.description);

  const items = rawItems;
  if (items.length === 0) return <div style={{ fontSize: 13, color: "#888" }}>—</div>;

  if (items.length === 1) {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
        <span>{items[0].description}</span>
        {items[0].amount != null && <span style={{ fontWeight: 600 }}>£{Number(items[0].amount).toFixed(2)}</span>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingBottom: 6, borderBottom: i < items.length - 1 ? `1px solid rgba(255,255,255,0.06)` : "none" }}>
          <span>{item.description}</span>
          {item.amount != null && <span style={{ fontWeight: 600, flexShrink: 0, marginLeft: 12 }}>£{Number(item.amount).toFixed(2)}</span>}
        </div>
      ))}
    </div>
  );
}

// ─── InboxView (AI Email Agent) ───────────────────────────────────────────────
function InboxView({ user, brand, jobs, setJobs, invoices, setInvoices, enquiries, setEnquiries, materials, setMaterials, customers, setCustomers, setLastAction }) {
  const IC = { amber: "#f59e0b", amberLight: "#fef3c766", green: "#10b981", red: "#ef4444", blue: "#3b82f6", muted: "#6b7280", border: "#2a2a2a", bg2: "#1a1a1a", bg3: "#242424", text: "#e5e5e5" };

  const [connection, setConnection] = useState(null);
  const [pendingActions, setPendingActions] = useState([]);
  const [recentActions, setRecentActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({});
  const [tab, setTab] = useState("pending");
  const [disconnecting, setDisconnecting] = useState(false);
  const [feedbackAction, setFeedbackAction] = useState(null); // action awaiting dismiss reason

  const DISMISS_REASONS = [
    { id: "wrong_type", label: "Wrong action type" },
    { id: "not_relevant", label: "Not relevant" },
    { id: "wrong_customer", label: "Wrong customer" },
    { id: "already_done", label: "Already handled" },
    { id: "spam", label: "Spam / ignore always" },
  ];
  const [urlError, setUrlError] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("email_error");
    if (err) { window.history.replaceState({}, "", window.location.pathname); return decodeURIComponent(err); }
    return null;
  });
  const [urlConnected, setUrlConnected] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("email_connected") || null;
  });

  // Voice dictation for compose
  const { recording, transcribing, toggle } = useWhisper((text) => {
    if (text) setComposeData(p => ({ ...p, body: p.body ? p.body + " " + text : text }));
  });

  // Email reader state
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [composing, setComposing] = useState(false);
  const [composeData, setComposeData] = useState({ to: "", subject: "", body: "" });
  const [sending, setSending] = useState(false);

  const [checking, setChecking] = useState(false);

  useEffect(() => { if (user) { checkConnection(); loadActions(); } }, [user]);

  async function checkConnection() {
    try {
      const { data } = await window._supabase.from("email_connections").select("provider, email, last_checked").eq("user_id", user.id);
      if (data?.length) { setConnection(data[0]); loadInbox(data[0]); }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function loadActions() {
    try {
      const [pendRes, doneRes] = await Promise.all([
        fetch(`/api/email/actions?userId=${user.id}&status=pending`),
        fetch(`/api/email/actions?userId=${user.id}&status=approved`),
      ]);
      const [pend, done] = await Promise.all([pendRes.json(), doneRes.json()]);
      setPendingActions(pend.actions || []);
      setRecentActions(done.actions || []);
    } catch (e) { console.error(e); }
  }

  const [checkResult, setCheckResult] = useState(null);

  async function runEmailCheck() {
    setChecking(true);
    setCheckResult(null);
    try {
      const res = await fetch("/api/email-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await loadActions();
      const { data: connData } = await window._supabase.from("email_connections").select("provider, email, last_checked").eq("user_id", user.id);
      if (connData?.length) setConnection(connData[0]);
      setCheckResult({ emails: data.emailsChecked || 0, actions: data.actionsCreated || 0, debug: data.debug || [] });
      setTimeout(() => setCheckResult(null), 10000);
    } catch (e) {
      console.error("Check failed:", e.message);
      setCheckResult({ error: e.message });
      setTimeout(() => setCheckResult(null), 6000);
    }
    setChecking(false);
  }

  async function loadInbox(conn) {
    const c = conn || connection;
    if (!c) return;
    setInboxLoading(true);
    try {
      const res = await fetch(`/api/${c.provider === "outlook" ? "outlook" : "gmail"}/inbox?userId=${user.id}`);
      const data = await res.json();
      setThreads(data.threads || []);
    } catch (e) { console.error(e); }
    setInboxLoading(false);
  }

  async function openThread(thread) {
    setSelectedThread(thread);
    setThreadLoading(true);
    setMessages([]);
    try {
      const isOutlook = connection?.provider === "outlook";
      const param = isOutlook ? `messageId=${thread.messageId || thread.id}` : `threadId=${thread.id}`;
      const res = await fetch(`/api/${isOutlook ? "outlook" : "gmail"}/thread?userId=${user.id}&${param}`);
      const data = await res.json();
      setMessages(data.messages || []);
      setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, unread: false } : t));
    } catch (e) { console.error(e); }
    setThreadLoading(false);
  }

  async function sendEmail() {
    if (!composeData.to || !composeData.subject) return alert("To and Subject required");
    setSending(true);
    try {
      const isOutlook = connection?.provider === "outlook";
      await fetch(`/api/${isOutlook ? "outlook" : "gmail"}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, ...composeData, body: `<p>${composeData.body.replace(/\n/g, "<br>")}</p>` }),
      });
      setComposing(false);
      setComposeData({ to: "", subject: "", body: "" });
      loadInbox();
    } catch (e) { console.error(e); }
    setSending(false);
  }

  async function disconnect() {
    if (!confirm("Disconnect this email account? You can reconnect at any time.")) return;
    setDisconnecting(true);
    try {
      await window._supabase.from("email_connections").delete().eq("user_id", user.id);
      setConnection(null);
      setThreads([]);
      setSelectedThread(null);
      setMessages([]);
    } catch (e) { console.error(e); }
    setDisconnecting(false);
  }

  async function approve(action) {
    setProcessing(p => ({ ...p, [action.id]: true }));
    try {
      await executeAction(action);
      await fetch("/api/email/actions/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actionId: action.id }) });
      setPendingActions(prev => prev.filter(a => a.id !== action.id));
      setRecentActions(prev => [{ ...action, status: "approved" }, ...prev]);
      // Update AI context with what was learned from this approval
      await updateAIContext(action);
    } catch (e) { console.error(e); }
    setProcessing(p => ({ ...p, [action.id]: false }));
  }

  // Show reason picker before dismissing
  function startReject(action) {
    setFeedbackAction(action);
  }

  async function confirmReject(action, reason) {
    setFeedbackAction(null);
    setProcessing(p => ({ ...p, [action.id]: true }));
    try {
      // Save feedback for AI learning
      await window._supabase.from("ai_feedback").insert({
        user_id: user.id,
        email_id: action.email_id,
        email_from: action.email_from,
        email_subject: action.email_subject,
        action_suggested: action.action_type,
        reason,
      });
      await fetch("/api/email/actions/reject", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actionId: action.id }) });
      setPendingActions(prev => prev.filter(a => a.id !== action.id));
    } catch (e) { console.error(e); }
    setProcessing(p => ({ ...p, [action.id]: false }));
  }

  // Update AI context with patterns learned from approved actions
  async function updateAIContext(action) {
    const d = action.action_data || {};
    try {
      // Load existing context
      const { data: existing } = await window._supabase.from("ai_context").select("*").eq("user_id", user.id).single();
      const ctx = existing || { suppliers: [], contractors: [], customers: [], job_types: [] };

      // Add what we learned
      if (action.action_type === "add_materials" && d.supplier) {
        if (!ctx.suppliers.find(s => s.name?.toLowerCase() === d.supplier.toLowerCase())) {
          ctx.suppliers = [...(ctx.suppliers || []), { name: d.supplier, type: "materials", from: action.email_from?.match(/<(.+)>/)?.[1] || action.email_from }];
        }
      }
      if (action.action_type === "add_cis_statement" && d.contractor_name) {
        if (!ctx.contractors.find(c => c.name?.toLowerCase() === d.contractor_name.toLowerCase())) {
          ctx.contractors = [...(ctx.contractors || []), { name: d.contractor_name, type: "cis", from: action.email_from?.match(/<(.+)>/)?.[1] || action.email_from }];
        }
      }
      if ((action.action_type === "create_job" || action.action_type === "create_enquiry" || action.action_type === "accept_quote") && d.customer) {
        if (!ctx.customers.find(c => c.name?.toLowerCase() === d.customer.toLowerCase())) {
          ctx.customers = [...(ctx.customers || []), { name: d.customer, from: action.email_from?.match(/<(.+)>/)?.[1] || action.email_from }];
        }
      }
      if (action.action_type === "create_job" && d.type) {
        if (!ctx.job_types.find(t => t.toLowerCase() === d.type.toLowerCase())) {
          ctx.job_types = [...(ctx.job_types || []), d.type];
        }
      }

      // Upsert context
      await window._supabase.from("ai_context").upsert({
        user_id: user.id,
        ...ctx,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    } catch (e) { console.error("AI context update failed:", e.message); }
  }

  async function executeAction(action) {
    const d = action.action_data || {};
    switch (action.action_type) {
      case "create_job": {
        // Add job to schedule — use TBC if no date mentioned
        const hasDate = !!(d.date_text && d.date_text.trim());
        setJobs(prev => [...(prev || []), {
          id: Date.now(),
          customer: d.customer || d.sender_name || "Unknown",
          address: d.address || "",
          type: d.type || "Job",
          date: hasDate ? d.date_text : "TBC",
          dateObj: new Date().toISOString(),
          status: "pending",
          value: 0,
          notes: d.notes || `From email: ${action.email_subject}`,
        }]);

        // Check if customer already exists
        const replyTo = d.reply_to || action.email_from?.match(/<(.+)>/)?.[1] || action.email_from || "";
        const senderName = d.sender_name || d.customer || "there";
        const existingCustomer = (customers || []).find(c =>
          c.name?.toLowerCase().includes((d.customer || "").toLowerCase()) ||
          c.email?.toLowerCase() === replyTo.toLowerCase()
        );

        if (replyTo && connection) {
          if (!existingCustomer) {
            // New customer — add partial record and ask for details + availability
            setCustomers(prev => [...(prev || []), {
              id: Date.now(),
              name: d.customer || d.sender_name || "Unknown",
              email: replyTo,
              phone: "",
              address: "",
              notes: `Added from email booking request`,
            }]);

            const jobDesc = d.type || "the work";
            const dateText = hasDate ? ` on ${d.date_text}` : "";
            const replyBody = `<p>Hi ${senderName},</p>
<p>Thank you for getting in touch. I've added your ${jobDesc} request${dateText} to my diary and will be in touch to confirm the appointment.</p>
<p>To get you set up ahead of the scheduled appointment, could you please provide the following details:</p>
<ul>
<li><strong>Full name</strong></li>
<li><strong>Phone number</strong></li>
<li><strong>Address where the work is needed</strong></li>
${!hasDate ? "<li><strong>A few preferred dates and times that work for you</strong></li>" : ""}
</ul>
<p>Once I have these I'll send you a full confirmation.</p>
<p>Many thanks,<br>${brand?.tradingName || ""}${brand?.phone ? `<br>${brand.phone}` : ""}${brand?.email ? `<br>${brand.email}` : ""}</p>`;

            const endpoint = connection.provider === "outlook" ? "/api/outlook/send" : "/api/gmail/send";
            await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: user.id, to: replyTo, subject: `Re: ${action.email_subject}`, body: replyBody }),
            }).catch(err => console.error("Reply failed:", err.message));

          } else {
            // Existing customer — send a booking confirmation
            const jobDesc = d.type || "the work";
            const dateText = hasDate ? ` on ${d.date_text}` : "";
            const availabilityLine = !hasDate
              ? `<p>Could you please suggest a few dates and times that work for you so we can get something confirmed?</p>`
              : `<p>We'll be in touch shortly to confirm the full details.</p>`;

            const replyBody = `<p>Hi ${senderName},</p>
<p>Thank you for getting in touch. I've added your ${jobDesc} request${dateText} to the diary.</p>
${availabilityLine}
<p>Many thanks,<br>${brand?.tradingName || ""}${brand?.phone ? `<br>${brand.phone}` : ""}${brand?.email ? `<br>${brand.email}` : ""}</p>`;

            const endpoint = connection.provider === "outlook" ? "/api/outlook/send" : "/api/gmail/send";
            await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: user.id, to: replyTo, subject: `Re: ${action.email_subject}`, body: replyBody }),
            }).catch(err => console.error("Confirmation reply failed:", err.message));
          }
        }
        break;
      }
      case "create_enquiry": {
        const replyTo = d.reply_to || action.email_from?.match(/<(.+)>/)?.[1] || action.email_from || "";
        const senderName = d.sender_name || d.customer || d.name || "there";
        const enquiryName = d.name || d.customer || d.sender_name || senderName || "Unknown";

        // Create enquiry with full contact details
        const newEnquiry = {
          name: enquiryName,
          source: "Email",
          msg: d.message || action.email_snippet,
          time: "Just now",
          urgent: d.urgent || false,
          status: "new",
          email: replyTo,
          phone: d.phone || "",
          address: d.address || "",
        };
        setEnquiries(prev => [newEnquiry, ...(prev || [])]);
        // Push notification for new enquiry
        sendPush({
          title: "📩 New Enquiry",
          body: `${enquiryName}${d.message ? " — " + d.message.slice(0, 80) : ""}`,
          url: "/",
          type: "enquiry",
          tag: "new-enquiry",
          requireInteraction: true,
        });

        // Also save directly to Supabase so it persists through reloads
        if (user?.id) {
          const cid = window._companyId;
          if (cid) {
            await window._supabase.from("enquiries").insert({
              company_id: cid,
              user_id: user.id,
              name: enquiryName,
              source: "Email",
              msg: d.message || action.email_snippet || "",
              time: "Just now",
              urgent: d.urgent || false,
              status: "new",
              email: replyTo,
              phone: d.phone || "",
              address: d.address || "",
            }).catch(e => console.error("Enquiry insert:", e.message));
          }
        }

        // Create or update customer record
        const existingCustomer = (customers || []).find(c =>
          c.email?.toLowerCase() === replyTo.toLowerCase() ||
          c.name?.toLowerCase() === enquiryName.toLowerCase()
        );

        if (replyTo && !existingCustomer) {
          setCustomers(prev => [...(prev || []), {
            id: Date.now(),
            name: enquiryName,
            email: replyTo,
            phone: d.phone || "",
            address: d.address || "",
            notes: "Added from email enquiry",
          }]);
        }

        // Send reply asking for details (only if we have a reply address and email connection)
        if (replyTo && connection) {
          const replyBody = `<p>Hi ${senderName},</p>
<p>Thank you for getting in touch. I've added your ${d.type || d.message?.slice(0, 50) || "enquiry"} to the diary.</p>
<p>Could you please suggest a few dates and times that work for you so we can get something confirmed?</p>
${!existingCustomer ? `<p>It would also be helpful to have:</p>
<ul>
<li><strong>Your phone number</strong></li>
<li><strong>The address where the work is needed</strong></li>
</ul>` : ""}
<p>Many thanks,<br>${brand?.tradingName || ""}${brand?.phone ? `<br>${brand.phone}` : ""}${brand?.email ? `<br>${brand.email}` : ""}</p>`;

          const endpoint = connection.provider === "outlook" ? "/api/outlook/send" : "/api/gmail/send";
          await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user.id, to: replyTo, subject: `Re: ${action.email_subject}`, body: replyBody }),
          }).catch(err => console.error("Enquiry reply failed:", err.message));
        }
        break;
      }
      case "save_customer": { const ex = (customers || []).find(c => c.name?.toLowerCase() === (d.name || d.customer || "").toLowerCase()); if (!ex) setCustomers(prev => [...(prev || []), { id: Date.now(), name: d.name || d.customer || "Unknown", email: d.email || d.reply_to || "", phone: d.phone || "", address: "", notes: "" }]); break; }
      case "add_materials": {
        // If we have attachment info, parse the PDF to extract line items
        if (d.message_id && d.attachment_id) {
          try {
            const isOutlook = connection?.provider === "outlook";
            const endpoint = isOutlook ? "/api/outlook/parse-supplier" : "/api/gmail/parse-supplier";
            const parseRes = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: user.id, messageId: d.message_id, attachmentId: d.attachment_id }),
            });
            const parseData = await parseRes.json();
            if (parseData.items?.length > 0) {
              const receiptId = `email_${action.id}_${Date.now()}`;
              const supplierName = d.supplier || action.email_from?.match(/^(.+?)\s*</)?.[1]?.replace(/"/g, "") || "Supplier";
              const newMaterials = parseData.items.map((item, i) => ({
                id: Date.now() + i,
                item: item.item || item.description || "Unknown item",
                qty: item.qty || 1,
                unitPrice: item.unitPrice || item.unit_price || 0,
                supplier: supplierName,
                job: "",
                status: "ordered", // Invoice received = already ordered/purchased
                receiptId,
                receiptSource: "email",
                receiptFilename: d.attachment_filename || "",
              }));
              setMaterials(prev => [...newMaterials, ...(prev || [])]);
              break;
            }
          } catch (err) {
            console.error("PDF parse failed:", err.message);
          }
        }
        // Fallback — add single placeholder entry
        setMaterials(prev => [...(prev || []), {
          id: Date.now(),
          item: `Items from ${d.supplier || d.attachment_filename || "supplier invoice"}`,
          qty: 1, unitPrice: 0,
          supplier: d.supplier || "",
          job: "", status: "to_order",
          receiptSource: "email",
          receiptFilename: d.attachment_filename || "",
        }]);
        break;
      }

      case "add_cis_statement": {
        // Try to parse CIS statement from PDF attachment
        if (d.message_id && d.attachment_id) {
          try {
            const isOutlook = connection?.provider === "outlook";
            const { data: connData } = await window._supabase.from("email_connections").select("access_token").eq("user_id", user.id).single();
            const token = connData?.access_token;

            const attRes = await fetch(
              isOutlook
                ? `https://graph.microsoft.com/v1.0/me/messages/${d.message_id}/attachments/${d.attachment_id}`
                : `https://gmail.googleapis.com/gmail/v1/users/me/messages/${d.message_id}/attachments/${d.attachment_id}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            const attData = await attRes.json();
            const rawBase64 = isOutlook ? attData.contentBytes : attData.data;

            if (rawBase64) {
              const base64Clean = rawBase64.replace(/-/g, "+").replace(/_/g, "/");
              const pdfDataUrl = `data:application/pdf;base64,${base64Clean}`;

              // Use Claude to extract CIS data from the PDF
              const parseRes = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
                body: JSON.stringify({
                  model: "claude-sonnet-4-6",
                  max_tokens: 400,
                  messages: [{
                    role: "user",
                    content: [
                      { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64Clean } },
                      { type: "text", text: "Extract CIS monthly statement details. Return ONLY JSON: {\"contractor_name\":\"company name\",\"tax_month\":\"YYYY-MM\",\"gross_amount\":number,\"deduction_amount\":number,\"net_amount\":number}" }
                    ],
                  }],
                }),
              });
              const parseData = await parseRes.json();
              const raw = parseData.content?.[0]?.text?.trim() || "{}";
              const match = raw.match(/\{[\s\S]*\}/);
              const cis = match ? JSON.parse(match[0]) : {};

              await window._supabase.from("cis_statements").insert({
                user_id: user.id,
                contractor_name: cis.contractor_name || d.contractor_name || "Unknown Contractor",
                tax_month: ((cis.tax_month || d.tax_month || new Date().toISOString().slice(0,7))) + "-01",
                gross_amount: cis.gross_amount || parseFloat(d.gross_amount) || 0,
                deduction_amount: cis.deduction_amount || parseFloat(d.deduction_amount) || 0,
                net_amount: cis.net_amount || ((cis.gross_amount || 0) - (cis.deduction_amount || 0)) || 0,
                notes: `From email: ${action.email_subject}`,
                attachment_data: pdfDataUrl,
              });
              break;
            }
          } catch (err) {
            console.error("CIS PDF parse failed:", err.message);
          }
        }
        // Fallback — save what Claude extracted from the email body
        if (d.contractor_name || d.gross_amount) {
          await window._supabase.from("cis_statements").insert({
            user_id: user.id,
            contractor_name: d.contractor_name || "Unknown Contractor",
            tax_month: (d.tax_month || new Date().toISOString().slice(0,7)) + "-01",
            gross_amount: parseFloat(d.gross_amount) || 0,
            deduction_amount: parseFloat(d.deduction_amount) || 0,
            net_amount: (parseFloat(d.gross_amount) || 0) - (parseFloat(d.deduction_amount) || 0),
            notes: `From email: ${action.email_subject}`,
          });
        }
        break;
      }
      case "update_job": {
        const jobId = d.job_id;
        const customerNameForJob = (d.customer || "").toLowerCase();
        const jobValue = d.job_value ? parseFloat(d.job_value) : null;

        if (jobId) {
          // Direct job_id match
          await supabase.from("job_cards")
            .update({ status: "completed", completion_date: new Date().toISOString() })
            .eq("id", jobId)
            .eq("user_id", user.id);
        } else {
          // Match by customer name + value if available
          const { data: matchingJobs } = await supabase.from("job_cards")
            .select("id, title, type, status, value")
            .eq("user_id", user.id)
            .ilike("customer", `%${customerNameForJob}%`)
            .neq("status", "completed")
            .order("created_at", { ascending: false });

          if (matchingJobs?.length > 0) {
            // If we have a value, try to match on it first (within 10% tolerance)
            let bestMatch = matchingJobs[0];
            if (jobValue && matchingJobs.length > 1) {
              const valueMatch = matchingJobs.find(j =>
                j.value && Math.abs(parseFloat(j.value) - jobValue) / jobValue < 0.1
              );
              if (valueMatch) bestMatch = valueMatch;
            }
            await supabase.from("job_cards")
              .update({ status: "completed", completion_date: new Date().toISOString() })
              .eq("id", bestMatch.id)
              .eq("user_id", user.id);
          }
        }
        break;
      }
      case "mark_invoice_paid": {
        // Extract invoice number from action_data, email subject, or email snippet
        const invoiceNumFromData = d.invoice_number ? String(d.invoice_number) : null;
        const subjectMatch = action.email_subject?.match(/(?:invoice\s*#?\s*)(\d+)/i);
        const invoiceNumFromSubject = subjectMatch ? subjectMatch[1] : null;
        const snippetMatch = action.email_snippet?.match(/(?:invoice\s*#?\s*)(\d+)/i);
        const invoiceNumFromSnippet = snippetMatch ? snippetMatch[1] : null;
        const invoiceNum = invoiceNumFromData || invoiceNumFromSubject || invoiceNumFromSnippet;
        const customerNameLower = (d.customer || "").toLowerCase();

        const inv = (invoices || []).find(i => {
          if (i.isQuote || i.status === "paid") return false;
          // Match by invoice number (highest priority)
          if (invoiceNum && i.id?.includes(invoiceNum)) return true;
          // Match by customer name
          if (customerNameLower && i.customer?.toLowerCase().includes(customerNameLower)) return true;
          return false;
        });

        if (inv) {
          setInvoices(prev => (prev || []).map(i => i.id === inv.id ? { ...i, status: "paid", due: "Paid" } : i));
        }
        break;
      }
      case "accept_quote": {
        // Find matching quote by customer name or address
        const customerName = d.customer || "";
        const address = d.address || d.notes || "";
        const matchingQuote = (invoices || []).find(i =>
          i.isQuote &&
          (i.customer?.toLowerCase().includes(customerName.toLowerCase()) ||
           (address && (i.jobRef?.toLowerCase().includes(address.toLowerCase()) ||
            i.address?.toLowerCase().includes(address.toLowerCase()))))
        );

        if (matchingQuote) {
          // Convert quote to invoice
          const newId = nextInvoiceId(invoices);
          const newInvoice = { ...matchingQuote, isQuote: false, id: newId, status: "sent", due: `Due in ${brand?.paymentTerms || 30} days` };
          setInvoices(prev => [newInvoice, ...(prev || []).filter(i => i.id !== matchingQuote.id)]);
        } else {
          // No matching quote found — create a job instead
          setJobs(prev => [...(prev || []), { id: Date.now(), customer: customerName || "Unknown", address: d.address || "", type: d.type || "Boiler Installation", date: new Date().toLocaleDateString("en-GB"), dateObj: new Date().toISOString(), status: "pending", value: 0, notes: `Quote accepted via email. ${d.notes || ""}` }]);
        }

        // Send reply email asking for booking date
        const replyTo = d.reply_to || action.email_from?.match(/<(.+)>/)?.[1] || action.email_from || "";
        if (replyTo && connection) {
          const endpoint = connection.provider === "outlook" ? "/api/outlook/send" : "/api/gmail/send";
          const jobDesc = d.address || d.type || "the work";
          const replyBody = `<p>Hi ${customerName || "there"},</p><p>Thank you for confirming you'd like to go ahead with ${jobDesc}. I'll get that booked in for you.</p><p>What date and time would suit you best? Please let me know a few options and I'll confirm which works.</p><p>Many thanks,<br>${brand?.tradingName || ""}${brand?.phone ? `<br>${brand.phone}` : ""}</p>`;
          await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user.id, to: replyTo, subject: `Re: ${action.email_subject}`, body: replyBody }),
          }).catch(err => console.error("Reply failed:", err.message));
        }
        break;
      }
    }
  }

  function actionIcon(type) { return { create_job: "📅", create_enquiry: "📩", mark_invoice_paid: "✅", update_job: "🔧", add_materials: "🔧", save_customer: "👤", accept_quote: "🤝", add_cis_statement: "🏗" }[type] || "⚡"; }
  function actionColor(type) { return { create_job: IC.green, create_enquiry: IC.blue, mark_invoice_paid: IC.green, update_job: IC.amber, add_materials: IC.amber, save_customer: "#8b5cf6", accept_quote: IC.green, add_cis_statement: IC.blue }[type] || IC.amber; }
  function formatTime(ts) { if (!ts) return ""; const d = new Date(ts), diff = Date.now() - d; if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`; if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`; return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }); }
  function fromName(from) { if (!from) return "Unknown"; const m = from.match(/^(.+?)\s*</); return m ? m[1].replace(/"/g, "") : from.split("@")[0]; }

  const IS = {
    card: { background: IC.bg2, border: `1px solid ${IC.border}`, borderRadius: 10, padding: 16, marginBottom: 12 },
    btn: (v) => ({ padding: "7px 14px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", border: v === "ghost" ? `1px solid ${IC.border}` : "none", fontFamily: "'DM Mono',monospace", background: v === "approve" ? IC.green : v === "amber" ? IC.amber : v === "red" ? "#7f1d1d" : v === "ghost" ? "transparent" : IC.bg3, color: v === "approve" ? "#fff" : v === "amber" ? "#000" : v === "red" ? IC.red : IC.text }),
    tab: (a) => ({ padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: a ? 700 : 400, fontFamily: "'DM Mono',monospace", background: a ? IC.amber : "transparent", color: a ? "#000" : IC.muted }),
    input: { width: "100%", padding: "7px 10px", borderRadius: 6, border: `1px solid ${IC.border}`, background: IC.bg3, color: IC.text, fontSize: 12, marginBottom: 8, boxSizing: "border-box", fontFamily: "'DM Mono',monospace" },
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: IC.muted, fontFamily: "'DM Mono',monospace" }}>Loading...</div>;

  // Show error from OAuth callback
  if (urlError) {
    return (
      <div style={{ fontFamily: "'DM Mono',monospace", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: "#7f1d1d", border: "1px solid #ef4444", borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#ef4444", marginBottom: 8 }}>⚠ Email connection failed</div>
          <div style={{ fontSize: 12, color: "#fca5a5", marginBottom: 16, lineHeight: 1.6, wordBreak: "break-all" }}>{urlError}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={IS.btn("amber")} onClick={() => { window.location.href = `/api/auth/gmail/connect?userId=${user.id}`; }}>Try Gmail instead</button>
            <button style={IS.btn("default")} onClick={() => { window.location.href = `/api/auth/outlook/connect?userId=${user.id}`; }}>Retry Outlook</button>
            <button style={IS.btn("ghost")} onClick={() => setUrlError(null)}>Dismiss</button>
          </div>
        </div>
      </div>
    );
  }

  if (!connection) {
    return (
      <div style={{ padding: 48, textAlign: "center", fontFamily: "'DM Mono',monospace" }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>✉</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: IC.text, marginBottom: 8 }}>Connect your inbox</div>
        <div style={{ fontSize: 13, color: IC.muted, maxWidth: 380, margin: "0 auto 28px", lineHeight: 1.6 }}>Link your email and Claude will automatically review incoming emails every hour — suggesting jobs, enquiries, material orders and more for your approval.</div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 12 }}>
          <button style={{ ...IS.btn("default"), padding: "10px 20px", fontSize: 13 }} onClick={() => { window.location.href = `/api/auth/gmail/connect?userId=${user.id}`; }}>
            <span style={{ color: "#ef4444", fontWeight: 700 }}>G</span> Connect Gmail
          </button>
          <button style={{ ...IS.btn("default"), padding: "10px 20px", fontSize: 13 }} onClick={() => { window.location.href = `/api/auth/outlook/connect?userId=${user.id}`; }}>
            <span style={{ color: "#3b82f6", fontWeight: 700 }}>✉</span> Connect Outlook
          </button>
        </div>
        <div style={{ fontSize: 11, color: IC.muted }}>Works with Gmail, Google Workspace, Outlook and Microsoft 365</div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'DM Mono',monospace", display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Status bar */}
      <div style={{ ...IS.card, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: IC.green, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: IC.text }}>{connection.email}</div>
            <div style={{ fontSize: 11, color: IC.muted }}>{connection.provider} · AI checks every hour · {connection.last_checked ? `Last checked ${formatTime(connection.last_checked)}` : "Not checked yet"}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {pendingActions.length > 0 && <div style={{ background: IC.red, color: "#fff", borderRadius: 10, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>{pendingActions.length} pending</div>}
          <button style={IS.btn("ghost")} onClick={() => { setConnection(null); window.location.href = `/api/auth/gmail/connect?userId=${user.id}`; }} title="Switch to Gmail">
            <span style={{ color: "#ef4444", fontWeight: 700, fontSize: 12 }}>G</span>
          </button>
          <button style={IS.btn("ghost")} onClick={() => { setConnection(null); window.location.href = `/api/auth/outlook/connect?userId=${user.id}`; }} title="Switch to Outlook">
            <span style={{ color: "#3b82f6", fontWeight: 700, fontSize: 12 }}>✉</span>
          </button>
          <button style={{ ...IS.btn("red"), fontSize: 10, padding: "5px 10px" }} onClick={disconnect} disabled={disconnecting}>
            {disconnecting ? "..." : "Disconnect"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4 }}>
        <button style={IS.tab(tab === "pending")} onClick={() => setTab("pending")}>AI Actions {pendingActions.length > 0 && `(${pendingActions.length})`}</button>
        <button style={IS.tab(tab === "inbox")} onClick={() => setTab("inbox")}>Inbox</button>
        <button style={IS.tab(tab === "recent")} onClick={() => setTab("recent")}>History</button>
      </div>

      {/* Check result banner */}
      {checkResult && (
        <div style={{ padding: "10px 14px", borderRadius: 8, fontSize: 12,
          background: checkResult.error ? "#7f1d1d" : checkResult.actions > 0 ? "#064e3b" : "#1a1a1a",
          border: `1px solid ${checkResult.error ? "#ef4444" : checkResult.actions > 0 ? "#10b981" : "#2a2a2a"}`,
          color: checkResult.error ? "#fca5a5" : checkResult.actions > 0 ? "#6ee7b7" : "#6b7280" }}>
          <div style={{ fontWeight: 600, marginBottom: checkResult.debug?.length ? 8 : 0 }}>
            {checkResult.error
              ? `⚠ Check failed: ${checkResult.error}`
              : checkResult.actions > 0
                ? `✓ Checked ${checkResult.emails} emails — found ${checkResult.actions} new action${checkResult.actions !== 1 ? "s" : ""}`
                : `✓ Checked ${checkResult.emails} emails — no new actions`
            }
          </div>
          {checkResult.debug?.map((line, i) => (
            <div key={i} style={{ fontSize: 11, opacity: 0.8, marginTop: 3 }}>{line}</div>
          ))}
        </div>
      )}

      {/* ── AI Actions tab ── */}
      {tab === "pending" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: IC.muted }}>Claude reviews your inbox every hour and suggests actions for your approval.</div>
            <button style={IS.btn("amber")} onClick={runEmailCheck} disabled={checking}>
              {checking ? "⏳ Checking..." : "↻ Check Now"}
            </button>
          </div>
          {pendingActions.length === 0 ? (
            <div style={{ ...IS.card, textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: IC.text, marginBottom: 6 }}>All caught up</div>
              <div style={{ fontSize: 12, color: IC.muted, lineHeight: 1.6 }}>No pending actions. Claude will check your inbox again on the next hour and suggest actions for any new emails.</div>
            </div>
          ) : pendingActions.map(action => (
            <div key={action.id} style={{ ...IS.card, borderLeft: `3px solid ${actionColor(action.action_type)}` }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 22, flexShrink: 0 }}>{actionIcon(action.action_type)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: IC.text, marginBottom: 4 }}>{action.action_description}</div>
                  <div style={{ fontSize: 11, color: IC.muted, marginBottom: 2 }}>From: {action.email_from}</div>
                  <div style={{ fontSize: 11, color: IC.muted, marginBottom: 6 }}>Re: {action.email_subject}</div>
                  <div style={{ fontSize: 11, color: IC.muted, background: IC.bg3, padding: "6px 10px", borderRadius: 6, fontStyle: "italic", lineHeight: 1.5 }}>"{action.email_snippet?.slice(0, 120)}..."</div>
                </div>
                <div style={{ fontSize: 10, color: IC.muted, flexShrink: 0 }}>{formatTime(action.created_at)}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={IS.btn("approve")} disabled={processing[action.id]} onClick={() => approve(action)}>{processing[action.id] ? "..." : "✓ Approve"}</button>
                <button style={IS.btn("default")} disabled={processing[action.id]} onClick={() => startReject(action)}>Dismiss</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Inbox tab ── */}
      {tab === "inbox" && (
        <div>
          {/* Thread list - full width on mobile */}
          <div style={{ background: IC.bg2, border: `1px solid ${IC.border}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", borderBottom: `1px solid ${IC.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: IC.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Inbox</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button style={IS.btn("default")} onClick={() => loadInbox()} title="Refresh">↻</button>
                <button style={IS.btn("amber")} onClick={() => setComposing(true)}>+ New</button>
              </div>
            </div>
            {inboxLoading && <div style={{ padding: 20, textAlign: "center", color: IC.muted, fontSize: 12 }}>Loading...</div>}
            {!inboxLoading && threads.length === 0 && <div style={{ padding: 20, textAlign: "center", color: IC.muted, fontSize: 12 }}>No emails found</div>}
            {threads.map(t => (
              <div key={t.id + (t.messageId || "")} onClick={() => openThread(t)}
                style={{ padding: "12px 14px", cursor: "pointer", borderBottom: `1px solid ${IC.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <div style={{ fontSize: 13, fontWeight: t.unread ? 700 : 500, color: IC.text }}>{fromName(t.from)}</div>
                  <div style={{ fontSize: 10, color: IC.muted, flexShrink: 0, marginLeft: 8 }}>{formatTime(t.date)}</div>
                </div>
                <div style={{ fontSize: 12, color: t.unread ? IC.amber : IC.textDim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 2 }}>
                  {t.unread && <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: IC.amber, marginRight: 5, verticalAlign: "middle" }} />}
                  {t.subject}{t.hasAttachment && " 📎"}
                </div>
                <div style={{ fontSize: 11, color: IC.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.snippet}</div>
              </div>
            ))}
          </div>

          {/* ── Email read modal ── */}
          {selectedThread && (
            <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 0, paddingTop: "env(safe-area-inset-top, 0px)" }}
              onClick={() => setSelectedThread(null)}>
              <div onClick={e => e.stopPropagation()}
                style={{ background: IC.bg2, width: "100%", maxWidth: 600, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* Modal header */}
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${IC.border}`, background: IC.bg2, flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: IC.text, flex: 1, marginRight: 12, lineHeight: 1.3 }}>{selectedThread.subject}</div>
                    <button onClick={() => setSelectedThread(null)} style={{ background: "none", border: "none", color: IC.muted, cursor: "pointer", fontSize: 24, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={IS.btn("amber")} onClick={() => {
                      const last = messages[messages.length - 1];
                      setSelectedThread(null);
                      setComposing(true);
                      setComposeData({ to: last?.from?.match(/<(.+)>/)?.[1] || last?.from || "", subject: `Re: ${selectedThread.subject}`, body: "" });
                    }}>↩ Reply</button>
                    <button style={IS.btn("default")} onClick={() => {
                      setSelectedThread(null);
                      setComposing(true);
                      setComposeData({ to: "", subject: `Fwd: ${selectedThread.subject}`, body: "" });
                    }}>→ Forward</button>
                  </div>
                </div>
                {/* Messages */}
                <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                  {threadLoading && <div style={{ color: IC.muted, fontSize: 12, textAlign: "center", padding: 20 }}>Loading...</div>}
                  {messages.map(msg => (
                    <div key={msg.id} style={{ background: IC.bg3, borderRadius: 10, padding: 16, marginBottom: 12, border: `1px solid ${IC.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: IC.text }}>{fromName(msg.from)}</div>
                          <div style={{ fontSize: 11, color: IC.muted }}>to {msg.to}</div>
                        </div>
                        <div style={{ fontSize: 11, color: IC.muted, flexShrink: 0, marginLeft: 8 }}>{formatTime(msg.date)}</div>
                      </div>
                      <div style={{ borderTop: `1px solid ${IC.border}`, paddingTop: 12, fontSize: 14, color: IC.text, lineHeight: 1.7 }}>
                        {msg.isHtml
                          ? <div style={{ color: IC.text }} dangerouslySetInnerHTML={{ __html: msg.body }} />
                          : <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0, fontSize: 14 }}>{msg.body}</pre>
                        }
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Compose modal ── */}
          {composing && (
            <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, paddingTop: "env(safe-area-inset-top, 0px)" }}>
              <div style={{ background: IC.bg2, width: "100%", maxWidth: 600, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* Compose header */}
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${IC.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: IC.text }}>New Email</div>
                  <button onClick={() => { setComposing(false); setComposeData({ to: "", subject: "", body: "" }); }} style={{ background: "none", border: "none", color: IC.muted, cursor: "pointer", fontSize: 24, lineHeight: 1 }}>×</button>
                </div>
                {/* Compose body */}
                <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, color: IC.muted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>To</label>
                    <input style={IS.input} placeholder="customer@email.com" value={composeData.to} onChange={e => setComposeData(p => ({ ...p, to: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: IC.muted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Subject</label>
                    <input style={IS.input} placeholder="Invoice #INV-042 from Dave's Plumbing" value={composeData.subject} onChange={e => setComposeData(p => ({ ...p, subject: e.target.value }))} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <label style={{ fontSize: 11, color: IC.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>Message</label>
                      <button
                        onClick={toggle}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 700, background: recording ? IC.red : IC.amber, color: recording ? "#fff" : "#000" }}>
                        {transcribing ? "⏳ Transcribing..." : recording ? "⏹ Stop" : "🎙 Dictate"}
                      </button>
                    </div>
                    <textarea
                      style={{ ...IS.input, minHeight: 200, resize: "none", flex: 1 }}
                      placeholder="Type your message here, or tap Dictate to speak it..."
                      value={composeData.body}
                      onChange={e => setComposeData(p => ({ ...p, body: e.target.value }))}
                    />
                    {recording && <div style={{ fontSize: 11, color: IC.red, marginTop: 6, textAlign: "center" }}>🔴 Recording... tap Stop when done</div>}
                  </div>
                </div>
                {/* Compose footer */}
                <div style={{ padding: "12px 16px", borderTop: `1px solid ${IC.border}`, flexShrink: 0 }}>
                  <button style={{ ...IS.btn("amber"), width: "100%", justifyContent: "center", padding: "12px", fontSize: 13 }} disabled={sending || !composeData.to || !composeData.subject} onClick={sendEmail}>
                    {sending ? "Sending..." : "Send Email →"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── History tab ── */}
      {tab === "recent" && (
        <div>
          {recentActions.length === 0
            ? <div style={{ ...IS.card, textAlign: "center", padding: 32, color: IC.muted, fontSize: 13 }}>No history yet.</div>
            : recentActions.map(action => (
              <div key={action.id} style={{ ...IS.card, opacity: 0.8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 18 }}>{actionIcon(action.action_type)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: IC.text }}>{action.action_description}</div>
                    <div style={{ fontSize: 11, color: IC.muted }}>{action.email_from} · {formatTime(action.processed_at)}</div>
                  </div>
                  <div style={{ fontSize: 10, color: IC.green, fontWeight: 700 }}>✓ Done</div>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── Dismiss reason modal ── */}
      {feedbackAction && (
        <div style={{ position: "fixed", inset: 0, background: "#000d", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: 24 }}>
          <div style={{ background: IC.bg2, border: `1px solid ${IC.border}`, borderRadius: 12, padding: 24, maxWidth: 340, width: "100%", fontFamily: "'DM Mono',monospace" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: IC.text, marginBottom: 6 }}>Why dismiss this?</div>
            <div style={{ fontSize: 12, color: IC.muted, marginBottom: 20, lineHeight: 1.5 }}>
              Your feedback helps the AI improve — it won't make this mistake again.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {DISMISS_REASONS.map(r => (
                <button key={r.id} onClick={() => confirmReject(feedbackAction, r.id)}
                  style={{ padding: "10px 14px", borderRadius: 8, border: `1px solid ${IC.border}`, background: IC.bg3, color: IC.text, cursor: "pointer", fontSize: 12, fontFamily: "'DM Mono',monospace", textAlign: "left", fontWeight: 500 }}>
                  {r.label}
                </button>
              ))}
            </div>
            <button onClick={() => setFeedbackAction(null)} style={{ marginTop: 12, width: "100%", padding: "8px", borderRadius: 8, border: "none", background: "transparent", color: IC.muted, cursor: "pointer", fontSize: 11, fontFamily: "'DM Mono',monospace" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Enquiries Tab ────────────────────────────────────────────────────────────
function EnquiriesTab({ enquiries, setEnquiries, customers, setCustomers, invoices, setInvoices, brand, user, setView }) {
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", source: "Phone", msg: "", urgent: false });
  const [filter, setFilter] = useState("all");

  const SOURCES = ["Phone", "Email", "Website", "Referral", "Returning", "Other"];

  const filtered = (enquiries || []).filter(e => {
    if (filter === "urgent") return e.urgent;
    if (filter === "new") return !e.status || e.status === "new";
    if (filter === "contacted") return e.status === "contacted";
    if (filter === "quoted") return e.status === "quoted";
    return true;
  });

  function addEnquiry() {
    if (!form.name) return;
    const enq = { ...form, id: Date.now(), time: "Just now", status: "new" };
    setEnquiries(prev => [enq, ...(prev || [])]);
    setShowAdd(false);
    setForm({ name: "", phone: "", email: "", address: "", source: "Phone", msg: "", urgent: false });
  }

  function updateStatus(id, status) {
    setEnquiries(prev => (prev || []).map(e => e.id === id ? { ...e, status } : e));
    if (selected?.id === id) setSelected(s => ({ ...s, status }));
  }

  function deleteEnquiry(id) {
    setEnquiries(prev => (prev || []).filter(e => e.id !== id));
    setSelected(null);
  }

  function convertToQuote(enq) {
    // Add to customers if not already there
    const exists = (customers || []).find(c => c.name?.toLowerCase() === enq.name?.toLowerCase());
    if (!exists) {
      setCustomers(prev => [...(prev || []), { id: Date.now(), name: enq.name, email: enq.email || "", phone: enq.phone || "", address: enq.address || "", notes: `From enquiry: ${enq.msg || ""}` }]);
    }
    updateStatus(enq.id, "quoted");
    setSelected(null);
    setView("Quotes");
  }

  const statusColor = { new: C.blue, contacted: C.amber, quoted: C.purple, won: C.green, lost: C.red };
  const statusLabel = { new: "New", contacted: "Contacted", quoted: "Quoted", won: "Won", lost: "Lost" };
  const counts = { all: (enquiries || []).length, urgent: (enquiries || []).filter(e => e.urgent).length, new: (enquiries || []).filter(e => !e.status || e.status === "new").length, contacted: (enquiries || []).filter(e => e.status === "contacted").length, quoted: (enquiries || []).filter(e => e.status === "quoted").length };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Enquiries</div>
        <button style={S.btn("primary")} onClick={() => setShowAdd(true)}>+ Add Enquiry</button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px,1fr))", gap: 10 }}>
        {[
          { l: "Total", v: counts.all, c: C.text },
          { l: "New", v: counts.new, c: C.blue },
          { l: "Contacted", v: counts.contacted, c: C.amber },
          { l: "Quoted", v: counts.quoted, c: C.purple },
          { l: "Urgent", v: counts.urgent, c: C.red },
        ].map((st, i) => (
          <div key={i} style={S.card}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{st.l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: st.c }}>{st.v}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[["all","All"],["new","New"],["contacted","Contacted"],["quoted","Quoted"],["urgent","Urgent 🔴"]].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)} style={S.pill(C.amber, filter === v)}>{l}</button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0
        ? <div style={{ ...S.card, textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📩</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>No enquiries</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>Enquiries come in automatically from your inbox, or add one manually.</div>
            <button style={S.btn("primary")} onClick={() => setShowAdd(true)}>+ Add Enquiry</button>
          </div>
        : filtered.map(enq => (
          <div key={enq.id} onClick={() => setSelected(enq)} style={{ ...S.card, cursor: "pointer", borderLeft: `3px solid ${statusColor[enq.status || "new"]}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{enq.name}</div>
                  {enq.urgent && <div style={{ fontSize: 10, background: C.red, color: "#fff", borderRadius: 4, padding: "1px 6px", fontWeight: 700 }}>URGENT</div>}
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{enq.source}{enq.phone ? ` · ${enq.phone}` : ""}{enq.email ? ` · ${enq.email}` : ""}</div>
                {enq.msg && <div style={{ fontSize: 12, color: C.textDim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{enq.msg}</div>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0, marginLeft: 12 }}>
                <div style={S.badge(statusColor[enq.status || "new"])}>{statusLabel[enq.status || "new"]}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{enq.time}</div>
              </div>
            </div>
          </div>
        ))
      }

      {/* Add Enquiry Modal */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }}>
          <div style={{ ...S.card, maxWidth: 460, width: "100%", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>New Enquiry</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <VoiceFillButton form={form} setForm={setForm} fieldDescriptions="name (full name), phone (phone number), email (email address), address (address where work is needed), msg (what they want e.g. extension quote, boiler service), source (how they got in touch: Phone/Email/Website/Referral)" />
                <button onClick={() => setShowAdd(false)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22 }}>×</button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { k: "name", l: "Name *", p: "e.g. Steve Johnson" },
                { k: "phone", l: "Phone", p: "e.g. 07700 900000" },
                { k: "email", l: "Email", p: "e.g. steve@email.com" },
                { k: "address", l: "Address", p: "e.g. 12 High Street, Portsmouth" },
              ].map(({ k, l, p }) => (
                <div key={k}>
                  <label style={S.label}>{l}</label>
                  <input style={S.input} placeholder={p} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label style={S.label}>Source</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {SOURCES.map(s => <button key={s} onClick={() => setForm(f => ({ ...f, source: s }))} style={S.pill(C.amber, form.source === s)}>{s}</button>)}
                </div>
              </div>
              <div>
                <label style={S.label}>What they want</label>
                <textarea style={{ ...S.input, minHeight: 72, resize: "vertical" }} placeholder="e.g. Extension quote, boiler service..." value={form.msg} onChange={e => setForm(f => ({ ...f, msg: e.target.value }))} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8, cursor: "pointer" }} onClick={() => setForm(f => ({ ...f, urgent: !f.urgent }))}>
                <div style={{ width: 36, height: 20, borderRadius: 10, background: form.urgent ? C.red : C.border, position: "relative", flexShrink: 0, transition: "all 0.2s" }}>
                  <div style={{ position: "absolute", top: 2, left: form.urgent ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "all 0.2s" }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Mark as urgent</div>
              </div>
              <button style={S.btn("primary", !form.name)} disabled={!form.name} onClick={addEnquiry}>Add Enquiry →</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }} onClick={() => setSelected(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.card, maxWidth: 460, width: "100%", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{selected.name}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={S.badge(statusColor[selected.status || "new"])}>{statusLabel[selected.status || "new"]}</div>
                  {selected.urgent && <div style={{ fontSize: 10, background: C.red, color: "#fff", borderRadius: 4, padding: "1px 6px", fontWeight: 700 }}>URGENT</div>}
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 24 }}>×</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {/* Phone — always shown, editable inline */}
              <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Phone</div>
                {selected.phone
                  ? <a href={`tel:${selected.phone}`} style={{ fontSize: 14, color: C.blue, textDecoration: "none", display: "block" }}>{selected.phone}</a>
                  : <input style={{ ...S.input, padding: "4px 8px", fontSize: 13, background: "transparent", border: `1px dashed ${C.border}` }} placeholder="Add phone number..." onBlur={async e => { if (e.target.value.trim()) { setEnquiries(prev => prev.map(en => en.id === selected.id ? { ...en, phone: e.target.value.trim() } : en)); setSelected(s => ({ ...s, phone: e.target.value.trim() })); } }} />
                }
              </div>
              {/* Email — always shown, editable inline */}
              <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Email</div>
                {selected.email
                  ? <a href={`mailto:${selected.email}`} style={{ fontSize: 13, color: C.blue, textDecoration: "none", display: "block" }}>{selected.email}</a>
                  : <input style={{ ...S.input, padding: "4px 8px", fontSize: 13, background: "transparent", border: `1px dashed ${C.border}` }} placeholder="Add email address..." onBlur={async e => { if (e.target.value.trim()) { setEnquiries(prev => prev.map(en => en.id === selected.id ? { ...en, email: e.target.value.trim() } : en)); setSelected(s => ({ ...s, email: e.target.value.trim() })); } }} />
                }
              </div>
              {selected.address && <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Address</div>
                <div style={{ fontSize: 13 }}>{selected.address}</div>
              </div>}
              {selected.msg && <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Enquiry</div>
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>{selected.msg}</div>
              </div>}
              <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Source</div>
                <div style={{ fontSize: 13 }}>{selected.source}</div>
              </div>
            </div>

            {/* Status pipeline */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Update Status</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Object.entries(statusLabel).map(([v, l]) => (
                  <button key={v} onClick={() => updateStatus(selected.id, v)}
                    style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${selected.status === v ? statusColor[v] : C.border}`, background: selected.status === v ? statusColor[v] + "22" : "transparent", color: selected.status === v ? statusColor[v] : C.muted, fontSize: 11, fontFamily: "'DM Mono',monospace", fontWeight: 600, cursor: "pointer" }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <button style={{ ...S.btn("primary"), width: "100%", justifyContent: "center", padding: "12px", marginBottom: 8 }} onClick={() => convertToQuote(selected)}>→ Convert to Quote</button>
            <div style={{ display: "flex", gap: 8 }}>
              <a href={selected.phone ? `tel:${selected.phone}` : "#"} style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", textDecoration: "none", opacity: selected.phone ? 1 : 0.4, pointerEvents: selected.phone ? "auto" : "none" }}>📞 Call</a>
              <a href={selected.email ? `mailto:${selected.email}` : "#"} style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", textDecoration: "none", opacity: selected.email ? 1 : 0.4, pointerEvents: selected.email ? "auto" : "none" }}>✉ Email</a>
              <button style={{ ...S.btn("ghost"), color: C.red }} onClick={() => deleteEnquiry(selected.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Compliance Doc Helpers ───────────────────────────────────────────────────
function buildComplianceDocHTML(doc, job, brand) {
  const issued = doc.issued_date ? new Date(doc.issued_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
  const expiry = doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:'Helvetica Neue',Arial,sans-serif;background:#fff;color:#1a1a1a;margin:0;padding:40px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:24px;border-bottom:3px solid #f59e0b}
    .brand-name{font-size:22px;font-weight:700;margin-bottom:4px}
    .brand-detail{font-size:12px;color:#666;line-height:1.6}
    .doc-title{font-size:28px;font-weight:700;color:#f59e0b;text-align:right}
    .doc-type{font-size:13px;color:#666;text-align:right;margin-top:4px}
    .section{margin-bottom:24px;padding:20px;background:#f9f9f9;border-radius:8px}
    .section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:12px}
    .row{display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px}
    .label{color:#666}
    .value{font-weight:600}
    .footer{margin-top:40px;padding-top:20px;border-top:1px solid #eee;font-size:11px;color:#999;text-align:center}
    .cert-number{font-size:32px;font-weight:700;text-align:center;color:#1a1a1a;margin:24px 0;letter-spacing:0.1em}
  </style></head><body>
    <div class="header">
      <div>
        <div class="brand-name">${brand.tradingName || ""}</div>
        <div class="brand-detail">${brand.address || ""}${brand.phone ? `<br>${brand.phone}` : ""}${brand.email ? `<br>${brand.email}` : ""}${brand.gasSafeNumber ? `<br>Gas Safe: ${brand.gasSafeNumber}` : ""}${(brand.vatNumber && (brand._exemptBypass || brand.registrationVerifications?.vatNumber?.verified)) ? `<br>VAT: ${brand.vatNumber}` : ""}</div>
      </div>
      <div>
        <div class="doc-title">CERTIFICATE</div>
        <div class="doc-type">${doc.doc_type}</div>
      </div>
    </div>

    ${doc.doc_number ? `<div class="cert-number">${doc.doc_number}</div>` : ""}

    <div class="section">
      <div class="section-title">Certificate Details</div>
      <div class="row"><span class="label">Document Type</span><span class="value">${doc.doc_type}</span></div>
      ${doc.doc_number ? `<div class="row"><span class="label">Certificate Number</span><span class="value">${doc.doc_number}</span></div>` : ""}
      ${issued ? `<div class="row"><span class="label">Date Issued</span><span class="value">${issued}</span></div>` : ""}
      ${expiry ? `<div class="row"><span class="label">Valid Until / Expiry</span><span class="value" style="color:${new Date(doc.expiry_date) < new Date() ? "#ef4444" : "#10b981"}">${expiry}</span></div>` : ""}
      ${doc.notes ? `<div class="row"><span class="label">Notes</span><span class="value">${doc.notes}</span></div>` : ""}
    </div>

    <div class="section">
      <div class="section-title">Property / Job Details</div>
      <div class="row"><span class="label">Customer</span><span class="value">${job?.customer || ""}</span></div>
      ${job?.address ? `<div class="row"><span class="label">Address</span><span class="value">${job.address}</span></div>` : ""}
      <div class="row"><span class="label">Job</span><span class="value">${job?.title || job?.type || ""}</span></div>
    </div>

    <div class="section">
      <div class="section-title">Issued By</div>
      <div class="row"><span class="label">Company</span><span class="value">${brand.tradingName || ""}</span></div>
      ${brand.gasSafeNumber ? `<div class="row"><span class="label">Gas Safe Reg.</span><span class="value">${brand.gasSafeNumber}</span></div>` : ""}
      ${brand.utrNumber ? `<div class="row"><span class="label">UTR</span><span class="value">${brand.utrNumber}</span></div>` : ""}
    </div>

    <div class="footer">${brand.tradingName} · ${brand.phone || ""} · ${brand.email || ""}<br>This certificate was issued on ${issued || "—"}</div>
  </body></html>`;
}

function printComplianceDoc(doc, job, brand) {
  const html = buildComplianceDocHTML(doc, job, brand);
  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  win.onload = () => win.print();
}

async function emailComplianceDoc(doc, job, customers, user, connection, brand) {
  if (!connection) { alert("No email account connected. Go to the Inbox tab to connect Gmail or Outlook."); return; }
  const customer = (customers || []).find(c => c.name?.toLowerCase() === job?.customer?.toLowerCase());
  let toEmail = customer?.email || "";
  if (!toEmail) {
    toEmail = prompt(`Enter email address for ${job?.customer}:`);
    if (!toEmail) return;
  }

  const issued = doc.issued_date ? new Date(doc.issued_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
  const html = buildComplianceDocHTML(doc, job, brand);

  const body = `<p>Dear ${job?.customer || "Customer"},</p>
<p>Please find below your ${doc.doc_type}${doc.doc_number ? ` (Certificate No: ${doc.doc_number})` : ""}${issued ? `, issued ${issued}` : ""}.</p>
<p>If you have any questions regarding this certificate, please don't hesitate to get in touch.</p>
<p>Many thanks,<br>${brand.tradingName || ""}${brand.phone ? `<br>${brand.phone}` : ""}${brand.email ? `<br>${brand.email}` : ""}</p>
<hr style="margin:24px 0;border:none;border-top:1px solid #eee">
${html.replace(/<!DOCTYPE.*?<body>/s, "").replace(/<\/body>.*$/s, "")}`;

  const endpoint = connection.provider === "outlook" ? "/api/outlook/send" : "/api/gmail/send";
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, to: toEmail, subject: `${doc.doc_type}${doc.doc_number ? ` — ${doc.doc_number}` : ""} — ${brand.tradingName}`, body }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    alert(`✓ Certificate sent to ${toEmail}`);
  } catch (err) {
    alert(`Failed to send: ${err.message}`);
  }
}

// ─── Signature Pad ────────────────────────────────────────────────────────────
function SignaturePad({ onSave, onCancel, title = "Customer Signature" }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSig, setHasSig] = useState(false);
  const lastPos = useRef(null);

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function startDraw(e) {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    lastPos.current = pos;
    setIsDrawing(true);
    setHasSig(true);
  }

  function draw(e) {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  }

  function endDraw(e) { e.preventDefault(); setIsDrawing(false); }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSig(false);
  }

  function save() {
    const canvas = canvasRef.current;
    const data = canvas.toDataURL("image/png");
    onSave(data);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000d", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: 16, fontFamily: "'DM Mono',monospace" }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 20, maxWidth: 380, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>{title}</div>
          <button onClick={onCancel} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#999" }}>×</button>
        </div>
        <div style={{ fontSize: 11, color: "#999", marginBottom: 8 }}>Sign in the box below</div>
        <div style={{ border: "2px solid #e5e5e5", borderRadius: 8, overflow: "hidden", touchAction: "none", background: "#fafafa" }}>
          <canvas
            ref={canvasRef}
            width={560} height={200}
            style={{ width: "100%", height: 120, display: "block", cursor: "crosshair" }}
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
          />
        </div>
        <div style={{ borderTop: "1px dashed #ccc", marginTop: 0, marginBottom: 12, marginLeft: 16, marginRight: 16 }} />
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={clear} style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #e5e5e5", background: "#fff", color: "#666", cursor: "pointer", fontSize: 11, fontFamily: "'DM Mono',monospace" }}>Clear</button>
          <button onClick={save} disabled={!hasSig} style={{ flex: 1, padding: "10px", borderRadius: 6, border: "none", background: hasSig ? "#10b981" : "#e5e5e5", color: hasSig ? "#fff" : "#999", cursor: hasSig ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 12, fontFamily: "'DM Mono',monospace" }}>
            ✓ Confirm Signature
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Trade Certificates ───────────────────────────────────────────────────────
const CERT_CATEGORIES = [
  {
    category: "Gas",
    icon: "🔥",
    certs: [
      { id: "cp12", label: "CP12 — Landlord Gas Safety Record", short: "CP12" },
      { id: "smr", label: "Service & Maintenance Record", short: "SMR" },
      { id: "pad17", label: "Commissioning Record (Pad 17)", short: "Pad 17" },
      { id: "gas_warning", label: "Gas Warning/Advice Notice", short: "Warning" },
    ],
  },
  {
    category: "Electrical",
    icon: "⚡",
    certs: [
      { id: "eicr", label: "EICR — Electrical Installation Condition Report", short: "EICR" },
      { id: "eic", label: "EIC — Electrical Installation Certificate", short: "EIC" },
      { id: "meic", label: "MEIC — Minor Electrical Works Certificate", short: "MEIC" },
      { id: "pat", label: "PAT Testing Record", short: "PAT" },
      { id: "fire_alarm_design", label: "Fire Alarm — Design, Installation & Commissioning", short: "FA Install" },
      { id: "fire_alarm_periodic", label: "Fire Alarm — Periodic Inspection Certificate", short: "FA Periodic" },
      { id: "em_lighting_install", label: "Emergency Lighting — Installation Certificate", short: "EL Install" },
      { id: "em_lighting_periodic", label: "Emergency Lighting — Periodic Inspection", short: "EL Periodic" },
    ],
  },
  {
    category: "Plumbing & Heating",
    icon: "🔧",
    certs: [
      { id: "pressure_test", label: "Pressure Test Certificate", short: "Pressure" },
      { id: "unvented_hw", label: "Unvented Hot Water Commissioning", short: "UHW" },
    ],
  },
  {
    category: "Oil",
    icon: "🛢",
    certs: [
      { id: "cd11", label: "CD/11 — Oil Installation Commissioning", short: "CD/11" },
      { id: "cd12", label: "CD/12 — Oil Safety Certificate", short: "CD/12" },
    ],
  },
  {
    category: "General",
    icon: "📋",
    certs: [
      { id: "part_p", label: "Part P Building Regulations Certificate", short: "Part P" },
      { id: "custom", label: "Custom Certificate", short: "Custom" },
    ],
  },
];

// Flatten for easy lookup
const TRADE_CERT_LIST = CERT_CATEGORIES.flatMap(cat => cat.certs);

function buildCertHTML(cert, brand, job, sig) {
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const accentColor = {
    cp12: "#f59e0b", smr: "#f59e0b", pad17: "#f59e0b", gas_warning: "#ef4444",
    eicr: "#3b82f6", eic: "#3b82f6", meic: "#3b82f6", pat: "#3b82f6",
    pressure_test: "#10b981", unvented_hw: "#10b981",
    cd11: "#8b5cf6", cd12: "#8b5cf6",
    part_p: "#6b7280", custom: "#6b7280",
  }[cert.id] || "#f59e0b";

  const regLine = cert.id.startsWith("cp12") || cert.id === "smr" || cert.id === "pad17" || cert.id === "gas_warning"
    ? (brand.gasSafeNumber ? `Gas Safe Reg: <strong>${brand.gasSafeNumber}</strong>` : "<span style=\"color:#c0392b\">⚠ Gas Safe number not set — add in Settings</span>")
    : cert.id === "eicr" || cert.id === "eic" || cert.id === "meic" || cert.id === "pat"
    ? (brand.niceicNumber ? `NICEIC No: <strong>${brand.niceicNumber}</strong>`
       : brand.napitNumber ? `NAPIT No: <strong>${brand.napitNumber}</strong>`
       : brand.elecsaNumber ? `ELECSA No: <strong>${brand.elecsaNumber}</strong>`
       : "<span style=\"color:#c0392b\">⚠ Electrical scheme number not set — add in Settings</span>")
    : cert.id === "oil_service" || cert.id === "oil_warning"
    ? (brand.oftecNumber ? `OFTEC No: <strong>${brand.oftecNumber}</strong>` : "<span style=\"color:#c0392b\">⚠ OFTEC number not set — add in Settings</span>")
    : cert.id === "cd11" || cert.id === "cd12"
    ? (brand.hetasNumber ? `HETAS No: <strong>${brand.hetasNumber}</strong>` : "<span style=\"color:#c0392b\">⚠ HETAS number not set — add in Settings</span>")
    : cert.id === "unvented_hw" || cert.id === "pressure_test"
    ? (brand.aphcNumber ? `APHC/WaterSafe No: <strong>${brand.aphcNumber}</strong>` : "")
    : cert.id === "fgas"
    ? (brand.fgasNumber ? `F-Gas Cert No: <strong>${brand.fgasNumber}</strong>` : "<span style=\"color:#c0392b\">⚠ F-Gas number not set — add in Settings</span>")
    : cert.id === "mcs"
    ? (brand.mcsNumber ? `MCS No: <strong>${brand.mcsNumber}</strong>` : "<span style=\"color:#c0392b\">⚠ MCS number not set — add in Settings</span>")
    : "";

  // Use sequential cert number from brand settings, or fall back to manually entered certNumber
  const isGasCert = cert.id.startsWith("cp12") || cert.id === "smr" || cert.id === "pad17" || cert.id === "gas_warning";
  const certRef = cert.certNumber || (brand.certPrefix && brand.certNextNumber
    ? `${brand.certPrefix}-${String(brand.certNextNumber).padStart(3, "0")}`
    : "");

  const header = `<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:24px;color:#1a1a1a;font-size:13px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${accentColor};padding-bottom:16px;margin-bottom:20px">
      <div style="display:flex;align-items:flex-start;gap:14px">
        ${brand.logo ? `<img src="${brand.logo}" style="width:52px;height:52px;object-fit:contain;border-radius:8px;flex-shrink:0">` : ""}
        <div>
          <div style="font-size:22px;font-weight:700">${brand.tradingName || ""}</div>
          <div style="color:#666;font-size:12px;margin-top:4px">${brand.address || ""}${brand.phone ? ` · ${brand.phone}` : ""}${brand.email ? ` · ${brand.email}` : ""}</div>
          ${regLine ? `<div style="font-size:12px;color:#666;margin-top:2px">${regLine}</div>` : ""}
          ${brand.utrNumber ? `<div style="font-size:12px;color:#666">UTR: ${brand.utrNumber}</div>` : ""}
        </div>
      </div>
      <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        ${isGasCert && brand.gasSafeLogo ? `<img src="${brand.gasSafeLogo}" style="height:36px;object-fit:contain;margin-bottom:4px">` : ""}
        <div style="font-size:18px;font-weight:700;color:${accentColor}">${cert.short}</div>
        <div style="font-size:11px;color:#666">${cert.label}</div>
        <div style="font-size:11px;color:#666">Date: ${today}</div>
        ${certRef ? `<div style="font-size:12px;font-weight:700;color:#1a1a1a;background:#f5f5f5;padding:4px 8px;border-radius:4px;font-family:monospace">Cert No: ${certRef}</div>` : ""}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <div style="background:#f9f9f9;padding:14px;border-radius:8px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px">Property / Client</div>
        <div style="font-weight:600">${cert.customer || job?.customer || ""}</div>
        <div style="color:#666;margin-top:4px">${cert.address || job?.address || ""}</div>
        ${cert.landlord ? `<div style="color:#666;margin-top:4px;font-size:12px">Landlord: ${cert.landlord}</div>` : ""}
      </div>
      <div style="background:#f9f9f9;padding:14px;border-radius:8px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px">Engineer / Contractor</div>
        <div style="font-weight:600">${cert.engineer || brand.tradingName || ""}</div>
        ${regLine ? `<div style="color:#666;margin-top:4px;font-size:12px">${regLine}</div>` : ""}
      </div>
    </div>`;

  // Certificate-specific body
  let body = "";

  // GAS
  if (cert.id === "cp12") {
    body = `<div style="margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:10px">Appliance Inspection</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#f5f5f5">${["Location","Appliance","Make/Model","Flue Type","Safe to Use"].map(h=>`<th style="padding:8px;text-align:left;border:1px solid #e5e5e5">${h}</th>`).join("")}</tr></thead>
        <tbody><tr>${[cert.applianceLocation||"",cert.applianceType||"",cert.makeModel||"",cert.flueType||"Open flued",cert.safeToUse!==false?"Yes ✓":"No ✗"].map(v=>`<td style="padding:8px;border:1px solid #e5e5e5">${v}</td>`).join("")}</tr></tbody>
      </table>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;margin-bottom:16px">
      ${["Gas tightness","Flue flow test","Burner pressure","Safety devices","CO detector","Adequate ventilation"].map(c=>`<div style="background:#f9f9f9;padding:8px 12px;border-radius:4px;display:flex;justify-content:space-between"><span>${c}</span><span style="color:#10b981;font-weight:700">✓</span></div>`).join("")}
    </div>
    ${cert.defects?`<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:12px;margin-bottom:16px"><strong>⚠ Defects/Action Required:</strong> ${cert.defects}</div>`:""}`;
  }

  if (cert.id === "smr") {
    body = `<div style="background:#f9f9f9;padding:14px;border-radius:8px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px">Service Record</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
        ${[["Appliance",cert.applianceType||""],["Make/Model",cert.makeModel||""],["Serial No.",cert.serialNo||""],["Next Service",cert.nextServiceDate||""]].map(([l,v])=>`<div><span style="color:#666">${l}:</span> <strong>${v}</strong></div>`).join("")}
      </div>
      ${cert.serviceNotes?`<div style="margin-top:10px;font-size:12px;color:#444">${cert.serviceNotes}</div>`:""}
    </div>`;
  }

  if (cert.id === "pad17") {
    body = `<div style="background:#f9f9f9;padding:14px;border-radius:8px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px">Commissioning Details</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
        ${[["Appliance",cert.applianceType||""],["Make/Model",cert.makeModel||""],["Serial No.",cert.serialNo||""],["Gas Type","Natural Gas"],["Inlet Pressure",cert.inletPressure||""],["Heat Input",cert.heatInput||""]].map(([l,v])=>`<div><span style="color:#666">${l}:</span> <strong>${v}</strong></div>`).join("")}
      </div>
    </div>`;
  }

  if (cert.id === "gas_warning") {
    body = `<div style="background:#fff3cd;border:2px solid #f59e0b;border-radius:8px;padding:16px;margin-bottom:16px">
      <div style="font-size:13px;font-weight:700;margin-bottom:8px">⚠ Gas Warning/Advice Notice</div>
      <div style="font-size:12px"><strong>Condition Found:</strong> ${cert.warningCondition||""}</div>
      ${cert.warningAction?`<div style="font-size:12px;margin-top:6px"><strong>Action Taken:</strong> ${cert.warningAction}</div>`:""}
      ${cert.warningAdvice?`<div style="font-size:12px;margin-top:6px"><strong>Advice:</strong> ${cert.warningAdvice}</div>`:""}
    </div>`;
  }

  // ELECTRICAL
  if (cert.id === "eicr") {
    body = `<div style="background:#f9f9f9;padding:14px;border-radius:8px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px">EICR Details</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
        ${[["Overall Result",cert.eicrResult||"Satisfactory"],["Number of Circuits",cert.numCircuits||""],["Earthing Arrangement",cert.earthing||"TN-C-S (PME)"],["Next Inspection Due",cert.nextInspection||""],["Max Demand",cert.maxDemand||""],["Supply Voltage",cert.supplyVoltage||"230V"]].map(([l,v])=>`<div><span style="color:#666">${l}:</span> <strong style="color:${l==="Overall Result"?(v==="Satisfactory"?"#10b981":"#ef4444"):"inherit"}">${v}</strong></div>`).join("")}
      </div>
      ${cert.observations?`<div style="margin-top:12px"><strong style="font-size:12px">Observations / Codes:</strong><div style="font-size:12px;color:#444;margin-top:4px">${cert.observations}</div></div>`:""}
    </div>`;
  }

  if (cert.id === "eic") {
    body = `<div style="background:#f9f9f9;padding:14px;border-radius:8px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px">Installation Details</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
        ${[["Description of Work",cert.workDescription||""],["Number of Circuits",cert.numCircuits||""],["Earthing",cert.earthing||"TN-C-S (PME)"],["Supply Voltage","230V"],["Test Method",cert.testMethod||""],["Overall Result","Satisfactory ✓"]].map(([l,v])=>`<div><span style="color:#666">${l}:</span> <strong>${v}</strong></div>`).join("")}
      </div>
    </div>`;
  }

  if (cert.id === "meic") {
    body = `<div style="background:#f9f9f9;padding:14px;border-radius:8px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px">Minor Works Details</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
        ${[["Description",cert.workDescription||""],["Location",cert.workLocation||""],["Circuit Details",cert.circuitDetails||""],["Test Results","Satisfactory ✓"]].map(([l,v])=>`<div><span style="color:#666">${l}:</span> <strong>${v}</strong></div>`).join("")}
      </div>
    </div>`;
  }

  if (cert.id === "pat") {
    body = `<div style="background:#f9f9f9;padding:14px;border-radius:8px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px">PAT Testing Summary</div>
      <div style="font-size:12px"><strong>Total Items Tested:</strong> ${cert.totalItems||""}</div>
      <div style="font-size:12px;margin-top:4px"><strong>Pass:</strong> ${cert.itemsPass||""} &nbsp; <strong>Fail:</strong> ${cert.itemsFail||"0"}</div>
      ${cert.patNotes?`<div style="margin-top:8px;font-size:12px;color:#444">${cert.patNotes}</div>`:""}
    </div>`;
  }

  // PLUMBING
  if (cert.id === "pressure_test") {
    body = `<div style="background:#f9f9f9;padding:14px;border-radius:8px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px">Pressure Test Results</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
        ${[["System",cert.systemType||""],["Test Pressure",cert.testPressure||""],["Duration",cert.testDuration||""],["Final Reading",cert.finalReading||""],["Pass/Fail",cert.pressureResult||"Pass ✓"]].map(([l,v])=>`<div><span style="color:#666">${l}:</span> <strong>${v}</strong></div>`).join("")}
      </div>
    </div>`;
  }

  if (cert.id === "unvented_hw") {
    body = `<div style="background:#f9f9f9;padding:14px;border-radius:8px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px">Unvented Hot Water System</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
        ${[["Cylinder Make/Model",cert.makeModel||""],["Serial No.",cert.serialNo||""],["Capacity",cert.capacity||""],["Max Working Pressure",cert.maxPressure||""],["Temperature Setting",cert.tempSetting||"60°C"],["Commissioned By",brand.tradingName||""]].map(([l,v])=>`<div><span style="color:#666">${l}:</span> <strong>${v}</strong></div>`).join("")}
      </div>
    </div>`;
  }

  // OIL
  if (cert.id === "cd11" || cert.id === "cd12") {
    body = `<div style="background:#f9f9f9;padding:14px;border-radius:8px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px">${cert.id === "cd11" ? "Oil Installation Commissioning" : "Oil Safety Assessment"}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
        ${[["Appliance",cert.applianceType||""],["Make/Model",cert.makeModel||""],["Serial No.",cert.serialNo||""],["Oil Type",cert.oilType||"Kerosene 28s"],["Result",cert.oilResult||"Satisfactory ✓"]].map(([l,v])=>`<div><span style="color:#666">${l}:</span> <strong>${v}</strong></div>`).join("")}
      </div>
    </div>`;
  }

  // GENERAL
  if (cert.id === "part_p") {
    body = `<div style="background:#f9f9f9;padding:14px;border-radius:8px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px">Part P Notification</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
        ${[["Work Description",cert.workDescription||""],["Location",cert.workLocation||""],["Notification No.",cert.notificationNo||""],["Building Control",cert.buildingControl||""]].map(([l,v])=>`<div><span style="color:#666">${l}:</span> <strong>${v}</strong></div>`).join("")}
      </div>
    </div>`;
  }

  if (cert.id === "fire_alarm_design" || cert.id === "fire_alarm_periodic") {
    const isPeriodic = cert.id === "fire_alarm_periodic";
    body = `<div style="background:#f9f9f9;padding:14px;border-radius:8px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px">${isPeriodic ? "Periodic Inspection Details" : "Installation Details"}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
        ${[["System Grade",cert.systemGrade||""],["Category",cert.category||""],["Number of Detectors",cert.numDetectors||""],["Number of Sounders",cert.numSounders||""],["Panel Make/Model",cert.makeModel||""],["Overall Result",cert.eicrResult||"Satisfactory ✓"]].map(([l,v])=>`<div><span style="color:#666">${l}:</span> <strong style="color:${l==="Overall Result"&&v.includes("Unsat")?"#ef4444":"inherit"}">${v}</strong></div>`).join("")}
      </div>
      ${cert.serviceNotes?`<div style="margin-top:10px;font-size:12px;color:#444">${cert.serviceNotes}</div>`:""}
    </div>`;
  }

  if (cert.id === "em_lighting_install" || cert.id === "em_lighting_periodic") {
    const isPeriodic = cert.id === "em_lighting_periodic";
    body = `<div style="background:#f9f9f9;padding:14px;border-radius:8px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px">${isPeriodic ? "Periodic Inspection Details" : "Installation Details"}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
        ${[["Number of Luminaires",cert.numLuminaires||""],["System Category",cert.emCategory||""],["Duration Test (hrs)",cert.durationTest||"3"],["Battery Type",cert.batteryType||""],["Overall Result",cert.eicrResult||"Satisfactory ✓"]].map(([l,v])=>`<div><span style="color:#666">${l}:</span> <strong>${v}</strong></div>`).join("")}
      </div>
      ${cert.serviceNotes?`<div style="margin-top:10px;font-size:12px;color:#444">${cert.serviceNotes}</div>`:""}
    </div>`;
  }

  if (cert.id === "custom") {
    body = `<div style="background:#f9f9f9;padding:14px;border-radius:8px;margin-bottom:16px">
      <div style="font-size:12px;white-space:pre-wrap">${cert.customBody||""}</div>
    </div>`;
  }

  const sigSection = sig ? `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:24px;padding-top:16px;border-top:1px solid #e5e5e5">
      <div><div style="font-size:11px;color:#999;margin-bottom:8px">ENGINEER / CONTRACTOR</div>
        <img src="${sig}" style="height:50px;border-bottom:1px solid #333;padding-bottom:4px" alt="sig"/>
        <div style="font-size:11px;color:#666;margin-top:4px">${brand.tradingName||""} — ${today}</div>
      </div>
      <div><div style="font-size:11px;color:#999;margin-bottom:8px">CLIENT SIGNATURE</div>
        <div style="height:50px;border-bottom:1px solid #333;margin-bottom:4px"></div>
        <div style="font-size:11px;color:#666">Print name: ______________________</div>
      </div>
    </div>` : `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:24px;padding-top:16px;border-top:1px solid #e5e5e5">
      <div><div style="font-size:11px;color:#999;margin-bottom:4px">ENGINEER</div><div style="height:50px;border-bottom:1px solid #333"></div></div>
      <div><div style="font-size:11px;color:#999;margin-bottom:4px">CLIENT</div><div style="height:50px;border-bottom:1px solid #333"></div></div>
    </div>`;

  return header + body + sigSection + `<div style="margin-top:16px;font-size:10px;color:#999;text-align:center">${brand.tradingName} · ${brand.phone||""} · Issued ${today}</div></div>`;
}

// ─── Certificates Tab (all trades) ────────────────────────────────────────────
function CertificatesTab({ job, brand, customers, user, connection }) {
  const [certs, setCerts] = useState([]);
  const [showForm, setShowForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showSig, setShowSig] = useState(false);
  const [pendingSig, setPendingSig] = useState(null);
  const [expandedCat, setExpandedCat] = useState("Gas");
  const [form, setForm] = useState({
    customer: job?.customer || "", address: job?.address || "", engineer: brand?.tradingName || "",
    landlord: "", certNumber: "", niceicNumber: "",
    applianceType: "", applianceLocation: "", makeModel: "", serialNo: "",
    flueType: "Open flued", safeToUse: true, defects: "", serviceNotes: "", nextServiceDate: "",
    warningCondition: "", warningAction: "", warningAdvice: "",
    inletPressure: "", heatInput: "",
    eicrResult: "Satisfactory", numCircuits: "", earthing: "TN-C-S (PME)", nextInspection: "",
    maxDemand: "", supplyVoltage: "230V", observations: "",
    workDescription: "", workLocation: "", circuitDetails: "", testMethod: "",
    totalItems: "", itemsPass: "", itemsFail: "0", patNotes: "",
    systemType: "", testPressure: "", testDuration: "", finalReading: "", pressureResult: "Pass",
    capacity: "", maxPressure: "", tempSetting: "60°C",
    oilType: "Kerosene 28s", oilResult: "Satisfactory",
    notificationNo: "", buildingControl: "", customBody: "",
  });

  useEffect(() => { loadCerts(); }, [job?.id]);
  useEffect(() => { setForm(f => ({ ...f, customer: job?.customer || "", address: job?.address || "", engineer: brand?.tradingName || "" })); }, [job, brand]);

  async function loadCerts() {
    if (!user || !job?.id) return;
    const { data } = await supabase.from("trade_certificates").select("*").eq("job_id", job.id).order("created_at", { ascending: false });
    setCerts(data || []);
  }

  async function saveCert(sigData) {
    if (!showForm) return;
    setSaving(true);
    const certType = TRADE_CERT_LIST.find(c => c.id === showForm);
    // Assign sequential certificate number from brand settings
    const certNum = brand.certPrefix && brand.certNextNumber
      ? `${brand.certPrefix}-${String(brand.certNextNumber).padStart(3, "0")}`
      : "";
    const certData = { ...form, id: showForm, label: certType?.label || "", short: certType?.short || "", signature: sigData, certNumber: certNum };
    const html = buildCertHTML(certData, brand, job, sigData);
    const { data } = await supabase.from("trade_certificates").insert({ job_id: job.id, user_id: user.id, cert_type: showForm, cert_label: certType?.label || "", cert_data: certData, html_content: html, signature: sigData || null, created_at: new Date().toISOString() }).select().single();
    if (data) {
      setCerts(prev => [data, ...prev]);
      // Auto-increment the certificate counter in brand settings
      if (certNum) setBrand(b => ({ ...b, certNextNumber: (b.certNextNumber || 1) + 1 }));
    }
    setShowForm(null);
    setSaving(false);
  }

  async function emailCert(cert) {
    if (!connection) { alert("No email connected. Go to Inbox to connect Gmail or Outlook."); return; }
    const customer = (customers || []).find(c => c.name?.toLowerCase() === job?.customer?.toLowerCase());
    let toEmail = customer?.email || "";
    if (!toEmail) { toEmail = prompt(`Email address for ${job?.customer}:`); if (!toEmail) return; }
    const endpoint = connection.provider === "outlook" ? "/api/outlook/send" : "/api/gmail/send";
    const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id, to: toEmail, subject: `${cert.cert_label} — ${brand.tradingName}`, body: `<p>Dear ${job?.customer},</p><p>Please find your ${cert.cert_label} below.</p>${cert.html_content}<p>Many thanks,<br>${brand.tradingName}</p>` }) });
    const d = await res.json();
    if (d.error) alert(`Failed: ${d.error}`); else alert(`✓ Certificate sent to ${toEmail}`);
  }

  const setF = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  // Cert-specific form fields
  function CertFormFields({ id }) {
    const gas = ["cp12","smr","pad17","gas_warning"].includes(id);
    const elec = ["eicr","eic","meic","pat"].includes(id);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div><label style={S.label}>Customer Name</label><input style={S.input} value={form.customer} onChange={setF("customer")} /></div>
          <div><label style={S.label}>Property Address</label><input style={S.input} value={form.address} onChange={setF("address")} /></div>
          <div><label style={S.label}>Certificate No.</label><input style={S.input} placeholder="e.g. GS-2024-001" value={form.certNumber} onChange={setF("certNumber")} /></div>
          {id === "cp12" && <div><label style={S.label}>Landlord Name</label><input style={S.input} value={form.landlord} onChange={setF("landlord")} /></div>}
          {elec && (
            <div>
              <label style={S.label}>Electrical Scheme No.</label>
              <div style={{ ...S.input, background: C.surfaceHigh, color: brand.niceicNumber || brand.napitNumber || brand.elecsaNumber ? C.green : C.amber, cursor: "default", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {brand.niceicNumber ? `NICEIC: ${brand.niceicNumber}`
                  : brand.napitNumber ? `NAPIT: ${brand.napitNumber}`
                  : brand.elecsaNumber ? `ELECSA: ${brand.elecsaNumber}`
                  : "⚠ Not set — add in Settings"}
                <span style={{ fontSize: 10, color: C.muted }}>from Settings</span>
              </div>
            </div>
          )}
          {(id === "oil_service" || id === "oil_warning") && (
            <div>
              <label style={S.label}>OFTEC No.</label>
              <div style={{ ...S.input, background: C.surfaceHigh, color: brand.oftecNumber ? C.green : C.amber, cursor: "default", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {brand.oftecNumber || "⚠ Not set — add in Settings"}
                <span style={{ fontSize: 10, color: C.muted }}>from Settings</span>
              </div>
            </div>
          )}
          {(id === "cd11" || id === "cd12") && (
            <div>
              <label style={S.label}>HETAS No.</label>
              <div style={{ ...S.input, background: C.surfaceHigh, color: brand.hetasNumber ? C.green : C.amber, cursor: "default", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {brand.hetasNumber || "⚠ Not set — add in Settings"}
                <span style={{ fontSize: 10, color: C.muted }}>from Settings</span>
              </div>
            </div>
          )}
          {id === "cp12" && (
            <div>
              <label style={S.label}>Gas Safe No.</label>
              <div style={{ ...S.input, background: C.surfaceHigh, color: brand.gasSafeNumber ? C.green : C.amber, cursor: "default", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {brand.gasSafeNumber || "⚠ Not set — add in Settings"}
                <span style={{ fontSize: 10, color: C.muted }}>from Settings</span>
              </div>
            </div>
          )}
        </div>

        {gas && id !== "gas_warning" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><label style={S.label}>Appliance Type</label><input style={S.input} placeholder="e.g. Boiler, Gas Fire" value={form.applianceType} onChange={setF("applianceType")} /></div>
            <div><label style={S.label}>Make / Model</label><input style={S.input} value={form.makeModel} onChange={setF("makeModel")} /></div>
            {["smr","pad17"].includes(id) && <div><label style={S.label}>Serial No.</label><input style={S.input} value={form.serialNo} onChange={setF("serialNo")} /></div>}
            {id === "cp12" && <div><label style={S.label}>Location</label><input style={S.input} placeholder="e.g. Kitchen" value={form.applianceLocation} onChange={setF("applianceLocation")} /></div>}
            {id === "cp12" && <div><label style={S.label}>Flue Type</label><select style={S.input} value={form.flueType} onChange={setF("flueType")}>{["Open flued","Room sealed","Balanced flue","Fan flue","Flueless"].map(f=><option key={f}>{f}</option>)}</select></div>}
            {id === "pad17" && <><div><label style={S.label}>Inlet Pressure</label><input style={S.input} placeholder="mbar" value={form.inletPressure} onChange={setF("inletPressure")} /></div><div><label style={S.label}>Heat Input</label><input style={S.input} placeholder="kW" value={form.heatInput} onChange={setF("heatInput")} /></div></>}
            {id === "smr" && <div><label style={S.label}>Next Service Due</label><input type="date" style={S.input} value={form.nextServiceDate} onChange={setF("nextServiceDate")} /></div>}
          </div>
        )}
        {id === "smr" && <div><label style={S.label}>Service Notes</label><textarea style={{ ...S.input, minHeight: 60, resize: "none" }} value={form.serviceNotes} onChange={setF("serviceNotes")} /></div>}
        {id === "cp12" && <div><label style={S.label}>Defects / Remedial Action</label><textarea style={{ ...S.input, minHeight: 60, resize: "none" }} placeholder="None found, or describe issues..." value={form.defects} onChange={setF("defects")} /></div>}
        {id === "gas_warning" && (
          <>
            <div><label style={S.label}>Condition Found</label><textarea style={{ ...S.input, minHeight: 60, resize: "none" }} value={form.warningCondition} onChange={setF("warningCondition")} /></div>
            <div><label style={S.label}>Action Taken</label><input style={S.input} value={form.warningAction} onChange={setF("warningAction")} /></div>
            <div><label style={S.label}>Advice Given</label><input style={S.input} value={form.warningAdvice} onChange={setF("warningAdvice")} /></div>
          </>
        )}
        {id === "eicr" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><label style={S.label}>Overall Result</label><select style={S.input} value={form.eicrResult} onChange={setF("eicrResult")}><option>Satisfactory</option><option>Unsatisfactory</option></select></div>
            <div><label style={S.label}>No. of Circuits</label><input style={S.input} value={form.numCircuits} onChange={setF("numCircuits")} /></div>
            <div><label style={S.label}>Earthing</label><input style={S.input} value={form.earthing} onChange={setF("earthing")} /></div>
            <div><label style={S.label}>Next Inspection Due</label><input type="date" style={S.input} value={form.nextInspection} onChange={setF("nextInspection")} /></div>
            <div style={{ gridColumn: "1/-1" }}><label style={S.label}>Observations / Codes</label><textarea style={{ ...S.input, minHeight: 60, resize: "none" }} placeholder="e.g. C1: Danger present..." value={form.observations} onChange={setF("observations")} /></div>
          </div>
        )}
        {(id === "eic" || id === "meic") && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div style={{ gridColumn: "1/-1" }}><label style={S.label}>Description of Work</label><input style={S.input} value={form.workDescription} onChange={setF("workDescription")} /></div>
            <div><label style={S.label}>Location</label><input style={S.input} value={form.workLocation} onChange={setF("workLocation")} /></div>
            {id === "eic" && <><div><label style={S.label}>No. of Circuits</label><input style={S.input} value={form.numCircuits} onChange={setF("numCircuits")} /></div><div><label style={S.label}>Earthing</label><input style={S.input} value={form.earthing} onChange={setF("earthing")} /></div></>}
            {id === "meic" && <div><label style={S.label}>Circuit Details</label><input style={S.input} value={form.circuitDetails} onChange={setF("circuitDetails")} /></div>}
          </div>
        )}
        {id === "pat" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><label style={S.label}>Total Items Tested</label><input type="number" style={S.input} value={form.totalItems} onChange={setF("totalItems")} /></div>
            <div><label style={S.label}>Items Passed</label><input type="number" style={S.input} value={form.itemsPass} onChange={setF("itemsPass")} /></div>
            <div><label style={S.label}>Items Failed</label><input type="number" style={S.input} value={form.itemsFail} onChange={setF("itemsFail")} /></div>
            <div style={{ gridColumn: "1/-1" }}><label style={S.label}>Notes</label><textarea style={{ ...S.input, minHeight: 60, resize: "none" }} value={form.patNotes} onChange={setF("patNotes")} /></div>
          </div>
        )}
        {id === "pressure_test" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><label style={S.label}>System</label><input style={S.input} placeholder="e.g. CH, DHW" value={form.systemType} onChange={setF("systemType")} /></div>
            <div><label style={S.label}>Test Pressure (bar)</label><input style={S.input} value={form.testPressure} onChange={setF("testPressure")} /></div>
            <div><label style={S.label}>Duration (mins)</label><input style={S.input} value={form.testDuration} onChange={setF("testDuration")} /></div>
            <div><label style={S.label}>Final Reading (bar)</label><input style={S.input} value={form.finalReading} onChange={setF("finalReading")} /></div>
          </div>
        )}
        {id === "unvented_hw" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><label style={S.label}>Cylinder Make/Model</label><input style={S.input} value={form.makeModel} onChange={setF("makeModel")} /></div>
            <div><label style={S.label}>Serial No.</label><input style={S.input} value={form.serialNo} onChange={setF("serialNo")} /></div>
            <div><label style={S.label}>Capacity (litres)</label><input style={S.input} value={form.capacity} onChange={setF("capacity")} /></div>
            <div><label style={S.label}>Max Working Pressure</label><input style={S.input} value={form.maxPressure} onChange={setF("maxPressure")} /></div>
            <div><label style={S.label}>Temp Setting</label><input style={S.input} value={form.tempSetting} onChange={setF("tempSetting")} /></div>
          </div>
        )}
        {(id === "cd11" || id === "cd12") && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><label style={S.label}>Appliance</label><input style={S.input} value={form.applianceType} onChange={setF("applianceType")} /></div>
            <div><label style={S.label}>Make/Model</label><input style={S.input} value={form.makeModel} onChange={setF("makeModel")} /></div>
            <div><label style={S.label}>Serial No.</label><input style={S.input} value={form.serialNo} onChange={setF("serialNo")} /></div>
            <div><label style={S.label}>Oil Type</label><select style={S.input} value={form.oilType} onChange={setF("oilType")}><option>Kerosene 28s</option><option>Gas Oil 35s</option></select></div>
          </div>
        )}
        {id === "part_p" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div style={{ gridColumn: "1/-1" }}><label style={S.label}>Description of Work</label><input style={S.input} value={form.workDescription} onChange={setF("workDescription")} /></div>
            <div><label style={S.label}>Notification No.</label><input style={S.input} value={form.notificationNo} onChange={setF("notificationNo")} /></div>
            <div><label style={S.label}>Building Control</label><input style={S.input} value={form.buildingControl} onChange={setF("buildingControl")} /></div>
          </div>
        )}
        {(id === "fire_alarm_design" || id === "fire_alarm_periodic") && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><label style={S.label}>System Grade</label><select style={S.input} value={form.systemGrade} onChange={setF("systemGrade")}>{["Grade A","Grade B","Grade C","Grade D","Grade E","Grade F"].map(g=><option key={g}>{g}</option>)}</select></div>
            <div><label style={S.label}>Category</label><input style={S.input} placeholder="e.g. L1, M, P1" value={form.category} onChange={setF("category")} /></div>
            <div><label style={S.label}>No. of Detectors</label><input type="number" style={S.input} value={form.numDetectors} onChange={setF("numDetectors")} /></div>
            <div><label style={S.label}>No. of Sounders</label><input type="number" style={S.input} value={form.numSounders} onChange={setF("numSounders")} /></div>
            <div><label style={S.label}>Panel Make/Model</label><input style={S.input} value={form.makeModel} onChange={setF("makeModel")} /></div>
            <div><label style={S.label}>Result</label><select style={S.input} value={form.eicrResult} onChange={setF("eicrResult")}><option>Satisfactory ✓</option><option>Unsatisfactory</option></select></div>
            <div style={{ gridColumn: "1/-1" }}><label style={S.label}>Notes</label><textarea style={{ ...S.input, minHeight: 60, resize: "none" }} value={form.serviceNotes} onChange={setF("serviceNotes")} /></div>
          </div>
        )}
        {(id === "em_lighting_install" || id === "em_lighting_periodic") && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><label style={S.label}>No. of Luminaires</label><input type="number" style={S.input} value={form.numLuminaires} onChange={setF("numLuminaires")} /></div>
            <div><label style={S.label}>Category</label><input style={S.input} placeholder="e.g. Maintained, Non-maintained" value={form.emCategory} onChange={setF("emCategory")} /></div>
            <div><label style={S.label}>Duration Test (hrs)</label><input style={S.input} value={form.durationTest} onChange={setF("durationTest")} /></div>
            <div><label style={S.label}>Battery Type</label><input style={S.input} placeholder="e.g. NiCd, LiFePO4" value={form.batteryType} onChange={setF("batteryType")} /></div>
            <div><label style={S.label}>Result</label><select style={S.input} value={form.eicrResult} onChange={setF("eicrResult")}><option>Satisfactory ✓</option><option>Unsatisfactory</option></select></div>
            <div style={{ gridColumn: "1/-1" }}><label style={S.label}>Notes</label><textarea style={{ ...S.input, minHeight: 60, resize: "none" }} value={form.serviceNotes} onChange={setF("serviceNotes")} /></div>
          </div>
        )}
        {id === "custom" && (
          <>
            <div><label style={S.label}>Certificate Title</label><input style={S.input} placeholder="e.g. Scope of Works Certificate" value={form.certTitle} onChange={setF("certTitle")} /></div>
            <div><label style={S.label}>Body Text</label><textarea style={{ ...S.input, minHeight: 100, resize: "vertical" }} placeholder="Describe the work, findings, results..." value={form.customBody} onChange={setF("customBody")} /></div>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      {!showForm && (
        <div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
            Create professional trade certificates pre-filled with job details. Capture signatures on-screen and email directly to the customer.
          </div>

          {/* Category accordion */}
          {CERT_CATEGORIES.map(cat => (
            <div key={cat.category} style={{ marginBottom: 8 }}>
              <button onClick={() => setExpandedCat(expandedCat === cat.category ? null : cat.category)}
                style={{ ...S.btn("ghost"), width: "100%", justifyContent: "space-between", padding: "10px 14px" }}>
                <span style={{ fontWeight: 700 }}>{cat.icon} {cat.category}</span>
                <span style={{ color: C.muted }}>{expandedCat === cat.category ? "▲" : "▼"}</span>
              </button>
              {expandedCat === cat.category && (
                <div style={{ background: C.surfaceHigh, borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
                  {cat.certs.map((c, i) => (
                    <button key={c.id} onClick={() => setShowForm(c.id)}
                      style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "transparent", border: "none", borderTop: i > 0 ? `1px solid ${C.border}` : "none", cursor: "pointer", fontFamily: "'DM Mono',monospace", fontSize: 12, color: C.text }}>
                      <span>{c.label}</span>
                      <span style={{ color: C.amber, fontWeight: 700, fontSize: 11 }}>Create →</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Issued certs */}
          {certs.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={S.sectionTitle}>Issued Certificates ({certs.length})</div>
              {certs.map(cert => (
                <div key={cert.id} style={{ background: C.surfaceHigh, borderRadius: 8, padding: "12px 14px", marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{cert.cert_label}</div>
                      {cert.cert_data?.certNumber && (
                        <div style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: C.amber, marginTop: 2 }}>{cert.cert_data.certNumber}</div>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: C.muted }}>{new Date(cert.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>
                  </div>
                  {cert.signature && <div style={{ fontSize: 11, color: C.green, marginBottom: 6 }}>✓ Signed</div>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px" }} onClick={() => { const w = window.open("","_blank"); w.document.write(cert.html_content); w.document.close(); }}>⬇ View/Print</button>
                    <button style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px", color: C.blue }} onClick={() => emailCert(cert)}>✉ Email</button>
                    {!cert.signature && <button style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px", color: C.green }} onClick={() => { setPendingSig(cert); setShowSig(true); }}>✍ Sign</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Certificate form */}
      {showForm && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => setShowForm(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 20, padding: 0 }}>←</button>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{TRADE_CERT_LIST.find(c => c.id === showForm)?.label}</div>
            </div>
            <VoiceFillButton
              form={form}
              setForm={setForm}
              fieldDescriptions="customer (customer name), address (property address), applianceType (e.g. boiler or gas fire), makeModel (make and model), serialNo (serial number), flueType (flue type), defects (any defects found), serviceNotes (service notes), nextServiceDate (next service date YYYY-MM-DD), eicrResult (Satisfactory or Unsatisfactory), numCircuits (number of circuits), nextInspection (next inspection date YYYY-MM-DD), observations (any observations or codes), workDescription (description of work), totalItems (number of items PAT tested), itemsPass (number passed), testPressure (test pressure in bar), customBody (certificate body text)"
            />
          </div>
          <CertFormFields id={showForm} />
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button style={{ ...S.btn("primary"), flex: 1, justifyContent: "center" }} disabled={saving} onClick={() => { setPendingSig(null); setShowSig(true); }}>✍ Sign & Save</button>
            <button style={S.btn("ghost")} disabled={saving} onClick={() => saveCert(null)}>{saving ? "Saving..." : "Save without signature"}</button>
          </div>
        </div>
      )}

      {showSig && (
        <SignaturePad
          title="Engineer Signature"
          onSave={async (sigData) => {
            setShowSig(false);
            if (pendingSig) {
              const certData = { ...pendingSig.cert_data, signature: sigData };
              const html = buildCertHTML(certData, brand, job, sigData);
              await supabase.from("trade_certificates").update({ signature: sigData, html_content: html }).eq("id", pendingSig.id);
              setCerts(prev => prev.map(c => c.id === pendingSig.id ? { ...c, signature: sigData, html_content: html } : c));
              setPendingSig(null);
            } else {
              await saveCert(sigData);
            }
          }}
          onCancel={() => { setShowSig(false); setPendingSig(null); }}
        />
      )}
    </div>
  );
}

// ─── Jobs Tab ─────────────────────────────────────────────────────────────────
function JobsTab({ user, brand, customers, invoices, setInvoices, setView }) {
  const supabase = window._supabase;
  const [jobs, setJobCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("notes");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", customer: "", address: "", type: "", status: "enquiry", value: "", po_number: "", notes: "", scope_of_work: "", annual_service: false });
  const [drawings, setDrawings] = useState([]);
  const [notes, setNotes] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [timeLogs, setTimeLogs] = useState([]);
  const [vos, setVos] = useState([]);
  const [compDocs, setCompDocs] = useState([]);
  const [daysheets, setDaysheets] = useState([]);
  const [saving, setSaving] = useState(false);
  const [addNote, setAddNote] = useState("");
  const [addTime, setAddTime] = useState({ date: new Date().toISOString().slice(0,10), hours: "", rate: "", description: "" });
  const [addVO, setAddVO] = useState({ vo_number: "", description: "", amount: "" });
  const [addDoc, setAddDoc] = useState({ doc_type: "", doc_number: "", issued_date: "", expiry_date: "", notes: "" });
  const [addDaysheet, setAddDaysheet] = useState({ sheet_date: new Date().toISOString().slice(0,10), worker_name: "", hours: "", rate: "", description: "", contractor_name: "" });
  const [emailConnection, setEmailConnection] = useState(null);
  const [showSignature, setShowSignature] = useState(false);
  const [editingJob, setEditingJob] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [showStagePayments, setShowStagePayments] = useState(false);
  const [stagePaymentStages, setStagePaymentStages] = useState([
    { label: "Deposit", type: "pct", value: "30" },
    { label: "First Fix", type: "pct", value: "40" },
    { label: "Completion", type: "pct", value: "30" },
  ]);
  const [jobCallLogs, setJobCallLogs] = useState([]);
  // Geofencing state
  const [geoState, setGeoState] = useState("idle"); // idle | requesting | travelling | arrived | finished
  const [geoJobId, setGeoJobId] = useState(null);   // which job is active
  const [arrivalTime, setArrivalTime] = useState(null);
  const [geoDistance, setGeoDistance] = useState(null); // metres from job
  const [jobCoords, setJobCoords] = useState(null);     // { lat, lng } of job address
  const geoWatchRef = useRef(null);
  const photoRef = useRef();
  const setF = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  // ── Geofencing helpers ────────────────────────────────────────────────────────
  function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  async function geocodeAddress(address) {
    const key = import.meta.env.VITE_GOOGLE_MAPS_KEY;
    if (!key) return null;
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address + ", UK")}&key=${key}`);
      const data = await res.json();
      if (data.status === "OK" && data.results?.[0]) {
        const loc = data.results[0].geometry.location;
        return { lat: loc.lat, lng: loc.lng };
      }
    } catch {}
    return null;
  }

  async function startGeoTracking(job) {
    if (!job.address) { alert("Add an address to this job before tracking."); return; }
    if (!navigator.geolocation) { alert("Location not supported on this device."); return; }
    setGeoState("requesting");
    setGeoJobId(job.id);
    setArrivalTime(null);
    setGeoDistance(null);
    const coords = await geocodeAddress(job.address);
    setJobCoords(coords);
    setGeoState("travelling");
    if (geoWatchRef.current) navigator.geolocation.clearWatch(geoWatchRef.current);
    geoWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (!coords) return;
        const dist = haversineDistance(pos.coords.latitude, pos.coords.longitude, coords.lat, coords.lng);
        setGeoDistance(Math.round(dist));
        setGeoState(prev => {
          if (prev === "travelling" && dist < 80) {
            setArrivalTime(new Date());
            return "arrived";
          }
          return prev;
        });
      },
      (err) => console.log("Geo:", err.message),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  }

  function stopGeoTracking() {
    if (geoWatchRef.current) { navigator.geolocation.clearWatch(geoWatchRef.current); geoWatchRef.current = null; }
    setGeoState("idle"); setGeoJobId(null); setArrivalTime(null); setGeoDistance(null); setJobCoords(null);
  }

  function markArrived(job) {
    setArrivalTime(new Date());
    setGeoState("arrived");
    // Update job to in_progress
    supabase.from("job_cards").update({ status: "in_progress" }).eq("id", job.id).then(() => {
      setJobCards(prev => prev.map(j => j.id === job.id ? { ...j, status: "in_progress" } : j));
      if (selected?.id === job.id) setSelected(s => ({ ...s, status: "in_progress" }));
    });
  }

  async function finishJob(job) {
    const departure = new Date();
    const arrival = arrivalTime || departure;
    const hours = parseFloat(Math.max((departure - arrival) / 3600000, 0.25).toFixed(2));
    const arrStr = arrival.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const depStr = departure.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    if (job?.id && user?.id) {
      const { data } = await supabase.from("time_logs").insert({
        job_id: job.id, user_id: user.id,
        date: arrival.toISOString().slice(0, 10),
        hours,
        rate: parseFloat(brand?.defaultHourlyRate || 0) || 0,
        description: `On site ${arrStr}–${depStr} · auto-tracked`,
      }).select().single();
      if (data) setTimeLogs(prev => [data, ...prev]);
    }
    stopGeoTracking();
    setGeoState("finished");
    setGeoJobId(job.id);
  }

  useEffect(() => { loadJobs(); loadEmailConn(); }, [user]);
  useEffect(() => () => { if (geoWatchRef.current) navigator.geolocation.clearWatch(geoWatchRef.current); }, []);
  useEffect(() => {
    if (selected) {
      loadJobDetails(selected.id);
      // Load call logs for this job
      if (user?.id) {
        supabase.from("call_logs")
          .select("*")
          .eq("user_id", user.id)
          .ilike("customer_name", selected.customer || "")
          .order("created_at", { ascending: false })
          .then(({ data }) => setJobCallLogs(data || []))
          .catch(() => setJobCallLogs([]));
      }
    }
  }, [selected?.id]);
  useEffect(() => {
    if (!jobs.length || loading) return;
    const today = new Date();
    jobs.forEach(j => {
      if (j.annual_service && j.next_service_date && !j.service_reminder_sent) {
        const due = new Date(j.next_service_date);
        const daysUntil = Math.ceil((due - today) / 86400000);
        if (daysUntil <= 14 && daysUntil >= 0) sendServiceReminder(j);
      }
    });
  }, [jobs, loading]);

  async function loadEmailConn() {
    if (!user) return;
    const { data } = await supabase.from("email_connections").select("provider, email").eq("user_id", user.id);
    if (data?.length) setEmailConnection(data[0]);
  }

  async function loadJobs() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("job_cards").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setJobCards(data || []);
    setLoading(false);
  }

  async function loadJobDetails(jobId) {
    try {
      const [n, p, t, v, d, ds, dr] = await Promise.all([
        supabase.from("job_notes").select("*").eq("job_id", jobId).order("created_at", { ascending: false }),
        supabase.from("job_photos").select("*").eq("job_id", jobId).order("created_at", { ascending: false }),
        supabase.from("time_logs").select("*").eq("job_id", jobId).order("date", { ascending: false }),
        supabase.from("variation_orders").select("*").eq("job_id", jobId).order("created_at", { ascending: false }),
        supabase.from("compliance_docs").select("*").eq("job_id", jobId).order("created_at", { ascending: false }),
        supabase.from("daywork_sheets").select("*").eq("job_id", jobId).order("sheet_date", { ascending: false }),
        supabase.from("job_drawings").select("*").eq("job_id", jobId).order("created_at", { ascending: false }),
      ]);
      setNotes(n.data || []);
      setPhotos(p.data || []);
      setTimeLogs(t.data || []);
      setVos(v.data || []);
      setCompDocs(d.data || []);
      setDaysheets(ds.data || []);
      setDrawings(dr.data || []);
    } catch (err) {
      console.error("loadJobDetails error:", err.message);
      // Still load critical data even if drawings table missing
      const [n, p, t, v, d, ds] = await Promise.all([
        supabase.from("job_notes").select("*").eq("job_id", jobId).order("created_at", { ascending: false }),
        supabase.from("job_photos").select("*").eq("job_id", jobId).order("created_at", { ascending: false }),
        supabase.from("time_logs").select("*").eq("job_id", jobId).order("date", { ascending: false }),
        supabase.from("variation_orders").select("*").eq("job_id", jobId).order("created_at", { ascending: false }),
        supabase.from("compliance_docs").select("*").eq("job_id", jobId).order("created_at", { ascending: false }),
        supabase.from("daywork_sheets").select("*").eq("job_id", jobId).order("sheet_date", { ascending: false }),
      ]);
      setNotes(n.data || []);
      setPhotos(p.data || []);
      setTimeLogs(t.data || []);
      setVos(v.data || []);
      setCompDocs(d.data || []);
      setDaysheets(ds.data || []);
      setDrawings([]);
    }
  }

  async function sendServiceReminder(job) {
    const cust = (customers || []).find(c => c.name?.toLowerCase() === job.customer?.toLowerCase());
    if (!cust?.email) return;
    await supabase.from("job_cards").update({ service_reminder_sent: true }).eq("id", job.id);
    setJobCards(prev => prev.map(j => j.id === job.id ? { ...j, service_reminder_sent: true } : j));
    const { data: conns } = await supabase.from("email_connections").select("provider").eq("user_id", user.id);
    if (!conns?.length) return;
    const provider = conns[0].provider;
    const endpoint = provider === "outlook" ? "/api/outlook/send" : "/api/gmail/send";
    const dueDate = new Date(job.next_service_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id, to: cust.email, subject: `Annual Service Reminder — ${job.title || job.type}`, body: `<p>Dear ${job.customer},</p><p>Your annual service for <strong>${job.title || job.type}</strong> at ${job.address || "your property"} is due on <strong>${dueDate}</strong>.</p><p>Please get in touch to arrange a convenient time.</p><p>Many thanks,<br>${brand.tradingName}${brand.phone ? `<br>${brand.phone}` : ""}</p>` }) });
  }

  async function saveJob() {
    if (!form.customer && !form.title) return;
    setSaving(true);
    const payload = { user_id: user.id, title: form.title, customer: form.customer, address: form.address, type: form.type, status: form.status, value: parseFloat(form.value) || 0, po_number: form.po_number, notes: form.notes, scope_of_work: form.scope_of_work || "", annual_service: form.annual_service, updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from("job_cards").insert(payload).select().single();
    if (!error && data) { setJobCards(prev => [data, ...prev]); setShowAdd(false); setForm({ title: "", customer: "", address: "", type: "", status: "enquiry", value: "", po_number: "", notes: "", scope_of_work: "", annual_service: false }); }
    setSaving(false);
  }

  async function deleteJob(id) {
    if (!window.confirm("Delete this job card?")) return;
    await supabase.from("job_cards").delete().eq("id", id);
    setJobCards(prev => prev.filter(j => j.id !== id));
    setSelected(null);
  }

  async function addNoteToJob() {
    if (!addNote.trim() || !selected) return;
    const { data } = await supabase.from("job_notes").insert({ job_id: selected.id, user_id: user.id, note: addNote, created_at: new Date().toISOString() }).select().single();
    if (data) { setNotes(prev => [data, ...prev]); setAddNote(""); }
  }

  async function addTimeLog() {
    if (!addTime.hours || !addTime.rate || !selected) return;
    const { data } = await supabase.from("time_logs").insert({ job_id: selected.id, user_id: user.id, ...addTime, hours: parseFloat(addTime.hours), rate: parseFloat(addTime.rate) }).select().single();
    if (data) { setTimeLogs(prev => [data, ...prev]); setAddTime({ date: new Date().toISOString().slice(0,10), hours: "", rate: "", description: "" }); }
  }

  async function addVariationOrder() {
    if (!addVO.description || !selected) return;
    const { data } = await supabase.from("variation_orders").insert({ job_id: selected.id, user_id: user.id, ...addVO, amount: parseFloat(addVO.amount) || 0, status: "pending" }).select().single();
    if (data) { setVos(prev => [data, ...prev]); setAddVO({ vo_number: "", description: "", amount: "" }); }
  }

  async function addComplianceDoc() {
    if (!addDoc.doc_type || !selected) return;
    const { data } = await supabase.from("compliance_docs").insert({ job_id: selected.id, user_id: user.id, ...addDoc }).select().single();
    if (data) { setCompDocs(prev => [data, ...prev]); setAddDoc({ doc_type: "", doc_number: "", issued_date: "", expiry_date: "", notes: "" }); }
  }

  async function addDayworkSheet() {
    if (!addDaysheet.hours || !addDaysheet.rate || !selected) return;
    const { data } = await supabase.from("daywork_sheets").insert({ job_id: selected.id, user_id: user.id, ...addDaysheet, hours: parseFloat(addDaysheet.hours), rate: parseFloat(addDaysheet.rate) }).select().single();
    if (data) { setDaysheets(prev => [data, ...prev]); setAddDaysheet({ sheet_date: new Date().toISOString().slice(0,10), worker_name: "", hours: "", rate: "", description: "", contractor_name: "" }); }
  }

  const COMPLIANCE_TYPES = ["Gas Safety Certificate","Boiler Commissioning Sheet","EICR","Electrical Installation Certificate","Minor Works Certificate","PAT Testing","Pressure Test Certificate","Part P Certificate","Oil Safety Certificate","Other"];

  const statusOptions = ["enquiry","quoted","accepted","in_progress","completed","on_hold"];
  const totalTime = timeLogs.reduce((s, t) => s + (t.hours || 0), 0);
  const totalLabour = timeLogs.reduce((s, t) => s + ((t.hours || 0) * (t.rate || 0)), 0);
  const totalVO = vos.filter(v => v.status === "approved").reduce((s, v) => s + (v.amount || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 13, color: C.muted }}>{jobs.length} job{jobs.length !== 1 ? "s" : ""}</div>
        <button style={S.btn("primary")} onClick={() => setShowAdd(true)}>+ Add Job</button>
      </div>

      {/* Add Job form */}
      {showAdd && (
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={S.sectionTitle}>New Job Card</div>
            <VoiceFillButton form={form} setForm={setForm} fieldDescriptions="title (job title), customer (customer name), address (property address), type (job type e.g. boiler service), status (enquiry/quoted/accepted/in_progress/completed), value (job value in pounds), po_number (PO number if applicable), notes (any notes)" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div><label style={S.label}>Job Title</label><input style={S.input} placeholder="e.g. Boiler Service" value={form.title} onChange={setF("title")} /></div>
              <div><label style={S.label}>Customer</label><input style={S.input} placeholder="Customer name" value={form.customer} onChange={setF("customer")} /></div>
              <div style={{ gridColumn: "1/-1" }}><label style={S.label}>Address</label><input style={S.input} placeholder="Property address" value={form.address} onChange={setF("address")} /></div>
              <div><label style={S.label}>Job Type</label><input style={S.input} placeholder="e.g. Plumbing, Electrical" value={form.type} onChange={setF("type")} /></div>
              <div><label style={S.label}>Status</label><select style={S.input} value={form.status} onChange={setF("status")}>{statusOptions.map(s => <option key={s} value={s}>{s.replace("_"," ")}</option>)}</select></div>
              <div><label style={S.label}>Value (£)</label><input type="number" style={S.input} placeholder="0" value={form.value} onChange={setF("value")} /></div>
              <div><label style={S.label}>PO Number</label><input style={S.input} placeholder="Optional" value={form.po_number} onChange={setF("po_number")} /></div>
            </div>
            <div><label style={S.label}>Notes</label><textarea style={{ ...S.input, minHeight: 60, resize: "none" }} value={form.notes} onChange={setF("notes")} /></div>
            <div><label style={S.label}>Scope of Work</label><textarea style={{ ...S.input, minHeight: 80, resize: "none" }} placeholder="Detail the work to be carried out..." value={form.scope_of_work} onChange={setF("scope_of_work")} /></div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8, cursor: "pointer" }} onClick={() => setForm(f => ({ ...f, annual_service: !f.annual_service }))}>
              <div style={{ width: 36, height: 20, borderRadius: 10, background: form.annual_service ? C.amber : C.border, position: "relative", flexShrink: 0, transition: "all 0.2s" }}>
                <div style={{ position: "absolute", top: 2, left: form.annual_service ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "all 0.2s" }} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Annual Service Job <span style={{ color: C.muted, fontWeight: 400 }}>(auto-reminder at 50 weeks)</span></div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn("primary"), flex: 1 }} disabled={saving || (!form.customer && !form.title)} onClick={saveJob}>{saving ? "Saving..." : "Save Job →"}</button>
              <button style={S.btn("ghost")} onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Job list */}
      {loading && <div style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: 24 }}>Loading jobs...</div>}
      {!loading && jobs.length === 0 && !showAdd && (
        <div style={{ ...S.card, textAlign: "center", padding: 32 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🔧</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>No job cards yet. Convert a quote or create one manually.</div>
          <button style={S.btn("primary")} onClick={() => setShowAdd(true)}>+ Add First Job</button>
        </div>
      )}
      {jobs.map(j => (
        <div key={j.id} onClick={() => { setSelected(j); setTab("notes"); }} style={{ ...S.card, cursor: "pointer", borderLeft: `3px solid ${statusColor[j.status] || C.muted}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{j.title || j.type || "Job"}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{j.customer}{j.address ? ` · ${j.address}` : ""}</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              {j.value > 0 && <div style={{ fontSize: 14, fontWeight: 700, color: C.amber }}>£{j.value}</div>}
              <div style={S.badge(statusColor[j.status] || C.muted)}>{(j.status || "").replace("_"," ")}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {j.po_number && <span style={S.badge(C.blue)}>PO: {j.po_number}</span>}
            {j.annual_service && <span style={{ color: C.green, fontSize: 11 }}>🔄 Annual</span>}
            {j.customer_signature && <span style={{ color: C.green, fontSize: 11 }}>✓ Signed</span>}
            {j.invoice_id && <span style={S.badge(C.amber)}>Invoiced</span>}
            {geoJobId === j.id && geoState === "travelling" && <span style={{ color: C.amber, fontSize: 11 }}>🚗 {geoDistance !== null ? (geoDistance < 1000 ? geoDistance + "m" : (geoDistance/1000).toFixed(1) + "km") : "Travelling"}</span>}
            {geoJobId === j.id && geoState === "arrived" && <span style={{ color: C.green, fontSize: 11 }}>📍 On site</span>}
          </div>
        </div>
      ))}

      {/* Job detail modal */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 12, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.card, maxWidth: 520, width: "100%", marginBottom: 16, display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
            {/* Modal header */}
            <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{selected.title || selected.type || "Job"}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{selected.customer}{selected.address ? ` · ${selected.address}` : ""}</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px" }} onClick={() => { setEditForm({ title: selected.title || "", customer: selected.customer || "", address: selected.address || "", type: selected.type || "", status: selected.status || "enquiry", value: selected.value || "", po_number: selected.po_number || "", notes: selected.notes || "", annual_service: selected.annual_service || false }); setEditingJob(true); }}>Edit</button>
                  <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22, lineHeight: 1 }}>×</button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <span style={S.badge(statusColor[selected.status] || C.muted)}>{(selected.status || "").replace("_"," ")}</span>
                {selected.value > 0 && <span style={S.badge(C.amber)}>£{selected.value}</span>}
                {selected.po_number && <span style={S.badge(C.blue)}>PO: {selected.po_number}</span>}
                {selected.annual_service && <span style={{ color: C.green, fontSize: 11 }}>🔄 Annual</span>}
                {selected.customer_signature && <span style={{ color: C.green, fontSize: 11 }}>✓ Signed off</span>}
              </div>
            </div>

            {/* Geofence live status banner */}
            {geoJobId === selected.id && geoState !== "idle" && (
              <div style={{ padding: "10px 16px", background: geoState === "arrived" ? C.green + "18" : geoState === "finished" ? C.surfaceHigh : C.amber + "18", borderBottom: `1px solid ${geoState === "arrived" ? C.green + "44" : geoState === "finished" ? C.border : C.amber + "44"}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 18 }}>{geoState === "requesting" ? "⏳" : geoState === "travelling" ? "🚗" : geoState === "arrived" ? "📍" : "✅"}</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: geoState === "arrived" ? C.green : geoState === "finished" ? C.text : C.amber }}>
                      {geoState === "requesting" && "Getting your location..."}
                      {geoState === "travelling" && (geoDistance !== null ? `${geoDistance < 1000 ? geoDistance + "m" : (geoDistance/1000).toFixed(1) + "km"} from job` : "Travelling to job")}
                      {geoState === "arrived" && `Arrived · ${arrivalTime?.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`}
                      {geoState === "finished" && "Session saved to Time tab"}
                    </div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>
                      {geoState === "travelling" && jobCoords ? "Auto-arrival within 80m" : geoState === "travelling" ? "Tap 'I've Arrived' when on site" : ""}
                      {geoState === "arrived" && "Tap Finish Job when leaving"}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {geoState === "travelling" && !jobCoords && (
                    <button style={{ ...S.btn("primary"), fontSize: 11, padding: "5px 10px" }} onClick={() => markArrived(selected)}>I've Arrived</button>
                  )}
                  {geoState === "arrived" && (
                    <button style={{ ...S.btn("primary"), fontSize: 11, padding: "5px 10px", background: C.red, color: "#fff" }} onClick={() => finishJob(selected)}>Finish Job</button>
                  )}
                  {(geoState === "travelling" || geoState === "arrived") && (
                    <button style={{ ...S.btn("ghost"), fontSize: 11, padding: "5px 8px" }} onClick={stopGeoTracking}>✕</button>
                  )}
                  {geoState === "finished" && (
                    <button style={{ ...S.btn("ghost"), fontSize: 11, padding: "5px 10px" }} onClick={() => { setGeoState("idle"); setGeoJobId(null); }}>Dismiss</button>
                  )}
                </div>
              </div>
            )}

            {/* Sub-tabs */}
            <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}`, flexShrink: 0, overflowX: "auto" }}>
              {[["notes","Notes"],["photos","Photos"],["time","Time"],["vo","Variations"],["docs","Documents"],["certs","Certificates"],["daywork","Daywork"],["plans","📐 Plans"],["calls",`📞${jobCallLogs.length > 0 ? ` (${jobCallLogs.length})` : ""}`]].map(([v,l]) => (
                <button key={v} onClick={() => setTab(v)}
                  style={{ padding: "8px 12px", border: "none", borderBottom: tab === v ? `2px solid ${C.amber}` : "2px solid transparent", background: "transparent", color: tab === v ? C.amber : C.muted, fontSize: 11, fontWeight: tab === v ? 700 : 400, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'DM Mono',monospace" }}>
                  {l}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ padding: 16, overflowY: "auto", maxHeight: "55vh" }}>

              {/* NOTES */}
              {tab === "notes" && (
                <div>
                  {selected.scope_of_work && (
                    <div style={{ background: C.surfaceHigh, borderRadius: 8, padding: "10px 14px", marginBottom: 14, borderLeft: `3px solid ${C.amber}` }}>
                      <div style={{ fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Scope of Work</div>
                      <div style={{ fontSize: 12, color: C.text, lineHeight: 1.7, whiteSpace: "pre-line" }}>{selected.scope_of_work}</div>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                    <input style={{ ...S.input, flex: 1 }} placeholder="Add a note..." value={addNote} onChange={e => setAddNote(e.target.value)} onKeyDown={e => e.key === "Enter" && addNoteToJob()} />
                    <VoiceFillButton
                      form={{ note: addNote }}
                      setForm={f => setAddNote(f.note || "")}
                      fieldDescriptions="note (the note text to add about this job)"
                    />
                    <button style={S.btn("primary")} onClick={addNoteToJob}>Add</button>
                  </div>
                  {notes.length === 0 && <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No notes yet.</div>}
                  {notes.map(n => (
                    <div key={n.id} style={{ background: C.surfaceHigh, borderRadius: 8, padding: "10px 14px", marginBottom: 8 }}>
                      <div style={{ fontSize: 13 }}>{n.note}</div>
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{new Date(n.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* PHOTOS */}
              {tab === "photos" && (
                <div>
                  <input type="file" accept="image/*" ref={photoRef} style={{ display: "none" }} onChange={async e => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = async ev => {
                      const { data } = await supabase.from("job_photos").insert({ job_id: selected.id, user_id: user.id, photo_data: ev.target.result, filename: file.name, created_at: new Date().toISOString() }).select().single();
                      if (data) setPhotos(prev => [data, ...prev]);
                    };
                    reader.readAsDataURL(file);
                  }} />
                  <button style={{ ...S.btn("ghost"), marginBottom: 14 }} onClick={() => photoRef.current?.click()}>📷 Add Photo</button>
                  {photos.length === 0 && <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No photos yet.</div>}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {photos.map(p => (
                      <div key={p.id} style={{ borderRadius: 8, overflow: "hidden", background: C.surfaceHigh }}>
                        <img src={p.photo_data} alt={p.filename} style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }} />
                        <div style={{ padding: "4px 8px", fontSize: 10, color: C.muted }}>{new Date(p.created_at).toLocaleDateString("en-GB")}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TIME */}
              {tab === "time" && (
                <div>
                  <div style={{ background: C.surfaceHigh, borderRadius: 8, padding: 14, marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>Log Time</div>
                      <VoiceFillButton form={addTime} setForm={setAddTime} fieldDescriptions="date (date in YYYY-MM-DD format), hours (number of hours e.g. 4 or 2.5), rate (hourly rate in pounds e.g. 55), description (what work was done)" />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div><label style={S.label}>Date</label><input type="date" style={S.input} value={addTime.date} onChange={e => setAddTime(p => ({ ...p, date: e.target.value }))} /></div>
                      <div><label style={S.label}>Hours</label><input type="number" step="0.5" style={S.input} placeholder="e.g. 4" value={addTime.hours} onChange={e => setAddTime(p => ({ ...p, hours: e.target.value }))} /></div>
                      <div><label style={S.label}>Rate (£/hr)</label><input type="number" style={S.input} placeholder="e.g. 55" value={addTime.rate} onChange={e => setAddTime(p => ({ ...p, rate: e.target.value }))} /></div>
                      <div><label style={S.label}>Description</label><input style={S.input} placeholder="Work done" value={addTime.description} onChange={e => setAddTime(p => ({ ...p, description: e.target.value }))} /></div>
                    </div>
                    <button style={{ ...S.btn("primary"), marginTop: 8 }} disabled={!addTime.hours || !addTime.rate} onClick={addTimeLog}>Log Time →</button>
                  </div>
                  {totalTime > 0 && <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Total: {totalTime}hrs · £{totalLabour.toFixed(2)} labour</div>}
                  {timeLogs.map(t => (
                    <div key={t.id} style={{ ...S.row }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{t.hours}hrs @ £{t.rate}/hr</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{t.description} · {t.date}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.amber }}>£{(t.hours * t.rate).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* VARIATION ORDERS */}
              {tab === "vo" && (
                <div>
                  <div style={{ background: C.surfaceHigh, borderRadius: 8, padding: 14, marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>Add Variation</div>
                      <VoiceFillButton form={addVO} setForm={setAddVO} fieldDescriptions="vo_number (VO reference number e.g. VO-001), description (what the variation is e.g. additional radiator in hallway), amount (cost in pounds)" />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div><label style={S.label}>VO Number</label><input style={S.input} placeholder="e.g. VO-001" value={addVO.vo_number} onChange={e => setAddVO(p => ({ ...p, vo_number: e.target.value }))} /></div>
                      <div><label style={S.label}>Amount (£)</label><input type="number" style={S.input} value={addVO.amount} onChange={e => setAddVO(p => ({ ...p, amount: e.target.value }))} /></div>
                      <div style={{ gridColumn: "1/-1" }}><label style={S.label}>Description</label><input style={S.input} placeholder="Describe the variation" value={addVO.description} onChange={e => setAddVO(p => ({ ...p, description: e.target.value }))} /></div>
                    </div>
                    <button style={{ ...S.btn("primary"), marginTop: 8 }} disabled={!addVO.description} onClick={addVariationOrder}>Add VO →</button>
                  </div>
                  {totalVO > 0 && <div style={{ fontSize: 12, color: C.green, marginBottom: 10 }}>Approved VOs: £{totalVO.toFixed(2)}</div>}
                  {vos.map(v => (
                    <div key={v.id} style={{ background: C.surfaceHigh, borderRadius: 8, padding: "12px 14px", marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{v.vo_number || "VO"}</div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>£{v.amount || 0}</span>
                          <span style={S.badge(v.status === "approved" ? C.green : v.status === "rejected" ? C.red : C.amber)}>{v.status}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: C.muted }}>{v.description}</div>
                      {v.status === "pending" && (
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <button style={{ ...S.btn("green"), fontSize: 11, padding: "4px 10px" }} onClick={async () => {
                            // Mark VO approved
                            await supabase.from("variation_orders").update({ status: "approved" }).eq("id", v.id);
                            setVos(prev => prev.map(x => x.id === v.id ? { ...x, status: "approved" } : x));
                            // Create draft invoice for this variation
                            const invId = nextInvoiceId(invoices);
                            const newInv = {
                              id: invId,
                              customer: selected.customer,
                              address: selected.address || "",
                              amount: v.amount || 0,
                              desc: `Variation Order${v.vo_number ? ` ${v.vo_number}` : ""}: ${v.description}`,
                              description: `Variation Order${v.vo_number ? ` ${v.vo_number}` : ""}: ${v.description}`,
                              lineItems: [{ description: `VO${v.vo_number ? ` ${v.vo_number}` : ""}: ${v.description}`, amount: v.amount || 0 }],
                              due: `Due in ${brand?.paymentTerms || 14} days`,
                              status: "draft",
                              isQuote: false,
                              jobRef: selected.title || selected.type || "",
                              poNumber: selected.po_number || "",
                              created: new Date().toLocaleDateString("en-GB"),
                            };
                            setInvoices(prev => [newInv, ...(prev || [])]);
                            alert(`✓ VO approved — draft invoice ${invId} created for £${v.amount}. Review and send from the Invoices tab.`);
                          }}>Approve</button>
                          <button style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px", color: C.red }} onClick={async () => { await supabase.from("variation_orders").update({ status: "rejected" }).eq("id", v.id); setVos(prev => prev.map(x => x.id === v.id ? { ...x, status: "rejected" } : x)); }}>Reject</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* COMPLIANCE DOCUMENTS */}
              {tab === "docs" && (
                <div>
                  <div style={{ background: C.surfaceHigh, borderRadius: 8, padding: 14, marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>Add Document</div>
                      <VoiceFillButton form={addDoc} setForm={setAddDoc} fieldDescriptions="doc_type (certificate type e.g. Gas Safety Certificate, EICR, PAT Testing), doc_number (certificate number), issued_date (date issued YYYY-MM-DD), expiry_date (expiry date YYYY-MM-DD), notes (any notes)" />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div><label style={S.label}>Document Type</label>
                        <select style={S.input} value={addDoc.doc_type} onChange={e => setAddDoc(p => ({ ...p, doc_type: e.target.value }))}>
                          <option value="">Select type...</option>
                          {COMPLIANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div><label style={S.label}>Cert Number</label><input style={S.input} value={addDoc.doc_number} onChange={e => setAddDoc(p => ({ ...p, doc_number: e.target.value }))} /></div>
                        <div><label style={S.label}>Issued Date</label><input type="date" style={S.input} value={addDoc.issued_date} onChange={e => setAddDoc(p => ({ ...p, issued_date: e.target.value }))} /></div>
                        <div><label style={S.label}>Expiry Date</label><input type="date" style={S.input} value={addDoc.expiry_date} onChange={e => setAddDoc(p => ({ ...p, expiry_date: e.target.value }))} /></div>
                        <div><label style={S.label}>Notes</label><input style={S.input} value={addDoc.notes} onChange={e => setAddDoc(p => ({ ...p, notes: e.target.value }))} /></div>
                      </div>
                      <button style={S.btn("primary", !addDoc.doc_type)} disabled={!addDoc.doc_type} onClick={addComplianceDoc}>Add Document →</button>
                    </div>
                  </div>
                  {compDocs.map(d => (
                    <div key={d.id} style={{ background: C.surfaceHigh, borderRadius: 8, padding: "12px 14px", marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{d.doc_type}</div>
                        {d.expiry_date && <div style={{ fontSize: 11, color: new Date(d.expiry_date) < new Date() ? C.red : C.green }}>Exp: {new Date(d.expiry_date).toLocaleDateString("en-GB")}</div>}
                      </div>
                      {d.doc_number && <div style={{ fontSize: 11, color: C.muted }}>Cert: {d.doc_number}</div>}
                      {d.issued_date && <div style={{ fontSize: 11, color: C.muted }}>Issued: {new Date(d.issued_date).toLocaleDateString("en-GB")}</div>}
                      {d.notes && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{d.notes}</div>}
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px" }} onClick={() => emailComplianceDoc(d, selected, customers, user, emailConnection, brand)}>✉ Email</button>
                        <button style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px" }} onClick={() => printComplianceDoc(d, selected, brand)}>⬇ PDF</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* CERTIFICATES */}
              {tab === "certs" && (
                <CertificatesTab job={selected} brand={brand} customers={customers} user={user} connection={emailConnection} />
              )}

              {/* DAYWORK SHEETS */}
              {tab === "daywork" && (
                <div>
                  <div style={{ background: C.surfaceHigh, borderRadius: 8, padding: 14, marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>Add Daywork Sheet</div>
                      <VoiceFillButton form={addDaysheet} setForm={setAddDaysheet} fieldDescriptions="sheet_date (date in YYYY-MM-DD), worker_name (worker's full name), hours (number of hours e.g. 8), rate (hourly rate in pounds e.g. 45), contractor_name (main contractor name), description (work carried out)" />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div><label style={S.label}>Date</label><input type="date" style={S.input} value={addDaysheet.sheet_date} onChange={e => setAddDaysheet(p => ({ ...p, sheet_date: e.target.value }))} /></div>
                      <div><label style={S.label}>Worker Name</label><input style={S.input} placeholder="e.g. Dave Hughes" value={addDaysheet.worker_name} onChange={e => setAddDaysheet(p => ({ ...p, worker_name: e.target.value }))} /></div>
                      <div><label style={S.label}>Hours</label><input type="number" step="0.5" style={S.input} placeholder="e.g. 8" value={addDaysheet.hours} onChange={e => setAddDaysheet(p => ({ ...p, hours: e.target.value }))} /></div>
                      <div><label style={S.label}>Rate (£/hr)</label><input type="number" style={S.input} placeholder="e.g. 45" value={addDaysheet.rate} onChange={e => setAddDaysheet(p => ({ ...p, rate: e.target.value }))} /></div>
                      <div style={{ gridColumn: "1/-1" }}><label style={S.label}>Contractor</label><input style={S.input} placeholder="Main contractor name" value={addDaysheet.contractor_name} onChange={e => setAddDaysheet(p => ({ ...p, contractor_name: e.target.value }))} /></div>
                      <div style={{ gridColumn: "1/-1" }}><label style={S.label}>Work Description</label><input style={S.input} placeholder="Describe the work done" value={addDaysheet.description} onChange={e => setAddDaysheet(p => ({ ...p, description: e.target.value }))} /></div>
                    </div>
                    <button style={{ ...S.btn("primary"), marginTop: 8 }} disabled={!addDaysheet.hours || !addDaysheet.rate} onClick={addDayworkSheet}>Add Sheet →</button>
                  </div>
                  {daysheets.map(d => (
                    <div key={d.id} style={{ background: C.surfaceHigh, borderRadius: 8, padding: "12px 14px", marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{new Date(d.sheet_date).toLocaleDateString("en-GB")} · {d.worker_name || "Worker"}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.amber }}>£{(d.hours * d.rate).toFixed(2)}</div>
                      </div>
                      <div style={{ fontSize: 11, color: C.muted }}>{d.hours}hrs @ £{d.rate}/hr{d.contractor_name ? ` · ${d.contractor_name}` : ""}</div>
                      {d.description && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{d.description}</div>}
                    </div>
                  ))}
                </div>
              )}

              {/* CALLS */}
              {/* PLANS / DRAWINGS */}
              {tab === "plans" && (
                <div>
                  <div style={{ background: C.surfaceHigh, borderRadius: 8, padding: 14, marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Upload Drawing or Plan</div>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      style={{ display: "none" }}
                      id="drawingUpload"
                      onChange={async e => {
                        const file = e.target.files[0];
                        if (!file || !selected) return;
                        const reader = new FileReader();
                        reader.onload = async ev => {
                          const { data } = await supabase.from("job_drawings").insert({
                            job_id: selected.id,
                            user_id: user.id,
                            filename: file.name,
                            file_type: file.type,
                            file_data: ev.target.result,
                            created_at: new Date().toISOString(),
                          }).select().single();
                          if (data) setDrawings(prev => [data, ...prev]);
                        };
                        reader.readAsDataURL(file);
                        e.target.value = "";
                      }}
                    />
                    <button style={S.btn("primary")} onClick={() => document.getElementById("drawingUpload").click()}>📐 Upload Drawing / Plan</button>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Supports images and PDFs. Stored with the job for on-site reference.</div>
                  </div>
                  {drawings.length === 0
                    ? <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No drawings or plans uploaded yet.</div>
                    : drawings.map(d => (
                      <div key={d.id} style={{ background: C.surfaceHigh, borderRadius: 10, padding: 14, marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>📐 {d.filename}</div>
                            <div style={{ fontSize: 11, color: C.muted }}>{new Date(d.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button style={{ ...S.btn("primary"), fontSize: 11, padding: "5px 12px" }} onClick={() => {
                              const overlay = document.createElement("div");
                              overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:9999;display:flex;flex-direction:column;overflow-y:auto";
                              const bar = document.createElement("div");
                              bar.style.cssText = `padding:max(12px, env(safe-area-inset-top, 12px)) 16px 12px;background:#1a1a1a;border-bottom:1px solid #333;position:sticky;top:0;z-index:10;display:flex;align-items:center;gap:12px`;
                              const backBtn = document.createElement("button");
                              backBtn.textContent = "← Back";
                              backBtn.style.cssText = "background:#f59e0b;color:#000;border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;font-family:'DM Mono',monospace";
                              backBtn.onclick = () => document.body.removeChild(overlay);
                              const title = document.createElement("span");
                              title.textContent = d.filename;
                              title.style.cssText = "color:#888;font-size:13px;font-family:'DM Mono',monospace";
                              bar.appendChild(backBtn);
                              bar.appendChild(title);
                              overlay.appendChild(bar);
                              const content = document.createElement("div");
                              content.style.cssText = "flex:1;display:flex;justify-content:center;align-items:flex-start;padding:16px;background:#f5f5f5";
                              if (d.file_type === "application/pdf") {
                                const embed = document.createElement("embed");
                                embed.src = d.file_data;
                                embed.type = "application/pdf";
                                embed.style.cssText = "width:100%;height:80vh;border:none;border-radius:8px";
                                content.appendChild(embed);
                              } else {
                                const img = document.createElement("img");
                                img.src = d.file_data;
                                img.style.cssText = "max-width:100%;border-radius:8px";
                                content.appendChild(img);
                              }
                              overlay.appendChild(content);
                              document.body.appendChild(overlay);
                            }}>View</button>
                            <button style={{ ...S.btn("ghost"), fontSize: 11, padding: "5px 10px", color: C.red }} onClick={async () => {
                              await supabase.from("job_drawings").delete().eq("id", d.id);
                              setDrawings(prev => prev.filter(x => x.id !== d.id));
                            }}>×</button>
                          </div>
                        </div>
                        {d.file_type !== "application/pdf" && d.file_data && (
                          <img src={d.file_data} alt={d.filename} style={{ width: "100%", maxHeight: 160, objectFit: "contain", borderRadius: 6, background: "#fff", cursor: "pointer" }}
                            onClick={() => document.getElementById(`view-drawing-${d.id}`) && document.getElementById(`view-drawing-${d.id}`).click()}
                          />
                        )}
                      </div>
                    ))
                  }
                </div>
              )}

              {tab === "calls" && (
                <div>
                  {jobCallLogs.length === 0 ? (
                    <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic", textAlign: "center", padding: "24px 0" }}>
                      No recorded calls for this job yet.<br/>
                      <span style={{ fontSize: 11 }}>Calls from known customers are automatically recorded when Call Tracking is active.</span>
                    </div>
                  ) : jobCallLogs.map(log => (
                    <div key={log.id} style={{ background: C.surfaceHigh, borderRadius: 10, padding: 14, marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 18 }}>📞</span>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700 }}>{new Date(log.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                            <div style={{ fontSize: 11, color: C.muted }}>{Math.floor((log.duration_seconds || 0) / 60)}m {(log.duration_seconds || 0) % 60}s · {log.caller_number}</div>
                          </div>
                        </div>
                        <span style={S.badge(log.category === "existing_job" ? C.green : log.category === "new_enquiry" ? C.blue : C.amber)}>{(log.category || "general").replace("_", " ")}</span>
                      </div>
                      <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6, marginBottom: 6 }}>{log.summary}</div>
                      {log.key_details && <div style={{ fontSize: 11, color: C.amber }}>📌 {log.key_details}</div>}
                      {log.recording_url && (
                        <audio controls style={{ width: "100%", marginTop: 8, height: 32 }}
                          src={`/api/calls/audio?url=${encodeURIComponent(log.recording_url)}`}>
                          Your browser does not support audio playback.
                        </audio>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.border}`, flexShrink: 0, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {selected.invoice_id && <button style={{ ...S.btn("ghost"), fontSize: 11 }} onClick={() => { setSelected(null); setView("Invoices"); }}>View Invoice</button>}
              {selected.quote_id && <button style={{ ...S.btn("ghost"), fontSize: 11 }} onClick={() => { setSelected(null); setView("Quotes"); }}>View Quote</button>}
              {selected.address && <a href={`https://maps.google.com/?q=${encodeURIComponent(selected.address)}`} target="_blank" rel="noreferrer" style={{ ...S.btn("ghost"), fontSize: 11, textDecoration: "none" }}>📍 Navigate</a>}
              {selected.address && geoJobId !== selected.id && (
                <button style={{ ...S.btn("ghost"), fontSize: 11, color: C.blue }} onClick={() => startGeoTracking(selected)}>🚗 Start Job</button>
              )}
              {geoJobId === selected.id && geoState === "travelling" && jobCoords && (
                <button style={{ ...S.btn("ghost"), fontSize: 11, color: C.green }} onClick={() => markArrived(selected)}>📍 I've Arrived</button>
              )}
              {geoJobId === selected.id && geoState === "arrived" && (
                <button style={{ ...S.btn("ghost"), fontSize: 11, color: C.red }} onClick={() => finishJob(selected)}>✅ Finish Job</button>
              )}
              {selected.customer_signature
                ? <button style={{ ...S.btn("ghost"), fontSize: 11, color: C.green }} onClick={() => {
                    const accent = brand?.accentColor || "#f59e0b";
                    const tradingName = brand?.tradingName || "Trade PA";
                    const phone = brand?.phone || "";
                    const email = brand?.email || "";
                    const address = brand?.address || "";
                    const completionDate = selected.completion_date
                      ? new Date(selected.completion_date).toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" })
                      : new Date().toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" });

                    const overlay = document.createElement("div");
                    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:9999;display:flex;flex-direction:column;overflow-y:auto";

                    overlay.innerHTML = `
                      <div style="padding:max(12px, env(safe-area-inset-top, 12px)) 16px 12px;background:#1a1a1a;border-bottom:1px solid #333;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:10">
                        <button onclick="document.body.removeChild(this.closest('[style*=fixed]'))" style="background:${accent};color:#000;border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;font-family:'DM Mono',monospace">← Back</button>
                        <span style="color:#888;font-size:13px;font-family:'DM Mono',monospace">Job Completion Certificate</span>
                        <button onclick="window.print()" style="background:transparent;color:#888;border:1px solid #333;border-radius:8px;padding:8px 14px;font-size:12px;cursor:pointer;font-family:'DM Mono',monospace;margin-left:auto">🖨 Print / Save PDF</button>
                      </div>
                      <div style="flex:1;background:#f5f5f5;padding:24px;display:flex;justify-content:center">
                        <div style="font-family:Arial,sans-serif;max-width:680px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.15)">
                          <div style="background:${accent};padding:28px 32px;display:flex;justify-content:space-between;align-items:flex-start">
                            <div style="display:flex;align-items:center;gap:14px">
                              ${brand?.logo ? `<img src="${brand.logo}" style="height:48px;width:48px;object-fit:contain;border-radius:8px;background:#fff;padding:4px">` : `<div style="width:44px;height:44px;background:rgba(0,0,0,0.2);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:#000">TP</div>`}
                              <div>
                                <div style="font-size:20px;font-weight:700;color:#000">${tradingName}</div>
                                <div style="color:rgba(0,0,0,0.6);font-size:11px;margin-top:2px">${[phone, email, address].filter(Boolean).join(" · ")}</div>
                              </div>
                            </div>
                            <div style="text-align:right">
                              <div style="font-size:15px;font-weight:700;color:#000">COMPLETION CERTIFICATE</div>
                              <div style="font-size:11px;color:rgba(0,0,0,0.6);margin-top:2px">${completionDate}</div>
                            </div>
                          </div>
                          <div style="padding:28px 32px">
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
                              <div style="background:#f9f9f9;padding:14px;border-radius:8px">
                                <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:6px">Customer</div>
                                <div style="font-weight:600;font-size:14px">${selected.customer || ""}</div>
                                ${selected.address ? `<div style="color:#666;font-size:12px;margin-top:4px">${selected.address}</div>` : ""}
                              </div>
                              <div style="background:#f9f9f9;padding:14px;border-radius:8px">
                                <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:6px">Job</div>
                                <div style="font-weight:600;font-size:14px">${selected.title || selected.type || ""}</div>
                                ${selected.value ? `<div style="color:#666;font-size:12px;margin-top:4px">Value: £${selected.value}</div>` : ""}
                                ${selected.po_number ? `<div style="color:#666;font-size:12px">PO: ${selected.po_number}</div>` : ""}
                              </div>
                            </div>
                            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:24px">
                              <p style="margin:0;font-size:14px;color:#166534;line-height:1.6">I confirm that the above works have been completed to my full satisfaction. I am happy with the quality of workmanship and all works have been carried out as agreed.</p>
                            </div>
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:24px;padding-top:20px;border-top:1px solid #eee">
                              <div>
                                <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px">Customer Signature</div>
                                <div style="height:64px;border-bottom:2px solid #333;margin-bottom:6px;display:flex;align-items:flex-end;padding-bottom:4px">
                                  <img src="${selected.customer_signature}" style="max-height:60px;max-width:100%">
                                </div>
                                <div style="font-size:11px;color:#666">${selected.customer} · ${completionDate}</div>
                              </div>
                              <div>
                                <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px">Engineer / Contractor</div>
                                <div style="height:64px;border-bottom:2px solid #333;margin-bottom:6px;display:flex;align-items:center;padding-bottom:4px">
                                  <span style="font-size:13px;color:#1a1a1a">${tradingName}</span>
                                </div>
                                <div style="font-size:11px;color:#666">${completionDate}</div>
                              </div>
                            </div>
                            <div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:10px;color:#999;text-align:center">${tradingName}${phone ? ` · ${phone}` : ""}${email ? ` · ${email}` : ""} · Generated by Trade PA</div>
                          </div>
                        </div>
                      </div>
                    `;
                    document.body.appendChild(overlay);
                  }}>📄 Completion Certificate</button>
                : <button style={{ ...S.btn("ghost"), fontSize: 11, color: C.green }} onClick={() => setShowSignature(true)}>✍ Get Signature</button>
              }
              {selected.value > 0 && (
                <button style={{ ...S.btn("ghost"), fontSize: 11, color: C.blue }} onClick={() => {
                  setStagePaymentStages([
                    { label: "Deposit", type: "pct", value: "30" },
                    { label: "First Fix", type: "pct", value: "40" },
                    { label: "Completion", type: "pct", value: "30" },
                  ]);
                  setShowStagePayments(true);
                }}>💰 Stage Payments</button>
              )}
              <button style={{ ...S.btn("ghost"), fontSize: 11, color: C.red, marginLeft: "auto" }} onClick={() => deleteJob(selected.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit job modal */}
      {editingJob && selected && (
        <div style={{ position: "fixed", inset: 0, background: "#000d", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: 16 }}>
          <div style={{ ...S.card, maxWidth: 460, width: "100%", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Edit Job</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <VoiceFillButton form={editForm} setForm={setEditForm} fieldDescriptions="title (job title), customer (customer name), address (property address), type (job type e.g. boiler service), status (enquiry/quoted/accepted/in_progress/completed), value (job value in pounds), po_number (PO number), notes (any notes)" />
                <button onClick={() => setEditingJob(false)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22 }}>×</button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div><label style={S.label}>Job Title</label><input style={S.input} value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} /></div>
                <div><label style={S.label}>Customer</label><input style={S.input} value={editForm.customer} onChange={e => setEditForm(f => ({ ...f, customer: e.target.value }))} /></div>
                <div style={{ gridColumn: "1/-1" }}><label style={S.label}>Address</label><input style={S.input} value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} /></div>
                <div><label style={S.label}>Job Type</label><input style={S.input} value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))} /></div>
                <div><label style={S.label}>Value (£)</label><input type="number" style={S.input} value={editForm.value} onChange={e => setEditForm(f => ({ ...f, value: e.target.value }))} /></div>
                <div><label style={S.label}>PO Number</label><input style={S.input} value={editForm.po_number} onChange={e => setEditForm(f => ({ ...f, po_number: e.target.value }))} /></div>
                <div><label style={S.label}>Status</label>
                  <select style={S.input} value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                    {["enquiry","quoted","accepted","in_progress","completed","on_hold"].map(s => <option key={s} value={s}>{s.replace("_"," ")}</option>)}
                  </select>
                </div>
              </div>
              <div><label style={S.label}>Notes</label><textarea style={{ ...S.input, minHeight: 72, resize: "none" }} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} /></div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8, cursor: "pointer" }} onClick={() => setEditForm(f => ({ ...f, annual_service: !f.annual_service }))}>
                <div style={{ width: 36, height: 20, borderRadius: 10, background: editForm.annual_service ? C.amber : C.border, position: "relative", flexShrink: 0, transition: "all 0.2s" }}>
                  <div style={{ position: "absolute", top: 2, left: editForm.annual_service ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "all 0.2s" }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Annual Service Job</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...S.btn("primary"), flex: 1 }} onClick={async () => {
                  const updates = { ...editForm, value: parseFloat(editForm.value) || 0, updated_at: new Date().toISOString() };
                  await supabase.from("job_cards").update(updates).eq("id", selected.id);
                  setJobCards(prev => prev.map(j => j.id === selected.id ? { ...j, ...updates } : j));
                  setSelected(s => ({ ...s, ...updates }));
                  setEditingJob(false);
                }}>Save Changes →</button>
                <button style={S.btn("ghost")} onClick={() => setEditingJob(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stage Payments Modal */}
      {showStagePayments && selected && (
        <div style={{ position: "fixed", inset: 0, background: "#000d", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 500, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }} onClick={() => setShowStagePayments(false)}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.card, maxWidth: 480, width: "100%", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>💰 Stage Payments</div>
              <button onClick={() => setShowStagePayments(false)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22 }}>×</button>
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
              Job value: <strong style={{ color: C.amber }}>£{selected.value}</strong> · Each stage creates a draft invoice
            </div>

            {/* Stages list */}
            {stagePaymentStages.map((stage, i) => {
              const stageAmt = stage.type === "pct"
                ? parseFloat(((selected.value * parseFloat(stage.value || 0)) / 100).toFixed(2))
                : parseFloat(stage.value || 0);
              return (
                <div key={i} style={{ background: C.surfaceHigh, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.amber }}>Stage {i + 1}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.green }}>£{stageAmt.toFixed(2)}</div>
                    {stagePaymentStages.length > 1 && (
                      <button onClick={() => setStagePaymentStages(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16 }}>×</button>
                    )}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "center" }}>
                    <input
                      style={{ ...S.input, fontSize: 13 }}
                      placeholder="Stage name e.g. Deposit"
                      value={stage.label}
                      onChange={e => setStagePaymentStages(prev => prev.map((s, j) => j === i ? { ...s, label: e.target.value } : s))}
                    />
                    <select
                      style={{ ...S.input, width: 70, padding: "10px 6px", fontSize: 12 }}
                      value={stage.type}
                      onChange={e => setStagePaymentStages(prev => prev.map((s, j) => j === i ? { ...s, type: e.target.value, value: e.target.value === "pct" ? "30" : "" } : s))}
                    >
                      <option value="pct">%</option>
                      <option value="gbp">£</option>
                    </select>
                    <input
                      style={{ ...S.input, width: 80, fontSize: 13 }}
                      type="number"
                      min="0"
                      placeholder={stage.type === "pct" ? "%" : "£"}
                      value={stage.value}
                      onChange={e => setStagePaymentStages(prev => prev.map((s, j) => j === i ? { ...s, value: e.target.value } : s))}
                    />
                  </div>
                </div>
              );
            })}

            {/* Total check */}
            {(() => {
              const total = stagePaymentStages.reduce((sum, s) => {
                const amt = s.type === "pct"
                  ? parseFloat(((selected.value * parseFloat(s.value || 0)) / 100))
                  : parseFloat(s.value || 0);
                return sum + (isNaN(amt) ? 0 : amt);
              }, 0);
              const diff = Math.abs(total - selected.value);
              return (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: diff < 0.01 ? C.green + "18" : C.red + "18", borderRadius: 8, marginBottom: 14, border: `1px solid ${diff < 0.01 ? C.green + "44" : C.red + "44"}` }}>
                  <span style={{ fontSize: 12, color: diff < 0.01 ? C.green : C.red }}>
                    {diff < 0.01 ? "✓ Stages total correctly" : `⚠ Stages total £${total.toFixed(2)} — job value is £${selected.value}`}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: diff < 0.01 ? C.green : C.red }}>£{total.toFixed(2)}</span>
                </div>
              );
            })()}

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button style={{ ...S.btn("ghost"), fontSize: 11 }} onClick={() => setStagePaymentStages(prev => [...prev, { label: "", type: "pct", value: "" }])}>
                + Add Stage
              </button>
            </div>

            <button
              style={{ ...S.btn("primary"), width: "100%", justifyContent: "center", padding: 14 }}
              onClick={() => {
                stagePaymentStages.forEach((s, i) => {
                  const stageAmt = parseFloat((s.type === "pct"
                    ? (selected.value * parseFloat(s.value || 0)) / 100
                    : parseFloat(s.value || 0)).toFixed(2));
                  if (!stageAmt || stageAmt <= 0) return;
                  const invId = nextInvoiceId(invoices);
                  const label = s.label || `Stage ${i + 1}`;
                  const newInv = {
                    id: invId,
                    customer: selected.customer,
                    address: selected.address || "",
                    amount: stageAmt,
                    desc: `${label} — ${selected.title || selected.type || ""}`,
                    description: `${label} — ${selected.title || selected.type || ""}`,
                    lineItems: [{ description: `${label} — ${selected.title || selected.type || ""}`, amount: stageAmt }],
                    due: `Due in ${brand?.paymentTerms || 14} days`,
                    status: "draft",
                    isQuote: false,
                    jobRef: selected.title || selected.type || "",
                    poNumber: selected.po_number || "",
                    created: new Date().toLocaleDateString("en-GB"),
                  };
                  setInvoices(prev => [newInv, ...(prev || [])]);
                });
                setShowStagePayments(false);
                alert(`✓ ${stagePaymentStages.length} stage payment invoices created as drafts. Review and send from the Invoices tab.`);
              }}
            >
              Create {stagePaymentStages.length} Draft Invoice{stagePaymentStages.length !== 1 ? "s" : ""} →
            </button>
          </div>
        </div>
      )}

      {/* Signature modal */}
      {showSignature && selected && (
        <SignaturePad
          title={`Customer sign-off — ${selected.customer}`}
          onSave={async sigData => {
            await supabase.from("job_cards").update({ customer_signature: sigData, status: "completed", completion_date: new Date().toISOString() }).eq("id", selected.id);
            setJobCards(prev => prev.map(j => j.id === selected.id ? { ...j, customer_signature: sigData, status: "completed" } : j));
            setSelected(s => ({ ...s, customer_signature: sigData, status: "completed" }));
            setShowSignature(false);
            if (selected.annual_service) {
              const nextService = new Date();
              nextService.setDate(nextService.getDate() + 350);
              await supabase.from("job_cards").update({ next_service_date: nextService.toISOString().slice(0,10), service_reminder_sent: false }).eq("id", selected.id);
            }
          }}
          onCancel={() => setShowSignature(false)}
        />
      )}
    </div>
  );
}


const MILEAGE_RATE = 0.45; // HMRC approved mileage rate

function ExpensesTab({ user }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ exp_type: "mileage", description: "", amount: "", miles: "", exp_date: new Date().toISOString().slice(0,10) });
  const [filterMonth, setFilterMonth] = useState("all");
  const receiptRef = useRef();
  const [receiptData, setReceiptData] = useState(null);

  useEffect(() => { loadExpenses(); }, [user]);

  async function loadExpenses() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("expenses").select("*").eq("user_id", user.id).order("exp_date", { ascending: false });
    setExpenses(data || []);
    setLoading(false);
  }

  async function saveExpense() {
    let amount = parseFloat(form.amount) || 0;
    if (form.exp_type === "mileage" && form.miles) {
      amount = parseFloat(form.miles) * MILEAGE_RATE;
    }
    const { data } = await supabase.from("expenses").insert({
      user_id: user.id,
      exp_type: form.exp_type,
      description: form.description,
      amount,
      miles: form.exp_type === "mileage" ? parseFloat(form.miles) : null,
      exp_date: form.exp_date,
      receipt_data: receiptData || null,
    }).select().single();
    if (data) {
      setExpenses(prev => [data, ...prev]);
      setShowAdd(false);
      setForm({ exp_type: "mileage", description: "", amount: "", miles: "", exp_date: new Date().toISOString().slice(0,10) });
      setReceiptData(null);
    }
  }

  const addReceipt = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => setReceiptData(e.target.result);
    reader.readAsDataURL(file);
  };

  const months = [...new Set(expenses.map(e => e.exp_date?.slice(0,7)))].sort().reverse();
  const filtered = filterMonth === "all" ? expenses : expenses.filter(e => e.exp_date?.startsWith(filterMonth));
  const totalFiltered = filtered.reduce((s, e) => s + (e.amount || 0), 0);
  const totalMileage = filtered.filter(e => e.exp_type === "mileage").reduce((s, e) => s + (e.miles || 0), 0);

  const EXP_TYPES = [
    { value: "mileage", label: "🚗 Mileage", desc: `HMRC rate ${MILEAGE_RATE * 100}p/mile` },
    { value: "fuel", label: "⛽ Fuel" },
    { value: "parking", label: "🅿 Parking" },
    { value: "tools", label: "🔧 Tools" },
    { value: "materials", label: "📦 Materials" },
    { value: "accommodation", label: "🏨 Accommodation" },
    { value: "subsistence", label: "🥗 Subsistence" },
    { value: "other", label: "📋 Other" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Expenses & Mileage</div>
        <button style={S.btn("primary")} onClick={() => setShowAdd(true)}>+ Add Expense</button>
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 10 }}>
        {[
          { l: "Total Expenses", v: `£${filtered.reduce((s,e) => s + (e.amount||0), 0).toFixed(2)}`, c: C.amber },
          { l: "Mileage", v: `${totalMileage.toFixed(0)} miles`, c: C.blue },
          { l: "Mileage Value", v: `£${(totalMileage * MILEAGE_RATE).toFixed(2)}`, c: C.green },
          { l: "This period", v: filtered.length + " entries", c: C.muted },
        ].map((st, i) => (
          <div key={i} style={S.card}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{st.l}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: st.c }}>{st.v}</div>
          </div>
        ))}
      </div>

      {/* Month filter */}
      {months.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => setFilterMonth("all")} style={S.pill(C.amber, filterMonth === "all")}>All time</button>
          {months.slice(0, 6).map(m => (
            <button key={m} onClick={() => setFilterMonth(m)} style={S.pill(C.amber, filterMonth === m)}>
              {new Date(m + "-01").toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
            </button>
          ))}
        </div>
      )}

      {/* Expense list */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Expense Log ({filtered.length})</div>
        {loading && <div style={{ fontSize: 12, color: C.muted }}>Loading...</div>}
        {!loading && filtered.length === 0 && <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No expenses logged yet.</div>}
        {filtered.map(e => (
          <div key={e.id} style={S.row}>
            <div style={{ fontSize: 18, flexShrink: 0 }}>{EXP_TYPES.find(t => t.value === e.exp_type)?.label?.split(" ")[0] || "📋"}</div>
            <div style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{EXP_TYPES.find(t => t.value === e.exp_type)?.label?.split(" ").slice(1).join(" ") || e.exp_type}</div>
              <div style={{ fontSize: 11, color: C.muted }}>
                {new Date(e.exp_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                {e.description ? ` · ${e.description}` : ""}
                {e.miles ? ` · ${e.miles} miles` : ""}
              </div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.amber, flexShrink: 0 }}>£{Number(e.amount).toFixed(2)}</div>
            {e.receipt_data && <div style={{ fontSize: 16, marginLeft: 6 }} title="Receipt attached">🧾</div>}
          </div>
        ))}
      </div>

      {/* Add Expense Modal */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }}>
          <div style={{ ...S.card, maxWidth: 460, width: "100%", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Add Expense</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <VoiceFillButton form={form} setForm={setForm} fieldDescriptions="exp_type (type: mileage/fuel/parking/tools/materials/other), miles (miles as number if mileage), amount (£ amount as number), description (what it was for e.g. trip to Screwfix), exp_date (date in YYYY-MM-DD format)" />
                <button onClick={() => { setShowAdd(false); setReceiptData(null); }} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22 }}>×</button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={S.label}>Type</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {EXP_TYPES.map(t => (
                    <button key={t.value} onClick={() => setForm(f => ({ ...f, exp_type: t.value }))} style={S.pill(C.amber, form.exp_type === t.value)}>{t.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={S.label}>Date</label>
                <input type="date" style={S.input} value={form.exp_date} onChange={e => setForm(f => ({ ...f, exp_date: e.target.value }))} />
              </div>
              {form.exp_type === "mileage" ? (
                <div>
                  <label style={S.label}>Miles</label>
                  <input type="number" style={S.input} placeholder="e.g. 24" value={form.miles} onChange={e => setForm(f => ({ ...f, miles: e.target.value }))} />
                  {form.miles && <div style={{ fontSize: 11, color: C.amber, marginTop: 4 }}>= £{(parseFloat(form.miles) * MILEAGE_RATE).toFixed(2)} at {MILEAGE_RATE * 100}p/mile</div>}
                </div>
              ) : (
                <div>
                  <label style={S.label}>Amount (£)</label>
                  <input type="number" step="0.01" style={S.input} placeholder="e.g. 45.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
              )}
              <div>
                <label style={S.label}>Description</label>
                <input style={S.input} placeholder="e.g. Trip to Screwfix, parking at site" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Receipt (optional)</label>
                <button style={{ ...S.btn("ghost"), width: "100%", justifyContent: "center" }} onClick={() => receiptRef.current?.click()}>
                  {receiptData ? "✓ Receipt added" : "📷 Add receipt photo"}
                </button>
                <input ref={receiptRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => { addReceipt(e.target.files?.[0]); e.target.value = ""; }} />
              </div>
              <button style={S.btn("primary", (!form.miles && !form.amount) || form.exp_type === "mileage" && !form.miles)} onClick={saveExpense}>Save Expense →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CIS Statements Tab ───────────────────────────────────────────────────────
function CISStatementsTab({ user }) {
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ contractor_name: "", tax_month: new Date().toISOString().slice(0,7), gross_amount: "", deduction_amount: "", notes: "" });

  useEffect(() => { loadStatements(); }, [user]);

  async function loadStatements() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("cis_statements").select("*").eq("user_id", user.id).order("tax_month", { ascending: false });
    setStatements(data || []);
    setLoading(false);
  }

  async function saveStatement() {
    const gross = parseFloat(form.gross_amount) || 0;
    const deduction = parseFloat(form.deduction_amount) || 0;
    const { data } = await supabase.from("cis_statements").insert({
      user_id: user.id,
      contractor_name: form.contractor_name,
      tax_month: form.tax_month + "-01",
      gross_amount: gross,
      deduction_amount: deduction,
      net_amount: gross - deduction,
      notes: form.notes,
    }).select().single();
    if (data) {
      setStatements(prev => [data, ...prev]);
      setShowAdd(false);
      setForm({ contractor_name: "", tax_month: new Date().toISOString().slice(0,7), gross_amount: "", deduction_amount: "", notes: "" });
    }
  }

  const totalGross = statements.reduce((s, st) => s + (st.gross_amount || 0), 0);
  const totalDeducted = statements.reduce((s, st) => s + (st.deduction_amount || 0), 0);
  const totalNet = statements.reduce((s, st) => s + (st.net_amount || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>CIS Monthly Statements</div>
        <button style={S.btn("primary")} onClick={() => setShowAdd(true)}>+ Add Statement</button>
      </div>
      <div style={{ fontSize: 12, color: C.muted, background: C.surfaceHigh, borderRadius: 8, padding: "10px 14px" }}>
        Log the CIS monthly statements you receive from main contractors. These show your gross pay, CIS tax deducted, and net paid — needed for your self-assessment tax return.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 10 }}>
        {[
          { l: "Total Gross", v: `£${totalGross.toLocaleString()}`, c: C.text },
          { l: "CIS Deducted", v: `£${totalDeducted.toLocaleString()}`, c: C.red },
          { l: "Net Received", v: `£${totalNet.toLocaleString()}`, c: C.green },
        ].map((st, i) => (
          <div key={i} style={S.card}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{st.l}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: st.c }}>{st.v}</div>
          </div>
        ))}
      </div>

      <div style={S.card}>
        <div style={S.sectionTitle}>Statements ({statements.length})</div>
        {loading && <div style={{ fontSize: 12, color: C.muted }}>Loading...</div>}
        {!loading && statements.length === 0 && <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No statements logged yet.</div>}
        {statements.map(s => (
          <div key={s.id} style={S.row}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.contractor_name}</div>
                {s.attachment_data && (
                  <div
                    title="CIS statement PDF attached"
                    style={{ fontSize: 10, background: C.blue + "22", color: C.blue, border: `1px solid ${C.blue}44`, borderRadius: 4, padding: "1px 5px", cursor: "pointer", flexShrink: 0 }}
                    onClick={() => {
                      const win = window.open();
                      win.document.write(`<iframe src="${s.attachment_data}" width="100%" height="100%" style="border:none;position:fixed;top:0;left:0;"></iframe>`);
                    }}
                  >📄 View PDF</div>
                )}
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>{new Date(s.tax_month).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</div>
              {s.notes && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{s.notes}</div>}
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>£{Number(s.gross_amount).toFixed(2)} gross</div>
              <div style={{ fontSize: 11, color: C.red }}>-£{Number(s.deduction_amount).toFixed(2)} CIS</div>
              <div style={{ fontSize: 11, color: C.green }}>£{Number(s.net_amount).toFixed(2)} net</div>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }}>
          <div style={{ ...S.card, maxWidth: 460, width: "100%", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Add CIS Statement</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <VoiceFillButton form={form} setForm={setForm} fieldDescriptions="contractor_name (main contractor company name), tax_month (month in YYYY-MM format), gross_amount (gross amount as number), deduction_amount (CIS deduction as number), notes (any reference number or notes)" />
                <button onClick={() => setShowAdd(false)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22 }}>×</button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><label style={S.label}>Contractor Name</label><input style={S.input} placeholder="e.g. ABC Construction Ltd" value={form.contractor_name} onChange={e => setForm(f => ({ ...f, contractor_name: e.target.value }))} /></div>
              <div><label style={S.label}>Tax Month</label><input type="month" style={S.input} value={form.tax_month} onChange={e => setForm(f => ({ ...f, tax_month: e.target.value }))} /></div>
              <div><label style={S.label}>Gross Amount (£)</label><input type="number" step="0.01" style={S.input} placeholder="e.g. 3500.00" value={form.gross_amount} onChange={e => setForm(f => ({ ...f, gross_amount: e.target.value }))} /></div>
              <div><label style={S.label}>CIS Deduction (£)</label><input type="number" step="0.01" style={S.input} placeholder="e.g. 700.00" value={form.deduction_amount} onChange={e => setForm(f => ({ ...f, deduction_amount: e.target.value }))} /></div>
              {form.gross_amount && form.deduction_amount && (
                <div style={{ background: C.green + "18", border: `1px solid ${C.green}44`, borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
                  Net payable: <strong style={{ color: C.green }}>£{(parseFloat(form.gross_amount) - parseFloat(form.deduction_amount)).toFixed(2)}</strong>
                </div>
              )}
              <div><label style={S.label}>Notes</label><input style={S.input} placeholder="e.g. Statement ref 2024/3" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
              <button style={S.btn("primary", !form.contractor_name || !form.gross_amount || !form.deduction_amount)} disabled={!form.contractor_name || !form.gross_amount || !form.deduction_amount} onClick={saveStatement}>Save Statement →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const VIEWS = ["Dashboard", "Schedule", "Enquiries", "Jobs", "Customers", "Invoices", "Quotes", "Materials", "Expenses", "CIS", "AI Assistant", "Reminders", "Payments", "Inbox", "Settings"];

// Helper: convert VAPID public key for push subscription
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

// Sequential invoice/quote ID generators
function nextInvoiceId(invoices) {
  const existing = (invoices || [])
    .filter(i => !i.isQuote)
    .map(i => parseInt((i.id || "").replace(/\D/g, ""), 10))
    .filter(n => !isNaN(n));
  const max = existing.length > 0 ? Math.max(...existing) : 0;
  return `INV-${String(max + 1).padStart(3, "0")}`;
}

function nextQuoteId(invoices) {
  const existing = (invoices || [])
    .filter(i => i.isQuote)
    .map(i => parseInt((i.id || "").replace(/\D/g, ""), 10))
    .filter(n => !isNaN(n));
  const max = existing.length > 0 ? Math.max(...existing) : 0;
  return `QTE-${String(max + 1).padStart(3, "0")}`;
}

// Exempt accounts — bypass all verification gates (test/owner accounts)
const EXEMPT_EMAILS = [
  "thetradepa@gmail.com",
  "connor_mckay777@hotmail.com",
  "connor_mckay777@hotmail.co.uk",
  "landbheating@outlook.com",
  "shannonandrewsimpson@gmail.com",
];
function isExemptAccount(email) {
  return EXEMPT_EMAILS.includes((email || "").toLowerCase());
}

// ─── Softphone UI ─────────────────────────────────────────────────────────────
function IncomingCallScreen({ callerName, callerNumber, onAnswer, onDecline }) {
  const [dots, setDots] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDots(d => (d + 1) % 4), 500);
    return () => clearInterval(t);
  }, []);
  const initials = callerName && callerName !== "Unknown caller" && callerName !== "Unknown"
    ? callerName.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: "linear-gradient(180deg, #0a1628 0%, #0f0f0f 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <style>{`
        @keyframes ringPulse { 0% { transform:scale(1);opacity:0.6; } 50%,100% { transform:scale(1.5);opacity:0; } }
        @keyframes ringPulse2 { 0% { transform:scale(1);opacity:0.4; } 50%,100% { transform:scale(1.8);opacity:0; } }
      `}</style>
      <div style={{ position: "relative", width: 100, height: 100, marginBottom: 32 }}>
        <div style={{ position: "absolute", inset: -20, borderRadius: "50%", border: "2px solid #3b82f6", animation: "ringPulse 1.5s ease-out infinite" }} />
        <div style={{ position: "absolute", inset: -20, borderRadius: "50%", border: "2px solid #3b82f6", animation: "ringPulse2 1.5s ease-out 0.4s infinite" }} />
        <div style={{ width: 100, height: 100, borderRadius: "50%", background: "linear-gradient(135deg,#1e3a5f,#2563eb)", border: "3px solid #3b82f680", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 700, color: "#fff", fontFamily: "'DM Mono',monospace" }}>{initials}</div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: "#f0f0f0", marginBottom: 8, textAlign: "center", padding: "0 32px" }}>{callerName}</div>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 6 }}>Incoming call{".".repeat(dots)}</div>
      {callerNumber && <div style={{ fontSize: 13, color: "#4b5563", fontFamily: "'DM Mono',monospace", marginBottom: 60 }}>{callerNumber}</div>}
      <div style={{ display: "flex", gap: 60, alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <button onClick={onDecline} style={{ width: 70, height: 70, borderRadius: "50%", background: "#ef4444", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, boxShadow: "0 4px 20px #ef444460" }}>📵</button>
          <div style={{ fontSize: 11, color: "#6b7280" }}>Decline</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <button onClick={onAnswer} style={{ width: 70, height: 70, borderRadius: "50%", background: "#22c55e", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, boxShadow: "0 4px 20px #22c55e60" }}>📞</button>
          <div style={{ fontSize: 11, color: "#6b7280" }}>Answer</div>
        </div>
      </div>
    </div>
  );
}

function ActiveCallScreen({ callerName, callerNumber, direction, startTime, muted, onMute, onHangUp, speaker, onSpeaker }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startTime]);
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const initials = callerName && callerName !== "Unknown" && callerName !== "Unknown caller"
    ? callerName.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: "linear-gradient(180deg,#0a2018 0%,#0f0f0f 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: "env(safe-area-inset-top,0px)", paddingBottom: "env(safe-area-inset-bottom,0px)" }}>
      <style>{`@keyframes activePulse{0%,100%{box-shadow:0 0 0 0 #22c55e40;}50%{box-shadow:0 0 0 16px #22c55e00;}}`}</style>
      <div style={{ fontSize: 12, color: "#22c55e", background: "#22c55e18", border: "1px solid #22c55e40", borderRadius: 20, padding: "4px 14px", marginBottom: 32, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {direction === "outbound" ? "Calling..." : "● Connected"}
      </div>
      <div style={{ width: 100, height: 100, borderRadius: "50%", background: "linear-gradient(135deg,#1a3320,#166534)", border: "3px solid #22c55e40", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 700, color: "#fff", fontFamily: "'DM Mono',monospace", marginBottom: 24, animation: "activePulse 2s ease infinite" }}>{initials}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: "#f0f0f0", marginBottom: 6, textAlign: "center", padding: "0 32px" }}>{callerName}</div>
      <div style={{ fontSize: 22, color: "#22c55e", fontFamily: "'DM Mono',monospace", marginBottom: 6, letterSpacing: "0.05em" }}>{fmt(elapsed)}</div>
      {callerNumber && <div style={{ fontSize: 12, color: "#4b5563", fontFamily: "'DM Mono',monospace", marginBottom: 52 }}>{callerNumber}</div>}
      <div style={{ display: "flex", gap: 32, alignItems: "flex-end", marginBottom: 48 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <button onClick={onMute} style={{ width: 56, height: 56, borderRadius: "50%", background: muted ? "#f59e0b" : "#1f2937", border: `2px solid ${muted ? "#f59e0b" : "#374151"}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, transition: "all 0.2s" }}>{muted ? "🔇" : "🎙️"}</button>
          <div style={{ fontSize: 11, color: "#6b7280" }}>{muted ? "Unmute" : "Mute"}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <button onClick={onHangUp} style={{ width: 70, height: 70, borderRadius: "50%", background: "#ef4444", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, boxShadow: "0 4px 20px #ef444460" }}>📵</button>
          <div style={{ fontSize: 11, color: "#6b7280" }}>End call</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <button onClick={onSpeaker} style={{ width: 56, height: 56, borderRadius: "50%", background: speaker ? "#3b82f6" : "#1f2937", border: `2px solid ${speaker ? "#3b82f6" : "#374151"}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, transition: "all 0.2s" }}>🔊</button>
          <div style={{ fontSize: 11, color: speaker ? "#3b82f6" : "#6b7280" }}>{speaker ? "Speaker on" : "Speaker"}</div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: "#374151", display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444" }} />
        Call is being recorded
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [planTier, setPlanTier] = useState("solo");
  const [userLimit, setUserLimit] = useState(1);
  const [pwaPrompt, setPwaPrompt] = useState(null); // Android install prompt
  const [showPwaBanner, setShowPwaBanner] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [pdfHtml, setPdfHtml] = useState(null);
  const [view, setView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('xero') || params.has('qb')) return "Settings";
    if (params.has('email_connected') || params.has('email_error')) return "Inbox";
    return "Dashboard";
  });
  const [brand, setBrand] = useState(DEFAULT_BRAND);
  const { reminders, add, dismiss, remove } = useReminders(user?.id);
  const [dueNow, setDueNow] = useState([]);
  const [bellFlash, setBellFlash] = useState(false);
  const [twilioDevice, setTwilioDevice] = useState(null);
  const twilioDeviceRef = useRef(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [callMuted, setCallMuted] = useState(false);
  const [callSpeaker, setCallSpeaker] = useState(true); // browser defaults to speaker
  const [micBlocked, setMicBlocked] = useState(false);
  const now = Date.now();

  // Send push notification to this user via server
  const sendPush = (opts) => {
    if (!user?.id) return;
    fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, ...opts }),
    }).catch(() => {});
  };

  const answerCall = async () => {
    if (!incomingCall) return;
    // Request mic permission explicitly before accepting
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      stream.getTracks().forEach(t => t.stop());
    } catch {
      alert("Microphone access is required to answer calls. Please allow microphone access in your browser/device settings.");
      incomingCall.call.reject();
      setIncomingCall(null);
      setMicBlocked(true);
      return;
    }
    const { call, callerName, callerNumber } = incomingCall;
    call.accept();
    setActiveCall({ call, callerName, callerNumber, direction: "inbound", startTime: Date.now() });
    setIncomingCall(null);
    call.on("disconnect", () => { setActiveCall(null); setCallMuted(false); });
    call.on("error", () => { setActiveCall(null); setCallMuted(false); });
  };

  const declineCall = () => {
    if (!incomingCall) return;
    incomingCall.call.reject();
    setIncomingCall(null);
  };

  const makeCall = async (phoneNumber, customerName) => {
    if (!twilioDevice) { alert("Call tracking is not active. Enable it in Settings."); return; }
    try {
      let num = phoneNumber.replace(/\s/g, "");
      if (num.startsWith("07")) num = "+44" + num.slice(1);
      else if (num.startsWith("0")) num = "+44" + num.slice(1);
      const call = await twilioDevice.connect({ params: { To: num, userId: user.id, customerName: customerName || "Unknown" } });
      setActiveCall({ call, callerName: customerName || phoneNumber, callerNumber: num, direction: "outbound", startTime: Date.now() });
      call.on("disconnect", () => { setActiveCall(null); setCallMuted(false); });
      call.on("error", () => { setActiveCall(null); setCallMuted(false); });
    } catch (err) {
      console.error("makeCall error:", err.message);
      alert("Could not connect the call. Please try again.");
    }
  };

  const hangUp = () => {
    if (activeCall?.call) activeCall.call.disconnect();
    setActiveCall(null);
    setCallMuted(false);
    setCallSpeaker(true);
  };

  const toggleMute = () => {
    if (!activeCall?.call) return;
    const next = !callMuted;
    activeCall.call.mute(next);
    setCallMuted(next);
  };

  const toggleSpeaker = async () => {
    const next = !callSpeaker;
    setCallSpeaker(next);
    // Use setSinkId if available (Chrome/Android) to switch output device
    try {
      const audioElements = document.querySelectorAll("audio");
      if (next) {
        // Switch to speaker — use default output
        audioElements.forEach(el => { if (el.setSinkId) el.setSinkId(""); });
      } else {
        // Switch to earpiece — attempt to use communications device
        const devices = await navigator.mediaDevices.enumerateDevices();
        const earpiece = devices.find(d => d.kind === "audiooutput" && (d.label.toLowerCase().includes("earpiece") || d.label.toLowerCase().includes("receiver")));
        if (earpiece) {
          audioElements.forEach(el => { if (el.setSinkId) el.setSinkId(earpiece.deviceId); });
        }
      }
    } catch {}
  };

  // PDF overlay event listener (iOS PWA fallback)
  useEffect(() => {
    // Fix safe area insets for iPhone notch/dynamic island
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport && !viewport.content.includes('viewport-fit')) {
      viewport.content = viewport.content + ', viewport-fit=cover';
    }
    // Detect iOS and standalone mode
    const ios = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    setIsIos(ios);
    setIsStandalone(standalone);
    if (!standalone) setTimeout(() => setShowPwaBanner(true), 4000);
    // Android — capture install prompt event
    const promptHandler = (e) => { e.preventDefault(); setPwaPrompt(e); };
    window.addEventListener('beforeinstallprompt', promptHandler);
    return () => window.removeEventListener('beforeinstallprompt', promptHandler);
  }, []);

  // Register service worker and push notifications
  useEffect(() => {
    if (!user?.id) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const registerPush = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        // Check existing permission
        if (Notification.permission === "denied") return;

        // Subscribe to push
        const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) return;

        const existing = await reg.pushManager.getSubscription();
        const sub = existing || await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });

        // Save subscription to server
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, subscription: sub.toJSON() }),
        });

        // Listen for notification clicks from service worker
        navigator.serviceWorker.addEventListener("message", e => {
          if (e.data?.type === "NOTIFICATION_CLICK") {
            if (e.data.notifType === "ai_action") setView("Inbox");
            else if (e.data.notifType === "enquiry") setView("Enquiries");
            else if (e.data.notifType === "invoice_paid") setView("Payments");
            else if (e.data.notifType === "call") setView("Customers");
          }
        });
      } catch (err) {
        console.log("Push registration:", err.message);
      }
    };

    registerPush();
  }, [user?.id]);

  // Twilio Voice SDK — register device if user has call tracking active
  useEffect(() => {
    if (!user?.id) return;

    // Destroy any existing device before creating a new one
    if (twilioDeviceRef.current) {
      twilioDeviceRef.current.destroy();
      twilioDeviceRef.current = null;
      setTwilioDevice(null);
    }

    const initDevice = async () => {
      try {
        const { data: ct } = await supabase.from("call_tracking").select("twilio_number").eq("user_id", user.id).limit(1).maybeSingle();
        if (!ct?.twilio_number) return;

        // Check mic permission
        try {
          const perm = await navigator.permissions.query({ name: "microphone" });
          if (perm.state === "denied") { setMicBlocked(true); return; }
          setMicBlocked(false);
          perm.onchange = () => { if (perm.state === "denied") setMicBlocked(true); else setMicBlocked(false); };
        } catch {}

        // Request mic with echo cancellation, noise suppression and auto gain
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }
          });
          stream.getTracks().forEach(t => t.stop());
          setMicBlocked(false);
        } catch {
          setMicBlocked(true);
          return;
        }

        const tokenRes = await fetch("/api/calls/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id }) });
        const { token } = await tokenRes.json();
        if (!token) return;

        const d = new Device(token, {
          logLevel: 1,
          codecPreferences: ["opus", "pcmu"],
          edge: "dublin",
        });

        d.on("incoming", call => {
          console.log("📞 INCOMING CALL FIRED", call.parameters);
          const callerName = call.customParameters?.get("callerName") || "Unknown caller";
          const callerNumber = call.customParameters?.get("callerNumber") || "";
          setIncomingCall({ call, callerName, callerNumber });
          call.on("cancel", () => { console.log("📞 Cancelled"); setIncomingCall(null); });
          call.on("reject", () => { console.log("📞 Rejected"); setIncomingCall(null); });
        });

        d.on("tokenWillExpire", async () => {
          try {
            const r = await fetch("/api/calls/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id }) });
            const rd = await r.json();
            if (rd.token) d.updateToken(rd.token);
          } catch {}
        });

        d.on("error", err => console.log("Twilio Device error:", err.message));

        await d.register();
        twilioDeviceRef.current = d;
        setTwilioDevice(d);
        console.log("✓ Twilio Device registered");
      } catch (err) {
        console.log("Twilio Device init:", err.message);
      }
    };

    initDevice();

    return () => {
      if (twilioDeviceRef.current) {
        twilioDeviceRef.current.destroy();
        twilioDeviceRef.current = null;
        setTwilioDevice(null);
        setIncomingCall(null);
        setActiveCall(null);
        setCallMuted(false);
        setCallSpeaker(true);
      }
    };
  }, [user?.id]);

  useEffect(() => {
    const handler = (e) => setPdfHtml(e.detail);
    window.addEventListener("trade-pa-show-pdf", handler);
    return () => window.removeEventListener("trade-pa-show-pdf", handler);
  }, []);

  // Check existing session on load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Check subscription status whenever user changes
  useEffect(() => {
    if (!user) { setSubscriptionStatus(null); return; }

    // Exempt accounts skip subscription check entirely
    const EXEMPT = ["thetradepa@gmail.com", "connor_mckay777@hotmail.com", "connor_mckay777@hotmail.co.uk", "landbheating@outlook.com", "shannonandrewsimpson@gmail.com"];
    if (EXEMPT.includes(user.email?.toLowerCase())) {
      setSubscriptionStatus("active");
      setPlanTier("pro");
      setUserLimit(10);
      return;
    }

    async function checkSubscription() {
      const { data } = await supabase.from("subscriptions").select("status, current_period_end, stripe_price_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1);
      if (!data?.length) { setSubscriptionStatus("none"); return; }
      const sub = data[0];

      // Determine plan tier from price ID
      const PRICE_TO_PLAN = {
        "price_1THMbUDV8Bu1hOo8Snbfozpl": "solo",
        "price_1THMc0DV8Bu1hOo8BJlaRmjl": "solo",
        "price_1THUQFDV8Bu1hOo8VygjgUMK": "team",
        "price_1THUQbDV8Bu1hOo8uEp3IgBI": "team",
        "price_1THUQsDV8Bu1hOo8b2MXyh1r": "pro",
        "price_1THUR9DV8Bu1hOo8bhrLfaYf": "pro",
      };
      const PLAN_USER_LIMITS = { solo: 1, team: 5, pro: 10 };
      const detectedPlan = PRICE_TO_PLAN[sub.stripe_price_id] || sub.plan || "solo";
      setPlanTier(detectedPlan);
      setUserLimit(PLAN_USER_LIMITS[detectedPlan] || 1);

      if (sub.current_period_end && new Date(sub.current_period_end) < new Date() && sub.status === "active") {
        setSubscriptionStatus("past_due");
      } else {
        setSubscriptionStatus(sub.status);
      }
    }
    checkSubscription();
  }, [user]);

  // Load brand settings — localStorage for instant load, Supabase syncs in background
  const brandSaveCount = useRef(0);
  const brandSaveTimer = useRef(null);

  useEffect(() => {
    if (!user) return;
    brandSaveCount.current = 0;

    // Load from localStorage immediately — fast and synchronous
    try {
      const saved = localStorage.getItem(`trade-pa-brand-${user.id}`);
      if (saved) {
        const loaded = JSON.parse(saved);
        if (isExemptAccount(user.email)) loaded._exemptBypass = true;
        setBrand({ ...DEFAULT_BRAND, ...loaded });
      } else {
        const name = user.user_metadata?.full_name;
        setBrand(b => ({
          ...b,
          ...(name ? { tradingName: `${name}'s Trades` } : {}),
          _exemptBypass: isExemptAccount(user.email),
        }));
      }
    } catch {
      setBrand(b => ({ ...b, _exemptBypass: isExemptAccount(user.email) }));
    }

    // Then check Supabase in background — if newer data exists, update silently
    supabase.from("user_settings")
      .select("brand_data, updated_at")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data?.brand_data) return;
        if (Object.keys(data.brand_data).length === 0) return;
        // Merge Supabase data with local logos
        try {
          const local = JSON.parse(localStorage.getItem(`trade-pa-brand-${user.id}`) || "{}");
          const merged = {
            ...DEFAULT_BRAND,
            ...data.brand_data,
            logo: local.logo || null,
            gasSafeLogo: local.gasSafeLogo || null,
            _exemptBypass: isExemptAccount(user.email),
          };
          setBrand(merged);
          // Update localStorage with merged data
          localStorage.setItem(`trade-pa-brand-${user.id}`, JSON.stringify(merged));
        } catch {}
      })
      .catch(() => {}); // silently ignore if table doesn't exist

  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    brandSaveCount.current++;
    if (brandSaveCount.current <= 1) return;

    // Save to localStorage immediately
    try {
      localStorage.setItem(`trade-pa-brand-${user.id}`, JSON.stringify(brand));
    } catch {
      try {
        const { logo, gasSafeLogo, ...rest } = brand;
        localStorage.setItem(`trade-pa-brand-${user.id}`, JSON.stringify(rest));
      } catch {}
    }

    // Debounce Supabase save — excludes logos (too large)
    if (brandSaveTimer.current) clearTimeout(brandSaveTimer.current);
    brandSaveTimer.current = setTimeout(() => {
      try {
        const { logo, gasSafeLogo, _exemptBypass, ...syncData } = brand;
        supabase.from("user_settings").upsert({
          user_id: user.id,
          brand_data: syncData,
          updated_at: new Date().toISOString(),
        }).catch(() => {});
      } catch {}
    }, 2000);
  }, [brand, user?.id]);

  useEffect(() => {
    if (!user) return;
    brandSaveCount.current++;
    if (brandSaveCount.current <= 1) return;

    // Always save to localStorage immediately (includes logos)
    try {
      localStorage.setItem(`trade-pa-brand-${user.id}`, JSON.stringify(brand));
    } catch {
      try {
        const { logo, gasSafeLogo, ...brandWithoutImages } = brand;
        localStorage.setItem(`trade-pa-brand-${user.id}`, JSON.stringify(brandWithoutImages));
      } catch {}
    }

    // Debounce Supabase save by 2s to avoid hammering on every keystroke
    // Logos excluded — too large and not needed cross-device in the DB
    if (brandSaveTimer.current) clearTimeout(brandSaveTimer.current);
    brandSaveTimer.current = setTimeout(async () => {
      try {
        const { logo, gasSafeLogo, _exemptBypass, ...syncData } = brand;
        await supabase.from("user_settings").upsert({
          user_id: user.id,
          brand_data: syncData,
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn("Brand sync to Supabase failed:", err.message);
      }
    }, 2000);
  }, [brand, user?.id]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setJobsRaw([]); setInvoicesRaw([]); setEnquiriesRaw([]);
    setMaterialsRaw([]); setCustomersRaw([]);
    setCompanyId(null); setCompanyName(""); setMembers([]);
    setUser(null); setView("Dashboard");
  };

  // ── State declarations ────────────────────────────────────────────────────
  const [jobs, setJobsRaw] = useState([]);
  const [invoices, setInvoicesRaw] = useState([]);
  const [enquiries, setEnquiriesRaw] = useState([]);
  const [materials, setMaterialsRaw] = useState([]);
  const [customers, setCustomersRaw] = useState([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [companyId, setCompanyId] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [userRole, setUserRole] = useState("owner");
  const [members, setMembers] = useState([]);
  const [pendingInvite, setPendingInvite] = useState(null);

  // ── Get or create company for user ───────────────────────────────────────
  const getOrCreateCompany = async (uid) => {
    // Check if user already belongs to a company
    const { data: membership } = await supabase
      .from("company_members")
      .select("company_id, role, companies(name)")
      .eq("user_id", uid)
      .single();

    if (membership) {
      setCompanyId(membership.company_id);
        window._companyId = membership.company_id;
      setCompanyName(membership.companies?.name || "");
      setUserRole(membership.role);
      return membership.company_id;
    }

    // Check for pending invite using user's email
    const { data: invite } = await supabase
      .from("invites")
      .select("*")
      .eq("email", user.email)
      .eq("accepted", false)
      .single();

    if (invite) {
      // Accept the invite — join the existing company with permissions from invite
      await supabase.from("company_members").insert({
        company_id: invite.company_id,
        user_id: uid,
        role: invite.role || "member",
        invited_email: user.email,
        permissions: invite.permissions || null,
      });
      await supabase.from("invites").update({ accepted: true }).eq("id", invite.id);
      const { data: co } = await supabase.from("companies").select("name").eq("id", invite.company_id).single();
      setCompanyId(invite.company_id);
      setCompanyName(co?.name || "");
      setUserRole(invite.role || "member");
      setPendingInvite(null);
      return invite.company_id;
    }

    // No company yet — create a new one
    const compName = brand.tradingName || `${user.user_metadata?.full_name || "My"}'s Business`;
    const { data: newCompany } = await supabase
      .from("companies")
      .insert({ name: compName })
      .select()
      .single();

    if (newCompany) {
      await supabase.from("company_members").insert({
        company_id: newCompany.id,
        user_id: uid,
        role: "owner",
      });
      setCompanyId(newCompany.id);
      setCompanyName(newCompany.name);
      setUserRole("owner");
      return newCompany.id;
    }
    return null;
  };

  // ── Load all data from Supabase on login ──────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      setDbLoading(true);
      try {
        const cid = await getOrCreateCompany(user.id);
        if (!cid) { setDbLoading(false); return; }

        // Load members for team management
        const { data: mem } = await supabase
          .from("company_members")
          .select("*, users:user_id(email)")
          .eq("company_id", cid);
        if (mem) setMembers(mem);

        const [j, inv, enq, mat, cust] = await Promise.all([
          supabase.from("jobs").select("*").eq("company_id", cid).order("date_obj", { ascending: true }),
          supabase.from("invoices").select("*").eq("company_id", cid).order("created_at", { ascending: false }),
          supabase.from("enquiries").select("*").eq("company_id", cid).order("created_at", { ascending: false }),
          supabase.from("materials").select("*").eq("company_id", cid).order("created_at", { ascending: true }),
          supabase.from("customers").select("*").eq("company_id", cid).order("name", { ascending: true }),
        ]);
        if (j.data) setJobsRaw(j.data.map(r => ({ ...r, dateObj: r.date_obj })));
        if (inv.data) setInvoicesRaw(inv.data.map(r => ({
          ...r,
          vatEnabled: r.vat_enabled, vatRate: parseFloat(r.vat_rate) || 20,
          vatType: r.vat_type || "", vatZeroRated: r.vat_zero_rated || false,
          isQuote: r.is_quote, paymentMethod: r.payment_method,
          amount: parseFloat(r.amount) || 0,
          grossAmount: parseFloat(r.gross_amount || r.amount) || 0,
          jobRef: r.job_ref || "", address: r.address || "", email: r.email || "",
          lineItems: Array.isArray(r.line_items) ? r.line_items : (r.line_items ? JSON.parse(r.line_items) : []),
          materialItems: Array.isArray(r.material_items) ? r.material_items : (r.material_items ? JSON.parse(r.material_items) : []),
          cisEnabled: r.cis_enabled || false, cisRate: parseFloat(r.cis_rate) || 20,
          cisLabour: parseFloat(r.cis_labour) || 0,
          cisMaterials: parseFloat(r.cis_materials) || 0,
          cisDeduction: parseFloat(r.cis_deduction) || 0,
          cisNetPayable: parseFloat(r.cis_net_payable) || 0,
        })));
        if (enq.data) setEnquiriesRaw(enq.data);
        if (mat.data) setMaterialsRaw(mat.data.map(m => ({
          id: m.id,
          item: m.item || "",
          qty: m.qty || 1,
          unitPrice: m.unit_price || 0,
          supplier: m.supplier || "",
          job: m.job || "",
          status: m.status || "to_order",
          receiptId: m.receipt_id || "",
          receiptSource: m.receipt_source || "",
          receiptFilename: m.receipt_filename || "",
          receiptImage: m.receipt_image || "", // base64 image stored in Supabase
        })));
        if (cust.data) setCustomersRaw(cust.data);
      } catch (e) { console.error("DB load error:", e); }
      setDbLoading(false);
    };
    fetchAll();
  }, [user?.id]);

  // ── Company-aware Supabase setters ────────────────────────────────────────
  const setJobs = (updater) => {
    setJobsRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (!companyId) return next;
      (async () => {
        try {
          const prevIds = new Set(prev.map(j => String(j.id)));
          const nextIds = new Set(next.map(j => String(j.id)));
          for (const id of prevIds) {
            if (!nextIds.has(id)) await supabase.from("jobs").delete().eq("id", id).eq("company_id", companyId);
          }
          for (const job of next) {
            if (!prevIds.has(String(job.id))) {
              await supabase.from("jobs").upsert({
                id: String(job.id), company_id: companyId, user_id: user.id,
                customer: job.customer, address: job.address, type: job.type,
                date: job.date, date_obj: job.dateObj || job.date_obj,
                status: job.status, value: job.value || 0, notes: job.notes || "",
              });
            } else {
              const old = prev.find(j => String(j.id) === String(job.id));
              if (JSON.stringify(old) !== JSON.stringify(job)) {
                await supabase.from("jobs").update({
                  customer: job.customer, address: job.address, type: job.type,
                  date: job.date, date_obj: job.dateObj || job.date_obj,
                  status: job.status, value: job.value || 0, notes: job.notes || "",
                }).eq("id", String(job.id)).eq("company_id", companyId);
              }
            }
          }
        } catch (e) { console.error("Jobs sync:", e); }
      })();
      return next;
    });
  };

  const setInvoices = (updater) => {
    setInvoicesRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (!companyId) return next;
      (async () => {
        try {
          const prevIds = new Set(prev.map(i => i.id));
          const nextIds = new Set(next.map(i => i.id));
          for (const id of prevIds) {
            if (!nextIds.has(id)) await supabase.from("invoices").delete().eq("id", id).eq("company_id", companyId);
          }
          for (const inv of next) {
            const invRow = {
              id: inv.id, company_id: companyId, user_id: user.id,
              customer: inv.customer || "", amount: inv.amount || 0,
              gross_amount: inv.grossAmount || inv.amount || 0,
              due: inv.due, status: inv.status,
              description: inv.description || "",
              address: inv.address || "", email: inv.email || "",
              vat_enabled: inv.vatEnabled || false, vat_rate: inv.vatRate || 20,
              vat_type: inv.vatType || "", vat_zero_rated: inv.vatZeroRated || false,
              payment_method: inv.paymentMethod || "both",
              is_quote: inv.isQuote || false,
              job_ref: inv.jobRef || "",
              cis_enabled: inv.cisEnabled || false, cis_rate: inv.cisRate || 20,
              cis_labour: inv.cisLabour || 0, cis_materials: inv.cisMaterials || 0,
              cis_deduction: inv.cisDeduction || 0, cis_net_payable: inv.cisNetPayable || 0,
              line_items: JSON.stringify(inv.lineItems || []),
              material_items: JSON.stringify(inv.materialItems || []),
            };
            if (!prevIds.has(inv.id)) {
              await supabase.from("invoices").upsert(invRow);
            } else {
              const old = prev.find(i => i.id === inv.id);
              if (JSON.stringify(old) !== JSON.stringify(inv)) {
                const { id, company_id, user_id, ...updateFields } = invRow;
                await supabase.from("invoices").update(updateFields).eq("id", inv.id).eq("company_id", companyId);
              }
            }
          }
        } catch (e) { console.error("Invoices sync:", e); }
      })();
      return next;
    });
  };

  const setEnquiries = (updater) => {
    setEnquiriesRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (!companyId) return next;
      (async () => {
        try {
          await supabase.from("enquiries").delete().eq("company_id", companyId);
          if (next.length > 0) {
            await supabase.from("enquiries").insert(
              next.map(e => ({ company_id: companyId, user_id: user.id, name: e.name, source: e.source, msg: e.msg, time: e.time, urgent: e.urgent || false, status: e.status || "new", phone: e.phone || "", email: e.email || "", address: e.address || "" }))
            );
          }
        } catch (e) { console.error("Enquiries sync:", e); }
      })();
      return next;
    });
  };

  const setMaterials = (updater) => {
    setMaterialsRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (!companyId) return next;
      (async () => {
        try {
          await supabase.from("materials").delete().eq("company_id", companyId);
          if (next.length > 0) {
            await supabase.from("materials").insert(
              next.map(m => ({ company_id: companyId, user_id: user.id, item: m.item, qty: m.qty || 1, unit_price: m.unitPrice || 0, supplier: m.supplier || "", job: m.job || "", status: m.status || "to_order", receipt_id: m.receiptId || "", receipt_source: m.receiptSource || "", receipt_filename: m.receiptFilename || "", receipt_image: m.receiptImage || "" }))
            );
          }
        } catch (e) { console.error("Materials sync:", e); }
      })();
      return next;
    });
  };

  const setCustomers = (updater) => {
    setCustomersRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (!companyId) return next;
      (async () => {
        try {
          const prevIds = new Set(prev.map(c => c.id));
          const nextIds = new Set(next.map(c => c.id));
          for (const id of prevIds) {
            if (!nextIds.has(id)) await supabase.from("customers").delete().eq("id", id).eq("company_id", companyId);
          }
          for (const c of next) {
            if (!prevIds.has(c.id)) {
              await supabase.from("customers").insert({
                company_id: companyId, user_id: user.id,
                name: c.name, phone: c.phone || "", email: c.email || "",
                address: c.address || "", notes: c.notes || "",
              });
            } else {
              const old = prev.find(x => x.id === c.id);
              if (JSON.stringify(old) !== JSON.stringify(c)) {
                await supabase.from("customers").update({
                  name: c.name, phone: c.phone || "", email: c.email || "",
                  address: c.address || "", notes: c.notes || "",
                }).eq("id", c.id).eq("company_id", companyId);
              }
            }
          }
        } catch (e) { console.error("Customers sync:", e); }
      })();
      return next;
    });
  };

  // Watch for reminders that just became due
  useEffect(() => {
    const t = setInterval(() => {
      const due = reminders.filter(r => !r.done && !r._due && r.time <= Date.now() && r.time > Date.now() - 60000);
      if (due.length > 0) {
        setDueNow(d => [...d, ...due.filter(r => !d.find(x => x.id === r.id))]);
        setBellFlash(true);
        setTimeout(() => setBellFlash(false), 3000);
        due.forEach(r => dismiss(r.id));
      }
    }, 5000);
    return () => clearInterval(t);
  }, [reminders]);

  const upcomingCount = reminders.filter(r => !r.done && !r._due && r.time > now).length;
  const overdueCount = reminders.filter(r => !r.done && !r._due && r.time <= now).length;
  const alertCount = dueNow.length + overdueCount;

  // Auth gate
  if (authLoading) return (
    <div style={{ minHeight: "100vh", background: "#0f0f0f", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono',monospace", color: "#6b7280", fontSize: 13 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;700&display=swap');`}</style>
      Loading Trade PA...
    </div>
  );

  if (!user) return <LandingPage onLogin={() => {}} onAuth={setUser} />;

  // Accounts that bypass the subscription check (owner/test accounts)
  const isExempt = isExemptAccount(user?.email);

  // Subscription paywall — blocks access if payment has lapsed
  if (!isExempt && (subscriptionStatus === "past_due" || subscriptionStatus === "cancelled" || subscriptionStatus === "none")) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'DM Mono',monospace" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;700&family=Syne:wght@700;800&display=swap');`}</style>
        <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, background: "#f59e0b", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: "#000", margin: "0 auto 24px", letterSpacing: "-0.02em" }}>TP</div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 800, color: "#f0f0f0", marginBottom: 12 }}>
            {subscriptionStatus === "past_due" ? "Payment Required" : subscriptionStatus === "none" ? "No Active Subscription" : "Subscription Ended"}
          </div>
          <div style={{ fontSize: 14, color: "#888", lineHeight: 1.7, marginBottom: 32 }}>
            {subscriptionStatus === "past_due"
              ? "Your last payment didn't go through. Please update your payment details to restore access."
              : subscriptionStatus === "none"
              ? "You don't have an active subscription. Subscribe to get full access to Trade PA."
              : "Your subscription has ended. Resubscribe to continue using Trade PA."}
          </div>
          <a href="https://www.tradespa.co.uk/signup.html" style={{ display: "block", background: "#f59e0b", color: "#000", padding: "16px 32px", borderRadius: 10, fontWeight: 700, fontSize: 15, textDecoration: "none", marginBottom: 12 }}>
            {subscriptionStatus === "past_due" ? "Update Payment Details →" : "Subscribe Now →"}
          </a>
          <button onClick={async () => { await supabase.auth.signOut(); setUser(null); }} style={{ background: "transparent", border: "none", color: "#555", fontSize: 13, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (dbLoading) return (
    <div style={{ minHeight: "100vh", background: "#0f0f0f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono',monospace", color: "#6b7280", fontSize: 13, gap: 12 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;700&display=swap');`}</style>
      <div style={{ fontSize: 28 }}>⚡</div>
      <div style={{ color: "#f59e0b", fontWeight: 700 }}>TRADE PA</div>
      <div>Loading your data...</div>
    </div>
  );

  return (
    <div style={S.app}>
      {pdfHtml && <PDFOverlay html={pdfHtml} onClose={() => setPdfHtml(null)} />}
      {incomingCall?.call && <IncomingCallScreen callerName={incomingCall.callerName} callerNumber={incomingCall.callerNumber} onAnswer={answerCall} onDecline={declineCall} />}
      {activeCall?.call && <ActiveCallScreen callerName={activeCall.callerName} callerNumber={activeCall.callerNumber} direction={activeCall.direction} startTime={activeCall.startTime} muted={callMuted} onMute={toggleMute} onHangUp={hangUp} speaker={callSpeaker} onSpeaker={toggleSpeaker} />}
      {micBlocked && (
        <div style={{ position: "fixed", top: "max(52px, env(safe-area-inset-top, 52px))", left: 0, right: 0, zIndex: 200, background: "#ef4444", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16 }}>🎙️</span>
          <div style={{ flex: 1, fontSize: 12, color: "#fff", lineHeight: 1.5 }}>
            <strong>Microphone blocked</strong> — calls can't ring in the app. Go to your browser/device settings and allow microphone access for Trade PA.
          </div>
          <button onClick={() => setMicBlocked(false)} style={{ background: "none", border: "none", color: "#fff", fontSize: 18, cursor: "pointer", padding: "0 4px" }}>×</button>
        </div>
      )}

      {/* PWA Install Banner */}
      {showPwaBanner && !isStandalone && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 500, padding: "12px 16px", paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))", background: "#1a1a1a", borderTop: "1px solid #2a2a2a", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, background: "#f59e0b", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, color: "#000", flexShrink: 0 }}>TP</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f0f0f0" }}>Install Trade PA</div>
            {isIos
              ? <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>Tap <strong style={{ color: "#f59e0b" }}>Share</strong> then <strong style={{ color: "#f59e0b" }}>Add to Home Screen</strong></div>
              : <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>Add to your home screen for the best experience</div>
            }
          </div>
          {pwaPrompt && !isIos && (
            <button onClick={async () => { pwaPrompt.prompt(); const { outcome } = await pwaPrompt.userChoice; if (outcome === "accepted") setShowPwaBanner(false); }} style={{ background: "#f59e0b", color: "#000", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono',monospace", flexShrink: 0 }}>Install →</button>
          )}
          <button onClick={() => setShowPwaBanner(false)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 20, flexShrink: 0, padding: "0 4px" }}>×</button>
        </div>
      )}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html,body{width:100%;overflow-x:hidden;background:#0f0f0f;}
        ::-webkit-scrollbar{width:5px;}
        ::-webkit-scrollbar-track{background:#1a1a1a;}
        ::-webkit-scrollbar-thumb{background:#333;border-radius:3px;}
        .nav-scroll::-webkit-scrollbar{display:none;}
        button:hover:not(:disabled){opacity:0.82;}
        input:focus,textarea:focus{border-color:#f59e0b !important;outline:none;}
        @keyframes bellPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.3)}}
        img{max-width:100%;}
      `}</style>
      <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 100, width: "100%" }}>
        {/* Top row — logo and right icons */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", paddingTop: "max(12px, env(safe-area-inset-top, 12px))", height: "calc(48px + env(safe-area-inset-top, 0px))", boxSizing: "border-box" }}>
          <div style={S.logo}>
            <div style={S.logoIcon}>TP</div>
            TRADE PA
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div onClick={() => setView("Reminders")} style={{ position: "relative", cursor: "pointer", padding: "4px 6px" }}>
              <span style={{ fontSize: 18, display: "block", animation: bellFlash ? "bellPulse 0.4s ease 3" : "none" }}>🔔</span>
              {alertCount > 0 && <div style={{ position: "absolute", top: 0, right: 0, width: 16, height: 16, background: C.red, borderRadius: "50%", fontSize: 9, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.bg}` }}>{alertCount}</div>}
              {alertCount === 0 && upcomingCount > 0 && <div style={{ position: "absolute", top: 0, right: 0, width: 16, height: 16, background: C.amber, borderRadius: "50%", fontSize: 9, fontWeight: 700, color: "#000", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.bg}` }}>{upcomingCount}</div>}
            </div>
            {members.length > 1 && (
              <div onClick={() => setView("Settings")} style={{ fontSize: 10, color: C.muted, background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, padding: "2px 8px", cursor: "pointer" }}>
                👥 {members.length}
              </div>
            )}
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.green }} />
            <button onClick={handleLogout} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 8px", color: C.muted }}>Out</button>
          </div>
        </div>
        {/* Nav row — filtered by permissions for members */}
        <div className="nav-scroll" style={{ display: "flex", overflowX: "auto", WebkitOverflowScrolling: "touch", padding: "0 12px 8px", gap: 2, scrollbarWidth: "none" }}>
          {VIEWS.filter(v => {
            if (userRole === "owner") return true;
            if (v === "Settings") return false; // members never see Settings
            const myMember = members.find(m => m.user_id === user?.id);
            const perms = myMember?.permissions;
            if (!perms) return true; // no restrictions set yet
            return perms[v] !== false;
          }).map(v => (
            <button key={v} onClick={() => setView(v)} style={{ ...S.navBtn(view === v), flexShrink: 0 }}>{v}</button>
          ))}
        </div>
      </header>
      <main style={{ ...S.main, paddingTop: view === "AI Assistant" || view === "Reminders" ? 16 : 24 }}>
        {(() => {
          // Guard — redirect member to Dashboard if they're on a tab they can't access
          if (userRole !== "owner" && view !== "Dashboard") {
            const myMember = members.find(m => m.user_id === user?.id);
            const perms = myMember?.permissions;
            if (perms && perms[view] === false) {
              return <div style={{ ...S.card, textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>🔒</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Access Restricted</div>
                <div style={{ fontSize: 12, color: C.muted }}>You don't have permission to view this section. Contact your account owner.</div>
              </div>;
            }
          }
          return null;
        })()}
        {view === "Dashboard" && <Dashboard setView={setView} jobs={jobs} invoices={invoices} enquiries={enquiries} brand={brand} />}
        {view === "Schedule" && <Schedule jobs={jobs} setJobs={setJobs} customers={customers} />}
        {view === "Enquiries" && <EnquiriesTab enquiries={enquiries} setEnquiries={setEnquiries} customers={customers} setCustomers={setCustomers} invoices={invoices} setInvoices={setInvoices} brand={brand} user={user} setView={setView} />}
        {view === "Jobs" && <JobsTab user={user} brand={brand} customers={customers} invoices={invoices} setInvoices={setInvoices} setView={setView} />}
        {view === "Customers" && <Customers customers={customers} setCustomers={setCustomers} jobs={jobs} invoices={invoices} setView={setView} user={user} makeCall={makeCall} hasTwilio={!!twilioDevice} />}
        {view === "Invoices" && <InvoicesView brand={brand} invoices={invoices} setInvoices={setInvoices} user={user} customers={customers} />}
        {view === "Quotes" && <QuotesView brand={brand} invoices={invoices} setInvoices={setInvoices} setView={setView} user={user} customers={customers} />}
        {view === "Materials" && <Materials materials={materials} setMaterials={setMaterials} jobs={jobs} user={user} />}
        {view === "Expenses" && <ExpensesTab user={user} />}
        {view === "CIS" && <CISStatementsTab user={user} />}
        {view === "AI Assistant" && <AIAssistant brand={brand} jobs={jobs} setJobs={setJobs} invoices={invoices} setInvoices={setInvoices} enquiries={enquiries} setEnquiries={setEnquiries} materials={materials} setMaterials={setMaterials} customers={customers} setCustomers={setCustomers} onAddReminder={add} setView={setView} user={user} />}
        {view === "Reminders" && <Reminders reminders={reminders} onAdd={add} onDismiss={dismiss} onRemove={remove} dueNow={dueNow} onClearDue={() => setDueNow([])} />}
        {view === "Payments" && <Payments brand={brand} invoices={invoices} setInvoices={setInvoices} customers={customers} user={user} sendPush={sendPush} />}
        {view === "Inbox" && <InboxView user={user} brand={brand} jobs={jobs} setJobs={setJobs} invoices={invoices} setInvoices={setInvoices} enquiries={enquiries} setEnquiries={setEnquiries} materials={materials} setMaterials={setMaterials} customers={customers} setCustomers={setCustomers} setLastAction={() => {}} />}
        {view === "Settings" && <ErrorBoundary><Settings brand={brand} setBrand={setBrand} companyId={companyId} companyName={companyName} userRole={userRole} members={members} user={user} planTier={planTier} userLimit={userLimit} /></ErrorBoundary>}
      </main>
    </div>
  );
}
