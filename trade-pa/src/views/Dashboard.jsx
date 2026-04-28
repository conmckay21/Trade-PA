// ─── Dashboard ──────────────────────────────────────────────────────────
// Extracted verbatim from App.jsx during P7 sub-batch A (28 Apr 2026).
import React, { useState, useRef } from "react";
import { C } from "../theme/colors.js";
import { S } from "../theme/styles.js";
import { fmtAmount } from "../lib/format.js";
import { isSameDay } from "../lib/date-helpers.js";

export function Dashboard({ setView, jobs, invoices, enquiries, brand, onScanReceipt, voiceHandle, handsFree }) {
  // ── Computed data ────────────────────────────────────────────────────────
  const today = new Date(); today.setHours(0,0,0,0);
  const todayJobs = jobs.filter(j => j.dateObj && isSameDay(new Date(j.dateObj), today));
  const allInvoices = invoices.filter(i => !i.isQuote);
  const overdueInvoices = allInvoices.filter(i => i.status === "overdue" || i.status === "due");
  const overdueValue = overdueInvoices.reduce((s, i) => s + (i.amount || 0), 0);
  const newEnquiries = (enquiries || []).filter(e => !e.status || e.status === "new");
  const isEmpty = jobs.length === 0 && invoices.length === 0 && (enquiries || []).length === 0;

  // ── Time-of-day greeting (mockup fix: never empty, defaults to "Good evening" at night) ──
  const hour = new Date().getHours();
  const greeting = hour >= 5 && hour < 12 ? "Good morning."
                 : hour >= 12 && hour < 18 ? "Good afternoon."
                 : "Good evening.";

  // ── Local UI state (Session D: handsFree is now driven by voiceHandle) ──
  const [textMessage, setTextMessage] = useState("");
  const fileInputRef = useRef();

  // ── Handlers (Session D — wired to real voice system via voiceHandle) ──
  const onMicTap = () => {
    // Start voice directly, then navigate to AI Assistant so the user sees the conversation.
    try { voiceHandle?.current?.startVoice?.(); } catch {}
    setView("AI Assistant");
  };
  const onHandsFreeTap = () => {
    // Toggle the real hands-free state. Stays on Home — button reflects via handsFree prop.
    try { voiceHandle?.current?.toggleHandsFree?.(); } catch {}
  };
  const submitText = () => {
    const trimmed = textMessage.trim();
    if (!trimmed) return;
    try { voiceHandle?.current?.sendText?.(trimmed); } catch {}
    setTextMessage("");
    setView("AI Assistant");
  };
  const handleScanFile = (e) => {
    const file = e.target.files?.[0];
    if (!file || !onScanReceipt) return;
    onScanReceipt(file);
    e.target.value = "";
    setView("AI Assistant");
  };

  // ── Glance widget renderer ───────────────────────────────────────────────
  const Glance = ({ label, value, sub, valueColor, onClick }) => (
    <div
      onClick={onClick}
      style={{
        background: C.surfaceHigh,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: 14,
        cursor: onClick ? "pointer" : "default",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minWidth: 0,
      }}
    >
      <div style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: 9,
        color: C.muted,
        letterSpacing: "0.14em",
        fontWeight: 700,
        textTransform: "uppercase",
      }}>{label}</div>
      <div>
        <div style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: valueColor || C.text,
          lineHeight: 1.05,
        }}>{value}</div>
        <div style={{
          fontSize: 10.5,
          color: C.textDim,
          marginTop: 3,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>{sub}</div>
      </div>
    </div>
  );

  // ── Quick action button renderer ─────────────────────────────────────────
  const QuickAction = ({ label, icon, onClick }) => (
    <button
      onClick={onClick}
      style={{
        background: C.surfaceHigh,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: "14px 8px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        color: C.text,
        fontFamily: "'DM Sans', sans-serif",
        minHeight: 84,
      }}
    >
      <div style={{ width: 22, height: 22, color: C.amber }}>{icon}</div>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "-0.005em",
        textAlign: "center",
        lineHeight: 1.2,
      }}>{label}</div>
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Animation keyframes for mic pulse */}
      <style>{`
        @keyframes mic-pulse {
          0% { transform: scale(1); opacity: 0.7; }
          70% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes hf-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.6); opacity: 0.4; }
        }
      `}</style>

      {/* Greeting */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 4 }}>
        <div style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: C.text,
          lineHeight: 1.1,
        }}>{greeting}</div>
        <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.4 }}>
          Tap to talk, or pick an action below.
        </div>
      </div>

      {/* Glance widgets row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <Glance
          label="Today"
          value={todayJobs.length}
          sub={`job${todayJobs.length === 1 ? "" : "s"} scheduled`}
          onClick={() => setView("Schedule")}
        />
        <Glance
          label="Overdue"
          value={overdueValue > 0 ? fmtAmount(overdueValue) : "£0"}
          sub={`${overdueInvoices.length} invoice${overdueInvoices.length === 1 ? "" : "s"}`}
          valueColor={overdueValue > 0 ? C.red : C.text}
          onClick={() => setView("Invoices")}
        />
        <Glance
          label="Inbox"
          value={newEnquiries.length}
          sub={`new ${newEnquiries.length === 1 ? "enquiry" : "enquiries"}`}
          valueColor={newEnquiries.length > 0 ? C.amber : C.text}
          onClick={() => setView("Enquiries")}
        />
      </div>

      {/* Mic hero */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "32px 0 20px",
        gap: 16,
      }}>
        <div style={{ position: "relative", width: 144, height: 144 }}>
          {/* Pulse ring */}
          <div style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${C.amber}40 0%, ${C.amber}00 70%)`,
            animation: "mic-pulse 2.6s ease-out infinite",
          }} />
          {/* Mic button */}
          <button
            onClick={onMicTap}
            aria-label="Tap to speak"
            style={{
              position: "relative",
              width: 144,
              height: 144,
              borderRadius: "50%",
              background: `linear-gradient(180deg, ${C.amber}, #d97706)`,
              border: `3px solid ${C.amber}80`,
              boxShadow: `0 12px 40px -8px ${C.amber}80, 0 0 60px -12px ${C.amber}60`,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              color: "#000",
              padding: 0,
            }}
          >
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
              <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
            </svg>
          </button>
        </div>
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 14,
            fontWeight: 600,
            color: C.text,
          }}>Tap to speak</div>
        </div>
      </div>

      {/* Hands-free action button — morphs between start/stop */}
      <button
        onClick={onHandsFreeTap}
        style={{
          background: handsFree ? `linear-gradient(180deg, ${C.amber}, #d97706)` : C.surfaceHigh,
          border: `1px solid ${handsFree ? `${C.amber}90` : C.border}`,
          borderRadius: 14,
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          cursor: "pointer",
          transition: "all 180ms ease",
          width: "100%",
          color: handsFree ? "#000" : C.text,
          fontFamily: "'DM Sans', sans-serif",
          textAlign: "left",
          boxShadow: handsFree ? `0 8px 24px -8px ${C.amber}60` : "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <div style={{
            width: 36, height: 36,
            borderRadius: 10,
            background: handsFree ? "rgba(0,0,0,0.15)" : C.surface,
            border: `1px solid ${handsFree ? "rgba(0,0,0,0.2)" : C.border}`,
            color: handsFree ? "#000" : C.textDim,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            transition: "all 150ms ease",
            position: "relative",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={handsFree ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 14,
              fontWeight: 700,
              color: handsFree ? "#000" : C.text,
              letterSpacing: "-0.01em",
            }}>{handsFree ? "Hands-free active" : "Start hands-free"}</div>
            <div style={{
              fontSize: 11.5,
              color: handsFree ? "rgba(0,0,0,0.7)" : C.textDim,
              marginTop: 2,
            }}>{handsFree ? "Tap to stop · auto-listening after each reply" : "One tap, continuous voice mode"}</div>
          </div>
        </div>
        {/* Right indicator — pulsing dot when active, chevron when idle */}
        {handsFree ? (
          <div style={{ position: "relative", width: 10, height: 10, flexShrink: 0, marginRight: 4 }}>
            <div style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: "#000",
              animation: "hf-pulse 1.2s ease-in-out infinite",
            }} />
          </div>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: C.textDim, flexShrink: 0 }}>
            <path d="M9 5l7 7-7 7" />
          </svg>
        )}
      </button>

      {/* Quick actions */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        <QuickAction
          label="New Job"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><path d="M12 4v16m8-8H4" /></svg>}
          onClick={() => setView("Jobs")}
        />
        <QuickAction
          label="New Quote"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><path d="M9 12h6m-3-3v6m9-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          onClick={() => setView("Quotes")}
        />
        <QuickAction
          label="Scan Receipt"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><path d="M3 7l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
          onClick={() => fileInputRef.current?.click()}
        />
        <QuickAction
          label="Log Time"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          onClick={() => setView("AI Assistant")}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          onChange={handleScanFile}
          style={{ display: "none" }}
        />
      </div>

      {/* Text input bar (equal citizen to voice) */}
      <div style={{
        background: C.surfaceHigh,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: "8px 8px 8px 14px",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <input
          type="text"
          placeholder="Or type a message…"
          value={textMessage}
          onChange={e => setTextMessage(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submitText(); }}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: C.text,
            fontSize: 15,
            fontFamily: "'DM Sans', sans-serif",
            minWidth: 0,
            padding: "8px 0",
          }}
        />
        <button
          onClick={submitText}
          aria-label="Send"
          disabled={!textMessage.trim()}
          style={{
            width: 36, height: 36,
            borderRadius: 10,
            background: textMessage.trim() ? C.amber : C.surface,
            border: `1px solid ${textMessage.trim() ? C.amber : C.border}`,
            color: textMessage.trim() ? "#000" : C.textDim,
            cursor: textMessage.trim() ? "pointer" : "not-allowed",
            display: "grid",
            placeItems: "center",
            transition: "background 120ms ease",
            flexShrink: 0,
            padding: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14m0 0l-6-6m6 6l-6 6" />
          </svg>
        </button>
      </div>

      {/* Empty state — shown only on a brand-new account */}
      {isEmpty && (
        <div style={{
          marginTop: 8,
          background: `${C.amber}08`,
          border: `1px solid ${C.amber}33`,
          borderRadius: 14,
          padding: 20,
          textAlign: "center",
        }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>⚡</div>
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 15,
            fontWeight: 700,
            color: C.text,
            marginBottom: 6,
            letterSpacing: "-0.01em",
          }}>Welcome to Trade PA</div>
          <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.5, marginBottom: 14 }}>
            Tap the mic to talk, or set up your business in Settings first.
          </div>
          <button
            onClick={() => setView("Settings")}
            style={{
              ...S.btn("primary"),
              fontFamily: "'DM Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.06em",
            }}
          >Set up my business →</button>
        </div>
      )}
    </div>
  );
}
