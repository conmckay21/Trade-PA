import React from "react";

// ─── NativeWelcome — pre-login branded hero for the native app ──────────
// Replaces the web marketing LandingPage when isNative() returns true.
// Per App Store Review Guideline 3.1.3(b) we ship ZERO subscribe CTAs,
// ZERO pricing UI, ZERO upgrade prompts on the native pre-auth screen.
// Existing subscribers tap Sign In; new downloads get a passive outbound
// link to tradespa.co.uk where they can register.
export function NativeWelcome({ onSignIn }) {
  return (
    <div style={{
      minHeight: "100vh",
      width: "100%",
      background: "#0a0a0a",
      color: "#f0f0f0",
      fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
      display: "flex",
      flexDirection: "column",
      padding: "max(48px, env(safe-area-inset-top, 48px)) 28px max(28px, env(safe-area-inset-bottom, 28px))",
      overflow: "hidden",
      position: "relative",
      boxSizing: "border-box",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&family=Plus+Jakarta+Sans:wght@400;500;700;800&display=swap');
        @keyframes nw-glow { 0%,100% { opacity: 0.4; } 50% { opacity: 0.7; } }
        @keyframes nw-fadein { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .nw-glow { animation: nw-glow 5s ease-in-out infinite; }
        .nw-fade-1 { animation: nw-fadein 0.5s ease-out 0.10s both; }
        .nw-fade-2 { animation: nw-fadein 0.5s ease-out 0.25s both; }
        .nw-fade-3 { animation: nw-fadein 0.5s ease-out 0.40s both; }
        .nw-fade-4 { animation: nw-fadein 0.5s ease-out 0.55s both; }
        .nw-btn { transition: transform 0.1s, background 0.15s; }
        .nw-btn:active { transform: scale(0.97); background: #d68a09 !important; }
        .nw-link { transition: color 0.15s; }
        .nw-link:active { color: #f59e0b !important; }
      `}</style>

      {/* Ambient radial glow behind the logo */}
      <div className="nw-glow" style={{
        position: "absolute",
        width: 480,
        height: 480,
        background: "radial-gradient(circle, rgba(245,158,11,0.14) 0%, transparent 65%)",
        top: "30%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        filter: "blur(10px)",
      }} />

      {/* Hero — TP mark + tagline + descriptor */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        position: "relative",
        zIndex: 1,
      }}>
        <div className="nw-fade-1" style={{
          width: 84,
          height: 84,
          background: "#f59e0b",
          borderRadius: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: 800,
          fontSize: 32,
          color: "#0a0a0a",
          letterSpacing: "-0.02em",
          marginBottom: 40,
          boxShadow: "0 12px 32px rgba(245,158,11,0.3)",
        }}>TP</div>

        <h1 className="nw-fade-2" style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: "clamp(28px, 8vw, 36px)",
          fontWeight: 800,
          lineHeight: 1.1,
          letterSpacing: "-0.025em",
          margin: "0 0 16px",
          maxWidth: 320,
          color: "#f0f0f0",
        }}>
          Stop losing evenings to admin.
        </h1>

        <p className="nw-fade-3" style={{
          fontSize: 15,
          color: "#888",
          lineHeight: 1.6,
          margin: 0,
          maxWidth: 280,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}>
          The voice-first PA for UK trades.
        </p>
      </div>

      {/* CTA stack — single Sign In + passive outbound link */}
      <div className="nw-fade-4" style={{
        position: "relative",
        zIndex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 18,
        paddingBottom: 8,
      }}>
        <button
          onClick={onSignIn}
          className="nw-btn"
          style={{
            background: "#f59e0b",
            color: "#0a0a0a",
            border: "none",
            borderRadius: 12,
            padding: "16px 24px",
            fontSize: 15,
            fontWeight: 700,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            letterSpacing: "0.02em",
            cursor: "pointer",
            width: "100%",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          Sign in
        </button>

        <div style={{
          textAlign: "center",
          fontSize: 12,
          color: "#666",
          lineHeight: 1.5,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}>
          No account yet?{" "}
          <a
            href="https://tradespa.co.uk"
            target="_blank"
            rel="noopener noreferrer"
            className="nw-link"
            style={{
              color: "#888",
              textDecoration: "none",
              borderBottom: "1px solid #444",
              paddingBottom: 1,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            tradespa.co.uk
          </a>
        </div>
      </div>
    </div>
  );
}
