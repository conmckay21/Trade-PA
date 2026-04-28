import React, { useState, useEffect } from "react";
import { AuthScreen } from "./AuthScreen.jsx";

// ─── Voice Hero Card (cycling live voice → action demo) ──────────────────────
function VoiceHeroCard() {
  const [phase, setPhase] = useState("LISTENING");
  const [timer, setTimer] = useState("00:00");
  const [transcript, setTranscript] = useState([]);   // array of { text, entity }
  const [actions, setActions] = useState([]);          // revealed actions
  const [scenarioIdx, setScenarioIdx] = useState(0);

  const scenarios = [
    {
      segments: [
        { t: "Book ", entity: false },
        { t: "Lisa Thompson", entity: true },
        { t: " in for a ", entity: false },
        { t: "boiler service Thursday", entity: true },
        { t: ", add two metres of ", entity: false },
        { t: "22mm copper", entity: true },
        { t: " from City Plumbing to the quote I did last week, and chase the invoice from the ", entity: false },
        { t: "Maple Avenue", entity: true },
        { t: " job.", entity: false },
      ],
      actions: [
        ["Booked Lisa Thompson", "Thursday 11:30 — boiler service"],
        ["Materials added", "£59.40 of 22mm copper to Maple Ave quote"],
        ["Chase email sent", "Maple Ave — gentle reminder"],
      ],
    },
    {
      segments: [
        { t: "Raise an invoice for the ", entity: false },
        { t: "Wilson bathroom refit", entity: true },
        { t: " — ", entity: false },
        { t: "£2,400 labour", entity: true },
        { t: ", materials off the receipts, and send ", entity: false },
        { t: "Dave", entity: true },
        { t: " a gentle chase on last week's quote.", entity: false },
      ],
      actions: [
        ["Invoice #INV-091 raised", "Wilson bathroom refit — £2,712.40"],
        ["Materials matched", "£312.40 pulled from receipts"],
        ["Chase sent to Dave", "Gentle reminder — 3 days since quote"],
      ],
    },
    {
      segments: [
        { t: "Draft a ", entity: false },
        { t: "RAMS", entity: true },
        { t: " for tomorrow — ", entity: false },
        { t: "working at height", entity: true },
        { t: ", pitched roof, scaffold tower — and send the ", entity: false },
        { t: "CP12", entity: true },
        { t: " for the Patel job.", entity: false },
      ],
      actions: [
        ["RAMS drafted", "Working at height — 7 hazards, 6 steps"],
        ["PDF generated", "Ready to share with client"],
        ["CP12 sent to Patel", "Branded PDF — Gmail"],
      ],
    },
  ];

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  useEffect(() => {
    let cancelled = false;
    let timerInt = null;
    const start = Date.now();

    const run = async () => {
      const s = scenarios[scenarioIdx];

      setPhase("LISTENING");
      setTranscript([]);
      setActions([]);

      timerInt = setInterval(() => {
        if (cancelled) return;
        const sec = Math.floor((Date.now() - start) / 1000);
        setTimer(`00:${String(sec).padStart(2, "0")}`);
      }, 100);

      await sleep(700); if (cancelled) return;
      setPhase("TRANSCRIBING");

      // typewriter
      const built = [];
      for (const seg of s.segments) {
        built.push({ text: "", entity: seg.entity });
        for (let i = 0; i < seg.t.length; i++) {
          built[built.length - 1].text += seg.t[i];
          setTranscript([...built]);
          await sleep(18 + Math.random() * 20);
          if (cancelled) return;
        }
      }

      await sleep(400); if (cancelled) return;
      setPhase("THINKING");
      await sleep(600); if (cancelled) return;
      setPhase("EXECUTING");

      for (let i = 0; i < s.actions.length; i++) {
        if (cancelled) return;
        setActions(s.actions.slice(0, i + 1));
        await sleep(280);
      }

      await sleep(300); if (cancelled) return;
      setPhase("DONE");
      clearInterval(timerInt); timerInt = null;

      await sleep(3400); if (cancelled) return;
      setScenarioIdx((i) => (i + 1) % scenarios.length);
    };

    run();
    return () => { cancelled = true; if (timerInt) clearInterval(timerInt); };
  }, [scenarioIdx]);

  const barHeights = [30, 60, 45, 80, 35, 70, 25, 55, 75, 40, 65, 30, 80, 50, 90, 35, 60, 70, 40, 55, 25, 65, 45, 75, 30, 50, 80, 60, 35, 70];

  return (
    <div style={{
      background: "linear-gradient(180deg, #1a1a1a, #141414)",
      border: "1px solid #2a2a2a",
      borderRadius: 16,
      overflow: "hidden",
      boxShadow: "0 40px 100px -40px rgba(0,0,0,0.9), 0 0 0 1px rgba(245,158,11,0.08)",
      position: "relative",
      fontFamily: "'DM Mono',monospace",
      maxWidth: 520,
      margin: "0 auto",
    }}>
      <div style={{ position: "absolute", inset: -1, borderRadius: 16, background: "linear-gradient(180deg, rgba(245,158,11,0.3), transparent 35%)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "relative", zIndex: 1 }}>

        {/* Head */}
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #1e1e1e", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", animation: "vc-pulse 1.6s ease-in-out infinite" }} />
            <span style={{ fontSize: 10, letterSpacing: "0.14em", fontWeight: 700, color: "#f59e0b" }}>{phase}</span>
          </div>
          <span style={{ fontSize: 10, letterSpacing: "0.14em", color: "#666" }}>{timer}</span>
        </div>

        {/* Waveform */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, height: 56, padding: "12px 16px 8px" }}>
          {barHeights.map((h, i) => (
            <div key={i} className="vc-bar" style={{
              width: 3,
              background: "#f59e0b",
              borderRadius: 2,
              "--h": h + "%",
              animationDelay: (i * 40) + "ms",
              animationDuration: (0.6 + (i % 5) * 0.12) + "s",
            }} />
          ))}
        </div>

        {/* Transcript */}
        <div style={{ padding: "4px 20px 16px", minHeight: 80, fontSize: 14, lineHeight: 1.4, letterSpacing: "-0.01em", color: "#f0f0f0", fontStyle: "italic" }}>
          {transcript.map((seg, i) => (
            <span key={i} style={seg.entity ? { color: "#f59e0b", fontWeight: 700 } : {}}>{seg.text}</span>
          ))}
          <span className="vc-caret" style={{ display: "inline-block", width: 2, height: "0.85em", background: "#f59e0b", marginLeft: 2, verticalAlign: "middle" }} />
        </div>

        {/* Actions */}
        <div style={{ borderTop: "1px solid #1e1e1e", padding: "14px 20px 18px", display: "flex", flexDirection: "column", gap: 8, minHeight: 146 }}>
          {actions.map((a, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, animation: "vc-reveal 0.4s cubic-bezier(0.2,0.7,0.2,1) both" }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#10b981", color: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</div>
              <div style={{ fontSize: 11.5, lineHeight: 1.45, color: "#ccc" }}>
                <span style={{ color: "#f0f0f0", fontWeight: 700 }}>{a[0]}</span> — {a[1]}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

// ─── Inbox Demo Card (cycling AI actions queue) ───────────────────────────────
function InboxDemoCard() {
  const [items, setItems] = useState([]);
  const [scenarioIdx, setScenarioIdx] = useState(0);

  const scenarios = [
    [
      { e: "📧", t: "New booking — Mrs. Patel", color: "#3b82f6", d: "Hi, please book me in for the boiler service on Thursday morning.", state: "pending" },
      { e: "🧾", t: "Invoice paid — Wilson Job #084", color: "#f59e0b", d: "BACS £1,240.00 received. Reference: INV-084-WILSON.", state: "done" },
      { e: "🔧", t: "Material receipt — Plumbase", color: "#10b981", d: "2× 22mm elbow, 1× PTFE tape — £17.88 inc VAT.", state: "pending" },
      { e: "📋", t: "Quote request — 14 Grange Rd", color: "#3b82f6", d: "Looking for a new combi install quote, gas safe required.", state: "pending" },
    ],
    [
      { e: "🏗", t: "CIS statement — ABC Construction", color: "#10b981", d: "Gross £4,200 · Deduction £840 · Net £3,360 — PDF attached.", state: "pending" },
      { e: "📅", t: "Reschedule — Mr. Davies", color: "#f59e0b", d: "Can we push Tuesday's appointment to next Friday morning instead?", state: "pending" },
      { e: "💬", t: "Review request sent — Burns job", color: "#3b82f6", d: "Auto-sent 24h after completion. Awaiting response.", state: "done" },
      { e: "⛽", t: "Quote chase — 22 Linden Close", color: "#f59e0b", d: "Gentle reminder auto-drafted — 3 days since initial quote.", state: "pending" },
    ],
  ];

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const s = scenarios[scenarioIdx];
      setItems([]);
      await sleep(200);

      // staggered reveal
      for (let i = 0; i < s.length; i++) {
        if (cancelled) return;
        setItems(s.slice(0, i + 1).map((it, idx) => ({ ...it, shown: true })));
        await sleep(340);
      }

      // auto-approve first pending after brief hold
      await sleep(1400); if (cancelled) return;
      const firstPendingIdx = s.findIndex(it => it.state === "pending");
      if (firstPendingIdx !== -1) {
        const updated = s.map((it, idx) => idx === firstPendingIdx ? { ...it, state: "done", shown: true } : { ...it, shown: true });
        setItems(updated);
      }

      await sleep(3600); if (cancelled) return;
      setScenarioIdx(i => (i + 1) % scenarios.length);
    };
    run();
    return () => { cancelled = true; };
  }, [scenarioIdx]);

  return (
    <div style={{ background: "#141414", border: "1px solid #222", borderRadius: 16, padding: 20, boxShadow: "0 32px 80px rgba(0,0,0,0.5)", fontFamily: "'DM Mono',monospace" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 14, borderBottom: "1px solid #1e1e1e", marginBottom: 12 }}>
        <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#ef4444" }} />
        <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#f59e0b" }} />
        <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#10b981" }} />
        <span style={{ fontSize: 10, color: "#444", marginLeft: 8 }}>Trade PA — AI Actions</span>
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 9, letterSpacing: "0.14em", color: "#f59e0b" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", animation: "vc-pulse 2s ease-in-out infinite" }} /> LIVE
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 320 }}>
        {items.map((item, i) => {
          const isPending = item.state === "pending";
          const isDone = item.state === "done";
          return (
            <div key={`${scenarioIdx}-${i}`} style={{
              display: "grid",
              gridTemplateColumns: "28px 1fr auto",
              gap: 12,
              alignItems: "center",
              padding: "12px 14px",
              borderRadius: 10,
              background: isDone ? "rgba(16,185,129,0.06)" : "rgba(245,158,11,0.04)",
              border: isDone ? "1px solid rgba(16,185,129,0.25)" : "1px solid rgba(245,158,11,0.18)",
              animation: "vc-reveal 0.5s cubic-bezier(0.2,0.7,0.2,1) both",
            }}>
              <div style={{ fontSize: 18 }}>{item.e}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: item.color, marginBottom: 2, lineHeight: 1.3 }}>{item.t}</div>
                <div style={{ fontSize: 11.5, color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.d}</div>
              </div>
              <div style={{
                padding: "5px 11px",
                borderRadius: 999,
                fontSize: 10.5,
                fontWeight: 700,
                background: isDone ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.15)",
                color: isDone ? "#10b981" : "#f59e0b",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                whiteSpace: "nowrap",
              }}>
                {isDone ? "✓ Approved" : "Pending"}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ padding: "12px 4px 0", marginTop: 10, borderTop: "1px solid #1e1e1e", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 9.5, color: "#555", letterSpacing: "0.1em" }}>
        <span>INBOX · SCANNED 14s AGO</span>
        <span style={{ color: "#10b981" }}>✓ 3 drafted · 1 waiting</span>
      </div>
    </div>
  );
}

// ─── Landing Page ─────────────────────────────────────────────────────────────
export function LandingPage({ onAuth }) {
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

        /* Responsive hero two-column grid */
        .lp-hero-grid{display:grid;grid-template-columns:1fr;gap:48px;max-width:1180px;margin:0 auto;align-items:center;text-align:center;}
        .lp-hero-left{text-align:center;}
        .lp-hero-ctas{justify-content:center;}
        @media (min-width: 960px){
          .lp-hero-grid{grid-template-columns:1.05fr 1fr;gap:56px;text-align:left;}
          .lp-hero-left{text-align:left;}
          .lp-hero-ctas{justify-content:flex-start;}
        }

        /* Responsive pricing grid. Goes:
             - <640px       → 1 col (stacked)
             - 640-1199px   → 2x2 grid (two per row)
             - ≥1200px      → 4 across in one row
           Deliberately skips the "3 cards per row" zone to avoid a
           lonely 4th card wrapping underneath. */
        .lp-pricing-grid{display:grid;grid-template-columns:1fr;gap:16px;margin-bottom:24px;}
        @media (min-width: 640px){
          .lp-pricing-grid{grid-template-columns:repeat(2, 1fr);}
        }
        @media (min-width: 1200px){
          .lp-pricing-grid{grid-template-columns:repeat(4, 1fr);}
        }

        /* Voice card animations */
        @keyframes vc-pulse{0%,100%{opacity:0.4;box-shadow:0 0 0 0 rgba(245,158,11,0.4);}50%{opacity:1;box-shadow:0 0 0 5px transparent;}}
        @keyframes vc-wave{0%,100%{height:8%;}50%{height:var(--h,60%);}}
        @keyframes vc-reveal{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
        .vc-bar{animation:vc-wave 1s ease-in-out infinite;}
        .vc-caret{animation:vc-caret 0.8s steps(1) infinite;}
        @keyframes vc-caret{50%{opacity:0;}}
      `}</style>

      {/* NAV */}
      <nav style={LP.nav}>
        <div style={LP.logo}><div style={LP.logoIcon}>TP</div>TRADE PA</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setScreen("login")} style={{ ...LP.btnGhost, padding: "8px 18px", fontSize: 13 }} className="lp-btn-ghost">Log in</button>
          <button onClick={() => window.location.href="/signup.html"} style={{ ...LP.btnPrimary, padding: "8px 20px", fontSize: 13 }} className="lp-btn-primary">Start free trial →</button>
        </div>
      </nav>

      {/* HERO */}
      <div style={LP.hero}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(245,158,11,0.04) 1px, transparent 1px),linear-gradient(90deg,rgba(245,158,11,0.04) 1px,transparent 1px)", backgroundSize: "56px 56px", WebkitMaskImage: "radial-gradient(ellipse at center, black 0%, transparent 70%)", maskImage: "radial-gradient(ellipse at center, black 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: 500, height: 500, background: "radial-gradient(circle, rgba(245,158,11,0.1) 0%, transparent 70%)", top: "50%", left: "50%", transform: "translate(-50%,-60%)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div className="lp-hero-grid">
            <div className="lp-hero-left">
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 100, padding: "6px 16px", fontFamily: "'DM Mono',monospace", fontSize: 11, color: "#f59e0b", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 28 }}>
                <div style={{ width: 6, height: 6, background: "#f59e0b", borderRadius: "50%", animation: "pulse 2s infinite" }} />
                Voice-first · Inbox-monitored · UK-built
              </div>
              <h1 style={LP.h1}>Your PA works<br/><span style={{ color: "#f59e0b" }}>when you can't.</span></h1>
              <p style={{ ...LP.sub, margin: "0 0 40px" }}>Trade PA reads every email 24/7, drafts every action, chases every unpaid invoice — and waits for one tap to approve. Voice-controlled for when you're on the tools. The admin assistant that runs your business while you run the jobs.</p>
              <div className="lp-hero-ctas" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                <button onClick={() => window.location.href="/signup.html"} style={LP.btnPrimary} className="lp-btn-primary">Start 30-day free trial →</button>
                <button onClick={() => setScreen("login")} style={LP.btnGhost} className="lp-btn-ghost">Log in</button>
              </div>
              <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#f59e0b", letterSpacing: "0.06em", marginBottom: 10 }}>✓ Free for 30 days · No charge until day 31 · Cancel anytime</p>
              <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "#555", letterSpacing: "0.06em" }}>Works with Gmail &amp; Outlook · Built for UK Trades</p>
            </div>
            <div>
              <VoiceHeroCard />
            </div>
          </div>
        </div>
      </div>

      {/* INBOX PA */}
      <div style={{ padding: "72px 24px 0", borderTop: "1px solid #1a1a1a" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={LP.sectionLabel}>The inbox that runs itself</div>
            <h2 style={LP.h2}>An inbox that works<br/>while you sleep.</h2>
            <p style={{ fontSize: 16, color: "#888", maxWidth: 560, margin: "16px auto 0", lineHeight: 1.7 }}>16 email types. 3 trigger paths. 1 learning loop that gets smarter with every tap.</p>
          </div>

          {/* AI Actions demo mockup */}
          <div style={{ maxWidth: 680, margin: "0 auto 56px" }}>
            <InboxDemoCard />
          </div>

          {/* 3 Pathway cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 24 }}>
            {[
              {
                tag: "Path 1",
                title: "Voice or chat → instant send",
                body: "Say \"Send Glenn his invoice.\" Fires immediately — branded PDF from your Gmail or Outlook.",
                examples: ["Invoice & quote send", "Chase (gentle → firm → final)", "Review request", "Compliance certificate"],
                highlight: false,
              },
              {
                tag: "Path 2",
                title: "Inbox monitoring → approve",
                body: "Checks inbox hourly. Analyses every email against 10 pattern rules. Drafts an action. Tap approve — executes + auto-replies.",
                examples: ["Job booking (new or existing)", "Quote acceptance reply", "Reschedule / cancellation", "Completion confirmation"],
                highlight: true,
              },
              {
                tag: "Path 3",
                title: "Daily automation → proactive",
                body: "8am loop. Queries the database for follow-up candidates. Sends. Marks the timestamp so it never sends twice.",
                examples: ["Quote follow-up at 3 days", "Appointment reminder", "Auto review request post-job"],
                highlight: false,
              },
            ].map((p) => (
              <div key={p.tag} style={{ background: p.highlight ? "#1a1a1a" : "#141414", border: p.highlight ? "1px solid rgba(245,158,11,0.3)" : "1px solid #222", borderRadius: 14, padding: "24px 22px", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 3, background: "#f59e0b" }} />
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "#f59e0b", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>{p.tag}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 14, color: "#f0f0f0", marginBottom: 10, lineHeight: 1.35 }}>{p.title}</div>
                <div style={{ fontSize: 12.5, color: "#888", lineHeight: 1.65, marginBottom: 14 }}>{p.body}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {p.examples.map(ex => (
                    <div key={ex} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#666" }}>
                      <span style={{ color: "#f59e0b", fontSize: 10 }}>•</span>{ex}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Learning loop callout */}
          <div style={{ textAlign: "center", padding: "20px 28px", background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 14, marginBottom: 72 }}>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: "#f59e0b", fontWeight: 700 }}>↻ Learning loop:</span>
            <span style={{ fontSize: 13, color: "#888", marginLeft: 10, lineHeight: 1.7 }}>every approved action teaches the system — known suppliers, customers, job types. Rejected actions teach it harder. Sharper with every tap.</span>
          </div>
        </div>
      </div>

      {/* VOICE PA */}
      <div style={{ padding: "72px 24px", background: "#0d0d0d", borderTop: "1px solid #1a1a1a", borderBottom: "1px solid #1a1a1a" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={LP.sectionLabel}>Voice that thinks like a PA</div>
            <h2 style={LP.h2}>Talk once. Done.<br/>Next job.</h2>
            <p style={{ fontSize: 16, color: "#888", maxWidth: 560, margin: "16px auto 0", lineHeight: 1.7 }}>Not dictation. Direction. One spoken sentence, multiple actions completed — while you carry the tools, not the phone.</p>
          </div>

          {/* Example conversation */}
          <div style={{ maxWidth: 680, margin: "0 auto 48px" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 14 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>🎙</div>
              <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 14, padding: "14px 18px", fontSize: 14, color: "#ccc", lineHeight: 1.65, flex: 1, fontStyle: "italic" }}>
                "Book Lisa Thompson in for a boiler service Thursday, add two metres of 22mm copper from City Plumbing to the quote I did last week, and chase the invoice from the Maple Avenue job."
              </div>
            </div>
            <div style={{ paddingLeft: 42 }}>
              <div style={{ background: "#141414", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 14, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  "Booked Lisa Thompson — Thursday 11:30, boiler service",
                  "Added £59.40 of materials to the Maple Ave quote",
                  "Chase email sent to Maple Ave — gentle reminder",
                ].map((line, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#ccc" }}>
                    <span style={{ color: "#10b981", fontWeight: 700, flexShrink: 0 }}>✓</span>{line}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 3 Voice capability cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {[
              { title: "Wake word + hands-free loop", body: "\"Hey Trade PA\" wakes it. Continuous voice loop with silence detection. Phase-aware safety timers — never dies silently. Built for vans, roofs, lofts and plant rooms." },
              { title: "Voice on every form", body: "43 features accept voice dictation. Quotes, invoices, certificates, RAMS, time logs. Tuned for UK, Irish and regional accents. No menus. Just talk." },
              { title: "Multi-action conversational AI", body: "Several actions per spoken sentence. Conversational RAMS builder. Asks follow-ups only when it needs to." },
            ].map((f) => (
              <div key={f.title} style={{ background: "#141414", border: "1px solid #222", borderRadius: 14, padding: "24px 22px", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 3, background: "#f59e0b" }} />
                <div style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 14, color: "#f0f0f0", marginBottom: 10, lineHeight: 1.35 }}>{f.title}</div>
                <div style={{ fontSize: 12.5, color: "#888", lineHeight: 1.65 }}>{f.body}</div>
              </div>
            ))}
          </div>
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
          <div style={LP.sectionLabel}>Everything else included</div>
          <h2 style={LP.h2}>The full toolkit.<br/>One price.</h2>
          <div style={{ ...LP.featureGrid, marginTop: 40 }}>
            {[
              { icon: "📋", title: "All-trades certificates", body: "CP12, EICR, EIC, PAT, Pressure Test, Unvented HW, CD/11, CD/12, Fire Alarm, Emergency Lighting, Part P." },
              { icon: "🏗", title: "Deep CIS support", body: "Domestic Reverse Charge invoicing, UTR on all documents, CIS monthly statement logging with PDF storage." },
              { icon: "💷", title: "Quotes & invoices", body: "Professional branded documents sent from your Gmail or Outlook. Xero and QuickBooks sync built in." },
              { icon: "📅", title: "Jobs & scheduling", body: "Full job cards with notes, photos, time logs, variation orders, daywork sheets and customer sign-off." },
              { icon: "📞", title: "Business phone, built in", body: "A dedicated business number that rings inside the app. Every call recorded, transcribed and AI-logged against the job. No second SIM needed.", badge: "Add-on · Any plan", badgeColor: "#f59e0b", badgeBg: "rgba(245,158,11,0.1)", badgeBorder: "rgba(245,158,11,0.2)" },
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
        <p style={{ fontSize: 16, color: "#666", marginBottom: 40, lineHeight: 1.7, maxWidth: 560 }}>Tradify is £34/month with no AI. Trade PA Solo is £39/month — with an AI that runs your entire inbox, answers calls and tracks jobs for you.</p>
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
            <div style={{ padding: "14px 20px", fontFamily: "'DM Mono',monospace", fontSize: 18, fontWeight: 700, color: "#f59e0b", background: "rgba(245,158,11,0.04)", borderLeft: "1px solid rgba(245,158,11,0.1)", borderRight: "1px solid rgba(245,158,11,0.1)" }}>from £39</div>
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

      {/* PRICING — full three-tier + mid-month add-ons + business phone add-on.
          Source of truth matches /pricing.html; FAQ lives on that page. */}
      <div style={{ padding: "72px 24px", background: "#0d0d0d", borderTop: "1px solid #1a1a1a", borderBottom: "1px solid #1a1a1a" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto" }}>

          {/* Section head */}
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ ...LP.sectionLabel, textAlign: "center" }}>Pricing</div>
            <h2 style={{ ...LP.h2, textAlign: "center" }}>Plans for every<br/>tradesperson.</h2>
            <p style={{ fontSize: 16, color: "#888", maxWidth: 540, margin: "16px auto 0", lineHeight: 1.7 }}>
              Start with a 30-day free trial on any plan. No charge until day 31. Cancel anytime. All plans include every feature.
            </p>
          </div>

          {/* Plan cards */}
          <div className="lp-pricing-grid">
            {[
              { name: "Solo", price: "£39", period: "/mo", users: "1 user", popular: false, plan: "solo_monthly", features: ["100 AI conversations per month", "1 hour hands-free per month", "Tap-to-talk voice — never capped", "All 43 features included", "Allowance resets 1st of month"] },
              { name: "Pro Solo", price: "£59", period: "/mo", users: "1 user", popular: true, plan: "pro_solo_monthly", features: ["200 AI conversations per month", "3 hours hands-free per month", "Tap-to-talk voice — never capped", "All 43 features included", "Priority for new features"] },
              { name: "Team", price: "£89", period: "/mo", users: "Up to 5 users", popular: false, plan: "team_monthly", features: ["400 AI conversations per month", "4 hours hands-free per month", "Team scheduling & per-user permissions", "Staff timesheets & GPS tracking", "All 43 features included"] },
              { name: "Business", price: "£129", period: "/mo", users: "Up to 10 users", popular: false, plan: "business_monthly", features: ["800 AI conversations per month", "8 hours hands-free per month", "Priority support", "Everything in Team, more capacity", "All 43 features included"] },
            ].map(p => (
              <div key={p.name} style={{ background: "#141414", border: p.popular ? "2px solid #f59e0b" : "1px solid #222", borderRadius: 20, padding: "44px 32px 36px", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#f59e0b" }} />
                {p.popular && (
                  <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#f59e0b", color: "#000", fontFamily: "'DM Mono',monospace", fontSize: 10, fontWeight: 700, padding: "3px 14px", borderRadius: 100, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>MOST POPULAR</div>
                )}
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>{p.name}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 52, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.03em", color: "#f59e0b", marginBottom: 4 }}>
                  {p.price}<span style={{ fontSize: 16, color: "#666", fontWeight: 400 }}>{p.period}</span>
                </div>
                <p style={{ color: "#f59e0b", fontSize: 12, fontFamily: "'DM Mono',monospace", marginBottom: 20 }}>{p.users}</p>
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8, marginBottom: 28, flex: 1 }}>
                  {p.features.map(f => (
                    <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#ccc", lineHeight: 1.5 }}>
                      <span style={{ color: "#10b981", fontWeight: 700, flexShrink: 0 }}>✓</span>{f}
                    </li>
                  ))}
                </ul>
                <button onClick={() => window.location.href = `/signup.html?plan=${p.plan}`} style={{ background: "#f59e0b", color: "#000", padding: 14, borderRadius: 8, fontWeight: 700, fontSize: 14, textAlign: "center", display: "block", width: "100%", border: "none", cursor: "pointer", fontFamily: "'DM Mono',monospace" }} className="lp-btn-primary">Start free trial →</button>
              </div>
            ))}
          </div>

          {/* Mid-month add-ons */}
          <div style={{ background: "#141414", border: "1px solid #222", borderRadius: 16, padding: "32px 28px", margin: "32px auto 16px", textAlign: "center" }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>⚡ Add-on · Any Plan</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Need more mid-month?</div>
            <p style={{ color: "#888", fontSize: 14, maxWidth: 560, margin: "0 auto 24px", lineHeight: 1.7 }}>Busy month? Top up any plan with one-off usage add-ons. No subscription change, no commitment — just a boost for the current billing period.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, maxWidth: 700, margin: "0 auto 16px" }}>
              {[
                { label: "+200 AI conversations", price: "£39", desc: "Extra allowance for a busy month" },
                { label: "+2 hours hands-free", price: "£19", desc: "Extra hands-free time, top-up only" },
                { label: "+200 conv & +2h combo", price: "£55", desc: "Save £3 vs buying both separately" },
              ].map(a => (
                <div key={a.label} style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: 14, textAlign: "left" }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 700, color: "#f0f0f0", marginBottom: 6 }}>{a.label}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 700, color: "#f59e0b" }}>{a.price}</div>
                  <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>{a.desc}</div>
                </div>
              ))}
            </div>
            <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "#555" }}>One-off · Available to all plans · Expires at billing rollover</p>
          </div>

          {/* Business phone add-on */}
          <div style={{ background: "#141414", border: "1px solid #222", borderRadius: 16, padding: "32px 28px", textAlign: "center" }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>📞 Add-on · Any Plan</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Business Phone, Built In</div>
            <p style={{ color: "#888", fontSize: 14, maxWidth: 620, margin: "0 auto 24px", lineHeight: 1.7 }}>Get a dedicated business number that rings directly inside the Trade PA app — no second SIM, no extra hardware. Every call from a known customer is recorded, transcribed and automatically logged against their job. Missed a call? It falls back to your mobile so you never lose a lead.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, maxWidth: 700, margin: "0 auto 24px" }}>
              {[
                { icon: "📱", label: "Rings in Trade PA app", desc: "Answer without a second SIM" },
                { icon: "🎙️", label: "Auto-recorded & transcribed", desc: "AI logs every conversation" },
                { icon: "🔗", label: "Linked to jobs & customers", desc: "Full call history in one place" },
                { icon: "📲", label: "30s mobile fallback", desc: "Never miss a call on site" },
              ].map(p => (
                <div key={p.label} style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: 14, textAlign: "left" }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{p.icon}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 700, marginBottom: 3 }}>{p.label}</div>
                  <div style={{ fontSize: 11, color: "#555" }}>{p.desc}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, maxWidth: 640, margin: "0 auto 16px" }}>
              {[
                { mins: "100 mins/month", price: "£20" },
                { mins: "300 mins/month", price: "£40" },
                { mins: "600 mins/month", price: "£65" },
                { mins: "Unlimited", price: "£104" },
              ].map(t => (
                <div key={t.mins} style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: 14 }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "#666", marginBottom: 6 }}>{t.mins}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 700, color: "#f59e0b" }}>{t.price}</div>
                  <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>per month</div>
                </div>
              ))}
            </div>
            <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "#555" }}>Dedicated UK number included · Want to keep your existing number? We support porting · UK GDPR compliant</p>
          </div>

          {/* Link to pricing page FAQ */}
          <div style={{ textAlign: "center", marginTop: 32 }}>
            <a href="/pricing.html" className="lp-btn-ghost" style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: "#888", textDecoration: "none", border: "1px solid #2a2a2a", padding: "10px 20px", borderRadius: 8, display: "inline-block" }}>FAQs and full details →</a>
          </div>

        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: "72px 24px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", width: 400, height: 400, background: "radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)", top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <h2 style={{ ...LP.h2, marginBottom: 20 }}>Stop doing admin<br/>after hours.</h2>
          <p style={{ fontSize: 17, color: "#888", marginBottom: 40, maxWidth: 500, margin: "0 auto 40px", lineHeight: 1.7 }}>Trade PA runs your inbox while you're on the tools, and chases your money while you sleep. One tap to approve. That's it.</p>
          <button onClick={() => window.location.href="/signup.html"} style={{ ...LP.btnPrimary, fontSize: 16, padding: "16px 40px" }} className="lp-btn-primary">Start 30-day free trial →</button>
          <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "#f59e0b", marginTop: 16, letterSpacing: "0.06em" }}>✓ Free for 30 days · No charge until day 31 · Cancel anytime</p>
          <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "#555", marginTop: 8 }}>Works with Gmail · Works with Outlook · Built-in business phone · UK-built for UK trades</p>
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
