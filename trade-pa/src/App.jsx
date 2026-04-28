import React, { useState, useRef, useEffect, Component } from "react";
import * as Sentry from "@sentry/react";
import { db } from "./lib/db.js";
import { Device } from "@twilio/voice-sdk";
import HelpCentre from "./HelpCentre.jsx";
import AssistantSetup from "./AssistantSetup.jsx";
import FieldMic from "./components/FieldMic.jsx";
import OfflineBanner from "./components/OfflineBanner.jsx";
import OfflineSettings from "./components/OfflineSettings.jsx";
import UpdateBanner from "./components/UpdateBanner.jsx";
import ChangelogModal from "./components/ChangelogModal.jsx";
import { prewarmCache } from "./lib/prewarm.js";
import { drainQueue } from "./lib/writeQueue.js";
// ─── P1: Pure helpers extracted from App.jsx (28 Apr 2026) ──────────────────
// All exports below are verbatim moves — no behavioural changes.
import { TIER_CONFIG, normalizeTier, getTierConfig } from "./lib/plan.js";
import { trackEvent } from "./lib/tracking.js";
import { authHeaders, setOwnerCookie } from "./lib/auth.js";
import { fmtCurrency, fmtAmount, vatLabel, relTime } from "./lib/format.js";
import { localDate, localMonth, localYear, weekBounds, groupByRecency } from "./lib/time.js";
import {
  DEFAULT_BRAND, DEFAULT_SUPPLIERS, ALL_CERTS,
  NAV_GROUPS, viewGroup, MILEAGE_RATE,
} from "./lib/constants.js";
import { fileToContentBlock, openHtmlPreview, urlBase64ToUint8Array } from "./lib/files.js";
import { uploadReceiptToStorage, getSignedReceiptUrl, getReceiptViewUrl } from "./lib/receipts.js";
import { buildToolSubset } from "./lib/tool-routing.js";
import { buildEmailHTML, buildRef, buildInvoiceHTML, downloadInvoicePDF } from "./lib/invoice-html.js";
import {
  generatePortalToken, newEnquiryId,
  nextInvoiceId, nextQuoteId, isExemptAccount,
} from "./lib/ids.js";
// ─── P2: Theme + hooks extracted from App.jsx (28 Apr 2026) ────────────────
// Verbatim moves — no behavioural changes.
import { C, DARK_PALETTE, LIGHT_PALETTE, applyPalette } from "./theme/colors.js";
import { S } from "./theme/styles.js";
import { ThemeContext, ThemeProvider, useTheme } from "./theme/ThemeProvider.jsx";
import { useWhisper } from "./hooks/useWhisper.js";
import { useReminders } from "./hooks/useReminders.js";
// ─── P3: UI primitives extracted from App.jsx (28 Apr 2026) ────────────────
// Verbatim moves — no behavioural changes. portalUrl helper hoisted to lib/portal.js
// so PortalLinkPanel and portalCtaBlock (still in App.jsx) can both import it.
import { portalUrl } from "./lib/portal.js";
import { PDFOverlay } from "./components/PDFOverlay.jsx";
import { DetailPage } from "./components/DetailPage.jsx";
import { FloatingMicButton } from "./components/FloatingMicButton.jsx";
import { MicButton } from "./components/MicButton.jsx";
import { VoiceFillButton } from "./components/VoiceFillButton.jsx";
import { LineItemsBuilder } from "./components/LineItemsBuilder.jsx";
import { PortalLinkPanel } from "./components/PortalLinkPanel.jsx";
import { IncomingCallScreen } from "./components/IncomingCallScreen.jsx";
import { ActiveCallScreen } from "./components/ActiveCallScreen.jsx";
import { HubPage } from "./components/HubPage.jsx";
import { BottomTabBar } from "./components/BottomTabBar.jsx";
import { LandingPage } from "./auth/LandingPage.jsx";
import { Notifications } from "./notifications/Notifications.jsx";
import { Reminders } from "./notifications/Reminders.jsx";
import { FeedbackModal } from "./modals/FeedbackModal.jsx";
import { InvoiceModal } from "./modals/InvoiceModal.jsx";
import { QuoteModal } from "./modals/QuoteModal.jsx";
import { AssignToJobModal } from "./modals/AssignToJobModal.jsx";
// ─── P7 prelude: cross-cutters lifted to lib/ (28 Apr 2026) ────────────────
// Hoisted ahead of view extraction so each extracted view can import these
// directly. Verbatim moves — no behavioural changes.
import { statusColor, statusLabel } from "./lib/status.js";
import { SUB_INVOICE_SCAN_PROMPT } from "./lib/scan-prompts.js";
import { isSameDay } from "./lib/date-helpers.js";
import { portalCtaBlock } from "./lib/portal-extras.js";
import { syncInvoiceToAccounting } from "./lib/accounting.js";
import { tmReadWorkers, tmReadSubs } from "./lib/team-members.js";
// ─── P7 sub-batch A: small isolated views (28 Apr 2026) ────────────────────
// Verbatim moves — no behavioural changes.
import { Dashboard } from "./views/Dashboard.jsx";
import { Schedule } from "./views/Schedule.jsx";
import { MileageTab } from "./views/Mileage.jsx";
import { StockTab } from "./views/Stock.jsx";
import { DocumentsTab } from "./views/Documents.jsx";
import { ReviewsTab } from "./views/Reviews.jsx";
import { ExpensesTab } from "./views/Expenses.jsx";
import { CISStatementsTab } from "./views/CIS.jsx";
import { PurchaseOrdersTab } from "./views/PurchaseOrders.jsx";
import { RecentlyDeleted } from "./views/RecentlyDeleted.jsx";
// ─── P7 sub-batch B: medium views with helper clusters (28 Apr 2026) ───────
// Verbatim moves — no behavioural changes. Inbox helpers + RAMS libraries
// re-imported here so AIAssistant (still in App.jsx until P10) can keep
// calling them.
import { Materials } from "./views/Materials.jsx";
import {
  InboxView,
  executeEmailAction,
  updateEmailAIContext,
  logEmailFeedback,
} from "./views/Inbox.jsx";
import { EnquiriesTab } from "./views/Enquiries.jsx";
import {
  RAMSTab,
  HAZARD_LIBRARY,
  METHOD_LIBRARY,
  COSHH_SUBSTANCES,
} from "./views/RAMS.jsx";
import { SubcontractorsTab } from "./views/Subcontractors.jsx";
import { ReportsTab } from "./views/Reports.jsx";
// ─── P7 sub-batch C: large clusters (28 Apr 2026) ──────────────────────────
// Verbatim moves — no behavioural changes. InvoicePreview re-imported here
// so Settings (still in App.jsx until P9) can keep rendering it from the
// Branding section preview.
import {
  InvoicePreview,
  Payments,
  InvoicesView,
  QuotesView,
} from "./views/Invoices.jsx";
import { Customers } from "./views/Customers.jsx";
import { JobsTab } from "./views/Jobs.jsx";

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
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 12, background: "#f59e0b", color: "#000", border: "none", borderRadius: 10, padding: "8px 16px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
window._supabase = db;

// (syncInvoiceToAccounting moved to ./lib/accounting.js — P7 prelude)


const JOBS = [];
const INVOICES_INIT = [];
const ENQUIRIES = [];
const MATERIALS = [];
// (statusColor + statusLabel moved to ./lib/status.js — P7 prelude)

// ── Shared list utilities (Phase 3: jobs / invoices / materials etc.) ──────
// Module-scope so list screens share one source of truth. Hoisted after
// JobsTab + InvoicesView triple-duplicated these; Materials now reuses.
// (relTime, weekBounds, groupByRecency moved to ./lib/time.js + ./lib/format.js — P1)

// (DEFAULT_BRAND, vatLabel, fmtCurrency, fmtAmount, localDate/Month/Year,
//  fileToContentBlock moved to ./lib/constants.js, ./lib/format.js,
//  ./lib/time.js, ./lib/files.js — P1)



// which the terse version silently fudged.
// (SUB_INVOICE_SCAN_PROMPT moved to ./lib/scan-prompts.js — P7 prelude)

// Shared helper: open arbitrary HTML in a print-friendly preview that ALSO


// ─── Invoice Preview ──────────────────────────────────────────────────────────
// (InvoicePreview moved to ./views/Invoices.jsx — P7-7C)

// ─── Settings ─────────────────────────────────────────────────────────────────
// ─── Team Invite ──────────────────────────────────────────────────────────────
// ─── Call Tracking Settings ────────────────────────────────────────────────────
function CallTrackingSettings({ user }) {
  const [callTracking, setCallTracking] = useState(null);
  const [forwardTo, setForwardTo] = useState("");
  const [selectedPhonePlan, setSelectedPhonePlan] = useState("phone_300"); // default to popular tier
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [showPortInfo, setShowPortInfo] = useState(false);
  const [micStatus, setMicStatus] = useState(null); // granted | denied | prompt | unknown

  // Phone plan tiers (display only — pricing authoritative server-side)
  const PHONE_TIERS = [
    { key: "phone_100",       mins: "100 mins",   price: "£20",  desc: "Occasional use" },
    { key: "phone_300",       mins: "300 mins",   price: "£40",  desc: "Most popular", popular: true },
    { key: "phone_600",       mins: "600 mins",   price: "£65",  desc: "Busy tradesperson" },
    { key: "phone_unlimited", mins: "Unlimited",  price: "£104", desc: "Fair use — 3,000 mins" },
  ];

  useEffect(() => {
    if (!user?.id) return;
    db.from("call_tracking")
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
    if (!selectedPhonePlan) { setError("Please choose a plan"); return; }

    // Request microphone permission upfront so it's ready when calls arrive
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
    } catch (err) {
      setError("Microphone access is required to receive calls. Please tap Allow when your browser asks, or enable it in your browser settings.");
      return;
    }

    setSaving(true); setError("");
    try {
      const res = await fetch("/api/stripe/create-phone-subscription", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          phone_plan: selectedPhonePlan,
          forward_to: forwardTo.trim(),
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.message || data.error);
      setCallTracking({
        twilio_number: data.twilio_number,
        forwarding_code: data.forwarding_code,
        disable_code: data.disable_code,
        forward_to: forwardTo.trim(),
        phone_plan: data.phone_plan,
        monthly_minute_quota: data.monthly_minute_quota,
        minutes_used_month: 0,
      });
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  // ─── In-app phone plan switch (existing subscribers) ───────────────────
  // changePlan state: null (closed) | 'picker' (tier list) | phone_plan key (confirming switch to this)
  const [changePlan, setChangePlan] = useState(null);
  const [changeBusy, setChangeBusy] = useState(false);
  const [changeResult, setChangeResult] = useState(null); // { type, message }

  const switchPlan = async (targetPlan) => {
    setChangeBusy(true);
    setChangeResult(null);
    try {
      const res = await fetch("/api/stripe/update-phone-plan", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ phone_plan: targetPlan }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setChangeResult({ type: "error", message: data.message || "Plan change failed." });
      } else {
        setChangeResult({ type: "success", message: data.message || "Plan updated." });
        // Refresh call_tracking from DB — webhook will have updated it server-side.
        // Tiny delay so webhook has a chance to land.
        setTimeout(() => {
          if (!user?.id) return;
          db.from("call_tracking")
            .select("*")
            .eq("user_id", user.id)
            .limit(1)
            .then(({ data: rows }) => {
              if (rows?.[0]) setCallTracking(rows[0]);
            });
        }, 1200);
      }
    } catch (err) {
      console.error("[switch-phone-plan]", err);
      setChangeResult({ type: "error", message: "Couldn't change plan. Please try again or email hello@tradespa.co.uk" });
    } finally {
      setChangeBusy(false);
      setChangePlan(null);
    }
  };

  if (!loaded) return <div style={{ fontSize: 12, color: C.muted }}>Loading...</div>;

  if (callTracking?.twilio_number) {
    const minsUsed = callTracking.minutes_used_month ?? 0;
    const minsQuota = callTracking.monthly_minute_quota ?? null;
    const pct = minsQuota ? Math.min(1, minsUsed / minsQuota) : 0;
    const planLabel = callTracking.phone_plan
      ? PHONE_TIERS.find(t => t.key === callTracking.phone_plan)?.mins || callTracking.phone_plan
      : null;

    return (
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
          <div style={{ fontSize: 12, color: C.muted }}>Business phone is live{planLabel ? ` · ${planLabel}` : ""}</div>
        </div>
        <div style={{ background: C.surfaceHigh, borderRadius: 8, padding: 14, marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Your business number</div>
          <div style={{ fontSize: 17, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: C.amber, marginBottom: 4 }}>{callTracking.twilio_number}</div>
          <div style={{ fontSize: 11, color: C.muted }}>Give this number to customers — all calls ring inside the Trade PA app</div>
        </div>
        {minsQuota && (
          <div style={{ background: C.surfaceHigh, borderRadius: 8, padding: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>This month</div>
              <div style={{ fontSize: 12, color: C.text, fontFamily: "'DM Mono',monospace" }}>{minsUsed} / {minsQuota} mins</div>
            </div>
            <div style={{ width: "100%", height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${pct * 100}%`, height: "100%", background: pct >= 1 ? C.red : pct >= 0.8 ? C.amber : C.green, transition: "width 0.3s" }} />
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Resets with your monthly billing.</div>
          </div>
        )}

        {/* ── Change plan (in-app) ─────────────────────────────────────── */}
        <div style={{ background: C.surfaceHigh, borderRadius: 8, padding: 14, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Need more minutes?</div>
              <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5 }}>Switch plan instantly. Prorated against your next invoice.</div>
            </div>
            <button
              onClick={() => { setChangeResult(null); setChangePlan("picker"); }}
              disabled={changeBusy}
              style={{
                padding: "6px 12px",
                border: `1px solid ${C.amber}`,
                background: "transparent",
                color: C.amber,
                fontSize: 10,
                fontFamily: "'DM Mono', monospace",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontWeight: 700,
                borderRadius: 4,
                cursor: changeBusy ? "not-allowed" : "pointer",
                opacity: changeBusy ? 0.5 : 1,
                flexShrink: 0,
              }}
            >Change →</button>
          </div>
          {changeResult && (
            <div style={{
              marginTop: 10,
              padding: "8px 10px",
              borderRadius: 6,
              fontSize: 11.5,
              lineHeight: 1.5,
              background: changeResult.type === "success" ? `${C.green}1a` : `${C.red}1a`,
              border: `1px solid ${changeResult.type === "success" ? `${C.green}40` : `${C.red}40`}`,
              color: changeResult.type === "success" ? C.green : C.red,
            }}>
              {changeResult.type === "success" ? `✓ ${changeResult.message}` : `✕ ${changeResult.message}`}
            </div>
          )}
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
            <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>UK number porting typically takes 2–4 weeks. Contact us at <span style={{ color: C.amber }}>hello@tradespa.co.uk</span> to get started — we'll handle the process with you.</div>
          </div>
        )}

        {/* ── Plan change modal (picker + confirm, single modal, two states) ── */}
        {changePlan && (
          <div
            onClick={() => !changeBusy && setChangePlan(null)}
            style={{
              position: "fixed",
              top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: 16,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: "20px 20px 18px",
                width: "100%",
                maxWidth: 360,
                maxHeight: "90vh",
                overflowY: "auto",
              }}
            >
              {changePlan === "picker" ? (
                <>
                  <div style={{
                    fontSize: 10, color: C.textDim, letterSpacing: "0.1em",
                    textTransform: "uppercase", fontFamily: "'DM Mono', monospace", marginBottom: 10,
                  }}>Change phone plan</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>Pick your new plan</div>
                  <div style={{ fontSize: 12, color: C.textDim, marginBottom: 16, lineHeight: 1.5 }}>
                    Prorated charge applies to your next invoice. New allowance is live immediately.
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                    {PHONE_TIERS.map(tier => {
                      const isCurrent = tier.key === callTracking.phone_plan;
                      return (
                        <button
                          key={tier.key}
                          onClick={() => !isCurrent && setChangePlan(tier.key)}
                          disabled={isCurrent}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "11px 12px",
                            background: C.surfaceHigh,
                            borderRadius: 6,
                            border: isCurrent ? `1px solid ${C.green}60` : `1px solid transparent`,
                            cursor: isCurrent ? "default" : "pointer",
                            textAlign: "left",
                            opacity: isCurrent ? 0.75 : 1,
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{tier.mins}</div>
                            <div style={{ fontSize: 11, color: C.muted, fontFamily: "'DM Mono',monospace", marginTop: 2 }}>{tier.price} · {tier.desc}</div>
                          </div>
                          {isCurrent ? (
                            <span style={{
                              fontSize: 9, fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em",
                              textTransform: "uppercase", color: C.green, fontWeight: 700,
                              background: `${C.green}1a`, border: `1px solid ${C.green}40`,
                              padding: "3px 8px", borderRadius: 4, flexShrink: 0,
                            }}>CURRENT</span>
                          ) : (
                            <span style={{
                              fontSize: 10, fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em",
                              textTransform: "uppercase", color: C.amber, fontWeight: 700, flexShrink: 0,
                            }}>Switch →</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setChangePlan(null)}
                    style={{
                      width: "100%",
                      padding: 10,
                      border: `1px solid ${C.border}`,
                      background: "transparent",
                      color: C.text,
                      fontSize: 11, fontWeight: 600,
                      borderRadius: 6,
                      fontFamily: "'DM Mono', monospace",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                    }}
                  >Cancel</button>
                </>
              ) : (() => {
                const currentTier = PHONE_TIERS.find(t => t.key === callTracking.phone_plan);
                const targetTier  = PHONE_TIERS.find(t => t.key === changePlan);
                if (!targetTier) return null;
                return (
                  <>
                    <div style={{
                      fontSize: 10, color: C.textDim, letterSpacing: "0.1em",
                      textTransform: "uppercase", fontFamily: "'DM Mono', monospace", marginBottom: 10,
                    }}>Confirm switch</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
                      {currentTier?.mins || "current"} → {targetTier.mins}
                    </div>
                    <div style={{ fontSize: 13, color: C.textDim, margin: "6px 0 16px", lineHeight: 1.55 }}>
                      New price:{" "}
                      <span style={{ color: C.amber, fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>
                        {targetTier.price}/mo
                      </span>.
                    </div>
                    <div style={{
                      background: C.surfaceHigh,
                      borderRadius: 6,
                      padding: "11px 12px",
                      marginBottom: 18,
                    }}>
                      <div style={{
                        fontSize: 10, color: C.textDim, fontFamily: "'DM Mono', monospace",
                        letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4,
                      }}>What happens</div>
                      <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.55 }}>
                        Your allowance changes to <strong>{targetTier.mins}</strong> right away. A prorated charge (or credit) for the rest of this billing period is added to your next invoice. Your Trade PA number stays the same.
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => setChangePlan("picker")}
                        disabled={changeBusy}
                        style={{
                          flex: 1,
                          padding: 10,
                          border: `1px solid ${C.border}`,
                          background: "transparent",
                          color: C.text,
                          fontSize: 11, fontWeight: 600,
                          borderRadius: 6,
                          fontFamily: "'DM Mono', monospace",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          cursor: changeBusy ? "not-allowed" : "pointer",
                          opacity: changeBusy ? 0.5 : 1,
                        }}
                      >Back</button>
                      <button
                        onClick={() => switchPlan(changePlan)}
                        disabled={changeBusy}
                        style={{
                          flex: 1.6,
                          padding: 10,
                          border: `1px solid ${C.amber}`,
                          background: C.amber,
                          color: "#412402",
                          fontSize: 11, fontWeight: 700,
                          borderRadius: 6,
                          fontFamily: "'DM Mono', monospace",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          cursor: changeBusy ? "not-allowed" : "pointer",
                          opacity: changeBusy ? 0.5 : 1,
                        }}
                      >{changeBusy ? "Switching..." : `Confirm · ${targetTier.price}/mo`}</button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    );
  }

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

      {/* Phone plan picker — 4 tiers */}
      <label style={{ ...S.label, marginBottom: 10 }}>Choose your plan</label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        {PHONE_TIERS.map(tier => {
          const isSelected = selectedPhonePlan === tier.key;
          return (
            <div
              key={tier.key}
              onClick={() => setSelectedPhonePlan(tier.key)}
              style={{
                background: isSelected ? `${C.amber}14` : C.surfaceHigh,
                border: `1.5px solid ${isSelected ? C.amber : C.border}`,
                borderRadius: 8,
                padding: "10px 12px",
                cursor: "pointer",
                position: "relative",
                transition: "all 0.15s",
              }}
            >
              {tier.popular && <div style={{ position: "absolute", top: -7, right: 8, background: C.amber, color: "#000", fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 100, fontFamily: "'DM Mono',monospace", letterSpacing: "0.04em" }}>POPULAR</div>}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text, fontFamily: "'DM Mono',monospace" }}>{tier.mins}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: isSelected ? C.amber : C.text, fontFamily: "'DM Mono',monospace" }}>{tier.price}</div>
              </div>
              <div style={{ fontSize: 10, color: C.muted }}>{tier.desc}</div>
              <div style={{ fontSize: 9, color: C.muted, marginTop: 2, fontFamily: "'DM Mono',monospace" }}>/month</div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, lineHeight: 1.6 }}>
        Enter your personal mobile as a fallback. If you don't answer in the app within 30 seconds, the call will ring your mobile instead so you never miss anything.
      </div>
      <label style={S.label}>Fallback mobile number</label>
      <input style={{ ...S.input, marginBottom: 10 }} placeholder="e.g. 07700 900123" value={forwardTo} onChange={e => setForwardTo(e.target.value)} />
      {error && <div style={{ fontSize: 12, color: C.red, marginBottom: 8 }}>{error}</div>}
      <button style={S.btn("primary")} disabled={saving} onClick={activate}>{saving ? "Setting up your number..." : "Subscribe & activate →"}</button>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 10 }}>Uses your existing Trade PA payment method · Cancel anytime from Stripe billing portal</div>
      <div style={{ marginTop: 14, padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
        <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>Already have a business number? You can port it across so customers keep calling the same number. Email <span style={{ color: C.amber }}>hello@tradespa.co.uk</span> to get started.</div>
      </div>
    </div>
  );
}

function TeamInvite({ companyId, planTier, currentMemberCount }) {
  const ALL_SECTIONS = ["Dashboard", "Schedule", "Jobs", "Customers", "Invoices", "Quotes", "Materials", "Expenses", "CIS", "AI Assistant", "Reminders", "Payments", "Inbox", "Reports", "Mileage", "Workers", "Subcontractors", "Documents", "Reviews", "Stock", "RAMS"];
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
    const tierCfg = getTierConfig(planTier);
    const maxUsers = tierCfg.userLimit;
    if (currentMemberCount >= maxUsers) {
      setError(`Your ${tierCfg.label} plan allows up to ${maxUsers} user${maxUsers === 1 ? "" : "s"}. Upgrade your plan to add more team members.`);
      return;
    }

    setSending(true); setError("");
    try {
      const { data: existing } = await db
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

      await db.from("invites").insert({
        company_id: companyId,
        invited_by: (await db.auth.getUser()).data.user.id,
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

// (ALL_CERTS moved to ./lib/constants.js — P1)

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

// ─── Recently Deleted (holding bay UI) ───────────────────────────────────
//
// Lists soft-deleted rows from across all soft-delete tables, grouped by
// type. Tap → Restore (clear deleted_at + cascade_id) or Delete forever
// (hard DELETE). 14-day retention is enforced server-side by the
// purge_expired_soft_deletes() pg_cron job — we just show what's still
// in the bay.
//
// Only loads top 100 most-recently-deleted across all tables to keep
// initial render fast — a Trash with 5,000 items is unlikely on a
// pre-launch product but defensive cap regardless.
// (RecentlyDeleted moved to ./views/RecentlyDeleted.jsx — P7-7A)
function Settings({ brand, setBrand, companyId, companyName, userRole, members, user, planTier, userLimit, openAssistantSetup, openFeedback, assistantName, assistantWakeWords, userCommandsCount, usageData, usageCaps }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportText, setReportText] = useState(null);
  const [reportError, setReportError] = useState(null);

  // ─── Add-on purchase (Plan & billing subview) ────────────────────────────
  const [addonConfirm, setAddonConfirm] = useState(null); // addon_type key being confirmed
  const [addonBusy, setAddonBusy] = useState(false);
  const [addonResult, setAddonResult] = useState(null);   // { type, message, displayName? }
  const ADDON_DISPLAY = {
    conversations: { title: "+200 conversations", subtitle: "200 extra AI conversations, active right away. Expires end of this month.", pricePence: 3900 },
    handsfree:     { title: "+2 hours hands-free", subtitle: "2 extra hours of hands-free mic time, active right away. Expires end of this month.", pricePence: 1900 },
    combo:         { title: "+200 conversations & +2 hours hands-free", subtitle: "Both combined — 200 conversations and 2 hours of hands-free, active right away. Expires end of this month.", pricePence: 5500 },
  };
  const purchaseAddon = async (addonType) => {
    setAddonBusy(true);
    setAddonResult(null);
    try {
      const { data: { session } } = await window._supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setAddonResult({ type: "error", message: "Please log in again to buy add-ons." });
        return;
      }
      const res = await fetch("/api/stripe/purchase-addon", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ addon_type: addonType }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setAddonResult({ type: "error", message: data.message || "Add-on purchase failed. Please try again." });
      } else {
        setAddonResult({ type: "success", displayName: data.display_name, message: "Active now — extra allowance available this month." });
      }
    } catch (err) {
      console.error("[purchase-addon]", err);
      setAddonResult({ type: "error", message: "Couldn't complete purchase. Please try again or email hello@tradespa.co.uk" });
    } finally {
      setAddonBusy(false);
      setAddonConfirm(null);
    }
  };

  const generateReport = async () => {
    setReportLoading(true);
    setReportText(null);
    setReportError(null);
    try {
      const res = await fetch("/api/error-report", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          userEmail: brand?.email || user?.email,
          sendEmail: !!(brand?.email || user?.email),
          daysBack: 30,
        }),
      });
      const data = await res.json();
      if (data.report) {
        setReportText(data.report);
      } else {
        setReportText("No errors logged in the last 30 days. All good! ✓");
      }
    } catch(e) {
      setReportError("Failed to generate report: " + e.message);
    }
    setReportLoading(false);
  };
  const [xeroConnected, setXeroConnected] = useState(false);
  const [qbConnected, setQbConnected] = useState(false);
  // Hoisted out of nested IIFEs in the Business drill-in (React error #310 fix):
  // hooks must be called in the same order every render regardless of subview,
  // so these cannot live inside an IIFE inside a conditionally-rendered branch.
  const [reviewLinksOpen, setReviewLinksOpen] = useState(false);
  const [vatChecking, setVatChecking] = useState(false);
  const [vatError, setVatError] = useState("");
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
    if (params.has('stripe_connect')) {
      const status = params.get('stripe_connect');
      if (status === 'success') alert("✓ Stripe connected — you can now accept card payments through your customer portal links.");
      else if (status === 'pending') alert("Stripe onboarding isn't fully complete yet. You can tap Connect Stripe again in Settings to finish — your progress is saved.");
      else if (status === 'cancelled') alert("Stripe connection cancelled. You can try again anytime from Settings → Integrations.");
      else if (status === 'error') alert(`Stripe connection failed: ${params.get('reason') || 'unknown error'}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
    // Always check DB for actual connection status
    if (!user?.id) return;
    db
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

  // ─── New navigation architecture (mockup-faithful redesign) ────────────────
  // subview: null = landing page; otherwise a category id from CATEGORIES below.
  const [subview, setSubview] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState(null); // { text, sub } | null
  const toastTimerRef = useRef(null);

  const showToast = (text, sub = "SAVED AUTOMATICALLY") => {
    setToast({ text, sub });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2400);
  };

  // Fire toast on brand changes — debounced 2s after the last edit, matching the
  // existing brand→Supabase sync timing so the toast appears when the save lands.
  // Skip the first render so we don't flash a toast on initial load.
  const lastBrandRef = useRef(null);
  const brandToastTimerRef = useRef(null);
  useEffect(() => {
    // Skip very first render (no prior brand to compare against)
    if (lastBrandRef.current === null) {
      lastBrandRef.current = brand;
      return;
    }
    if (lastBrandRef.current === brand) return; // identity check, no change
    lastBrandRef.current = brand;
    // Debounce so rapid keystrokes only trigger one toast
    if (brandToastTimerRef.current) clearTimeout(brandToastTimerRef.current);
    brandToastTimerRef.current = setTimeout(() => {
      showToast("Saved");
    }, 2100); // slightly after the existing 2s Supabase sync
  }, [brand]);

  // Computed status pills for each category (shown on the landing cards)
  const tradeCount = (brand.tradeTypes || []).length;
  const integrationsConnected = [xeroConnected, qbConnected, !!brand?.stripeAccountId].filter(Boolean).length;
  const memberCount = (members || []).length;

  // Categories config — drives the landing page rendering and drill-in routing
  const CATEGORIES = [
    {
      id: "ai-assistant",
      group: "YOUR PA",
      name: "AI Assistant",
      sub: "Name · wake words · personality · commands",
      featured: true,
      icon: (
        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-14 0M12 18v4M8 22h8M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3z" />
        </svg>
      ),
      iconTint: "amber",
      status: { text: assistantName || "Trade PA", color: "amber" },
    },
    {
      id: "phone-calls",
      group: "YOUR PA",
      name: "Phone & Calls",
      sub: "Business number · recording · transcription",
      icon: (
        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      ),
      iconTint: "amber",
      status: { text: "● Active", color: "green" },
    },
    {
      id: "business",
      group: "BUSINESS",
      name: "Business profile",
      sub: "Trading name · address · VAT · UTR",
      icon: (
        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11m4-11v11m8-11v11m4-11v11" />
        </svg>
      ),
      iconTint: "blue",
    },
    {
      id: "invoices",
      group: "BUSINESS",
      name: "Invoices & payments",
      sub: "Bank · terms · reference format · footer",
      icon: (
        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.66 0-3 .9-3 2s1.34 2 3 2 3 .9 3 2-1.34 2-3 2m0-8c1.11 0 2.08.4 2.6 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.4-2.6-1" />
        </svg>
      ),
      iconTint: "blue",
    },
    {
      id: "branding",
      group: "BUSINESS",
      name: "Branding",
      sub: "Logo · colour · appearance",
      icon: (
        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
      ),
      iconTint: "purple",
    },
    {
      id: "compliance",
      group: "BUSINESS",
      name: "Compliance & trade",
      sub: "Gas Safe · NICEIC · certifications · numbering",
      icon: (
        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      iconTint: "green",
      status: tradeCount > 0 ? { text: `${tradeCount} trade${tradeCount === 1 ? "" : "s"}`, color: "amber" } : null,
    },
    {
      id: "notifications",
      group: "WORKFLOW",
      name: "Notifications",
      sub: "Evening briefing · reminders · alerts",
      icon: (
        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
      iconTint: "neutral",
      status: brand.eveningBriefing ? { text: "● On", color: "green" } : null,
    },
    {
      id: "team",
      group: "WORKFLOW",
      name: "Team",
      sub: "Workspace · members · permissions",
      icon: (
        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a3 3 0 015.36-1.857M17 4a3 3 0 00-3 3c0 1.66 1.34 3 3 3s3-1.34 3-3-1.34-3-3-3zM12 12a4 4 0 100-8 4 4 0 000 8zM7 4a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      iconTint: "neutral",
      status: { text: `${memberCount} member${memberCount === 1 ? "" : "s"}` },
    },
    {
      id: "integrations",
      group: "WORKFLOW",
      name: "Integrations",
      sub: "Xero · QuickBooks · Stripe · more",
      icon: (
        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      iconTint: "neutral",
      status: integrationsConnected > 0 ? { text: `${integrationsConnected} connected`, color: "green" } : null,
    },
    {
      id: "plan",
      group: "ACCOUNT",
      name: "Plan & billing",
      sub: "Pro · unlimited · manage subscription",
      icon: (
        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M21 12c0 1.66-4 3-9 3s-9-1.34-9-3m18 0V5c0-1.66-4-3-9-3S3 3.34 3 5v7m18 0v7c0 1.66-4 3-9 3s-9-1.34-9-3v-7" />
        </svg>
      ),
      iconTint: "neutral",
      status: { text: getTierConfig(planTier).badgeText, color: "amber" },
    },
    {
      id: "help",
      group: "ACCOUNT",
      name: "Help & feedback",
      sub: "Report a bug · suggest an idea · contact",
      icon: (
        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01" />
        </svg>
      ),
      iconTint: "neutral",
    },
    {
      id: "diagnostics",
      group: "ACCOUNT",
      name: "Diagnostics",
      sub: "Error reports · system health",
      icon: (
        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17H7A5 5 0 017 7h2m6 10h2a5 5 0 000-10h-2m-7 5h10" />
        </svg>
      ),
      iconTint: "neutral",
    },
    {
      id: "recently-deleted",
      group: "WORKFLOW",
      name: "Recently deleted",
      sub: "Restore items deleted in the last 14 days",
      icon: (
        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          {/* Trash bin: lid + body + two vertical lines for the slats — same
              visual language as the system trash on iOS/Android. Clearer
              "this is the bin" read than the previous abstract clock-arrow. */}
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6" />
        </svg>
      ),
      iconTint: "amber",
    },
    // Admin views moved to the separate portal at admin.tradespa.co.uk —
    // see the trade-pa-admin repo. Admins sign in there with the same
    // credentials, gated server-side by admin_is_admin() RPC.
  ];

  // Tints for category icons (mockup uses several tones)
  const TINTS = {
    amber: { bg: `${C.amber}1f`, color: C.amber, border: `${C.amber}40` },
    green: { bg: `${C.green}1f`, color: C.green, border: `${C.green}40` },
    blue:  { bg: `${C.blue}1f`,  color: C.blue,  border: `${C.blue}40`  },
    purple:{ bg: "rgba(167,139,250,0.18)", color: "#a78bfa", border: "rgba(167,139,250,0.3)" },
    neutral:{ bg: C.surfaceHigh, color: C.textDim, border: C.border },
  };

  // Status pill colour map
  const STATUS_COLOURS = {
    green: C.green,
    amber: C.amber,
    red: C.red,
    blue: C.blue,
  };

  // Filter categories by search query (matches name OR sub-line)
  const q = searchQuery.toLowerCase();
  const filteredCategories = q
    ? CATEGORIES.filter(c => c.name.toLowerCase().includes(q) || c.sub.toLowerCase().includes(q))
    : CATEGORIES;

  // Group for landing-page rendering — preserves group order from CATEGORIES array
  const groups = (() => {
    const g = {};
    const order = [];
    for (const c of filteredCategories) {
      if (!g[c.group]) { g[c.group] = []; order.push(c.group); }
      g[c.group].push(c);
    }
    return order.map(name => ({ name, items: g[name] }));
  })();

  const activeCategory = subview ? CATEGORIES.find(c => c.id === subview) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "relative" }}>

      {/* ─── LANDING PAGE ─────────────────────────────────────────────────── */}
      {!subview && (
        <>
          {/* Page header */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              color: C.amber,
              fontWeight: 500,
            }}>Settings</div>
            <div style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: C.text,
              lineHeight: 1.1,
            }}>Settings</div>
          </div>

          {/* Search bar */}
          <div style={{
            background: C.surfaceHigh,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: "10px 12px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              placeholder="Search settings…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: C.text,
                fontSize: 16,
                fontFamily: "'DM Sans', sans-serif",
                minWidth: 0,
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                style={{
                  background: "transparent",
                  border: "none",
                  color: C.textDim,
                  cursor: "pointer",
                  padding: 4,
                  display: "grid",
                  placeItems: "center",
                  
                }}
              ><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
            )}
          </div>

          {/* Category groups */}
          {groups.length === 0 ? (
            <div style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              padding: 24,
              textAlign: "center",
              color: C.textDim,
              fontSize: 14,
            }}>No settings match "{searchQuery}".</div>
          ) : (
            groups.map(group => (
              <div key={group.name} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10,
                  color: C.muted,
                  letterSpacing: "0.14em",
                  fontWeight: 700,
                  paddingLeft: 4,
                  marginBottom: 2,
                }}>{group.name}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {group.items.map(cat => {
                    const tint = TINTS[cat.iconTint || "neutral"] || TINTS.neutral;
                    const isFeatured = !!cat.featured;
                    return (
                      <div
                        key={cat.id}
                        onClick={() => setSubview(cat.id)}
                        style={{
                          background: isFeatured ? `linear-gradient(135deg, ${C.amber}10, ${C.amber}04)` : C.surfaceHigh,
                          border: `1px solid ${isFeatured ? `${C.amber}40` : C.border}`,
                          borderRadius: 14,
                          padding: 12,
                          cursor: "pointer",
                          display: "grid",
                          gridTemplateColumns: "40px 1fr auto",
                          gap: 12,
                          alignItems: "center",
                          transition: "background 150ms ease",
                        }}
                      >
                        {/* Icon */}
                        <div style={{
                          width: 40, height: 40,
                          borderRadius: 10,
                          background: tint.bg,
                          border: `1px solid ${tint.border}`,
                          color: tint.color,
                          display: "grid",
                          placeItems: "center",
                          flexShrink: 0,
                        }}>
                          <div style={{ width: 20, height: 20 }}>{cat.icon}</div>
                        </div>
                        {/* Body */}
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: 14,
                            fontWeight: 700,
                            color: C.text,
                            lineHeight: 1.2,
                            marginBottom: 3,
                            letterSpacing: "-0.01em",
                          }}>{cat.name}</div>
                          <div style={{
                            fontSize: 11.5,
                            color: C.textDim,
                            lineHeight: 1.3,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}>{cat.sub}</div>
                        </div>
                        {/* Right column */}
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flexShrink: 0,
                        }}>
                          {cat.status && (
                            <span style={{
                              fontFamily: "'DM Mono', monospace",
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: "0.06em",
                              color: cat.status.color ? STATUS_COLOURS[cat.status.color] || C.textDim : C.textDim,
                            }}>{cat.status.text}</span>
                          )}
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          {/* Footer */}
          <div style={{
            marginTop: 18,
            padding: "16px 4px 4px",
            borderTop: `1px solid ${C.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}>
            <div style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              color: C.muted,
              letterSpacing: "0.06em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
            }}>v1.8.2 · {brand?.email || user?.email || ""}</div>
            <button
              onClick={async () => {
                if (!window.confirm("Sign out of Trade PA?")) return;
                try { await db.auth.signOut(); window.location.reload(); }
                catch (e) { alert("Sign out failed: " + e.message); }
              }}
              style={{
                background: "transparent",
                border: "none",
                color: C.red,
                fontFamily: "'DM Mono', monospace",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                cursor: "pointer",
                padding: "6px 0",
                flexShrink: 0,
              }}
            >Sign out</button>
          </div>
        </>
      )}

      {/* ─── DRILL-IN: app bar + intro hero, then existing content ────────── */}
      {subview && (
        <>
          {/* App bar */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "4px 0 8px",
            marginBottom: 4,
          }}>
            <button
              onClick={() => setSubview(null)}
              aria-label="Back to settings"
              style={{
                background: "transparent",
                border: "none",
                color: C.text,
                cursor: "pointer",
                padding: 6,
                display: "grid",
                placeItems: "center",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              color: C.muted,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}>SETTINGS / {(activeCategory?.name || "").toUpperCase()}</div>
            <div style={{ width: 32 }} />
          </div>

          {/* Intro hero */}
          {activeCategory && (() => {
            const tint = TINTS[activeCategory.iconTint || "neutral"] || TINTS.neutral;
            return (
              <div style={{
                background: `linear-gradient(135deg, ${tint.bg}, transparent)`,
                border: `1px solid ${tint.border}`,
                borderRadius: 14,
                padding: 16,
                display: "flex",
                gap: 14,
                alignItems: "center",
                marginBottom: 6,
              }}>
                <div style={{
                  width: 44, height: 44,
                  borderRadius: 12,
                  background: tint.bg,
                  border: `1px solid ${tint.border}`,
                  color: tint.color,
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}>
                  <div style={{ width: 22, height: 22 }}>{activeCategory.icon}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 16,
                    fontWeight: 700,
                    color: C.text,
                    letterSpacing: "-0.01em",
                    lineHeight: 1.15,
                    marginBottom: 3,
                  }}>{activeCategory.name}</div>
                  <div style={{
                    fontSize: 12,
                    color: C.textDim,
                    lineHeight: 1.4,
                  }}>{activeCategory.sub}</div>
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* ─── DRILL-IN CONTENT — each section conditionally renders by subview ─── */}
      {subview && (<>

      {subview === "branding" && (<>
      {/* Preview Invoice quick action — moved here from the old Save Changes bar */}
      <button
        onClick={() => setPreview(true)}
        style={{
          background: C.surfaceHigh,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          cursor: "pointer",
          width: "100%",
          color: C.text,
          fontFamily: "'DM Sans', sans-serif",
          marginBottom: 2,
        }}
      >
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em" }}>Preview an invoice</div>
          <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>See how your branding looks on a real invoice</div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>
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
              <div style={{ padding: "6px 14px", borderRadius: 10, background: brand.accentColor, color: "#fff", fontSize: 12, fontWeight: 700 }}>Button</div>
              <div style={{ padding: "6px 14px", borderRadius: 10, background: brand.accentColor + "22", border: `1px solid ${brand.accentColor}`, color: brand.accentColor, fontSize: 12, fontWeight: 700 }}>Badge</div>
            </div>
          </div>
        </div>
      </div>
      </>)}

      {subview === "plan" && (<>
      {/* Plan hero — big, clear at-a-glance status. Reads all presentation
          details from TIER_CONFIG so a tier added/renamed upstream flows
          through without editing this block. */}
      {(() => {
        const tierCfg = getTierConfig(planTier);
        // Map the tier's colorKey to the actual colour token for this theme.
        const tierColour = tierCfg.colorKey === "blue" ? C.blue
                        : tierCfg.colorKey === "green" ? C.green
                        : tierCfg.colorKey === "muted" ? C.muted
                        : C.amber;
        return (
      <div style={{
        background: `linear-gradient(135deg, ${tierColour}14, transparent)`,
        border: `1px solid ${tierColour}40`,
        borderRadius: 14,
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              color: C.muted,
              letterSpacing: "0.12em",
              fontWeight: 700,
              marginBottom: 4,
            }}>CURRENT PLAN</div>
            <div style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: C.text,
              lineHeight: 1.1,
            }}>Trade PA {tierCfg.label}</div>
            <div style={{ fontSize: 12, color: C.textDim, marginTop: 3 }}>
              {tierCfg.priceDisplay}
            </div>
          </div>
          <span style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            color: tierColour,
            background: `${tierColour}1a`,
            border: `1px solid ${tierColour}40`,
            padding: "4px 10px",
            borderRadius: 10,
            flexShrink: 0,
          }}>{tierCfg.badgeText}</span>
        </div>
      </div>
        );
      })()}

      {/* Upgrade CTA row — only shown for plans below Business. */}
      {planTier !== "business" && (
        <a
          href="mailto:hello@tradespa.co.uk?subject=Trade%20PA%20upgrade%20request"
          style={{
            background: C.surfaceHigh,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            textDecoration: "none",
            color: C.text,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: C.amber,
            }}>Upgrade plan →</div>
            <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 2 }}>
              {(() => {
                // Suggest the next tier up from the user's current one.
                // Business is the ceiling — this block doesn't render above.
                if (planTier === "solo") return "Pro Solo (£59/mo · 2× capacity), Team (£89/mo · 5 users) or Business (£129/mo · 10 users)";
                if (planTier === "pro_solo") return "Team (£89/mo · 5 users) or Business (£129/mo · 10 users)";
                if (planTier === "team") return "Business — £129/mo · up to 10 users";
                return "Business — £129/mo · up to 10 users";
              })()}
            </div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </a>
      )}

      {/* Manage subscription — Stripe Customer Portal */}
      {/* On iOS native builds (Capacitor), hide the portal button and */}
      {/* direct users to the web — Apple requires IAP for in-app sub */}
      {/* management. Web PWA + Android are fine. */}
      {(() => {
        const isIOSNative = typeof window !== "undefined"
          && window.Capacitor?.isNativePlatform?.()
          && window.Capacitor?.getPlatform?.() === "ios";

        const openPortal = async () => {
          try {
            const { data: { session } } = await window._supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) {
              alert("Please log in again to manage your subscription.");
              return;
            }
            const res = await fetch("/api/stripe/portal", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            });
            const data = await res.json();
            if (!res.ok) {
              alert(data.message || data.error || "Couldn't open billing portal.");
              return;
            }
            window.location.href = data.url;
          } catch (err) {
            console.error("[stripe-portal]", err);
            alert("Couldn't open billing portal. Please try again or email hello@tradespa.co.uk");
          }
        };

        return (
          <div style={{
            background: C.surfaceHigh,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>
                Manage subscription
              </div>
              <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 2 }}>
                {isIOSNative
                  ? "Update payment, invoices, cancellation on the web"
                  : "Update payment, download invoices, cancel or switch plan"}
              </div>
            </div>
            {isIOSNative ? (
              <a
                href="https://www.tradespa.co.uk"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10,
                  color: C.amber,
                  letterSpacing: "0.08em",
                  fontWeight: 700,
                  textDecoration: "none",
                  textTransform: "uppercase",
                  flexShrink: 0,
                }}
              >
                Open web →
              </a>
            ) : (
              <button
                onClick={openPortal}
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10,
                  color: C.amber,
                  letterSpacing: "0.08em",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  background: "transparent",
                  border: `1px solid ${C.amber}`,
                  borderRadius: 6,
                  padding: "6px 12px",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                Manage →
              </button>
            )}
          </div>
        );
      })()}

      {/* ── Monthly Usage (moved from AI Assistant subview) ─────────────── */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Monthly Usage</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
          Your allowance resets on the 1st of each month.
        </div>
        {(() => {
          const convUsed = usageData?.conversations_used || 0;
          const convCap = usageCaps?.convos || 100;
          const convUnlimited = convCap === Infinity;
          const convPct = convUnlimited ? 0 : Math.min(1, convUsed / convCap);
          const hfUsed = Math.round((usageData?.handsfree_seconds_used || 0) / 60);
          const hfCap = usageCaps?.hf_hours === Infinity ? Infinity : (usageCaps?.hf_hours || 1) * 60;
          const hfUnlimited = hfCap === Infinity;
          const hfPct = hfUnlimited ? 0 : Math.min(1, hfUsed / hfCap);
          const barStyle = () => ({
            height: 8, borderRadius: 4, background: C.surfaceHigh, overflow: "hidden", marginTop: 6, marginBottom: 14,
          });
          const fillStyle = (pct) => ({
            height: "100%", borderRadius: 4, width: (pct * 100) + "%",
            background: pct >= 1 ? "#ef4444" : pct >= 0.8 ? C.amber : C.green,
            transition: "width 0.3s ease",
          });
          const unlimitedPill = (
            <span style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: C.green,
              background: `${C.green}1a`,
              border: `1px solid ${C.green}40`,
              padding: "3px 8px",
              borderRadius: 4,
            }}>UNLIMITED</span>
          );
          const renderRow = (label, usedText, unlimited, pct) => (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, marginBottom: unlimited ? 14 : 0 }}>
                <span style={{ color: C.text, fontWeight: 600 }}>{label}</span>
                {unlimited ? unlimitedPill : (
                  <span style={{ color: pct >= 0.8 ? C.amber : C.muted, fontFamily: "'DM Mono',monospace" }}>
                    {usedText}
                  </span>
                )}
              </div>
              {!unlimited && <div style={barStyle()}><div style={fillStyle(pct)} /></div>}
            </>
          );
          return (<>
            {renderRow("AI Conversations", `${convUsed} / ${convCap}`, convUnlimited, convPct)}
            {renderRow("Hands-free time",  `${hfUsed} / ${hfCap} min`, hfUnlimited,   hfPct)}
            <div style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              color: C.muted,
              letterSpacing: "0.1em",
              textAlign: "center",
              paddingTop: 10,
              borderTop: `1px solid ${C.border}`,
              fontWeight: 600,
            }}>
              {getTierConfig(planTier).badgeText} PLAN · RESETS 1ST OF EACH MONTH
            </div>
          </>);
        })()}
      </div>

      {/* ── Add-ons (iOS Level B: neutral link, no prices/no "buy") ─────── */}
      {(() => {
        const isIOSNative = typeof window !== "undefined"
          && window.Capacitor?.isNativePlatform?.()
          && window.Capacitor?.getPlatform?.() === "ios";

        if (isIOSNative) {
          return (
            <div style={S.card}>
              <div style={S.sectionTitle}>Running low?</div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
                Manage your plan on the web at{" "}
                <a href="https://www.tradespa.co.uk" target="_blank" rel="noopener noreferrer" style={{ color: C.amber, textDecoration: "none", fontWeight: 600 }}>
                  tradespa.co.uk
                </a>.
              </div>
            </div>
          );
        }

        const items = [
          { key: "conversations", label: "+200 conversations",         price: "£39 one-off",            highlight: false },
          { key: "handsfree",     label: "+2 hours hands-free",        price: "£19 one-off",            highlight: false },
          { key: "combo",         label: "+200 conv & +2h hands-free", price: "£55 one-off · save £3",  highlight: true  },
        ];

        return (
          <div style={S.card}>
            <div style={S.sectionTitle}>Add-ons</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 14, lineHeight: 1.6 }}>
              Top up this month's allowance. Charged to your saved card, expires end of month.
            </div>
            {addonResult && (
              <div style={{
                marginBottom: 12,
                padding: "10px 12px",
                borderRadius: 6,
                fontSize: 12,
                lineHeight: 1.5,
                background: addonResult.type === "success" ? `${C.green}1a` : `${C.red}1a`,
                border: `1px solid ${addonResult.type === "success" ? `${C.green}40` : `${C.red}40`}`,
                color: addonResult.type === "success" ? C.green : C.red,
              }}>
                {addonResult.type === "success"
                  ? `✓ ${addonResult.displayName || "Add-on"} — ${addonResult.message}`
                  : `✕ ${addonResult.message}`}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map(item => (
                <div key={item.key} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "11px 12px",
                  background: C.surfaceHigh,
                  borderRadius: 6,
                  border: item.highlight ? `1px solid ${C.amber}40` : `1px solid transparent`,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: C.muted, fontFamily: "'DM Mono',monospace", marginTop: 2 }}>{item.price}</div>
                  </div>
                  <button
                    onClick={() => setAddonConfirm(item.key)}
                    disabled={addonBusy}
                    style={{
                      padding: "6px 12px",
                      border: `1px solid ${C.amber}`,
                      background: item.highlight ? C.amber : "transparent",
                      color: item.highlight ? "#412402" : C.amber,
                      fontSize: 10,
                      fontFamily: "'DM Mono', monospace",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      borderRadius: 4,
                      cursor: addonBusy ? "not-allowed" : "pointer",
                      opacity: addonBusy ? 0.5 : 1,
                      flexShrink: 0,
                    }}
                  >Buy →</button>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Confirmation modal (custom styled) ─────────────────────────── */}
      {addonConfirm && ADDON_DISPLAY[addonConfirm] && (
        <div
          onClick={() => !addonBusy && setAddonConfirm(null)}
          style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: "20px 20px 18px",
              width: "100%",
              maxWidth: 340,
            }}
          >
            <div style={{
              fontSize: 10,
              color: C.textDim,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontFamily: "'DM Mono', monospace",
              marginBottom: 10,
            }}>Confirm add-on</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
              {ADDON_DISPLAY[addonConfirm].title}
            </div>
            <div style={{ fontSize: 13, color: C.textDim, margin: "6px 0 16px", lineHeight: 1.55 }}>
              We'll charge{" "}
              <span style={{ color: C.amber, fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>
                £{(ADDON_DISPLAY[addonConfirm].pricePence / 100).toFixed(2)}
              </span>
              {" "}to your card on file.
            </div>
            <div style={{
              background: C.surfaceHigh,
              borderRadius: 6,
              padding: "11px 12px",
              marginBottom: 18,
            }}>
              <div style={{
                fontSize: 10,
                color: C.textDim,
                fontFamily: "'DM Mono', monospace",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 4,
              }}>You'll get</div>
              <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.55 }}>
                {ADDON_DISPLAY[addonConfirm].subtitle}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setAddonConfirm(null)}
                disabled={addonBusy}
                style={{
                  flex: 1,
                  padding: 10,
                  border: `1px solid ${C.border}`,
                  background: "transparent",
                  color: C.text,
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 6,
                  fontFamily: "'DM Mono', monospace",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  cursor: addonBusy ? "not-allowed" : "pointer",
                  opacity: addonBusy ? 0.5 : 1,
                }}
              >Cancel</button>
              <button
                onClick={() => purchaseAddon(addonConfirm)}
                disabled={addonBusy}
                style={{
                  flex: 1.6,
                  padding: 10,
                  border: `1px solid ${C.amber}`,
                  background: C.amber,
                  color: "#412402",
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 6,
                  fontFamily: "'DM Mono', monospace",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  cursor: addonBusy ? "not-allowed" : "pointer",
                  opacity: addonBusy ? 0.5 : 1,
                }}
              >
                {addonBusy ? "Processing..." : `Confirm · £${Math.round(ADDON_DISPLAY[addonConfirm].pricePence / 100)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      </>)}

      {subview === "branding" && (
      <div style={S.card}>
        <div style={S.sectionTitle}>Appearance</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>
          Choose how Trade PA looks. Light mode is easier to read in bright sunlight on site. Auto follows your phone's setting.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { k: "auto", label: "Auto", icon: "🌓", sub: "Follows phone" },
            { k: "light", label: "Light", icon: "☀️", sub: "Bright / outdoor" },
            { k: "dark", label: "Dark", icon: "🌙", sub: "Low light / van" },
          ].map(opt => {
            const active = theme === opt.k;
            return (
              <button
                key={opt.k}
                onClick={() => setTheme(opt.k)}
                style={{
                  flex: 1,
                  padding: "14px 8px",
                  borderRadius: 10,
                  border: `2px solid ${active ? C.amber : C.border}`,
                  background: active ? "rgba(245,158,11,0.12)" : C.surfaceHigh,
                  color: active ? C.amber : C.text,
                  cursor: "pointer",
                  fontFamily: "'DM Mono',monospace",
                  fontWeight: active ? 700 : 500,
                  fontSize: 12,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: 20 }}>{opt.icon}</span>
                <span>{opt.label}</span>
                <span style={{ fontSize: 10, color: C.muted, fontWeight: 400 }}>{opt.sub}</span>
              </button>
            );
          })}
        </div>
        {theme === "auto" && (
          <div style={{ fontSize: 11, color: C.muted, marginTop: 10, textAlign: "center" }}>
            Currently showing: <strong style={{ color: C.text }}>{resolvedTheme}</strong> mode
          </div>
        )}
      </div>
      )}

      {subview === "business" && (
      <div style={S.card}>
        <div style={S.sectionTitle}>Business Information</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { k: "tradingName", l: "Trading Name" },
            { k: "tagline", l: "Tagline (shown on invoice)" },
            { k: "phone", l: "Phone Number" },
            { k: "email", l: "Email Address" },
            { k: "website", l: "Website" },
          ].map(({ k, l }) => (
            <div key={k}>
              <label style={S.label}>{l}</label>
              <input style={S.input} value={brand[k]} onChange={set(k)} />
            </div>
          ))}

          {/* Review & Profile Links — collapsible */}
          {(() => {
            const reviewFields = [
              { k: "googleReviewUrl", l: "Google Review", icon: "🔍" },
              { k: "reviewUrlCheckatrade", l: "Checkatrade", icon: "🏠" },
              { k: "reviewUrlTrustpilot", l: "Trustpilot", icon: "⭐" },
              { k: "reviewUrlFacebook", l: "Facebook", icon: "👍" },
              { k: "reviewUrlWhich", l: "Which? Trusted Traders", icon: "✅" },
              { k: "reviewUrlMyBuilder", l: "MyBuilder", icon: "🔨" },
              { k: "reviewUrlRatedPeople", l: "Rated People", icon: "👷" },
            ];
            const filledCount = reviewFields.filter(f => brand[f.k]).length;
            return (
              <div>
                <div onClick={() => setReviewLinksOpen(o => !o)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8, cursor: "pointer", userSelect: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14 }}>🔗</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>Review & Profile Links</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{filledCount > 0 ? `${filledCount} link${filledCount !== 1 ? "s" : ""} added` : "Add your review platform links"}</div>
                    </div>
                  </div>
                  <span style={{ color: C.muted, fontSize: 16, transform: reviewLinksOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
                </div>
                {reviewLinksOpen && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10, padding: "12px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                    {reviewFields.map(({ k, l, icon }) => (
                      <div key={k}>
                        <label style={S.label}>{icon} {l}</label>
                        <input style={S.input} value={brand[k] || ""} onChange={set(k)} placeholder="https://" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* VAT Number — with live verification */}
          <div>
            <label style={S.label}>UTR Number (Unique Taxpayer Reference)</label>
            <input style={S.input} value={brand.utrNumber || ""} onChange={set("utrNumber")} placeholder="e.g. 1234567890" />
          </div>

          {/* VAT Number — with live verification */}
          {(() => {
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
      )}

      {subview === "invoices" && (
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
            <label style={S.label}>Default Quote Validity</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["14", "30", "60", "90"].map(d => (
                <button key={d} onClick={() => setBrand(b => ({ ...b, quoteValidity: d }))} style={S.pill(brand.accentColor, (brand.quoteValidity || "30") === d)}>{d} days</button>
              ))}
              <button onClick={() => setBrand(b => ({ ...b, quoteValidity: "custom" }))} style={S.pill(brand.accentColor, !["14","30","60","90"].includes(brand.quoteValidity || "30"))}>Custom</button>
            </div>
            {!["14","30","60","90"].includes(brand.quoteValidity || "30") && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <input
                  style={{ ...S.input, width: 80 }}
                  type="number"
                  min="1"
                  placeholder="e.g. 45"
                  value={["14","30","60","90","custom"].includes(brand.quoteValidity || "") ? "" : (brand.quoteValidity || "")}
                  onChange={e => setBrand(b => ({ ...b, quoteValidity: e.target.value }))}
                />
                <span style={{ fontSize: 12, color: C.muted }}>days</span>
              </div>
            )}
            <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Quotes auto-flag as expired after this many days. You can extend any expired quote from the Quotes tab.</div>
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
            <div style={{ marginTop: 10, padding: "8px 12px", background: C.surfaceHigh, borderRadius: 10, border: `1px solid ${C.border}` }}>
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
      )}

      {subview === "compliance" && (<>
      <CertificationsCard brand={brand} setBrand={setBrand} />
      </>)}

      {subview === "integrations" && (
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
          {xeroConnected ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={S.badge(C.green)}>✓ Connected</div>
              <button
                onClick={async () => {
                  if (!confirm("Disconnect Xero? Invoices will stop syncing. You can reconnect anytime.")) return;
                  // Client-side disconnect — deletes the connection row directly.
                  // Keeping it local (no new serverless endpoint) since the
                  // accounting_connections table is RLS-scoped to user_id and
                  // delete just means "stop syncing", doesn't revoke Xero tokens.
                  if (!user?.id) return;
                  try {
                    await db.from("accounting_connections").delete().eq("user_id", user.id).eq("provider", "xero");
                    setXeroConnected(false);
                  } catch (err) {
                    alert("Could not disconnect — try again.");
                  }
                }}
                style={{ ...S.btn("ghost"), fontSize: 11, color: C.muted }}
              >Disconnect</button>
            </div>
          ) : (
            <a
              href={`/api/auth/xero/connect?userId=${user?.id}`}
              style={{ ...S.btn("primary"), textDecoration: "none", background: "#13B5EA", fontSize: 12 }}
            >Connect Xero</a>
          )}
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
          {qbConnected ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={S.badge(C.green)}>✓ Connected</div>
              <button
                onClick={async () => {
                  if (!confirm("Disconnect QuickBooks? Invoices will stop syncing. You can reconnect anytime.")) return;
                  if (!user?.id) return;
                  try {
                    await db.from("accounting_connections").delete().eq("user_id", user.id).eq("provider", "quickbooks");
                    setQbConnected(false);
                  } catch (err) {
                    alert("Could not disconnect — try again.");
                  }
                }}
                style={{ ...S.btn("ghost"), fontSize: 11, color: C.muted }}
              >Disconnect</button>
            </div>
          ) : (
            <a
              href={`/api/auth/quickbooks/connect?userId=${user?.id}`}
              style={{ ...S.btn("primary"), textDecoration: "none", background: "#2CA01C", fontSize: 12 }}
            >Connect QuickBooks</a>
          )}
        </div>

        {/* ── Card Payments (Stripe Connect Standard) ──────────────────────
            Lets the tradesperson take card payments through their customer
            portal links. Money goes direct to their own Stripe account —
            Trade PA takes no cut. */}
        <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${C.border}` }}>
          <div style={S.sectionTitle}>Card Payments</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
            Connect Stripe to let your customers pay quotes and invoices by card directly from the portal link. Money goes to your Stripe account — we don't take a cut.
          </div>
          <div style={{ padding: "14px 16px", background: C.surfaceHigh, borderRadius: 8, display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: "#635BFF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ color: "#fff", fontWeight: 900, fontSize: 14 }}>S</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Stripe</div>
              <div style={{ fontSize: 11, color: C.muted }}>
                {brand?.stripeAccountId
                  ? `Connected${brand.stripeConnectedAt ? ` since ${new Date(brand.stripeConnectedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}`
                  : "Not connected — your portal pages will show bank transfer only"}
              </div>
            </div>
            {brand?.stripeAccountId ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={S.badge(C.green)}>✓ Connected</div>
                <button
                  onClick={() => {
                    if (!confirm("Disconnect Stripe? Card payments will stop working on your customer portal links. Your Stripe account stays intact — this only unlinks it from Trade PA. You can reconnect anytime.")) return;
                    // Clear the Stripe link from brand_data. The setBrand updater
                    // triggers the normal background sync to user_settings, so
                    // no direct DB call needed here.
                    setBrand(b => ({ ...b, stripeAccountId: null, stripeConnectedAt: null }));
                  }}
                  style={{ ...S.btn("ghost"), fontSize: 11, color: C.muted }}
                >Disconnect</button>
              </div>
            ) : (
              <a
                href={`/api/stripe/connect-onboard?userId=${user?.id}`}
                style={{ ...S.btn("primary"), textDecoration: "none", background: "#635BFF", fontSize: 12 }}
              >Connect Stripe</a>
            )}
          </div>
        </div>
      </div>
      )}

      {subview === "compliance" && (<>
      <div style={S.card}>
        <div style={S.sectionTitle}>Trade Registrations</div>
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
                <img src={brand.gasSafeLogo} alt="Gas Safe logo" style={{ height: 48, objectFit: "contain", background: "#fff", padding: 6, borderRadius: 10 }} />
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
        <div style={S.sectionTitle}>Certificate Numbering</div>
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
      </>)}

      {subview === "ai-assistant" && (<>
      <div style={S.card}>
        <div style={S.sectionTitle}>Your Assistant</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
          Name your AI, set its personality, choose wake words, and teach it your own voice commands.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: C.surfaceHigh, borderRadius: 8, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>Name</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.amber }}>{assistantName || "Trade PA"}</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: C.surfaceHigh, borderRadius: 8, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>Wake words</div>
            <div style={{ fontSize: 12, color: C.text, fontFamily: "'DM Mono',monospace" }}>{(assistantWakeWords || []).slice(0, 2).join(", ")}{(assistantWakeWords || []).length > 2 ? ` +${assistantWakeWords.length - 2}` : ""}</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: C.surfaceHigh, borderRadius: 8, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>Custom commands</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: (userCommandsCount || 0) > 0 ? C.green : C.muted }}>{userCommandsCount || 0}</div>
          </div>
        </div>
        <button onClick={() => openAssistantSetup && openAssistantSetup()} style={{ ...S.btn("primary"), width: "100%", justifyContent: "center" }}>
          ⚙ Manage assistant
        </button>
      </div>
      </>)}

      {subview === "phone-calls" && (
      <div style={S.card}>
        <div style={S.sectionTitle}>Call Tracking</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
          AI-powered call recording and transcription. Known customers who call are automatically recorded, transcribed and linked to their job or customer record. Unknown callers pass straight through unrecorded.
        </div>
        <CallTrackingSettings user={user} />
      </div>
      )}

      {subview === "notifications" && (
      <div style={S.card}>
        <div style={S.sectionTitle}>Evening Schedule Briefing</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
          Get a text message each evening with your schedule for the next day — so you're always prepared. Sends even when nothing is booked, so you always know the app is working.
        </div>

        {/* Toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: C.surfaceHigh, borderRadius: 8, marginBottom: 12, cursor: "pointer" }}
          onClick={() => setBrand(b => ({ ...b, eveningBriefing: !b.eveningBriefing }))}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Send evening briefing</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
              SMS to {brand.phone || "your phone number"}{!brand.phone && <span style={{ color: C.amber }}> — set your phone number above first</span>}
            </div>
          </div>
          <div style={{ width: 44, height: 24, borderRadius: 12, background: brand.eveningBriefing ? C.amber : C.border, position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
            <div style={{ position: "absolute", top: 2, left: brand.eveningBriefing ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px #0004" }} />
          </div>
        </div>

        {/* Time picker — only shown when enabled */}
        {brand.eveningBriefing && (
          <div>
            <label style={S.label}>Send time</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="time"
                style={{ ...S.input, maxWidth: 140 }}
                value={brand.eveningBriefingTime || "18:00"}
                onChange={e => setBrand(b => ({ ...b, eveningBriefingTime: e.target.value }))}
              />
              <div style={{ fontSize: 11, color: C.muted }}>UK time · default 6:00 PM</div>
            </div>
            <div style={{ marginTop: 12, padding: "10px 14px", background: C.green + "11", border: `1px solid ${C.green}33`, borderRadius: 8, fontSize: 11, color: C.green, lineHeight: 1.6 }}>
              ✓ Briefing active — you'll receive a text each evening at {brand.eveningBriefingTime || "18:00"} with tomorrow's schedule.
            </div>
          </div>
        )}

        {/* ── Calendar Subscription (live iCal feed) ─────────────────────────
            One-time setup — generates a private URL the user adds to Google
            or Apple Calendar as a "subscribed calendar". Their calendar then
            auto-refreshes every few hours, so jobs booked in Trade PA appear
            on their phone calendar without manual export. */}
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
          <div style={S.sectionTitle}>Calendar Subscription</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
            Sync your Trade PA schedule to Google Calendar, Apple Calendar or any iCal-compatible app. Jobs you book in Trade PA appear automatically — no manual export each time.
          </div>
          {brand.calendarToken ? (
            <>
              <label style={S.label}>Your private subscription URL</label>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <input
                  readOnly
                  style={{ ...S.input, fontFamily: "'DM Mono',monospace", fontSize: 11 }}
                  value={`${typeof window !== "undefined" ? window.location.origin : "https://www.tradespa.co.uk"}/api/calendar/${brand.calendarToken}.ics`}
                  onClick={e => e.target.select()}
                />
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/api/calendar/${brand.calendarToken}.ics`;
                    if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
                  }}
                  style={{ ...S.btn("ghost"), fontSize: 11 }}
                >Copy</button>
              </div>
              <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", fontSize: 11, color: C.textDim, lineHeight: 1.7, marginBottom: 10 }}>
                <div style={{ fontWeight: 600, color: C.text, marginBottom: 6 }}>How to subscribe</div>
                <div><strong>Google Calendar:</strong> Settings → Add calendar → From URL → paste the link.</div>
                <div><strong>Apple (iPhone):</strong> Settings app → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar → paste the link.</div>
                <div><strong>Apple (Mac):</strong> Calendar app → File → New Calendar Subscription → paste the link.</div>
                <div style={{ marginTop: 8, color: C.muted }}>Calendars typically refresh every few hours — for instant updates, set the refresh interval to "every hour" in your calendar app's subscription settings.</div>
              </div>
              <button
                onClick={() => {
                  if (!confirm("Generate a new URL? The old one will stop working — you'll need to update any calendars subscribed to it.")) return;
                  const t = Array.from(crypto.getRandomValues(new Uint8Array(24)))
                    .map(b => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
                  setBrand(b => ({ ...b, calendarToken: t }));
                }}
                style={{ ...S.btn("ghost"), fontSize: 11, color: C.muted }}
              >↻ Generate new URL (revoke old)</button>
            </>
          ) : (
            <button
              onClick={() => {
                // 24-byte cryptographically random token, 36-char alphanumeric
                const t = Array.from(crypto.getRandomValues(new Uint8Array(24)))
                  .map(b => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
                setBrand(b => ({ ...b, calendarToken: t }));
              }}
              style={S.btn("primary")}
            >Generate Subscription URL</button>
          )}
        </div>
      </div>
      )}

      {subview === "team" && (
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
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
          const ALL_SECTIONS = ["Dashboard", "Schedule", "Jobs", "Customers", "Invoices", "Quotes", "Materials", "Expenses", "CIS", "AI Assistant", "Reminders", "Payments", "Inbox", "Reports", "Mileage", "Workers", "Subcontractors", "Documents", "Reviews", "Stock", "RAMS"];

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
                              await db.from("company_members")
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
      )}

      {subview === "recently-deleted" && (
        <RecentlyDeleted user={user} />
      )}

      {subview === "help" && (<>
      {/* What's new row — fires a window event to open the changelog modal.
          The modal state lives in the main App component (out of this
          Settings component's scope), so we dispatch a custom event that
          App listens for. Cleaner than prop-threading through the whole
          Settings tree. */}
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("tp:open-changelog"))}
        style={{
          background: C.surfaceHigh,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          cursor: "pointer",
          width: "100%",
          textAlign: "left",
          color: C.text,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>What's new ✨</div>
          <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 2 }}>See the latest features and improvements</div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Send feedback row — opens the existing feedback modal */}
      <button
        onClick={openFeedback}
        style={{
          background: C.surfaceHigh,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          cursor: "pointer",
          width: "100%",
          textAlign: "left",
          color: C.text,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>Send feedback</div>
          <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 2 }}>Report a bug, suggest an idea, or tell us what's working</div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Email support row */}
      <a
        href="mailto:hello@tradespa.co.uk?subject=Trade%20PA%20support"
        style={{
          background: C.surfaceHigh,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          textDecoration: "none",
          color: C.text,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>Email us</div>
          <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 2, fontFamily: "'DM Mono', monospace" }}>hello@tradespa.co.uk</div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </a>

      {/* Visit website row */}
      <a
        href="https://tradespa.co.uk"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          background: C.surfaceHigh,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          textDecoration: "none",
          color: C.text,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>Visit website</div>
          <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 2, fontFamily: "'DM Mono', monospace" }}>tradespa.co.uk</div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 17L17 7M17 7H9M17 7V15" />
        </svg>
      </a>
      </>)}

      {subview === "diagnostics" && (<>
      {/* Generate report row — slim tappable, state changes during loading */}
      <button
        onClick={generateReport}
        disabled={reportLoading}
        style={{
          background: C.surfaceHigh,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          cursor: reportLoading ? "wait" : "pointer",
          width: "100%",
          textAlign: "left",
          color: C.text,
          fontFamily: "'DM Sans', sans-serif",
          opacity: reportLoading ? 0.65 : 1,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>
            {reportLoading ? "Generating report…" : "Generate error report"}
          </div>
          <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 2 }}>
            Last 30 days of errors, PA mistakes, voice failures
            {brand?.email && <span style={{ color: C.amber }}> · emails to {brand.email}</span>}
          </div>
        </div>
        {reportLoading ? (
          <div style={{ fontSize: 14, color: C.amber }}>⏳</div>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5l7 7-7 7" />
          </svg>
        )}
      </button>

      {/* Error state */}
      {reportError && (
        <div style={{
          background: `${C.red}14`,
          border: `1px solid ${C.red}40`,
          borderRadius: 10,
          padding: "10px 14px",
          fontSize: 12,
          color: C.red,
        }}>{reportError}</div>
      )}

      {/* Report ready panel */}
      {reportText && (
        <div style={{
          background: C.surfaceHigh,
          border: `1px solid ${reportText.startsWith("No errors") ? `${C.green}33` : C.border}`,
          borderRadius: 12,
          padding: 14,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              color: reportText.startsWith("No errors") ? C.green : C.amber,
              fontWeight: 700,
              letterSpacing: "0.1em",
            }}>
              {reportText.startsWith("No errors") ? "✓ NO ISSUES FOUND" : "📋 REPORT READY"}
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(reportText); showToast("Copied to clipboard", "READY TO PASTE"); }}
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                letterSpacing: "0.08em",
                fontWeight: 700,
                color: C.amber,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 0,
                textTransform: "uppercase",
              }}
            >Copy</button>
          </div>
          <textarea
            readOnly
            value={reportText}
            style={{ ...S.input, fontSize: 11, height: 180, resize: "vertical", fontFamily: "monospace", opacity: 0.8 }}
          />
          {!reportText.startsWith("No errors") && (
            <div style={{ fontSize: 11, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
              Paste this into a Claude session with: <span style={{ color: C.amber, fontFamily: "'DM Mono',monospace" }}>"Fix these issues in my Trade PA App.jsx"</span>
            </div>
          )}
        </div>
      )}
      </>)}

      {/* Preview Modal */}
      {preview && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 24 }} onClick={() => setPreview(false)}>
          <div onClick={e => e.stopPropagation()} style={{ maxHeight: "90vh", overflowY: "auto", borderRadius: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: C.muted, fontFamily: "'DM Mono',monospace" }}>INVOICE PREVIEW</div>
              <button aria-label="Close" onClick={() => setPreview(false)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
            </div>
            <InvoicePreview brand={brand} />
          </div>
        </div>
      )}
      </>)}

      {/* ─── Auto-save Toast ──────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: "fixed",
          bottom: "max(24px, env(safe-area-inset-bottom, 24px))",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 500,
          background: C.surface,
          border: `1px solid ${C.green}40`,
          borderRadius: 12,
          padding: "10px 14px 10px 12px",
          boxShadow: `0 12px 32px -8px rgba(0,0,0,0.6), 0 0 40px -8px ${C.green}30`,
          display: "flex",
          alignItems: "center",
          gap: 10,
          minWidth: 200,
          maxWidth: "calc(100% - 32px)",
          animation: "toast-in 200ms ease-out",
        }}>
          <div style={{
            width: 28, height: 28,
            borderRadius: "50%",
            background: `${C.green}1f`,
            border: `1px solid ${C.green}40`,
            color: C.green,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              fontWeight: 600,
              color: C.text,
              lineHeight: 1.2,
            }}>{toast.text}</div>
            {toast.sub && (
              <div style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 9,
                color: C.green,
                letterSpacing: "0.1em",
                marginTop: 2,
                fontWeight: 700,
              }}>{toast.sub}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
// (Dashboard moved to ./views/Dashboard.jsx — P7-7A)

// (Schedule helpers getWeekStart/formatDayLabel moved to ./views/Schedule.jsx — P7-7A)
// (Schedule moved to ./views/Schedule.jsx — P7-7A)
// (Materials cluster — MaterialRow + Materials moved to ./views/Materials.jsx — P7-7B)
function AIAssistant({ brand, setBrand, jobs, setJobs, invoices, setInvoices, enquiries, setEnquiries, materials, setMaterials, setMaterialsRaw, customers, setCustomers, onAddReminder, setView, user, companyId, refreshJobs, onShowPdf, onScanReceipt, sendPush, assistantName = "Trade PA", assistantWakeWords = ["hey trade pa", "trade pa", "trade pay"], assistantPersona = "", assistantSignoff = "", assistantVoice = "eve", userCommands = [], usageData = {}, setUsageData, usageCaps = { convos: 100, hf_hours: 1 }, currentMonth = "", voiceHandle = null, onHandsFreeChange = null, overlayContext = null, onCloseOverlay = null, onboardingStep = 99, advanceOnboarding = () => {}, pendingInboxCount = 0 }) {
  const [messages, setMessages] = useState([]);
  const [hasGreeted, setHasGreeted] = useState(false);
  const pendingWidgetRef = React.useRef(null);
  const messagesRef = React.useRef([]);  // always-current messages for stale-closure safety
  // Tracks entities created within the CURRENT turn so a subsequent tool in the
  // same turn can see them before React state flushes. Reset at the start of
  // each user message. Shape: { customers: [row, ...], jobs: [row, ...], ... }.
  // Read-merge-over-state pattern: tools read `customers` THEN overlay
  // turnCreatedRef.current.customers to see both historical + just-created rows.
  const turnCreatedRef = React.useRef({ customers: [], jobs: [], invoices: [] });

  const quick = [
    "What's on today?",
    "Any overdue invoices?",
    "Log time on a job",
    "Create a new job card",
  ];
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastAction, setLastAction] = useState(null);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [expandedWidget, setExpandedWidget] = useState(null);
  const [ramsSession, setRamsSession] = useState(null);
  const [sessionData, setSessionData] = useState({});
  const [expiryAlerts, setExpiryAlerts] = useState([]);

  // Phase 5-Pass B: AI-suggested inbox actions, surfaced on home.
  const [pendingInboxActions, setPendingInboxActions] = useState([]);
  const [processingInboxAction, setProcessingInboxAction] = useState({});
  // Session-scoped dismiss — user can hide the overnight card until next app open.
  // Stat tile count stays visible either way.
  const [inboxCardDismissed, setInboxCardDismissed] = useState(false);

  // Fetch pending inbox actions (called on mount + after approve/reject + on window event)
  const loadPendingInboxActions = React.useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/email/actions?userId=${user.id}&status=pending`);
      const data = await res.json();
      setPendingInboxActions(data.actions || []);
    } catch (e) { /* silent — home surface is best-effort */ }
  }, [user?.id]);

  React.useEffect(() => {
    loadPendingInboxActions();
    const h = () => loadPendingInboxActions();
    window.addEventListener("trade-pa-inbox-refreshed", h);
    return () => window.removeEventListener("trade-pa-inbox-refreshed", h);
  }, [loadPendingInboxActions]);

  // Check for expiring worker documents on load
  React.useEffect(() => {
    if (!user?.id) return;
    const cutoff = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const today = localDate();
    db.from("worker_documents")
      .select("*, team_members(name)").eq("user_id", user.id)
      .lte("expiry_date", cutoff).gte("expiry_date", today)
      .order("expiry_date", { ascending: true }).limit(5)
      .then(({ data }) => { if (data?.length) setExpiryAlerts(data); });
  }, [user?.id]);
  const [supportMode, setSupportMode] = useState(false);

  // ─── Limit-reached modal (sub-item 3) ──────────────────────────────────
  // Opens when the client-side cap check pre-empts a send, OR when /api/claude
  // returns 402 limit_reached / 403 account_locked mid-conversation.
  // `reason` is one of: 'limit_reached' | 'account_locked' | 'no_subscription'
  //                   | 'rate_limit_minute' | 'rate_limit_hour' | 'rate_limit_day'
  const [limitModal, setLimitModal] = useState(null); // { reason, message?, pendingText? } | null
  const [limitBusy, setLimitBusy] = useState(false);
  const [limitError, setLimitError] = useState(null);

  const buyAddonAndRetry = async (addonType) => {
    setLimitBusy(true);
    setLimitError(null);
    try {
      const { data: { session } } = await window._supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setLimitError("Please log in again to buy an add-on.");
        return;
      }
      const res = await fetch("/api/stripe/purchase-addon", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ addon_type: addonType }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setLimitError(data.message || "Add-on purchase failed. Please try again.");
        return;
      }
      // Charge succeeded. The payment_intent.succeeded webhook flips the row
      // to status='active', which makes check_usage_allowance sum it into the cap.
      // Small delay so the webhook has a chance to land before we retry the
      // user's pending message — if the retry races the webhook, it'll still
      // fail and the modal stays up for them to tap retry.
      const pending = limitModal?.pendingText;
      setLimitModal(null);
      setLimitError(null);
      if (pending) {
        setTimeout(() => { send(pending); }, 1000);
      }
    } catch (err) {
      console.error("[buyAddonAndRetry]", err);
      setLimitError("Couldn't complete purchase. Please try again or email hello@tradespa.co.uk");
    } finally {
      setLimitBusy(false);
    }
  };

  const ttsEnabledRef = useRef(true);
  const onboardingStepRef = useRef(onboardingStep);
  useEffect(() => { onboardingStepRef.current = onboardingStep; }, [onboardingStep]);
  const ttsAudioRef = useRef(null);
  const audioUnlockedRef = useRef(false);
  // Single persistent Audio element — iOS unlocks per-element, not globally.
  // Reusing one element means unlocking it once keeps it unlocked forever.
  const persistentAudioRef = useRef(typeof Audio !== "undefined" ? new Audio() : null);

  // Exposes a promise that resolves once the audio element has been unlocked
  // (silent priming play completed). speak() awaits this before its first
  // playback so we never hit the "first message silent" bug on press-to-talk.
  //
  // Why this is needed:
  // unlockAudio() used to be fire-and-forget. On a fresh tab, the user taps
  // mic → unlockAudio starts the priming play → mic records → transcribe →
  // Claude replies → speak() is called. On slow devices the priming play's
  // promise hasn't resolved by the time speak() runs, so audio.volume=1.0
  // hasn't taken effect and iOS Safari silently refuses playback. By
  // exposing a promise and awaiting it, speak() never races the unlock.
  const audioUnlockPromiseRef = useRef(null);

  const unlockAudio = () => {
    if (audioUnlockedRef.current) return audioUnlockPromiseRef.current || Promise.resolve();
    if (audioUnlockPromiseRef.current) return audioUnlockPromiseRef.current;
    const el = persistentAudioRef.current;
    if (!el) return Promise.resolve();
    audioUnlockPromiseRef.current = new Promise((resolve) => {
      try {
        // Silent WAV — play on the SAME element speak() will reuse for TTS.
        el.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
        el.volume = 0.001;
        el.play().then(() => {
          audioUnlockedRef.current = true;
          el.pause();
          // Reset volume immediately so the next play() on this element is
          // audible even if speak()'s own volume reset races with iOS's
          // deferred property application.
          el.volume = 1.0;
          el.muted = false;
          resolve();
        }).catch(() => {
          // Unlock failed (user hasn't gestured yet, or iOS refused). Don't
          // mark unlocked — will retry on next gesture. Resolve anyway so
          // speak() doesn't hang indefinitely.
          resolve();
        });
      } catch (e) {
        resolve();
      }
    });
    return audioUnlockPromiseRef.current;
  };
  const bottomRef = useRef(null);
  const [handsFree, setHandsFree] = useState(false);
  const handsFreeRef = useRef(false);
  const wakeWordRef = useRef(null); // Porcupine wake word engine

  // Mirror persona props into refs so mic callbacks always see fresh values
  const assistantNameRef = useRef(assistantName);
  const assistantWakeWordsRef = useRef(assistantWakeWords);
  const assistantSignoffRef = useRef(assistantSignoff);
  const assistantVoiceRef = useRef(assistantVoice);
  const userCommandsRef = useRef(userCommands);

  // Usage tracking refs — needed by mic callbacks (stale closure protection)
  const usageDataRef = useRef(usageData);
  const usageCapsRef = useRef(usageCaps);
  const handsFreeStartRef = useRef(null);

  // Hands-free auto-exit: count consecutive noise/silence cycles.
  // MUST be declared before useWhisper() — it's captured by onTranscriptRef closure.
  const emptyCyclesRef = useRef(0);

  // Returns true if `text` looks like background noise, not a real command
  const isNoiseTranscript = (text) => {
    if (!text) return true;
    const t = text.toLowerCase().trim().replace(/[.,!?\-—'"]/g, "");
    if (t.length < 3) return true;
    const words = t.split(/\s+/).filter(Boolean);
    if (words.length === 0) return true;
    const FILLERS = new Set([
      "um","umm","uh","uhh","hm","hmm","mm","mmm","mhm","ah","ahh","er","err",
      "eh","oh","ooh","oof","huh","hey","yo","ow","ouch","cough",
    ]);
    if (words.length === 1 && FILLERS.has(words[0])) return true;
    if (words.every(w => FILLERS.has(w))) return true;
    if (t.length < 6 && !/[aeiou]/.test(t)) return true;
    return false;
  };
  const [wakeWordReady, setWakeWordReady] = useState(false);
  const [wakeWordListening, setWakeWordListening] = useState(false);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { ttsEnabledRef.current = ttsEnabled; }, [ttsEnabled]);

  // ── PA Memory layer ───────────────────────────────────────────────────────
  const [paMemories, setPaMemories] = useState([]);
  const paMemoriesRef = useRef([]);
  const sessionActionsRef = useRef([]); // tracks successful action tool calls this session
  useEffect(() => { paMemoriesRef.current = paMemories; }, [paMemories]);

  // Load memories from Supabase on mount
  useEffect(() => {
    if (!user?.id) return;
    db.from("pa_memories")
      .select("id, content, category, times_reinforced")
      .eq("user_id", user.id)
      .order("times_reinforced", { ascending: false })
      .order("last_used", { ascending: false })
      .limit(40)
      .then(({ data }) => {
        if (data?.length) setPaMemories(data);
      }).catch(() => {});
  }, [user?.id]);

  // Persist a single memory — reinforces if similar one already exists
  const persistMemory = async (memContent, category, boost = 1) => {
    if (!memContent || memContent.length < 10 || !user?.id) return;
    const existing = paMemoriesRef.current.find(m =>
      m.content.toLowerCase().includes(memContent.slice(0, 25).toLowerCase())
    );
    if (existing) {
      const n = (existing.times_reinforced || 1) + boost;
      await db.from("pa_memories")
        .update({ times_reinforced: n, last_used: new Date().toISOString() }).eq("id", existing.id);
      setPaMemories(prev => prev.map(m => m.id === existing.id ? { ...m, times_reinforced: n } : m));
    } else {
      const { data: ins } = await db.from("pa_memories").insert({
        user_id: user.id, content: memContent, category: category || "fact",
        times_reinforced: boost, created_at: new Date().toISOString(), last_used: new Date().toISOString(),
      }).select().single();
      if (ins) setPaMemories(prev => [...prev, ins]);
    }
  };

  const lastRequestRef = React.useRef({ text: null, time: 0 });

  // Analyse completed exchange: detect corrections, extract facts, log errors — all silent background
  const extractAndStoreMemories = async (userText, assistantText) => {
    if (!user?.id || !userText || !assistantText) return;
    try {
      // Repetition detection — same request within 3 minutes = first attempt unsatisfactory
      const now = Date.now();
      const norm = userText.toLowerCase().trim().slice(0, 70);
      if (lastRequestRef.current.text === norm && (now - lastRequestRef.current.time) < 180000) {
        await logError("repetition", {
          error_msg: `User repeated: "${userText.slice(0, 100)}"`,
          user_input: userText.slice(0, 300),
          pa_response: assistantText.slice(0, 300),
          context: "Same request made twice — first response did not satisfy",
        });
      }
      lastRequestRef.current = { text: norm, time: now };

      // Get previous PA message for correction detection
      const msgs = messagesRef.current;
      const prevAsst = msgs.filter(m => m.role === "assistant").slice(-2, -1)[0]?.content || "";
      const hasPrev = prevAsst.length > 10;

      const prompt = hasPrev
        ? `Previous PA response: "${prevAsst.slice(0, 250)}"
User follow-up: "${userText}"
New PA response: "${assistantText.slice(0, 250)}"

1. Is the user correcting/rejecting the PREVIOUS response? If yes, one sentence describing the mistake. If no, null.
2. Up to 2 concrete long-term facts about this business. Skip greetings.
Return ONLY JSON: {"correction": "description of what PA did wrong" | null, "memories": [{"content": "...", "category": "business_fact|preference|customer_note|pattern"}]}`
        : `User: "${userText}"
PA: "${assistantText.slice(0, 250)}"
Extract up to 2 concrete long-term facts. Skip greetings.
Return ONLY JSON: {"correction": null, "memories": [{"content": "...", "category": "business_fact|preference|customer_note|pattern"}]}`;

      const res = await fetch("/api/claude", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 350,
          system: "Analyse tradesperson PA conversations. Return ONLY valid JSON, no markdown.",
          messages: [{ role: "user", content: prompt }],
          background: true
        })
      });
      if (!res.ok) return;
      const resp = await res.json();
      const raw = (resp.content || []).map(b => b.text || "").join("").trim();
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());

      // Correction: high-priority memory + error log
      if (parsed?.correction && typeof parsed.correction === "string" && parsed.correction.length > 15) {
        await persistMemory("LESSON: " + parsed.correction, "correction", 3);
        await logError("correction", {
          error_msg: parsed.correction,
          user_input: userText?.slice(0, 300),
          pa_response: prevAsst?.slice(0, 300),
          context: "Auto-detected: user corrected PA",
        });
      }

      // Regular memories
      for (const mem of (parsed?.memories || []).slice(0, 2)) {
        if (mem?.content) await persistMemory(mem.content, mem.category, 1);
      }
    } catch(e) { /* silent */ }
  };
  useEffect(() => { handsFreeRef.current = handsFree; }, [handsFree]);

  // Track hands-free session duration and flush to DB on end
  useEffect(() => {
    if (handsFree) {
      handsFreeStartRef.current = Date.now();
      // Log the session start so we can measure hands-free uptake per tier.
      trackEvent(db, user?.id, companyId, "voice_session", "handsfree_started", {});
    } else if (handsFreeStartRef.current) {
      const elapsed = Math.round((Date.now() - handsFreeStartRef.current) / 1000);
      handsFreeStartRef.current = null;
      if (elapsed > 5 && user?.id && currentMonth) {
        // Update local state immediately
        setUsageData(prev => ({
          ...prev,
          handsfree_seconds_used: (prev.handsfree_seconds_used || 0) + elapsed,
        }));
        // Flush to DB (non-blocking)
        Promise.resolve(db.rpc("increment_usage", {
          p_user_id: user.id, p_month: currentMonth,
          p_conversations: 0, p_seconds: elapsed,
        })).catch(() => {});
        // Analytics: session ended. Duration lets us see distribution of
        // real usage — if 90% of sessions are <30s, the "1h HF cap" on
        // Solo is vastly more than anyone ever needs.
        trackEvent(db, user?.id, companyId, "voice_session", "handsfree_ended", {
          duration_seconds: elapsed,
        });
      }
    }
  }, [handsFree]);
  useEffect(() => { assistantNameRef.current = assistantName; }, [assistantName]);
  useEffect(() => { assistantWakeWordsRef.current = assistantWakeWords; }, [assistantWakeWords]);
  useEffect(() => { assistantSignoffRef.current = assistantSignoff; }, [assistantSignoff]);
  useEffect(() => { assistantVoiceRef.current = assistantVoice; }, [assistantVoice]);
  useEffect(() => { userCommandsRef.current = userCommands; }, [userCommands]);
  useEffect(() => { usageDataRef.current = usageData; }, [usageData]);
  useEffect(() => { usageCapsRef.current = usageCaps; }, [usageCaps]);

  // ── Error capture system ─────────────────────────────────────────────────
  const logError = async (type, fields = {}) => {
    if (!user?.id) return;
    try {
      await db.from("pa_error_log").insert({
        user_id: user.id,
        error_type: type,
        occurred_at: new Date().toISOString(),
        ...fields,
      });
    } catch(e) { /* silent */ }
  };

  // Capture unhandled JS errors globally
  useEffect(() => {
    if (!user?.id) return;
    const onError = (e) => logError("js_error", {
      error_msg: e.message || "Unknown JS error",
      context: e.filename ? `${e.filename}:${e.lineno}` : "unknown location",
    });
    const onUnhandled = (e) => logError("js_error", {
      error_msg: String(e.reason?.message || e.reason || "Unhandled promise rejection"),
      context: "unhandled_promise",
    });
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandled);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandled);
    };
  }, [user?.id]);

  // Hands-free exit detection — two layers:
  //
  // 1. CLOSING_PHRASES: literal substring matches (fast path, most reliable
  //    for phrases users say exactly).
  // 2. CLOSING_PATTERNS: regex matches that tolerate filler words between
  //    key terms. E.g. "that's absolutely everything thank you" should end
  //    the session, but a literal includes("that's everything") misses it
  //    because of "absolutely" between.
  //
  // Heuristic for "thank you": only counts as a signoff if the transcript
  // is SHORT (<= 6 words) or ends with thanks — otherwise "thanks, now can
  // you also book..." would wrongly exit mid-conversation.
  const CLOSING_PHRASES = [
    "that's everything", "thats everything", "that is everything",
    "that's all", "thats all", "that is all",
    "all done", "i'm done", "im done", "we're done", "we are done",
    "nothing else", "no that's all", "no thats all",
    "no thanks", "no thank you",
    "goodbye", "good bye", "bye for now", "bye bye",
    "stop listening", "stop hands free", "exit hands free",
    "that'll do", "that will do", "thatll do",
    "i'm good", "im good", "we're good",
    "catch you later", "see you later",
    "turn off", "stop stop", "stop it",
    "thanks that's it", "thanks thats it",
    "nah you're alright", "nah your alright",
  ];

  // Regex patterns that allow up to 3 filler words between key terms.
  // \b word boundaries prevent matching inside unrelated words.
  const CLOSING_PATTERNS = [
    // "that's [absolutely/really/genuinely] everything/all/it/enough"
    /\b(that'?s|that is)\s+(?:\w+\s+){0,3}(everything|all|it|enough|fine|grand|great|perfect)\b/,
    // "that [will/would/should] [just] do"
    /\b(that|that'?ll)\s+(?:\w+\s+){0,2}do\b/,
    // "we're/i'm [all] [good/done/sorted/fine]"
    /\b(we'?re|i'?m|we are|i am)\s+(?:all\s+)?(good|done|sorted|fine|set)\b/,
    // "nothing (else)" — "nothing else", "nothing more", "no more"
    /\b(nothing|no more)\s+(else|more|thanks|thank you)?\b/,
  ];

  // Count words in a transcript (for the thank-you heuristic)
  const wordCount = (s) => (s.match(/\S+/g) || []).length;

  // Matches "thank you" / "thanks" ONLY when it's a short signoff-style
  // utterance — not "thanks, now can you also book Tuesday".
  const isThanksSignoff = (lower) => {
    if (!/\b(thank you|thanks|cheers ta|cheers mate)\b/.test(lower)) return false;
    // Short (<= 6 words) → almost certainly a signoff
    if (wordCount(lower) <= 6) return true;
    // Longer but ends with "thank you" or "thanks" → also a signoff
    if (/\b(thank you|thanks)\s*[.!?]*\s*$/.test(lower)) return true;
    return false;
  };

  // Use a ref for the transcript callback so it always uses fresh send()/messages
  // even when called from stale closures inside async mic/speech flows
  const onTranscriptRef = React.useRef(null);
  const onSilenceRef = React.useRef(null);

  const { recording, transcribing, toggle, startRecording, stopRecording } = useWhisper(
    (text) => onTranscriptRef.current && onTranscriptRef.current(text),
    () => onSilenceRef.current && onSilenceRef.current()
  );

  // Phase 2: tracks active TTS playback (server-side audio from /api/tts
  // — Grok primary, Deepgram Aura fallback — or Web Speech if /api/tts fails).
  // Declared BEFORE speak() to avoid TDZ in production bundles.
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Update refs on every render so they always point to fresh closures
  onTranscriptRef.current = (text) => {
    if (!text) return;
    const lower = text.toLowerCase().trim();

    // Allow voice activation of hands-free from anywhere — even manual mic taps
    const ACTIVATE = ["go hands free", "hands free mode", "hands-free mode",
      "enable hands free", "turn on hands free", "back on hands free",
      "put it on hands free", "start hands free", "go handsfree"];
    if (!handsFreeRef.current && ACTIVATE.some(p => lower.includes(p))) {
      // Fair-use cap check — is hands-free allowance exhausted?
      const caps = usageCapsRef.current || {};
      if (caps.hf_hours !== Infinity) {
        const secUsed = usageDataRef.current?.handsfree_seconds_used || 0;
        if (secUsed >= caps.hf_hours * 3600) {
          speak("You've used your " + caps.hf_hours + " hour hands-free allowance this month. Upgrade your plan for more, or tap the mic to keep using voice.");
          return;
        }
      }
      setHandsFree(true);
      handsFreeRef.current = true;
      emptyCyclesRef.current = 0;
      speak("Hands-free on. Go ahead.");
      return;
    }

    if (handsFreeRef.current) {
      // Noise filter — ignore garbage transcripts and count them
      if (isNoiseTranscript(text)) {
        emptyCyclesRef.current += 1;
        if (emptyCyclesRef.current >= 3) {
          emptyCyclesRef.current = 0;
          setHandsFree(false);
          handsFreeRef.current = false;
          speak("I'll pause there — tap the mic when you need me.");
        }
        return;
      }

      const isClosing = CLOSING_PHRASES.some(p => lower.includes(p))
        || CLOSING_PATTERNS.some(re => re.test(lower))
        || isThanksSignoff(lower);
      if (isClosing) {
        emptyCyclesRef.current = 0;
        setHandsFree(false);
        handsFreeRef.current = false;
        if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null; }
        stopRecording();
        const signoffMsg = assistantSignoffRef.current
          || ("No problem, I'll stop there. Just tap the mic whenever you need me.");
        speak(signoffMsg);
      } else {
        emptyCyclesRef.current = 0;
        // Custom command match?
        const cmd = (userCommandsRef.current || []).find(c =>
          c.enabled && c.phrase && lower.includes(c.phrase.toLowerCase())
        );
        if (cmd) {
          if (cmd.mode === "fast" && cmd.tool_name) {
            const paramsHint = cmd.default_params && Object.keys(cmd.default_params).length
              ? ` Use these default values: ${JSON.stringify(cmd.default_params)}.`
              : "";
            send(`[Custom command triggered: "${cmd.phrase}"] Please call the ${cmd.tool_name} tool now.${paramsHint} User said: "${text}"`);
          } else {
            const intentHint = cmd.intent ? ` Their intent: ${cmd.intent}` : "";
            send(`[Custom command: "${cmd.phrase}"]${intentHint} User said: "${text}"`);
          }
        } else {
          send(text);
        }
      }
    } else {
      // Phase 1 (20 Apr 2026): auto-send on manual mic — voice-first UX means
      // users shouldn't have to tap send after dictating. Hands-free adds the
      // mic reopen loop on top of this; manual mode just doesn't reopen.
      send(text);
    }
  };

  onSilenceRef.current = () => {
    // Use handsFreeRef only — `recording` state is stale in this callback closure
    if (handsFreeRef.current) {
      emptyCyclesRef.current += 1;
      if (emptyCyclesRef.current >= 3) {
        emptyCyclesRef.current = 0;
        setHandsFree(false);
        handsFreeRef.current = false;
        speak("I'll pause there — tap the mic when you need me.");
        return;
      }
      setTimeout(() => {
        if (handsFreeRef.current) startRecording(true, 3000);
      }, 600);
    }
  };

  // Helper: restart mic after speaking (or if speaking fails)
  // Speak using Web Speech API (instant, no API key, works offline)
  // Used as final fallback when server-side TTS (/api/tts — Grok or Deepgram)
  // is unreachable or the returned audio fails to play.
  const speakWebSpeech = (text, onEnd) => {
    if (!("speechSynthesis" in window)) { onEnd(); return; }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    let voices = window.speechSynthesis.getVoices();
    if (!voices.length) {
      window.speechSynthesis.onvoiceschanged = () => {
        voices = window.speechSynthesis.getVoices();
      };
    }
    const preferred = voices.find(v => v.name.includes("Kate"))
      || voices.find(v => v.name.includes("Serena"))
      || voices.find(v => v.name.includes("Samantha"))
      || voices.find(v => v.lang === "en-GB" && v.name.toLowerCase().includes("female"))
      || voices.find(v => v.lang === "en-GB")
      || voices.find(v => v.lang.startsWith("en"));
    if (preferred) utt.voice = preferred;
    utt.lang = "en-GB";
    utt.rate = 0.95;
    utt.pitch = 1.0;
    // Guard: onend and onerror can both fire on iOS — only call onEnd once
    let ended = false;
    const safeEnd = () => { if (!ended) { ended = true; onEnd(); } };
    utt.onend = safeEnd;
    utt.onerror = safeEnd;
    window.speechSynthesis.speak(utt);
  };

  const lastSpokenRef = React.useRef({ text: "", time: 0 });

  const speak = async (text) => {
    if (!ttsEnabledRef.current) return;
    // Dedup: don't repeat the same text if spoken within the last 3 seconds
    const now = Date.now();
    if (text === lastSpokenRef.current.text && now - lastSpokenRef.current.time < 3000) return;
    lastSpokenRef.current = { text, time: now };
    if (ttsAudioRef.current) { ttsAudioRef.current.pause(); ttsAudioRef.current = null; }
    window.speechSynthesis?.cancel();
    const clean = text.replace(/[*#_~`•]/g, "").replace(/\n+/g, " ").trim();
    if (!clean) return;

    // Phase 2: flip speaking state ON before any TTS attempt so the UI can morph.
    // Turned OFF in onSpeechEnd below, which is the single convergence point for
    // /api/tts success, /api/tts→Web Speech fallback, Web Speech end/error, and
    // safety-timer abort.
    setIsSpeaking(true);

    let speechEnded = false;
    let safetyTimer = null;

    const onSpeechEnd = () => {
      if (speechEnded) return;
      speechEnded = true;
      clearTimeout(safetyTimer);
      ttsAudioRef.current = null;
      setIsSpeaking(false);
      if (handsFreeRef.current) restartMicAfterSpeak(600);
    };

    const wrappedEnd = () => onSpeechEnd();

    // setSafety: call this whenever we know what state we're in so the timer is calibrated.
    //   "fetching"  — waiting for /api/tts response (10s max, long enough for slow connections)
    //   "playing"   — audio confirmed playing; timer covers estimated speech duration + buffer
    //   "fallback"  — Web Speech or play() blocked; 4s to detect silent iOS block
    const setSafety = (phase) => {
      clearTimeout(safetyTimer);
      const ms = phase === "fetching" ? 10000
               : phase === "playing"  ? Math.min(clean.length * 90 + 4000, 28000)
               :                         4000; // fallback / web speech
      safetyTimer = setTimeout(() => {
        if (!speechEnded) {
          console.warn("TTS safety [" + phase + "] — restarting mic");
          logError("tts_failure", {
            error_msg: `TTS safety timer fired in phase: ${phase}`,
            context: `Text length: ${clean.length} chars. Phase: ${phase}`,
          });
          onSpeechEnd();
        }
      }, ms);
    };

    // Start in "fetching" phase — gives network time to respond without cutting off early
    setSafety("fetching");

    // Wait for the audio element to be unlocked before trying to play on it.
    // First press-to-talk message was silent in regular browser because
    // unlockAudio's priming play hadn't finished resolving by the time we
    // got here — audio.play() on a not-yet-unlocked element fails silently
    // on iOS Safari. Solved by awaiting the unlock promise.
    //
    // But in PWA mode (iOS Safari standalone), the unlock promise can
    // sometimes never resolve — iOS kills background promise chains
    // aggressively. Awaiting it indefinitely stalls speak() forever and
    // the speaking UI state gets stuck. Cap the wait at 500ms; on web
    // unlock completes in ~50ms so this is invisible in the fast case,
    // and in PWA we fall through to fire-and-forget after half a second.
    try {
      await Promise.race([
        unlockAudio(),
        new Promise((resolve) => setTimeout(resolve, 500)),
      ]);
    } catch {}

    // Try server-side TTS first (/api/tts cascades: Grok → Deepgram Aura)
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean, voice: assistantVoiceRef.current }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        // Reuse the persistent element that was pre-unlocked on user tap — new Audio() fails on iOS
        const audio = persistentAudioRef.current || new Audio();
        // Fix (20 Apr 2026): reset volume + muted explicitly before playback.
        // unlockAudio() sets volume=0.001 for the silent priming WAV and never
        // resets, so without this the first TTS playback can be inaudible on
        // browsers that don't auto-reset volume on src change.
        audio.volume = 1.0;
        audio.muted = false;
        audio.onended = () => { URL.revokeObjectURL(url); wrappedEnd(); };
        audio.onerror = () => { URL.revokeObjectURL(url); setSafety("fallback"); speakWebSpeech(clean, wrappedEnd); };
        audio.src = url;
        ttsAudioRef.current = audio;
        // Switch to playback-duration timer once we know it's actually playing.
        //
        // iOS PWA quirk: audio.play() can resolve successfully but the audio
        // element never actually progresses (silent failure — no error event
        // fires either). Common on the very first TTS playback in a fresh
        // PWA launch before the audio session is warmed up. Detect this by
        // checking currentTime after a short delay — if still at 0 and no
        // duration metadata loaded, fall back to Web Speech.
        audio.play().then(() => {
          setSafety("playing");
          setTimeout(() => {
            if (speechEnded) return; // already moved on (normal end or other fallback)
            if (audio.currentTime === 0 && (isNaN(audio.duration) || audio.duration === 0)) {
              // Silent failure — element never actually played anything.
              try { audio.pause(); } catch {}
              URL.revokeObjectURL(url);
              ttsAudioRef.current = null;
              setSafety("fallback");
              speakWebSpeech(clean, wrappedEnd);
            }
          }, 400);
        }).catch(() => {
          URL.revokeObjectURL(url);
          ttsAudioRef.current = null;
          setSafety("fallback");
          speakWebSpeech(clean, wrappedEnd);
        });
        return;
      }
    } catch (e) {
      console.warn("/api/tts failed, using Web Speech:", e.message);
    }

    // Server-side TTS unavailable — Web Speech fallback
    setSafety("fallback");
    speakWebSpeech(clean, wrappedEnd);
  };

  // Normalize text before sending to TTS. Grok TTS tokenizes "63.3%" oddly
  // (reported 20 Apr 2026 — reads as "63, three percent" or similar). Pre-expanding
  // decimals-in-percentages and percent signs makes pronunciation reliable.
  // Defined BEFORE speakQueue so the closure reference is safe in prod bundles.
  const normalizeForTts = (text) => {
    if (!text) return text;
    return text
      // Decimals in percentages: "63.3%" → "63 point 3 percent"
      .replace(/(\d+)\.(\d+)\s*%/g, "$1 point $2 percent")
      // Plain percentages: "75%" → "75 percent"
      .replace(/(\d+)\s*%/g, "$1 percent");
  };

  // ─── Sentence-split parallel-TTS queue ────────────────────────────────
  // Phase 2 Stage 3+4 (20 Apr 2026): for multi-sentence replies, split on
  // sentence boundaries, fire TTS requests for ALL sentences in parallel,
  // then play them serially. First sentence reaches the user in ~200-300ms
  // (short text = fast TTS) vs ~800-1500ms when generating one big audio
  // file for the full reply. Subsequent sentences are already generated by
  // the time the previous one finishes playing, so audio is continuous.
  //
  // Keeps the single-sentence path identical to legacy speak() to avoid
  // regressing simple nudges like "Hands-free on. Go ahead."
  const speakQueueRef = useRef({ active: false, aborted: false });

  const splitSentences = (text) => {
    // Split on sentence-end punctuation. Keeps the punctuation with the
    // sentence. If no boundaries are found, returns the whole text as one
    // entry (single sentence, will use legacy speak() path).
    const matches = text.match(/[^.!?]+[.!?]+[\s]*|[^.!?]+$/g);
    if (!matches) return [text.trim()].filter(Boolean);
    return matches.map((s) => s.trim()).filter((s) => s.length > 0);
  };

  const speakQueue = async (fullText) => {
    if (!ttsEnabledRef.current) return;

    const clean = normalizeForTts(
      fullText.replace(/[*#_~`•]/g, "").replace(/\n+/g, " ").trim()
    );
    if (!clean) return;

    // Dedup check (same 3s window as speak()). We DO NOT update lastSpokenRef
    // yet — if this turns out to be a single-sentence call we delegate to speak()
    // and let it manage its own dedup, otherwise updating here would make speak()
    // dedup against itself and stay silent.
    const now = Date.now();
    if (clean === lastSpokenRef.current.text && now - lastSpokenRef.current.time < 3000) return;

    // Stop any prior playback and any in-flight queue
    if (speakQueueRef.current) speakQueueRef.current.aborted = true;
    if (ttsAudioRef.current) { try { ttsAudioRef.current.pause(); } catch {} ttsAudioRef.current = null; }
    window.speechSynthesis?.cancel();

    const sentences = splitSentences(clean);
    // Fallback to legacy single-shot speak() when there's only one sentence —
    // avoids overhead and keeps behavior identical for short nudges.
    if (sentences.length <= 1) { await speak(clean); return; }

    // Multi-sentence path: claim the dedup slot now so rapid re-entrance is ignored.
    lastSpokenRef.current = { text: clean, time: now };

    setIsSpeaking(true);
    const state = { active: true, aborted: false };
    speakQueueRef.current = state;

    // Fire TTS fetches for all sentences IN PARALLEL — they generate concurrently
    // on xAI's side, so by the time sentence N finishes playing, sentence N+1
    // is already ready.
    const fetchPromises = sentences.map((s) =>
      fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: s, voice: assistantVoiceRef.current }),
      })
        .then((r) => (r.ok ? r.blob() : null))
        .catch(() => null)
    );

    try {
      for (let i = 0; i < sentences.length; i++) {
        if (state.aborted) break;
        const blob = await fetchPromises[i];
        if (state.aborted) break;

        if (!blob) {
          // TTS failed for this sentence — fall back to Web Speech for it.
          // Awaits the web-speech onend so ordering is preserved across sentences.
          await new Promise((resolve) => speakWebSpeech(sentences[i], resolve));
          continue;
        }

        const url = URL.createObjectURL(blob);
        const audio = persistentAudioRef.current || new Audio();
        audio.volume = 1.0;
        audio.muted = false;
        audio.src = url;
        ttsAudioRef.current = audio;

        // Track whether play() promise rejection caused us to route to Web Speech fallback
        let usedFallback = false;

        await new Promise((resolve) => {
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            try { URL.revokeObjectURL(url); } catch {}
            state.currentResolver = null;
            resolve();
          };
          audio.onended = finish;
          audio.onerror = finish;
          // Expose finish() so abortSpeech() can resolve this Promise immediately
          // when pausing the audio — otherwise onended never fires on pause() and
          // the for-loop hangs forever.
          state.currentResolver = finish;

          audio.play().catch(() => {
            usedFallback = true;
            finish();
          });
        });

        // play() was blocked (e.g. iOS lost gesture) — run Web Speech inline so
        // we still speak the sentence. Skipped if the queue was aborted meanwhile.
        if (usedFallback && !state.aborted) {
          await new Promise((resolve) => speakWebSpeech(sentences[i], resolve));
        }
      }
    } finally {
      state.active = false;
      state.currentResolver = null;
      ttsAudioRef.current = null;
      setIsSpeaking(false);
      // Only restart mic if WE finished normally (not aborted by another speak request)
      if (handsFreeRef.current && !state.aborted) {
        restartMicAfterSpeak(600);
      }
    }
  };

  // Abort any in-flight speech: pauses current audio, flags the queue as aborted
  // so its for-loop bails on the next iteration, cancels Web Speech fallback, and
  // clears the isSpeaking UI state. Safe to call anytime — no-op if nothing is speaking.
  const abortSpeech = () => {
    if (speakQueueRef.current) {
      speakQueueRef.current.aborted = true;
      // Resolve any hung per-sentence Promise so the queue's for-loop can
      // iterate to its abort check and exit the finally block cleanly.
      if (speakQueueRef.current.currentResolver) {
        try { speakQueueRef.current.currentResolver(); } catch {}
        speakQueueRef.current.currentResolver = null;
      }
    }
    if (ttsAudioRef.current) {
      try {
        // Mute FIRST so there's no audible tail — iOS has a small buffer
        // that plays out after pause() alone, which leaks into the mic
        // when the user is interrupting.
        ttsAudioRef.current.muted = true;
        ttsAudioRef.current.pause();
      } catch {}
      ttsAudioRef.current = null;
    }
    try { window.speechSynthesis?.cancel(); } catch {}
    setIsSpeaking(false);
  };

  // Normalize text before sending to TTS: see definition near speakQueue above.
  // (This comment retains the location marker for future diffing — the function
  // itself lives earlier because speakQueue references it.)

  const toggleTts = () => {
    const newVal = !ttsEnabledRef.current;
    setTtsEnabled(newVal);
    ttsEnabledRef.current = newVal;
    if (!newVal) {
      if (ttsAudioRef.current) { ttsAudioRef.current.pause(); ttsAudioRef.current = null; }
      // Abort any in-flight speech queue so queued sentences don't keep playing
      if (speakQueueRef.current) speakQueueRef.current.aborted = true;
    }
  };

  // Detect platform once
  const isIosDevice = (navigator.userAgent.indexOf("iPhone") !== -1 || navigator.userAgent.indexOf("iPad") !== -1 || navigator.userAgent.indexOf("iPod") !== -1) && !window.MSStream;
  const isAndroid = navigator.userAgent.toLowerCase().indexOf("android") !== -1;

  // ── Phase 2: Android — Web Speech API continuous wake word ────────────────
  // Uses built-in Chrome speech recognition — no account or API key needed.
  // Listens for "hey trade" or "trade pa" as trigger phrase.
  const speechRecognitionRef = useRef(null);

  const initWakeWord = () => {
    if (!isAndroid) return; // iOS handled by hands-free loop only
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { console.warn("SpeechRecognition not available"); return; }
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-GB";
    recognition.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript.toLowerCase())
        .join(" ");
      const wakes = assistantWakeWordsRef.current || [];
      const matched = wakes.some(w => w && transcript.includes(w.toLowerCase()));
      if (matched && !recording && handsFreeRef.current) {
        recognition.stop();
        speechRecognitionRef.current = null;
        setWakeWordListening(false);
        abortSpeech(); // Stage 5: cut off any in-flight TTS before mic opens
        startRecording(true);
      }
    };
    recognition.onerror = (e) => {
      if (e.error !== "aborted") console.warn("Wake word error:", e.error);
    };
    recognition.onend = () => {
      // Restart wake word listening after a brief pause (if still in hands-free mode and not recording)
      if (handsFreeRef.current && !recording) {
        setTimeout(() => {
          if (handsFreeRef.current && !recording && speechRecognitionRef.current === null) {
            initWakeWord();
          }
        }, 1000);
      }
    };
    try {
      recognition.start();
      speechRecognitionRef.current = recognition;
      setWakeWordReady(true);
      setWakeWordListening(true);
    } catch(e) {
      console.warn("Wake word start failed:", e.message);
    }
  };

  const stopWakeWord = () => {
    if (speechRecognitionRef.current) {
      try { speechRecognitionRef.current.stop(); } catch(e) {}
      speechRecognitionRef.current = null;
    }
    setWakeWordReady(false);
    setWakeWordListening(false);
  };

  // Toggle hands-free mode
  const toggleHandsFree = () => {
    unlockAudio(); // unlock audio session at gesture time so TTS works after async operations
    const newVal = !handsFreeRef.current;
    setHandsFree(newVal);
    handsFreeRef.current = newVal;
    if (newVal) {
      if (isAndroid) {
        // Android: start wake word listener — mic opens when triggered
        initWakeWord();
      } else {
        // iOS: start listening immediately, loop via silence detection + TTS
        // 7s silence on initial start too — user may not speak immediately
        if (!recording && !transcribing) startRecording(true, 3000);
      }
    } else {
      stopRecording();
      stopWakeWord();
      if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null; }
    }
  };

  // Restart mic after AI finishes speaking (used by hands-free loop)
  const restartTimerRef = useRef(null);
  const restartMicAfterSpeak = (delay = 1200) => {
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null;
      if (!handsFreeRef.current) return;
      // 7s silence: user needs time to digest what was said before responding
      if (isAndroid) initWakeWord(); else startRecording(true, 3000);
    }, delay);
  };

  // When recording starts on Android (from wake word trigger), stop wake word recognition
  // to avoid conflict; it restarts after TTS ends via speak()
  useEffect(() => {
    if (recording && isAndroid && speechRecognitionRef.current) {
      try { speechRecognitionRef.current.stop(); } catch(e) {}
      speechRecognitionRef.current = null;
      setWakeWordListening(false);
    }
  }, [recording]);

  // After TTS ends on Android, reinstate wake word listening
  // (handled in speak() audio.onended — it calls startRecording(true) for iOS
  //  and initWakeWord() for Android via the hands-free flag)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // ── Tool definitions ──────────────────────────────────────────────────────
  const TOOLS = [
    {
      name: "create_job",
      description: "Create a scheduled calendar job with a date and time. IF NO DATE/TIME IS GIVEN IN THE USER'S PHRASE, use create_job_card instead — do NOT call this tool and then ask for the date. A tradie who says 'add a job for Patel' without a date deliberately didn't give one; they want tracking, not a booking. Triggers (require a date/time): \"book in [customer] for [date]\", \"schedule a job for [customer] on [day]\", \"add to the calendar for [date]\", \"put [customer] in the diary for [day]\". ASK IF MISSING: customer name first, then date/time if vague. DEFAULTS: duration → 1 day unless stated. \"Tuesday\" → next Tuesday. \"Morning\" → 9am. AFTER: \"Booked [customer] in for [date] at [time].\"",
      input_schema: {
        type: "object",
        properties: {
          customer: { type: "string", description: "Customer full name" },
          address: { type: "string", description: "Job address" },
          type: { type: "string", description: "Type of job e.g. Boiler Service, Leak Repair" },
          date_iso: { type: "string", description: "ISO date string for the job e.g. 2026-03-30" },
          time: { type: "string", description: "Time in HH:MM format e.g. 09:00" },
          value: { type: "number", description: "Job value in pounds" },
          status: { type: "string", enum: ["enquiry", "quoted", "accepted", "in_progress", "on_hold", "completed", "cancelled"], description: "Job status — defaults to accepted for newly-booked work" },
        },
        required: ["customer", "type", "date_iso", "time"],
      },
    },
    {
      name: "create_invoice",
      description: "Create a new invoice. Triggers: \"invoice [customer] £[X]\", \"bill [customer] for [work]\", \"raise an invoice\". ASK IF MISSING: customer name first, then amount. If user says a job name, use create_invoice_from_job instead. CUSTOMER LOOKUP: If the customer name matches an existing customer record, the system AUTOMATICALLY pulls in their email, address and phone — do NOT ask the user for these details if the customer is already in the customer list (you can see customer names in the business data block). Just take the action. The system will tell you in the response which fields it auto-filled. DEFAULTS: due date → 14 days, VAT → brand setting. AFTER: \"Invoice created — £[total] for [customer]. Send it now?\" If auto-fill happened, mention it briefly: \"Used the saved address — invoice created.\"",
      input_schema: {
        type: "object",
        properties: {
          customer: { type: "string", description: "Customer full name" },
          address: { type: "string", description: "Client address — always include if mentioned or if known from customer/job records. Appears in the Bill To section of the PDF." },
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
      description: "Create a price quote for a customer. Triggers: \"quote [customer] £X for [work]\", \"send an estimate\", \"give [customer] a price\". ASK IF MISSING: customer name, then amount. CUSTOMER LOOKUP: If the customer name matches an existing customer record, the system AUTOMATICALLY pulls in their email, address and phone — do NOT ask the user for these details if the customer is already saved. Just take the action. DEFAULTS: expiry → 30 days, VAT → brand setting. AFTER: \"Quote created for [customer] — £[amount]. Send it now?\"",
      input_schema: {
        type: "object",
        properties: {
          customer: { type: "string", description: "Customer full name" },
          address: { type: "string", description: "Client address — always include if mentioned or known. Appears in the Bill To section of the PDF." },
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
      description: "Log a new customer enquiry (someone who's asked about work but hasn't become a job yet). Triggers: \"log an enquiry from [name]\", \"new lead — [name] wants [work]\", \"someone called about [work]\". ASK IF MISSING: who enquired, and roughly what for. DEFAULTS: source → phone unless stated. AFTER: \"Enquiry logged for [name] — [work]. Want to quote or book them in?\"",
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
      description: "Set a reminder. Triggers: \"remind me to [thing]\", \"nudge me about [thing]\", \"don't let me forget to [thing]\". Prefer iso_time when the user gives a specific time. For vague phrasings (\"tomorrow morning\", \"next week\") pick a sensible time and confirm in the response: \"Reminder set for 9am tomorrow — ok?\" DEFAULTS: morning → 9am, afternoon → 2pm, evening → 6pm, no time → 9am that day. NOTE: When the reminder fires, it stays in the user's Upcoming list as 'Overdue' until they tap Done ✓ — it does NOT auto-disappear. So users can keep track of things they haven't actually followed through on.\n\nLINKING TO A JOB/INVOICE/CUSTOMER/ENQUIRY (related_type + related_id): when the reminder is about a specific entity in the user's current data, set both fields. This makes a real difference — the reminder email then shows live context (invoice status, job address, customer phone) instead of just the reminder text. Take this seriously; don't treat it as optional decoration.\n\nSTRONG SIGNALS that usually mean LINK:\n- 'chase' / 'chase up' + name → almost always an invoice. \"chase the Patel invoice\" OR just \"chase Patel\" → look for an unpaid invoice for Patel first; if exactly one matches, link it (related_type:\"invoice\", related_id:<invoices.id>).\n- 'call' / 'ring' / 'phone' + person's name → customer. \"remind me to call Steve tomorrow\" → if Steve matches exactly one customer, link (related_type:\"customer\", related_id:<customers.id>).\n- 'follow up on the X job' / 'check on the X job' / named job → job. (related_type:\"job\", related_id:<job_cards.id>).\n- 'reply to' / 'respond to' / 'get back to' + new enquiry → enquiry. (related_type:\"enquiry\", related_id:<enquiries.id>).\n\nDISAMBIGUATION RULES when multiple entities could match:\n- Prefer MORE specific over less: invoice > job > customer > enquiry. Ex: \"chase Patel\" where Patel has both an unpaid invoice AND an active job → link the invoice (the user wants the money).\n- If the name matches multiple rows of the same type (e.g. two open invoices for Smith), ASK a one-line clarifier before setting the reminder. Don't pick silently.\n- If the phrase is clearly about a specific entity but you can't find a match in the user's data (e.g. \"chase the Miller invoice\" but there's no Miller in invoices), set the reminder WITHOUT related_type/related_id and mention in your reply: \"Couldn't find a Miller invoice — reminder set as-is.\"\n\nLEAVE BOTH EMPTY when:\n- Free-form personal reminders: \"buy milk\", \"MOT the van\", \"book a haircut\".\n- Vague references with no match: \"follow up on the kitchen\" when no kitchen job exists.\n- You'd have to guess between equally-plausible options and the user hasn't clarified.\n\nNEVER fabricate an ID. If you're setting related_type you MUST be setting related_id to a real ID from the user's current data (job_cards.id, invoices.id, customers.id, or enquiries.id). No guessed UUIDs, no made-up numbers.\n\nAFTER: \"Reminder set for [when]: [what].\"",
      input_schema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What to remind them about" },
          iso_time: { type: "string", description: "ISO 8601 datetime for when to fire e.g. 2025-01-20T09:00:00. Use for specific times/dates." },
          minutes_from_now: { type: "number", description: "Minutes from now — use ONLY for purely relative times like 'in 30 minutes'" },
          time_label: { type: "string", description: "Human readable label e.g. 'Monday 9am', 'tomorrow at 3pm'" },
          related_type: { type: "string", enum: ["job", "invoice", "customer", "enquiry"], description: "Set when the reminder is about a specific entity in the user's data (chase X invoice, call Y customer, follow up on Z job, reply to enquiry). When multiple matches are possible, prefer more specific: invoice > job > customer > enquiry. Leave empty for free-form reminders or when you can't find a real match." },
          related_id: { type: "string", description: "The ID of the specific entity from the user's data. MUST be a real ID (job_cards.id, invoices.id, customers.id, or enquiries.id depending on related_type) — never fabricated. Required whenever related_type is set." },
        },
        required: ["text"],
      },
    },
    {
      name: "create_material",
      description: "Add a material or item to the materials list. Use this for ANY buying/ordering request — regardless of how the user phrases it. Common trade phrases to recognise: \"I need X\", \"order X\", \"put X on order\", \"get X from [supplier]\", \"pick up X from [merchant]\", \"grab some X\", \"pop to [merchant] for X\", \"nip to [yard] for X\", \"drop by [supplier] for X\", \"chase up X\", \"short on X\", \"running low on X\", \"need to get X in\", \"add X to my list\", \"stick X on my list\", \"create a PO for X\", \"raise a PO for X\". For multi-item requests (e.g. \"order 10 pipes and 4 valves from Plumb Centre\", \"need some pipes, valves and fittings\"), call this tool once per distinct item. ALWAYS include customer and job if mentioned — this links the material to the job card so it shows in job costs and profit. Always include unit_price if a price is stated. ASK IF MISSING: just item name is enough to log — don't block asking for qty or price. If they say a qty, use it; otherwise default to 1. AFTER: \"[qty] [item] added to your list[ for [customer]'s [job]].\"",
      input_schema: {
        type: "object",
        properties: {
          item: { type: "string", description: "Material or item name" },
          qty: { type: "number", description: "Quantity needed" },
          unit_price: { type: "number", description: "Cost per unit in £ — always include if user states a price or cost" },
          supplier: { type: "string", description: "Preferred supplier" },
          customer: { type: "string", description: "Customer name — include to help find the right job card" },
          job: { type: "string", description: "Job name or description this material is for" },
          job_title: { type: "string", description: "Job title — include to target the right job for repeat customers" },
        },
        required: ["item"],
      },
    },
    {
      name: "delete_job",
      description: "Delete or cancel a scheduled job. Triggers: \"cancel the [customer] job\", \"remove that booking\", \"delete [job] from my schedule\". CONFIRM FIRST. If customer has multiple jobs, list them: \"[Customer] has [N] jobs — which one?\" AFTER: \"Cancelled [customer]'s [job_type] on [date]. Gone.\"",
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
      description: "Delete an invoice. Triggers: \"remove that invoice\", \"delete invoice [X]\", \"scrap the [customer] invoice\". CONFIRM FIRST. Match by invoice ID or customer name. If customer has multiple invoices, list them: \"[Customer] has [N] invoices — which one?\" AFTER: \"[Customer]'s invoice [id] deleted — £[amount] gone from your books.\"",
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
      description: "Delete or dismiss an enquiry. Triggers: \"remove that enquiry\", \"delete the [name] enquiry\", \"[name] went cold\". CONFIRM FIRST if multiple match. AFTER: \"Enquiry from [name] dismissed.\"",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Customer name to match" },
        },
        required: ["name"],
      },
    },
    {
      name: "restore_recently_deleted",
      description: "Restore something the user just deleted. Triggers: \"undo that delete\", \"actually no, bring it back\", \"restore the [type] I just deleted\", \"I didn't mean to delete that\", \"oops, can you bring [name] back\". WHEN TO USE: any time the user signals regret about a recent delete or asks for an undo. ASK FOR DETAILS only if the request is vague — \"the [customer] invoice\" or \"the [name] customer\" is enough. AFTER: \"[Item] restored — back in your [Invoices/Customers/etc].\" If multiple matches, list them and ask which.",
      input_schema: {
        type: "object",
        properties: {
          item_type: { type: "string", description: "What they want restored — invoice, customer, job, expense, material, reminder, etc. Optional if user said 'the last thing I deleted'." },
          name_or_id: { type: "string", description: "Customer name or invoice/job ID to disambiguate which item." },
        },
        required: [],
      },
    },
    {
      name: "create_customer",
      description: "Save a new customer or update an existing one. Triggers: \"add a customer\", \"save this contact\", \"new client\", \"put [name] on file\". ASK IF MISSING: if only a name is given, log it and ask \"Got a phone number or email for them?\" — don't block on contact details. DEFAULTS: if an existing customer by the same name is found, treat as an update not a duplicate. AFTER: confirm with \"[Name] saved\" plus whatever contact details were captured.",
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
      description: "Delete a customer record. Triggers: \"remove [name]\", \"delete that customer\", \"take [name] off my books\". CONFIRM FIRST — destructive action. \"Delete [name] from your customer list — you sure? They've got [X] jobs linked.\" If they have active jobs, flag that before deleting. AFTER: \"[Name] removed from your customer list.\"",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Customer name to match" },
        },
        required: ["name"],
      },
    },
    {
      name: "update_material",
      description: "Update an existing material — change unit price, quantity, or supplier. Triggers: \"change the price on the blocks\", \"update 10 pipes to 15\", \"put those screws down to a fiver\". If multiple materials match the description, ask which one. AFTER: \"[Item] updated — [field] now [new value].\"",
      input_schema: {
        type: "object",
        properties: {
          item: { type: "string", description: "Material name to find" },
          job: { type: "string", description: "Job name to narrow to the right entry" },
          unit_price: { type: "number", description: "New unit price in £" },
          qty: { type: "number", description: "New quantity" },
          supplier: { type: "string", description: "New supplier name" },
        },
        required: ["item"],
      },
    },
    {
      name: "delete_material",
      description: "Delete material(s) from the list. Triggers: \"delete the [item]\", \"remove those [items]\", \"scrap the extra blocks\". DEFAULT COUNT is always 1 — only set higher when the user explicitly asks for a specific number (\"delete 3 of the blocks\"). For \"delete all the blocks\" or similar bulk intent, first COUNT how many match and confirm: \"You've got 7 blocks logged — remove all of them?\" then only proceed on yes. Never assume bulk delete silently. AFTER: \"[N] [item] removed from [job if set, else 'your materials'].\"",
      input_schema: {
        type: "object",
        properties: {
          item: { type: "string", description: "Material item name to match" },
          job: { type: "string", description: "Job name — always include if known to avoid deleting from wrong job" },
          count: { type: "number", description: "How many to delete. DEFAULT 1. Only set higher if user explicitly asks (e.g. 'delete 3 blocks' → 3). For 'delete all X', ask user to confirm the number first, then pass the confirmed count — never pass a large number speculatively." },
        },
        required: ["item"],
      },
    },
    {
      name: "mark_invoice_paid",
      description: "Mark an invoice as paid. Triggers: \"[customer] paid\", \"cleared the [customer] invoice\", \"money arrived from [customer]\", \"[customer] settled up\". If customer has multiple unpaid invoices, ask which one. DEFAULTS: payment date → today. AFTER: \"[Customer]'s invoice marked paid — £[amount]. Nice one.\"",
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
      description: "Change a job's status. Triggers: \"mark [job] as in progress\", \"that one's done now\", \"confirm the [customer] job\", \"put [job] on hold\", \"cancel the [customer] job\". Statuses: enquiry, quoted, accepted, in_progress, on_hold, completed, cancelled. If ambiguous which job, list recent jobs for that customer. AFTER: \"[Customer] job marked as [status].\"",
      input_schema: {
        type: "object",
        properties: {
          customer: { type: "string", description: "Customer name to identify the job" },
          job_type: { type: "string", description: "Job type to help identify it" },
          status: { type: "string", enum: ["enquiry", "quoted", "accepted", "in_progress", "on_hold", "completed", "cancelled"], description: "New status for the job" },
        },
        required: ["customer", "status"],
      },
    },
    {
      name: "convert_quote_to_invoice",
      description: "Turn an accepted quote into an invoice. Triggers: \"[customer] accepted the quote\", \"turn the [customer] quote into an invoice\", \"they said yes — bill them\". For repeat customers, ask which quote if unclear. DEFAULTS: invoice date → today, due date → 14 days. AFTER: \"Quote converted — invoice ready for [customer], £[amount]. Send now?\"",
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
      description: "Update material status — to_order → ordered → collected. Triggers: \"mark the [item] as ordered\", \"I've collected the pipes\", \"got the valves\". Updates ALL items with that name in one call. If user says \"I collected from Plumb Centre\", update all materials where supplier matches. AFTER: \"[N] items marked as [status].\"",
      input_schema: {
        type: "object",
        properties: {
          item: { type: "string", description: "Material item name to match" },
          status: { type: "string", enum: ["to_order", "ordered", "collected"], description: "New status" },
          job: { type: "string", description: "Job name — always include if mentioned to target the right job" },
          job_title: { type: "string", description: "Job title — alternative to job" },
        },
        required: ["item", "status"],
      },
    },
    {
      name: "create_job_card",
      description: "Create a job tracking card WITHOUT a scheduled date — for tracking work, costs and profitability. IF A DATE/TIME IS GIVEN IN THE USER'S PHRASE, use create_job instead (that books a calendar slot; this doesn't). Triggers (no date implied): \"add a job for [customer]\", \"create a job card\", \"new job — no date yet\", \"track [customer]'s extension\", \"set up a job card for [customer]\". ASK IF MISSING: customer name. Type/scope only if unclear. DEFAULTS: status → pending. AFTER: \"Job card created for [customer]. Want to add materials or set a date?\"",
      input_schema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Job title e.g. Boiler replacement, Kitchen extension" },
          customer: { type: "string", description: "Customer full name" },
          address: { type: "string", description: "Job site address" },
          type: { type: "string", description: "Type of work e.g. Plumbing, Gas, Electrical" },
          value: { type: "number", description: "Job value in pounds" },
          status: { type: "string", enum: ["enquiry", "quoted", "accepted", "in_progress", "on_hold", "completed", "cancelled"], description: "Job status — defaults to accepted" },
          notes: { type: "string", description: "Any notes about the job" },
          scope_of_work: { type: "string", description: "Detailed description of work to be done" },
        },
        required: ["customer"],
      },
    },
    {
      name: "assign_material_to_job",
      description: "Link an existing material to a job. Triggers: \"put those 10 pipes on the Smith job\", \"assign the copper to Patel\". CRITICAL: if customer has multiple jobs, ask which one. AFTER: \"[Material] linked to [customer]'s [job_title] — shows in that job's costs now.\"",
      input_schema: {
        type: "object",
        properties: {
          item: { type: "string", description: "Material item name to match" },
          customer: { type: "string", description: "Customer name of the job to link to" },
          job_title: { type: "string", description: "Job title or type — always include if known to target the right job" },
        },
        required: ["item", "customer"],
      },
    },
    {
      name: "log_time",
      description: "Log labour time against a job. Handles hourly rate, day rate, or price work. Triggers: \"log 8 hours on [job]\", \"2 days labour on [customer]\", \"I worked [X] on [customer]\", \"bang 4 hours on the [customer] job\". ALWAYS include job_title when customer has multiple jobs. DEFAULTS: labour type → hourly unless \"day\" or \"price work\" is said. Rate → worker's default rate unless stated. Date → today. Worker → user themselves unless someone else is named. AFTER: \"[hours/days/total] logged on [customer]'s [job]. £[amount].\"",
      input_schema: {
        type: "object",
        properties: {
          customer: { type: "string", description: "Customer name to find the job" },
          job_title: { type: "string", description: "Job title or type to identify which job — ALWAYS include this if mentioned or known. Prevents logging to wrong job for repeat customers." },
          labour_type: { type: "string", enum: ["hourly", "day_rate", "price_work"], description: "Type of labour" },
          hours: { type: "number", description: "Number of hours (hourly only)" },
          days: { type: "number", description: "Number of days (day_rate only)" },
          rate: { type: "number", description: "Hourly or day rate in £ (not for price_work)" },
          total: { type: "number", description: "Fixed total amount in £ (price_work only)" },
          description: { type: "string", description: "Description of work done" },
          date: { type: "string", description: "Date in YYYY-MM-DD format, default today" },
        },
        required: ["customer", "labour_type"],
      },
    },
    {
      name: "log_mileage",
      description: "Log a mileage trip for HMRC tax purposes. RULES: (1) If the user gives BOTH from and to addresses, call the tool straight away — don't ask them to re-confirm addresses. (2) If they gave miles, pass them; if they gave from/to but no miles, leave miles empty — distance is auto-calculated from the addresses. (3) If they gave only ONE end (\"I drove to Wickes\" with no starting point), ASK: \"Starting from your usual base, or somewhere else?\" — mileage isn't loggable without both ends. (4) Don't ask for purpose if not given — default to 'business'. Use log_without_miles: true if they say 'log it without miles' or 'add miles later'. DEFAULTS: date → today, rate → 45p/mile. Triggers: \"log 20 miles to [customer]\", \"22 miles round trip to Wickes\", \"drove to [postcode] and back today\", \"log the trip to [site]\", \"add today's mileage\". AFTER: \"[miles] miles logged — [from] to [to]. £[amount] at 45p.\"",
      input_schema: {
        type: "object",
        properties: {
          from_location: { type: "string", description: "Start address or location" },
          to_location: { type: "string", description: "Destination address or location" },
          miles: { type: "number", description: "ONLY include if user explicitly stated a miles figure. Leave out if from/to addresses are given — distance is auto-calculated." },
          purpose: { type: "string", description: "Purpose e.g. site visit, materials collection" },
          date: { type: "string", description: "Date in YYYY-MM-DD format, default today" },
          log_without_miles: { type: "boolean", description: "Set true if user wants to save the trip now and add miles later" },
        },
        required: ["from_location", "to_location"],
      },
    },
    {
      name: "add_job_note",
      description: "Add a note to a job card. Triggers: \"note on the [customer] job — [text]\", \"add a note\", \"stick this on the [job] card\". ASK IF MISSING: note content, if unclear what to write. CRITICAL: always include job_title when customer has multiple jobs. AFTER: \"Note added to [customer]'s [job].\"",
      input_schema: {
        type: "object",
        properties: {
          customer: { type: "string", description: "Customer name to find the job" },
          job_title: { type: "string", description: "Job title or type — always include if known to target the right job" },
          note: { type: "string", description: "The note text to add" },
        },
        required: ["customer", "note"],
      },
    },
    {
      name: "update_stock",
      description: "Adjust stock quantity. Negative adjustments for usage, positive for deliveries.\n\nTRIGGER-TO-SIGN MAPPING:\n- \"used X\", \"fitted X\", \"installed X\", \"took X out\", \"went through X\" → NEGATIVE adjustment (subtract from stock).\n- \"received X\", \"got X in\", \"topped up with X\", \"bought X for stock\", \"restocked\" → POSITIVE adjustment (add to stock).\n- If the phrasing is ambiguous (\"stock of blocks changed by 3\", \"adjust by 2\"), ASK: \"Used or received?\"\n\nASK IF MISSING: if no item specified, ask which. AFTER: \"[Item]: [new qty] in stock.[ Below reorder level — want to add to materials?]\"",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Stock item name to match" },
          adjustment: { type: "number", description: "Amount to add (positive) or remove (negative)" },
        },
        required: ["name", "adjustment"],
      },
    },
    {
      name: "find_invoice",
      description: "Find and display an existing invoice inline. Triggers: \"show me [customer]'s invoice\", \"pull up invoice [X]\", \"open the [customer] bill\". If multiple matches, list them: \"[Customer] has [N] invoices — which one?\" If none, offer: \"No invoice for [customer]. Want me to create one?\" AFTER: \"Pulled up [customer]'s invoice — £[amount], [status].\"",
      input_schema: { type: "object", properties: { customer: { type: "string", description: "Customer name" }, id: { type: "string", description: "Invoice ID e.g. INV-042" } } },
    },
    {
      name: "find_quote",
      description: "Find and display a specific quote inline. Triggers: \"show me [customer]'s quote\", \"pull up the [customer] estimate\". If multiple, list them. If none, offer: \"No quote for [customer]. Create one?\" AFTER: \"Pulled up [customer]'s quote — £[amount].\"",
      input_schema: { type: "object", properties: { customer: { type: "string", description: "Customer name" }, id: { type: "string", description: "Quote ID e.g. QTE-001" } } },
    },
    {
      name: "find_job_card",
      description: "Find and display a specific job card inline. Triggers: \"show me the [customer] job\", \"pull up [job]\", \"open the [customer] card\". If multiple matches, list them and ask which. If none, offer: \"No job card for [name]. Want me to create one?\" AFTER: \"Pulled up [customer]'s [job_title].\"",
      input_schema: { type: "object", properties: { customer: { type: "string", description: "Customer name" }, title: { type: "string", description: "Job title or type" } } },
    },
    {
      name: "list_invoices",
      description: "Show a list of invoices inline. ALWAYS use filter: 'unpaid' for outstanding/due/unpaid/awaiting payment queries. Use filter: 'paid' for paid/cleared. Use sort_by: 'amount_desc' for biggest/highest, 'amount_asc' for smallest/lowest, 'date_desc' (default) for newest. Triggers: \"show unpaid invoices\", \"what's due\", \"who owes me\", \"biggest unpaid\", \"largest outstanding\". AFTER: summarise total if meaningful — \"[N] unpaid totalling £[X].\"",
      input_schema: { type: "object", properties: {
        filter: { type: "string", enum: ["all", "unpaid", "overdue", "paid"], description: "unpaid = outstanding/awaiting payment. paid = settled/collected. overdue = past due date. all = everything." },
        sort_by: { type: "string", enum: ["date_desc", "amount_desc", "amount_asc"], description: "How to sort. amount_desc for 'biggest' / 'largest' / 'highest', amount_asc for 'smallest' / 'lowest', date_desc (default) for newest first." },
      } },
    },
    {
      name: "list_jobs",
      description: "Show a list of job cards inline. Triggers: \"what jobs have I got on\", \"show my active jobs\", \"list all jobs\", \"what's on the go\". No follow-up needed. If filtering (e.g. \"jobs for Smith\"), apply the filter. AFTER: \"[N] jobs [filter label] — [highest-value or most-recent one] at the top.\"",
      input_schema: { type: "object", properties: { filter: { type: "string", enum: ["all", "active", "completed", "in_progress"], description: "Which jobs to show" } } },
    },
    {
      name: "list_materials",
      description: "Show a list of materials inline. Triggers: \"what do I need to order\", \"show my materials\", \"what's still to pick up\", \"running list\". Filter by status if mentioned (\"to order\", \"collected\"). AFTER: summarise counts — \"[N] to order, [M] already out.\"",
      input_schema: { type: "object", properties: { filter: { type: "string", enum: ["all", "to_order", "ordered", "collected"], description: "Which materials to show" } } },
    },
    {
      name: "find_material_receipt",
      description: "Show a material's receipt/invoice image inline. Triggers: \"show me the receipt for [item]\", \"pull up the invoice for the copper\", \"where's the Screwfix receipt\". If multiple matches, list them. AFTER: \"Pulled up the [item] receipt — [supplier], £[amount].\"",
      input_schema: { type: "object", properties: { item: { type: "string", description: "Material item name" }, supplier: { type: "string", description: "Supplier name" } } },
    },
    {
      name: "list_schedule",
      description: "Show this week's or today's scheduled calendar jobs (jobs with a date/time). Triggers: \"what have I got on today\", \"show my schedule\", \"what's on tomorrow\", \"this week's jobs\", \"what am I doing Friday\". DEFAULTS: range → today if unspecified, week if \"this week\". AFTER: \"[N] jobs this [period] — [brief summary].\"",
      input_schema: { type: "object", properties: { filter: { type: "string", enum: ["today", "this_week", "next_week"], description: "Which period to show" } } },
    },
    {
      name: "get_job_full",
      description: "Fetch and display a complete job card with ALL details — notes, photos, documents, time logs, materials, drawings, VOs, certs. Triggers: \"give me everything on the [customer] job\", \"full detail on [job]\", \"what's on the [customer] card\". For repeat customers, ask which job if unclear. AFTER: \"[Customer]'s [job] — full card. [one-sentence highlight, e.g. £[value] value, [N] materials logged].\"",
      input_schema: { type: "object", properties: { customer: { type: "string", description: "Customer name" }, title: { type: "string", description: "Job title or type" } } },
    },
    {
      name: "get_job_profit",
      description: "Calculate and display profit breakdown for a job — revenue, labour cost, material cost, gross profit, margin. Triggers: \"what's my profit on [job]\", \"how'd the [customer] job do\", \"am I making money on [job]\". For repeat customers, ask which job if unclear. AFTER: if margin < 15%, flag it gently: \"Margin looks tight at [X]% — might be unlogged materials or labour.\"",
      input_schema: { type: "object", properties: { customer: { type: "string", description: "Customer name" }, title: { type: "string", description: "Job title if needed" } } },
    },
    {
      name: "start_rams",
      description: "Start building a RAMS (Risk Assessment Method Statement) conversationally — a multi-step flow. Triggers: \"create a RAMS for [job]\", \"need a method statement for [customer]\", \"start a RAMS\". ASK IF MISSING: which job it's for. DEFAULTS: site address → from job card if known. After starting, the AI walks through hazards → method step by step. AFTER: \"Starting a RAMS for [job]. First — title, scope and dates. Give me what you've got and I'll fill the rest.\"",
      input_schema: { type: "object", properties: { job_ref: { type: "string" }, site_address: { type: "string" } } },
    },
    {
      name: "rams_save_step1",
      description: "Save RAMS step 1 (project details) and move to step 2. Use when user provides title, scope, site address, client, dates. AFTER: \"Step 1 saved. What type of work is this — e.g. plumbing, electrical, gas, roofing, groundworks? I'll build a hazard list from there.\"",
      input_schema: { type: "object", properties: { title: { type: "string" }, scope: { type: "string" }, site_address: { type: "string" }, client_name: { type: "string" }, start_date: { type: "string" }, end_date: { type: "string" }, prepared_by: { type: "string" } } },
    },
    {
      name: "rams_save_step2",
      description: "Save RAMS step 2 — present hazard categories for user to choose from. Call with the categories or work types the user mentions. AFTER: Show the generated hazard list back to the user and ask them to review/amend — \"Here's the hazards I've pulled for that work: [list]. Want anything removing or adding?\"",
      input_schema: { type: "object", properties: { categories: { type: "string", description: "Categories or work types the user chose" }, work_types: { type: "string", description: "Alternative: types of work described" } } },
    },
    {
      name: "rams_confirm_hazards",
      description: "Confirm the hazard list after the user reviews it during a RAMS build. Triggers: after showing hazards, any of \"confirmed\", \"ok\", \"yes\", \"good\", \"looks right\", or specific removals/additions like \"remove slips\" or \"add working at height\". Only call in the middle of a RAMS flow, not standalone. AFTER: \"Hazards locked in. Now the method — here's a standard sequence for this work: [list]. Any steps to change, add or remove?\"",
      input_schema: { type: "object", properties: { remove: { type: "string", description: "Hazards to remove, comma separated" }, add: { type: "string", description: "Custom hazards to add, one per line" } } },
    },
    {
      name: "rams_save_step3",
      description: "Confirm the method statement steps after user reviews them. Call when user confirms or specifies changes. AFTER: \"Method sorted. Any COSHH substances on site — solvents, adhesives, gas cylinders, chemical cleaners? If not, say 'none' and I'll move on.\"",
      input_schema: { type: "object", properties: { remove_numbers: { type: "string", description: "Step numbers to remove e.g. 3,7" }, add: { type: "string", description: "Additional steps to add, one per line" } } },
    },
    {
      name: "rams_save_step4",
      description: "Save RAMS step 4 (COSHH substances). Call with substances list or 'none'. AFTER: \"Last bit — emergency info. Who's the first aider? Nearest A&E? Muster point? Welfare location? You can give me one at a time or all in one.\"",
      input_schema: { type: "object", properties: { substances: { type: "string", description: "Comma-separated substances or 'none'" } } },
    },
    {
      name: "rams_save_step5",
      description: "Save RAMS step 5 (emergency/welfare) and SAVE the completed RAMS to the database. AFTER: \"RAMS done and saved for [job]. You can find it in the RAMS tab to download as PDF.\"",
      input_schema: { type: "object", properties: { first_aider: { type: "string" }, nearest_ae: { type: "string" }, muster_point: { type: "string" }, welfare_location: { type: "string" }, emergency_procedure: { type: "string" } } },
    },
    {
      name: "update_brand",
      description: "Save or update the user's business details — name, trade, phone, address, email, VAT status, logo, registration numbers. Triggers: during onboarding, or \"change my trading name to [X]\", \"update my phone on invoices\", \"set my VAT number\". ASK IF MISSING: which field if unclear. AFTER: confirm what changed — \"Trading name updated to [X]. Will show on all new invoices.\"",
      input_schema: {
        type: "object",
        properties: {
          tradingName: { type: "string", description: "Business/trading name" },
          ownerName: { type: "string", description: "Owner's first name" },
          phone: { type: "string", description: "Phone number" },
          email: { type: "string", description: "Email address" },
          address: { type: "string", description: "Business address" },
          tradeType: { type: "string", description: "What trade they do e.g. plumber, electrician, builder, gas, multi-trade" },
          vatNumber: { type: "string", description: "VAT number if registered" },
          vatEnabled: { type: "boolean", description: "Whether they are VAT registered" },
          gasSafeNumber: { type: "string", description: "Gas Safe register number — gas engineers only" },
          niceicNumber: { type: "string", description: "NICEIC number — electricians only" },
          napitNumber: { type: "string", description: "NAPIT number — electricians only (alternative to NICEIC)" },
          oftecNumber: { type: "string", description: "OFTEC number — oil heating engineers only" },
          mcsNumber: { type: "string", description: "MCS number — renewable energy installers only" },
          fensaNumber: { type: "string", description: "FENSA number — window/door installers only" },
          bankName: { type: "string", description: "Bank name e.g. Barclays" },
          accountName: { type: "string", description: "Account holder name" },
          sortCode: { type: "string", description: "Sort code e.g. 20-45-67" },
          accountNumber: { type: "string", description: "Account number e.g. 12345678" },
        },
      },
    },
    { name: "log_expense", description: "Log a business expense — fuel, parking, tools, accommodation, meals, other. Triggers: \"log £[X] for fuel\", \"add £[X] expense for parking\", \"claim £[X] for tools\", \"paid £[X] for [thing]\". If the expense is linked to a specific job (e.g. \"£30 parking on the Bishop job\"), include customer or job_title so it shows in that job's profit breakdown. ASK IF MISSING: amount and description are critical. Category — infer from description if possible (fuel/parking/tools/meals/accommodation/other). DEFAULTS: date → today. AFTER: \"£[amount] logged under [category].\"", input_schema: { type: "object", properties: { exp_type: { type: "string", enum: ["fuel","parking","tools","accommodation","meals","other","mileage"] }, description: { type: "string" }, amount: { type: "string" }, miles: { type: "string" }, exp_date: { type: "string" }, customer: { type: "string", description: "Customer name if this expense is for a specific job — links the expense to that job's profit breakdown." }, job_title: { type: "string", description: "Optional job title to disambiguate if the customer has multiple jobs." } }, required: ["description"] } },
    { name: "list_expenses", description: "Show recent expenses inline. Triggers: \"show my expenses\", \"what have I spent\", \"expenses this month\". Filter by category or date range if mentioned. AFTER: total if meaningful — \"£[X] spent across [N] expenses this month.\"", input_schema: { type: "object", properties: {} } },
    { name: "log_cis_statement", description: "Log a CIS deduction statement received from a contractor. Triggers: \"CIS from [contractor] — gross £[X], deducted £[Y]\", \"log my CIS statement\". ASK IF MISSING: contractor name, gross, deduction amounts are all required. Tax month — default to current month. AFTER: \"CIS logged — £[gross] gross, £[deduction] deducted ([rate]%).\"", input_schema: { type: "object", properties: { contractor_name: { type: "string" }, gross_amount: { type: "string" }, deduction_amount: { type: "string" }, tax_month: { type: "string" }, notes: { type: "string" } }, required: ["contractor_name","gross_amount","deduction_amount"] } },
    { name: "list_cis_statements", description: "Show CIS deduction statements inline. Triggers: \"show my CIS\", \"CIS statements this year\", \"what CIS have I had\". Filter by tax year if mentioned. AFTER: \"[N] statements logged, £[total deducted] deducted year-to-date.\"", input_schema: { type: "object", properties: {} } },
    { name: "add_subcontractor", description: "Add a new subcontractor. Triggers: \"add [name] as a sub\", \"register [name] as a subbie\", \"new subbie — [name], [rate]% CIS\". ASK IF MISSING: name is required. UTR, CIS rate, phone/email — ask in priority order, only the most critical one. DEFAULTS: CIS rate → 30% if no UTR provided (HMRC rule for unregistered subs), 20% if UTR on file, unless the user states a rate. AFTER: \"[Name] added as a sub — [CIS rate]% CIS.\"", input_schema: { type: "object", properties: { name: { type: "string" }, company: { type: "string" }, utr: { type: "string" }, cis_rate: { type: "string", description: "20 registered, 30 unregistered, 0 gross" }, email: { type: "string" }, phone: { type: "string" }, address: { type: "string", description: "Business or home address" } }, required: ["name"] } },
    { name: "log_subcontractor_payment", description: "Log a payment to a subcontractor, optionally linked to a job. Triggers: \"paid [name] £[X]\", \"sort [name]'s money — £[X] on [job]\", \"log £[X] to [subbie]\". Include customer and job_title to link the cost to a job — this makes it show in job profit. ASK IF MISSING: subbie name is required AND you must have SOME amount info (one of: gross, labour_amount+materials_amount, days+rate, or hours+rate). Never log a payment with only a name — if no amount was given, ASK: \"How much — gross total, or labour/materials split?\" Payment type → price_work if just an amount, day_rate if \"per day\", hourly if \"per hour\". DEFAULTS: date → today. AFTER: \"£[amount] logged to [name]. CIS deduction: £[X].\"", input_schema: { type: "object", properties: { name: { type: "string", description: "Subcontractor name" }, customer: { type: "string", description: "Customer name to link this cost to a job card" }, job_title: { type: "string", description: "Job title to identify which job card to link to" }, payment_type: { type: "string", enum: ["price_work","day_rate","hourly"], description: "How they are paid" }, labour_amount: { type: "number", description: "Labour portion in £ (price_work) — CIS applies to this" }, materials_amount: { type: "number", description: "Materials portion in £ (price_work) — no CIS" }, gross: { type: "number", description: "Total gross if not splitting labour/materials" }, days: { type: "number", description: "Days worked (day_rate only)" }, hours: { type: "number", description: "Hours worked (hourly only)" }, rate: { type: "number", description: "Day or hourly rate in £" }, date: { type: "string" }, job_ref: { type: "string" }, description: { type: "string" }, invoice_number: { type: "string" } }, required: ["name"] } },
    { name: "list_subcontractors", description: "Show all subcontractors inline. Triggers: \"show my subbies\", \"list my subcontractors\", \"who's on my sub list\". AFTER: count — \"[N] subbies on your books.\"", input_schema: { type: "object", properties: {} } },
    { name: "list_unpaid", description: "Show what the user still owes — unpaid subcontractor payments and/or unpaid materials. ALWAYS choose the correct scope based on the user's question:\n- scope=\"subcontractors\" when they ask about subcontractors, subs, subbies, workers, labour payments. Examples: \"do I owe any subbies?\", \"what do I owe my subcontractors?\", \"who haven't I paid from my team?\".\n- scope=\"materials\" when they ask about materials, supplier bills, merchant invoices, stock. Examples: \"any unpaid materials?\", \"what do I owe the merchant?\", \"outstanding supplier bills?\".\n- scope=\"all\" only for general/ambiguous questions. Examples: \"what do I owe?\", \"any bills outstanding?\", \"money out?\", \"show me everything unpaid\".\nThis is about money the user OWES others (money out) — NOT money owed TO them (that would be invoices/list_invoices).\nAFTER: \"£[total] owed across [N] [scope label]. [Highest/oldest one] is the biggest.\"", input_schema: { type: "object", properties: { scope: { type: "string", enum: ["all","subcontractors","materials"], description: "Which category to list. Pick the most specific one that matches the user\u2019s question." } }, required: ["scope"] } },
    { name: "add_compliance_cert", description: "Log a compliance certificate record against a job card. Supported types: Gas Safety Certificate (CP12), Boiler Commissioning Sheet, EICR, Electrical Installation Certificate (EIC), Minor Works Certificate, PAT Testing, Pressure Test Certificate, Part P Certificate, Oil Safety Certificate, MCS, FENSA. ASK FOR MISSING INFO — if user says \"create a certificate\" without specifying type, ask which kind. If they name a type but no customer/job, ask which job it's for (or list recent jobs). If no cert number, ask for it. If no expiry date on a dated cert (CP12/EICR/Pressure/Oil — usually 12 months), suggest the standard validity. Default issued_date to today if unstated. NOTE: This logs the certificate record only. The full signed PDF with test results (pressure readings, tightness tests, appliance details, etc.) is completed in the job card's Certificates tab — mention this to the user after logging so they know to complete the PDF there. AFTER: \"[Cert type] logged for [customer]'s [job] — expires [date]. Complete the signed PDF in the Certificates tab when you're at the desk.\"", input_schema: { type: "object", properties: { customer: { type: "string", description: "Customer name" }, job_title: { type: "string", description: "Job title or type — include for repeat customers" }, doc_type: { type: "string", description: "Certificate type — use standard UK names (CP12, EICR, PAT, EIC, Pressure Test, Part P, Oil Safety, MCS, FENSA)" }, doc_number: { type: "string", description: "Certificate reference number" }, issued_date: { type: "string", description: "Date issued YYYY-MM-DD — defaults to today if unstated" }, expiry_date: { type: "string", description: "Expiry date YYYY-MM-DD — most UK certs are 12 months" }, notes: { type: "string", description: "Any relevant notes — passes, defects, recommendations" } }, required: ["doc_type"] } },
    { name: "add_variation_order", description: "Add a variation order (extra work/scope change) to a job. Triggers: \"VO on [job] for [work], £[X]\", \"variation on [customer] — extra [work]\", \"log a change on [job]\". ASK IF MISSING: description and amount are required. For repeat customers, confirm which job. AFTER: \"VO added to [customer]'s [job] — [description], £[amount].\"", input_schema: { type: "object", properties: { customer: { type: "string" }, job_title: { type: "string" }, description: { type: "string" }, amount: { type: "string" }, vo_number: { type: "string" } }, required: ["description","amount"] } },
    { name: "log_daywork", description: "Log a daywork sheet on a job — for ad-hoc work outside the original scope. Triggers: \"log dayworks on [job]\", \"daywork sheet for [customer] — [hours] at [£rate]\", \"add daywork to [job]\". ASK IF MISSING: hours and rate are required. Worker name — default to user if unclear. DEFAULTS: date → today. AFTER: \"Daywork logged — [hours]hr at £[rate]. Total £[amount].\"", input_schema: { type: "object", properties: { customer: { type: "string" }, job_title: { type: "string" }, date: { type: "string" }, worker_name: { type: "string" }, hours: { type: "string" }, rate: { type: "string" }, description: { type: "string" }, contractor_name: { type: "string" } }, required: ["hours","rate"] } },
    { name: "send_review_request", description: "Send a review request email to a customer. Triggers: \"ask [customer] for a review\", \"send a review request to [customer]\", \"get [customer] to leave a review\". ASK IF MISSING: no email on file → ask. AFTER: \"Review request sent to [customer] — [platforms].\"", input_schema: { type: "object", properties: { customer: { type: "string" }, email: { type: "string" } }, required: ["customer"] } },
    { name: "get_report", description: "Show a financial report inline — summary, VAT, outstanding/aged debt, job profitability, customer activity, materials, CIS, or tax year. Triggers: \"how am I doing\", \"what have I earned\", \"revenue summary\", \"VAT this quarter\", \"who owes me money\", \"outstanding invoices\", \"top jobs by profit\", \"top customers\", \"materials spend\", \"CIS this year\", \"tax year summary\". DEFAULTS: report_type → summary, period → this_month unless stated. For self-assessment / tax-return queries always pick report_type:\"summary\" with period:\"tax_year\" (current) or \"last_tax_year\". AFTER: brief spoken summary and the full report opens in the Reports tab.", input_schema: { type: "object", properties: { report_type: { type: "string", enum: ["summary","vat","outstanding","jobprofit","customers","materials","cis"], description: "Which report to compute. summary = P&L overview (default)." }, period: { type: "string", enum: ["this_month","last_month","last_3_months","last_6_months","this_quarter","last_quarter","this_year","last_year","tax_year","last_tax_year"] } } } },
    { name: "list_reminders", description: "Show active reminders inline. Triggers: \"what have I got to do\", \"show my reminders\", \"what's coming up\". AFTER: \"[N] active reminders — [next one due at time].\"", input_schema: { type: "object", properties: {} } },
    { name: "list_enquiries", description: "Show recent enquiries inline. Triggers: \"show my enquiries\", \"any new leads\", \"list pending enquiries\". AFTER: \"[N] open enquiries — [next action for each].\"", input_schema: { type: "object", properties: {} } },
    { name: "list_customers", description: "Show the customer list inline. Triggers: \"show my customers\", \"who's on my books\", \"list all clients\", \"who do I work for\". No follow-up needed. If empty, say \"No customers saved yet — want me to add one?\" AFTER: \"[N] customers on your books.\"", input_schema: { type: "object", properties: {} } },
    { name: "list_mileage", description: "Show recent mileage logs inline. Triggers: \"show my mileage\", \"what have I driven\", \"mileage for this month\". AFTER: total miles if meaningful — \"[N] trips, [X] miles total this month.\"", input_schema: { type: "object", properties: {} } },
    { name: "list_stock", description: "Show all stock items inline. Triggers: \"what's on the van\", \"show my stock\", \"stock list\", \"what do I have in\". If reorder-level alerts are relevant, flag them. AFTER: \"[N] items in stock[, X below reorder level].\"", input_schema: { type: "object", properties: {} } },
    { name: "add_stock_item", description: "Add a new stock item to track in the van/store. Triggers: \"add 20 [items] to stock\", \"new stock item — [name]\", \"put [items] on stock\". ASK IF MISSING: item name is required. Quantity — default to the number stated; 1 if none. DEFAULTS: unit → \"each\" unless clear. AFTER: \"[Name] added to stock — [qty] units.\"", input_schema: { type: "object", properties: { name: { type: "string" }, quantity: { type: "string" }, unit: { type: "string" }, unit_cost: { type: "string" }, reorder_level: { type: "string" }, location: { type: "string" }, sku: { type: "string" } }, required: ["name"] } },
    { name: "delete_stock_item", description: "Delete a stock item. Triggers: \"remove [item] from stock\", \"delete that stock entry\", \"scrap that stock item\", \"bin the [item] from stock\", \"take [item] off stock\". CONFIRM FIRST. AFTER: \"[Item] removed from stock.\"", input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
    { name: "list_rams", description: "Show saved RAMS documents inline. Triggers: \"show my RAMS\", \"list method statements\", \"what RAMS have I built\", \"what method statements do I have\", \"any RAMS saved\". AFTER: \"[N] RAMS on file.\"", input_schema: { type: "object", properties: {} } },
    { name: "send_invoice", description: "Email an existing invoice to the customer. Triggers: \"send [customer] their invoice\", \"email invoice to [customer]\", \"fire the [customer] invoice off\". IDENTIFICATION REQUIRED: you MUST pass either customer OR invoice_id before calling this. If NEITHER is given in the user's phrase and no invoice was just created/referenced, ASK: 'Which invoice — which customer, or the invoice number?' Never call with an empty payload; the tool will silently fail. ASK IF MISSING: no email on file → \"No email for [customer] — what's their address?\" If multiple invoices, disambiguate by amount or job. AFTER: \"Invoice sent to [email].\"", input_schema: { type: "object", properties: { customer: { type: "string" }, invoice_id: { type: "string" }, amount: { type: "number", description: "Invoice amount in £ — include if mentioned to identify the right invoice" }, address: { type: "string", description: "Client address — include if mentioned to narrow down the correct invoice" }, email: { type: "string" } }, required: [] } },
    { name: "send_quote", description: "Email a quote to a customer. Triggers: \"send [customer] their quote\", \"email the [customer] estimate\". IDENTIFICATION REQUIRED: you MUST pass either customer OR quote_id before calling. If neither is given and no quote was just referenced, ASK which one. Never call with an empty payload. ASK IF MISSING: no email on file → ask. If multiple quotes for same customer, disambiguate by amount or job. AFTER: \"Quote emailed to [customer].\"", input_schema: { type: "object", properties: { customer: { type: "string" }, quote_id: { type: "string" }, amount: { type: "number", description: "Quote amount in £ — include if mentioned to identify the right quote" }, address: { type: "string", description: "Client address — include if mentioned to narrow down the correct quote" }, email: { type: "string" } }, required: [] } },
    { name: "chase_invoice", description: "Send a payment chase/reminder email for an overdue invoice. Triggers: \"chase the [customer] invoice\", \"nudge [customer] about that invoice\", \"send a reminder to [customer]\". IDENTIFICATION REQUIRED: you MUST pass either customer OR invoice_id before calling. If neither is given and no invoice was just referenced, ASK which one. Never call with an empty payload. ASK IF MISSING: tone (gentle/firm/final) only if they haven't chased before; otherwise escalate one step from the last chase. AFTER: \"Reminder sent to [customer]. I'll flag it again in 7 days.\"", input_schema: { type: "object", properties: { customer: { type: "string" }, invoice_id: { type: "string" }, amount: { type: "number", description: "Invoice/job amount in £ — extract from ANY mention of a value, even 'for the £30k job' or 'the big invoice'" }, address: { type: "string", description: "Client address — include if mentioned" }, email: { type: "string" } }, required: [] } },
    { name: "create_invoice_from_job", description: "Create an invoice directly from a job card, pulling in all logged labour and materials. Triggers: \"invoice the [customer] job\", \"raise an invoice from [job]\", \"bill [customer] for [job]\". For repeat customers, ask which job. DEFAULTS: due date → 14 days. AFTER: \"Invoice created for [customer] — £[total]. Want me to send it?\"", input_schema: { type: "object", properties: { customer: { type: "string" }, job_title: { type: "string" } } } },
    { name: "add_stage_payment", description: "Add stage payment milestones to a job card. Triggers: \"set up stage payments on [job]\", \"30/40/30 on [customer]\", \"add a 50% deposit stage to [job]\". DEFAULTS: if no split stated → 30/40/30. ASK IF MISSING: which job, if unclear. AFTER: \"[N] stages set on [customer]'s job — [summary].\"", input_schema: { type: "object", properties: { customer: { type: "string" }, job_title: { type: "string" }, stages: { type: "string", description: "JSON array of stages [{label,type,value}] or leave empty for default 30/40/30 split" } } } },
    { name: "list_inbox_actions", description: "Show pending email actions — suggested actions from emails that need user approval. Triggers: \"what's in my inbox\", \"show me pending emails\", \"any email actions\", \"anything to approve\". AFTER: \"[N] pending — [brief summary of each].\"", input_schema: { type: "object", properties: {} } },
    { name: "approve_inbox_action", description: "Approve a pending inbox action (executes the suggested action). Triggers: \"approve that\", \"do it\", \"yes go ahead\" when context is an inbox action. Confirms by showing what was done. AFTER: \"Done — [what the action did]. Anything else in the inbox?\"", input_schema: { type: "object", properties: { action_id: { type: "string" }, description: { type: "string" } } } },
    { name: "reject_inbox_action", description: "Reject/dismiss a pending inbox action. Triggers: \"no\", \"dismiss that\", \"reject it\", \"not needed\" when context is an inbox action. If the user gives a reason in their utterance — e.g. \"that's spam\", \"wrong customer\", \"already handled\", \"not relevant\" — map it to one of the reason IDs so the email classifier learns and stops suggesting the same kind of action. AFTER: \"Dismissed. I'll [stop suggesting that kind / remember not to / tune my filter].\"", input_schema: { type: "object", properties: { action_id: { type: "string" }, reason: { type: "string", enum: ["wrong_type","not_relevant","wrong_customer","already_done","spam"], description: "Why the user dismissed — pick the best match. wrong_type: wrong action category. not_relevant: not a real action. wrong_customer: matched the wrong customer. already_done: user already handled it. spam: junk/marketing/noise." } } } },
    { name: "generate_subcontractor_statement", description: "Generate a CIS statement PDF for a subcontractor for a given tax month. Triggers: \"generate [name]'s CIS statement\", \"send [subbie] their CIS for [month]\". MONTH NORMALISATION: user says \"March\" → YYYY-03 (current year). User says \"last month\" → previous month's YYYY-MM. User says nothing about month → default to LAST month's YYYY-MM (CIS statements are usually issued for the previous month). User says \"March 2024\" → 2024-03. Always normalise to YYYY-MM before calling the tool. ASK IF MISSING: subbie name. AFTER: \"Statement generated for [name] — [month label]. Email or download?\"", input_schema: { type: "object", properties: { name: { type: "string" }, month: { type: "string", description: "YYYY-MM format — normalise user's spoken month before passing (see description)." } }, required: ["name"] } },
    { name: "update_job_card", description: "Update any field on a job card — title, customer, address, value, status, scope, PO number. Triggers: \"change the value on [job] to £X\", \"update the address on the [customer] job\", \"set the PO number to ABC123\". ASK IF MISSING: which field to update, if unclear. For repeat customers with multiple jobs, always confirm which job. AFTER: \"[Customer]'s [job] updated — [field] now [new value].\"", input_schema: { type: "object", properties: { customer: { type: "string", description: "Current customer name to find the job" }, title: { type: "string", description: "Current job title to find the job" }, new_title: { type: "string" }, new_customer: { type: "string" }, new_address: { type: "string" }, new_value: { type: "string" }, new_status: { type: "string", enum: ["enquiry","quoted","accepted","in_progress","on_hold","completed","cancelled"] }, new_notes: { type: "string" }, new_scope: { type: "string" }, new_po_number: { type: "string" } } } },
    { name: "update_invoice", description: "Update an invoice — change customer, amount, due date, status, payment method, VAT, or add/remove line items. Triggers: \"change the [customer] invoice to £X\", \"update the due date on [customer]'s invoice\", \"add a line to [customer]'s bill\". ASK IF MISSING: which field to change. LINE ITEMS: prefer the add_line_items array for adding 1-or-more line items at once — each as {description, amount}. AFTER: \"Invoice [id] updated — [what changed].\"", input_schema: { type: "object", properties: { customer: { type: "string" }, invoice_id: { type: "string" }, new_customer: { type: "string" }, new_amount: { type: "string" }, new_due: { type: "string" }, new_status: { type: "string" }, new_address: { type: "string" }, new_payment_method: { type: "string", enum: ["bacs","card","both"], description: "bacs = bank transfer only, card = Stripe only, both = show both options" }, new_vat_enabled: { type: "string", description: "true or false" }, add_line_items: { type: "array", description: "Add one or more line items — each {description, amount}. Prefer this over add_line_item.", items: { type: "object", properties: { description: { type: "string" }, amount: { type: "number" } }, required: ["description","amount"] } }, add_line_item: { type: "string", description: "DEPRECATED — legacy single-line format 'description|amount'. Prefer add_line_items." }, remove_line_item: { type: "string", description: "Remove line item by number (1-based)" } } } },
    { name: "list_quotes", description: "Show a list of quotes inline. Triggers: \"show my quotes\", \"what quotes are out\", \"list all estimates\", \"what's awaiting approval\". Filter by status if mentioned. AFTER: \"[N] quotes[, £total awaiting approval].\"", input_schema: { type: "object", properties: {} } },
    { name: "delete_expense", description: "Delete an expense. Triggers: \"delete that expense\", \"remove the £[X] [category]\", \"scrap that fuel claim\". If multiple match, list them. CONFIRM FIRST. AFTER: \"Expense deleted — £[amount] [category] gone.\"", input_schema: { type: "object", properties: { description: { type: "string" } }, required: ["description"] } },
    { name: "delete_cis_statement", description: "Delete a CIS statement. Triggers: \"delete that CIS\", \"remove the [contractor] CIS from [month]\". If multiple match, list them. CONFIRM FIRST. AFTER: \"CIS statement deleted — £[gross]/[deduction] from [contractor] removed.\"", input_schema: { type: "object", properties: { contractor_name: { type: "string" } }, required: ["contractor_name"] } },
    { name: "add_worker", description: "Add a worker profile — subcontracted or employed. Triggers: \"add a worker\", \"add [name] as a labourer/electrician/plumber\", \"new worker — [name]\". ASK IF MISSING: name is required. Role/trade and day rate — ask if intent suggests pricing matters. DEFAULTS: employment type → employed unless \"sub\" is said. AFTER: \"[Name] added to your team.\"", input_schema: { type: "object", properties: { name: { type: "string" }, type: { type: "string", enum: ["subcontractor","employed"], description: "subcontractor = self-employed/CIS, employed = PAYE staff" }, role: { type: "string", description: "Their trade or role e.g. electrician, labourer, plasterer" }, email: { type: "string" }, phone: { type: "string" }, day_rate: { type: "number" }, hourly_rate: { type: "number" }, utr: { type: "string", description: "UTR number for subcontractors" }, cis_rate: { type: "number", description: "CIS deduction rate — 20 (registered), 30 (unregistered), 0 (gross)" }, ni_number: { type: "string", description: "NI number for employed staff" } }, required: ["name"] } },
    { name: "list_workers", description: "Show all workers inline. Triggers: \"show my workers\", \"who's on my team\", \"list my staff\", \"who do I have on my books\". AFTER: count — \"[N] on your team.\"", input_schema: { type: "object", properties: { type: { type: "string", enum: ["all","subcontractor","employed"] } } } },
    { name: "assign_worker_to_job", description: "Assign a worker to a job. Triggers: \"put [name] on the [job]\", \"send [worker] to [customer]\", \"assign [worker] to [customer]\". ASK IF MISSING: which worker, or which job, if ambiguous. AFTER: \"[Worker] assigned to [customer]'s [job].\"", input_schema: { type: "object", properties: { worker_name: { type: "string" }, customer: { type: "string" }, job_title: { type: "string" }, role: { type: "string" }, rate: { type: "number" }, rate_type: { type: "string", enum: ["day_rate","hourly","price_work"] }, start_date: { type: "string" } }, required: ["worker_name"] } },
    { name: "log_worker_time", description: "Log hours or days worked by another worker (not the user) on a job. Triggers: \"[name] worked 3 days on [job]\", \"log 8 hours for [worker] on [customer]\". ASK IF MISSING: worker name is required AND you must have at least one of hours, days, or total (you can't log a time entry of zero). If they only gave a worker name with no duration, ASK: \"How long — hours or days?\" Always include job_title for repeat customers. DEFAULTS: date → today. AFTER: \"[hours/days/total] logged for [worker] on [customer]'s [job_title].\"", input_schema: { type: "object", properties: { worker_name: { type: "string" }, customer: { type: "string" }, job_title: { type: "string" }, hours: { type: "number" }, days: { type: "number" }, rate: { type: "number" }, rate_type: { type: "string", enum: ["hourly","day_rate","price_work"] }, total: { type: "number" }, date: { type: "string" }, description: { type: "string" } }, required: ["worker_name"] } },
    { name: "add_worker_document", description: "Add a certificate, insurance or licence to a worker. Triggers: \"add [name]'s CSCS card\", \"log [worker]'s insurance\", \"[name]'s Gas Safe is [number]\". Types: cscs, gas_safe, public_liability, employers_liability, driving_licence, right_to_work, other. ASK IF MISSING: worker name and doc type are required. ALWAYS include expiry_date if mentioned. AFTER: \"[Doc type] logged for [name]. [Expiry in X months/days — I'll remind you.]\"", input_schema: { type: "object", properties: { worker_name: { type: "string" }, doc_type: { type: "string", description: "cscs, gas_safe, public_liability, employers_liability, driving_licence, right_to_work, other" }, doc_number: { type: "string" }, issued_date: { type: "string" }, expiry_date: { type: "string", description: "YYYY-MM-DD — always include if mentioned" }, notes: { type: "string" } }, required: ["worker_name","doc_type"] } },
    { name: "list_expiring_documents", description: "Show worker certs and business compliance documents expiring soon. Triggers: \"what's expiring\", \"any certs due\", \"check my documents\", \"what's running out\". DEFAULT WINDOW: 30 days unless the user states a different period (e.g. \"expiring in the next 3 months\" → 90). AFTER: \"[N] documents expiring in the next [days] days — [summary]. Want me to set a reminder?\"", input_schema: { type: "object", properties: { days: { type: "number", description: "Days ahead to check — default 30. Only pass a different number if the user specifies one." } } } },
    { name: "delete_subcontractor", description: "Delete a subcontractor. Triggers: \"remove [name] from my subs\", \"delete [subbie]\". CONFIRM FIRST. Flag if they have linked payments: \"[Name] has [N] payments logged — delete anyway?\" AFTER: \"[Name] removed from your subs.\"", input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
    { name: "update_worker", description: "Update a worker's details — rate, CIS rate, role, contact info. Triggers: \"change [name]'s day rate to £[X]\", \"update [worker]'s phone\", \"[name] is now [rate]% CIS\". ASK IF MISSING: which field if unclear. AFTER: \"[Name]'s [field] updated to [new value].\"", input_schema: { type: "object", properties: { name: { type: "string", description: "Worker name to find" }, day_rate: { type: "number" }, hourly_rate: { type: "number" }, cis_rate: { type: "number", description: "20, 30, or 0" }, role: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, utr: { type: "string" } }, required: ["name"] } },
    { name: "delete_worker", description: "Delete a worker record. Triggers: \"remove [name] from my workers\", \"delete [worker]\", \"[name] isn't with me anymore\". CONFIRM FIRST. Flag any linked jobs or time logs. AFTER: \"[Name] removed from your team.\"", input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
    { name: "update_subcontractor_payment", description: "Correct a subcontractor payment — change amount, date, description, labour/materials split. Triggers: \"fix [name]'s payment from [date]\", \"change last week's payment to [X]\". ASK IF MISSING: which payment if multiple recent. DEFAULTS: leave unstated fields unchanged. AFTER: \"[Name]'s payment updated — [what changed].\"", input_schema: { type: "object", properties: { name: { type: "string", description: "Subcontractor name" }, date: { type: "string", description: "Date of payment to find YYYY-MM-DD — helps identify which payment" }, gross: { type: "number", description: "New gross total" }, labour_amount: { type: "number" }, materials_amount: { type: "number" }, new_date: { type: "string", description: "New date if changing date" }, description: { type: "string" }, invoice_number: { type: "string" } }, required: ["name"] } },
    { name: "delete_subcontractor_payment", description: "Delete a subcontractor payment. Triggers: \"delete [name]'s payment on [date]\", \"remove that £[X] I paid [subbie]\". If multiple match, list them. CONFIRM FIRST. AFTER: \"Payment deleted — £[amount] to [name] on [date] gone.\"", input_schema: { type: "object", properties: { name: { type: "string" }, date: { type: "string", description: "Date YYYY-MM-DD to identify the payment" }, gross: { type: "number", description: "Amount to identify the payment" } }, required: ["name"] } },
    { name: "delete_job_card", description: "Permanently delete a job card and everything on it (materials, labour, notes, invoice). Triggers: \"delete the [customer] job card completely\", \"remove [job] entirely\", \"scrap the [customer] job\", \"kill the [job] card\", \"bin the [customer] job entirely\". CONFIRM FIRST — this is destructive. Flag linked invoices: \"This will also remove the [£X] invoice. Proceed?\" AFTER: \"[Customer]'s [job] card deleted — everything on it gone too.\"", input_schema: { type: "object", properties: { customer: { type: "string" }, title: { type: "string" } } } },
    { name: "delete_mileage", description: "Delete a mileage log. Defaults to deleting the most recent one. Triggers: \"delete that mileage\", \"scrap the last trip\", \"remove the [location] mileage\". If user specifies a date or location, use those to target. CONFIRM FIRST if deleting more than one. AFTER: \"Mileage deleted — [from] to [to] on [date].\"", input_schema: { type: "object", properties: { date: { type: "string", description: "Date of trip to delete YYYY-MM-DD" }, from_location: { type: "string", description: "Start location to match" }, to_location: { type: "string", description: "Destination to match" } } } },
    { name: "delete_rams", description: "Delete a RAMS document. Triggers: \"delete that RAMS\", \"remove the [job] method statement\", \"scrap the [job] RAMS\", \"get rid of the [job] method statement\", \"bin the RAMS for [job]\". CONFIRM FIRST. AFTER: \"RAMS for [title] deleted.\"", input_schema: { type: "object", properties: { title: { type: "string" } }, required: ["title"] } },
    { name: "escalate_to_support", description: "Use ONLY when you have genuinely tried to resolve the user's issue and cannot. Collects their details and sends an email to Trade PA support. Triggers: user explicitly asks for human help, or after a real blocker. Never use as a first resort. AFTER: \"Sent to support — they'll email you back. Usually within a working day.\"", input_schema: { type: "object", properties: { issue_summary: { type: "string", description: "Clear description of the issue" }, steps_tried: { type: "string", description: "What you already tried" }, user_email: { type: "string", description: "User's email address if known" } }, required: ["issue_summary"] } },
    { name: "request_signature", description: "Open the signature pad for a customer to sign off a completed job. Triggers: \"get signature\", \"sign off\", \"customer's ready to sign\", \"job done — need their signature\". ASK IF MISSING: which job. AFTER the sign completes, the job status typically moves to completed. AFTER: \"Signature pad open for [customer]'s [job]. Hand them the phone.\"", input_schema: { type: "object", properties: { customer: { type: "string" }, title: { type: "string" } } } },
    { name: "sync_to_xero", description: "Upload/sync an invoice to Xero accounting. Triggers: \"send to Xero\", \"sync the [customer] invoice to Xero\", \"push [invoice] to Xero\", \"upload the [customer] invoice to Xero\", \"fire that over to Xero\", \"get that on Xero\", \"pop that on Xero\", \"post it to Xero\", \"log it in Xero\", \"chuck that in Xero\", \"stick that on Xero\", \"that one into Xero\", \"Xero that invoice\". If the user just says \"Xero\" or \"push to Xero\" after referencing an invoice in the conversation, treat that as intent. ASK IF MISSING: check Xero is connected first — if not, guide to Settings → Integrations. Which invoice if multiple recent ones. AFTER: \"Invoice synced to Xero — [Xero invoice number].\"", input_schema: { type: "object", properties: { customer: { type: "string" }, invoice_id: { type: "string" } } } },
    { name: "sync_to_quickbooks", description: "Upload/sync an invoice to QuickBooks. Triggers: \"send to QuickBooks\", \"sync to QB\", \"push the [customer] invoice to QuickBooks\", \"upload that to QuickBooks\", \"fire it to QB\", \"get that on QB\", \"pop it in QuickBooks\", \"post it to QuickBooks\", \"log it in QuickBooks\", \"chuck that in QB\", \"QB that invoice\", \"QuickBooks that one\". If the user just says \"QB\" or \"QuickBooks\" after referencing an invoice in the conversation, treat that as intent. ASK IF MISSING: check QuickBooks is connected. Which invoice if multiple. AFTER: \"Invoice synced to QuickBooks — [QB invoice number].\"", input_schema: { type: "object", properties: { customer: { type: "string" }, invoice_id: { type: "string" } } } },
    { name: "sync_material_to_xero", description: "Create a bill in Xero for a material purchase. Triggers: \"send the [item] to Xero\", \"push that receipt to Xero as a bill\", \"upload that receipt to Xero\", \"log that receipt in Xero\", \"fire that receipt over to Xero\", \"pop that receipt in Xero\", \"get that receipt on Xero\", \"Xero that receipt\". ASK IF MISSING: check Xero is connected first — if not, offer to help them connect it. AFTER: \"Bill synced to Xero — [item] from [supplier], £[total].\"", input_schema: { type: "object", properties: { item: { type: "string" }, supplier: { type: "string" } } } },
    { name: "sync_material_to_quickbooks", description: "Create a bill in QuickBooks for a material purchase. Triggers: \"send the [item] to QuickBooks\", \"push that material to QB\". ASK IF MISSING: check QuickBooks is connected first. AFTER: \"Bill synced to QuickBooks — [item] from [supplier], £[total].\"", input_schema: { type: "object", properties: { item: { type: "string" }, supplier: { type: "string" } } } },
    { name: "mark_invoice_paid_xero", description: "Mark an invoice as paid in Xero (only after it's been synced there). Triggers: \"update Xero — [customer] paid\", \"mark the [customer] invoice paid in Xero\". Only use if the invoice is already in Xero. AFTER: \"Xero updated — [customer]'s invoice marked paid.\"", input_schema: { type: "object", properties: { customer: { type: "string" }, invoice_id: { type: "string" } } } },
    {
      name: "save_memory",
      description: "Store a fact, preference, or pattern about this business for ALL FUTURE conversations. Triggers: \"remember that [fact]\", \"don't forget [fact]\", or when user corrects you about a standing fact.\n\nDO save: durable business facts (trading name, trades, regions worked, default rates, VAT status, preferred suppliers, standing customer quirks, trade preferences, commonly-used phrases).\n\nDO NOT save: today's weather, one-time customer preferences, transient locations, time-bound facts (\"Steve is on holiday until Friday\"), session context, anything the user can reasonably re-state next time, information already in their customer/job data.\n\nRule of thumb: if it would matter in 6 months' time, save it. If it's this-week-only, don't. When unsure, DON'T save — the user can always say \"remember that\" if they want it persisted.\n\nAFTER: \"Got it — I'll remember that.\"",
      input_schema: { type: "object", properties: { content: { type: "string", description: "The fact to remember as a clear statement. E.g. 'Standard call-out rate is £65/hour'" }, category: { type: "string", enum: ["business_fact", "preference", "customer_note", "pattern", "correction"] } }, required: ["content"] },
    },
  ];

  // ── Execute tool calls ────────────────────────────────────────────────────
  // Email helper — routes to the send-invoice-email endpoint which handles PDF attachment
  // ── Client-side PDF generation ─────────────────────────────────────────────
  // Renders invoice in an off-screen div, captures with html2canvas, converts to
  // PDF with jsPDF, returns base64 string. Sent directly to server — no storage needed.

  const loadScript = (src) => new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });

  const generateInvoicePDFBase64 = async (brand, inv) => {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");

    const rawLI = inv.lineItems || inv.line_items || [];
    const parsedLI = typeof rawLI === "string" ? (() => { try { return JSON.parse(rawLI); } catch { return []; } })() : rawLI;
    const html = buildInvoiceHTML(brand, {
      ...inv,
      grossAmount: inv.gross_amount || inv.grossAmount || inv.amount,
      lineItems: Array.isArray(parsedLI) ? parsedLI : [],
      vatEnabled: inv.vat_enabled || inv.vatEnabled,
      paymentMethod: inv.payment_method || inv.paymentMethod || "both",
    });

    console.log("[PDF DEBUG] HTML length:", html.length, "starts with:", html.slice(0, 100));
    console.log("[PDF DEBUG] inv keys:", Object.keys(inv).join(", "));
    console.log("[PDF DEBUG] lineItems:", JSON.stringify(inv.lineItems || inv.line_items || []).slice(0, 200));
    console.log("[PDF DEBUG] amount:", inv.grossAmount || inv.gross_amount || inv.amount);

    const container = document.createElement("div");
    container.style.cssText = "position:absolute;top:0;left:0;width:794px;background:#fff;color:#1a1a1a;pointer-events:none;z-index:-1;";
    container.innerHTML = html;
    container.querySelectorAll(".back-bar,.no-print").forEach(el => el.remove());
    document.body.appendChild(container);

    try {
      await Promise.all([...container.querySelectorAll("img")].map(img =>
        img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })
      ));
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      console.log("[PDF DEBUG] container dimensions:", container.offsetWidth, "x", container.offsetHeight);
      console.log("[PDF DEBUG] container childNodes:", container.childNodes.length);

      const canvas = await window.html2canvas(container, {
        scale: 2, useCORS: true, allowTaint: true,
        width: 794,
        windowWidth: 794, logging: false, backgroundColor: "#ffffff",
      });

      console.log("[PDF DEBUG] canvas size:", canvas.width, "x", canvas.height);

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: "a4", compress: true });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pdfW) / canvas.width;
      const imgData = canvas.toDataURL("image/jpeg", 0.85);

      console.log("[PDF DEBUG] imgData length:", imgData.length, "imgH:", imgH);

      let y = 0;
      while (y < imgH) {
        pdf.addImage(imgData, "JPEG", 0, -y, pdfW, imgH);
        y += pdfH;
        if (y < imgH) pdf.addPage();
      }
      const result = pdf.output("datauristring").split(",")[1];
      console.log("[PDF DEBUG] final base64 length:", result.length);
      return result;
    } finally {
      document.body.removeChild(container);
    }
  };
  // ─────────────────────────────────────────────────────────────────────────────

  const sendEmailViaConnectedAccount = async (userId, to, subject, body, pdfBase64 = null, filename = "document.pdf") => {
    const res = await fetch("/api/send-invoice-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, to, subject, body, pdfBase64, filename }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => res.status.toString());
      // If new endpoint not deployed yet, fall back to basic send
      if (res.status === 404) {
        const { data: conns } = await db.from("email_connections")
          .select("provider").eq("user_id", userId).limit(1);
        const provider = conns?.[0]?.provider;
        if (!provider) throw new Error("No email account connected. Go to the Inbox tab to connect Gmail or Outlook first.");
        const endpoint = provider === "outlook" ? "/api/outlook/send" : "/api/gmail/send";
        const fallbackRes = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, to, subject, body }),
        });
        if (!fallbackRes.ok) throw new Error(`Email send failed (${fallbackRes.status})`);
        return { hasAttachment: false };
      }
      throw new Error(`Email send failed (${res.status}): ${errText}`);
    }
    const result = await res.json().catch(() => ({}));
    return result;
  };

  // Chase-email send — shared between the AI `chase_invoice` tool case and
  // the UI chase buttons (Payments + Invoices detail views). Centralises
  // escalation tone, chase-count persistence, PDF attachment, and email
  // template so the two paths can never drift. Returns a structured result
  // the caller formats into either a chat reply or a UI toast.
  const chaseInvoiceSend = async (inv, email, { showWidget = true } = {}) => {
    if (!inv) return { ok: false, message: "No invoice provided." };
    if (!email) return { ok: false, message: `No email on file for ${inv.customer || "this invoice"}. Add their email first.` };
    const existingCount = inv.chaseCount ?? inv.chase_count ?? 0;
    const chaseNum = existingCount + 1;
    const chasedAtIso = new Date().toISOString();
    setInvoices(prev => (prev || []).map(i => i.id === inv.id ? { ...i, chaseCount: chaseNum, lastChased: chasedAtIso, chase_count: chaseNum, last_chased_at: chasedAtIso } : i));
    if (user?.id) {
      db.from("invoices")
        .update({ chase_count: chaseNum, last_chased_at: chasedAtIso })
        .eq("id", inv.id).eq("user_id", user.id)
        .then(({ error }) => { if (error) console.warn("chase count persist failed:", error.message); })
        .catch(err => console.warn("chase count persist threw:", err?.message || err));
    }
    const chaseAmt = fmtCurrency(parseFloat(inv.grossAmount || inv.amount || 0));
    const accent = brand?.accentColor || "#f59e0b";
    let chaseIntro, chaseClose, chaseHeading, subject;
    if (chaseNum <= 1) {
      subject = `Payment reminder — Invoice ${inv.id}`;
      chaseHeading = "PAYMENT REMINDER";
      chaseIntro = `<p style="color:#555;">I hope you are well. This is a friendly reminder that the following invoice remains outstanding:</p>`;
      chaseClose = `<p style="color:#555;font-size:13px;">If payment has already been sent, please disregard this message. If you have any queries, please don't hesitate to get in touch.</p>`;
    } else if (chaseNum === 2) {
      subject = `Second reminder — Invoice ${inv.id}`;
      chaseHeading = "SECOND REMINDER";
      chaseIntro = `<p style="color:#555;">I'm writing to follow up on my previous reminder regarding the outstanding balance below. I would appreciate your prompt attention to this matter.</p>`;
      chaseClose = `<p style="color:#555;font-size:13px;">Please arrange payment at your earliest convenience. If there is an issue with the invoice or you would like to discuss payment terms, please get in touch.</p>`;
    } else {
      subject = `Final notice — Invoice ${inv.id} overdue`;
      chaseHeading = "FINAL NOTICE";
      chaseIntro = `<p style="color:#555;">Despite previous reminders, the following invoice remains unpaid. Please treat this as a matter of urgency.</p>`;
      chaseClose = `<p style="color:#555;font-size:13px;">If payment is not received within 7 days, I may need to consider further action to recover this debt. If you have already made payment, please let me know so I can update my records.</p>`;
    }
    const body = buildEmailHTML(brand, {
      heading: chaseHeading,
      showBacs: true,
      invoiceId: inv.id,
      body: `<p style="font-size:15px;">Dear ${inv.customer},</p>
        ${chaseIntro}
        <div style="background:${accent}18;border-radius:6px;padding:16px;margin:16px 0;border-left:4px solid ${accent};">
          <div style="font-size:13px;color:#666;margin-bottom:4px;">Invoice ${inv.id}</div>
          <div style="font-size:22px;font-weight:700;color:${accent};">${chaseAmt}</div>
          <div style="font-size:12px;color:#888;margin-top:4px;">${chaseNum >= 3 ? "OVERDUE" : "Currently outstanding"}</div>
        </div>
        ${portalCtaBlock({ token: inv.portalToken || inv.portal_token, isQuote: false, stripeReady: !!brand?.stripeAccountId, accent })}
        ${chaseClose}`,
    });
    try {
      let chasePdfBase64 = null;
      try { chasePdfBase64 = await generateInvoicePDFBase64(brand, inv); } catch(pe) { console.warn("PDF gen failed:", pe.message); }
      await sendEmailViaConnectedAccount(user?.id, email, subject, body, chasePdfBase64, `Invoice-${inv.id}.pdf`);
      if (showWidget) pendingWidgetRef.current = { type: "email_sent", data: { to: email, subject, customer: inv.customer, invoice_id: inv.id, amount: inv.grossAmount || inv.amount, isChase: true } };
      return { ok: true, chaseNum, hasPdf: !!chasePdfBase64, email };
    } catch(e) {
      return { ok: false, message: `Chase email failed: ${e.message}` };
    }
  };

  // Register a window bridge so UI chase buttons (in Payments and Invoices
  // views, which are sibling components) can invoke the chase flow without
  // passing the function through a full prop chain. Unregisters on unmount
  // and re-registers when user/brand change so the closure stays fresh.
  useEffect(() => {
    window._tradePaChase = async (inv) => {
      if (!inv || !user?.id) return { ok: false, message: "Not signed in." };
      const { data: custRows } = await db.from("customers")
        .select("email").eq("user_id", user.id).ilike("name", `%${inv.customer || ""}%`).limit(1);
      const email = custRows?.[0]?.email || inv.email;
      return await chaseInvoiceSend(inv, email, { showWidget: false });
    };
    return () => { delete window._tradePaChase; };
  }, [brand?.tradingName, brand?.accentColor, user?.id]);

  const executeTool = async (name, input) => {
    // ─── Shared job lookup helper — must be before switch to avoid TDZ ───────
    const findJob = async (customer, jobTitle, actionLabel = "action") => {
      if (!customer && !jobTitle) return { error: "No customer or job title provided." };
      // Primary: search job_cards (the rich tracking table most tools write to).
      let q = db.from("job_cards")
        .select("id,title,type,customer,status,address,value")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (customer) q = q.ilike("customer", `%${customer}%`);
      if (jobTitle) q = q.or(`title.ilike.%${jobTitle}%,type.ilike.%${jobTitle}%`);
      const { data: matches } = await q;
      if (matches?.length) {
        if (matches.length === 1) return { job: matches[0] };
        if (customer && jobTitle) {
          const exact = matches.find(j =>
            (j.customer || "").toLowerCase().includes(customer.toLowerCase()) &&
            (j.title || j.type || "").toLowerCase().includes(jobTitle.toLowerCase())
          );
          if (exact) return { job: exact };
        }
        const opts = matches.map(j => {
          const addr = (j.address || "").split(",")[0].trim();
          const val = j.value ? ` ${fmtAmount(j.value)}` : "";
          return `"${j.title || j.type || "Job"}"${addr ? ` at ${addr}` : ""}${val} (${j.status || "active"})`;
        }).join("; ");
        return { error: `Multiple jobs found: ${opts}. Which job should I ${actionLabel}?` };
      }
      // Fallback: no job_card match — look at the simple `jobs` table
      // (Schedule tab entries). These were created via create_job and never
      // became rich job_cards. All child FKs (time_logs, materials,
      // compliance_docs, etc.) point at job_cards.id (UUID), so we need a
      // job_card to attach to. Solution: lazy-promote — create a job_card
      // that mirrors the jobs row on first use, leave the jobs row alone
      // so the Schedule tab still shows it.
      let jq = db.from("jobs")
        .select("id,type,customer,status,address,value,notes,date_obj,company_id")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (customer) jq = jq.ilike("customer", `%${customer}%`);
      if (jobTitle) jq = jq.ilike("type", `%${jobTitle}%`);
      const { data: jobsMatches } = await jq;
      if (!jobsMatches?.length) {
        return { error: `No job found for "${customer || jobTitle}". Check the Jobs or Schedule tab.` };
      }
      let pickFromJobs = null;
      if (jobsMatches.length === 1) {
        pickFromJobs = jobsMatches[0];
      } else if (customer && jobTitle) {
        pickFromJobs = jobsMatches.find(j =>
          (j.customer || "").toLowerCase().includes(customer.toLowerCase()) &&
          (j.type || "").toLowerCase().includes(jobTitle.toLowerCase())
        );
      }
      if (!pickFromJobs) {
        const opts = jobsMatches.map(j => {
          const addr = (j.address || "").split(",")[0].trim();
          const val = j.value ? ` ${fmtAmount(j.value)}` : "";
          return `"${j.type || "Job"}"${addr ? ` at ${addr}` : ""}${val} (${j.status || "scheduled"})`;
        }).join("; ");
        return { error: `Multiple scheduled jobs found: ${opts}. Which one should I ${actionLabel}?` };
      }
      // Promote the scheduled job into a job_card so child tables can FK to it.
      // The jobs row is left intact — Schedule tab continues to show it, and
      // update_job_status now mirrors status changes across both tables.
      const promotedPayload = {
        user_id: user?.id,
        company_id: pickFromJobs.company_id || null,
        title: pickFromJobs.type || "Job",
        customer: pickFromJobs.customer || "",
        address: pickFromJobs.address || "",
        type: pickFromJobs.type || "",
        status: pickFromJobs.status || "active",
        value: pickFromJobs.value || 0,
        start_date: pickFromJobs.date_obj || null,
        notes: pickFromJobs.notes || "",
      };
      const { data: promoted, error: promoteErr } = await db.from("job_cards")
        .insert(promotedPayload).select().single();
      if (promoteErr || !promoted) {
        console.warn("[findJob] jobs→job_card promotion failed:", promoteErr?.message);
        return { error: `Found "${pickFromJobs.customer}" in your schedule but couldn't promote it to a job card (${promoteErr?.message || "unknown"}). Try creating the job card manually first.` };
      }
      return { job: promoted };
    };
    // ─────────────────────────────────────────────────────────────────────────
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
            // Record within-turn creation so a subsequent create_invoice /
            // create_job in the SAME turn can find this customer (React
            // state won't have flushed between tool calls in a single turn).
            turnCreatedRef.current.customers.push(newCustomer);
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
            status: input.status || "accepted",
            value: input.value || 0,
          };
          // Dedup: same customer + type + same date+time = duplicate scheduled job
          const dupJob = (jobs || []).find(j =>
            (j.customer || "").toLowerCase() === input.customer.toLowerCase() &&
            (j.type || "").toLowerCase() === (input.type || "").toLowerCase() &&
            j.dateObj && Math.abs(new Date(j.dateObj) - dateObj) < 60000 // within 1 min
          );
          if (dupJob) return ""; // Silent dedup
          setJobs(prev => [...(prev || []), job]);
          setLastAction({ type: "job", label: `${input.type} — ${input.customer}`, view: "Schedule" });
          return `Job created: ${input.type} for ${input.customer} on ${dateObj.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} at ${input.time}.`;
        }
        case "create_invoice": {
          const id = nextInvoiceId(invoices);
          const lineItems = input.line_items || [{ description: input.description || "Services", amount: input.amount || 0 }];
          const totalAmount = lineItems.reduce((s, l) => s + (l.amount || 0), 0);
          // Auto-pull customer details from customer record if not provided.
          // Prefer exact (case-insensitive) match, fall back to substring match.
          // Also merge in customers created within THIS turn (via the
          // turnCreatedRef) so back-to-back create_customer → create_invoice
          // chains find the new customer before React state has flushed.
          let invAddress = input.address || "";
          let invEmail = input.email || "";
          let invPhone = input.phone || "";
          let matchedCustomer = null;
          const searchCustomers = [...(turnCreatedRef.current.customers || []), ...(customers || [])];
          if (input.customer && searchCustomers.length > 0) {
            const needle = input.customer.toLowerCase().trim();
            matchedCustomer =
              searchCustomers.find(c => (c.name || "").toLowerCase().trim() === needle) ||
              searchCustomers.find(c => (c.name || "").toLowerCase().includes(needle));
            if (matchedCustomer) {
              if (!invAddress && matchedCustomer.address) invAddress = matchedCustomer.address;
              if (!invEmail && matchedCustomer.email) invEmail = matchedCustomer.email;
              if (!invPhone && matchedCustomer.phone) invPhone = matchedCustomer.phone;
            }
          }
          const inv = {
            id,
            customer: input.customer,
            address: invAddress,
            email: invEmail,
            phone: invPhone,
            amount: totalAmount,
            due: `Due in ${input.due_days || 30} days`,
            status: "sent",
            description: lineItems.map(l => `${l.description}|${l.amount}`).join("\n"),
            lineItems,
            isQuote: false,
            // Honor brand defaults — VAT-registered tradies above the £85k
            // threshold shouldn't have to manually toggle VAT on every voice
            // invoice. Same defaults the InvoiceModal form now uses.
            vatEnabled: brand?.vatEnabled || false,
            vatRate: brand?.vatRate || 20,
            cisEnabled: brand?.cisEnabled || false,
            cisRate: brand?.cisRate || 20,
            // Portal token for the customer-facing invoice page. Same token
            // format as quotes — portal.js reads is_quote on the record to
            // decide whether to render accept/decline (quote) or Pay Now
            // (invoice) UI.
            portalToken: generatePortalToken(),
          };
          setInvoices(prev => [inv, ...(prev || [])]);
          syncInvoiceToAccounting(user?.id, inv);
          // Persist to Supabase so send/chase can retrieve full line items
          db.from("invoices").upsert({
            id: inv.id, user_id: user?.id,
            customer: inv.customer, address: inv.address || "",
            email: inv.email || "", phone: inv.phone || "",
            amount: totalAmount, gross_amount: totalAmount,
            status: "sent", is_quote: false,
            due: inv.due || "Due in 30 days",
            description: inv.description || "",
            line_items: JSON.stringify(lineItems),
            job_ref: input.job_ref || "",
            created_at: new Date().toISOString(),
            portal_token: inv.portalToken,
          }).then(() => {}).catch(() => {});
          setLastAction({ type: "invoice", label: `${id} — ${fmtAmount(totalAmount)} — ${input.customer}`, view: "Invoices" });
          pendingWidgetRef.current = { type: "invoice", data: inv };
          // Tell the AI what was auto-filled so it can mention it in the response
          const autoFilled = matchedCustomer ? [
            invEmail && !input.email ? "email" : null,
            invAddress && !input.address ? "address" : null,
            invPhone && !input.phone ? "phone" : null,
          ].filter(Boolean) : [];
          const autoNote = autoFilled.length > 0
            ? ` Auto-filled ${autoFilled.join(", ")} from existing customer record.`
            : (matchedCustomer ? "" : (input.customer ? " (No saved customer record found — added as ad-hoc.)" : ""));
          return `Invoice ${id} created for ${input.customer} — ${fmtAmount(totalAmount)} total (${lineItems.length} line item${lineItems.length > 1 ? "s" : ""}).${autoNote}`;
        }
        case "create_quote": {
          const id = nextQuoteId(invoices);
          const lineItems = input.line_items || [{ description: input.description || "Services", amount: input.amount || 0 }];
          const totalAmount = lineItems.reduce((s, l) => s + (l.amount || 0), 0);
          // Auto-pull customer details from customer record if not provided.
          // Also merge in customers created within THIS turn — same reason as
          // create_invoice (back-to-back create_customer → create_quote).
          let quoteAddress = input.address || "";
          let quoteEmail = input.email || "";
          let quotePhone = input.phone || "";
          let matchedCustomerQ = null;
          const searchCustomersQ = [...(turnCreatedRef.current.customers || []), ...(customers || [])];
          if (input.customer && searchCustomersQ.length > 0) {
            const needle = input.customer.toLowerCase().trim();
            matchedCustomerQ =
              searchCustomersQ.find(c => (c.name || "").toLowerCase().trim() === needle) ||
              searchCustomersQ.find(c => (c.name || "").toLowerCase().includes(needle));
            if (matchedCustomerQ) {
              if (!quoteAddress && matchedCustomerQ.address) quoteAddress = matchedCustomerQ.address;
              if (!quoteEmail && matchedCustomerQ.email) quoteEmail = matchedCustomerQ.email;
              if (!quotePhone && matchedCustomerQ.phone) quotePhone = matchedCustomerQ.phone;
            }
          }
          const quote = {
            id,
            customer: input.customer,
            address: quoteAddress,
            email: quoteEmail,
            phone: quotePhone,
            amount: totalAmount,
            due: `Valid for ${input.valid_days || 30} days`,
            status: "sent",
            description: lineItems.map(l => `${l.description}|${l.amount}`).join("\n"),
            lineItems,
            isQuote: true,
            // Honor brand defaults — see matching change in create_invoice.
            vatEnabled: brand?.vatEnabled || false,
            vatRate: brand?.vatRate || 20,
            cisEnabled: brand?.cisEnabled || false,
            cisRate: brand?.cisRate || 20,
            // Portal token: per-doc random string so customers can view the
            // quote at /quote/<token> without logging in. Generated here so
            // the detail view can show the portal URL immediately, no refresh.
            portalToken: generatePortalToken(),
          };
          setInvoices(prev => [quote, ...(prev || [])]);
          db.from("invoices").upsert({
            id: quote.id, user_id: user?.id,
            customer: quote.customer, address: quote.address || "",
            email: quote.email || "", phone: quote.phone || "",
            amount: totalAmount, gross_amount: totalAmount,
            status: "sent", is_quote: true,
            due: quote.due || "Valid for 30 days",
            description: quote.description || "",
            line_items: JSON.stringify(lineItems),
            job_ref: input.job_ref || "",
            created_at: new Date().toISOString(),
            portal_token: quote.portalToken,
          }).then(() => {}).catch(() => {});
          setLastAction({ type: "invoice", label: `${id} — ${fmtAmount(totalAmount)} — ${input.customer}`, view: "Quotes" });
          pendingWidgetRef.current = { type: "quote", data: quote };
          // Tell the AI what was auto-filled from the customer record
          const autoFilledQ = matchedCustomerQ ? [
            quoteEmail && !input.email ? "email" : null,
            quoteAddress && !input.address ? "address" : null,
            quotePhone && !input.phone ? "phone" : null,
          ].filter(Boolean) : [];
          const autoNoteQ = autoFilledQ.length > 0
            ? ` Auto-filled ${autoFilledQ.join(", ")} from existing customer record.`
            : (matchedCustomerQ ? "" : (input.customer ? " (No saved customer record found — added as ad-hoc.)" : ""));
          return `Quote ${id} created for ${input.customer} — ${fmtAmount(totalAmount)} total (${lineItems.length} line item${lineItems.length > 1 ? "s" : ""}).${autoNoteQ}`;
        }
        case "log_enquiry": {
          // Dedup: same name + same source today
          const dupEnq = (enquiries || []).find(e =>
            (e.name || "").toLowerCase() === input.name.toLowerCase() &&
            (e.source || "").toLowerCase() === (input.source || "").toLowerCase()
          );
          if (dupEnq) return ""; // Silent dedup
          const enq = { id: newEnquiryId(), name: input.name, source: input.source, msg: input.message, time: "Just now", urgent: input.urgent || false, status: "new" };
          setEnquiries(prev => [enq, ...(prev || [])]);
          setLastAction({ type: "enquiry", label: `${input.name} via ${input.source}`, view: "Enquiries" });
          return `Enquiry logged from ${input.name} via ${input.source}.`;
        }
        case "set_reminder": {
          let fireAt;
          if (input.iso_time) {
            fireAt = new Date(input.iso_time);
          } else if (input.minutes_from_now) {
            fireAt = new Date(Date.now() + (input.minutes_from_now * 60000));
          } else {
            return "When would you like me to remind you? e.g. 'at 9am tomorrow' or 'in 2 hours'.";
          }
          if (isNaN(fireAt.getTime())) return "I couldn't understand that time. Try saying something like '9am tomorrow' or 'in 30 minutes'.";
          // Validate optional related_type + related_id. We only trust them if
          // BOTH are present — a lone related_type with no id is useless, and
          // a lone id with no type is unroutable. The cron email renderer
          // looks up the related row and degrades gracefully (plain template)
          // if the ID turns out to be stale (entity deleted) by the time the
          // reminder fires.
          const VALID_RELATED_TYPES = ["job", "invoice", "customer", "enquiry"];
          const relatedType = (input.related_type && VALID_RELATED_TYPES.includes(input.related_type) && input.related_id)
            ? input.related_type : null;
          const relatedId = relatedType ? String(input.related_id) : null;
          // Insert to DB first so the in-memory reminder carries the real
          // DB UUID — the 5-min cron and /api/reminders/action.js both match
          // reminders by that UUID. Fall back to a temp id if the write fails
          // so offline/errored reminders still surface in the UI.
          let reminderId = `r${Date.now()}`;
          try {
            const { data: remRow, error: remErr } = await db.from("reminders").insert({
              user_id: user?.id,
              text: input.text,
              fire_at: fireAt.toISOString(),
              done: false,
              created_at: new Date().toISOString(),
              related_type: relatedType,
              related_id: relatedId,
            }).select().single();
            if (remErr) console.warn("Reminder Supabase write:", remErr.message);
            else if (remRow?.id) reminderId = remRow.id;
          } catch(e) { console.warn("Reminder Supabase write:", e.message); }
          const reminder = { id: reminderId, text: input.text, time: fireAt.getTime(), timeLabel: input.time_label || fireAt.toLocaleString("en-GB"), done: false, related_type: relatedType, related_id: relatedId };
          onAddReminder(reminder);
          setLastAction({ type: "reminder", label: input.text, view: "Reminders" });
          const label = input.time_label || fireAt.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
          return `Reminder set: "${input.text}" — ${label}.`;
        }
        case "create_material": {
          // Look up the real job_id from the job name — materials won't show on the job card without it
          let resolvedJobId = input.job_id || null;
          let resolvedJobName = input.job || input.job_title || "";
          if (!resolvedJobId && (input.customer || resolvedJobName)) {
            const { job: matJobMatch } = await findJob(
              input.customer || resolvedJobName,
              input.job_title || (input.customer ? resolvedJobName : null)
            );
            if (matJobMatch) {
              resolvedJobId = matJobMatch.id;
              resolvedJobName = `${matJobMatch.customer} - ${matJobMatch.title || matJobMatch.type || ""}`.trim();
            }
          }
          const matPayload = {
            user_id: user?.id,
            company_id: companyId || null,
            item: input.item, qty: parseInt(input.qty) || 1,
            unit_price: parseFloat(input.unit_price || input.price || 0) || 0,
            supplier: input.supplier || "",
            job: resolvedJobName,
            job_id: resolvedJobId,
            status: "to_order",
            created_at: new Date().toISOString(),
          };
          // Dedup: only block if same item was added in the LAST 60 SECONDS (catches double-fire)
          // Tradespeople buy same material multiple times for same job — don't block by job+day
          const sixtySecsAgo = new Date(Date.now() - 60000).toISOString();
          const veryRecentMats = (materials || []).filter(m =>
            m.item?.toLowerCase() === input.item.toLowerCase() &&
            m.created_at && m.created_at > sixtySecsAgo
          );
          if (veryRecentMats.length >= 1 && !input.force) return ""; // Silent dedup — just created in last 60s
          const { data: newMat, error: matErr } = await db.from("materials").insert(matPayload).select().single();
          if (matErr) return `Failed to add material: ${matErr.message}`;
          // Append to React state using setMaterials prop (always available, no companyId needed for appends)
          // The wrapper only triggers DELETE+INSERT sync when companyId exists in App scope
          setMaterials(prev => [...(prev || []), {
            id: newMat?.id, item: matPayload.item, qty: matPayload.qty,
            unitPrice: matPayload.unit_price, supplier: matPayload.supplier,
            job: matPayload.job, job_id: matPayload.job_id, status: matPayload.status,
          }]);
          setLastAction({ type: "material", label: `${input.item} x${matPayload.qty}`, view: "Materials" });
          return `Material added: ${input.item} x${matPayload.qty}${input.supplier ? ` from ${input.supplier}` : ""}${input.job ? ` for ${input.job}` : ""}.`;
        }
        case "delete_job": {
          const needle = (input.customer || "").toLowerCase();
          const typeNeedle = (input.job_type || "").toLowerCase();
          const candidates = (jobs || []).filter(j =>
            (j.customer || "").toLowerCase().includes(needle) &&
            (!typeNeedle || (j.type || "").toLowerCase().includes(typeNeedle))
          );
          if (candidates.length === 0) return `Couldn't find a job for "${input.customer}". Check the Schedule tab.`;
          if (candidates.length > 1) {
            const list = candidates.slice(0, 5).map(j => `${j.type} — ${j.date || "no date"}`).join("; ");
            return `Found ${candidates.length} jobs for ${input.customer}: ${list}. Which one — tell me the job type or date.`;
          }
          const match = candidates[0];
          setJobs(prev => (prev || []).filter(j => j.id !== match.id));
          setLastAction({ type: "job", label: `Deleted: ${match.type} — ${match.customer}`, view: "Schedule" });
          return `Job deleted: ${match.type} for ${match.customer}.`;
        }
        case "delete_invoice": {
          // Match logic:
          //   - Exact invoice_id match → unambiguous, use that.
          //   - Otherwise, find ALL customer-name matches. If 0: nothing to delete.
          //     If 1: safe to delete. If 2+: refuse and list them — never silently
          //     pick the first match on an ambiguous destructive action.
          let match = null;
          if (input.invoice_id) {
            match = (invoices || []).find(i => (i.id || "").toLowerCase() === input.invoice_id.toLowerCase());
            if (!match) return `Couldn't find invoice ${input.invoice_id}. Check the Invoices tab.`;
          } else if (input.customer) {
            const needle = input.customer.toLowerCase();
            const candidates = (invoices || []).filter(i => (i.customer || "").toLowerCase().includes(needle));
            if (candidates.length === 0) return `Couldn't find an invoice for "${input.customer}". Check the Invoices tab.`;
            if (candidates.length > 1) {
              const list = candidates.slice(0, 5).map(i => `${i.id} — ${i.customer} £${i.amount || 0} (${i.status || "open"})`).join("; ");
              return `Found ${candidates.length} invoices for ${input.customer}: ${list}. Which one — tell me the invoice ID.`;
            }
            match = candidates[0];
          } else {
            return "Which invoice? Give me an invoice ID or customer name.";
          }
          setInvoices(prev => (prev || []).filter(i => i.id !== match.id));
          setLastAction({ type: "invoice", label: `Deleted: ${match.id} — ${match.customer}`, view: "Invoices" });
          return `Invoice ${match.id} for ${match.customer} (${fmtAmount(match.amount)}) deleted.`;
        }
        case "delete_enquiry": {
          const needle = (input.name || "").toLowerCase();
          const candidates = (enquiries || []).filter(e => (e.name || "").toLowerCase().includes(needle));
          if (candidates.length === 0) return `Couldn't find an enquiry from "${input.name}".`;
          if (candidates.length > 1) {
            const list = candidates.slice(0, 5).map(e => `${e.name}${e.source ? ` via ${e.source}` : ""}${e.time ? ` · ${e.time}` : ""}`).join("; ");
            return `Found ${candidates.length} enquiries from "${input.name}": ${list}. Which one — tell me the source or when it came in.`;
          }
          const match = candidates[0];
          // Match by id where available. Fall back to identity for any
          // in-memory-only enquiry that somehow escaped id assignment (every
          // creation path now calls newEnquiryId(), but defensive).
          // The Supabase delete happens automatically via the setEnquiries
          // wrapper (per-row diff pattern — see top-level setter).
          setEnquiries(prev => (prev || []).filter(e => match.id ? e.id !== match.id : e !== match));
          setLastAction({ type: "enquiry", label: `Deleted: ${match.name}`, view: "Enquiries" });
          return `Enquiry from ${match.name} deleted.`;
        }
        case "restore_recently_deleted": {
          // Restore from the holding bay. Strategy:
          //   - If item_type given: scope to that table.
          //   - If name_or_id given: filter by name or id matches.
          //   - If neither given: most-recent-deleted across all soft-delete
          //     tables (the "undo last delete" case).
          //
          // Always restores the WHOLE cascade group (rows sharing
          // deleted_cascade_id) so a customer-restore brings their invoices
          // and jobs back together — matches what was deleted.
          const RESTORE_TABLE_MAP = {
            invoice: "invoices", invoices: "invoices",
            customer: "customers", customers: "customers",
            job: "jobs", jobs: "jobs",
            "job card": "job_cards", "job_card": "job_cards", "job-card": "job_cards",
            enquiry: "enquiries", enquiries: "enquiries",
            material: "materials", materials: "materials",
            expense: "expenses", expenses: "expenses",
            mileage: "mileage_logs",
            "time log": "time_logs", "time_log": "time_logs",
            stock: "stock_items",
            cis: "cis_statements",
            payment: "subcontractor_payments",
            daywork: "daywork_sheets",
            variation: "variation_orders",
            "purchase order": "purchase_orders", "purchase_order": "purchase_orders",
            certificate: "trade_certificates", cert: "trade_certificates",
            reminder: "reminders", reminders: "reminders",
            document: "documents", doc: "documents",
            rams: "rams_documents",
            compliance: "compliance_docs",
          };
          const ALL_TABLES = [...new Set(Object.values(RESTORE_TABLE_MAP))];
          const tablesToScan = input.item_type
            ? [RESTORE_TABLE_MAP[(input.item_type || "").toLowerCase().trim()]].filter(Boolean)
            : ALL_TABLES;
          if (input.item_type && tablesToScan.length === 0) {
            return `I don't know how to restore "${input.item_type}". Try "invoice", "customer", "job", "expense", or have a look in Settings → Recently deleted.`;
          }

          // Find candidates across the relevant tables
          const candidates = [];
          for (const table of tablesToScan) {
            const { data } = await db.from(table)
              .withDeleted()
              .select("*")
              .eq("user_id", user?.id)
              .not("deleted_at", "is", null)
              .order("deleted_at", { ascending: false })
              .limit(20);
            for (const row of (data || [])) {
              candidates.push({ ...row, _table: table });
            }
          }
          // Filter by name_or_id if given
          let filtered = candidates;
          if (input.name_or_id) {
            const n = input.name_or_id.toLowerCase();
            filtered = candidates.filter(r =>
              (r.id && String(r.id).toLowerCase().includes(n)) ||
              (r.name && r.name.toLowerCase().includes(n)) ||
              (r.customer && r.customer.toLowerCase().includes(n)) ||
              (r.title && r.title.toLowerCase().includes(n)) ||
              (r.description && r.description.toLowerCase().includes(n))
            );
          }

          if (filtered.length === 0) {
            return input.name_or_id
              ? `Couldn't find anything in your recently-deleted that matches "${input.name_or_id}". Check Settings → Recently deleted for the full list.`
              : `Nothing in your recently-deleted to restore. Settings → Recently deleted shows what's there for the next 14 days.`;
          }
          // Most-recent fallback if no name filter and no item_type — pick most-recently-deleted
          let target;
          if (filtered.length > 1 && !input.name_or_id && !input.item_type) {
            target = filtered.sort((a, b) => (b.deleted_at || "").localeCompare(a.deleted_at || ""))[0];
          } else if (filtered.length > 1) {
            const list = filtered.slice(0, 5).map(r =>
              `${r._table}: ${r.id || r.name || r.customer || r.title || "—"} (deleted ${(r.deleted_at || "").slice(0, 10)})`
            ).join("; ");
            return `Found ${filtered.length} recently-deleted items matching that: ${list}. Which one — give me the ID or specify the type.`;
          } else {
            target = filtered[0];
          }

          // Restore target + cascade siblings
          const cascadeId = target.deleted_cascade_id;
          await db.from(target._table)
            .withDeleted()
            .update({ deleted_at: null, deleted_cascade_id: null })
            .eq("id", target.id)
            .eq("user_id", user?.id);
          let cascadeCount = 0;
          if (cascadeId) {
            for (const t of ALL_TABLES) {
              if (t === target._table) continue;
              const { data: restored } = await db.from(t)
                .withDeleted()
                .update({ deleted_at: null, deleted_cascade_id: null })
                .eq("deleted_cascade_id", cascadeId)
                .eq("user_id", user?.id)
                .select();
              cascadeCount += (restored || []).length;
            }
          }
          // Friendly summary
          const itemLabel = target._table.replace(/s$/, "").replace(/_/g, " ");
          const ident = target.id || target.name || target.customer || target.title || "";
          const cascadeNote = cascadeCount > 0 ? ` Plus ${cascadeCount} related item${cascadeCount === 1 ? "" : "s"} restored too.` : "";
          // Force a refresh of in-memory state so UI shows the restored row.
          // Easy way: rely on the user's next navigation to re-pull. Mark
          // lastAction so they have a tap-target.
          setLastAction({ type: "restore", label: `Restored ${itemLabel}${ident ? ": " + ident : ""}`, view: "Home" });
          return `Restored ${itemLabel}${ident ? " " + ident : ""}.${cascadeNote} Tap the relevant tab to see it.`;
        }
        case "delete_customer": {
          const needle = (input.name || "").toLowerCase();
          const candidates = (customers || []).filter(c => (c.name || "").toLowerCase().includes(needle));
          if (candidates.length === 0) return `Couldn't find a customer named "${input.name}". Check the Customers tab.`;
          if (candidates.length > 1) {
            const list = candidates.slice(0, 5).map(c => `${c.name}${c.email ? ` · ${c.email}` : ""}${c.phone ? ` · ${c.phone}` : ""}`).join("; ");
            return `Found ${candidates.length} customers matching "${input.name}": ${list}. Which one — tell me the email or phone.`;
          }
          const match = candidates[0];
          setCustomers(prev => (prev || []).filter(c => c.id !== match.id));
          setLastAction({ type: "enquiry", label: `Deleted: ${match.name}`, view: "Customers" });
          return `Customer ${match.name} deleted.`;
        }
        case "update_material": {
          // Find the material - filter by job if given to target the right entry
          let updateQuery = db.from("materials")
            .select("id, item, job, unit_price, qty, supplier").eq("user_id", user?.id)
            .ilike("item", `%${input.item}%`).order("created_at", { ascending: false });
          if (input.job) updateQuery = updateQuery.ilike("job", `%${input.job}%`);
          const { data: foundMats } = await updateQuery;
          if (!foundMats?.length) return `Couldn't find "${input.item}"${input.job ? ` on ${input.job}` : ""}. Check the Materials tab.`;
          const mat = foundMats[0];
          const updates = {};
          if (input.unit_price !== undefined) updates.unit_price = parseFloat(input.unit_price);
          if (input.qty !== undefined) updates.qty = parseInt(input.qty);
          if (input.supplier !== undefined) updates.supplier = input.supplier;
          if (!Object.keys(updates).length) return "Nothing to update — provide unit_price, qty, or supplier.";
          const { error: updErr } = await db.from("materials").update(updates).eq("id", mat.id);
          if (updErr) return `Failed to update: ${updErr.message}`;
          // Sync React state
          setMaterialsRaw(prev => (prev || []).map(m => m.id === mat.id ? { ...m, unitPrice: updates.unit_price ?? m.unitPrice, qty: updates.qty ?? m.qty, supplier: updates.supplier ?? m.supplier } : m));
          const changeDesc = Object.entries(updates).map(([k,v]) => `${k.replace("_"," ")} → ${k === "unit_price" ? "£" : ""}${v}`).join(", ");
          return `Updated ${mat.item}${mat.job ? ` (${mat.job})` : ""}: ${changeDesc}.`;
        }
        case "delete_material": {
          const count = input.count || 1;
          // Build query — always filter by job if provided to avoid deleting across all jobs
          let matQuery = db.from("materials")
            .select("id, item, job").eq("user_id", user?.id)
            .ilike("item", `%${input.item}%`)
            .order("created_at", { ascending: false });
          if (input.job || input.job_title) {
            matQuery = matQuery.ilike("job", `%${input.job || input.job_title}%`);
          }
          const { data: allMats } = await matQuery;
          if (!allMats?.length) return `Couldn't find "${input.item}"${input.job ? ` on ${input.job}` : ""}. Check the Materials tab.`;
          // SAFETY: never delete more than count (default 1)
          const toDelete = allMats.slice(0, count);
          const { error: delErr } = await db.from("materials").delete().in("id", toDelete.map(m => m.id));
          if (delErr) return `Failed to delete: ${delErr.message}`;
          // Sync React state without triggering the full DELETE+INSERT wrapper
          const deletedIds = new Set(toDelete.map(m => m.id));
          setMaterialsRaw(prev => (prev || []).filter(m => !deletedIds.has(m.id)));
          setLastAction({ type: "material", label: `Deleted: ${input.item}`, view: "Materials" });
          return `Deleted ${toDelete.length} "${toDelete[0].item}" entr${toDelete.length !== 1 ? "ies" : "y"}.`;
        }
        case "mark_invoice_paid": {
          const { data: paidRows } = await db.from("invoices").select("*").eq("user_id", user?.id).eq("is_quote", false).neq("status", "paid").order("created_at", { ascending: false }).limit(50);
          const statePaid = (invoices || []).filter(i => !i.isQuote && i.status !== "paid");
          const seenPaidIds = new Set((paidRows || []).map(i => i.id));
          const paidAll = [...(paidRows || []), ...statePaid.filter(i => !seenPaidIds.has(i.id))];
          const match = paidAll.find(i =>
            (input.invoice_id && (i.id || "").toLowerCase() === input.invoice_id.toLowerCase()) ||
            (input.customer && (i.customer || "").toLowerCase().includes(input.customer.toLowerCase()))
          );
          if (!match) return `Couldn't find an unpaid invoice matching that. Check the Invoices tab.`;
          // Persist to DB. Without this the UI shows "paid" but a reload drops
          // the change. Schema check 2026-04-25: invoices has status + due, no
          // paid_date column.
          const { error: paidUpdErr } = await db.from("invoices")
            .update({ status: "paid", due: "Paid" })
            .eq("id", match.id).eq("user_id", user?.id);
          if (paidUpdErr) return `Couldn't mark ${match.customer}'s invoice as paid: ${paidUpdErr.message}.`;
          setInvoices(prev => (prev || []).map(i => i.id === match.id ? { ...i, status: "paid", due: "Paid" } : i));
          syncInvoiceToAccounting(user?.id, { ...match, status: "paid" });
          if (typeof sendPush === "function") sendPush({ title: "💰 Invoice Paid", body: `${match.customer} paid ${fmtAmount(match.amount)}`, url: "/", type: "invoice_paid", tag: "invoice-paid" });
          setLastAction({ type: "invoice", label: `Paid: ${match.id} — ${match.customer}`, view: "Invoices" });
          // Analytics: invoice marked paid. Tracking amount helps us see
          // typical ticket size per tradie — informs value-prop messaging.
          trackEvent(db, user?.id, companyId, "payment", "invoice_marked_paid", {
            amount: match.amount,
            invoice_id: match.id,
          });
          return `Invoice ${match.id} for ${match.customer} (${fmtAmount(match.amount)}) marked as paid.`;
        }
        case "update_job_status": {
          // Dual-table search — inverse of findJob's logic. A user saying
          // "mark Karen's kitchen complete" could be talking about either
          // the Schedule entry (jobs table) or the rich Job Card (job_cards
          // table) or both. Before this fix this tool only touched jobs, so
          // job_cards status stayed stale for users who lived in Jobs tab.
          const customer = input.customer || "";
          const typeFilter = input.job_type || "";
          const jobsMatch = (jobs || []).find(j =>
            (j.customer || "").toLowerCase().includes(customer.toLowerCase()) &&
            (!typeFilter || (j.type || "").toLowerCase().includes(typeFilter.toLowerCase()))
          );
          // Also look for a matching job_card. We let findJob handle the
          // promotion case — but here we want to FIND without promoting, so
          // query directly.
          let jcQuery = db.from("job_cards").select("id,customer,title,type,status")
            .eq("user_id", user?.id).ilike("customer", `%${customer}%`)
            .order("created_at", { ascending: false }).limit(5);
          if (typeFilter) jcQuery = jcQuery.or(`title.ilike.%${typeFilter}%,type.ilike.%${typeFilter}%`);
          const { data: jcMatches } = await jcQuery;
          const jcMatch = jcMatches?.[0];
          if (!jobsMatch && !jcMatch) {
            return `Couldn't find a job for "${customer}". Check the Schedule and Jobs tabs.`;
          }
          const updatedPlaces = [];
          if (jobsMatch) {
            setJobs(prev => (prev || []).map(j => j.id === jobsMatch.id ? { ...j, status: input.status } : j));
            updatedPlaces.push("Schedule");
          }
          if (jcMatch) {
            const { error: jcUpErr } = await db.from("job_cards")
              .update({ status: input.status, updated_at: new Date().toISOString() })
              .eq("id", jcMatch.id).eq("user_id", user?.id);
            if (!jcUpErr) updatedPlaces.push("Jobs");
          }
          const displayName = jcMatch?.customer || jobsMatch?.customer || customer;
          const displayType = jcMatch?.title || jcMatch?.type || jobsMatch?.type || "job";
          setLastAction({ type: "job", label: `${input.status}: ${displayType} — ${displayName}`, view: updatedPlaces.includes("Jobs") ? "Jobs" : "Schedule" });
          return `Job "${displayType}" for ${displayName} updated to ${input.status}${updatedPlaces.length > 1 ? " (both Schedule and Jobs tabs)" : ""}.`;
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
          // Conversion preserves the original quote (don't delete). This
          // keeps acceptance history intact and lets tradies see which quotes
          // converted to work. The new invoice gets its OWN portal_token so
          // any link the customer already has for the quote keeps showing
          // the quote view, while the invoice gets a fresh link sent via
          // the invoice email.
          const inv = {
            ...match,
            id: newId,
            isQuote: false,
            status: "sent",
            due: `Due in ${brand.paymentTerms || 30} days`,
            portalToken: generatePortalToken(),
          };
          // Mark the quote as accepted (conversion implies customer said yes).
          // Leaves declined/expired quotes alone — only touches pending ones.
          const quoteNewStatus = (match.status === "accepted") ? match.status : "accepted";
          setInvoices(prev => {
            const withUpdatedQuote = (prev || []).map(i =>
              i.id === match.id ? { ...i, status: quoteNewStatus } : i
            );
            return [inv, ...withUpdatedQuote];
          });
          // Persist: insert new invoice row + update quote status. Two calls,
          // both non-blocking. If either fails, in-memory UI still reflects
          // the change and an error is logged for debugging.
          if (user?.id) {
            db.from("invoices").upsert({
              id: inv.id, user_id: user?.id,
              customer: inv.customer, address: inv.address || "",
              email: inv.email || "", phone: inv.phone || "",
              amount: inv.amount, gross_amount: inv.grossAmount || inv.amount,
              status: "sent", is_quote: false,
              due: inv.due,
              description: inv.description || "",
              line_items: inv.lineItems ? JSON.stringify(inv.lineItems) : null,
              job_ref: inv.jobRef || "",
              created_at: new Date().toISOString(),
              portal_token: inv.portalToken,
            }).then(({ error }) => { if (error) console.error("convert_quote_to_invoice upsert failed:", error.message); });
            if (match.status !== "accepted") {
              db.from("invoices").update({ status: "accepted" }).eq("id", match.id).eq("user_id", user.id)
                .then(({ error }) => { if (error) console.error("convert_quote_to_invoice quote status update failed:", error.message); });
            }
          }
          setLastAction({ type: "invoice", label: `Converted: ${newId} — ${match.customer}`, view: "Invoices" });
          return `Quote ${match.id} converted to invoice ${newId} for ${match.customer} — ${fmtAmount(match.amount)}. Quote kept in your Quotes tab as accepted.`;
        }
        case "update_material_status": {
          const term = input.item.toLowerCase();
          // Build query — filter by job if provided to avoid updating across all jobs
          let statusQuery = db.from("materials").select("id, item, job")
            .eq("user_id", user?.id).ilike("item", `%${input.item}%`);
          if (input.job || input.job_title) {
            statusQuery = statusQuery.ilike("job", `%${input.job || input.job_title}%`);
          }
          const { data: matRows } = await statusQuery;
          if (!matRows?.length) return `Couldn't find a material matching "${input.item}"${input.job ? ` on ${input.job}` : ""}.`;
          // Dedup: if already this status, skip silently
          const needsUpdate = matRows.filter(m => m.status !== input.status);
          if (!needsUpdate.length) return "";
          const { error: updateErr } = await db.from("materials")
            .update({ status: input.status })
            .in("id", needsUpdate.map(m => m.id));
          if (updateErr) return `Failed to update status: ${updateErr.message}`;
          // Sync React state directly without triggering DELETE+INSERT wrapper
          setMaterialsRaw(prev => (prev || []).map(m =>
            m.item.toLowerCase().includes(term) ? { ...m, status: input.status } : m
          ));
          setLastAction({ type: "material", label: `${input.status}: ${matRows[0].item}`, view: "Materials" });
          return `${needsUpdate.length > 1 ? needsUpdate.length + " entries" : `"${needsUpdate[0].item}"`} marked as ${input.status}${input.job ? ` on ${input.job}` : ""}.`;
        }
        case "create_job_card": {
          // Check for existing job card to avoid duplicates
          const titleMatch = (input.title || input.type || "").toLowerCase();
          const custMatch = (input.customer || "").toLowerCase();
          if (custMatch) {
            const { data: existing } = await db.from("job_cards")
              .select("id,title,customer,status,value")
              .eq("user_id", user?.id)
              .ilike("customer", `%${custMatch}%`)
              .order("created_at", { ascending: false }).limit(5);
            const match = (existing || []).find(j =>
              !titleMatch || (j.title || j.type || "").toLowerCase().includes(titleMatch) ||
              titleMatch.includes((j.title || j.type || "").toLowerCase().slice(0, 8))
            );
            if (match) {
              pendingWidgetRef.current = { type: "job_full", data: { ...match, jobNotes: [], photos: [], timeLogs: [], linkedMaterials: [], drawings: [], vos: [], docs: [] } };
              return `Job card already exists for ${match.customer} — "${match.title || match.type}". Showing it now.`;
            }
          }
          const payload = {
            user_id: user?.id,
            title: input.title || input.type || "",
            customer: input.customer,
            address: input.address || "",
            type: input.type || "",
            status: input.status || "accepted",
            value: parseFloat(input.value || 0),
            notes: input.notes || "",
            scope_of_work: input.scope_of_work || input.scope || "",
            annual_service: false,
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          };
          const { data: jobCard, error: jcErr } = await db.from("job_cards").insert(payload).select().single();
          if (jcErr) return `Failed to create job card: ${jcErr.message}`;
          if (refreshJobs) refreshJobs();
          setLastAction({ type: "job_card", label: `${input.title || input.customer}`, view: "Jobs" });
          pendingWidgetRef.current = { type: "job_full", data: { ...payload, id: jobCard?.id, jobNotes: [], photos: [], timeLogs: [], linkedMaterials: [], drawings: [], vos: [], docs: [] } };
          return `Job card created for ${input.customer}${input.title ? ` — ${input.title}` : ""}${input.value ? ` (${fmtAmount(input.value)})` : ""}.`;
        }
        case "update_brand": {
          const updates = {};
          if (input.tradingName) updates.tradingName = input.tradingName;
          if (input.ownerName) updates.ownerName = input.ownerName;
          if (input.phone) updates.phone = input.phone;
          if (input.email) updates.email = input.email;
          if (input.address) updates.address = input.address;
          if (input.tradeType) updates.tradeType = input.tradeType;
          if (input.vatNumber) updates.vatNumber = input.vatNumber;
          if (typeof input.vatEnabled === "boolean") updates.vatEnabled = input.vatEnabled;
          if (input.gasSafeNumber) updates.gasSafeNumber = input.gasSafeNumber;
          if (input.niceicNumber) updates.niceicNumber = input.niceicNumber;
          if (input.napitNumber) updates.napitNumber = input.napitNumber;
          if (input.oftecNumber) updates.oftecNumber = input.oftecNumber;
          if (input.mcsNumber) updates.mcsNumber = input.mcsNumber;
          if (input.fensaNumber) updates.fensaNumber = input.fensaNumber;
          if (input.bankName) updates.bankName = input.bankName;
          if (input.accountName) updates.accountName = input.accountName;
          if (input.sortCode) updates.sortCode = input.sortCode;
          if (input.accountNumber) updates.accountNumber = input.accountNumber;
          setBrand(b => ({ ...b, ...updates }));
          // Advance onboarding if business details just got saved
          if (updates.tradingName && onboardingStepRef.current === 2) {
            setTimeout(() => advanceOnboarding(3), 1500);
          }
          return `Business details saved: ${Object.keys(updates).join(", ")}.`;
        }
        case "list_invoices": {
          const filter = (input.filter || "all").toLowerCase().trim();
          const sortBy = (input.sort_by || "date_desc").toLowerCase().trim();
          // Always query Supabase directly — React state can be stale if a previous sync failed
          const { data: freshRows } = await db
            .from("invoices")
            .select("id, customer, amount, gross_amount, status, due, is_quote, line_items, created_at")
            .eq("user_id", user?.id)
            .order("created_at", { ascending: false })
            .limit(50);
          // Map Supabase snake_case → app camelCase
          const fresh = (freshRows || []).map(r => ({
            id: r.id, customer: r.customer, amount: parseFloat(r.amount) || 0,
            grossAmount: parseFloat(r.gross_amount || r.amount) || 0,
            status: (r.status || "").toLowerCase().trim(),
            due: r.due || "", isQuote: r.is_quote || false,
          }));
          let list = fresh.filter(i => !i.isQuote);
          if (filter === "unpaid") list = list.filter(i => i.status !== "paid");
          if (filter === "overdue") list = list.filter(i => i.status === "overdue");
          if (filter === "paid") list = list.filter(i => i.status === "paid");
          // Apply sort. Default DB order is date_desc (newest first). Sort by
          // grossAmount when available so VAT-inclusive totals are used —
          // matches what the user sees on screen.
          if (sortBy === "amount_desc") list = [...list].sort((a, b) => (b.grossAmount || b.amount) - (a.grossAmount || a.amount));
          if (sortBy === "amount_asc")  list = [...list].sort((a, b) => (a.grossAmount || a.amount) - (b.grossAmount || b.amount));
          const filterLabel = filter === "all" ? "" : filter === "unpaid" ? "outstanding " : filter + " ";
          if (!list.length) return `No ${filterLabel}invoices found.`;
          pendingWidgetRef.current = { type: "invoice_list", data: list.slice(0, 10) };
          return `Here are your ${filterLabel}invoices:`;
        }
        // ─────────────────────────────────────────────────────────────────────

        case "list_jobs": {
          const filter = input.filter || "all";
          const { data: jobList } = await db.from("job_cards").select("*").eq("user_id", user?.id).order("created_at", { ascending: false }).limit(20);
          let list = jobList || [];
          if (filter === "active") list = list.filter(j => j.status !== "completed");
          if (filter === "completed") list = list.filter(j => j.status === "completed");
          if (filter === "in_progress") list = list.filter(j => j.status === "in_progress");
          if (!list.length) return `No ${filter === "all" ? "" : filter + " "}jobs found.`;
          pendingWidgetRef.current = { type: "job_list", data: list.slice(0, 10) };
          return `Here are your ${filter === "all" ? "" : filter + " "}jobs:`;
        }
        case "list_materials": {
          const filter = input.filter || "all";
          // Query Supabase directly — React state may be stale after recent delete/update operations
          let query = db.from("materials").select("*").eq("user_id", user?.id).order("created_at", { ascending: true });
          if (filter === "to_order") query = query.eq("status", "to_order");
          if (filter === "ordered") query = query.eq("status", "ordered");
          if (filter === "collected") query = query.eq("status", "collected");
          const { data: freshMats } = await query.limit(50);
          // Deduplicate by id — React state can accumulate duplicates across sessions
          const allMats = freshMats || materials || [];
          const seenMatIds = new Set();
          const list = allMats.filter(m => {
            const id = m.id || m.item + (m.job || "");
            if (seenMatIds.has(id)) return false;
            seenMatIds.add(id);
            return true;
          });
          if (!list.length) return `No ${filter === "all" ? "" : filter + " "}materials found.`;
          const mapped = list.map(m => ({
            item: m.item || m.name || "",
            qty: m.qty || 1,
            supplier: m.supplier || "",
            job: m.job || "",
            status: m.status || "to_order",
            unitPrice: m.unit_price || m.unitPrice || 0,
          }));
          pendingWidgetRef.current = { type: "material_list", data: mapped.slice(0, 20) };
          return `Here are your ${filter === "all" ? "" : filter + " "}materials (${mapped.length} total):`;
        }
        case "find_material_receipt": {
          const term = (input.item || input.supplier || "").toLowerCase();
          const all = materials || [];
          const match = all.find(m =>
            (m.item || "").toLowerCase().includes(term) ||
            (m.supplier || "").toLowerCase().includes(term)
          );
          if (!match) return `No material found matching "${input.item || input.supplier}".`;
          // Resolution order: Storage signed URL > inline > localStorage > legacy DB column.
          const resolvedImage = await getReceiptViewUrl(match);
          if (!resolvedImage && !match.receiptSource) return `Found "${match.item}" from ${match.supplier || "unknown supplier"} but no receipt has been scanned for it yet.`;
          pendingWidgetRef.current = { type: "material_receipt", data: { ...match, resolvedImage } };
          return `Here's the receipt for ${match.item}${match.supplier ? ` from ${match.supplier}` : ""}:`;
        }
        case "list_schedule": {
          const filter = input.filter || "today";
          const now = new Date();
          const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
          const todayEnd = new Date(now); todayEnd.setHours(23,59,59,999);
          const weekStart = new Date(todayStart); weekStart.setDate(todayStart.getDate() - todayStart.getDay() + 1);
          const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6); weekEnd.setHours(23,59,59,999);
          const nextWeekStart = new Date(weekEnd); nextWeekStart.setDate(weekEnd.getDate() + 1); nextWeekStart.setHours(0,0,0,0);
          const nextWeekEnd = new Date(nextWeekStart); nextWeekEnd.setDate(nextWeekStart.getDate() + 6); nextWeekEnd.setHours(23,59,59,999);
          const start = filter === "today" ? todayStart : filter === "next_week" ? nextWeekStart : weekStart;
          const end   = filter === "today" ? todayEnd   : filter === "next_week" ? nextWeekEnd   : weekEnd;

          // Query Supabase directly so jobs created earlier in this same conversation are included
          // (React state in closure can be stale if create_job was called moments ago)
          let freshJobs = jobs || [];
          try {
            const { data: dbJobs } = await db.from("jobs")
              .select("*").eq("user_id", user?.id)
              .gte("date_obj", start.toISOString())
              .lte("date_obj", end.toISOString())
              .order("date_obj", { ascending: true });
            if (dbJobs?.length) {
              freshJobs = dbJobs.map(j => ({ ...j, dateObj: j.date_obj }));
            }
          } catch(e) {
            // Fall back to React state if DB query fails
          }

          const all = freshJobs.filter(j => {
            if (!j.dateObj && !j.date_obj) return false;
            const d = new Date(j.dateObj || j.date_obj);
            return d >= start && d <= end;
          }).sort((a,b) => new Date(a.dateObj || a.date_obj) - new Date(b.dateObj || b.date_obj));

          const label = filter === "today" ? "today" : filter === "next_week" ? "next week" : "this week";
          if (!all.length) {
            pendingWidgetRef.current = { type: "schedule_list", data: [], filter };
            return `Nothing booked ${label}.`;
          }
          pendingWidgetRef.current = { type: "schedule_list", data: all, filter };
          return `Here's your schedule for ${label} — ${all.length} job${all.length !== 1 ? "s" : ""}:`;
        }
        case "get_job_full": {
          const term = (input.customer || input.title || "").toLowerCase();
          const { job, error: fullJobErr } = await findJob(input.customer || term, input.title, "open");
          if (fullJobErr) return fullJobErr;
          let notes = { data: [] }, timeLogs = { data: [] }, materials = { data: [] };
          let drawings = { data: [] }, vos = { data: [] }, docs = { data: [] };
          try {
            [notes, , timeLogs, materials, drawings, vos, docs] = await Promise.all([
              db.from("job_notes").select("*").eq("job_id", job.id).order("created_at", { ascending: false }),
              db.from("job_photos").select("id,created_at").eq("job_id", job.id),
              db.from("time_logs").select("*").eq("job_id", job.id),
              db.from("materials").select("*").eq("job_id", job.id),
              db.from("job_drawings").select("id,filename,created_at").eq("job_id", job.id),
              db.from("variation_orders").select("*").eq("job_id", job.id),
              db.from("compliance_docs").select("*").eq("job_id", job.id),
            ]);
          } catch (e) { /* show card anyway if related queries fail */ }
          pendingWidgetRef.current = {
            type: "job_full",
            data: {
              ...job,
              jobNotes: notes.data || [],
              timeLogs: timeLogs.data || [],
              linkedMaterials: materials.data || [],
              drawings: drawings.data || [],
              vos: vos.data || [],
              docs: docs.data || [],
            }
          };
          return `Here's the full job card for ${job.customer}${job.title ? " — " + job.title : ""}:`;
        }
        case "get_job_profit": {
          const profitTerm = (input.customer || input.title || "").toLowerCase();
          const { job: pJob, error: profitJobErr } = await findJob(input.customer || profitTerm, input.title, "calculate profit for");
          if (profitJobErr) return profitJobErr;

          // Fetch core cost data
          const [{ data: tLogs }, { data: mats }, { data: vos }] = await Promise.all([
            db.from("time_logs").select("total,hours,rate,labour_type,days,description").eq("job_id", pJob.id),
            db.from("materials").select("item,qty,unit_price,status").eq("job_id", pJob.id),
            db.from("variation_orders").select("description,amount,status").eq("job_id", pJob.id),
          ]);
          // Optional tables — wrapped individually to avoid crashing if table doesn't exist
          let daysheets = [], dayExpenses = [], subPayments = [];
          try { const r = await db.from("daywork_sheets").select("hours,rate,description").eq("job_id", pJob.id); daysheets = r.data || []; } catch(e) {}
          try { const r = await db.from("expenses").select("amount,description").eq("job_id", pJob.id); dayExpenses = r.data || []; } catch(e) {}
          try { const r = await db.from("subcontractor_payments").select("gross,net,subcontractor_id").eq("job_id", pJob.id).eq("user_id", user?.id); subPayments = r.data || []; } catch(e) {}

          const jobValue = parseFloat(pJob.value || 0);
          const voIncome = (vos || []).reduce((s, v) => s + parseFloat(v.amount || 0), 0);
          const totalRevenue = jobValue + voIncome;

          const labourCost = (tLogs || []).reduce((s, t) => s + parseFloat(t.total || 0), 0);
          const materialCost = (mats || []).reduce((s, m) => s + (parseFloat(m.unit_price || 0) * (parseFloat(m.qty) || 1)), 0);
          const dayworkCost = daysheets.reduce((s, d) => s + ((parseFloat(d.hours || 0)) * (parseFloat(d.rate || 0))), 0);
          const expenseCost = dayExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
          const subcontractorCost = subPayments.reduce((s, p) => s + parseFloat(p.gross || 0), 0);
          const totalCosts = labourCost + materialCost + dayworkCost + expenseCost + subcontractorCost;

          const grossProfit = totalRevenue - totalCosts;
          const margin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0;
          const fmt = (n) => "£" + parseFloat(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

          pendingWidgetRef.current = {
            type: "job_profit",
            data: {
              customer: pJob.customer, title: pJob.title || pJob.type,
              jobValue, voIncome, totalRevenue,
              labourCost, materialCost, dayworkCost, expenseCost, subcontractorCost, totalCosts,
              grossProfit, margin,
              labourEntries: tLogs || [],
              materialEntries: mats || [],
              voEntries: vos || [],
              subPaymentCount: subPayments.length,
            }
          };

          const costBreakdown = [
            labourCost > 0 ? `labour ${fmt(labourCost)}` : "",
            materialCost > 0 ? `materials ${fmt(materialCost)}` : "",
            dayworkCost > 0 ? `daywork ${fmt(dayworkCost)}` : "",
            expenseCost > 0 ? `expenses ${fmt(expenseCost)}` : "",
          ].filter(Boolean).join(", ");

          return `Profit breakdown for ${pJob.customer} — ${pJob.title || pJob.type}: Revenue ${fmt(totalRevenue)}, costs ${fmt(totalCosts)}${costBreakdown ? " (" + costBreakdown + ")" : ""}, gross profit ${fmt(grossProfit)} (${margin}% margin).`;
        }
        case "start_rams": {
          const blankRams = {
            title: input.job_ref ? `RAMS — ${input.job_ref}` : "",
            job_ref: input.job_ref || "", site_address: input.site_address || "",
            client_name: "", start_date: "", end_date: "",
            prepared_by: brand?.tradingName || brand?.ownerName || "",
            reviewed_by: "", scope: "",
            cdm_notifiable: false,
            selected_hazards: [], custom_hazards: [],
            selected_method_cats: [], selected_method_steps: [], custom_method_steps: [],
            coshh_substances: [], custom_coshh: [],
            first_aider: "", nearest_ae: "", muster_point: "",
            emergency_procedure: "", welfare_location: "",
          };
          setRamsSession({ step: 1, form: blankRams });
          pendingWidgetRef.current = { type: "rams_step1", data: blankRams };
          return `Let's build your RAMS right here. I'll take you through it step by step.\n\nStep 1 of 5 — Project Details.\n\nWhat's the title for this RAMS? For example: "Gas boiler replacement — 12 High Street"`;
        }
        case "rams_save_step1": {
          if (!ramsSession) return "No active RAMS session. Say 'start a RAMS' to begin.";
          const updated = { ...ramsSession.form, ...input };
          setRamsSession({ step: 2, form: updated });
          const cats = Object.keys(HAZARD_LIBRARY);
          pendingWidgetRef.current = { type: "rams_hazard_cats", data: { ...updated, categories: cats } };
          return `Got it — "${updated.title}" at ${updated.site_address || "the site"}.\n\nStep 2 of 5 — Hazards.\n\nWhich of these categories apply to this job? Tap or tell me which ones:\n\n${cats.map((c, i) => `${i+1}. ${c}`).join("\n")}\n\nYou can say the numbers, the names, or just describe the work and I'll pick the right ones.`;
        }
        case "rams_save_step2": {
          if (!ramsSession) return "No active RAMS session.";
          // Parse which categories the user chose
          const allCats = Object.keys(HAZARD_LIBRARY);
          const input_lower = (input.categories || input.work_types || "").toLowerCase();
          const chosen = allCats.filter((cat, idx) => {
            const catLower = cat.toLowerCase();
            if (input_lower.includes(catLower)) return true;
            if (input_lower.includes(String(idx + 1))) return true;
            // Loose keyword matching per category
            if (catLower.includes("gas") && input_lower.match(/gas|boiler|heating|lpg|combustion/)) return true;
            if (catLower.includes("electric") && input_lower.match(/electr|wiring|consumer|circuit/)) return true;
            if (catLower.includes("plumb") && input_lower.match(/plumb|water|pipe|drain|radiator/)) return true;
            if (catLower.includes("height") && input_lower.match(/height|roof|ladder|scaffold|mewp/)) return true;
            if (catLower.includes("manual") && input_lower.match(/lift|carry|manual|heavy/)) return true;
            if (catLower.includes("power tool") && input_lower.match(/tool|drill|grind|saw/)) return true;
            if (catLower.includes("slip") && input_lower.match(/slip|trip|fall|floor/)) return true;
            if (catLower.includes("fire") && input_lower.match(/fire|torch|weld|hot work/)) return true;
            if (catLower.includes("confined") && input_lower.match(/confined|loft|void|underground/)) return true;
            if (catLower.includes("site") && input_lower.match(/site|outdoor|traffic|public/)) return true;
            return false;
          });
          // Always include Manual Handling and Slips if not already
          ["Manual Handling", "Slips, Trips & Falls"].forEach(c => { if (!chosen.includes(c)) chosen.push(c); });
          if (!chosen.length) {
            return `I couldn't match those to any categories. Here are the options:\n${allCats.map((c,i) => `${i+1}. ${c}`).join("\n")}\n\nWhich numbers or names apply?`;
          }
          // Get all hazards for chosen categories
          const hazardList = chosen.flatMap(cat => (HAZARD_LIBRARY[cat] || []).map(h => ({ ...h, category: cat })));
          const updated = { ...ramsSession.form, _chosen_cats: chosen, _pending_hazards: hazardList };
          setRamsSession({ step: 2.5, form: updated });
          pendingWidgetRef.current = { type: "rams_hazard_review", data: updated };
          const byCategory = chosen.map(cat => {
            const hazards = HAZARD_LIBRARY[cat] || [];
            return `${cat} (${hazards.length}):\n${hazards.map(h => `  · ${h.hazard} — ${h.risk} risk`).join("\n")}`;
          }).join("\n\n");
          return `Here are the hazards for your chosen categories — ${hazardList.length} total:\n\n${byCategory}\n\nAre you happy with all of these, or do you want to remove any? Also tell me if there are any additional hazards I should add. Say "confirmed" to accept them all.`;
        }
        case "rams_confirm_hazards": {
          if (!ramsSession) return "No active RAMS session.";
          const allPending = ramsSession.form._pending_hazards || [];
          const removals = (input.remove || "").toLowerCase();
          const additions = (input.add || "");
          let finalHazards = allPending.filter(h => !removals.includes(h.hazard.toLowerCase().substring(0, 15)));
          const customHazards = additions ? additions.split("\n").filter(Boolean).map(h => ({ hazard: h, risk: "Medium", control: "Assess on site", ppe: "Appropriate PPE" })) : [];
          const selectedIds = finalHazards.map(h => h.id).filter(Boolean);
          const updated = { ...ramsSession.form, selected_hazards: selectedIds, custom_hazards: customHazards, _work_types: ramsSession.form._chosen_cats?.join(", ") };
          setRamsSession({ step: 3, form: updated });
          pendingWidgetRef.current = { type: "rams_step3", data: updated };
          const workTypes = (updated._work_types || "").toLowerCase();
          const methodSteps = [];
          Object.entries(METHOD_LIBRARY).forEach(([cat, steps]) => {
            if (cat === "Site Setup") methodSteps.push(...steps.slice(0, 4));
            if (workTypes.includes("gas") && cat === "Gas Works") methodSteps.push(...steps);
            if (workTypes.match(/electric/) && cat === "Electrical Works") methodSteps.push(...steps);
            if ((workTypes.includes("plumb") || workTypes.includes("water") || workTypes.includes("radiator")) && cat === "Plumbing Works") methodSteps.push(...steps);
          });
          if (!methodSteps.length) methodSteps.push(...(METHOD_LIBRARY["Site Setup"] || []));
          const updatedWithMethod = { ...updated, _draft_method_steps: methodSteps };
          setRamsSession({ step: 3, form: updatedWithMethod });
          pendingWidgetRef.current = { type: "rams_step3", data: updatedWithMethod };
          return `Hazards confirmed — ${selectedIds.length + customHazards.length} in total.\n\nStep 3 of 5 — Method Statement.\n\nHere are the suggested steps:\n\n${methodSteps.map((s,i) => `${i+1}. ${s}`).join("\n")}\n\nSay "confirmed" to use these, or tell me which to remove or any to add.`;
        }
        case "rams_save_step3": {
          if (!ramsSession) return "No active RAMS session.";
          const draftSteps = ramsSession.form._draft_method_steps || [];
          const removeNums = (input.remove_numbers || "").split(/[,\s]+/).map(n => parseInt(n.trim())).filter(n => !isNaN(n));
          const addSteps = input.add ? input.add.split("\n").filter(Boolean) : [];
          const finalSteps = draftSteps.filter((_, idx) => !removeNums.includes(idx + 1));
          const updatedS3 = { ...ramsSession.form, selected_method_steps: finalSteps, custom_method_steps: addSteps };
          setRamsSession({ step: 4, form: updatedS3 });
          pendingWidgetRef.current = { type: "rams_step4", data: updatedS3 };
          return `Method statement confirmed — ${finalSteps.length + addSteps.length} steps total.\n\nStep 4 of 5 — COSHH (Hazardous Substances).\n\nWill you be using any hazardous substances? For example: flux, solder, pipe jointing compound, cleaning agents, adhesives, refrigerant.\n\nSay "none" to skip.`;
        }
        case "rams_save_step4": {
          if (!ramsSession) return "No active RAMS session.";
          const subs = input.substances === "none" ? [] : (input.substances || "").split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
          const updated = { ...ramsSession.form, coshh_substances: subs };
          setRamsSession({ step: 5, form: updated });
          pendingWidgetRef.current = { type: "rams_step5", data: updated };
          return `COSHH noted${subs.length ? ` — ${subs.length} substance${subs.length !== 1 ? "s" : ""}` : " — none"}.\n\nStep 5 of 5 — Welfare & Emergency.\n\nFew quick questions:\n1. Who is the first aider on site and their phone number?\n2. What is the nearest A&E hospital?\n3. Where is the emergency assembly/muster point?`;
        }
        case "rams_save_step5": {
          if (!ramsSession) return "No active RAMS session.";
          const updated = {
            ...ramsSession.form,
            first_aider: input.first_aider || "",
            nearest_ae: input.nearest_ae || "",
            muster_point: input.muster_point || "",
            emergency_procedure: input.emergency_procedure || "In the event of an emergency, stop work immediately, evacuate to the muster point, call 999 if required, and contact the site manager.",
            welfare_location: input.welfare_location || "",
          };
          // Save to Supabase
          const payload = {
            title: updated.title, job_ref: updated.job_ref, site_address: updated.site_address,
            prepared_by: updated.prepared_by, date: updated.start_date || new Date().toISOString().split("T")[0],
            scope: updated.scope, cdm_notifiable: updated.cdm_notifiable || false,
            form_data: JSON.stringify(updated),
          };
          const { data, error } = await db.from("rams_documents").insert({ user_id: user?.id, ...payload, created_at: new Date().toISOString() }).select().single();
          setRamsSession(null);
          if (error) return `RAMS built but failed to save: ${error.message}`;
          pendingWidgetRef.current = { type: "rams_complete", data: { ...updated, id: data?.id } };
          return `RAMS complete — "${updated.title}" is saved.\n\nAll 5 steps done:\n✓ Project details\n✓ ${updated.selected_hazards.length} hazards identified\n✓ ${(updated.selected_method_steps.length + updated.custom_method_steps.length)} method steps\n✓ COSHH recorded\n✓ Emergency info set\n\nYou can view and export the full PDF from the RAMS tab.`;
        }
        case "find_invoice": {
          const term = (input.customer || input.id || "").toLowerCase();
          const { data: rows } = await db.from("invoices")
            .select("*").eq("user_id", user?.id).eq("is_quote", false)
            .order("created_at", { ascending: false }).limit(50);
          const fresh = (rows || []).map(r => ({ ...r, isQuote: r.is_quote, grossAmount: parseFloat(r.gross_amount || r.amount) || 0, amount: parseFloat(r.amount) || 0, status: (r.status || "").toLowerCase().trim(), lineItems: Array.isArray(r.line_items) ? r.line_items : (r.line_items ? JSON.parse(r.line_items) : []) }));
          const match = fresh.find(i => (i.id || "").toLowerCase().includes(term) || (i.customer || "").toLowerCase().includes(term)) || fresh[0];
          if (!match) return `No invoice found for "${input.customer || input.id}".`;
          pendingWidgetRef.current = { type: "invoice", data: match };
          return `Here's the invoice for ${match.customer}:`;
        }
        case "find_quote": {
          const term = (input.customer || input.id || "").toLowerCase();
          const { data: rows } = await db.from("invoices")
            .select("*").eq("user_id", user?.id).eq("is_quote", true)
            .order("created_at", { ascending: false }).limit(50);
          const fresh = (rows || []).map(r => ({ ...r, isQuote: true, grossAmount: parseFloat(r.gross_amount || r.amount) || 0, amount: parseFloat(r.amount) || 0, status: (r.status || "").toLowerCase().trim(), lineItems: Array.isArray(r.line_items) ? r.line_items : (r.line_items ? JSON.parse(r.line_items) : []) }));
          const match = fresh.find(i => (i.id || "").toLowerCase().includes(term) || (i.customer || "").toLowerCase().includes(term)) || fresh[0];
          if (!match) return `No quote found for "${input.customer || input.id}".`;
          pendingWidgetRef.current = { type: "quote", data: match };
          return `Here's the quote for ${match.customer}:`;
        }
        case "find_job_card": {
          const term = (input.customer || input.title || "").toLowerCase();
          if (!term) return "Please tell me which job card to find — provide the customer name or job title.";
          const { data: found, error: findErr } = await db.from("job_cards")
            .select("*").eq("user_id", user?.id)
            .or(`customer.ilike.%${term}%,title.ilike.%${term}%,type.ilike.%${term}%`)
            .order("created_at", { ascending: false }).limit(1);
          if (findErr) return `Error searching job cards: ${findErr.message}`;
          const match = found?.[0];
          if (!match) {
            // Fallback: try just customer name
            const { data: fallback } = await db.from("job_cards")
              .select("*").eq("user_id", user?.id)
              .ilike("customer", `%${term}%`)
              .order("created_at", { ascending: false }).limit(1);
            if (!fallback?.length) return `No job card found for "${input.customer || input.title}". Try: list_jobs to see all job cards.`;
          }
          const job = found?.[0] || (await db.from("job_cards").select("*").eq("user_id", user?.id).ilike("customer", `%${term}%`).order("created_at", { ascending: false }).limit(1)).data?.[0];
          if (!job) return `No job card found for "${input.customer || input.title}".`;
          // Fetch related data — wrapped so a failed sub-query never blocks the card showing
          let jNotes = { data: [] }, jTimeLogs = { data: [] }, jMats = { data: [] };
          let jDrawings = { data: [] }, jVos = { data: [] }, jDocs = { data: [] };
          try {
            [jNotes, , jTimeLogs, jMats, jDrawings, jVos, jDocs] = await Promise.all([
              db.from("job_notes").select("*").eq("job_id", job.id).order("created_at", { ascending: false }),
              db.from("job_photos").select("id,created_at").eq("job_id", job.id),
              db.from("time_logs").select("*").eq("job_id", job.id),
              db.from("materials").select("*").eq("job_id", job.id),
              db.from("job_drawings").select("id,filename,created_at").eq("job_id", job.id),
              db.from("variation_orders").select("*").eq("job_id", job.id),
              db.from("compliance_docs").select("*").eq("job_id", job.id),
            ]);
          } catch (e) { /* related data unavailable, show card anyway */ }
          pendingWidgetRef.current = {
            type: "job_full",
            data: {
              ...job,
              jobNotes: jNotes.data || [],
              timeLogs: jTimeLogs.data || [],
              linkedMaterials: jMats.data || [],
              drawings: jDrawings.data || [],
              vos: jVos.data || [],
              docs: jDocs.data || [],
            }
          };
          return `Here's the job card for ${job.customer}${job.title ? " — " + job.title : ""}:`;
        }
        case "assign_material_to_job": {
          const matIdx = (materials || []).findIndex(m => m.item?.toLowerCase().includes(input.item.toLowerCase()));
          if (matIdx < 0) return `Couldn't find material "${input.item}". Check the Materials tab.`;
          const mat = (materials || [])[matIdx];
          const { job, error: assignJobErr } = await findJob(input.customer, input.job_title, "assign this material to");
          if (assignJobErr) return assignJobErr;
          // Update in state by index (not by reference which can fail)
          setMaterials(prev => (prev || []).map((m, i) => i === matIdx ? { ...m, job_id: job.id, job: job.title || job.type || input.customer } : m));
          // Also persist to Supabase if material has an ID
          if (mat.id) {
            await db.from("materials").update({ job_id: job.id }).eq("id", mat.id).eq("user_id", user?.id);
          }
          setLastAction({ type: "material", label: `${mat.item} → ${job.customer}`, view: "Materials" });
          return `"${mat.item}" linked to ${job.customer}'s job. It will now show in that job's profit breakdown.`;
        }
        case "log_time": {
          const { job: timeJob, error: timeJobErr } = await findJob(input.customer, input.job_title, "log this labour to");
          if (timeJobErr) return timeJobErr;
          const today = new Date().toISOString().split("T")[0];
          const type = input.labour_type || "hourly";
          let hours = 0, total = 0;
          if (type === "hourly") { hours = parseFloat(input.hours || 0); total = hours * parseFloat(input.rate || 0); }
          else if (type === "day_rate") { hours = parseFloat(input.days || 0) * 8; total = parseFloat(input.days || 0) * parseFloat(input.rate || 0); }
          else { total = parseFloat(input.total || 0); }
          // Dedup: block only if same job + same date + same total + same labour_type
          // Different labour type or different job = legitimate new entry
          if (total > 0) {
            const { data: existingLog } = await db.from("time_logs")
              .select("id").eq("job_id", timeJob.id).eq("user_id", user?.id)
              .eq("log_date", input.date || today).eq("total", total)
              .eq("labour_type", type).limit(1);
            if (existingLog?.length) {
              return ""; // Silent dedup
            }
          }
          const { error: timeErr } = await db.from("time_logs").insert({ job_id: timeJob.id, user_id: user?.id, log_date: input.date || today, labour_type: type, hours, days: input.days || null, rate: input.rate || 0, total, description: input.description || "" });
          if (timeErr) return `Labour log failed: ${timeErr.message}`;
          setLastAction({ type: "job", label: `Time logged — ${input.customer}`, view: "Jobs" });
          const label = type === "hourly" ? `${input.hours}hrs @ ${fmtAmount(input.rate)}/hr` : type === "day_rate" ? `${input.days} days @ ${fmtAmount(input.rate)}/day` : `Price work ${fmtAmount(input.total)}`;
          return `Labour logged for ${input.customer}: ${label} = ${fmtCurrency(total)}.`;
        }
        case "log_mileage": {
          const today = new Date().toISOString().split("T")[0];
          let miles = input.miles ? parseFloat(input.miles) : null;
          let distanceNote = "";

          // Auto-calculate driving distance if two addresses given but no miles
          if (!miles && input.from_location && input.to_location && !input.log_without_miles) {
            try {
              const distRes = await fetch("/api/distance", {
                method: "POST",
                headers: await authHeaders(),
                body: JSON.stringify({ from: input.from_location, to: input.to_location }),
              });
              if (distRes.ok) {
                const distData = await distRes.json();
                if (distData.miles) {
                  miles = distData.miles;
                  distanceNote = ` (${distData.miles} miles calculated automatically)`;
                }
              }
            } catch(e) { console.warn("Distance calc failed:", e.message); }
            if (!miles) {
              // Distance API failed — ask user but remember the addresses
              return `I couldn't calculate the distance between "${input.from_location}" and "${input.to_location}" automatically. How many miles was the trip? Or say "log it without miles" and you can update it later.`;
            }
          }

          // Allow logging as placeholder with 0 miles if user wants to add miles later
          if (!miles && !input.log_without_miles) return "How many miles was the trip? Or say 'log it without miles' to save the route and fill in the miles later.";
          miles = miles || 0;
          const value = parseFloat((miles * 0.45).toFixed(2));
          // Check for duplicate entry (same route, same date) to prevent re-logging
          const tripDate = input.date || today;
          const { data: existingTrip } = await db.from("mileage_logs")
            .select("id").eq("user_id", user?.id).eq("date", tripDate)
            .ilike("from_location", `%${(input.from_location || "").slice(0, 15)}%`)
            .ilike("to_location", `%${(input.to_location || "").slice(0, 15)}%`)
            .limit(1);
          if (existingTrip?.length) {
            return ""; // Silent dedup — no output, no context for Claude to re-address
          }
          const { error: mileErr } = await db.from("mileage_logs").insert({
            user_id: user?.id, date: tripDate,
            from_location: input.from_location || "", to_location: input.to_location || "",
            miles, purpose: input.purpose || "", rate: 0.45, value,
            created_at: new Date().toISOString()
          });
          if (mileErr) return `Mileage couldn't be saved: ${mileErr.message}. Please check the Mileage tab manually.`;
          setLastAction({ type: "mileage", label: `${miles} miles logged`, view: "Mileage" });
          const milesMsg = miles === 0
            ? `Trip saved: ${input.from_location || "start"} → ${input.to_location || "destination"}. Miles set to 0 — update it later by saying "update mileage for [route] to X miles".`
            : `Mileage logged: ${miles} miles from ${input.from_location || "start"} to ${input.to_location || "destination"}${distanceNote} — ${fmtAmount(value)} claimable at the HMRC rate.`;
          return milesMsg;
        }
        case "add_job_note": {
          const { job: noteJob, error: noteJobErr } = await findJob(input.customer, input.job_title, "add this note to");
          if (noteJobErr) return noteJobErr;
          await db.from("job_notes").insert({ job_id: noteJob.id, user_id: user?.id, note: input.note, created_at: new Date().toISOString() });
          setLastAction({ type: "job", label: `Note added — ${input.customer}`, view: "Jobs" });
          return `Note added to ${input.customer}'s job: "${input.note.slice(0, 60)}${input.note.length > 60 ? "..." : ""}"`;
        }
        case "update_stock": {
          const { data: stockItems } = await db.from("stock_items").select("*").eq("user_id", user?.id).ilike("name", `%${input.name}%`).limit(1);
          if (!stockItems?.length) return `Couldn't find stock item "${input.name}". Check the Stock tab.`;
          const item = stockItems[0];
          const newQty = Math.max(0, parseFloat(item.quantity || 0) + parseFloat(input.adjustment));
          const { error: stockErr } = await db.from("stock_items").update({ quantity: newQty, updated_at: new Date().toISOString() }).eq("id", item.id);
          if (stockErr) return `Failed to update stock: ${stockErr.message}`;
          const direction = input.adjustment > 0 ? "added" : "removed";
          return `Stock updated: ${item.name} — ${Math.abs(input.adjustment)} ${item.unit || "units"} ${direction}. New quantity: ${newQty} ${item.unit || "units"}.`;
        }

        case "log_expense": {
          const amount = input.exp_type === "mileage"
            ? (parseFloat(input.miles || 0) * 0.45)
            : (parseFloat(input.amount) || 0);
          // Resolve job link if a customer or job_title was given — this is
          // what makes the expense show up in the job's profit breakdown.
          // Before this, log_expense never accepted customer/job_title, so
          // every expense had job_id=null and get_job_profit's expenseCost
          // always came back as £0 regardless of what had been logged.
          let expJobId = null;
          if (input.customer || input.job_title) {
            const { job: expJob } = await findJob(input.customer || "", input.job_title || "");
            if (expJob) expJobId = expJob.id;
          }
          // Dedup: same description + amount + date = duplicate
          const expDate = input.exp_date || localDate();
          const { data: existingExp } = await db.from("expenses")
            .select("id").eq("user_id", user?.id).eq("exp_date", expDate)
            .ilike("description", input.description || "").eq("amount", amount).limit(1);
          if (existingExp?.length) return ""; // Silent dedup
          const { data, error } = await db.from("expenses").insert({
            user_id: user?.id,
            exp_type: input.exp_type || "other",
            description: input.description || "",
            amount,
            miles: input.exp_type === "mileage" ? parseFloat(input.miles) : null,
            exp_date: input.exp_date || localDate(),
            job_id: expJobId,
          }).select().single();
          if (error) return `Failed to log expense: ${error.message}`;
          pendingWidgetRef.current = { type: "expense_entry", data };
          return `Expense logged: ${input.description || input.exp_type} — ${fmtCurrency(amount)}${expJobId ? ` (linked to ${input.customer}${input.job_title ? ` — ${input.job_title}` : ""})` : ""}`;
        }
        case "list_expenses": {
          const { data } = await db.from("expenses").select("*").eq("user_id", user?.id).order("exp_date", { ascending: false }).limit(20);
          if (!data?.length) return "No expenses logged yet.";
          pendingWidgetRef.current = { type: "expense_list", data };
          return `Here are your recent expenses:`;
        }
        case "log_cis_statement": {
          const gross = parseFloat(input.gross_amount) || 0;
          const deduction = parseFloat(input.deduction_amount) || 0;
          const taxMonth = (input.tax_month || localMonth()) + "-01";
          // Dedup: same contractor + same month = duplicate.
          // Excluding archived rows so if a tradie archives one and re-adds, it works.
          const { data: existingCis } = await db.from("cis_statements")
            .select("id").eq("user_id", user?.id)
            .eq("contractor_name", input.contractor_name || "")
            .eq("tax_month", taxMonth).is("archived_at", null).limit(1);
          if (existingCis?.length) return ""; // Silent dedup
          const { data, error } = await db.from("cis_statements").insert({
            user_id: user?.id,
            contractor_name: input.contractor_name || "",
            tax_month: (input.tax_month || localMonth()) + "-01",
            gross_amount: gross,
            deduction_amount: deduction,
            net_amount: gross - deduction,
            notes: input.notes || "",
          }).select().single();
          if (error) return `Failed to log CIS statement: ${error.message}`;
          pendingWidgetRef.current = { type: "cis_statement", data };
          return `CIS statement logged — ${input.contractor_name}: gross ${fmtCurrency(gross)}, deduction ${fmtCurrency(deduction)}, net ${fmtCurrency((gross-deduction))}.`;
        }
        case "list_cis_statements": {
          const { data } = await db.from("cis_statements").select("*").eq("user_id", user?.id).is("archived_at", null).order("tax_month", { ascending: false }).limit(12);
          if (!data?.length) return "No CIS statements logged yet.";
          pendingWidgetRef.current = { type: "cis_list", data };
          return `Here are your CIS statements:`;
        }
        case "add_subcontractor": {
          const existing = await tmReadSubs(db, user?.id, { nameLike: input.name, limit: 1 });
          if (existing.data?.length) {
            const hit = existing.data[0];
            // If an archived subbie matches, silently unarchive + update
            // details. Otherwise signal the duplicate (existing pattern).
            if (hit.active === false) {
              // Session 3: direct team_members update. Map "company" back to
              // company_name for the team_members shape.
              const { data: tmRe, error: reErr } = await db.from("team_members").update({
                active: true,
                archived_at: null,
                company_name: input.company || undefined,
                utr: input.utr || undefined,
                cis_rate: input.cis_rate ? parseInt(input.cis_rate) : undefined,
                email: input.email || undefined,
                phone: input.phone || undefined,
              }).eq("id", hit.id).eq("user_id", user?.id).select().single();
              if (reErr) return `Failed to reactivate: ${reErr.message}`;
              const re = {
                id: tmRe.id, name: tmRe.name,
                company: tmRe.company_name, utr: tmRe.utr,
                cis_rate: tmRe.cis_rate, email: tmRe.email, phone: tmRe.phone,
                active: tmRe.active, created_at: tmRe.created_at,
              };
              pendingWidgetRef.current = { type: "subcontractor_entry", data: re };
              return `${re.name} reactivated — CIS rate ${re.cis_rate}%. Past payment history preserved.`;
            }
            return `${input.name} is already in your subcontractors.`;
          }
          // Cross-table check: if this name is already in workers (active OR
          // archived), block the insert to avoid two records for the same
          // person. Mirrors within-table dedup behaviour which also catches
          // archived rows. Temporary until workers/subcontractors are
          // unified — see docs/migrations/workers-subs-unification.md.
          const crossW = await tmReadWorkers(db, user?.id, { nameLike: input.name, limit: 1 });
          if (crossW.data?.length) {
            const w = crossW.data[0];
            if (w.active === false) {
              return `${w.name} is in your workers list but archived. Restore them in Workers if it's the same person, or use a different name to add as a separate subcontractor.`;
            }
            return `${w.name} is already in your workers list${w.type === "subcontractor" ? " as a subcontractor" : ""}. Open Workers → ${w.name} to update their details, or remove them from workers first if you want to add them as a separate subcontractor record.`;
          }
          // HMRC rule: unregistered/unverified subs attract 30%, registered subs 20%.
          // If the user hasn't stated a rate, default on whether a UTR was given.
          // No UTR = unregistered = 30%. UTR on file = assume registered at 20%
          // (tradie's job to verify with HMRC — we just hold the starting point).
          const defaultCisRate = input.utr ? 20 : 30;
          // Session 3: direct write to team_members. Translate result back to
          // legacy subcontractors shape for the widget payload (existing
          // widget consumers read `company`, not `company_name`).
          const { data: tmRow, error } = await db.from("team_members").insert({
            user_id: user?.id,
            name: input.name,
            engagement: "self_employed",
            company_name: input.company || null,
            utr: input.utr || null,
            cis_rate: parseInt(input.cis_rate) || defaultCisRate,
            email: input.email || null,
            phone: input.phone || null,
            active: true,
            source_table: "subcontractors",
          }).select().single();
          if (error) return `Failed to add subcontractor: ${error.message}`;
          const data = {
            id: tmRow.id, user_id: tmRow.user_id, name: tmRow.name,
            company: tmRow.company_name, utr: tmRow.utr, cis_rate: tmRow.cis_rate,
            email: tmRow.email, phone: tmRow.phone, active: tmRow.active,
            created_at: tmRow.created_at,
          };
          pendingWidgetRef.current = { type: "subcontractor_entry", data };
          const utrNote = !input.utr && !input.cis_rate ? " No UTR on file — HMRC requires 30% on unverified subbies. Set to 20% once you've verified their UTR with HMRC." : "";
          return `${data.name} added as a subcontractor — CIS rate ${data.cis_rate}%.${utrNote}`;
        }
        case "log_subcontractor_payment": {
          const { data: subs } = await tmReadSubs(db, user?.id, { nameLike: input.name || "", limit: 1 });
          const sub = subs?.[0];
          if (!sub) {
            // Not in subcontractors — check workers table too
            const { data: wCheck } = await tmReadWorkers(db, user?.id, { nameLike: input.name || "", limit: 1 });
            if (wCheck?.length) return `${wCheck[0].name} is in your workers list, not subcontractors. Use "log worker time" to record their hours.`;
            return `Subcontractor "${input.name}" not found. Add them with "add a subcontractor" first.`;
          }
          // Calculate gross based on payment type
          const payType = input.payment_type || "price_work";
          let gross = parseFloat(input.gross) || 0;
          let execLabour = parseFloat(input.labour_amount) || 0;
          let execMats = parseFloat(input.materials_amount) || 0;
          if (payType === "day_rate" && input.days && input.rate) gross = parseFloat(input.days) * parseFloat(input.rate);
          if (payType === "hourly" && input.hours && input.rate) gross = parseFloat(input.hours) * parseFloat(input.rate);
          if (payType === "price_work" && (execLabour || execMats)) gross = execLabour + execMats;
          if (!gross) return `Please provide the amount — gross, labour amount, days × rate, or hours × rate.`;
          // CIS only on labour for price work; full gross for day/hourly
          const cisBaseAmount = (payType === "price_work" && execLabour > 0) ? execLabour : gross;
          const rate = (sub.cis_rate || 20) / 100;
          const deduction = parseFloat((cisBaseAmount * rate).toFixed(2));
          const net = parseFloat((gross - deduction).toFixed(2));
          const payDate = input.date || new Date().toISOString().split("T")[0];
          // Dedup: same sub + same gross + same date = duplicate payment
          const { data: existingSub } = await db.from("subcontractor_payments")
            .select("id").eq("user_id", user?.id).eq("subcontractor_id", sub.id)
            .eq("date", payDate).eq("gross", gross).limit(1);
          if (existingSub?.length) return ""; // Silent dedup
          // Resolve job_id if customer/job provided — links cost to job profit breakdown
          let subJobId = null;
          let subJobRef = input.job_ref || "";
          if (input.customer || input.job_title) {
            const { job: subJob } = await findJob(input.customer || "", input.job_title || "");
            if (subJob) {
              subJobId = subJob.id;
              subJobRef = subJobRef || `${subJob.customer} — ${subJob.title || subJob.type || ""}`.trim();
            }
          }
          const { data, error } = await db.from("subcontractor_payments").insert({
            user_id: user?.id, subcontractor_id: sub.id,
            date: payDate,
            gross, deduction, net, cis_rate: sub.cis_rate || 20,
            payment_type: payType,
            days: parseFloat(input.days) || null,
            hours: parseFloat(input.hours) || null,
            rate: parseFloat(input.rate) || null,
            labour_amount: execLabour || null,
            materials_amount: execMats || null,
            job_id: subJobId,
            job_ref: subJobRef, description: input.description || "",
            invoice_number: input.invoice_number || "",
            created_at: new Date().toISOString(),
          }).select().single();
          if (error) return `Failed to log payment: ${error.message}`;
          pendingWidgetRef.current = { type: "subcontractor_payment", data: { ...data, subcontractor_name: sub.name } };
          let payDesc = "";
          if (payType === "day_rate") payDesc = `${input.days} days @ ${fmtAmount(input.rate)}/day = `;
          else if (payType === "hourly") payDesc = `${input.hours}hrs @ ${fmtAmount(input.rate)}/hr = `;
          else if (execLabour || execMats) payDesc = `labour ${fmtCurrency(execLabour)}, materials ${fmtCurrency(execMats)} = `;
          return `Payment logged for ${sub.name} — ${payDesc}gross ${fmtCurrency(gross)}, CIS deduction ${fmtCurrency(deduction)} (on ${payType === "price_work" && execLabour > 0 ? "labour only" : "full amount"}), net to pay ${fmtCurrency(net)}.`;
        }
        case "list_subcontractors": {
          const { data } = await tmReadSubs(db, user?.id, { activeOnly: true });
          if (!data?.length) return "No subcontractors added yet. Say 'add subcontractor' to add one.";
          const sorted = data.slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""));
          pendingWidgetRef.current = { type: "subcontractor_list", data: sorted };
          return `Here are your subcontractors:`;
        }
        case "list_unpaid": {
          const scope = input?.scope || "all";
          let unpaidSubs = [];
          let unpaidMats = [];

          if (scope === "all" || scope === "subcontractors") {
            const { data: pays } = await db
              .from("subcontractor_payments")
              .select("id, date, gross, net, deduction, subcontractor_id, description, job_ref, invoice_number, paid")
              .eq("user_id", user?.id)
              .eq("paid", false)
              .order("date", { ascending: true });
            if (pays?.length) {
              const subIds = [...new Set(pays.map(p => p.subcontractor_id).filter(Boolean))];
              // Session 2: read all active subs then filter client-side by id.
              // (tmReadSubs doesn't support .in() directly — data volume here
              // is small enough per user that this is fine.)
              const { data: allSubs } = subIds.length
                ? await tmReadSubs(db, user?.id)
                : { data: [] };
              const subs = (allSubs || []).filter(s => subIds.includes(s.id));
              const subMap = Object.fromEntries((subs || []).map(s => [s.id, s.name]));
              unpaidSubs = pays.map(p => ({ ...p, subcontractor_name: subMap[p.subcontractor_id] || "Unknown" }));
            }
          }

          if (scope === "all" || scope === "materials") {
            const { data: mats } = await db
              .from("materials")
              .select("id, item, qty, unit_price, supplier, job, paid, created_at")
              .eq("user_id", user?.id)
              .eq("paid", false)
              .order("created_at", { ascending: true });
            if (mats?.length) unpaidMats = mats;
          }

          const subTotal = unpaidSubs.reduce((s, p) => s + parseFloat(p.net || 0), 0);
          const matTotal = unpaidMats.reduce((s, m) => s + (parseFloat(m.unit_price) || 0) * (parseFloat(m.qty) || 1), 0);
          const grandTotal = subTotal + matTotal;

          if (unpaidSubs.length === 0 && unpaidMats.length === 0) {
            return "Nothing outstanding — you\u2019re all paid up.";
          }

          // Build a text summary for both TTS and display
          const parts = [];
          if (unpaidSubs.length > 0) {
            parts.push(`${unpaidSubs.length} subcontractor payment${unpaidSubs.length !== 1 ? "s" : ""} totalling ${fmtCurrency(subTotal)}`);
          }
          if (unpaidMats.length > 0) {
            parts.push(`${unpaidMats.length} material${unpaidMats.length !== 1 ? "s" : ""} totalling ${fmtCurrency(matTotal)}`);
          }
          const summary = `You owe ${parts.join(" and ")}. Grand total: ${fmtCurrency(grandTotal)}.`;

          pendingWidgetRef.current = {
            type: "unpaid_list",
            data: { subs: unpaidSubs, materials: unpaidMats, subTotal, matTotal, grandTotal }
          };

          return summary;
        }
        case "add_compliance_cert": {
          const { job: jcMatch, error: dwErr } = await findJob(input.customer, input.job_title, "add this certificate to");
          if (dwErr) return dwErr;
          const jc = [jcMatch];
                    const { data, error } = await db.from("compliance_docs").insert({
            job_id: jc[0].id, user_id: user?.id,
            doc_type: input.doc_type || "", doc_number: input.doc_number || "",
            // Postgres rejects empty string in date columns — must be null
            // when the user hasn't given an expiry. Same for issued_date.
            issued_date: input.issued_date || localDate(),
            expiry_date: input.expiry_date || null, notes: input.notes || "",
          }).select().single();
          if (error) return `Failed to add certificate: ${error.message}`;
          pendingWidgetRef.current = { type: "compliance_cert", data: { ...data, customer: jc[0].customer, job_title: jc[0].title || jc[0].type } };
          return `${input.doc_type} certificate logged against ${jc[0].customer}'s job${input.doc_number ? ` (ref ${input.doc_number})` : ""}${input.expiry_date ? `, expires ${input.expiry_date}` : ""}. If you need the signed PDF with test results, open the Certificates tab on the job card.`;
        }
        case "add_variation_order": {
          const { job: jcMatch, error: voErr } = await findJob(input.customer, input.job_title, "add this variation to");
          if (voErr) return voErr;
          const jc = [jcMatch];
                    const amount = parseFloat(input.amount) || 0;
          // Dedup: same job + same description + same amount = duplicate
          const { data: existingVo } = await db.from("variation_orders")
            .select("id").eq("job_id", jc[0].id).eq("user_id", user?.id)
            .ilike("description", input.description || "").eq("amount", amount).limit(1);
          if (existingVo?.length) return ""; // Silent dedup
          const { data, error } = await db.from("variation_orders").insert({
            job_id: jc[0].id, user_id: user?.id,
            vo_number: input.vo_number || `VO-${Date.now().toString().slice(-4)}`,
            description: input.description || "", amount, status: "pending",
          }).select().single();
          if (error) return `Failed to add variation order: ${error.message}`;
          // Bump the job_card's headline value so any UI/report reading
          // job_cards.value shows the new total including variations. Without
          // this the job displays the original value forever even after £2k
          // of variations have been added. get_job_profit works either way
          // (it sums VOs separately) but reports using jobs.value don't.
          // Select-then-update pattern: we need the current value before we
          // can add to it. Fire-and-forget to keep voice response quick.
          if (user?.id) {
            db.from("job_cards")
              .select("value")
              .eq("id", jc[0].id)
              .eq("user_id", user.id)
              .single()
              .then(({ data: curJc, error: readErr }) => {
                if (readErr || !curJc) return;
                const newValue = (parseFloat(curJc.value) || 0) + amount;
                db.from("job_cards")
                  .update({ value: newValue, updated_at: new Date().toISOString() })
                  .eq("id", jc[0].id)
                  .eq("user_id", user.id)
                  .then(({ error: upErr }) => { if (upErr) console.warn("[add_variation_order] job value bump failed:", upErr.message); });
              });
          }
          pendingWidgetRef.current = { type: "variation_order", data: { ...data, customer: jc[0].customer } };
          return `Variation order added to ${jc[0].customer}'s job — ${input.description} — ${fmtCurrency(amount)}.`;
        }
        case "log_daywork": {
          const { job: jcMatch, error: certErr } = await findJob(input.customer, input.job_title, "log daywork to");
          if (certErr) return certErr;
          const jc = [jcMatch];
                    const total = (parseFloat(input.hours) || 0) * (parseFloat(input.rate) || 0);
          const sheetDate = input.date || localDate();
          // Dedup: same job + same date + same total = duplicate
          const { data: existingDw } = await db.from("daywork_sheets")
            .select("id").eq("job_id", jc[0].id).eq("user_id", user?.id)
            .eq("sheet_date", sheetDate).eq("hours", parseFloat(input.hours) || 0).limit(1);
          if (existingDw?.length) return ""; // Silent dedup
          const { data, error } = await db.from("daywork_sheets").insert({
            job_id: jc[0].id, user_id: user?.id,
            sheet_date: input.date || localDate(),
            worker_name: input.worker_name || brand?.ownerName || "",
            hours: parseFloat(input.hours) || 0,
            rate: parseFloat(input.rate) || 0,
            description: input.description || "",
            contractor_name: input.contractor_name || "",
          }).select().single();
          if (error) return `Failed to log daywork: ${error.message}`;
          pendingWidgetRef.current = { type: "daywork_sheet", data: { ...data, customer: jc[0].customer, total } };
          return `Daywork logged for ${jc[0].customer} — ${input.hours}hrs @ ${fmtAmount(input.rate)}/hr = ${fmtCurrency(total)}.`;
        }
        case "send_review_request": {
          const { data: custSearch } = await db.from("customers").select("email,name").eq("user_id", user?.id).ilike("name", `%${input.customer||""}%`).limit(1);
          const email = input.email || custSearch?.[0]?.email;
          if (!email) return `No email found for ${input.customer}. Add their email first or provide it now.`;
          const { data: jc } = await db.from("job_cards").select("id,customer,title,type").eq("user_id", user?.id).ilike("customer", `%${input.customer||""}%`).order("created_at", { ascending: false }).limit(1);
          const platforms = Object.entries(brand||{}).filter(([k,v]) => ["googleReviewUrl","trustpilotUrl","checkatradeUrl","ratedPeopleUrl","myBuilderUrl"].includes(k) && v).map(([k,v]) => ({ name: k.replace("Url","").replace(/([A-Z])/g," $1").trim(), url: v }));
          if (!platforms.length) return `No review platform links set up. Add them in Settings → Business Details first.`;
          const linksHtml = platforms.map(p => `<a href="${p.url}" style="display:inline-block;padding:10px 20px;background:${brand?.accentColor || "#f59e0b"};color:#000;text-decoration:none;border-radius:8px;font-weight:600;font-size:13px;margin:4px 4px 4px 0;">${p.name}</a>`).join(" ");
          const body = buildEmailHTML(brand, {
            heading: "WE'D LOVE YOUR FEEDBACK",
            body: `<p style="font-size:15px;">Hi ${input.customer},</p>
              <p style="color:#555;">Thank you for choosing ${brand?.tradingName || "us"} — we really appreciate your business.</p>
              <p style="color:#555;">If you're happy with the work, we'd be really grateful if you could take a moment to leave us a review. It makes a huge difference to small businesses like ours.</p>
              <div style="margin:20px 0;">${linksHtml}</div>
              <p style="color:#888;font-size:12px;">Thank you — it only takes a minute and helps other customers find us.</p>`,
          });
          try {
            await sendEmailViaConnectedAccount(user?.id, email, `${brand?.tradingName || "Your tradesperson"} — we'd love your feedback`, body).catch(() => {});
          } catch(e) {}
          if (jc?.length) {
            await db.from("review_requests").insert({ user_id: user?.id, job_id: jc[0].id, customer: input.customer, email, platforms: platforms.map(p=>p.name).join(","), sent_at: new Date().toISOString(), created_at: new Date().toISOString() });
          }
          pendingWidgetRef.current = { type: "review_sent", data: { customer: input.customer, email, platforms } };
          return `Review request sent to ${input.customer} at ${email} — ${platforms.length} platform${platforms.length!==1?"s":""} included.`;
        }
        case "get_report": {
          const period = input.period || "this_month";
          const reportType = input.report_type || "summary";
          const now = new Date();
          // UK tax year runs 6 April → 5 April
          const taxStartYr = (now.getMonth() > 3 || (now.getMonth() === 3 && now.getDate() >= 6))
            ? now.getFullYear()
            : now.getFullYear() - 1;
          let fromDate, toDate, label;
          if (period === "this_month") {
            fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
            toDate = now; label = "This Month";
          } else if (period === "last_month") {
            fromDate = new Date(now.getFullYear(), now.getMonth()-1, 1);
            toDate = new Date(now.getFullYear(), now.getMonth(), 0); label = "Last Month";
          } else if (period === "last_3_months") {
            fromDate = new Date(now.getFullYear(), now.getMonth()-3, 1);
            toDate = now; label = "Last 3 Months";
          } else if (period === "last_6_months") {
            fromDate = new Date(now.getFullYear(), now.getMonth()-6, 1);
            toDate = now; label = "Last 6 Months";
          } else if (period === "this_quarter") {
            const qStart = Math.floor(now.getMonth() / 3) * 3;
            fromDate = new Date(now.getFullYear(), qStart, 1);
            toDate = now; label = "This Quarter";
          } else if (period === "last_quarter") {
            const lqStart = Math.floor(now.getMonth() / 3) * 3 - 3;
            fromDate = new Date(now.getFullYear(), lqStart, 1);
            toDate = new Date(now.getFullYear(), lqStart + 3, 0); label = "Last Quarter";
          } else if (period === "this_year") {
            fromDate = new Date(now.getFullYear(), 0, 1);
            toDate = now; label = "This Year";
          } else if (period === "last_year") {
            fromDate = new Date(now.getFullYear()-1, 0, 1);
            toDate = new Date(now.getFullYear()-1, 11, 31); label = "Last Year";
          } else if (period === "tax_year") {
            fromDate = new Date(taxStartYr, 3, 6);
            toDate = now; label = `Tax Year ${String(taxStartYr).slice(-2)}/${String(taxStartYr+1).slice(-2)}`;
          } else if (period === "last_tax_year") {
            fromDate = new Date(taxStartYr-1, 3, 6);
            toDate = new Date(taxStartYr, 3, 5); label = `Tax Year ${String(taxStartYr-1).slice(-2)}/${String(taxStartYr).slice(-2)}`;
          } else {
            fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
            toDate = now; label = "This Month";
          }
          const inPeriod = d => { if (!d) return false; const dt = new Date(d); return dt >= fromDate && dt <= toDate; };
          const periodInvoices = (invoices||[]).filter(i => !i.isQuote && inPeriod(i.created_at || i.date));
          const paidInvoices = periodInvoices.filter(i => i.status === "paid");
          const unpaidInvoices = periodInvoices.filter(i => i.status !== "paid");
          const totalRevenue = paidInvoices.reduce((s,i) => s + (parseFloat(i.amount)||0), 0);
          const outstanding = unpaidInvoices.reduce((s,i) => s + (parseFloat(i.amount)||0), 0);
          const jobsInPeriod = (jobs||[]).filter(j => inPeriod(j.date_obj || j.dateObj));
          const matCost = (materials||[]).filter(m => inPeriod(m.created_at)).reduce((s,m) => s + ((m.unitPrice||0)*(m.qty||1)), 0);

          // ── Non-summary report types: compute a one-shot text answer + open in Reports
          // We don't render bespoke chat widgets for each report — instead the user
          // gets the headline numbers spoken back, plus a button to see the full
          // breakdown in the Reports tab where the existing rich UI lives.
          if (reportType === "vat") {
            const vatPaid = paidInvoices.filter(i => i.vatEnabled && !i.vatZeroRated);
            const outVat = vatPaid.reduce((s,i) => { const g = parseFloat(i.amount||0); const r = parseFloat(i.vatRate||20)/100; return s + g - g/(1+r); }, 0);
            const inVat = (materials||[]).filter(m => inPeriod(m.created_at) && m.vatEnabled).reduce((s,m) => { const net = (m.unitPrice||0)*(m.qty||1); const r = parseFloat(m.vatRate||20)/100; return s + net*r; }, 0);
            const netV = outVat - inVat;
            pendingWidgetRef.current = { type: "report", data: { label: `${label} — VAT`, totalRevenue: outVat, outstanding: inVat, paidCount: vatPaid.length, unpaidCount: 0, jobsCount: 0, matCost: 0, grossProfit: netV, topCustomers: [] } };
            return `${label} VAT: output £${outVat.toFixed(0)}, input £${inVat.toFixed(0)}. Net ${netV >= 0 ? `payable to HMRC: £${netV.toFixed(0)}` : `reclaimable: £${Math.abs(netV).toFixed(0)}`}.`;
          }
          if (reportType === "outstanding") {
            const allOutstanding = (invoices||[]).filter(i => !i.isQuote && ["sent","overdue","due"].includes(i.status));
            const total = allOutstanding.reduce((s,i) => s + (parseFloat(i.amount)||0), 0);
            const aged = allOutstanding.map(i => ({...i, daysOld: Math.floor((Date.now() - new Date(i.created_at || i.date || Date.now()))/86400000)}));
            const over90 = aged.filter(i => i.daysOld > 90).reduce((s,i) => s + (parseFloat(i.amount)||0), 0);
            const over60 = aged.filter(i => i.daysOld > 60 && i.daysOld <= 90).reduce((s,i) => s + (parseFloat(i.amount)||0), 0);
            pendingWidgetRef.current = { type: "report", data: { label: "Outstanding", totalRevenue: total, outstanding: over90, paidCount: 0, unpaidCount: allOutstanding.length, jobsCount: 0, matCost: over60, grossProfit: total - over90 - over60, topCustomers: aged.slice(0,5).map(i => [`${i.customer} (${i.daysOld}d)`, parseFloat(i.amount)||0]) } };
            return `£${total.toFixed(0)} outstanding across ${allOutstanding.length} invoice${allOutstanding.length===1?"":"s"}${over90>0 ? `. £${over90.toFixed(0)} is over 90 days old — worth chasing` : ""}.`;
          }
          if (reportType === "jobprofit") {
            const jobsRanked = (jobs||[])
              .filter(j => j.status === "completed" && inPeriod(j.date_obj || j.dateObj))
              .map(j => {
                const rev = (invoices||[]).filter(i => !i.isQuote && i.status === "paid" && (i.customer||"").toLowerCase() === (j.customer||"").toLowerCase()).reduce((s,i) => s + (parseFloat(i.amount)||0), 0);
                const costs = (materials||[]).filter(m => (m.job||"").toLowerCase().includes((j.customer||"").toLowerCase()) || m.job === j.title).reduce((s,m) => s + ((m.unitPrice||0)*(m.qty||1)), 0);
                return { name: j.customer || j.title || "Unknown", profit: rev - costs };
              })
              .filter(j => j.profit !== 0)
              .sort((a,b) => b.profit - a.profit)
              .slice(0, 5);
            pendingWidgetRef.current = { type: "report", data: { label: `${label} — Top Jobs by Profit`, totalRevenue: jobsRanked.reduce((s,j) => s + Math.max(0,j.profit), 0), outstanding: 0, paidCount: jobsRanked.length, unpaidCount: 0, jobsCount: jobsRanked.length, matCost: 0, grossProfit: jobsRanked.reduce((s,j) => s + j.profit, 0), topCustomers: jobsRanked.map(j => [j.name, j.profit]) } };
            return jobsRanked.length === 0 ? `No completed jobs with revenue/costs in ${label.toLowerCase()}.` : `Top job by profit ${label.toLowerCase()}: ${jobsRanked[0].name} at £${jobsRanked[0].profit.toFixed(0)}. ${jobsRanked.length} ranked overall.`;
          }
          if (reportType === "customers") {
            const byCustomer = paidInvoices.reduce((acc,i) => { acc[i.customer] = (acc[i.customer]||0) + (parseFloat(i.amount)||0); return acc; }, {});
            const top = Object.entries(byCustomer).sort((a,b)=>b[1]-a[1]).slice(0,5);
            pendingWidgetRef.current = { type: "report", data: { label: `${label} — Top Customers`, totalRevenue: top.reduce((s,[,v]) => s + v, 0), outstanding: 0, paidCount: paidInvoices.length, unpaidCount: 0, jobsCount: 0, matCost: 0, grossProfit: 0, topCustomers: top } };
            return top.length === 0 ? `No customer revenue in ${label.toLowerCase()}.` : `Top customer ${label.toLowerCase()}: ${top[0][0]} at £${top[0][1].toFixed(0)}.`;
          }
          if (reportType === "materials") {
            const periodMats = (materials||[]).filter(m => inPeriod(m.created_at));
            const bySupplier = periodMats.reduce((acc,m) => { const s = m.supplier || "Unknown"; acc[s] = (acc[s]||0) + ((m.unitPrice||0)*(m.qty||1)); return acc; }, {});
            const top = Object.entries(bySupplier).sort((a,b)=>b[1]-a[1]).slice(0,5);
            const total = Object.values(bySupplier).reduce((s,v) => s+v, 0);
            pendingWidgetRef.current = { type: "report", data: { label: `${label} — Materials`, totalRevenue: 0, outstanding: 0, paidCount: 0, unpaidCount: 0, jobsCount: 0, matCost: total, grossProfit: -total, topCustomers: top } };
            return total === 0 ? `No materials logged in ${label.toLowerCase()}.` : `£${total.toFixed(0)} on materials ${label.toLowerCase()}${top.length ? `, biggest supplier ${top[0][0]} at £${top[0][1].toFixed(0)}` : ""}.`;
          }
          if (reportType === "cis") {
            const cisPaid = paidInvoices.filter(i => i.cisEnabled);
            const cisG = cisPaid.reduce((s,i) => s + (parseFloat(i.amount)||0), 0);
            const cisD = cisPaid.reduce((s,i) => s + (parseFloat(i.cisDeduction)||0), 0);
            pendingWidgetRef.current = { type: "report", data: { label: `${label} — CIS`, totalRevenue: cisG, outstanding: cisD, paidCount: cisPaid.length, unpaidCount: 0, jobsCount: 0, matCost: 0, grossProfit: cisG - cisD, topCustomers: [] } };
            return cisPaid.length === 0 ? `No CIS invoices in ${label.toLowerCase()}.` : `${label} CIS: £${cisG.toFixed(0)} gross, £${cisD.toFixed(0)} deducted, £${(cisG-cisD).toFixed(0)} net across ${cisPaid.length} invoice${cisPaid.length===1?"":"s"}.`;
          }

          // Default: P&L summary (existing behaviour)
          const reportData = { label, totalRevenue, outstanding, paidCount: paidInvoices.length, unpaidCount: unpaidInvoices.length, jobsCount: jobsInPeriod.length, matCost, grossProfit: totalRevenue - matCost, topCustomers: Object.entries(paidInvoices.reduce((acc,i) => { acc[i.customer]=(acc[i.customer]||0)+(parseFloat(i.amount)||0); return acc; }, {})).sort((a,b)=>b[1]-a[1]).slice(0,5) };
          pendingWidgetRef.current = { type: "report", data: reportData };
          return `Here's your ${label.toLowerCase()} report:`;
        }
        case "list_reminders": {
          const { data } = await db.from("reminders").select("*").eq("user_id", user?.id).eq("done", false).order("fire_at", { ascending: true }).limit(20);
          if (!data?.length) return "No active reminders.";
          pendingWidgetRef.current = { type: "reminder_list", data };
          return `Here are your active reminders:`;
        }
        case "list_enquiries": {
          const list = (enquiries||[]).slice(0,15);
          if (!list.length) return "No enquiries logged.";
          pendingWidgetRef.current = { type: "enquiry_list", data: list };
          return `Here are your enquiries:`;
        }
        case "list_customers": {
          const list = (customers||[]).slice(0,20);
          if (!list.length) return "No customers yet.";
          pendingWidgetRef.current = { type: "customer_list", data: list };
          return `Here are your customers:`;
        }


        case "list_mileage": {
          const { data } = await db.from("mileage_logs").select("*").eq("user_id", user?.id).order("date", { ascending: false }).limit(20);
          if (!data?.length) return "No mileage logs found.";
          const total = data.reduce((s, t) => s + parseFloat(t.miles || 0), 0);
          const value = data.reduce((s, t) => s + parseFloat(t.value || 0), 0);
          pendingWidgetRef.current = { type: "mileage_list", data, total, value };
          return `Here are your recent mileage logs — ${data.length} trip${data.length !== 1 ? "s" : ""}, ${total.toFixed(1)} miles total, ${fmtCurrency(value)} claimable:`;
        }
        case "list_stock": {
          const { data } = await db.from("stock_items").select("*").eq("user_id", user?.id).order("name");
          if (!data?.length) return "No stock items found. Say \"add stock item\" to add one.";
          pendingWidgetRef.current = { type: "stock_list", data };
          return `Here are your stock items:`;
        }
        case "add_stock_item": {
          // Check if item already exists - if so, update quantity rather than duplicate
          const { data: existingStock } = await db.from("stock_items")
            .select("id,name,quantity").eq("user_id", user?.id).ilike("name", input.name).limit(1);
          if (existingStock?.length) {
            const newQty = (parseFloat(existingStock[0].quantity) || 0) + (parseFloat(input.quantity) || 0);
            await db.from("stock_items").update({ quantity: newQty, updated_at: new Date().toISOString() }).eq("id", existingStock[0].id);
            return `${input.name} already in stock — quantity updated to ${newQty} ${input.unit || "units"}.`;
          }
          const { data, error } = await db.from("stock_items").insert({
            user_id: user?.id,
            name: input.name, sku: input.sku || "",
            quantity: parseFloat(input.quantity) || 0,
            unit: input.unit || "unit",
            reorder_level: parseFloat(input.reorder_level) || 0,
            unit_cost: parseFloat(input.unit_cost) || 0,
            location: input.location || "",
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }).select().single();
          if (error) return `Failed to add stock item: ${error.message}`;
          pendingWidgetRef.current = { type: "stock_item_entry", data };
          return `Stock item added: ${data.name} — ${data.quantity} ${data.unit} in stock.`;
        }
        case "delete_stock_item": {
          const { data: found } = await db.from("stock_items").select("id,name").eq("user_id", user?.id).ilike("name", `%${input.name}%`).limit(1);
          if (!found?.length) return `Stock item "${input.name}" not found.`;
          await db.from("stock_items").delete().eq("id", found[0].id);
          return `Stock item "${found[0].name}" deleted.`;
        }
        case "list_rams": {
          const { data } = await db.from("rams_documents").select("id,title,site_address,prepared_by,date,created_at").eq("user_id", user?.id).order("created_at", { ascending: false }).limit(10);
          if (!data?.length) return "No RAMS documents found. Say \"start a RAMS\" to build one.";
          pendingWidgetRef.current = { type: "rams_list", data };
          return `Here are your RAMS documents:`;
        }
        case "send_invoice": {
          const term = (input.customer || input.invoice_id || "").toLowerCase();
          const { data: invRows2 } = await db.from("invoices").select("*").eq("user_id", user?.id).eq("is_quote", false).order("created_at", { ascending: false }).limit(50);
          const stateInvs2 = (invoices || []).filter(i => !i.isQuote);
          const invRows2Mapped = (invRows2 || []).map(r => {
            let parsedLI = r.line_items;
            if (typeof parsedLI === "string") { try { parsedLI = JSON.parse(parsedLI); } catch(e) { parsedLI = null; } }
            const sm = stateInvs2.find(s => s.id === r.id);
            return { ...r, grossAmount: parseFloat(r.gross_amount || r.amount) || 0, lineItems: parsedLI || sm?.lineItems || [], address: r.address || sm?.address || "" };
          });
          const seenIds2 = new Set(invRows2Mapped.map(i => i.id));
          const allInvs = [...invRows2Mapped, ...stateInvs2.filter(i => !seenIds2.has(i.id))];
          const termI = (input.customer || "").toLowerCase();
          let inv = null;
          if (input.invoice_id) inv = allInvs.find(i => (i.id || "").toLowerCase().includes(input.invoice_id.toLowerCase()));
          if (!inv && input.amount) {
            const byC = allInvs.filter(i => (i.customer || "").toLowerCase().includes(termI));
            inv = byC.find(i => Math.abs(parseFloat(i.grossAmount || i.amount || 0) - parseFloat(input.amount)) < 1) || null;
          }
          if (!inv && input.address) {
            inv = allInvs.find(i => (i.address || "").toLowerCase().includes(input.address.toLowerCase()) && (i.customer || "").toLowerCase().includes(termI));
          }
          if (!inv) {
            const custMs = allInvs.filter(i => (i.customer || "").toLowerCase().includes(termI));
            if (custMs.length === 1) { inv = custMs[0]; }
            else if (custMs.length > 1) {
              const list = custMs.map(i => `${i.id} ${fmtCurrency(parseFloat(i.grossAmount || i.amount || 0))}${i.address ? " · " + i.address.split(",")[0] : ""}`).join(", ");
              return `${custMs[0].customer} has ${custMs.length} invoices: ${list}. Which one should I send?`;
            }
          }
          if (!inv) return `No invoice found for "${input.customer || input.invoice_id}".`;
          const { data: custRow2 } = await db.from("customers").select("email").eq("user_id", user?.id).ilike("name", `%${inv.customer}%`).limit(1);
          const email = input.email || custRow2?.[0]?.email || inv.email;
          if (!email) return `No email for ${inv.customer}. Provide their email address.`;
          const subject = `Invoice ${inv.id} from ${brand?.tradingName || ""}`;
          const invAmt = fmtCurrency(parseFloat(inv.grossAmount || inv.amount || 0));
          const invDue = inv.due || "30 days";
          const accent = brand?.accentColor || "#f59e0b";
          const invPortalToken = inv.portalToken || inv.portal_token;
          const invStripeReady = !!brand?.stripeAccountId;
          const invCTA = portalCtaBlock({ token: invPortalToken, isQuote: false, stripeReady: invStripeReady, accent });
          const body = buildEmailHTML(brand, {
            heading: `INVOICE ${inv.id}`,
            showBacs: true,
            invoiceId: inv.id,
            body: `<p style="font-size:15px;">Dear ${inv.customer},</p>
              <p style="color:#555;">Please find your invoice ${inv.id} for <strong>${invAmt}</strong> attached. Payment is due ${invDue}.</p>
              ${invCTA}
              <div style="background:${accent}18;border-radius:6px;padding:16px;margin:16px 0;border-left:4px solid ${accent};">
                <div style="font-size:22px;font-weight:700;color:${accent};">${invAmt}</div>
                <div style="font-size:12px;color:#888;margin-top:4px;">Due: ${invDue}</div>
              </div>
              <p style="color:#555;font-size:13px;">If you have any questions, please don't hesitate to get in touch.</p>`,
          });
          try {
            let invPdfBase64 = null;
            try { invPdfBase64 = await generateInvoicePDFBase64(brand, inv); } catch(pe) { console.warn("PDF gen failed:", pe.message); }
            await sendEmailViaConnectedAccount(user?.id, email, subject, body, invPdfBase64, `Invoice-${inv.id}.pdf`);
            // Promote draft → sent after successful send. Don't demote paid/overdue.
            const curStatus = (inv.status || "").toLowerCase();
            if (curStatus === "draft" || curStatus === "") {
              try {
                await db.from("invoices").update({ status: "sent" }).eq("id", inv.id).eq("user_id", user?.id);
                setInvoices(prev => (prev || []).map(i => i.id === inv.id ? { ...i, status: "sent" } : i));
              } catch(se) { console.warn("Invoice status update failed:", se?.message); }
            }
            pendingWidgetRef.current = { type: "email_sent", data: { to: email, subject, customer: inv.customer, invoice_id: inv.id, amount: inv.grossAmount || inv.amount } };
            return `Invoice ${inv.id} sent to ${inv.customer} at ${email}${invPdfBase64 ? " (PDF attached)" : ""}.`;
          } catch(e) {
            return `Failed to send invoice: ${e.message}`;
          }
        }
        case "send_quote": {
          const term = (input.customer || input.quote_id || "").toLowerCase();
          const { data: qRows } = await db.from("invoices").select("*").eq("user_id", user?.id).eq("is_quote", true).order("created_at", { ascending: false }).limit(50);
          const allQ = qRows || (invoices || []).filter(i => i.isQuote);
          const termQ = (input.customer || "").toLowerCase();
          let quote = null;
          if (input.quote_id) quote = allQ.find(i => (i.id || "").toLowerCase().includes(input.quote_id.toLowerCase()));
          if (!quote && input.amount) {
            const byC = allQ.filter(i => (i.customer || "").toLowerCase().includes(termQ));
            quote = byC.find(i => Math.abs(parseFloat(i.grossAmount || i.amount || 0) - parseFloat(input.amount)) < 1) || null;
          }
          if (!quote && input.address) {
            quote = allQ.find(i => (i.address || "").toLowerCase().includes(input.address.toLowerCase()) && (i.customer || "").toLowerCase().includes(termQ));
          }
          if (!quote) {
            const custMs = allQ.filter(i => (i.customer || "").toLowerCase().includes(termQ));
            if (custMs.length === 1) { quote = custMs[0]; }
            else if (custMs.length > 1) {
              const list = custMs.map(i => `${i.id} ${fmtCurrency(parseFloat(i.grossAmount || i.amount || 0))}${i.address ? " · " + i.address.split(",")[0] : ""}`).join(", ");
              return `${custMs[0].customer} has ${custMs.length} quotes: ${list}. Which one should I send?`;
            }
          }
          if (!quote) return `No quote found for "${input.customer || input.quote_id}".`;
          const { data: custRowQ } = await db.from("customers").select("email").eq("user_id", user?.id).ilike("name", `%${quote.customer}%`).limit(1);
          const email = input.email || custRowQ?.[0]?.email || quote.email;
          if (!email) return `No email for ${quote.customer}. Provide their email address.`;
          const subject = `Quote ${quote.id} from ${brand?.tradingName || ""}`;
          const quoteAmt = fmtCurrency(parseFloat(quote.grossAmount || quote.amount || 0));
          const accent = brand?.accentColor || "#f59e0b";
          const quotePortalToken = quote.portalToken || quote.portal_token;
          const quoteCTA = portalCtaBlock({ token: quotePortalToken, isQuote: true, stripeReady: false, accent });
          const body = buildEmailHTML(brand, {
            heading: `QUOTE ${quote.id}`,
            body: `<p style="font-size:15px;">Dear ${quote.customer},</p>
              <p style="color:#555;">Thank you for your enquiry. Please find your quote ${quote.id} for <strong>${quoteAmt}</strong> attached.</p>
              ${quoteCTA}
              <div style="background:${accent}18;border-radius:6px;padding:16px;margin:16px 0;border-left:4px solid ${accent};">
                <div style="font-size:22px;font-weight:700;color:${accent};">${quoteAmt}</div>
                <div style="font-size:12px;color:#888;margin-top:4px;">Valid for 30 days</div>
              </div>
              <p style="color:#555;font-size:13px;">This quote is valid for 30 days from the date of issue. If you would like to go ahead, or have any questions, please don't hesitate to get in touch.</p>`,
          });
          try {
            let quotePdfBase64 = null;
            try {
              const quoteForPdf = { ...quote, grossAmount: quote.gross_amount || quote.grossAmount || quote.amount, lineItems: quote.line_items || quote.lineItems || [], vatEnabled: quote.vat_enabled || quote.vatEnabled, paymentMethod: quote.payment_method || quote.paymentMethod || "both", isQuote: true };
              quotePdfBase64 = await generateInvoicePDFBase64(brand, quoteForPdf);
            } catch(pe) { console.warn("PDF gen failed:", pe.message); }
            await sendEmailViaConnectedAccount(user?.id, email, subject, body, quotePdfBase64, `Quote-${quote.id}.pdf`);
            // Promote draft → sent after successful send. Don't overwrite accepted/declined.
            const curQStatus = (quote.status || "").toLowerCase();
            if (curQStatus === "draft" || curQStatus === "") {
              try {
                await db.from("invoices").update({ status: "sent" }).eq("id", quote.id).eq("user_id", user?.id);
                setInvoices(prev => (prev || []).map(i => i.id === quote.id ? { ...i, status: "sent" } : i));
              } catch(se) { console.warn("Quote status update failed:", se?.message); }
            }
            pendingWidgetRef.current = { type: "email_sent", data: { to: email, subject, customer: quote.customer, invoice_id: quote.id, amount: quote.grossAmount || quote.amount, isQuote: true } };
            return `Quote ${quote.id} sent to ${quote.customer} at ${email}${quotePdfBase64 ? " (PDF attached)" : ""}.`;
          } catch(e) {
            return `Failed to send quote: ${e.message}`;
          }
        }
        case "chase_invoice": {
          const term = (input.customer || input.invoice_id || "").toLowerCase();
          // Query Supabase directly, with React state as fallback
          // (invoices may be indexed by company_id not user_id depending on account setup)
          const { data: invRows } = await db.from("invoices")
            .select("*")
            .eq("user_id", user?.id).eq("is_quote", false).neq("status", "paid")
            .order("created_at", { ascending: false }).limit(50);
          // Build search pool: Supabase results + React state (deduped by id)
          const stateInvs = (invoices || []).filter(i => !i.isQuote && i.status !== "paid");
          const dbInvs = (invRows || []).map(r => {
            // Parse line_items from JSON string if stored that way
            let parsedLineItems = r.line_items;
            if (typeof parsedLineItems === "string") {
              try { parsedLineItems = JSON.parse(parsedLineItems); } catch(e) { parsedLineItems = null; }
            }
            // Merge React state lineItems if DB doesn't have them
            const stateMatch = (invoices || []).find(s => s.id === r.id);
            return {
              ...r,
              grossAmount: parseFloat(r.gross_amount || r.amount) || 0,
              lineItems: parsedLineItems || stateMatch?.lineItems || [],
              address: r.address || stateMatch?.address || "",
            };
          });
          const seenIds = new Set(dbInvs.map(i => i.id));
          const all = [...dbInvs, ...stateInvs.filter(i => !seenIds.has(i.id))];
          // Match: invoice_id > amount > address > customer only (ask if ambiguous)
          let inv = null;
          if (input.invoice_id) {
            inv = all.find(i => (i.id || "").toLowerCase().includes(input.invoice_id.toLowerCase()));
          }
          if (!inv && input.amount) {
            const byC = all.filter(i => (i.customer || "").toLowerCase().includes(term));
            // Exact match only — if no exact match, fall through to ask which one
            inv = byC.find(i => Math.abs(parseFloat(i.grossAmount || i.amount || 0) - parseFloat(input.amount)) < 1) || null;
          }
          if (!inv && input.address) {
            inv = all.find(i => (i.address || "").toLowerCase().includes(input.address.toLowerCase()) && (i.customer || "").toLowerCase().includes(term));
          }
          if (!inv) {
            const custInvs = all.filter(i => (i.customer || "").toLowerCase().includes(term));
            if (custInvs.length === 1) {
              inv = custInvs[0];
            } else if (custInvs.length > 1) {
              const list = custInvs.map(i => `${i.id} ${fmtCurrency(parseFloat(i.grossAmount || i.amount || 0))}${i.address ? " · " + i.address.split(",")[0] : ""}`).join(", ");
              return `${custInvs[0].customer} has ${custInvs.length} unpaid invoices: ${list}. Which one should I chase?`;
            }
          }
          if (!inv) return `No unpaid invoice found for "${input.customer || input.invoice_id}". Check the Invoices tab — it may already be marked paid.`;
          // Get email: explicit input → customer record → invoice email field
          const { data: custRows } = await db.from("customers")
            .select("email").eq("user_id", user?.id).ilike("name", `%${inv.customer}%`).limit(1);
          const email = input.email || custRows?.[0]?.email || inv.email;
          if (!email) return `No email on file for ${inv.customer}. Say their email address and I'll send the chase.`;
          const chaseResult = await chaseInvoiceSend(inv, email, { showWidget: true });
          if (!chaseResult.ok) return chaseResult.message;
          const toneLabel = chaseResult.chaseNum <= 1 ? "Gentle reminder" : chaseResult.chaseNum === 2 ? "Firm follow-up" : "Final notice";
          return `${toneLabel} sent to ${inv.customer} at ${email} for invoice ${inv.id} (${fmtCurrency(parseFloat(inv.grossAmount || inv.amount || 0))})${chaseResult.hasPdf ? " (PDF attached)" : ""}. This is chase #${chaseResult.chaseNum}.`;
        }
        case "create_invoice_from_job": {
          const term = (input.customer || input.job_title || "").toLowerCase();
          const { data: jcList } = await db.from("job_cards").select("*").eq("user_id", user?.id).or(`customer.ilike.%${term}%,title.ilike.%${term}%`).order("created_at", { ascending: false }).limit(1);
          const jc = jcList?.[0];
          if (!jc) return `Couldn't find a job card for "${input.customer || input.job_title}".`;
          const { data: timeLogs } = await db.from("time_logs").select("*").eq("job_id", jc.id);
          const { data: mats } = await db.from("materials").select("*").eq("job_id", jc.id);
          const lineItems = [];
          if (timeLogs?.length) {
            timeLogs.forEach(t => {
              const desc = t.labour_type === "day_rate" ? `Labour — ${t.days} days @ ${fmtAmount(t.rate)}/day` : t.labour_type === "price" ? "Labour (fixed price)" : `Labour — ${t.hours}hrs @ ${fmtAmount(t.rate)}/hr`;
              lineItems.push({ description: desc, amount: parseFloat(t.total || (t.hours * t.rate) || 0) });
            });
          }
          if (mats?.length) {
            mats.forEach(m => lineItems.push({ description: m.item + (m.qty > 1 ? ` x${m.qty}` : ""), amount: parseFloat((m.unitPrice || 0) * (m.qty || 1)) }));
          }
          if (!lineItems.length) lineItems.push({ description: jc.title || jc.type || "Work carried out", amount: parseFloat(jc.value || 0) });
          const total = lineItems.reduce((s, l) => s + l.amount, 0);
          const invNum = "INV-" + String(((invoices || []).length + 1)).padStart(3, "0");
          const newInv = { id: invNum, customer: jc.customer, address: jc.address || "", email: "", amount: total, grossAmount: total, status: "draft", lineItems, jobRef: String(jc.id), isQuote: false, vatEnabled: brand?.vatEnabled || false, vatRate: brand?.vatRate || 20, due: "30 days", date: new Date().toLocaleDateString("en-GB") };
          setInvoices(prev => [newInv, ...(prev || [])]);
          // Link the invoice back to the source job card so reverse lookups
          // ("which invoice came from this job?") work and the job appears in
          // the right state. Without this the relationship is one-way only.
          if (user?.id && jc.id) {
            db.from("job_cards")
              .update({ invoice_id: invNum, status: jc.status === "complete" ? jc.status : "invoiced" })
              .eq("id", jc.id)
              .eq("user_id", user.id)
              .then(({ error }) => { if (error) console.warn("[create_invoice_from_job] job_card link failed:", error.message); });
          }
          pendingWidgetRef.current = { type: "invoice", data: newInv };
          return `Invoice ${invNum} created from ${jc.customer}'s job card — ${lineItems.length} line item${lineItems.length !== 1 ? "s" : ""}, total ${fmtCurrency(total)}. Review and send when ready.`;
        }
        case "add_stage_payment": {
          const term = (input.customer || input.job_title || "").toLowerCase();
          const { data: jcList } = await db.from("job_cards").select("id,customer,title,type,value").eq("user_id", user?.id).or(`customer.ilike.%${term}%,title.ilike.%${term}%`).order("created_at", { ascending: false }).limit(1);
          const jc = jcList?.[0];
          if (!jc) return `Couldn't find a job card for "${input.customer || input.job_title}".`;
          const stages = input.stages ? JSON.parse(input.stages) : [
            { label: "Deposit", type: "pct", value: "30" },
            { label: "First Fix", type: "pct", value: "40" },
            { label: "Completion", type: "pct", value: "30" },
          ];
          const jobValue = parseFloat(jc.value) || 0;
          const stagesWithAmounts = stages.map(s => ({
            ...s,
            amount: s.type === "pct" ? parseFloat(((jobValue * parseFloat(s.value)) / 100).toFixed(2)) : parseFloat(s.value),
          }));
          const { error } = await db.from("job_cards").update({ stage_payments: JSON.stringify(stagesWithAmounts) }).eq("id", jc.id);
          if (error) return `Failed to save stage payments: ${error.message}`;
          pendingWidgetRef.current = { type: "stage_payments", data: { customer: jc.customer, jobValue, stages: stagesWithAmounts } };
          return `Stage payments set for ${jc.customer} — ${stagesWithAmounts.length} stages totalling ${fmtCurrency(stagesWithAmounts.reduce((s,st) => s + st.amount, 0))}.`;
        }
        case "list_inbox_actions": {
          try {
            const res = await fetch(`/api/email/actions?userId=${user?.id}&status=pending`);
            const data = await res.json();
            const actions = data.actions || [];
            if (!actions.length) return "No pending inbox actions right now.";
            pendingWidgetRef.current = { type: "inbox_actions", data: actions };
            return `You have ${actions.length} pending action${actions.length !== 1 ? "s" : ""} from your inbox:`;
          } catch(e) {
            return `Couldn't load inbox actions: ${e.message}`;
          }
        }
        case "approve_inbox_action": {
          try {
            const res = await fetch(`/api/email/actions?userId=${user?.id}&status=pending`);
            const data = await res.json();
            const actions = data.actions || [];
            const action = actions.find(a => a.id === input.action_id || (a.email_subject || "").toLowerCase().includes((input.description || "").toLowerCase()));
            if (!action) return `Couldn't find that action. Say "show inbox actions" to see what's pending.`;

            // Fetch email connection so reply emails go out via the user's own inbox
            const { data: conn } = await window._supabase
              .from("email_connections")
              .select("*")
              .eq("user_id", user.id)
              .maybeSingle();

            // Execute the real dispatch — create job, send reply, parse PDF, etc.
            // sendPush omitted on purpose: the user triggered this by voice, they
            // don't need a push notification on the same device.
            await executeEmailAction(action, {
              user, brand, connection: conn, customers, invoices,
              setCustomers, setJobs, setInvoices, setMaterials, setEnquiries,
            });

            // Flip the DB status
            await fetch("/api/email/actions/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actionId: action.id }) });

            // Teach the email classifier what we just approved
            await updateEmailAIContext(action, user);

            // Tell the Inbox tab (and any other listeners) the pending list changed
            window.dispatchEvent(new CustomEvent("trade-pa-inbox-refreshed"));

            return `Action approved — "${action.action_description || action.action_type}" from ${action.email_from || "email"}. Done.`;
          } catch(e) {
            return `Failed to approve: ${e.message}`;
          }
        }
        case "reject_inbox_action": {
          try {
            // Fetch the action so we can log proper feedback for classifier learning
            const res = await fetch(`/api/email/actions?userId=${user?.id}&status=pending`);
            const data = await res.json();
            const action = (data.actions || []).find(a => a.id === input.action_id);

            // Log feedback via shared helper — reason must match one of the 5
            // DISMISS_REASONS IDs in InboxView. Voice defaults to "not_relevant"
            // if no reason was inferred from the user's utterance.
            if (action) {
              await logEmailFeedback(user, action, input.reason || "not_relevant");
            }

            await fetch("/api/email/actions/reject", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actionId: input.action_id }) });

            window.dispatchEvent(new CustomEvent("trade-pa-inbox-refreshed"));

            return `Action dismissed.`;
          } catch(e) {
            return `Failed to reject: ${e.message}`;
          }
        }
        case "generate_subcontractor_statement": {
          const { data: subs } = await tmReadSubs(db, user?.id, { nameLike: input.name || "", limit: 1 });
          const sub = subs?.[0];
          if (!sub) return `Subcontractor "${input.name}" not found.`;
          const month = input.month || localMonth();
          const { data: payments } = await db.from("subcontractor_payments").select("*").eq("user_id", user?.id).eq("subcontractor_id", sub.id).gte("date", month + "-01").lte("date", month + "-31");
          if (!payments?.length) return `No payments found for ${sub.name} in ${month}.`;
          const totalGross = payments.reduce((s,p) => s + parseFloat(p.gross||0), 0);
          const totalDed = payments.reduce((s,p) => s + parseFloat(p.deduction||0), 0);
          const totalNet = payments.reduce((s,p) => s + parseFloat(p.net||0), 0);
          pendingWidgetRef.current = { type: "subcontractor_statement", data: { sub, payments, month, totalGross, totalDed, totalNet } };
          return `Here's the CIS statement for ${sub.name} — ${month}: gross ${fmtCurrency(totalGross)}, deduction ${fmtCurrency(totalDed)}, net ${fmtCurrency(totalNet)}.`;
        }


        case "update_job_card": {
          const term = (input.customer || input.title || "").toLowerCase();
          const { data: found } = await db.from("job_cards")
            .select("*").eq("user_id", user?.id)
            .or(`customer.ilike.%${term}%,title.ilike.%${term}%,type.ilike.%${term}%`)
            .order("created_at", { ascending: false }).limit(1);
          const job = found?.[0];
          if (!job) return `Couldn't find a job card for "${input.customer || input.title}".`;
          const updates = {};
          if (input.new_title !== undefined) updates.title = input.new_title;
          if (input.new_customer !== undefined) updates.customer = input.new_customer;
          if (input.new_address !== undefined) updates.address = input.new_address;
          if (input.new_value !== undefined) updates.value = parseFloat(input.new_value) || 0;
          if (input.new_status !== undefined) updates.status = input.new_status;
          if (input.new_notes !== undefined) updates.notes = input.new_notes;
          if (input.new_scope !== undefined) updates.scope_of_work = input.new_scope;
          if (input.new_po_number !== undefined) updates.po_number = input.new_po_number;
          if (!Object.keys(updates).length) return "No changes specified. Tell me what to update.";
          updates.updated_at = new Date().toISOString();
          const { data: updated, error } = await db.from("job_cards").update(updates).eq("id", job.id).select("*").single();
          if (error) return `Failed to update job card: ${error.message}`;
          // Re-fetch all related data
          const [notes, timeLogs, materials, drawings, vos, docs] = await Promise.all([
            db.from("job_notes").select("*").eq("job_id", job.id).order("created_at", { ascending: false }),
            db.from("time_logs").select("*").eq("job_id", job.id),
            db.from("materials").select("*").eq("job_id", job.id),
            db.from("job_drawings").select("id,filename,created_at").eq("job_id", job.id),
            db.from("variation_orders").select("*").eq("job_id", job.id),
            db.from("compliance_docs").select("*").eq("job_id", job.id),
          ]);
          pendingWidgetRef.current = {
            type: "job_full",
            data: { ...updated, jobNotes: notes.data || [], timeLogs: timeLogs.data || [], linkedMaterials: materials.data || [], drawings: drawings.data || [], vos: vos.data || [], docs: docs.data || [] }
          };
          const changed = Object.keys(updates).filter(k => k !== "updated_at").map(k => k.replace("_", " ")).join(", ");
          return `Job card updated — ${changed} changed. Here's the updated card:`;
        }
        case "update_invoice": {
          const term = (input.customer || input.invoice_id || "").toLowerCase();
          if (!term) return "Please specify which invoice to update — provide the customer name or invoice ID.";
          // Query Supabase directly to avoid stale closure
          const { data: invSearchRows } = await db.from("invoices")
            .select("*").eq("user_id", user?.id).eq("is_quote", false)
            .order("created_at", { ascending: false }).limit(50);
          const searchPool = invSearchRows || (invoices || []).filter(i => !i.isQuote);
          const inv = searchPool.find(i =>
            (i.id || "").toLowerCase().includes(term) ||
            (i.customer || "").toLowerCase().includes(term)
          );
          if (!inv) return `Couldn't find an invoice for "${input.customer || input.invoice_id}". Try: list_invoices to see all invoices.`;
          const updates = { ...inv };
          if (input.new_customer !== undefined) updates.customer = input.new_customer;
          if (input.new_amount !== undefined) { updates.amount = parseFloat(input.new_amount); updates.grossAmount = parseFloat(input.new_amount); }
          if (input.new_due !== undefined) updates.due = input.new_due;
          if (input.new_status !== undefined) updates.status = input.new_status;
          if (input.new_address !== undefined) updates.address = input.new_address;
          if (input.new_payment_method !== undefined) updates.paymentMethod = input.new_payment_method;
          if (input.new_vat_enabled !== undefined) updates.vatEnabled = input.new_vat_enabled === true || input.new_vat_enabled === "true";
          if (input.add_line_item !== undefined) {
            const parts = input.add_line_item.split("|");
            const newLine = { description: parts[0].trim(), amount: parseFloat(parts[1]) || 0 };
            updates.lineItems = [...(inv.lineItems || []), newLine];
            updates.amount = updates.lineItems.reduce((s, l) => s + l.amount, 0);
            updates.grossAmount = updates.amount;
          }
          if (Array.isArray(input.add_line_items) && input.add_line_items.length) {
            // Preferred path — one or more line items as structured objects
            const newLines = input.add_line_items
              .filter(li => li && li.description && typeof li.amount === "number")
              .map(li => ({ description: String(li.description).trim(), amount: parseFloat(li.amount) || 0 }));
            if (newLines.length) {
              updates.lineItems = [...(updates.lineItems || inv.lineItems || []), ...newLines];
              updates.amount = updates.lineItems.reduce((s, l) => s + l.amount, 0);
              updates.grossAmount = updates.amount;
            }
          }
          if (input.remove_line_item !== undefined) {
            const removeIdx = parseInt(input.remove_line_item) - 1;
            updates.lineItems = (inv.lineItems || []).filter((_, i) => i !== removeIdx);
            updates.amount = updates.lineItems.reduce((s, l) => s + l.amount, 0);
            updates.grossAmount = updates.amount;
          }
          setInvoices(prev => (prev || []).map(i => i.id === inv.id ? updates : i));
          pendingWidgetRef.current = { type: "invoice", data: updates };
          return `Invoice ${inv.id} updated. Here's the updated invoice:`;
        }


        case "list_quotes": {
          const { data: rows } = await db.from("invoices")
            .select("id, customer, amount, gross_amount, status, due, is_quote, created_at")
            .eq("user_id", user?.id).eq("is_quote", true)
            .order("created_at", { ascending: false }).limit(20);
          const fresh = (rows || []).map(r => ({ id: r.id, customer: r.customer, amount: parseFloat(r.amount) || 0, grossAmount: parseFloat(r.gross_amount || r.amount) || 0, status: (r.status || "").toLowerCase().trim(), due: r.due || "", isQuote: true }));
          if (!fresh.length) return "No quotes found.";
          pendingWidgetRef.current = { type: "invoice_list", data: fresh.slice(0, 15) };
          return `Here are your quotes:`;
        }
        case "delete_expense": {
          const { data: found } = await db.from("expenses").select("id,description").eq("user_id", user?.id).ilike("description", `%${input.description || ""}%`).order("exp_date", { ascending: false }).limit(1);
          if (!found?.length) return `Expense not found.`;
          await db.from("expenses").delete().eq("id", found[0].id);
          return `Expense "${found[0].description}" deleted.`;
        }
        case "delete_cis_statement": {
          const { data: found } = await db.from("cis_statements").select("id,contractor_name,tax_month").eq("user_id", user?.id).is("archived_at", null).ilike("contractor_name", `%${input.contractor_name || ""}%`).order("tax_month", { ascending: false }).limit(1);
          if (!found?.length) return `CIS statement not found.`;
          // Soft-delete only — keeps the row for HMRC's 6-year record retention.
          // Hard-delete would create a compliance hole if the user needed it
          // back at year-end or for an audit.
          const { error: arcErr } = await db.from("cis_statements").update({ archived_at: new Date().toISOString() }).eq("id", found[0].id).eq("user_id", user?.id);
          if (arcErr) return `Failed to archive CIS statement: ${arcErr.message}`;
          return `CIS statement for ${found[0].contractor_name} (${found[0].tax_month?.slice(0,7)}) removed from your active list. Archived copy retained for HMRC records.`;
        }
        case "add_worker": {
          // Dedup — match add_subcontractor's pattern. If an archived worker
          // exists with the same name, silently reactivate + update. Otherwise
          // signal duplicate to stop double-adds from voice (e.g. "add John
          // Smith as a worker" said twice in a row).
          const existingW = await tmReadWorkers(db, user?.id, { nameLike: input.name, limit: 1 });
          if (existingW.data?.length) {
            const hit = existingW.data[0];
            if (hit.active === false) {
              const reactivateType = input.type || "subcontractor";
              const reactivateCisRate = parseInt(input.cis_rate) || (input.utr ? 20 : 30);
              // Session 3: direct update to team_members. Map legacy "type"
              // back to engagement; only set cis_rate for self-employed.
              const reactivateEngagement = reactivateType === "employed" ? "employed" : "self_employed";
              const { data: tmWr, error: wrErr } = await db.from("team_members").update({
                active: true,
                archived_at: null,
                engagement: reactivateEngagement,
                role: input.role || undefined,
                email: input.email || undefined,
                phone: input.phone || undefined,
                day_rate: parseFloat(input.day_rate || 0) || undefined,
                hourly_rate: parseFloat(input.hourly_rate || 0) || undefined,
                utr: input.utr || undefined,
                cis_rate: reactivateEngagement === "self_employed" ? reactivateCisRate : null,
                ni_number: input.ni_number || undefined,
              }).eq("id", hit.id).eq("user_id", user?.id).select().single();
              if (wrErr) return `Failed to reactivate worker: ${wrErr.message}`;
              const wr = {
                id: tmWr.id, name: tmWr.name,
                type: tmWr.engagement === "employed" ? "employed" : "subcontractor",
                role: tmWr.role,
              };
              return `${wr.name} reactivated${input.role ? ` as ${input.role}` : ""}. Past time logs preserved.`;
            }
            return `${input.name} is already in your workers.`;
          }
          // Cross-table check: if this name is already in subcontractors
          // (active OR archived), block the insert to avoid two records for
          // the same person. Mirrors within-table dedup behaviour which also
          // catches archived rows. Temporary until tables are unified — see
          // docs/migrations/workers-subs-unification.md.
          const crossS = await tmReadSubs(db, user?.id, { nameLike: input.name, limit: 1 });
          if (crossS.data?.length) {
            const s = crossS.data[0];
            if (s.active === false) {
              return `${s.name} is in your subcontractors list but archived. Restore them in Subcontractors if it's the same person, or use a different name to add as a separate worker.`;
            }
            return `${s.name} is already in your subcontractors list. Open Subcontractors → ${s.name} to update their details, or remove them from subcontractors first if you want to add them as a worker.`;
          }
          // Same HMRC rule as add_subcontractor for the CIS default
          const workerDefaultCis = input.utr ? 20 : 30;
          // Session 3: direct write to team_members. Map "type" → engagement;
          // ni_number applies for employed; cis_rate for self_employed.
          const newEngagement = input.type === "employed" ? "employed" : "self_employed";
          const { data: newTm, error: wErr } = await db.from("team_members").insert({
            user_id: user?.id,
            name: input.name,
            engagement: newEngagement,
            role: input.role || null,
            email: input.email || null,
            phone: input.phone || null,
            day_rate: parseFloat(input.day_rate || 0) || null,
            hourly_rate: parseFloat(input.hourly_rate || 0) || null,
            utr: input.utr || null,
            cis_rate: newEngagement === "self_employed" ? (parseInt(input.cis_rate) || workerDefaultCis) : null,
            ni_number: input.ni_number || null,
            active: true,
            source_table: "workers",
          }).select().single();
          if (wErr) return `Failed to add worker: ${wErr.message}`;
          const newWorker = { id: newTm.id, name: newTm.name };
          const workerType = input.type === "employed" ? "employed staff member" : "subcontractor";
          const utrNote = (input.type !== "employed") && !input.utr && !input.cis_rate ? " No UTR — defaulted to 30% CIS per HMRC rules." : "";
          return `Worker added: ${input.name}${input.role ? ` (${input.role})` : ""} as a ${workerType}${input.day_rate ? ` — day rate ${fmtAmount(input.day_rate)}` : ""}${input.hourly_rate ? ` — hourly rate ${fmtAmount(input.hourly_rate)}` : ""}.${utrNote}`;
        }
        case "list_workers": {
          const { data: workerList } = await tmReadWorkers(db, user?.id, { activeOnly: true });
          const sorted = (workerList || []).slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""));
          const filtered = sorted.filter(w =>
            !input.type || input.type === "all" || w.type === input.type
          );
          if (!filtered.length) return `No workers found. Add workers by saying "add a worker".`;
          const workerData = filtered.map(w => ({
            name: w.name, type: w.type, role: w.role || "",
            day_rate: w.day_rate, hourly_rate: w.hourly_rate,
            email: w.email, phone: w.phone, utr: w.utr, cis_rate: w.cis_rate,
          }));
          pendingWidgetRef.current = { type: "worker_list", data: workerData };
          return `Here are your ${filtered.length} worker${filtered.length !== 1 ? "s" : ""}:`;
        }
        case "assign_worker_to_job": {
          // Find worker
          const { data: wMatches } = await tmReadWorkers(db, user?.id, { nameLike: input.worker_name, limit: 1 });
          if (!wMatches?.length) return `Worker "${input.worker_name}" not found. Add them first with "add a worker".`;
          const worker = wMatches[0];
          // Find job
          const { job: assignJob, error: assignErr } = await findJob(input.customer, input.job_title, "assign this worker to");
          if (assignErr) return assignErr;
          // Check not already assigned
          const { data: existing } = await db.from("job_workers")
            .select("id").eq("user_id", user?.id).eq("job_id", assignJob.id).eq("worker_id", worker.id).limit(1);
          if (existing?.length) return `${worker.name} is already assigned to ${assignJob.customer} — ${assignJob.title || assignJob.type}.`;
          const { error: jwErr } = await db.from("job_workers").insert({
            user_id: user?.id, job_id: assignJob.id, worker_id: worker.id,
            role: input.role || worker.role || "", rate: input.rate || worker.day_rate || null,
            rate_type: input.rate_type || "day_rate",
            start_date: input.start_date || localDate(),
            created_at: new Date().toISOString(),
          });
          if (jwErr) return `Failed to assign worker: ${jwErr.message}`;
          return `${worker.name} assigned to ${assignJob.customer} — ${assignJob.title || assignJob.type}${input.rate ? ` at ${fmtAmount(input.rate)}/${input.rate_type === "hourly" ? "hr" : "day"}` : ""}.`;
        }
        case "log_worker_time": {
          // Find worker — check workers table first, then subcontractors
          const { data: wtMatches } = await tmReadWorkers(db, user?.id, { nameLike: input.worker_name, limit: 1 });
          if (!wtMatches?.length) {
            // Not in workers — check subcontractors table
            const { data: subCheck } = await tmReadSubs(db, user?.id, { nameLike: input.worker_name, limit: 1 });
            if (subCheck?.length) {
              // Found as subcontractor — log via subcontractor_payments instead
              const sub = subCheck[0];
              const spType = input.rate_type || (input.days ? "day_rate" : input.total ? "price_work" : "hourly");
              let spGross = parseFloat(input.total || 0);
              if (spType === "day_rate" && input.days) spGross = parseFloat(input.days) * parseFloat(input.rate || 0);
              if (spType === "hourly" && input.hours) spGross = parseFloat(input.hours) * parseFloat(input.rate || 0);
              if (!spGross) return `How much is ${sub.name} being paid? Give me an amount, days × rate, or hours × rate.`;
              const spDate = input.date || localDate();
              const spDeduction = parseFloat(((spGross * (sub.cis_rate || 0)) / 100).toFixed(2));
              const spNet = parseFloat((spGross - spDeduction).toFixed(2));
              let spJobId = null, spJobRef = "";
              if (input.customer || input.job_title) {
                const { job: spJob } = await findJob(input.customer || "", input.job_title || "");
                if (spJob) { spJobId = spJob.id; spJobRef = `${spJob.customer} — ${spJob.title || spJob.type || ""}`.trim(); }
              }
              const { error: spErr } = await db.from("subcontractor_payments").insert({
                user_id: user?.id, subcontractor_id: sub.id,
                date: spDate, gross: spGross, deduction: spDeduction, net: spNet,
                cis_rate: sub.cis_rate || 0, payment_type: spType,
                days: parseFloat(input.days) || null, hours: parseFloat(input.hours) || null,
                rate: parseFloat(input.rate) || null,
                job_id: spJobId, job_ref: spJobRef,
                description: input.description || "",
                created_at: new Date().toISOString(),
              });
              if (spErr) return `Failed to log payment: ${spErr.message}`;
              return `Labour logged for ${sub.name} (subcontractor): ${fmtCurrency(spGross)}${spJobRef ? ` → ${spJobRef}` : ""}.`;
            }
            return `"${input.worker_name}" not found. Add them with "add a worker" or "add a subcontractor" first.`;
          }
          const wtWorker = wtMatches[0];
          // Find job
          const { job: wtJob, error: wtErr } = await findJob(input.customer, input.job_title, "log time to");
          if (wtErr) return wtErr;
          const wtType = input.rate_type || (input.days ? "day_rate" : "hourly");
          let wtHours = 0, wtTotal = 0;
          if (wtType === "hourly") { wtHours = parseFloat(input.hours || 0); wtTotal = wtHours * parseFloat(input.rate || wtWorker.hourly_rate || 0); }
          else if (wtType === "day_rate") { wtHours = parseFloat(input.days || 0) * 8; wtTotal = parseFloat(input.days || 0) * parseFloat(input.rate || wtWorker.day_rate || 0); }
          else { wtTotal = parseFloat(input.total || 0); }
          const today = localDate();
          const { error: wtLogErr } = await db.from("time_logs").insert({
            job_id: wtJob.id, user_id: user?.id,
            log_date: input.date || today, labour_type: wtType,
            hours: wtHours, days: input.days || null,
            rate: input.rate || 0, total: wtTotal,
            description: input.description || `${wtWorker.name} — ${wtType}`,
            worker: wtWorker.name,
          });
          if (wtLogErr) return `Failed to log time: ${wtLogErr.message}`;
          const wtLabel = wtType === "hourly" ? `${input.hours}hrs @ ${fmtAmount(input.rate)}/hr` : wtType === "day_rate" ? `${input.days} days @ ${fmtAmount(input.rate)}/day` : `Price work ${fmtAmount(input.total)}`;
          return `Time logged for ${wtWorker.name} on ${wtJob.customer} — ${wtJob.title || wtJob.type}: ${wtLabel} = ${fmtCurrency(wtTotal)}.`;
        }
        case "add_worker_document": {
          const { data: wdMatches } = await tmReadWorkers(db, user?.id, { nameLike: input.worker_name, limit: 1 });
          if (!wdMatches?.length) return `Worker "${input.worker_name}" not found. Add them first.`;
          const wdWorker = wdMatches[0];
          const { error: wdErr } = await db.from("worker_documents").insert({
            user_id: user?.id, worker_id: wdWorker.id,
            doc_type: input.doc_type, doc_number: input.doc_number || "",
            issued_date: input.issued_date || null, expiry_date: input.expiry_date || null,
            notes: input.notes || "", created_at: new Date().toISOString(),
          });
          if (wdErr) return `Failed to save document: ${wdErr.message}`;
          const expiryNote = input.expiry_date ? ` — expires ${new Date(input.expiry_date).toLocaleDateString("en-GB")}` : "";
          return `${input.doc_type.replace(/_/g," ").toUpperCase()} added for ${wdWorker.name}${input.doc_number ? ` (${input.doc_number})` : ""}${expiryNote}.`;
        }
        case "list_expiring_documents": {
          const days = parseInt(input.days || 30);
          const cutoff = new Date(Date.now() + days * 86400000).toISOString().slice(0,10);
          const today = localDate();
          const { data: expiring } = await db.from("worker_documents")
            .select("*, team_members(name)").eq("user_id", user?.id)
            .lte("expiry_date", cutoff).gte("expiry_date", today)
            .order("expiry_date", { ascending: true });
          const { data: expired } = await db.from("worker_documents")
            .select("*, team_members(name)").eq("user_id", user?.id)
            .lt("expiry_date", today).order("expiry_date", { ascending: false }).limit(5);
          const docs = [...(expired || []).map(d => ({...d, status: "expired"})),
                       ...(expiring || []).map(d => ({...d, status: "expiring"}))];
          if (!docs.length) return `No documents expiring in the next ${days} days. All up to date.`;
          pendingWidgetRef.current = { type: "expiring_docs", data: docs };
          const expiredCount = (expired || []).length;
          const expiringCount = (expiring || []).length;
          return `${expiredCount ? expiredCount + " expired, " : ""}${expiringCount} expiring in the next ${days} days.`;
        }
        case "delete_subcontractor": {
          const { data: found } = await tmReadSubs(db, user?.id, { nameLike: input.name || "", limit: 1 });
          if (!found?.length) return `Subcontractor not found.`;
          if (found[0].active === false) return `${found[0].name} is already archived.`;
          // Soft-delete only: hard DELETE would CASCADE wipe their entire
          // subcontractor_payments history, which is HMRC-reportable CIS
          // data we must retain for 6 years. Setting active=false hides
          // them from lists but keeps every payment record intact.
          // Report payment count so the user knows what's being preserved.
          const { count: payCount } = await db.from("subcontractor_payments")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user?.id).eq("subcontractor_id", found[0].id);
          // Session 3: soft-delete via team_members. archived_at + active=false.
          const { error: arcErr } = await db.from("team_members")
            .update({ active: false, archived_at: new Date().toISOString() })
            .eq("id", found[0].id).eq("user_id", user?.id);
          if (arcErr) return `Failed to archive: ${arcErr.message}`;
          return `${found[0].name} archived.${payCount ? ` ${payCount} payment record${payCount > 1 ? "s" : ""} kept for CIS reporting.` : ""}`;
        }
        case "update_worker": {
          const { data: wMatches } = await tmReadWorkers(db, user?.id, { nameLike: input.name, limit: 1 });
          if (!wMatches?.length) return `Worker "${input.name}" not found.`;
          const w = wMatches[0];
          const updates = {};
          if (input.day_rate !== undefined) updates.day_rate = parseFloat(input.day_rate);
          if (input.hourly_rate !== undefined) updates.hourly_rate = parseFloat(input.hourly_rate);
          if (input.cis_rate !== undefined) updates.cis_rate = parseInt(input.cis_rate);
          if (input.role) updates.role = input.role;
          if (input.email) updates.email = input.email;
          if (input.phone) updates.phone = input.phone;
          if (input.utr) updates.utr = input.utr;
          if (!Object.keys(updates).length) return `Nothing to update for ${w.name} — tell me what to change.`;
          const { error: wUpdErr } = await db.from("team_members").update(updates).eq("id", w.id).eq("user_id", user?.id);
          if (wUpdErr) return `Failed to update: ${wUpdErr.message}`;
          const changes = Object.entries(updates).map(([k,v]) => `${k.replace(/_/g," ")} → ${v}`).join(", ");
          return `${w.name} updated: ${changes}.`;
        }
        case "delete_worker": {
          const { data: wDel } = await tmReadWorkers(db, user?.id, { nameLike: input.name, limit: 1 });
          if (!wDel?.length) return `Worker "${input.name}" not found.`;
          if (wDel[0].active === false) return `${wDel[0].name} is already archived.`;
          // Soft-delete only: hard DELETE would CASCADE wipe their
          // job_workers assignments and worker_documents (CSCS cards,
          // right-to-work checks, insurance certs — legally retained
          // records). Setting active=false hides them from the workers
          // list while preserving all HR/compliance history.
          const [{ count: assignCount }, { count: docCount }, { count: timeCount }] = await Promise.all([
            db.from("job_workers").select("id", { count: "exact", head: true }).eq("user_id", user?.id).eq("worker_id", wDel[0].id),
            db.from("worker_documents").select("id", { count: "exact", head: true }).eq("user_id", user?.id).eq("worker_id", wDel[0].id),
            db.from("time_logs").select("id", { count: "exact", head: true }).eq("user_id", user?.id).eq("worker", wDel[0].name),
          ]);
          // Session 3: soft-delete via team_members. archived_at + active=false.
          const { error: wArcErr } = await db.from("team_members")
            .update({ active: false, archived_at: new Date().toISOString() })
            .eq("id", wDel[0].id).eq("user_id", user?.id);
          if (wArcErr) return `Failed to archive: ${wArcErr.message}`;
          const kept = [
            assignCount ? `${assignCount} job assignment${assignCount > 1 ? "s" : ""}` : "",
            docCount ? `${docCount} document${docCount > 1 ? "s" : ""}` : "",
            timeCount ? `${timeCount} time log${timeCount > 1 ? "s" : ""}` : "",
          ].filter(Boolean).join(", ");
          return `${wDel[0].name} archived.${kept ? ` ${kept} kept for HR records.` : ""}`;
        }
        case "update_subcontractor_payment": {
          const { data: subFind } = await tmReadSubs(db, user?.id, { nameLike: input.name, limit: 1 });
          if (!subFind?.length) return `Subcontractor "${input.name}" not found.`;
          const sub = subFind[0];
          let pQuery = db.from("subcontractor_payments").select("*").eq("user_id", user?.id).eq("subcontractor_id", sub.id).order("date", { ascending: false });
          if (input.date) pQuery = pQuery.eq("date", input.date);
          const { data: spRows } = await pQuery.limit(5);
          if (!spRows?.length) return `No payment found for ${sub.name}${input.date ? ` on ${input.date}` : ""}. Check the Subcontractors tab.`;
          const pay = input.gross
            ? spRows.find(p => Math.abs(parseFloat(p.gross) - parseFloat(input.gross)) < 1) || spRows[0]
            : spRows[0];
          const spUpdates = {};
          if (input.new_date) spUpdates.date = input.new_date;
          if (input.description) spUpdates.description = input.description;
          if (input.invoice_number) spUpdates.invoice_number = input.invoice_number;
          let newGross = parseFloat(pay.gross);
          let newLabour = parseFloat(pay.labour_amount || 0);
          let newMats = parseFloat(pay.materials_amount || 0);
          if (input.labour_amount !== undefined) newLabour = parseFloat(input.labour_amount);
          if (input.materials_amount !== undefined) newMats = parseFloat(input.materials_amount);
          if (input.gross !== undefined) newGross = parseFloat(input.gross);
          if (input.labour_amount !== undefined || input.materials_amount !== undefined) {
            if (newLabour || newMats) newGross = newLabour + newMats;
            spUpdates.labour_amount = newLabour || null;
            spUpdates.materials_amount = newMats || null;
          }
          const cisBase = (pay.payment_type === "price_work" && newLabour > 0) ? newLabour : newGross;
          const cisRate = (sub.cis_rate || pay.cis_rate || 20) / 100;
          spUpdates.gross = newGross;
          spUpdates.deduction = parseFloat((cisBase * cisRate).toFixed(2));
          spUpdates.net = parseFloat((newGross - spUpdates.deduction).toFixed(2));
          const { error: spUpdErr } = await db.from("subcontractor_payments").update(spUpdates).eq("id", pay.id).eq("user_id", user?.id);
          if (spUpdErr) return `Failed to update: ${spUpdErr.message}`;
          return `Payment updated for ${sub.name}: gross ${fmtCurrency(spUpdates.gross)}, CIS -${fmtCurrency(spUpdates.deduction)}, net ${fmtCurrency(spUpdates.net)}.`;
        }
        case "delete_subcontractor_payment": {
          const { data: subFindDel } = await tmReadSubs(db, user?.id, { nameLike: input.name, limit: 1 });
          if (!subFindDel?.length) return `Subcontractor "${input.name}" not found.`;
          let dpQuery = db.from("subcontractor_payments").select("id,gross,date").eq("user_id", user?.id).eq("subcontractor_id", subFindDel[0].id).order("date", { ascending: false });
          if (input.date) dpQuery = dpQuery.eq("date", input.date);
          const { data: dpRows } = await dpQuery.limit(5);
          if (!dpRows?.length) return `No payment found for ${subFindDel[0].name}${input.date ? ` on ${input.date}` : ""}.`;
          const dp = input.gross
            ? dpRows.find(p => Math.abs(parseFloat(p.gross) - parseFloat(input.gross)) < 1) || dpRows[0]
            : dpRows[0];
          const { error: dpDelErr } = await db.from("subcontractor_payments").delete().eq("id", dp.id).eq("user_id", user?.id);
          if (dpDelErr) return `Failed to delete: ${dpDelErr.message}`;
          return `Payment of ${fmtCurrency(parseFloat(dp.gross))} on ${dp.date} deleted for ${subFindDel[0].name}.`;
        }
        case "delete_job_card": {
          const term = (input.customer || input.title || "").toLowerCase();
          const { data: found } = await db.from("job_cards").select("id,customer,title").eq("user_id", user?.id).or(`customer.ilike.%${term}%,title.ilike.%${term}%`).order("created_at", { ascending: false }).limit(1);
          if (!found?.length) return `Job card not found for "${input.customer || input.title}".`;
          // Pre-delete: count attached children so we can tell the user what
          // survives as orphans. All child FKs are ON DELETE SET NULL now
          // (post 2026-04-23 FK harmonization migration) — nothing cascades,
          // but users should know their time logs / certs / photos are now
          // unattached and need reassigning or archiving.
          let orphanSummary = "";
          try {
            const jcId = found[0].id;
            const [timeCount, matCount, certCount, vosCount, notesCount, photosCount, dwCount, expCount] = await Promise.all([
              db.from("time_logs").select("id", { count: "exact", head: true }).eq("job_id", jcId),
              db.from("materials").select("id", { count: "exact", head: true }).eq("job_id", jcId),
              db.from("compliance_docs").select("id", { count: "exact", head: true }).eq("job_id", jcId),
              db.from("variation_orders").select("id", { count: "exact", head: true }).eq("job_id", jcId),
              db.from("job_notes").select("id", { count: "exact", head: true }).eq("job_id", jcId),
              db.from("job_photos").select("id", { count: "exact", head: true }).eq("job_id", jcId),
              db.from("daywork_sheets").select("id", { count: "exact", head: true }).eq("job_id", jcId),
              db.from("expenses").select("id", { count: "exact", head: true }).eq("job_id", jcId),
            ]);
            const orphans = [
              timeCount.count ? `${timeCount.count} time log${timeCount.count > 1 ? "s" : ""}` : "",
              matCount.count ? `${matCount.count} material${matCount.count > 1 ? "s" : ""}` : "",
              certCount.count ? `${certCount.count} certificate${certCount.count > 1 ? "s" : ""}` : "",
              vosCount.count ? `${vosCount.count} variation${vosCount.count > 1 ? "s" : ""}` : "",
              notesCount.count ? `${notesCount.count} note${notesCount.count > 1 ? "s" : ""}` : "",
              photosCount.count ? `${photosCount.count} photo${photosCount.count > 1 ? "s" : ""}` : "",
              dwCount.count ? `${dwCount.count} daywork sheet${dwCount.count > 1 ? "s" : ""}` : "",
              expCount.count ? `${expCount.count} expense${expCount.count > 1 ? "s" : ""}` : "",
            ].filter(Boolean);
            if (orphans.length) orphanSummary = ` ${orphans.join(", ")} kept but unattached — reassign or archive when you're ready.`;
          } catch (e) { /* child count best-effort */ }
          const { error: delErr } = await db.from("job_cards").delete().eq("id", found[0].id);
          if (delErr) return `Failed to delete job card: ${delErr.message}`;
          return `Job card for ${found[0].customer}${found[0].title ? " — " + found[0].title : ""} deleted.${orphanSummary}`;
        }
        case "delete_mileage": {
          let query = db.from("mileage_logs").select("id,from_location,to_location,date,miles").eq("user_id", user?.id);
          if (input.date) query = query.eq("date", input.date);
          if (input.from_location) query = query.ilike("from_location", `%${input.from_location}%`);
          if (input.to_location) query = query.ilike("to_location", `%${input.to_location}%`);
          const { data: found } = await query.order("date", { ascending: false }).limit(1);
          if (!found?.length) return `No mileage log found matching that description.`;
          const { error: delMileErr } = await db.from("mileage_logs").delete().eq("id", found[0].id);
          if (delMileErr) return `Failed to delete mileage log: ${delMileErr.message}`;
          return `Mileage log deleted: ${found[0].from_location || ""} → ${found[0].to_location || ""} on ${found[0].date} (${found[0].miles} miles).`;
        }
        case "delete_rams": {
          const term = (input.title || "").toLowerCase();
          const { data: found } = await db.from("rams_documents").select("id,title").eq("user_id", user?.id).ilike("title", `%${term}%`).order("created_at", { ascending: false }).limit(1);
          if (!found?.length) return `RAMS document not found.`;
          await db.from("rams_documents").delete().eq("id", found[0].id);
          return `RAMS "${found[0].title}" deleted.`;
        }


        case "request_signature": {
          // Navigate to Jobs tab and open the job — user can tap signature from there
          const term = (input.customer || input.title || "").toLowerCase();
          const { data: found } = await db.from("job_cards")
            .select("id,customer,title,type,customer_signature")
            .eq("user_id", user?.id)
            .or(`customer.ilike.%${term}%,title.ilike.%${term}%`)
            .order("created_at", { ascending: false }).limit(1);
          const job = found?.[0];
          if (!job) return `Couldn't find a job card for "${input.customer || input.title}".`;
          if (job.customer_signature) return `${job.customer} has already signed off that job.`;
          pendingWidgetRef.current = { type: "signature_prompt", data: { customer: job.customer, title: job.title || job.type, jobId: job.id } };
          return `To capture ${job.customer}'s signature for "${job.title || job.type}", tap the button below. It will open the signature pad directly.`;
        }
        case "sync_to_xero": {
          const term = (input.customer || input.invoice_id || "").toLowerCase();
          const all = (invoices || []).filter(i => !i.isQuote);
          const inv = all.find(i => (i.id || "").toLowerCase().includes(term) || (i.customer || "").toLowerCase().includes(term));
          if (!inv) return `No invoice found for "${input.customer || input.invoice_id}".`;
          try {
            const res = await fetch("/api/xero/create-invoice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user?.id, invoice: inv }) });
            const data = await res.json();
            if (data.error) return `Xero sync failed: ${data.error}`;
            pendingWidgetRef.current = { type: "accounting_sync", data: { platform: "Xero", customer: inv.customer, invoice_id: inv.id, amount: inv.grossAmount || inv.amount, success: true } };
            return `Invoice ${inv.id} for ${inv.customer} sent to Xero — ${fmtCurrency(parseFloat(inv.grossAmount || inv.amount || 0))}.`;
          } catch(e) {
            return `Xero sync failed: ${e.message}. Check Xero is connected in Settings.`;
          }
        }
        case "sync_to_quickbooks": {
          const term = (input.customer || input.invoice_id || "").toLowerCase();
          const all = (invoices || []).filter(i => !i.isQuote);
          const inv = all.find(i => (i.id || "").toLowerCase().includes(term) || (i.customer || "").toLowerCase().includes(term));
          if (!inv) return `No invoice found for "${input.customer || input.invoice_id}".`;
          try {
            const res = await fetch("/api/quickbooks/create-invoice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user?.id, invoice: inv }) });
            const data = await res.json();
            if (data.error) return `QuickBooks sync failed: ${data.error}`;
            pendingWidgetRef.current = { type: "accounting_sync", data: { platform: "QuickBooks", customer: inv.customer, invoice_id: inv.id, amount: inv.grossAmount || inv.amount, success: true } };
            return `Invoice ${inv.id} for ${inv.customer} sent to QuickBooks — ${fmtCurrency(parseFloat(inv.grossAmount || inv.amount || 0))}.`;
          } catch(e) {
            return `QuickBooks sync failed: ${e.message}. Check QuickBooks is connected in Settings.`;
          }
        }
        case "sync_material_to_xero": {
          const term = (input.item || input.supplier || "").toLowerCase();
          const mat = (materials || []).find(m => (m.item || "").toLowerCase().includes(term) || (m.supplier || "").toLowerCase().includes(term));
          if (!mat) return `No material found matching "${input.item || input.supplier}".`;
          try {
            const res = await fetch("/api/xero/create-bill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user?.id, material: mat }) });
            const data = await res.json();
            if (data.error) return `Xero bill failed: ${data.error}`;
            pendingWidgetRef.current = { type: "accounting_sync", data: { platform: "Xero", customer: mat.supplier || "Supplier", invoice_id: mat.item, amount: (mat.unitPrice || 0) * (mat.qty || 1), success: true, isBill: true } };
            return `Bill created in Xero for ${mat.item}${mat.supplier ? " from " + mat.supplier : ""} — ${fmtCurrency(((mat.unitPrice || 0) * (mat.qty || 1)))}.`;
          } catch(e) {
            return `Xero bill failed: ${e.message}`;
          }
        }
        case "sync_material_to_quickbooks": {
          const term = (input.item || input.supplier || "").toLowerCase();
          const mat = (materials || []).find(m => (m.item || "").toLowerCase().includes(term) || (m.supplier || "").toLowerCase().includes(term));
          if (!mat) return `No material found matching "${input.item || input.supplier}".`;
          try {
            const res = await fetch("/api/quickbooks/create-bill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user?.id, material: mat }) });
            const data = await res.json();
            if (data.error) return `QuickBooks bill failed: ${data.error}`;
            pendingWidgetRef.current = { type: "accounting_sync", data: { platform: "QuickBooks", customer: mat.supplier || "Supplier", invoice_id: mat.item, amount: (mat.unitPrice || 0) * (mat.qty || 1), success: true, isBill: true } };
            return `Bill created in QuickBooks for ${mat.item}${mat.supplier ? " from " + mat.supplier : ""} — ${fmtCurrency(((mat.unitPrice || 0) * (mat.qty || 1)))}.`;
          } catch(e) {
            return `QuickBooks bill failed: ${e.message}`;
          }
        }
        case "mark_invoice_paid_xero": {
          const term = (input.customer || input.invoice_id || "").toLowerCase();
          const all = (invoices || []).filter(i => !i.isQuote);
          const inv = all.find(i => (i.id || "").toLowerCase().includes(term) || (i.customer || "").toLowerCase().includes(term));
          if (!inv) return `No invoice found for "${input.customer || input.invoice_id}".`;
          try {
            await fetch("/api/xero/mark-paid", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user?.id, invoiceId: inv.id }) });
            // Also update local status so the invoice no longer shows in outstanding lists
            setInvoices(prev => (prev || []).map(i => i.id === inv.id ? { ...i, status: "paid", due: "Paid" } : i));
            // Parity with mark_invoice_paid: also sync to QuickBooks (no harm
            // if not connected — fire-and-forget), push the user, track event.
            // The user-facing tool name says "Xero" but the action is "mark
            // paid everywhere" — partial-sync was a silent gotcha for users
            // running both systems.
            syncInvoiceToAccounting(user?.id, { ...inv, status: "paid" });
            if (typeof sendPush === "function") sendPush({ title: "💰 Invoice Paid", body: `${inv.customer} paid ${fmtAmount(inv.amount)}`, url: "/", type: "invoice_paid", tag: "invoice-paid" });
            trackEvent(db, user?.id, companyId, "payment", "invoice_marked_paid", {
              amount: inv.amount,
              invoice_id: inv.id,
              source: "xero_explicit",
            });
            pendingWidgetRef.current = { type: "accounting_sync", data: { platform: "Xero", customer: inv.customer, invoice_id: inv.id, success: true, markedPaid: true } };
            return `Invoice ${inv.id} for ${inv.customer} marked as paid in Xero and updated locally.`;
          } catch(e) {
            return `Failed to mark paid in Xero: ${e.message}`;
          }
        }

        case "save_memory": {
          const memContent = (input.content || "").trim();
          if (!memContent) return "Nothing to save — please provide the fact to remember.";
          const existing = paMemoriesRef.current.find(m =>
            m.content.toLowerCase().includes(memContent.slice(0, 20).toLowerCase())
          );
          if (existing) {
            await db.from("pa_memories")
              .update({ times_reinforced: (existing.times_reinforced || 1) + 1, last_used: new Date().toISOString() })
              .eq("id", existing.id);
            setPaMemories(prev => prev.map(m => m.id === existing.id
              ? { ...m, times_reinforced: (m.times_reinforced || 1) + 1 }
              : m
            ));
            return `Got it — I already knew that. I'll keep it in mind.`;
          }
          const { data: inserted, error } = await db.from("pa_memories").insert({
            user_id: user?.id,
            content: memContent,
            category: input.category || "fact",
            times_reinforced: 1,
            created_at: new Date().toISOString(),
            last_used: new Date().toISOString(),
          }).select().single();
          if (error) return `Couldn't save that memory: ${error.message}`;
          if (inserted) setPaMemories(prev => [...prev, inserted]);
          return `Noted — I'll remember that for every future conversation.`;
        }

        case "escalate_to_support": {
          const issueBody = [
            "TRADE PA SUPPORT ESCALATION",
            "",
            "Issue: " + (input.issue_summary || "Not specified"),
            "Steps tried: " + (input.steps_tried || "None recorded"),
            "User email: " + (input.user_email || brand?.email || user?.email || "Unknown"),
            "Business: " + (brand?.tradingName || "Unknown"),
            "User ID: " + (user?.id || "Unknown"),
            "Time: " + new Date().toLocaleString("en-GB"),
          ].join("\n");
          try {
            await fetch("/api/email/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId: user?.id,
                to: "support@tradespa.co.uk",
                subject: "Support escalation — " + (brand?.tradingName || "User") + " — " + (input.issue_summary || "").slice(0, 60),
                body: issueBody.replace(/\n/g, "<br>"),
              }),
            });
          } catch(e) { console.warn("Support escalation email failed:", e.message); }
          pendingWidgetRef.current = { type: "support_escalated", data: { issue: input.issue_summary, email: input.user_email || brand?.email } };
          setSupportMode(false);
          return "I have escalated this to the support team — you will hear back within 1 business day. Sorry I could not resolve it myself.";
        }

        default:
          return `Unknown action: ${name}`;
      }
    } catch (err) {
      console.error("Tool execution error:", name, err);
      return `Error executing ${name}: ${err.message}`;
    }
  };

  const isNewUser = !brand.tradingName || brand.tradingName === "" || brand.tradingName === "Your Business";

  const onboardingBlock = isNewUser
    ? "ONBOARDING MODE: This is a brand new user setting up their business. Your job is to welcome them and collect their business details through natural conversation. Ask ONE question at a time — never batch multiple questions.\n\nCOLLECTION ORDER:\n1. Their name (\"What's your name?\")\n2. Trading name (\"And the name of your business — the one that goes on invoices?\")\n3. Trade type (\"What trade are you in? Gas, plumbing, electrical, building, oil, renewables, or a mix?\")\n4. TRADE-CONDITIONAL CERTS — ask ONLY what's relevant to their trade:\n   - Gas / heating → \"What's your Gas Safe register number?\"\n   - Electrical → \"Are you NICEIC or NAPIT? What's your number?\"\n   - Oil heating → \"What's your OFTEC registration number?\"\n   - Renewables / solar → \"What's your MCS number?\"\n   - Windows / doors → \"What's your FENSA number?\"\n   - Plumber / builder / decorator / landscaper → SKIP certs entirely. Do NOT ask.\n   - Multi-trade → ask each relevant one, e.g. gas+electrical = Gas Safe + NICEIC\n   CRITICAL: NEVER ask a tradesperson for a certification that doesn't apply to their trade.\n5. Phone number (\"What's your business phone number?\")\n6. Email (\"And the email you want on invoices and quotes?\")\n7. Business address\n8. VAT status (\"Are you VAT registered?\" → if yes: \"What's the number?\")\n\nIf the user volunteers multiple details at once (e.g. \"I'm Connor from CR Heating, gas and plumbing\"), extract everything they said and only ask for what's still missing.\n\nAfter collecting all details, call the update_brand tool to save everything. Include gasSafeNumber, niceicNumber, napitNumber, oftecNumber, mcsNumber, fensaNumber in the tool call if collected.\n\nAfter saving, say: \"All saved! When you send your first invoice I'll ask for your bank details. Everything else you can update in Settings or just tell me.\"\n\nBe warm, natural, and concise. Use UK English. No corporate speak."
    : ("You are assisting " + (brand.tradingName || "this business") + ". Be warm, concise, and proactive — like a PA who knows the business well.");

  // ─────────────────────────────────────────────────────────────────────
  // SYSTEM is split into TWO blocks for prompt caching:
  //   SYSTEM_STABLE  — persona, rules, tool catalog, voice triggers.
  //                    Stable across calls → marked cache:true on the server.
  //   SYSTEM_VOLATILE — today's date, business data, RAMS state, memories,
  //                     session actions, support mode. Changes every call →
  //                     sent uncached.
  // The server (/api/claude.js) accepts `system` as an array of text blocks
  // and forwards cache_control:{type:'ephemeral'} on the blocks flagged
  // cache:true. String-shaped `system` is still accepted (legacy).
  // ─────────────────────────────────────────────────────────────────────
  const SYSTEM_STABLE = `You are ${assistantName} — a personal assistant for a UK sole trader tradesperson. You speak naturally and conversationally, like a smart human PA would. When referring to yourself, use the name "${assistantName}".` +
    (assistantPersona ? `\n\nPERSONALITY: ${assistantPersona}` : "") +
    (userCommands.length > 0 ? `\n\nCUSTOM COMMANDS DEFINED BY THIS USER:\n${userCommands.filter(c => c.enabled).map(c => `- "${c.phrase}" — ${c.mode === "fast" ? `runs the ${c.tool_name} tool` : c.intent}`).join("\n")}` : "") +
    "\n\nIMPORTANT — HOW TO RESPOND:\n"
  + "- NEVER tell the user to go to the Jobs tab or check the Invoices section or navigate anywhere. Everything is shown HERE.\n"
  + "- When asked to show/find something, ALWAYS use the appropriate find_ or list_ tool so it appears inline.\n"
  + "- When you create something (invoice, job, quote), it automatically shows inline — no need to send the user elsewhere.\n"
  + "- Be conversational: Done! Here is the invoice I just created for Trevor: — not Invoice INV-042 created successfully.\n"
  + "- ACT IMMEDIATELY — do not ask confirmation questions before using tools. If you have enough info, just do it. Only ask if something critical is genuinely missing (e.g. no customer name at all).\n"
  + "- NEVER repeat a question you have already asked in the same conversation. If the user has moved on, drop it.\n"
  + "- Do not repeat the SAME action with the SAME data. If mileage from A to B on today's date is already in the session log, do not log it again. But DO log a different route (C to D) — that is a new trip.\n"
  + "- When actioning a new request, only call tools needed for THAT request. Do not bundle in previous unrelated actions from earlier in the conversation — but DO call multiple tools in a single response if the current request contains multiple actions (see MULTI-ACTION REQUESTS).\n"
  + "- SOCIAL CLOSINGS — brief reply, NO tool calls: When the user sends a pure closing or acknowledgement message (e.g. \"thanks\", \"cheers\", \"that's everything\", \"thank you\", \"perfect\", \"brilliant\", \"appreciate it\"), respond with a short warm acknowledgement only (one or two short sentences) and DO NOT call any tools. They're wrapping up the exchange — don't re-query data that's already visible, don't re-show widgets, don't summarise. Just a friendly sign-off.\n"
  + "\n"
  + "YOU ARE A PERSONAL ASSISTANT ON THE PHONE.\n"
  + "The tradesperson is calling you from a van, a loft, a building site. They speak in fragments. Your job is to understand quickly, fill the gaps, and get the action done.\n"
  + "A real PA does not say \"not found\" and hang up. A real PA says: \"I can't see a Smith invoice — did you mean Smithson, or shall I create one?\" ALWAYS move the conversation forward.\n"
  + "\n"
  + "PA CORE PRINCIPLES:\n"
  + "1. ACT ON WHAT YOU HAVE. If you have enough to do the job, do it. Don't check in before acting when the intent is obvious. \"Log 20 miles to the Patel job\" → just log it.\n"
  + "2. ASK ONLY FOR WHAT'S CRITICAL, ONE THING AT A TIME. Never ask for a checklist of fields. Ask the single most important missing piece, let them answer, then move on. \"What's the cert number?\" — not \"What's the cert number, issue date, expiry date, and any notes?\"\n"
  + "3. FILL IN SENSIBLE DEFAULTS SILENTLY. Date not given → today. No unit on a time entry → hours. No VAT stated → use their brand setting. Tell them what you assumed, briefly.\n"
  + "4. NEVER SAY \"NOT FOUND\" AND STOP. If you can't find something, offer a next step: \"I can't see a Smith job — want me to create one?\", \"No expense matches that — here are the most recent 3, which one?\", \"No customer called Patel — did you mean Patterson, or shall I add a new one?\"\n"
  + "5. WHEN AMBIGUOUS, LIST AND ASK. \"Patel has 3 jobs — kitchen, bathroom, loft — which one?\" Don't pick the wrong one silently.\n"
  + "6. CONFIRM BEFORE DESTRUCTIVE ACTIONS. Deletes and cancellations need a quick \"Delete the Smith £450 invoice — yes?\" before acting. Everything else, just do it.\n"
  + "7. AFTER AN ACTION, SUMMARISE AND OFFER NEXT STEP. \"Done. Logged 20 miles to Patel. Want me to add the parking?\" \"Cert recorded. Open the Certificates tab when you're back at the desk to finish the PDF.\"\n"
  + "8. BE WARM BUT FAST. \"On it.\" \"Got that.\" \"Done — anything else?\" Not verbose. Not robotic. A good PA's voice is the target.\n"
  + "9. MATCH THEIR LANGUAGE. If they say \"subbie\" don't respond with \"subcontractor.\" If they say \"pop to Plumb Centre\" don't respond with \"supplier run.\" Mirror back.\n"
  + "10. REMEMBER WHAT YOU JUST DID. Within a conversation, don't re-ask info you already have. \"Log 5 more miles\" after just logging a Patel trip means the same job unless they say otherwise.\n"
  + "\n"
  + "MULTI-ACTION REQUESTS — THIS IS WHAT A REAL PA DOES:\n"
  + "A tradesperson on the phone will often rattle off several things at once: \"Right, invoice Patel £900 for the kitchen, mark the Smith job as done, log 4 hours on the Wilson boiler and remind me to chase Thompson tomorrow.\" A real PA writes a short list, then starts actioning them in order at their desk. YOU DO THE SAME.\n"
  + "- CALL MULTIPLE TOOLS IN THE SAME RESPONSE when a user packs several actions into one message. Don't do them one at a time across multiple turns — that wastes everyone's time.\n"
  + "- Parse the request into a list of actions, then emit one tool call per action, back-to-back. The system handles them all in sequence.\n"
  + "- Tool calls can be mixed types. You can log an expense, create an invoice, add a reminder and delete a job all in the same response.\n"
  + "- ONLY ASK if critical info is missing for any specific action. For the others that ARE complete, DO them — don't block the whole batch on one missing field. Example: \"Invoice Patel £900 and log some miles\" → invoice Patel straight away, then ask \"How many miles, and where to?\"\n"
  + "- SUMMARISE AT THE END, DON'T NARRATE EACH STEP. After executing the batch, one clean summary: \"Done. Invoiced Patel £900, marked Smith complete, logged 4hr on Wilson, reminder set for Thompson tomorrow 9am. Anything else?\"\n"
  + "- ALWAYS ACKNOWLEDGE EVERY TOOL that successfully ran. If you logged 20 miles, mention \"logged 20 miles\" in your reply. If you added a reminder, mention it. Never silently execute a tool — the user relies on your confirmation to know it worked, especially on voice where they can't see the screen easily. A good PA always repeats back what they just did.\n"
  + "- Don't be afraid of 5, 7, 10 tools in one turn. If they asked for it, do it.\n"
  + "- Respect dependencies: if one action feeds into the next (e.g. \"create a customer for Tim Jones and book him in for Tuesday\"), call them in the right order — create_customer first, then create_job referencing the new customer.\n"
  + "- One exception: DESTRUCTIVE actions in a batch still need confirmation. \"Delete the Smith invoice and log 20 miles\" → log the miles straight away, but ask \"Delete the Smith £450 invoice — you sure?\" before deleting.\n"
  + "- BATCH + AMBIGUOUS ENTITY: If ONE action in a batch hits an ambiguity (e.g. duplicate customer name, two matching jobs), DO NOT block the whole batch. Run the unambiguous actions first, then ask about the ambiguous one. Example: \"Invoice Smith £900 and log 4hr on Wilson\" when there are two Smiths → log the 4hr on Wilson first, then ask \"Two Smiths on file — which one for the £900 invoice?\"\n"
  + "- EACH ACTION IS EVALUATED INDEPENDENTLY against the user's data. Don't carry a resolved entity from a prior action in the batch into the next one unless the user explicitly said so. Example: \"Invoice Patel £900 and remind me to chase Wilson tomorrow\" — the Wilson reminder is linked to Wilson's data, NOT Patel's. Look each one up fresh.\n"
  + "- MIXED DESTRUCTIVE: If a batch has a destructive + other actions, PHRASE the confirmation so the user knows exactly what they're saying yes to. \"Logged 20 miles to Wickes. Now — deleting the Smith £450 invoice, you sure?\" (not \"Yes to delete?\" by itself — on voice, a naked yes could be misread as confirming something else).\n"
  + "- CLOSING PHRASE FUSED WITH ACTIONS: If the user says \"...thanks, that's everything\" WITH actions in the same message (\"Invoice Smith £900 and mark Patel done, thanks that's everything\"), still RUN the actions, then close warmly. Only skip tool calls for PURE closings with no action content.\n"
  + "- MILEAGE CONTINUATION: \"Log 20 miles to Patel and then another 15 to Wickes\" = two trips. The second leg's from_location is the first leg's to_location UNLESS the user says otherwise (\"and another 15 from home to Wickes\"). Don't silently use an unrelated starting point.\n"
  + "- LIST-THEN-ACT SUPERLATIVES: If the user asks for a list and then wants you to act on \"the biggest/oldest/highest\", you DO NOT have the list's data in your next decision — the widget is shown to the user but not returned as tool content to you. If they ask you to pick a superlative after listing, EITHER ask \"which one did you want?\" OR use the find_ tool explicitly with the criteria. Don't fabricate which one is biggest.\n"
  + "\n"
  + "CONVERSATIONAL RECOVERY PATTERNS:\n"
  + "- Customer not found: \"No customer called [name] — did you mean [closest match]? Or shall I add them as a new customer?\"\n"
  + "- DUPLICATE CUSTOMER NAMES — handle this carefully:\n"
  + "  * If the customer list shows multiple customers with the same name (you'll see email/phone in [square brackets] after duplicates), ask the user which one BEFORE creating anything.\n"
  + "  * Format the question like this: \"I've got two Glenn Mackays — which one?\\n  1. glenn.m@gmail.com · 07700 900123\\n  2. glenn@mackayplumbing.co.uk · 07700 900456\"\n"
  + "  * Always show the contact details (email and phone) for each match — that's how the user tells them apart.\n"
  + "  * Accept ANY of these as the answer: position (\"the first one\", \"second\", \"number 1\"); part of the email (\"the gmail one\", \"the mackayplumbing one\", \"the .co.uk one\"); part of the phone number (\"900456\", \"the 456 one\", \"ending 123\"); or the full email/phone.\n"
  + "  * Once they pick, proceed with the right customer's full details (use their unique email/phone to identify the right record when calling tools).\n"
  + "  * NEVER pick a duplicate silently. NEVER guess. Always confirm.\n"
  + "- Job not found: \"I can't see a job for [customer]. Want me to create one?\"\n"
  + "- Multiple matches: \"[Customer] has [N] jobs on the go — [list]. Which one?\"\n"
  + "- Invoice/quote not found by amount: \"No invoice matches £[X]. The closest ones are [list]. Which one did you mean?\"\n"
  + "- Tool fails: \"That didn't go through — [plain English reason]. Want me to try [alternative]?\"\n"
  + "- User cancels mid-flow: \"No problem, dropped it. Anything else?\"\n"
  + "\n"
  + "SENSIBLE DEFAULTS (don't ask, just apply):\n"
  + "- Dates: if unstated → today. \"Tomorrow\" → tomorrow's date. \"Next Tuesday\" → next Tuesday. \"Next month\" → 1st of next month.\n"
  + "- Invoice/quote due dates: 14 days unless their brand setting says otherwise.\n"
  + "- CIS certificate expiry: 12 months from issue.\n"
  + "- VAT: whatever their brand setting is. Never invent 20%.\n"
  + "- Mileage rate: 45p/mile (HMRC standard) unless they override.\n"
  + "- Subcontractor CIS rate: 20% (registered) unless stated.\n"
  + "- Labour type: hourly unless \"day rate\" or \"price work\" is said.\n"
  + "\n"
  + "- Ask follow-up questions naturally. Prefer one short question over a list of fields.\n"
  + "- Use £ not $. Keep replies short and punchy.\n"
  + "\nTOOLS YOU CAN USE:\n"
  + "CREATE: create_job (scheduled), create_job_card, create_invoice, create_quote, create_invoice_from_job, log_enquiry, set_reminder, create_material, create_customer, add_stock_item, log_expense, log_cis_statement, add_subcontractor, log_subcontractor_payment, add_compliance_cert (CP12/EICR/PAT etc), add_variation_order, log_daywork, send_review_request, add_stage_payment\n"
  + "FIND/SHOW INLINE: find_invoice, find_quote, find_job_card (always shows full card), list_invoices, list_jobs, list_materials, find_material_receipt, list_schedule, get_job_full (use this when user asks for detail on a job), list_expenses, list_cis_statements, list_subcontractors, list_reminders, list_enquiries, list_customers, list_mileage, list_stock, list_rams, get_report, list_inbox_actions (show pending email actions with email snippet for review)\n"
  + "UPDATE BRAND: update_brand (use during onboarding or when user wants to update business details)\n"
  + "DELETE: delete_job, delete_invoice, delete_enquiry, delete_customer, delete_material (DEFAULT count:1 — only set higher for explicit numeric requests like 'delete 3 blocks'; for 'delete all X', ask user to confirm the count first, never guess). Also delete_job_card, delete_subcontractor, delete_worker, delete_subcontractor_payment, delete_cis_statement, delete_expense, delete_mileage, delete_rams, delete_stock_item.\n"
  + "DELETE CONFIRMATION RULE (NON-NEGOTIABLE): Before calling ANY delete_* tool, you MUST confirm with the user in your text reply, naming the EXACT thing being deleted (customer name, invoice number, job title — whatever identifies it precisely) and ONLY proceed if the user replies with a clear yes / confirm / delete it / go ahead. If the user's message is ambiguous (e.g. 'remove the Smith one' when there are multiple Smiths), list the candidates and ask which one — do not guess. INCLUDE THE UNIQUE IDENTIFIER IN THE CONFIRM QUESTION: not just 'the Smith invoice' but 'invoice INV-042 — Smith £450 — delete?' so the subsequent delete_ call can reference the exact ID and the user isn't accidentally confirming the wrong record on voice. Voice users on cellular often have STT mishearing risk where 'add' becomes 'delete' or a customer name gets mangled — the confirmation step protects them. MIXED-BATCH PHRASING: if the delete is in a batch with other actions, phrase the confirm explicitly so 'yes' can't be misread: 'Logged 20 miles. Now — deleting invoice INV-042 (Smith £450), yes to delete?' — not a bare 'yes?' after multiple actions. ONLY exception: when the user has just been shown a list/find result and immediately follows with 'delete that' or 'remove that one' referring unambiguously to a single item shown. Even then, name the item back to them in your reply.\n"
  + "- update_material_status updates ALL items with that name — one call updates all duplicates at once.\n"
  + "UPDATE: mark_invoice_paid, update_job_status, update_job_card (edit any field), update_invoice (edit any field/line item), update_material_status, convert_quote_to_invoice, assign_material_to_job, update_stock, delete_stock_item\n"
  + "LOG: log_time, log_mileage, add_job_note\n"
  + "MEMORY: save_memory (explicitly store something important you should remember about this business)\n"
  + "\nRules:\n"
  + "- create_job = scheduled with date+time. create_job_card = job tracking card without a date.\n"
  + "- REPEAT CUSTOMERS: When a customer has multiple jobs, ALWAYS include job_title in tool calls (log_time, add_job_note, assign_material_to_job, get_job_profit, get_job_full, add_variation_order, log_daywork, add_compliance_cert). If the user says 'the extension' or 'the boiler service' — use that as job_title. Never guess — if ambiguous, list their jobs and ask which one.\n"
  + "- For invoices/quotes: use line_items array — one object per item with description and amount.\n- list_invoices filter: unpaid = outstanding/due/awaiting payment. paid = settled/collected. ALWAYS match what the user asked for.\n"
  + "- After tool use: confirm naturally in 1-2 sentences.\n"
  + "- For mileage: HMRC rate is 45p/mile for first 10,000 miles.\n"
  + "- When user says show me or what are my anything — use a list_ or find_ tool, never tell them to go somewhere.\n"
  + "- For schedule/diary/what\'s on today or this week — use list_schedule.\n"
  + "- For ANY job query — show, find, detail, update — always use get_job_full or find_job_card, both return full cards. NEVER return a partial job card.\n"
  + "- For RAMS or method statements — use start_rams, then guide through steps using rams_save_step1 through rams_save_step5.\n"
  + "- RAMS flow: start_rams → rams_save_step1 → rams_save_step2 (categories) → rams_confirm_hazards (after user reviews) → rams_save_step3 (after user reviews method steps) → rams_save_step4 (COSHH) → rams_save_step5 (emergency/save).\n"
  + "- After user answers each RAMS question, immediately call the matching rams_save_stepN tool.\n"
  + "- Current RAMS session state is provided in the business data block below.\n"
  + "- When ramsSession is active, keep focused on completing it — guide user step by step.\n"
  + "- EVERY feature of the app is actionable here — jobs, invoices, quotes, materials, labour, mileage, expenses, CIS, subcontractors, reminders, RAMS, stock, purchase orders, compliance certificates, variation orders, daywork, review requests, reports.\n"
  + "- For expenses say: log_expense. For CIS say: log_cis_statement. For subcontractor payments say: log_subcontractor_payment.\n"
  + "- For certificates say: add_compliance_cert. For extra work say: add_variation_order. For reports say: get_report.\n"
  + "- PROFIT/MARGIN: get_job_profit — use when user asks 'what's the profit', 'where do I stand', 'how much am I making', 'show the breakdown', 'margin on this job'. NEVER use create_material for profit questions.\n"
  + "\nVOICE TRIGGER GUIDE — listen for these phrases:\n"
  + "- CIS: 'log CIS from [name], gross £X, deduction £Y' → log_cis_statement\n"
  + "- SUB ADD: 'add [name] as a subcontractor, UTR X, 20% CIS' → add_subcontractor (cis_rate: 20=registered, 30=unregistered, 0=gross status)\n"
  + "- SUB PAY: 'pay [name] £X gross for [job]' → log_subcontractor_payment (auto-calculates CIS from stored rate)\n"
  + "- SUB STATEMENT: 'CIS statement for [name] for [month]' → generate_subcontractor_statement\n"
  + "- DAYWORK: 'log daywork for [customer], X hours at £Y/hr' → log_daywork\n"
  + "- VARIATION: 'add a variation for [customer], [description], £X' → add_variation_order\n"
  + "- STAGE PAYMENTS: 'set up stage payments for [customer]' → add_stage_payment (defaults to 30/40/30 if no stages given)\n"
  + "- COMPLIANCE CERTIFICATES — follow through, do not give up early:\n"
  + "  * If user says 'create a certificate' or 'issue a cert' WITHOUT a type, ask: 'Which certificate? Gas Safety (CP12), EICR, PAT, Pressure Test, Oil Safety, MCS, or something else?' Then proceed.\n"
  + "  * If type is given but no customer/job, ask which job it's for. If you can see recent jobs, list 2-3 options.\n"
  + "  * If cert number not given, ask: 'What\'s the certificate number?'\n"
  + "  * If expiry date not given on a dated cert (CP12, EICR, Pressure, Oil), offer the standard: 'Should I set expiry to 12 months from today?' — wait for confirmation before setting.\n"
  + "  * Default issued_date to today if not stated. Don\'t ask.\n"
  + "  * After successfully logging, tell the user: 'Logged against [customer] job. If you need the signed PDF with test results, open the Certificates tab on the job card to finish.'\n"
  + "  * Examples that should FULLY succeed in one call: 'Add CP12 for Patel job, number GS123, expires March 2027' → call add_compliance_cert with all fields populated.\n"
  + "  * Examples needing ONE follow-up: 'Create me a certificate' → ask which type. 'Issue an EICR for Smith' → ask for cert number and expiry.\n"
  + "- STOCK IN: 'received 20 [item]' or 'add 10 to stock' → update_stock (positive)\n"
  + "- STOCK OUT: 'used 5 [item]' or 'took 3 from stock' → update_stock (negative)\n"
  + "- REMINDER: 'remind me to [X] at 9am tomorrow' → set_reminder with iso_time for specific times, minutes_from_now only for 'in X minutes'\n"
  + "- SIGNATURE: 'get sign-off from [customer]' → request_signature\n"
  + "- REVIEW: 'send review request to [customer]' → send_review_request\n"
  + "- Never tell the user to go to a tab — do everything here and show it inline.\n"
  + "- SEND: send_invoice, send_quote, chase_invoice, sync_to_xero, sync_to_quickbooks (push invoice to accounting), sync_material_to_xero, sync_material_to_quickbooks (create purchase bill), mark_invoice_paid_xero.\n"
  + "- SIGNATURE: request_signature navigates to the Jobs tab and opens the signature pad for customer sign-off.\n"
  + "- INBOX: list_inbox_actions shows pending email actions WITH the email snippet so user can review before approving. approve_inbox_action / reject_inbox_action to action them.\n"
  + "- STOCK: add_stock_item, list_stock, update_stock, delete_stock_item.\n"
  + "- STAGE PAYMENTS: add_stage_payment sets milestones on a job.\n"
  + "- SUBCONTRACTOR STATEMENTS: generate_subcontractor_statement shows CIS statement for a month.\n"
  + "- WORKERS (workers table — PAYE or self-employed on your team): add_worker, log_worker_time, assign_worker_to_job, add_worker_document. log_worker_time searches the workers table first, then subcontractors — so it works for both.\n"
  + "- SUBCONTRACTORS (subcontractors table — CIS, UTR, own business): add_subcontractor, log_subcontractor_payment (include customer+job_title to link to a job). IMPORTANT: if someone is set up as a subcontractor (has CIS rate), ALWAYS use log_subcontractor_payment — never log_time. If you try log_worker_time and they are found as a subcontractor, the system will handle it automatically.\n"
  + "- RAMS: list_rams shows all saved RAMS. start_rams builds a new one conversationally.\n"
  + "\n"
  + "TRADE PA APP — FEATURES YOU SHOULD KNOW ABOUT (so you can answer user questions about the app itself):\n"
  + "- APPEARANCE / THEME: Users can switch between Light, Dark or Auto mode in Settings → Appearance. Auto follows their phone's system setting. Light is best for outdoor sunlight on site. Dark is best for evenings or in the van. If a user asks 'how do I change to light mode' or 'switch to dark mode', tell them: 'Tap Settings, then Appearance, then pick Light, Dark or Auto.' You can't switch the theme yourself — only the user can.\n"
  + "- FEEDBACK / REPORTING BUGS: There's a 💬 button in the top header (between ? and 👤) and a Send Feedback section in Settings. Users can report bugs, suggest improvements or share ideas. They can attach screenshots. If a user complains about a bug, says 'this is broken', 'this doesn't work', 'I have an idea for', or 'this could be better' — direct them: 'Tap the 💬 icon in the top header to send a bug report — you can attach a screenshot and we'll get it.' Don't try to fix the app yourself.\n"
  + "- ACCOUNTS TAB (formerly 'Money'): The tab containing Invoices, Quotes, Payments, Expenses, CIS and Reports is called Accounts. Use 'Accounts' when referring to that group of features.\n"
  + "- REMINDERS BEHAVIOUR: When a reminder fires at its set time, it does NOT automatically disappear. It stays in the user's Upcoming list as 'Overdue' (red bar) until they explicitly tap 'Done ✓' to mark it complete. This is deliberate — so users don't lose track of things they haven't actually followed through on. If a user asks 'where did my reminder go' or 'why is my reminder still showing', explain: 'Reminders stay in your Upcoming list until you tap Done ✓ — that way nothing slips. Tap Done ✓ once you've actually done it, or ✕ to delete it entirely.'\n"
  + "- DESKTOP LAYOUT: On a desktop browser (≥900px wide), the navigation appears as a left-hand sidebar instead of category pills. On phones and PWAs, the pills layout is used. If a user mentions can't find the menu on desktop, tell them to look at the left side of the screen.\n"
  + (handsFree ? "\n\nHANDS-FREE MODE: Your reply is spoken aloud by text-to-speech. Rules:\n- Plain spoken English only. No markdown, bullets, asterisks or formatting.\n- Keep your text reply to 1-2 sentences — a brief spoken intro only.\n- When you use a tool to fetch data, your text reply is the spoken intro. E.g. \'You have four invoices awaiting payment, totalling 32700 pounds. What would you like to do?\'\n- ALWAYS end your reply with a question or prompt so the user knows to respond.\n- When the user questions or corrects data you returned: acknowledge it directly, explain what the system shows (e.g. \'Those invoices show as sent in the system, meaning they have been issued but not yet marked as paid.\'), and offer what you can do — mark as paid, filter differently, etc. Never just repeat the same data without explanation.\n- If the user says something seems wrong, explain the status honestly: sent = issued, awaiting payment. overdue = past due date. paid = marked paid. draft = not yet sent.\n- Be a real PA: if the data surprises them, help them understand it and offer next steps." : "")
  + (paMemoriesRef.current.length ? "\n\nTHINGS YOU HAVE LEARNED ABOUT THIS BUSINESS (from past conversations — use these to give better, more personalised responses):\n" + paMemoriesRef.current.slice(0, 25).map(m => "- " + m.content).join("\n") + "\n" : "")
  + (sessionActionsRef.current.length ? "\n\nACTIONS ALREADY COMPLETED THIS SESSION (do NOT repeat these):\n" + sessionActionsRef.current.map(a => "- " + a).join("\n") + "\n" : "")
  + (supportMode ? "\nSUPPORT MODE ACTIVE: The user needs help with the app. Your job is to resolve their issue conversationally — walk them through it step by step, explain how features work, and troubleshoot problems. You know every feature of Trade PA in detail. If after 3 genuine attempts you still cannot resolve the issue, use the escalate_to_support tool to collect their details and email the issue to the support team. Be warm, patient and thorough. Never tell them to contact support unless you have tried everything." : "");

  // VOLATILE block: rebuilt every render. This part varies per call so we
  // deliberately keep it out of the cache block above.
  const SYSTEM_VOLATILE = `Today is ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.\n\n` + onboardingBlock
    + "\n\nCurrent business data:\n"
    + "- Jobs: " + ((jobs||[]).length === 0 ? "none" : (jobs||[]).map(j => j.customer + " (" + (j.type||j.title||"") + ", " + j.status + ")").join(", ")) + "\n"
    + "- Invoices: " + ((invoices||[]).filter(i=>!i.isQuote).length === 0 ? "none" : (invoices||[]).filter(i=>!i.isQuote).map(i=> i.id + " " + i.customer + " £" + i.amount + " (" + i.status + ")").join(", ")) + "\n"
    + "- Quotes: " + ((invoices||[]).filter(i=>i.isQuote).length === 0 ? "none" : (invoices||[]).filter(i=>i.isQuote).map(i=> i.id + " " + i.customer + " £" + i.amount + " (" + i.status + ")").join(", ")) + "\n"
    + "- Materials: " + ((materials||[]).length === 0 ? "none" : (materials||[]).map(m=> m.item + " x" + m.qty + " (" + m.status + ")").join(", ")) + "\n"
    + "- Customers: " + (() => {
      const cs = customers || [];
      if (cs.length === 0) return "none";
      // Count occurrences of each name (case-insensitive) so we know who has duplicates
      const nameCounts = {};
      cs.forEach(c => { const k = (c.name || "").toLowerCase().trim(); nameCounts[k] = (nameCounts[k] || 0) + 1; });
      // For customers whose name is shared with at least one other, include email + phone
      // so the AI can disambiguate. For unique names, just the name (saves tokens).
      return cs.map(c => {
        const isDup = nameCounts[(c.name || "").toLowerCase().trim()] > 1;
        if (!isDup) return c.name;
        const bits = [];
        if (c.email) bits.push(c.email);
        if (c.phone) bits.push(c.phone);
        return c.name + (bits.length ? ` [${bits.join(" · ")}]` : "");
      }).join(", ");
    })() + "\n"
    + "- Enquiries: " + ((enquiries||[]).length === 0 ? "none" : (enquiries||[]).map(e=>e.name).join(", ")) + "\n"
    + "- Inbox actions pending approval: " + (pendingInboxCount === 0 ? "none" : `${pendingInboxCount} waiting — tell the user if they ask, or call list_inbox_actions to show them`) + "\n"
    + "- Current RAMS session: " + (ramsSession ? "YES - step " + ramsSession.step : "none") + "\n"
    + (paMemoriesRef.current.length ? "\n\nTHINGS YOU HAVE LEARNED ABOUT THIS BUSINESS (from past conversations — use these to give better, more personalised responses):\n" + paMemoriesRef.current.slice(0, 25).map(m => "- " + m.content).join("\n") + "\n" : "")
    + (sessionActionsRef.current.length ? "\n\nACTIONS ALREADY COMPLETED THIS SESSION (do NOT repeat these):\n" + sessionActionsRef.current.map(a => "- " + a).join("\n") + "\n" : "")
    + (overlayContext ? `\n\nCURRENT SCREEN CONTEXT (user invoked you from a specific screen — act on THIS record first unless they say otherwise):\n${overlayContext}\n` : "");


  // Auto-trigger onboarding for new users — only fires when onboarding step is 2 (AI chat)
  useEffect(() => {
    if (isNewUser && onboardingStepRef.current === 2 && messages.length === 0 && !loading) {
      const timer = setTimeout(() => {
        send("__onboarding_start__");
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [onboardingStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Streaming helper for /api/claude ─────────────────────────────────
  // Phase 2 Stage 2 (20 Apr 2026): consumes Anthropic-style SSE stream from
  // our server, assembles content blocks into the SAME shape the non-streaming
  // response returned, and fires onTextDelta for each text chunk so the UI
  // can render Claude's reply progressively as it types.
  //
  // Return shape mirrors a minimal fetch() Response: { status, ok, data }.
  // On a server-side rejection (402/403/429 from enforcement), the server
  // responds with JSON (not SSE) — we detect via content-type and surface it
  // unchanged so the existing limit-modal interception logic keeps working.
  //
  // On mid-stream errors Anthropic/our proxy emits an SSE 'error' event; we
  // convert it to { status:500, ok:false, data:{error:"..."} } so the caller
  // handles it the same way as any other failure.
  // ─── Voice routing: simple → Haiku, complex → Sonnet ───────────────────────
  // Heuristic classifier that decides which model handles a voice turn.
  // Zero latency — pure JS pattern matching, no extra API call. Fires before
  // the main Claude call.
  //
  // Design: SAFER TO OVER-FLAG AS COMPLEX than to miss. A miss sends a
  // complex request to Haiku and the user feels a quality drop. A false
  // positive sends a simple request to Sonnet and costs slightly more.
  // So the patterns below err on the side of complex.
  //
  // Context forces complex regardless of text:
  //   - Active RAMS session (state transitions need Sonnet)
  //   - Inside a destructive confirmation (voice-safety critical)
  //
  // Text patterns that mark complex:
  //   - Multi-action: "and", "also", "then" joining verbs
  //   - Superlatives: "biggest", "oldest", "highest" etc. — list-then-act
  //   - Disambiguation: "that one", "the X one", "whichever"
  //   - Conditionals: "but first", "before", "unless", "if"
  //   - Long: >20 words is rarely a single simple command
  //
  // Tune the patterns based on real voice telemetry (trackEvent logs every
  // routing decision — see the call site).
  const classifyIntentHeuristic = (text, { ramsActive = false, inConfirmation = false } = {}) => {
    if (ramsActive) return "complex";
    if (inConfirmation) return "complex";
    if (!text || typeof text !== "string") return "complex";

    const lower = text.toLowerCase();
    const wordCount = text.trim().split(/\s+/).length;

    // Any message over 20 words is probably not a trivially simple action
    if (wordCount > 20) return "complex";

    // Multi-action connectors followed by another action verb
    // Patterns like "invoice Smith AND log 20 miles" or "X then Y"
    const multiActionVerbs = /\b(and|also|then|plus|after that)\b[^.!?]*\b(log|add|create|delete|invoice|mark|send|chase|book|remind|set|update|show|list|pay|assign|scrap|remove|cancel)\b/i;
    if (multiActionVerbs.test(text)) return "complex";

    // Superlatives that require list-then-act reasoning
    const superlatives = /\b(biggest|smallest|oldest|newest|highest|lowest|most|least|largest|earliest|latest)\b/i;
    if (superlatives.test(text)) return "complex";

    // Disambiguation pronouns — "that one", "the Smith one", "whichever"
    const disambiguation = /\b(that one|that invoice|that job|that customer|the \w+ one|whichever|which one)\b/i;
    if (disambiguation.test(text)) return "complex";

    // Conditional phrasings — hold off, check first, unless, etc.
    const conditionals = /\b(but first|before (you|i|we|sending|doing)|unless|if (he|she|they|it) (says|doesn'?t|hasn'?t)|hold off|wait until)\b/i;
    if (conditionals.test(text)) return "complex";

    // "Instead of X, Y" — action replacement
    if (/\binstead of\b/i.test(lower)) return "complex";

    // Default: simple
    return "simple";
  };

  const callClaudeStream = async (body, onTextDelta) => {
    const res = await fetch("/api/claude", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ ...body, stream: true }),
    });

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("text/event-stream")) {
      // Server returned a plain JSON response (e.g. 402 limit, 500 error before stream).
      let errData = null;
      try { errData = await res.json(); } catch {}
      return { status: res.status, ok: res.ok, data: errData || { error: "Unknown error" } };
    }

    // Parse SSE frames and assemble content blocks
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const contentBlocks = [];
    let toolInputJson = "";
    let currentToolBlockIdx = -1;
    let stop_reason = null;
    let stop_sequence = null;
    let usage = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by a blank line (\n\n)
        let sepIdx;
        while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
          const raw = buffer.slice(0, sepIdx);
          buffer = buffer.slice(sepIdx + 2);

          let eventName = null;
          let dataStr = "";
          for (const line of raw.split("\n")) {
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            else if (line.startsWith("data:")) {
              const piece = line.slice(5).trim();
              dataStr = dataStr ? dataStr + "\n" + piece : piece;
            }
          }
          if (!dataStr) continue;

          let parsed;
          try { parsed = JSON.parse(dataStr); } catch { continue; }

          const t = parsed.type || eventName;

          if (t === "error") {
            return {
              status: 500, ok: false,
              data: { error: parsed.message || parsed.error?.message || "Stream error" },
            };
          }

          if (t === "content_block_start") {
            const idx = parsed.index;
            contentBlocks[idx] = { ...parsed.content_block };
            if (contentBlocks[idx].type === "text" && contentBlocks[idx].text == null) {
              contentBlocks[idx].text = "";
            }
            if (contentBlocks[idx].type === "tool_use") {
              currentToolBlockIdx = idx;
              toolInputJson = "";
              if (contentBlocks[idx].input == null) contentBlocks[idx].input = {};
            }
          } else if (t === "content_block_delta") {
            const idx = parsed.index;
            const block = contentBlocks[idx];
            if (!block) continue;
            const delta = parsed.delta;
            if (delta?.type === "text_delta" && block.type === "text") {
              block.text += delta.text || "";
              if (onTextDelta && delta.text) {
                try { onTextDelta(delta.text); } catch (e) { console.warn("onTextDelta threw:", e); }
              }
            } else if (delta?.type === "input_json_delta") {
              toolInputJson += delta.partial_json || "";
            }
          } else if (t === "content_block_stop") {
            const idx = parsed.index;
            const block = contentBlocks[idx];
            if (block && block.type === "tool_use" && toolInputJson) {
              try { block.input = JSON.parse(toolInputJson); } catch { block.input = {}; }
            }
            if (idx === currentToolBlockIdx) {
              currentToolBlockIdx = -1;
              toolInputJson = "";
            }
          } else if (t === "message_delta") {
            if (parsed.delta?.stop_reason) stop_reason = parsed.delta.stop_reason;
            if (parsed.delta?.stop_sequence !== undefined) stop_sequence = parsed.delta.stop_sequence;
            if (parsed.usage) usage = parsed.usage;
          }
          // message_start / message_stop / ping — no-op
        }
      }
    } catch (err) {
      console.error("[callClaudeStream] read error:", err);
      return { status: 500, ok: false, data: { error: err.message || "Stream interrupted" } };
    }

    return {
      status: 200, ok: true,
      data: {
        content: contentBlocks.filter(Boolean),
        stop_reason,
        stop_sequence,
        ...(usage ? { usage } : {}),
      },
    };
  };

  const send = async (text) => {
    if (!text.trim() || loading) return;

    // Fair-use cap: client-side pre-check. Open the limit modal instead of
    // inserting a plain-text message, so the user has a direct path to buy
    // an add-on or upgrade without leaving the conversation.
    const _caps = usageCapsRef.current || {};
    if (_caps.convos !== Infinity && (usageDataRef.current?.conversations_used || 0) >= _caps.convos) {
      setLimitError(null);
      setLimitModal({ reason: "limit_reached", pendingText: text });
      // Analytics: user hit the monthly conversation cap. This is a strong
      // upgrade signal — the Admin dashboard lists these as warm leads.
      trackEvent(db, user?.id, companyId, "plan_event", "convos_cap_hit", {
        convos_used: usageDataRef.current?.conversations_used || 0,
        convos_cap: _caps.convos,
      });
      return;
    }
    const isOnboardingTrigger = text === "__onboarding_start__";
    const userMsg = { role: "user", content: isOnboardingTrigger ? "Hello" : text };
    // Use messagesRef.current (not messages) to avoid stale closure bug
    // when send() is called from async mic callbacks after re-renders
    const updated = isOnboardingTrigger ? [userMsg] : [...messagesRef.current, userMsg];
    if (!isOnboardingTrigger) setMessages(updated);
    else setMessages([]);
    setInput("");
    setLoading(true);
    setLastAction(null);
    // Reset within-turn creation tracker so tools in this turn don't see
    // phantom entities from the previous turn. See turnCreatedRef declaration
    // for why this exists (React state doesn't flush between sequential tool
    // calls in a single assistant turn).
    turnCreatedRef.current = { customers: [], jobs: [], invoices: [] };

    // Phase 2 Stage 2: streaming placeholder tracking.
    // placeholderAdded stays false until the first text_delta arrives, so that
    // if enforcement rejects the request (402/403/429) or Anthropic fails,
    // we never leave an empty assistant bubble in the chat. Subsequent deltas
    // find the placeholder via its streaming:true flag and append.
    let placeholderAdded = false;
    const onTextDelta = (deltaText) => {
      if (!deltaText) return;
      if (!placeholderAdded) {
        placeholderAdded = true;
        setMessages((prev) => [...prev, { role: "assistant", content: deltaText, streaming: true }]);
      } else {
        setMessages((prev) => {
          const copy = prev.slice();
          for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].streaming) {
              copy[i] = { ...copy[i], content: (copy[i].content || "") + deltaText };
              break;
            }
          }
          return copy;
        });
      }
    };

    try {
      // Build API messages — deduplicate consecutive same-role messages
      // (Claude API requires strict user/assistant alternation)
      const rawMessages = updated
        .filter(m => m.role === "user" || m.role === "assistant")
        .filter(m => typeof m.content === "string")
        .map(m => ({ role: m.role, content: m.content }));
      const apiMessagesUntrimmed = rawMessages.reduce((acc, msg) => {
        if (acc.length > 0 && acc[acc.length - 1].role === msg.role) {
          // Merge consecutive same-role messages
          acc[acc.length - 1] = { ...acc[acc.length - 1], content: acc[acc.length - 1].content + " " + msg.content };
        } else {
          acc.push(msg);
        }
        return acc;
      }, []);

      // ─── Conversation history trimming ──────────────────────────────────
      // Background: every turn appends to the conversation, and we send the
      // FULL history back to Claude on each call. After ~6 turns of normal
      // back-and-forth (especially with big tool results), we hit input
      // token limits. This is what bit Connor at turn 6 in the 26 Apr voice
      // test.
      //
      // Strategy: keep the most recent N pairs of turns AND stay under a
      // rough token budget, whichever is smaller. We approximate tokens as
      // characters / 4 (a standard rough heuristic — actual tokenisation is
      // a bit fewer for English prose, more for code/JSON, but this is in
      // the right ballpark and over-estimating is the safer side).
      //
      // We also preserve the FIRST user turn (original task framing) when
      // trimming long sessions — it gives Claude orientation.
      const HISTORY_TURN_BUDGET = 12;          // last 12 messages (≈6 user/assistant pairs)
      const HISTORY_CHAR_BUDGET = 80000;       // ≈20k tokens — Haiku 200k limit, leave plenty of room for tools+system+response
      const trimHistory = (msgs) => {
        if (!Array.isArray(msgs) || msgs.length <= HISTORY_TURN_BUDGET) {
          // Even short histories can blow the char budget if a tool dumped a big payload
          let chars = msgs.reduce((acc, m) => acc + (typeof m.content === "string" ? m.content.length : 0), 0);
          if (chars <= HISTORY_CHAR_BUDGET) return msgs;
        }
        // Keep first user turn for context anchoring + last (TURN_BUDGET-1) turns
        const firstUserIdx = msgs.findIndex(m => m.role === "user");
        const head = firstUserIdx >= 0 ? [msgs[firstUserIdx]] : [];
        let tail = msgs.slice(-(HISTORY_TURN_BUDGET - head.length));
        // If head and tail overlap (head index is within tail range), drop the
        // duplicate from tail.
        if (head.length && tail.includes(head[0])) {
          tail = tail.filter(m => m !== head[0]);
        }
        // Ensure user/assistant alternation is preserved at the join.
        // If head ends with role X and tail starts with role X, drop the
        // first tail item.
        if (head.length && tail.length && head[head.length - 1].role === tail[0].role) {
          tail = tail.slice(1);
        }
        // If we have no head (no user turn found, edge case) tail must START
        // with a user turn — Claude API rejects assistant-first conversations.
        if (head.length === 0) {
          while (tail.length && tail[0].role === "assistant") tail = tail.slice(1);
        }
        let trimmed = [...head, ...tail];

        // Char-budget pass: progressively drop oldest non-head turns until
        // we fit. Never drop the first head item (anchor) or the very last
        // user turn (the current question).
        const charsOf = (arr) => arr.reduce((a, m) => a + (typeof m.content === "string" ? m.content.length : 0), 0);
        while (charsOf(trimmed) > HISTORY_CHAR_BUDGET && trimmed.length > 2) {
          // Drop second item (oldest after head anchor)
          trimmed.splice(head.length, 1);
          // Re-fix alternation if break
          if (head.length && trimmed[head.length] && trimmed[head.length].role === head[head.length - 1].role) {
            trimmed.splice(head.length, 1);
          }
        }
        return trimmed;
      };
      const apiMessages = trimHistory(apiMessagesUntrimmed);

      // ═══════════════════════════════════════════════════════════════
      // AGENTIC LOOP — iterate while Claude keeps calling tools.
      // Each iteration:
      //   1. Call /api/claude with current message history
      //   2. Execute every tool_use block in the response
      //   3. If stop_reason === "tool_use", append assistant message + tool_results
      //      and loop. Otherwise we're done.
      // Safeguards:
      //   - MAX_AGENTIC_ITERATIONS prevents runaway loops
      //   - Each iteration counts against the conversation cap
      //   - Aggregated text/widgets across all iterations presented to user
      // ═══════════════════════════════════════════════════════════════
      const MAX_AGENTIC_ITERATIONS = 8;
      const ACTION_TOOLS = ["log_mileage","log_time","create_material","create_job_card","create_job",
        "create_invoice","create_customer","log_expense","log_cis_statement","add_subcontractor",
        "log_subcontractor_payment","add_compliance_cert","add_variation_order","log_daywork","add_stage_payment",
        "update_material_status","update_material","delete_material","add_job_note","assign_material_to_job",
        "add_worker","assign_worker_to_job","log_worker_time","add_worker_document"];

      // Working copy of messages sent to Claude — we mutate this across iterations
      // We use the raw API-shape messages (role + content) since intermediate
      // assistant turns need to preserve tool_use blocks verbatim.
      let workingMessages = apiMessages.slice();
      let allReplyText = "";
      const allToolResults = [];
      const allWidgets = [];
      let iteration = 0;
      let data = null;
      let loopError = null;

      // ─── Haiku/Sonnet routing (decision made ONCE per send, reused across
      // every iteration of the agentic loop — switching model mid-loop would
      // break prompt caching). Decision is based on the user's raw text plus
      // whether we're in a stateful context (RAMS) that requires Sonnet.
      const routeComplexity = classifyIntentHeuristic(text, {
        ramsActive: !!ramsSession,
        inConfirmation: false, // reserved for future destructive-confirm state
      });
      const routedModel = routeComplexity === "simple"
        ? "claude-haiku-4-5-20251001"
        : "claude-sonnet-4-6";
      // Fire-and-forget telemetry — lets you see routing mix + tune heuristic
      // over time. Metadata kept small to avoid PII in analytics.
      trackEvent(db, user?.id, companyId, "model_route", routeComplexity, {
        model: routedModel,
        word_count: (text || "").trim().split(/\s+/).length,
        rams_active: !!ramsSession,
      });

      // ─── Thin tool routing — compute once per send(), reuse across iterations.
      // Don't recompute mid-loop: switching the tool surface mid-agentic-flow
      // breaks Claude's expectation continuity and prompt-caching wins. The
      // user's original message determines the tool surface for the whole
      // multi-step task. Force-all when RAMS is active because RAMS is a
      // multi-cluster stateful flow that legitimately needs everything.
      const toolSubset = buildToolSubset(text, TOOLS, { forceAll: !!ramsSession });
      const relevantTools = toolSubset.tools;
      trackEvent(db, user?.id, companyId, "tool_subset", toolSubset.reason, {
        selected_count: relevantTools.length,
        total_count: TOOLS.length,
        reduction_pct: Math.round((1 - relevantTools.length / TOOLS.length) * 100),
        clusters: toolSubset.clusters.join(","),
        forced_all: toolSubset.forcedAll,
      });

      while (iteration < MAX_AGENTIC_ITERATIONS) {
        iteration += 1;

        // Phase 2 Stage 2: use streaming SSE so text renders as Claude types.
        // callClaudeStream returns { status, ok, data } so the downstream
        // limit/error handling below works identically to the non-streaming path.
        const streamResult = await callClaudeStream({
          model: routedModel,
          max_tokens: 1000,
          system: [
            { type: "text", text: SYSTEM_STABLE, cache: true },
            { type: "text", text: SYSTEM_VOLATILE },
          ],
          tools: relevantTools,
          messages: workingMessages,
        }, onTextDelta);
        const res = { status: streamResult.status, ok: streamResult.ok };
        data = streamResult.data;

        // ── Server-side cap / lock / rate-limit interception ──────────────
        // /api/claude returns 402 limit_reached when the monthly allowance is
        // exhausted, 403 account_locked if the abuse system has frozen the
        // account, or 429 for rate-limit breaches. These are expected states,
        // not crashes — route them to the limit modal rather than the generic
        // error path. The user's message is already in `messages` state from
        // send(), so roll that back and stash the text for retry.
        const LIMIT_REASONS = [
          "limit_reached",
          "account_locked",
          "no_subscription",
          "rate_limit_minute",
          "rate_limit_hour",
          "rate_limit_day",
        ];
        if (res.status === 402 || res.status === 403 || res.status === 429) {
          const reason = (data && data.error) ? String(data.error) : "limit_reached";
          if (LIMIT_REASONS.includes(reason)) {
            // Roll back the user message we optimistically inserted in send().
            // Identify by role + content from the pending text — the last user
            // message in state is the one we just added.
            const pendingText = (() => {
              const m = messagesRef.current;
              for (let i = m.length - 1; i >= 0; i--) {
                if (m[i].role === "user" && typeof m[i].content === "string") return m[i].content;
              }
              return "";
            })();
            setMessages(prev => {
              const copy = prev.slice();
              for (let i = copy.length - 1; i >= 0; i--) {
                if (copy[i].role === "user" && copy[i].content === pendingText) {
                  copy.splice(i, 1);
                  break;
                }
              }
              return copy;
            });
            setLimitError(null);
            setLimitModal({
              reason,
              message: data?.message || null,
              pendingText,
            });
            setLoading(false);
            return; // Exit the whole send() — don't fall into loopError path
          }
        }

        // Surface API errors clearly
        if (data.error) {
          console.error("API error (iter " + iteration + "):", data.error);
          loopError = `API Error: ${data.error.message || JSON.stringify(data.error)}`;
          break;
        }

        if (!data.content || data.content.length === 0) {
          // stop_reason=end_turn with empty content = Claude intentionally said
          // nothing (e.g. acknowledging a "thank you" as conversation end). Don't
          // flag as error — just break the loop and skip the message append at
          // the end (handled by the silent-end guard below).
          if (data.stop_reason === "end_turn") {
            break;
          }
          console.error("Empty response (iter " + iteration + "):", data);
          loopError = `No response received. Stop reason: ${data.stop_reason || "unknown"}`;
          break;
        }

        // Collect text and execute tools in this iteration
        const iterToolUseBlocks = []; // need to keep these to echo back to Claude
        const iterToolResults = [];   // tool_result blocks to send back

        for (const block of data.content) {
          if (block.type === "text") {
            if (block.text) allReplyText += (allReplyText ? " " : "") + block.text;
          } else if (block.type === "tool_use") {
            iterToolUseBlocks.push(block);
            pendingWidgetRef.current = null;
            const toolStartedAt = Date.now();
            const result = await executeTool(block.name, block.input);
            const toolDurationMs = Date.now() - toolStartedAt;
            // Fire-and-forget usage tracking. Empty/null result = failure from
            // the tool's perspective; a non-null string is success. We don't
            // capture the full input because some tools carry PII (amounts,
            // customer names) that shouldn't flow into analytics.
            trackEvent(db, user?.id, companyId, "tool_call", block.name, {
              success: !!result,
              duration_ms: toolDurationMs,
            });
            if (result) allToolResults.push(result);
            if (result && ACTION_TOOLS.includes(block.name)) {
              sessionActionsRef.current = [...sessionActionsRef.current.slice(-9), `${block.name}(${JSON.stringify(block.input).slice(0,60)})`];
            }
            if (pendingWidgetRef.current) {
              // Dedup: skip if an identical widget (same type + same data) was already
              // added in this turn. Prevents duplicate UI when Claude calls the same
              // read-only tool twice across iterations (20 Apr 2026 — seen on social closings).
              const newW = pendingWidgetRef.current;
              const newDataJson = JSON.stringify(newW.data);
              const alreadyPresent = allWidgets.some(
                (w) => w.type === newW.type && JSON.stringify(w.data) === newDataJson
              );
              if (!alreadyPresent) {
                allWidgets.push(newW);
              }
              pendingWidgetRef.current = null;
            }
            // Build a tool_result block to send back to Claude next iteration.
            // Keep it short — Claude only needs to know success/fail and any key info.
            //
            // Truncation: tool implementations have grown over time and a
            // few return verbose JSON dumps (large lists, etc.). Anything
            // over 2000 chars gets truncated for the next iteration — Claude
            // doesn't need to re-see every row to keep reasoning, and the
            // visible widget already shows the data to the user. The full
            // result still flows to allToolResults for the user-facing
            // text path; only the BACK-to-Claude copy is trimmed.
            const TOOL_RESULT_MAX_CHARS = 2000;
            let toolResultForClaude = result || "Done.";
            if (typeof toolResultForClaude === "string" && toolResultForClaude.length > TOOL_RESULT_MAX_CHARS) {
              toolResultForClaude = toolResultForClaude.slice(0, TOOL_RESULT_MAX_CHARS) +
                ` … [truncated ${toolResultForClaude.length - TOOL_RESULT_MAX_CHARS} chars — full data shown to user via widget]`;
            }
            iterToolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: toolResultForClaude,
            });
          }
        }

        // If stop_reason is NOT tool_use, we're done — Claude returned a final text response.
        if (data.stop_reason !== "tool_use") {
          break;
        }

        // Otherwise, prepare for next iteration:
        // 1. Append the assistant's response (with tool_use blocks) to the conversation
        // 2. Append a user message containing the tool_result blocks
        // 3. Re-trim — agentic chains can grow workingMessages substantially
        //    within a single turn (each tool round-trip adds 2 messages),
        //    so we apply the same budget here. We DON'T trim through tool_use
        //    pairs though (that would orphan a tool_result), so we use a
        //    char-budget-only pass for in-loop trimming.
        workingMessages = [
          ...workingMessages,
          { role: "assistant", content: data.content },
          { role: "user", content: iterToolResults },
        ];
        // In-loop char budget guard. Drop oldest pairs (assistant+user) from
        // beyond the original head until under budget. Always keep at least
        // the last 4 messages (current tool round-trip + the previous one).
        // Critically: must drop COMPLETE assistant→user pairs together, never
        // orphan a tool_use without its matching tool_result.
        const charsOf = (arr) => arr.reduce((a, m) => a + (
          typeof m.content === "string" ? m.content.length :
          Array.isArray(m.content) ? JSON.stringify(m.content).length : 0
        ), 0);
        let safety = 0;
        while (charsOf(workingMessages) > HISTORY_CHAR_BUDGET && workingMessages.length > 4 && safety++ < 20) {
          // Find first (assistant, user) pair starting after index 0.
          // Walk forward looking for assistant immediately followed by user.
          let cutAt = -1;
          for (let i = 1; i < workingMessages.length - 1; i++) {
            if (workingMessages[i].role === "assistant" && workingMessages[i + 1].role === "user") {
              cutAt = i;
              break;
            }
          }
          if (cutAt < 0) break; // no clean pair to drop — bail out, oversize is preferable to corrupt
          workingMessages.splice(cutAt, 2);
        }

        // If this iteration made no tool calls at all, something's wrong — break out
        if (iterToolUseBlocks.length === 0) {
          break;
        }
      }

      // Handle loop errors
      if (loopError) {
        // Phase 2 Stage 2: if a streaming placeholder was added before the
        // error, replace it with the error text (matches pre-streaming behaviour
        // which discarded any partial text from earlier iterations). Otherwise
        // append a new error message as before.
        if (placeholderAdded) {
          setMessages(prev => {
            const copy = prev.slice();
            for (let i = copy.length - 1; i >= 0; i--) {
              if (copy[i].streaming) {
                copy[i] = { role: "assistant", content: loopError, streaming: false };
                break;
              }
            }
            return copy;
          });
        } else {
          setMessages(prev => [...prev, { role: "assistant", content: loopError }]);
        }
        setLoading(false);
        return;
      }

      // Hit iteration limit without natural end? Log it AND surface to the user —
      // they need to know some of their requested actions may not have finished.
      // A silent cap-hit means the user thinks everything worked when only the
      // first few actions landed.
      //
      // Strong-UI approach (26 Apr 2026): render as its own visually distinct
      // amber warning card via kind="iteration_cap". Previously we appended a
      // ⏱️ line to the AI's reply text — easy to miss after a long response.
      // The dedicated card draws the eye and includes a Retry-friendly
      // framing.
      if (iteration >= MAX_AGENTIC_ITERATIONS && data?.stop_reason === "tool_use") {
        console.warn("Agentic loop hit max iterations (" + MAX_AGENTIC_ITERATIONS + ")");
        // Finalise the streaming placeholder (if any) without injecting the
        // notice — it'll appear as its own card below the reply.
        if (placeholderAdded) {
          setMessages(prev => {
            const copy = prev.slice();
            for (let i = copy.length - 1; i >= 0; i--) {
              if (copy[i].streaming) {
                copy[i] = { ...copy[i], streaming: false };
                break;
              }
            }
            return copy;
          });
        }
        // Append the dedicated iteration-cap notice as a flagged message.
        // The message renderer special-cases kind === "iteration_cap" to
        // show a high-visibility amber-bordered card.
        setMessages(prev => [...prev, {
          role: "assistant",
          kind: "iteration_cap",
          content: "Hit my processing limit partway through — some of what you asked may not have finished. Check the screens for what landed, and let me know what to retry.",
        }]);
      }

      // Silent-end guard (20 Apr 2026): when Claude chose not to respond
      // (stop_reason=end_turn, no text, no tools) — e.g. after a "thank you"
      // sign-off — don't append a spurious "Done." message. Just exit cleanly.
      if (!allReplyText.trim() && allToolResults.length === 0 && data?.stop_reason === "end_turn") {
        setLoading(false);
        if (placeholderAdded) {
          // Defensive: remove any placeholder that sneaked in
          setMessages(prev => {
            const copy = prev.slice();
            for (let i = copy.length - 1; i >= 0; i--) {
              if (copy[i].streaming) { copy.splice(i, 1); break; }
            }
            return copy;
          });
        }
        return;
      }

      // Combine Claude text + tool results.
      //
      // Tool result strings (e.g. "Lewis Skelton archived. Worker added: Lewis
      // Skelton (electrician) as a subcontractor.") are for Claude to consume,
      // not the user. When Claude has written a substantive natural-language
      // reply ("All sorted — moved Lewis to the Workers tab."), appending the
      // raw tool results creates an awkward two-paragraph effect with Claude's
      // friendly summary first then a robotic recap of every step.
      //
      // Rule: trust Claude's reply when it has any real content. Fall back to
      // tool result text ONLY when the reply is empty or trivially short
      // (e.g. "Done.", "OK"). Never append raw "Error executing..." strings —
      // those belong in logs/Sentry, not chat.
      const cleanToolResults = allToolResults.filter(t => {
        const lower = (t || "").toLowerCase();
        return !lower.startsWith("error executing") && !lower.includes("can't find variable");
      });
      const toolResultText = cleanToolResults.join(" ").trim();
      const replyTrim = allReplyText.trim();
      const replyIsSubstantive = replyTrim.length >= 12; // "OK"/"Done."/"Sorted." → fallback; longer → trust
      let finalReply;
      if (replyIsSubstantive) {
        finalReply = replyTrim;
      } else if (toolResultText) {
        finalReply = toolResultText;
      } else {
        finalReply = replyTrim || "Done.";
      }

      // For widget display: prefer the last list/data widget; fall back to last action widget
      const displayWidget = allWidgets.slice().reverse().find(w =>
        ["invoice_list","schedule_list","material_list","job_list","expense_list",
         "mileage_list","cis_list","subcontractor_list","stock_list","reminder_list",
         "customer_list","enquiry_list","po_list","rams_list","report",
         "invoice","quote","job_card","job_full","job_profit","email_sent","worker_list","expiring_docs","subcontractor_statement",
         "stage_payments","variation_order","daywork_sheet","compliance_cert",
         "signature_prompt","review_sent","subcontractor_payment","cis_statement"].includes(w.type)
      ) || allWidgets[allWidgets.length - 1] || null;

      const widget = displayWidget;
      pendingWidgetRef.current = null;
      // Phase 2 Stage 2: if we streamed a placeholder, replace it with the
      // final reply + widget in one atomic update. The content may differ
      // slightly from what streamed (we combine Claude text + tool summary
      // text via the dedup logic above) — the visible change should be minor
      // and happens instantly at the end of the turn.
      if (placeholderAdded) {
        setMessages(prev => {
          const copy = prev.slice();
          for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].streaming) {
              copy[i] = { role: "assistant", content: finalReply, widget, streaming: false };
              break;
            }
          }
          return copy;
        });
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: finalReply, widget }]);
      }

      // Build a verbal summary of widget data for hands-free readout
      const buildSpokenSummary = (w) => {
        if (!w?.data) return "";
        const d = w.data;
        const fmt = (n) => "£" + parseFloat(n||0).toFixed(2);
        try {
          switch (w.type) {

            case "schedule_list": {
              if (!d.length) return "You have nothing booked.";
              const items = d.slice(0, 8).map(j => {
                const dt = j.dateObj ? new Date(j.dateObj) : null;
                const day = dt ? dt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) : j.date || "";
                const time = dt ? dt.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" }) : "";
                return time && time !== "00:00"
                  ? `On ${day} at ${time} you have ${j.customer || j.title || "a job"}`
                  : `On ${day} you have ${j.customer || j.title || "a job"}`;
              });
              return "Here is your schedule. " + items.join(". ") + (d.length > 8 ? `. Plus ${d.length - 8} more.` : ".");
            }

            case "invoice_list": {
              if (!d.length) return "No invoices found.";
              const total = d.reduce((s,i) => s + parseFloat(i.grossAmount||i.amount||0), 0);
              const overdue = d.filter(i => i.status === "overdue");
              const statusLabel = (s) => s === "overdue" ? "overdue" : s === "draft" ? "draft" : s === "paid" ? "paid" : "awaiting payment";
              const items = d.slice(0, 6).map(i =>
                `${i.customer}, ${fmt(i.grossAmount||i.amount)}, ${statusLabel(i.status)}`
              );
              let summary = `You have ${d.length} invoice${d.length !== 1 ? "s" : ""} totalling ${fmt(total)}. `;
              if (overdue.length) summary += `${overdue.length} ${overdue.length === 1 ? "is" : "are"} overdue. `;
              summary += items.join(". ") + ".";
              return summary;
            }

            case "invoice":
            case "quote": {
              const type = d.isQuote ? "Quote" : "Invoice";
              const amt = fmt(d.grossAmount||d.amount);
              return `${type} created for ${d.customer}, ${amt}, due ${d.due}.`;
            }

            case "job_list": {
              if (!d.length) return "No jobs found.";
              const items = d.slice(0, 6).map(j =>
                `${j.customer || j.title}${j.status ? ", " + j.status.replace(/_/g," ") : ""}${j.value > 0 ? ", " + fmt(j.value) : ""}`
              );
              return `Found ${d.length} job${d.length !== 1 ? "s" : ""}. ` + items.join(". ") + ".";
            }

            case "job_card":
            case "job_full": {
              const val = d.value > 0 ? `, valued at ${fmt(d.value)}` : "";
              const status = (d.status||"new").replace(/_/g," ");
              return `Job card for ${d.customer}${d.address ? " at " + d.address : ""}. Status ${status}${val}.`;
            }

            case "material_list": {
              if (!d.length) return "No materials found.";
              const toOrder = d.filter(m => m.status === "to_order");
              const items = d.slice(0, 5).map(m => `${m.item}, quantity ${m.qty}${m.supplier ? " from " + m.supplier : ""}`);
              let s = `${d.length} material${d.length !== 1 ? "s" : ""}. `;
              if (toOrder.length) s += `${toOrder.length} still to order. `;
              s += items.join(". ") + ".";
              return s;
            }

            case "po_list": {
              if (!d.length) return "No purchase orders found.";
              const items = d.slice(0, 5).map(p => `${p.supplier}, ${fmt(p.total)}, ${p.status}`);
              return `${d.length} purchase order${d.length !== 1 ? "s" : ""}. ` + items.join(". ") + ".";
            }

            case "mileage_list": {
              if (!d.length) return "No mileage logged.";
              const miles = d.reduce((s,t) => s + parseFloat(t.miles||0), 0);
              return `${d.length} trip${d.length !== 1 ? "s" : ""}, ${miles.toFixed(0)} miles total, claimable value ${fmt(w.value||0)}.`;
            }

            case "expense_list": {
              if (!d.length) return "No expenses found.";
              const total = d.reduce((s,e) => s + parseFloat(e.amount||0), 0);
              const items = d.slice(0, 4).map(e => `${e.description||e.exp_type}, ${fmt(e.amount)}`);
              return `${d.length} expense${d.length !== 1 ? "s" : ""} totalling ${fmt(total)}. ` + items.join(". ") + ".";
            }

            case "customer_list": {
              if (!d.length) return "No customers on file.";
              return `You have ${d.length} customer${d.length !== 1 ? "s" : ""}. ` + d.slice(0, 6).map(c => c.name).join(", ") + (d.length > 6 ? ", and more." : ".");
            }

            case "enquiry_list": {
              if (!d.length) return "No enquiries.";
              const items = d.slice(0, 5).map(e => `${e.name}${e.source ? " via " + e.source : ""}${e.status ? ", " + e.status : ""}`);
              return `You have ${d.length} enquir${d.length !== 1 ? "ies" : "y"}. ` + items.join(". ") + ".";
            }

            case "reminder_list": {
              if (!d.length) return "No reminders set.";
              const items = d.slice(0, 5).map(r => {
                const when = r.fire_at ? new Date(r.fire_at).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
                return r.text + (when ? " at " + when : "");
              });
              return `${d.length} reminder${d.length !== 1 ? "s" : ""}. ` + items.join(". ") + ".";
            }

            case "stock_list": {
              if (!d.length) return "No stock items on file.";
              const low = d.filter(s => parseFloat(s.quantity||0) <= parseFloat(s.reorder_level||0));
              let sv = `You have ${d.length} stock item${d.length !== 1 ? "s" : ""}. `;
              if (low.length) sv += `${low.length} ${low.length === 1 ? "is" : "are"} running low: ` + low.slice(0,3).map(x => x.name).join(", ") + ". ";
              else sv += d.slice(0,3).map(x => `${x.name}, ${x.quantity} ${x.unit||"in stock"}`).join(". ") + ".";
              return sv;
            }

            case "report": {
              const rev = fmt(d.totalRevenue||0);
              const profit = fmt(d.grossProfit||0);
              const out = fmt(d.outstanding||0);
              const parts = [];
              if (d.totalRevenue) parts.push("revenue " + rev);
              if (d.grossProfit) parts.push("gross profit " + profit);
              if (d.outstanding) parts.push(out + " still outstanding");
              if (d.totalPaid) parts.push(fmt(d.totalPaid) + " collected");
              return (d.label ? d.label + ". " : "") + (parts.length ? parts.join(", ") + "." : "Report ready.");
            }

            case "cis_list": {
              if (!d.length) return "No CIS statements.";
              const total = d.reduce((s,x) => s + parseFloat(x.gross_amount||0), 0);
              return `${d.length} CIS statement${d.length !== 1 ? "s" : ""}, total gross ${fmt(total)}.`;
            }

            case "cis_statement": // fall through to subcontractor_payment
              return `CIS from ${d.contractor_name}. Gross ${fmt(d.gross_amount)}, deduction ${fmt(d.deduction_amount)}, net ${fmt(d.net_amount)}.`;

            case "subcontractor_list": {
              if (!d.length) return "No subcontractors on file.";
              const items = d.slice(0,5).map(s => `${s.name}${s.cis_rate ? " at " + s.cis_rate + "% CIS" : ""}`);
              return `You have ${d.length} subcontractor${d.length !== 1 ? "s" : ""}. ` + items.join(", ") + ".";
            }

            case "subcontractor_payment":
              return `Payment for ${d.subcontractor_name}. Gross ${fmt(d.gross)}, CIS deduction ${fmt(d.deduction)}, net payable ${fmt(d.net)}.`;

            case "rams_list": {
              if (!d.length) return "No RAMS documents.";
              return `${d.length} RAMS document${d.length !== 1 ? "s" : ""}. Most recent: ${d[0].title}.`;
            }

            case "rams_complete":
              return `RAMS saved for ${d.title}.`;

            case "email_sent":
              return `${d.isChase ? "Chase email" : d.isQuote ? "Quote" : "Invoice"} sent to ${d.customer}.`;



            case "stock_item_entry":
              return `${d.name} added to stock. Current quantity ${d.quantity} ${d.unit||""}.`;

            case "variation_order":
              return `Variation order ${d.vo_number||""} for ${d.customer}, ${fmt(d.amount)}.`;

            case "daywork_sheet":
              return `Daywork sheet for ${d.customer}, ${d.hours} hours at ${fmtAmount(d.rate)} per hour, total ${fmt(d.total)}.`;

            case "compliance_cert":
              return `${d.doc_type} certificate issued for ${d.customer}.`;

            case "scan_result":
              return `Receipt scanned from ${d.supplier||"supplier"}. ${d.items?.length||0} item${(d.items?.length||0)!==1?"s":""}, total ${fmt(d.total)}.`;

            case "stage_payments": {
              const total = (d.stages||[]).reduce((s,st) => s + parseFloat(st.amount||0), 0);
              return `Stage payment plan for ${d.customer}. ${(d.stages||[]).length} stages totalling ${fmt(total)}.`;
            }

            case "accounting_sync":
              return `${d.customer} synced to ${d.platform}. Invoice ${d.invoice_id}, ${d.amount ? "£" + parseFloat(d.amount).toFixed(2) : ""}.`;

            case "expense_entry":
              return `Expense logged — ${d.description || d.exp_type}, ${fmtCurrency(parseFloat(d.amount||0))}.`;

            case "inbox_actions": {
              if (!d || !d.length) return "No pending inbox actions.";
              const previews = d.slice(0, 3).map(a => `${a.action_type || "action"} from ${a.from_name || a.from_email || "unknown"}`);
              return `You have ${d.length} pending inbox action${d.length !== 1 ? "s" : ""}. ${previews.join(", ")}.`;
            }

            case "material_receipt":
              return `Receipt found — ${d.supplier || "supplier"}, ${fmtCurrency(parseFloat(d.amount||d.total||0))}.`;

            case "rams_step1":
              return "RAMS started. I need the project title, site address and scope of work. What are they?";

            case "rams_hazard_cats":
              return `Hazard categories selected for ${d.title||"this project"}. Review the list and confirm when you are happy to continue.`;

            case "rams_hazard_review":
              return `Hazards identified for ${d.title||"this project"}. Have a look and confirm when you are ready to move on to the method steps.`;

            case "rams_step3":
              return `Method statement updated for ${d.title||"this project"}. Review the steps and confirm to continue.`;

            case "rams_step4":
              return `COSHH substances recorded for ${d.title||"this project"}. Confirm to move to the final step.`;

            case "rams_step5":
              return `Almost done. I need the emergency procedure and any final details for ${d.title||"this project"}.`;

            case "review_sent":
              return `Review request sent to ${d.customer} at ${d.email}. ${d.platforms?.length ? "Links sent for " + d.platforms.join(" and ") + "." : ""}`;

            case "signature_prompt":
              return `Signature pad is ready for ${d.customer} on ${d.title||"this job"}. Hand them the phone to sign.`;

            case "subcontractor_entry":
              return `${d.name} added as a subcontractor at ${d.cis_rate||20}% CIS rate.`;

            case "subcontractor_statement": {
              const { sub, month, totalGross, totalDed, totalNet } = d;
              const fmt2 = n => "£" + parseFloat(n||0).toFixed(2);
              return `CIS statement for ${sub?.name||"subcontractor"} — ${month}. Gross ${fmt2(totalGross)}, deduction ${fmt2(totalDed)}, net paid ${fmt2(totalNet)}.`;
            }

            case "job_profit": {
              const fp = (n) => "£" + parseFloat(n||0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
              const isP = d.grossProfit >= 0;
              let s = `Profit breakdown for ${d.customer}. `;
              s += `Revenue ${fp(d.totalRevenue)}. `;
              if (d.totalCosts > 0) {
                s += `Total costs ${fp(d.totalCosts)}`;
                if (d.labourCost > 0) s += ` — labour ${fp(d.labourCost)}`;
                if (d.materialCost > 0) s += `, materials ${fp(d.materialCost)}`;
                if (d.subcontractorCost > 0) s += `, subcontractors ${fp(d.subcontractorCost)}`;
                s += ". ";
              } else {
                s += "No costs logged yet. ";
              }
              s += `Gross profit ${fp(d.grossProfit)} — that's a ${d.margin}% margin. ${isP ? "Looking good." : "Costs are exceeding revenue — worth reviewing."}`;
              return s;
            }

            case "worker_list": {
              if (!d?.length) return "No workers found.";
              const subs = d.filter(w => w.type === "subcontractor").length;
              const emp = d.filter(w => w.type === "employed").length;
              return `You have ${d.length} worker${d.length !== 1 ? "s" : ""} on your books. ${subs > 0 ? subs + " subcontractor" + (subs !== 1 ? "s" : "") : ""}${emp > 0 ? (subs > 0 ? " and " : "") + emp + " employed" : ""}.`;
            }
            case "expiring_docs": {
              const expired = (d || []).filter(x => x.status === "expired");
              const expiring = (d || []).filter(x => x.status === "expiring");
              let s = "";
              if (expired.length) s += `${expired.length} document${expired.length !== 1 ? "s have" : " has"} already expired. `;
              if (expiring.length) s += `${expiring.length} document${expiring.length !== 1 ? "s are" : " is"} expiring soon. `;
              return s.trim() || "All documents are up to date.";
            }
            case "support_escalated":
              return `Support ticket raised. Your issue has been sent to the team and they will be in touch at ${d.email||"your email"}.`;

            default:
              return "";
          }
        } catch { return ""; }
      };

      // In hands-free mode, Claude is instructed to read data aloud in its response.
      const spokenSummary = widget ? buildSpokenSummary(widget) : "";

      // In hands-free mode: build a full spoken summary covering ALL tools that ran
      // For multi-tool responses, concatenate spoken summaries of each widget + tool results
      let spokenReply;
      if (handsFreeRef.current) {
        if (allWidgets.length > 1) {
          // Multiple tools ran — speak each widget summary + any tool result text
          const widgetSummaries = allWidgets
            .map(w => buildSpokenSummary(w))
            .filter(Boolean);
          const combined = [...widgetSummaries].filter(Boolean);
          // Add tool result text only if not already covered by widget summaries
          if (!combined.length) combined.push(finalReply);
          spokenReply = combined.join(" ").trim();
        } else {
          // Prefer Claude's own written text when it's substantial (>30 chars).
          // The auto-generated widget summary is a generic readout — Claude's
          // actual text is usually more contextual and directly answers the
          // user's specific question. Fall back to widget summary only when
          // Claude produced trivial text like "Here's the job card:".
          const useClaudeText = finalReply.trim().length > 30;
          spokenReply = useClaudeText ? finalReply : ((widget && spokenSummary) ? spokenSummary : finalReply);
        }
      } else {
        spokenReply = finalReply;
      }

      setLoading(false); // Clear spinner immediately — mic restart + TTS run async after this

      // Increment usage counter
      if (user?.id && currentMonth && !isOnboardingTrigger) {
        const newCount = (usageDataRef.current?.conversations_used || 0) + 1;
        setUsageData(prev => ({ ...prev, conversations_used: newCount }));
        Promise.resolve(db.rpc("increment_usage", {
          p_user_id: user.id, p_month: currentMonth,
          p_conversations: 1, p_seconds: 0,
        })).catch(() => {});
        // Nudge at 80% of cap
        const caps = usageCapsRef.current || {};
        if (caps.convos !== Infinity && newCount === Math.floor(caps.convos * 0.8)) {
          const nudge = `By the way, you've used ${newCount} of your ${caps.convos} monthly conversations. Plenty left — just keeping you posted.`;
          // Append as a system note after a small delay so it doesn't clash with the current reply
          setTimeout(() => {
            setMessages(prev => [...prev, { role: "assistant", content: nudge }]);
            if (handsFreeRef.current) speak(nudge);
          }, 2000);
        }
      }

      // Background: extract learnable facts from this exchange (non-blocking, non-critical)
      const lastUserMsg = updated.filter(m => m.role === "user").slice(-1)[0]?.content || "";
      if (lastUserMsg && finalReply && !isOnboardingTrigger) {
        extractAndStoreMemories(lastUserMsg, finalReply);
      }

      if (handsFreeRef.current) {
        speakQueue(spokenReply);
        // When TTS is OFF (user disabled it), speakQueue() returns immediately with no restart.
        // Restart mic directly after short delay so the loop keeps going.
        if (!ttsEnabledRef.current) restartMicAfterSpeak(800);
      } else {
        speakQueue(spokenReply);
      }
      return; // skip the setLoading(false) below

    } catch (e) {
      console.error("AI send error:", e);
      logError("tool_failure", {
        error_msg: e.message || "AI send error",
        context: "Claude API call failed",
        user_input: text?.slice(0, 300),
      });
      setMessages(prev => [...prev, { role: "assistant", content: `Connection error: ${e.message}. Check your internet connection and try again.` }]);
      if (handsFreeRef.current) restartMicAfterSpeak(1000);
    }
    setLoading(false);
  };

  // ── Session D — expose imperative voice handle to parent (Dashboard mic / hands-free / text) ──
  // voiceHandle is a ref owned by AppInner that Dashboard reads. We re-populate it on every
  // render so the closures over recording/handsFree/send/startRecording etc are always fresh.
  useEffect(() => {
    if (!voiceHandle) return;
    voiceHandle.current = {
      startVoice: () => {
        // Toggle behaviour: tap once to start, tap again to stop-and-send.
        if (recording) {
          stopRecording();
        } else {
          startRecording(true);
        }
      },
      toggleHandsFree: () => {
        setHandsFree(v => !v);
      },
      sendText: (text) => {
        if (!text || !text.trim()) return;
        // Populate the input visually so the conversation reads naturally,
        // then fire the existing send() path.
        setInput("");
        send(text);
      },
    };
  });

  // Notify parent when hands-free state changes so the Home button reflects real state.
  useEffect(() => {
    if (onHandsFreeChange) onHandsFreeChange(handsFree);
  }, [handsFree, onHandsFreeChange]);

  const micLabel = transcribing ? "⏳ Transcribing..." : recording ? "⏹ Tap to stop" : "🎙 Voice note";

  const actionIcons = { job: "📅", invoice: "💰", enquiry: "📩", reminder: "🔔", material: "🔧", job_card: "📋", mileage: "🚗", po: "📦" };

  // ── Home screen context ───────────────────────────────────────────────────
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = brand.ownerName || (brand.tradingName && !brand.tradingName.toLowerCase().includes("trade pa") && !brand.tradingName.toLowerCase().includes("trades") ? brand.tradingName.split(" ")[0] : "") || "there";
  const today = new Date().toDateString();
  const todayJobs = (jobs || []).filter(j => {
    const d = j.date || j.scheduled_date || j.created_at;
    return d && new Date(d).toDateString() === today;
  });
  const inProgressJobs = (jobs || []).filter(j => j.status === "in_progress");
  const safeInvoices = (invoices || []).filter(i => !i.isQuote);
  const outstandingInvoices = safeInvoices.filter(i => i.status !== "paid");
  const overdueInvoices = safeInvoices.filter(i => i.status === "overdue");
  const outstandingTotal = outstandingInvoices.reduce((s, i) => s + (parseFloat(i.grossAmount || i.amount) || 0), 0);
  const activeJobCount = inProgressJobs.length || todayJobs.length;

  const homeBriefing = (() => {
    if (overdueInvoices.length > 0) return `${overdueInvoices.length} overdue invoice${overdueInvoices.length !== 1 ? "s" : ""} need attention`;
    if (activeJobCount > 0) return `${activeJobCount} job${activeJobCount !== 1 ? "s" : ""} active today`;
    if (outstandingInvoices.length > 0) return `${outstandingInvoices.length} invoice${outstandingInvoices.length !== 1 ? "s" : ""} outstanding`;
    return "All clear — what do you need today?";
  })();

  const homeScanRef = useRef();
  const homeScanResult = useRef(null);
  const homeSubScanRef = useRef();

  const homeSubScanReceipt = async (file) => {
    if (!file) return;
    setMessages(prev => [...prev, { role: "user", content: "Scan this subcontractor invoice" }]);
    setLoading(true);
    try {
      const { fileContent } = await fileToContentBlock(file);
      const resp = await fetch("/api/claude", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          messages: [{ role: "user", content: [fileContent, { type: "text", text: SUB_INVOICE_SCAN_PROMPT }] }],
        }),
      });
      const data = await resp.json();
      const raw = data.content?.[0]?.text || "";
      const start = raw.indexOf("{"); const end = raw.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error("Could not read invoice");
      const parsed = JSON.parse(raw.slice(start, end + 1));
      pendingWidgetRef.current = { type: "sub_invoice_scan", data: { ...parsed, imageData: dataUrl } };
      setMessages(prev => [...prev, { role: "assistant", content: `Subcontractor invoice scanned. ${parsed.subcontractor_name ? parsed.subcontractor_name + " · " : ""}${parsed.invoice_number ? parsed.invoice_number + " · " : ""}Gross ${fmtCurrency((parsed.gross_total || 0))}. Go to the Subcontractors tab to review and save the payment.` }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "Couldn't read that invoice — try a clearer photo or PDF." }]);
    }
    setLoading(false);
  };

  const homeScanReceipt = async (file) => {
    if (!file || !onScanReceipt) return;
    setMessages(prev => [...prev, { role: "user", content: "Scan this receipt" }]);
    setLoading(true);
    try {
      const result = await onScanReceipt(file);
      if (result) {
        pendingWidgetRef.current = { type: "scan_result", data: result };
        setMessages(prev => [...prev, { role: "assistant", content: `Got it — here's what I found on the receipt from ${result.supplier || "the supplier"}. I've added ${result.items?.length || 1} item${(result.items?.length || 1) !== 1 ? "s" : ""} to your materials. Tap below to review.`, widget: { type: "scan_result", data: result } }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "Couldn't read that receipt — try a clearer photo or upload the PDF." }]);
    }
    setLoading(false);
  };

  const quickActions = [
    { label: "📋  New job card", msg: "I need to create a new job card" },
    { label: "💷  Create invoice", msg: "Create a new invoice" },
    { label: "⏱  Log labour", msg: "I need to log labour on a job" },
    { label: "🔧  Add materials", msg: "Add materials to a job" },
    { label: "🚗  Log mileage", msg: "Log mileage for a trip" },
    { label: "📊  How am I doing?", msg: "Give me a summary of how the business is doing" },
  ];

  const startSupport = () => {
    setSupportMode(true);
    send("I need help with the app");
  };

  const isHome = messages.length === 0 && !loading && !overlayContext;

  // Phase 2: unified voice state — 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking'.
  // Derived (not stored) so it can't drift from the underlying flags. Priority: speaking >
  // transcribing > thinking > listening > idle.  `loading` is AIAssistant's existing
  // "waiting on Claude" flag, remapped here as the thinking phase.
  const voiceState = isSpeaking ? "speaking"
                   : transcribing ? "transcribing"
                   : loading ? "thinking"
                   : recording ? "listening"
                   : "idle";

  // Token map — colour + label + ring animation per state. One place to tune.
  const voiceTokens = {
    idle:         { color: handsFree ? C.green : C.amber, label: handsFree ? "Hands-free ready" : "Tap to speak",        sub: handsFree ? "listening for you" : "ask me anything",                  ring: "idle",   spinner: false, wave: false },
    listening:    { color: C.red,                         label: "Listening — tap to stop",                              sub: "recording your voice",                             ring: "listen", spinner: false, wave: false },
    transcribing: { color: C.amber,                       label: "Transcribing…",                                         sub: "turning speech into text",                          ring: "none",   spinner: true,  wave: false },
    thinking:     { color: C.blue,                        label: "Thinking…",                                             sub: "Trade PA is working it out",                        ring: "none",   spinner: true,  wave: false },
    speaking:     { color: C.green,                       label: "Speaking",                                              sub: "tap mic to interrupt",                              ring: "speak",  spinner: false, wave: true  },
  };
  const vt = voiceTokens[voiceState];

  // Phase 5a: height token — 100% inside overlay sheet, full-page calc otherwise
  const _pageHeight = overlayContext ? "100%" : "calc(100dvh - 200px)";
  const _pageMinHeight = overlayContext ? 0 : 400;

  // Inner content — shared between page mode and overlay mode
  const _pageContent = (
    <div style={{ display: "flex", flexDirection: "column", height: _pageHeight, minHeight: _pageMinHeight, gap: 12, overflow: "hidden" }}>

      {/* Phase 2: unified keyframes — available in both home and chat views */}
      <style>{`
        @keyframes mic-listen-outer {
          0%   { transform: scale(1);    opacity: 0.8; }
          100% { transform: scale(1.35); opacity: 0;   }
        }
        @keyframes mic-speak-outer {
          0%,100% { transform: scale(1);    opacity: 0.55; }
          50%     { transform: scale(1.18); opacity: 0.9;  }
        }
        @keyframes mic-spin {
          0%   { transform: rotate(0deg);   }
          100% { transform: rotate(360deg); }
        }
        @keyframes typing-dot {
          0%, 60%, 100% { transform: translateY(0);    opacity: 0.4; }
          30%           { transform: translateY(-4px); opacity: 1;   }
        }
        @keyframes speak-wave {
          0%, 100% { transform: scaleY(0.4); }
          50%      { transform: scaleY(1);   }
        }
        @keyframes status-strip-in {
          0%   { transform: translateY(6px); opacity: 0; }
          100% { transform: translateY(0);   opacity: 1; }
        }
      `}</style>

      {/* ── Compact monthly-usage strip ─────────────────────────────────────
           Always visible at the top of AI Assistant (home + chat views).
           Tap to jump to Settings. Reads usageData/usageCaps already in props. */}
      {(() => {
        const convUsed = usageData?.conversations_used || 0;
        const convCap = usageCaps?.convos || 100;
        const convUnlimited = convCap === Infinity;
        const hfUsedMin = Math.round((usageData?.handsfree_seconds_used || 0) / 60);
        const hfCapMin = usageCaps?.hf_hours === Infinity ? Infinity : (usageCaps?.hf_hours || 1) * 60;
        const hfUnlimited = hfCapMin === Infinity;
        const worstPct = Math.max(
          convUnlimited ? 0 : convUsed / convCap,
          hfUnlimited   ? 0 : hfUsedMin / hfCapMin
        );
        const tintColor = worstPct >= 1 ? C.red : worstPct >= 0.8 ? C.amber : C.muted;
        return (
          <div
            onClick={() => setView && setView("Settings")}
            title="Tap to manage plan & billing"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              background: C.surfaceHigh,
              borderRadius: 6,
              fontSize: 10.5,
              fontFamily: "'DM Mono', monospace",
              cursor: "pointer",
              letterSpacing: "0.02em",
              color: tintColor,
              flexShrink: 0,
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
              {convUnlimited ? "UNLIMITED" : `${convUsed}/${convCap}`} convos
              {" · "}
              {hfUnlimited ? "UNLIMITED" : `${hfUsedMin}/${hfCapMin} min`} hands-free
            </span>
            <span style={{ opacity: 0.7, flexShrink: 0 }}>MANAGE →</span>
          </div>
        );
      })()}

      {/* ── HOME SCREEN ─────────────────────────────────────────────────── */}
      {isHome && (() => {
        // Compute Dashboard-style stats from AIAssistant's props
        const today = new Date(); today.setHours(0,0,0,0);
        const isSameDayHome = (a, b) => a && b && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
        const todayJobs = (jobs || []).filter(j => j.dateObj && isSameDayHome(new Date(j.dateObj), today));
        const allInvoices = (invoices || []).filter(i => !i.isQuote);
        const overdueInvoices = allInvoices.filter(i => i.status === "overdue" || i.status === "due");
        const overdueValue = overdueInvoices.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
        const newEnquiries = (enquiries || []).filter(e => !e.status || e.status === "new");
        // New greeting — no name, matches Dashboard mockup
        const hh = new Date().getHours();
        const morningGreeting = hh >= 5 && hh < 12 ? "Good morning."
                              : hh >= 12 && hh < 18 ? "Good afternoon."
                              : "Good evening.";
        const fmtStat = (v) => {
          if (v >= 1000) return `£${(v/1000).toFixed(v >= 10000 ? 0 : 1)}k`;
          return `£${Math.round(v).toLocaleString()}`;
        };
        return (
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 20, paddingBottom: 8 }}>

          {/* Greeting */}
          <div style={{ paddingTop: 4 }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", color: C.text, lineHeight: 1.1 }}>
              {morningGreeting}
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: C.muted, marginTop: 6 }}>
              Tap to talk, or pick an action below.
            </div>
          </div>

          {/* Pass B: Inbox Actions home card — AI has been watching the inbox
              and these actions are waiting for review. Session-dismissable via
              × (count stays on the stat tile either way). Tap the body to route
              to Inbox Actions for the full approve/dismiss flow. */}
          {pendingInboxActions.length > 0 && !inboxCardDismissed && (() => {
            const iconFor = (t) => ({ create_job: "📅", create_enquiry: "📩", mark_invoice_paid: "✅", update_job: "🔧", add_materials: "🔧", save_customer: "👤", accept_quote: "🤝", add_cis_statement: "🏗" }[t] || "⚡");
            const tintFor = (t) => ({ create_job: C.green, create_enquiry: C.blue, mark_invoice_paid: C.green, accept_quote: C.green, add_materials: C.muted, add_cis_statement: C.blue, save_customer: "#8b5cf6", update_job: C.amber }[t] || C.amber);
            const URG = { create_job: 5, accept_quote: 5, create_enquiry: 4, mark_invoice_paid: 3, save_customer: 2, update_job: 2, add_materials: 1, add_cis_statement: 1 };
            const sorted = [...pendingInboxActions].sort((a, b) => (URG[b.action_type] || 1) - (URG[a.action_type] || 1));
            const top = sorted.slice(0, 2);
            const more = sorted.length - top.length;
            const n = pendingInboxActions.length;
            return (
              <div
                style={{
                  background: `linear-gradient(135deg, ${C.amber}11, ${C.amber}05)`,
                  border: `1px solid ${C.amber}55`,
                  borderRadius: 14, padding: "14px 14px 12px",
                  display: "flex", flexDirection: "column", gap: 10,
                  position: "relative",
                }}
              >
                {/* Session-dismiss × — top-right */}
                <button
                  onClick={(e) => { e.stopPropagation(); setInboxCardDismissed(true); }}
                  aria-label="Hide until next app open"
                  title="Hide until next app open"
                  style={{
                    position: "absolute", top: 8, right: 8,
                    width: 24, height: 24, borderRadius: "50%",
                    border: "none", background: "transparent",
                    color: C.muted, cursor: "pointer",
                    display: "grid", placeItems: "center", padding: 0,
                    
                  }}
                ><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>

                <div onClick={() => setView("Inbox")} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", paddingRight: 24 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: C.amber + "22", border: `1px solid ${C.amber}66`, display: "grid", placeItems: "center", fontSize: 16, flexShrink: 0 }}>🔔</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>
                      I spotted {n} thing{n === 1 ? "" : "s"} in your inbox
                    </div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: C.muted, letterSpacing: "0.04em", marginTop: 2 }}>
                      Tap to review and approve →
                    </div>
                  </div>
                </div>
                <div onClick={() => setView("Inbox")} style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 44, cursor: "pointer" }}>
                  {top.map(a => (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.textDim, minWidth: 0 }}>
                      <span style={{ fontSize: 14, flexShrink: 0 }}>{iconFor(a.action_type)}</span>
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.action_description}</span>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: tintFor(a.action_type), flexShrink: 0 }} />
                    </div>
                  ))}
                  {more > 0 && (
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: C.muted, letterSpacing: "0.04em" }}>+ {more} more</div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* 3 stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            <div onClick={() => setView("Schedule")} style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 11px", cursor: "pointer" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: C.muted, letterSpacing: "0.1em", fontWeight: 700, textTransform: "uppercase" }}>TODAY</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: "-0.02em", marginTop: 4 }}>{todayJobs.length}</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: C.muted, marginTop: 2 }}>{todayJobs.length === 1 ? "job" : "jobs"}</div>
            </div>
            <div onClick={() => setView("Invoices")} style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 11px", cursor: "pointer" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: C.muted, letterSpacing: "0.1em", fontWeight: 700, textTransform: "uppercase" }}>OVERDUE</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: overdueValue > 0 ? C.amber : C.text, letterSpacing: "-0.02em", marginTop: 4 }}>{fmtStat(overdueValue)}</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: C.muted, marginTop: 2 }}>{overdueInvoices.length} {overdueInvoices.length === 1 ? "invoice" : "invoices"}</div>
            </div>
            <div onClick={() => setView("Inbox")} style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 11px", cursor: "pointer" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: C.muted, letterSpacing: "0.1em", fontWeight: 700, textTransform: "uppercase" }}>INBOX ACTIONS</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: pendingInboxActions.length > 0 ? C.amber : C.text, letterSpacing: "-0.02em", marginTop: 4 }}>{pendingInboxActions.length}</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: C.muted, marginTop: 2 }}>{pendingInboxActions.length === 1 ? "pending" : "pending"}</div>
            </div>
          </div>

          {/* Mic hero — Phase 2: 5-state morph (idle/listening/transcribing/thinking/speaking) */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "8px 0", gap: 18 }}>
            <div style={{ position: "relative", width: 170, height: 170 }}>
              {/* Idle pulse — soft radial halo */}
              {vt.ring === "idle" && (
                <div style={{
                  position: "absolute", inset: 0, borderRadius: "50%",
                  background: `radial-gradient(circle, ${vt.color}40 0%, ${vt.color}00 70%)`,
                  animation: "mic-pulse-home 2.6s ease-out infinite",
                  pointerEvents: "none",
                }} />
              )}
              {/* Listening ring — tighter red pulse */}
              {vt.ring === "listen" && (
                <div style={{
                  position: "absolute", inset: -6, borderRadius: "50%",
                  border: `3px solid ${vt.color}`,
                  animation: "mic-listen-outer 1.2s ease-out infinite",
                  pointerEvents: "none",
                }} />
              )}
              {/* Speaking ring — slow breathing halo */}
              {vt.ring === "speak" && (
                <div style={{
                  position: "absolute", inset: -4, borderRadius: "50%",
                  background: `radial-gradient(circle, ${vt.color}55 0%, ${vt.color}00 72%)`,
                  animation: "mic-speak-outer 1.8s ease-in-out infinite",
                  pointerEvents: "none",
                }} />
              )}
              {/* Spinner ring — transcribing / thinking */}
              {vt.spinner && (
                <div style={{
                  position: "absolute", inset: -4, borderRadius: "50%",
                  border: `3px solid ${vt.color}22`,
                  borderTopColor: vt.color,
                  animation: "mic-spin 0.9s linear infinite",
                  pointerEvents: "none",
                }} />
              )}
              <button
                onClick={() => { unlockAudio(); abortSpeech(); recording ? stopRecording() : startRecording(true); }}
                disabled={transcribing}
                aria-label={vt.label}
                style={{
                  position: "relative",
                  width: 170, height: 170, borderRadius: "50%",
                  background: voiceState === "listening" ? vt.color
                    : voiceState === "idle" && handsFree ? `linear-gradient(180deg, #34d399, ${C.green})`
                    : voiceState === "idle" ? `linear-gradient(180deg, ${C.amber}, #d97706)`
                    : voiceState === "speaking" ? `linear-gradient(180deg, #34d399, ${C.green})`
                    : voiceState === "thinking" ? `linear-gradient(180deg, #60a5fa, ${C.blue})`
                    : `linear-gradient(180deg, ${C.amber}, #d97706)`,
                  border: `3px solid ${vt.color}80`,
                  boxShadow: `0 12px 40px -8px ${vt.color}80, 0 0 0 16px ${vt.color}22`,
                  cursor: transcribing ? "default" : "pointer",
                  display: "grid", placeItems: "center",
                  color: "#000", padding: 0,
                  transition: "background 0.3s, border-color 0.3s, box-shadow 0.3s",
                }}
              >
                {voiceState === "listening" ? (
                  <div style={{ width: 34, height: 34, background: "#000", borderRadius: 8 }} />
                ) : voiceState === "speaking" ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, height: 40 }}>
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} style={{
                        width: 5, height: 24, borderRadius: 3, background: "#000",
                        animation: `speak-wave 0.9s ease-in-out ${i * 0.12}s infinite`,
                      }} />
                    ))}
                  </div>
                ) : (
                  <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                    <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
                  </svg>
                )}
              </button>
            </div>
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 15, fontWeight: 700,
                color: voiceState === "idle" && !handsFree ? C.text : vt.color,
                transition: "color 0.2s",
              }}>
                {vt.label}
              </div>
              <div style={{
                fontFamily: "'DM Mono', monospace", fontSize: 10,
                color: C.muted, letterSpacing: "0.08em",
              }}>
                {vt.sub}
              </div>
            </div>
          </div>

          {/* Bottom cluster — hands-free + quick actions (tighter spacing) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Hands-free row (only shown when NOT already in hands-free) */}
          {!handsFree && (
            <button
              onClick={toggleHandsFree}
              style={{
                background: C.surfaceHigh, border: `1px solid ${C.border}`,
                borderRadius: 12, padding: "12px 14px",
                display: "flex", alignItems: "center", gap: 12,
                cursor: "pointer", textAlign: "left",
                width: "100%",
              }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 9,
                background: C.surface, border: `1px solid ${C.border}`,
                display: "grid", placeItems: "center",
                flexShrink: 0,
              }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, color: C.text }}>Start hands-free</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: C.muted, marginTop: 2 }}>One tap, continuous voice mode</div>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
            </button>
          )}

          {/* Active hands-free pill */}
          {handsFree && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px",
              background: C.green + "14", border: `1px solid ${C.green}44`,
              borderRadius: 12,
              fontFamily: "'DM Mono', monospace", fontSize: 12, color: C.green,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.green, animation: "bellPulse 1.4s ease infinite" }} />
              <span style={{ fontWeight: 700, letterSpacing: "0.08em" }}>HANDS-FREE ON</span>
              <span style={{ marginLeft: "auto", color: C.muted, fontWeight: 500 }} onClick={toggleHandsFree}>tap to stop</span>
            </div>
          )}

          {/* Quick actions — 4 columns */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
            {(() => {
              const actionStyle = {
                background: C.surfaceHigh, border: `1px solid ${C.border}`,
                borderRadius: 11, padding: "12px 6px",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                cursor: "pointer", color: C.text,
              };
              const iconStyle = { color: C.amber };
              return (<>
                <button onClick={() => send("create a new job")} style={actionStyle}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={iconStyle}>
                    <path d="M12 4v16m8-8H4" />
                  </svg>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>New Job</span>
                </button>
                <button onClick={() => send("create a new quote")} style={actionStyle}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={iconStyle}>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8v8M8 12h8" />
                  </svg>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>New Quote</span>
                </button>
                <button onClick={() => homeScanRef.current?.click()} style={actionStyle}>
                  <input ref={homeScanRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={e => { homeScanReceipt(e.target.files?.[0]); e.target.value = ""; }} />
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={iconStyle}>
                    <path d="M3 7l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>Receipt</span>
                </button>
                <button onClick={() => send("log time on a job")} style={actionStyle}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={iconStyle}>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8v4l3 2" />
                  </svg>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>Log Time</span>
                </button>
              </>);
            })()}
          </div>
          </div>{/* /bottom cluster */}

          {/* Hidden subcontractor scan input (kept for voice tool trigger) */}
          <input ref={homeSubScanRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={e => { homeSubScanReceipt(e.target.files?.[0]); e.target.value = ""; }} />

          {/* Mic pulse keyframes */}
          <style>{`
            @keyframes mic-pulse-home {
              0% { transform: scale(1); opacity: 0.7; }
              100% { transform: scale(1.2); opacity: 0; }
            }
          `}</style>
        </div>
        );
      })()}

      {/* ── CHAT VIEW ───────────────────────────────────────────────────── */}
      {!isHome && (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={() => { setMessages([]); setSupportMode(false); }} style={{ padding: "5px 12px", background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 20, fontSize: 11, color: C.muted, cursor: "pointer" }}>🏠 Home</button>
            {supportMode && (
              <div style={{ padding: "4px 10px", background: C.blue + "22", border: `1px solid ${C.blue}44`, borderRadius: 20, fontSize: 11, color: C.blue, fontWeight: 600 }}>SUPPORT</div>
            )}
            <button onClick={toggleTts} style={{ padding: "5px 10px", background: ttsEnabled ? C.amber + "22" : C.surfaceHigh, border: `1px solid ${ttsEnabled ? C.amber + "44" : C.border}`, borderRadius: 20, fontSize: 13, cursor: "pointer" }}>
              {ttsEnabled ? "🔊" : "🔇"}
            </button>
          </div>

          {lastAction && (
            <div style={{ background: C.green + "18", border: `1px solid ${C.green}44`, borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
              <span style={{ fontSize: 16 }}>{actionIcons[lastAction.type] || "✅"}</span>
              <span style={{ color: C.green, fontWeight: 600 }}>{lastAction.label}</span>
              <span style={{ color: C.muted }}>saved</span>
              <button onClick={() => setView(lastAction.view)} style={{ ...S.btn("ghost"), fontSize: 11, padding: "3px 10px", marginLeft: "auto" }}>View →</button>
            </div>
          )}

          {expiryAlerts.length > 0 && (
            <div style={{ background: C.amber + "18", border: `1px solid ${C.amber}44`, borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
              onClick={() => send("Check my expiring documents")}>
              <span style={{ fontSize: 15 }}>⚠️</span>
              <span style={{ color: C.amber, fontWeight: 600, fontSize: 12 }}>
                {expiryAlerts.length} worker cert{expiryAlerts.length !== 1 ? "s" : ""} expiring within 30 days
              </span>
              <span style={{ color: C.muted, fontSize: 11, marginLeft: "auto" }}>Tap to review →</span>
            </div>
          )}

          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 0" }}>
            {messages.map((m, i) => (
              <div key={i}>
                {m.kind === "iteration_cap" ? (
                  // High-visibility amber-bordered card. Distinct from regular
                  // assistant bubbles so the user can't miss "some of what you
                  // asked may not have finished." Visual language matches the
                  // global C.amber accent without being alarming-red, since
                  // partial success isn't a failure.
                  <div style={{
                    margin: "8px 4px 12px 44px",
                    background: "rgba(245,158,11,0.08)",
                    border: `1px solid ${C.amber}`,
                    borderRadius: 10,
                    padding: "12px 14px",
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                  }}>
                    <div style={{ fontSize: 18, lineHeight: 1.1, flexShrink: 0 }}>⏱️</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.amber, fontFamily: "'DM Mono', ui-monospace, monospace", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 4 }}>
                        Processing limit reached
                      </div>
                      <div style={{ fontSize: 13, color: C.text, lineHeight: 1.45 }}>
                        {m.content}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={S.aiMsg(m.role)}>
                    <div style={S.avatar(m.role)}>{m.role === "user" ? (brand.tradingName?.[0] || "U") : "⚡"}</div>
                    <div style={S.aiBubble(m.role)}>{m.content}</div>
                  </div>
                )}
                {m.widget && (
                  <div style={{ paddingLeft: 44, paddingRight: 4, marginBottom: 8 }}>
                    {(m.widget.type === "invoice" || m.widget.type === "quote") && (() => {
                      const inv = m.widget.data;
                      const isQ = inv.isQuote || m.widget.type === "quote";
                      const total = parseFloat(inv.grossAmount || inv.amount || 0);
                      const lines = (inv.lineItems || []).length > 0 ? inv.lineItems : (inv.description || "").split("\n").filter(Boolean).map(l => { const [desc, amt] = l.split("|"); return { description: desc, amount: parseFloat(amt) || 0 }; });
                      return (
                        <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div>
                              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{isQ ? "Quote" : "Invoice"}</div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginTop: 2 }}>{inv.id}</div>
                              <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>{inv.customer}</div>
                              <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                                {inv.paymentMethod === "bacs" ? "🏦 Bank transfer only" : inv.paymentMethod === "card" ? "💳 Card only" : "🏦💳 Bank + Card"}
                                {inv.vatEnabled ? " · VAT " + (inv.vatRate || 20) + "%" : ""}
                              </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 18, fontWeight: 700, color: C.amber }}>£{total.toFixed(2)}</div>
                              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{inv.due}</div>
                              <div style={{ fontSize: 10, color: inv.status === "paid" ? C.green : inv.status === "overdue" ? C.red : C.muted, marginTop: 2 }}>{inv.status}</div>
                            </div>
                          </div>
                          {lines.length > 0 && (
                            <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}` }}>
                              {lines.map((l, li) => (
                                <div key={li} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.textDim, paddingBottom: li < lines.length - 1 ? 6 : 0 }}>
                                  <span>{l.description || l.desc}</span>
                                  <span>£{(l.amount || 0).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <div style={{ padding: "10px 14px", display: "flex", gap: 8 }}>
                            <button onClick={() => onShowPdf && onShowPdf(inv)} style={{ flex: 1, padding: "8px", background: C.amber + "22", border: `1px solid ${C.amber}44`, borderRadius: 10, color: C.amber, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>
                              📄 View PDF
                            </button>
                            <button onClick={() => send("Update invoice " + inv.id + " for " + inv.customer)} style={{ flex: 1, padding: "8px", background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>
                              ✏ Edit invoice
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                    {m.widget.type === "job_card" && (() => {
                      const job = m.widget.data;
                      return (
                        <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                            <div>
                              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Job Card</div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginTop: 2 }}>{job.title || job.type || "Job"}</div>
                              <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>{job.customer}</div>
                            </div>
                            {job.value > 0 && <div style={{ fontSize: 16, fontWeight: 700, color: C.amber }}>£{parseFloat(job.value).toFixed(2)}</div>}
                          </div>
                          {job.address && <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>📍 {job.address}</div>}
                          {job.notes && <div style={{ fontSize: 11, color: C.muted, fontStyle: "italic", marginBottom: 8 }}>{job.notes}</div>}
                          {job.scope_of_work && <div style={{ fontSize: 11, color: C.textDim, background: C.surface, borderRadius: 10, padding: "8px 10px", marginBottom: 8 }}>{job.scope_of_work}</div>}
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 10, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "3px 8px", color: C.muted }}>{(job.status || "new").replace(/_/g, " ")}</span>
                            {job.type && <span style={{ fontSize: 10, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "3px 8px", color: C.muted }}>{job.type}</span>}
                          </div>
                        </div>
                      );
                    })()}
                    {m.widget.type === "invoice_list" && (
                      <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Invoices ({m.widget.data.length})</div>
                        {m.widget.data.map((inv, li) => (
                          <div key={li} onClick={() => onShowPdf && onShowPdf(inv)} style={{ padding: "12px 14px", borderBottom: li < m.widget.data.length - 1 ? `1px solid ${C.border}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{inv.id} · {inv.customer}</div>
                              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{inv.due}</div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: inv.status === "paid" ? C.green : inv.status === "overdue" ? C.red : C.amber }}>£{parseFloat(inv.grossAmount || inv.amount || 0).toFixed(2)}</div>
                              <div style={{ fontSize: 10, color: C.muted }}>{inv.status}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {m.widget.type === "job_list" && (
                      <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Jobs ({m.widget.data.length})</div>
                        {m.widget.data.map((job, li) => (
                          <div key={li} style={{ padding: "12px 14px", borderBottom: li < m.widget.data.length - 1 ? `1px solid ${C.border}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{job.title || job.type || "Job"} · {job.customer}</div>
                              {job.address && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>📍 {job.address}</div>}
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
                              {job.value > 0 && <div style={{ fontSize: 13, fontWeight: 700, color: C.amber }}>£{parseFloat(job.value).toFixed(0)}</div>}
                              <div style={{ fontSize: 10, color: C.muted }}>{(job.status || "new").replace(/_/g, " ")}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {m.widget.type === "material_list" && (
                      <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Materials ({m.widget.data.length})</div>
                        {m.widget.data.map((mat, li) => (
                          <div key={li} style={{ padding: "12px 14px", borderBottom: li < m.widget.data.length - 1 ? `1px solid ${C.border}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{mat.item}</div>
                              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{mat.supplier}{mat.job ? ` · ${mat.job}` : ""}</div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
                              <div style={{ fontSize: 11, color: C.text }}>×{mat.qty}</div>
                              <div style={{ fontSize: 10, color: mat.status === "to_order" ? C.red : mat.status === "ordered" ? C.amber : C.green }}>{mat.status?.replace(/_/g, " ")}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {m.widget.type === "scan_result" && (() => {
                      const r = m.widget.data;
                      return (
                        <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.border}` }}>
                            <div style={{ fontSize: 12, fontWeight: 700 }}>{r.supplier || "Receipt"}</div>
                            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                              {r.date && <span>{r.date} · </span>}
                              {r.items?.length || 0} item{(r.items?.length || 0) !== 1 ? "s" : ""} · Total £{(r.total || 0).toFixed(2)}
                            </div>
                          </div>
                          {(r.items || []).map((item, li) => (
                            <div key={li} style={{ padding: "10px 14px", borderBottom: li < (r.items.length - 1) ? `1px solid ${C.border}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <div style={{ fontSize: 12, color: C.text }}>{item.item}</div>
                                {item.qty > 1 && <div style={{ fontSize: 11, color: C.muted }}>×{item.qty}</div>}
                              </div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: C.amber }}>£{((item.unitPriceExVat || item.unitPrice || 0) * (item.qty || 1)).toFixed(2)}</div>
                            </div>
                          ))}
                          {r.receiptImage && (
                            <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.border}` }}>
                              <img src={r.receiptImage} alt="Receipt" style={{ width: "100%", borderRadius: 10 }} />
                            </div>
                          )}
                          <div style={{ padding: "10px 14px", background: C.green + "11", borderTop: `1px solid ${C.border}` }}>
                            <div style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>✓ Added to your materials</div>
                          </div>
                        </div>
                      );
                    })()}
                    {m.widget.type === "material_receipt" && (() => {
                      const mat = m.widget.data;
                      const img = mat.resolvedImage;
                      // PDF detection: signed URLs end in .pdf?token=..., dataURLs start with data:application/pdf
                      const isPdf = img && (img.toLowerCase().includes(".pdf") || img.startsWith("data:application/pdf"));
                      return (
                        <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700 }}>{mat.item}</div>
                              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{mat.supplier}{mat.unitPrice > 0 ? ` · ${fmtCurrency((mat.unitPrice * mat.qty))}` : ""}</div>
                            </div>
                            <div style={{ fontSize: 10, color: mat.status === "to_order" ? C.red : mat.status === "ordered" ? C.amber : C.green }}>{mat.status?.replace(/_/g, " ")}</div>
                          </div>
                          {img ? (
                            isPdf ? (
                              <div style={{ background: "#fff", padding: 8 }}>
                                <iframe
                                  src={img}
                                  title="Receipt PDF"
                                  style={{ width: "100%", height: 480, border: "none", background: "#fff" }}
                                />
                              </div>
                            ) : (
                              <div style={{ background: "#fff" }}>
                                <img src={img} alt="Receipt" style={{ width: "100%", display: "block", borderRadius: "0 0 10px 10px" }} />
                              </div>
                            )
                          ) : mat.receiptSource === "email" ? (
                            <div style={{ padding: "14px", fontSize: 12, color: C.muted, fontStyle: "italic" }}>
                              📧 Invoice received via email — open your Inbox to view the original.
                            </div>
                          ) : (
                            <div style={{ padding: "14px", fontSize: 12, color: C.muted, fontStyle: "italic" }}>No receipt image available.</div>
                          )}
                        </div>
                      );
                    })()}
                    {m.widget.type === "schedule_list" && (
                      <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                        <div style={{ padding: "10px 14px", borderBottom: m.widget.data.length > 0 ? `1px solid ${C.border}` : "none", fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          Schedule — {m.widget.data.length === 0 ? "Nothing booked" : `${m.widget.data.length} job${m.widget.data.length !== 1 ? "s" : ""}`}
                        </div>
                        {m.widget.data.map((job, li) => (
                          <div key={li} style={{ padding: "12px 14px", borderBottom: li < m.widget.data.length - 1 ? `1px solid ${C.border}` : "none", display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ flexShrink: 0, textAlign: "center", minWidth: 44 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: C.amber }}>{job.dateObj ? new Date(job.dateObj).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—"}</div>
                              <div style={{ fontSize: 10, color: C.muted }}>{job.dateObj ? new Date(job.dateObj).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" }) : ""}</div>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{job.customer}</div>
                              <div style={{ fontSize: 11, color: C.muted }}>{job.type || job.title}{job.address ? " · " + job.address : ""}</div>
                            </div>
                            {job.value > 0 && <div style={{ fontSize: 12, fontWeight: 700, color: C.amber, flexShrink: 0 }}>{fmtAmount(job.value)}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                    {m.widget.type === "job_full" && (() => {
                      const job = m.widget.data;
                      const expanded = expandedWidget === i || expandedWidget === null;
                      const hasDetails = true; // always show all available data
                      return (
                        <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                          {/* Header */}
                          <div onClick={() => setExpandedWidget(expanded ? -1 : i)} style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer" }}>
                            <div>
                              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Job Card</div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginTop: 2 }}>{job.title || job.type || "Job"}</div>
                              <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>{job.customer}</div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              {job.value > 0 && <div style={{ fontSize: 15, fontWeight: 700, color: C.amber }}>£{parseFloat(job.value).toLocaleString()}</div>}
                              {hasDetails && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{expanded ? "▲ Less" : "▼ Full details"}</div>}
                            </div>
                          </div>
                          {/* Always-visible summary */}
                          {job.address && <div style={{ padding: "8px 14px", borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.textDim }}>📍 {job.address}</div>}
                          {job.notes && typeof job.notes === "string" && <div style={{ padding: "8px 14px", borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.textDim }}>{job.notes}</div>}
                          {job.scope_of_work && <div style={{ padding: "8px 14px", borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.textDim }}><span style={{ color: C.muted, fontSize: 10, display: "block", marginBottom: 2 }}>SCOPE</span>{job.scope_of_work}</div>}
                          {/* Expanded detail */}
                          {expanded && (
                            <div style={{ borderTop: `1px solid ${C.border}` }}>
                              {/* Card-level fields */}
                              {job.status && <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 11, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "3px 10px", color: C.textDim }}>{job.status?.replace(/_/g," ")}</span>
                                {job.type && job.type !== job.title && <span style={{ fontSize: 11, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "3px 10px", color: C.textDim }}>{job.type}</span>}
                                {job.po_number && <span style={{ fontSize: 11, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "3px 10px", color: C.muted }}>PO: {job.po_number}</span>}
                              </div>}
                              {job.scope_of_work && <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}` }}>
                                <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Scope of Work</div>
                                <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.5 }}>{job.scope_of_work}</div>
                              </div>}
                              {/* Job notes (string field on card) */}
                              {job.notes && typeof job.notes === "string" && job.notes.trim() && <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}` }}>
                                <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Notes</div>
                                <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.5 }}>{job.notes}</div>
                              </div>}
                              {/* Job notes from notes table */}
                              {job.jobNotes?.length > 0 && <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}` }}>
                                <div style={{ fontSize: 10, color: C.muted, marginBottom: 6 }}>JOB NOTES ({job.jobNotes.length})</div>
                                {job.jobNotes.map((n,ni) => <div key={ni} style={{ fontSize: 12, color: C.textDim, paddingBottom: 4 }}>· {n.note || n}</div>)}
                              </div>}
                              {job.timeLogs?.length > 0 && <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}` }}>
                                <div style={{ fontSize: 10, color: C.muted, marginBottom: 6 }}>LABOUR ({job.timeLogs.length} entries · £{job.timeLogs.reduce((s,t) => s + parseFloat(t.total || (t.hours||0)*(t.rate||0) || 0), 0).toFixed(2)})</div>
                                {job.timeLogs.map((t,ti) => <div key={ti} style={{ fontSize: 12, color: C.textDim, paddingBottom: 4 }}>· {t.labour_type === "day_rate" ? `${t.days} days @ ${fmtAmount(t.rate)}/day` : `${t.hours}hrs @ ${fmtAmount(t.rate)}/hr`} — £{parseFloat(t.total || (t.hours||0)*(t.rate||0)).toFixed(2)}</div>)}
                              </div>}
                              {job.linkedMaterials?.length > 0 && <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}` }}>
                                <div style={{ fontSize: 10, color: C.muted, marginBottom: 6 }}>MATERIALS ({job.linkedMaterials.length})</div>
                                {job.linkedMaterials.map((mat,mi) => <div key={mi} style={{ fontSize: 12, color: C.textDim, paddingBottom: 4 }}>· {mat.item} ×{mat.qty}{mat.supplier ? ` — ${mat.supplier}` : ""}{mat.unitPrice > 0 ? ` · ${fmtCurrency(((mat.unitPrice||0)*(mat.qty||1)))}` : ""}</div>)}
                              </div>}
                              {job.drawings?.length > 0 && <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}` }}>
                                <div style={{ fontSize: 10, color: C.muted, marginBottom: 6 }}>DRAWINGS ({job.drawings.length})</div>
                                {job.drawings.map((d,di) => <div key={di} style={{ fontSize: 12, color: C.amber, paddingBottom: 4 }}>📐 {d.filename}</div>)}
                              </div>}
                              {job.vos?.length > 0 && <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}` }}>
                                <div style={{ fontSize: 10, color: C.muted, marginBottom: 6 }}>VARIATION ORDERS ({job.vos.length} · £{job.vos.reduce((s,v) => s + parseFloat(v.amount||0), 0).toFixed(2)})</div>
                                {job.vos.map((v,vi) => <div key={vi} style={{ fontSize: 12, color: C.textDim, paddingBottom: 4 }}>· {v.vo_number ? v.vo_number + " — " : ""}{v.description} — £{parseFloat(v.amount||0).toFixed(2)}</div>)}
                              </div>}
                              {job.docs?.length > 0 && <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}` }}>
                                <div style={{ fontSize: 10, color: C.muted, marginBottom: 6 }}>CERTIFICATES ({job.docs.length})</div>
                                {job.docs.map((d,di) => <div key={di} style={{ fontSize: 12, color: C.textDim, paddingBottom: 4 }}>📄 {d.doc_type}{d.doc_number ? " · " + d.doc_number : ""}{d.expiry_date ? ` · Expires ${d.expiry_date}` : ""}</div>)}
                              </div>}
                              <div style={{ display: "flex", gap: 8, padding: "10px 14px" }}>
                                <button onClick={() => send("Update " + job.customer + "'s job card")} style={{ ...S.btn("primary"), flex: 1, justifyContent: "center", fontSize: 12 }}>✏ Edit this job</button>
                                <button onClick={() => setView("Jobs")} style={{ ...S.btn("ghost"), fontSize: 12 }}>Open in Jobs tab →</button>
                              </div>
                            </div>
                          )}
                          {/* Action buttons — always visible */}
                          {!expanded && (
                            <div style={{ display: "flex", gap: 8, padding: "10px 14px", borderTop: `1px solid ${C.border}` }}>
                              <button onClick={() => setExpandedWidget(i)} style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", fontSize: 12 }}>▼ Full details</button>
                              <button onClick={() => send("Update " + job.customer + "'s job card")} style={{ ...S.btn("ghost"), fontSize: 12 }}>✏ Edit</button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {m.widget.type === "job_profit" && (() => {
                      const d = m.widget.data;
                      const fmt = (n) => "£" + parseFloat(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                      const pct = (n, t) => t > 0 ? ((n/t)*100).toFixed(0) + "%" : "0%";
                      const isProfit = d.grossProfit >= 0;
                      return (
                        <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                          {/* Header */}
                          <div style={{ padding: "10px 14px", background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>PROFIT BREAKDOWN</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginTop: 2 }}>{d.title}</div>
                            <div style={{ fontSize: 12, color: C.textDim }}>{d.customer}</div>
                          </div>
                          {/* Revenue */}
                          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}` }}>
                            <div style={{ fontSize: 10, color: C.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>REVENUE</div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                              <span style={{ color: C.textDim }}>Job value</span>
                              <span style={{ color: C.text, fontWeight: 600 }}>{fmt(d.jobValue)}</span>
                            </div>
                            {d.voIncome > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 3 }}>
                              <span style={{ color: C.textDim }}>Variation orders</span>
                              <span style={{ color: C.text }}>+{fmt(d.voIncome)}</span>
                            </div>}
                            {d.voIncome > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${C.border}` }}>
                              <span style={{ color: C.textDim, fontWeight: 600 }}>Total revenue</span>
                              <span style={{ color: C.amber, fontWeight: 700 }}>{fmt(d.totalRevenue)}</span>
                            </div>}
                          </div>
                          {/* Costs */}
                          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}` }}>
                            <div style={{ fontSize: 10, color: C.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>COSTS</div>
                            {d.labourCost > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                              <span style={{ color: C.textDim }}>Labour ({d.labourEntries?.length || 0} {(d.labourEntries?.length || 0) === 1 ? "entry" : "entries"})</span>
                              <span style={{ color: C.text }}>{fmt(d.labourCost)}</span>
                            </div>}
                            {d.materialCost > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                              <span style={{ color: C.textDim }}>Materials ({d.materialEntries?.length || 0} items)</span>
                              <span style={{ color: C.text }}>{fmt(d.materialCost)}</span>
                            </div>}
                            {d.dayworkCost > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                              <span style={{ color: C.textDim }}>Daywork</span>
                              <span style={{ color: C.text }}>{fmt(d.dayworkCost)}</span>
                            </div>}
                            {d.expenseCost > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                              <span style={{ color: C.textDim }}>Expenses</span>
                              <span style={{ color: C.text }}>{fmt(d.expenseCost)}</span>
                            </div>}
                            {d.subcontractorCost > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                              <span style={{ color: C.textDim }}>Subcontractors ({d.subPaymentCount || 1} payment{(d.subPaymentCount || 1) !== 1 ? "s" : ""})</span>
                              <span style={{ color: C.text }}>{fmt(d.subcontractorCost)}</span>
                            </div>}
                            {d.totalCosts === 0 && <div style={{ fontSize: 12, color: C.muted }}>No costs logged yet — add labour, materials or expenses to this job.</div>}
                            {d.totalCosts > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${C.border}` }}>
                              <span style={{ color: C.textDim, fontWeight: 600 }}>Total costs</span>
                              <span style={{ color: C.text, fontWeight: 700 }}>{fmt(d.totalCosts)}</span>
                            </div>}
                          </div>
                          {/* Gross Profit */}
                          <div style={{ padding: "12px 14px", background: isProfit ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)", borderBottom: `1px solid ${C.border}` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>GROSS PROFIT</div>
                                <div style={{ fontSize: 22, fontWeight: 700, color: isProfit ? "#22c55e" : "#ef4444", marginTop: 2 }}>{fmt(d.grossProfit)}</div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>MARGIN</div>
                                <div style={{ fontSize: 22, fontWeight: 700, color: isProfit ? "#22c55e" : "#ef4444", marginTop: 2 }}>{d.margin}%</div>
                              </div>
                            </div>
                            {/* Margin bar */}
                            <div style={{ background: C.border, borderRadius: 4, height: 6, marginTop: 10, overflow: "hidden" }}>
                              <div style={{ width: Math.min(100, Math.max(0, parseFloat(d.margin))) + "%", height: "100%", background: isProfit ? "#22c55e" : "#ef4444", borderRadius: 4, transition: "width 0.3s" }} />
                            </div>
                          </div>
                          {/* No costs warning */}
                          {d.totalCosts === 0 && <div style={{ padding: "8px 14px", fontSize: 11, color: C.muted }}>
                            💡 Tip: Log your labour and materials to this job to track real profit.
                          </div>}
                        </div>
                      );
                    })()}
                    {m.widget.type === "worker_list" && (() => {
                      const workers = m.widget.data || [];
                      return (
                        <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                          <div style={{ padding: "10px 14px", background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>WORKERS ({workers.length})</div>
                          </div>
                          {workers.map((w, i) => (
                            <div key={i} style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{w.name}</div>
                                <div style={{ fontSize: 11, color: C.muted }}>
                                  {w.role && `${w.role} · `}
                                  <span style={{ color: w.type === "employed" ? C.green : C.amber }}>{w.type === "employed" ? "Employed" : "Subcontractor"}</span>
                                </div>
                              </div>
                              <div style={{ textAlign: "right", fontSize: 11, color: C.muted }}>
                                {w.day_rate > 0 && <div>{fmtAmount(w.day_rate)}/day</div>}
                                {w.hourly_rate > 0 && <div>{fmtAmount(w.hourly_rate)}/hr</div>}
                                {w.utr && <div style={{ color: C.muted }}>UTR: {w.utr}</div>}
                              </div>
                            </div>
                          ))}
                          <div style={{ padding: "10px 14px" }}>
                            <button onClick={() => send("Add a worker")} style={{ ...S.btn("ghost"), fontSize: 12 }}>+ Add worker</button>
                          </div>
                        </div>
                      );
                    })()}
                    {m.widget.type === "expiring_docs" && (() => {
                      const docs = m.widget.data || [];
                      const expired = docs.filter(d => d.status === "expired");
                      const expiring = docs.filter(d => d.status === "expiring");
                      return (
                        <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                          <div style={{ padding: "10px 14px", background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                              DOCUMENTS {expired.length > 0 && <span style={{ color: "#ef4444" }}>— {expired.length} EXPIRED</span>}
                            </div>
                          </div>
                          {docs.map((d, i) => {
                            const isExpired = d.status === "expired";
                            const daysLeft = Math.ceil((new Date(d.expiry_date) - new Date()) / 86400000);
                            return (
                              <div key={i} style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{d.team_members?.name || "Unknown"}</div>
                                  <div style={{ fontSize: 11, color: C.muted }}>{(d.doc_type || "").replace(/_/g," ").toUpperCase()}{d.doc_number ? ` · ${d.doc_number}` : ""}</div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: isExpired ? "#ef4444" : daysLeft <= 14 ? C.amber : C.text }}>
                                    {isExpired ? "EXPIRED" : `${daysLeft}d left`}
                                  </div>
                                  <div style={{ fontSize: 10, color: C.muted }}>{new Date(d.expiry_date).toLocaleDateString("en-GB")}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                    {m.widget.type === "rams_hazard_cats" && (
                      <div style={{ background: C.surfaceHigh, border: `1px solid ${C.amber}44`, borderRadius: 10, padding: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.amber, marginBottom: 10 }}>📋 RAMS — Choose hazard categories</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {(m.widget.data.categories || []).map((cat, i) => (
                            <button key={i} onClick={() => send(`${cat}`)}
                              style={{ padding: "8px 12px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 11, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>
                              {cat}
                            </button>
                          ))}
                        </div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 10 }}>Tap categories or just describe the work — I'll match them up.</div>
                      </div>
                    )}
                    {m.widget.type === "rams_hazard_review" && (() => {
                      const d = m.widget.data;
                      const bycat = (d._chosen_cats || []).map(cat => ({ cat, hazards: d._pending_hazards?.filter(h => h.category === cat) || [] }));
                      return (
                        <div style={{ background: C.surfaceHigh, border: `1px solid ${C.amber}44`, borderRadius: 10, overflow: "hidden" }}>
                          <div style={{ padding: "10px 14px", background: C.amber + "18", borderBottom: `1px solid ${C.amber}33` }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: C.amber }}>📋 Hazard Review — {d._pending_hazards?.length || 0} hazards</div>
                          </div>
                          {bycat.map(({ cat, hazards }) => (
                            <div key={cat} style={{ padding: "8px 14px", borderBottom: `1px solid ${C.border}` }}>
                              <div style={{ fontSize: 10, color: C.amber, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>{cat}</div>
                              {hazards.map((h, i) => (
                                <div key={i} style={{ fontSize: 11, color: C.textDim, paddingBottom: 4, display: "flex", gap: 6, alignItems: "flex-start" }}>
                                  <span style={{ color: h.risk === "Critical" ? C.red : h.risk === "High" ? "#f97316" : C.amber, flexShrink: 0, fontSize: 9, marginTop: 2 }}>●</span>
                                  <span>{h.hazard} <span style={{ color: C.muted }}>({h.risk})</span></span>
                                </div>
                              ))}
                            </div>
                          ))}
                          <div style={{ padding: "10px 14px", display: "flex", gap: 8 }}>
                            <button onClick={() => send("confirmed")} style={{ ...S.btn("primary"), flex: 1, justifyContent: "center", fontSize: 12 }}>✓ Confirm all</button>
                            <button onClick={() => send("remove ")} style={{ ...S.btn("ghost"), fontSize: 12 }}>Remove some</button>
                          </div>
                        </div>
                      );
                    })()}
                    {(m.widget.type === "rams_step1" || m.widget.type === "rams_step2" || m.widget.type === "rams_step3" || m.widget.type === "rams_step4" || m.widget.type === "rams_step5") && (() => {
                      const d = m.widget.data;
                      const stepNum = parseInt(m.widget.type.replace("rams_step",""));
                      const stepLabels = ["","Project Details","Hazards","Method Statement","COSHH","Welfare & Emergency"];
                      return (
                        <div style={{ background: C.surfaceHigh, border: `1px solid ${C.amber}44`, borderRadius: 10, overflow: "hidden" }}>
                          <div style={{ padding: "10px 14px", background: C.amber + "18", borderBottom: `1px solid ${C.amber}33`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: C.amber }}>📋 RAMS — Step {stepNum}/5</div>
                            <div style={{ fontSize: 10, color: C.muted }}>{stepLabels[stepNum]}</div>
                          </div>
                          <div style={{ padding: "10px 14px" }}>
                            <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                              {[1,2,3,4,5].map(s => (
                                <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: s <= stepNum ? C.amber : C.border }} />
                              ))}
                            </div>
                            {d.title && <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{d.title}</div>}
                            {d.site_address && <div style={{ fontSize: 11, color: C.muted }}>📍 {d.site_address}</div>}
                            {stepNum >= 2 && d.selected_hazards?.length > 0 && <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>⚠️ {d.selected_hazards.length} hazards selected</div>}
                            {stepNum >= 3 && d.selected_method_steps?.length > 0 && <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>📝 {d.selected_method_steps.length} method steps</div>}
                            {stepNum >= 4 && <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>🧪 COSHH: {d.coshh_substances?.length > 0 ? d.coshh_substances.join(", ") : "None"}</div>}
                          </div>
                        </div>
                      );
                    })()}
                    {m.widget.type === "rams_complete" && (
                      <div style={{ background: C.surfaceHigh, border: `1px solid ${C.green}44`, borderRadius: 10, overflow: "hidden" }}>
                        <div style={{ padding: "12px 14px", background: C.green + "11", borderBottom: `1px solid ${C.green}33` }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.green }}>✓ RAMS Complete & Saved</div>
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{m.widget.data.title}</div>
                        </div>
                        <div style={{ padding: "10px 14px" }}>
                          {m.widget.data.site_address && <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4 }}>📍 {m.widget.data.site_address}</div>}
                          <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                            {[1,2,3,4,5].map(s => <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: C.green }} />)}
                          </div>
                          <button onClick={() => setView("RAMS")} style={{ ...S.btn("ghost"), marginTop: 10, width: "100%", justifyContent: "center", fontSize: 12 }}>View & Export PDF in RAMS tab →</button>
                        </div>
                      </div>
                    )}
                    {m.widget.type === "expense_entry" && (
                      <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px" }}>
                        <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Expense Logged</div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{m.widget.data.description}</div>
                            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{m.widget.data.exp_type} · {m.widget.data.exp_date}</div>
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: C.amber }}>£{parseFloat(m.widget.data.amount||0).toFixed(2)}</div>
                        </div>
                      </div>
                    )}
                    {m.widget.type === "expense_list" && (
                      <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                        <div style={{ padding: "9px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Expenses ({m.widget.data.length})</div>
                        {m.widget.data.slice(0,10).map((e,i) => (
                          <div key={i} style={{ padding: "10px 14px", borderBottom: i < m.widget.data.length-1 ? `1px solid ${C.border}` : "none", display: "flex", justifyContent: "space-between" }}>
                            <div><div style={{ fontSize: 12, fontWeight: 600 }}>{e.description}</div><div style={{ fontSize: 11, color: C.muted }}>{e.exp_type} · {e.exp_date}</div></div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: C.amber }}>£{parseFloat(e.amount||0).toFixed(2)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {m.widget.type === "cis_statement" && (
                      <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px" }}>
                        <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>CIS Statement</div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{m.widget.data.contractor_name}</div>
                        {[["Gross",m.widget.data.gross_amount],["Deduction",m.widget.data.deduction_amount],["Net Payable",m.widget.data.net_amount]].map(([l,v],i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderTop: i>0 ? `1px solid ${C.border}` : "none" }}>
                            <span style={{ color: C.muted }}>{l}</span>
                            <span style={{ fontWeight: i===2 ? 700 : 400, color: i===2 ? C.green : C.text }}>£{parseFloat(v||0).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {m.widget.type === "cis_list" && (
                      <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                        <div style={{ padding: "9px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>CIS Statements ({m.widget.data.length})</div>
                        {m.widget.data.map((s,i) => (
                          <div key={i} style={{ padding: "10px 14px", borderBottom: i < m.widget.data.length-1 ? `1px solid ${C.border}` : "none", display: "flex", justifyContent: "space-between" }}>
                            <div><div style={{ fontSize: 12, fontWeight: 600 }}>{s.contractor_name}</div><div style={{ fontSize: 11, color: C.muted }}>{s.tax_month?.slice(0,7)}</div></div>
                            <div style={{ textAlign: "right" }}><div style={{ fontSize: 12, color: C.text }}>£{parseFloat(s.gross_amount||0).toFixed(2)}</div><div style={{ fontSize: 11, color: C.red }}>-£{parseFloat(s.deduction_amount||0).toFixed(2)}</div></div>
                          </div>
                        ))}
                      </div>
                    )}
                    {(m.widget.type === "subcontractor_entry" || m.widget.type === "subcontractor_list") && (
                      <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                        <div style={{ padding: "9px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          {m.widget.type === "subcontractor_list" ? `Subcontractors (${m.widget.data.length})` : "Subcontractor Added"}
                        </div>
                        {(m.widget.type === "subcontractor_list" ? m.widget.data : [m.widget.data]).map((s,i) => (
                          <div key={i} style={{ padding: "10px 14px", borderBottom: i < (m.widget.type === "subcontractor_list" ? m.widget.data.length : 1)-1 ? `1px solid ${C.border}` : "none" }}>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>{s.name}{s.company ? ` · ${s.company}` : ""}</div>
                            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>CIS {s.cis_rate}%{s.utr ? ` · UTR: ${s.utr}` : ""}{s.phone ? ` · ${s.phone}` : ""}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {m.widget.type === "subcontractor_payment" && (
                      <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px" }}>
                        <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Subcontractor Payment</div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{m.widget.data.subcontractor_name}</div>
                        {[["Gross",m.widget.data.gross],["CIS Deduction",m.widget.data.deduction],["Net Payable",m.widget.data.net]].map(([l,v],i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderTop: i > 0 ? `1px solid ${C.border}` : "none" }}>
                            <span style={{ color: C.muted }}>{l}</span>
                            <span style={{ fontWeight: i===2 ? 700 : 400, color: i===2 ? C.green : C.text }}>£{parseFloat(v||0).toFixed(2)}</span>
                          </div>
                        ))}
                        {m.widget.data.job_ref && <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>📋 {m.widget.data.job_ref}</div>}
                      </div>
                    )}
                    {m.widget.type === "compliance_cert" && (
                      <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px" }}>
                        <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Certificate Added</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.amber }}>{m.widget.data.doc_type}</div>
                        <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>{m.widget.data.customer} — {m.widget.data.job_title}</div>
                        {m.widget.data.doc_number && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Ref: {m.widget.data.doc_number}</div>}
                        {m.widget.data.issued_date && <div style={{ fontSize: 11, color: C.muted }}>Issued: {m.widget.data.issued_date}{m.widget.data.expiry_date ? ` · Expires: ${m.widget.data.expiry_date}` : ""}</div>}
                      </div>
                    )}
                    {m.widget.type === "variation_order" && (
                      <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px" }}>
                        <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Variation Order</div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{m.widget.data.vo_number}</div>
                            <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>{m.widget.data.description}</div>
                            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{m.widget.data.customer}</div>
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: C.amber }}>£{parseFloat(m.widget.data.amount||0).toFixed(2)}</div>
                        </div>
                      </div>
                    )}
                    {m.widget.type === "daywork_sheet" && (
                      <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px" }}>
                        <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Daywork Sheet</div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{m.widget.data.worker_name || "Worker"} — {m.widget.data.customer}</div>
                            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{m.widget.data.hours}hrs @ {fmtAmount(m.widget.data.rate)}/hr · {m.widget.data.sheet_date}</div>
                            {m.widget.data.description && <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{m.widget.data.description}</div>}
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: C.amber }}>£{parseFloat(m.widget.data.total||0).toFixed(2)}</div>
                        </div>
                      </div>
                    )}
                    {m.widget.type === "review_sent" && (
                      <div style={{ background: C.surfaceHigh, border: `1px solid ${C.green}44`, borderRadius: 10, padding: "12px 14px" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 6 }}>✓ Review Request Sent</div>
                        <div style={{ fontSize: 12, color: C.textDim }}>{m.widget.data.customer} — {m.widget.data.email}</div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Platforms: {m.widget.data.platforms?.map(p => p.name).join(", ")}</div>
                      </div>
                    )}
                    {m.widget.type === "report" && (() => {
                      const r = m.widget.data;
                      return (
                        <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between" }}>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>📊 {r.label} Report</div>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: C.border }}>
                            {[
                              { label: "Revenue", value: "£" + r.totalRevenue.toFixed(2), color: C.green },
                              { label: "Outstanding", value: "£" + r.outstanding.toFixed(2), color: C.amber },
                              { label: "Gross Profit", value: "£" + (r.grossProfit||0).toFixed(2), color: C.green },
                              { label: "Material Cost", value: "£" + (r.matCost||0).toFixed(2), color: C.red },
                            ].map((item,i) => (
                              <div key={i} style={{ padding: "12px 14px", background: C.surfaceHigh }}>
                                <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{item.label}</div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: item.color }}>{item.value}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.border}` }}>
                            <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>INVOICES</div>
                            <div style={{ fontSize: 12, color: C.textDim }}>{r.paidCount} paid · {r.unpaidCount} unpaid · {r.jobsCount} job{r.jobsCount !== 1 ? "s" : ""}</div>
                          </div>
                          {r.topCustomers?.length > 0 && (
                            <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.border}` }}>
                              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>TOP CUSTOMERS</div>
                              {r.topCustomers.map(([name, val], i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, paddingBottom: 3 }}>
                                  <span style={{ color: C.textDim }}>{name}</span>
                                  <span style={{ color: C.amber, fontWeight: 600 }}>£{val.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <div style={{ padding: "8px 14px", borderTop: `1px solid ${C.border}` }}>
                            <button onClick={() => setView("Reports")} style={{ ...S.btn("ghost"), width: "100%", justifyContent: "center", fontSize: 12 }}>Full report in Reports tab →</button>
                          </div>
                        </div>
                      );
                    })()}
                    {m.widget.type === "po_list" && (
                      <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                        <div style={{ padding: "9px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Purchase Orders ({m.widget.data.length})</div>
                        {m.widget.data.map((po,i) => (
                          <div key={i} style={{ padding: "10px 14px", borderBottom: i < m.widget.data.length-1 ? `1px solid ${C.border}` : "none", display: "flex", justifyContent: "space-between" }}>
                            <div><div style={{ fontSize: 12, fontWeight: 600 }}>{po.po_number} · {po.supplier}</div><div style={{ fontSize: 11, color: C.muted }}>{po.job_ref || "No job ref"}</div></div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: C.amber }}>£{parseFloat(po.total||0).toFixed(2)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {m.widget.type === "reminder_list" && (
                      <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                        <div style={{ padding: "9px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Reminders ({m.widget.data.length})</div>
                        {m.widget.data.map((r,i) => (
                          <div key={i} style={{ padding: "10px 14px", borderBottom: i < m.widget.data.length-1 ? `1px solid ${C.border}` : "none" }}>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>{r.text}</div>
                            <div style={{ fontSize: 11, color: C.amber, marginTop: 2 }}>{r.fire_at ? new Date(r.fire_at).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {m.widget.type === "enquiry_list" && (
                      <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                        <div style={{ padding: "9px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Enquiries ({m.widget.data.length})</div>
                        {m.widget.data.map((e,i) => (
                          <div key={i} style={{ padding: "10px 14px", borderBottom: i < m.widget.data.length-1 ? `1px solid ${C.border}` : "none" }}>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>{e.name}</div>
                            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{e.phone || e.email || ""}{e.service ? ` · ${e.service}` : ""}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {m.widget.type === "customer_list" && (
                      <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                        <div style={{ padding: "9px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Customers ({m.widget.data.length})</div>
                        {m.widget.data.map((c,i) => (
                          <div key={i} style={{ padding: "10px 14px", borderBottom: i < m.widget.data.length-1 ? `1px solid ${C.border}` : "none" }}>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>{c.name}</div>
                            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{c.phone || ""}{c.email ? (c.phone ? " · " : "") + c.email : ""}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {m.widget.type === "mileage_list" && (
                      <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                        <div style={{ padding: "9px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Mileage ({m.widget.data.length})</div>
                          <div style={{ fontSize: 11, color: C.amber, fontWeight: 600 }}>£{parseFloat(m.widget.value||0).toFixed(2)} claimable</div>
                        </div>
                        {m.widget.data.slice(0,8).map((t,i) => (
                          <div key={i} style={{ padding: "9px 14px", borderBottom: i < Math.min(m.widget.data.length,8)-1 ? `1px solid ${C.border}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600 }}>{t.from_location || "—"} → {t.to_location || "—"}</div>
                              <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{t.date}{t.purpose ? ` · ${t.purpose}` : ""}</div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
                              <div style={{ fontSize: 12, fontWeight: 600 }}>{parseFloat(t.miles||0).toFixed(1)} mi</div>
                              <div style={{ fontSize: 11, color: C.amber }}>£{parseFloat(t.value||0).toFixed(2)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {(m.widget.type === "stock_list" || m.widget.type === "stock_item_entry") && (
                      <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                        <div style={{ padding: "9px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          {m.widget.type === "stock_item_entry" ? "Stock Item Added" : `Stock (${m.widget.data.length})`}
                        </div>
                        {(m.widget.type === "stock_item_entry" ? [m.widget.data] : m.widget.data).map((s,i) => (
                          <div key={i} style={{ padding: "10px 14px", borderBottom: i < (m.widget.type === "stock_list" ? m.widget.data.length : 1)-1 ? `1px solid ${C.border}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600 }}>{s.name}</div>
                              <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{s.location ? `📍 ${s.location} · ` : ""}{s.sku ? `SKU: ${s.sku} · ` : ""}Reorder at {s.reorder_level || 0}</div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: parseFloat(s.quantity||0) <= parseFloat(s.reorder_level||0) ? C.red : C.green }}>{s.quantity} {s.unit}</div>
                              {s.unit_cost > 0 && <div style={{ fontSize: 11, color: C.muted }}>£{parseFloat(s.unit_cost||0).toFixed(2)}/{s.unit}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {m.widget.type === "rams_list" && (
                      <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                        <div style={{ padding: "9px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>RAMS Documents ({m.widget.data.length})</div>
                        {m.widget.data.map((r,i) => (
                          <div key={i} style={{ padding: "10px 14px", borderBottom: i < m.widget.data.length-1 ? `1px solid ${C.border}` : "none" }}>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>{r.title}</div>
                            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{r.site_address || ""}{r.date ? ` · ${r.date}` : ""}</div>
                          </div>
                        ))}
                        <div style={{ padding: "8px 14px", borderTop: `1px solid ${C.border}` }}>
                          <button onClick={() => setView("RAMS")} style={{ ...S.btn("ghost"), width: "100%", justifyContent: "center", fontSize: 12 }}>Open RAMS tab to view / export →</button>
                        </div>
                      </div>
                    )}
                    {m.widget.type === "email_sent" && (
                      <div style={{ background: C.surfaceHigh, border: `1px solid ${C.green}44`, borderRadius: 10, padding: "12px 14px" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 6 }}>
                          ✓ {m.widget.data.isChase ? "Chase sent" : m.widget.data.isQuote ? "Quote sent" : "Invoice sent"}
                        </div>
                        <div style={{ fontSize: 12, color: C.textDim }}>{m.widget.data.customer} · {m.widget.data.to}</div>
                        {m.widget.data.invoice_id && <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{m.widget.data.invoice_id} · £{parseFloat(m.widget.data.amount||0).toFixed(2)}</div>}
                      </div>
                    )}
                    {m.widget.type === "stage_payments" && (
                      <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                        <div style={{ padding: "9px 14px", borderBottom: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Stage Payments — {m.widget.data.customer}</div>
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Job value: £{parseFloat(m.widget.data.jobValue||0).toFixed(2)}</div>
                        </div>
                        {(m.widget.data.stages||[]).map((s,i) => (
                          <div key={i} style={{ padding: "10px 14px", borderBottom: i < m.widget.data.stages.length-1 ? `1px solid ${C.border}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600 }}>{s.label}</div>
                              <div style={{ fontSize: 11, color: C.muted }}>{s.type === "pct" ? s.value + "%" : "Fixed"}</div>
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.amber }}>£{parseFloat(s.amount||0).toFixed(2)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {m.widget.type === "inbox_actions" && (
                      <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                        <div style={{ padding: "9px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          Inbox Actions ({m.widget.data.length} pending)
                        </div>
                        {m.widget.data.map((action, i) => {
                          const d = typeof action.action_data === "string" ? JSON.parse(action.action_data || "{}") : (action.action_data || {});
                          return (
                            <div key={i} style={{ borderBottom: i < m.widget.data.length-1 ? `1px solid ${C.border}` : "none" }}>
                              <div style={{ padding: "12px 14px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 11, color: C.amber, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>
                                      {(action.action_type || "").replace(/_/g, " ")}
                                    </div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{action.description || action.email_subject}</div>
                                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>From: {action.email_from}</div>
                                  </div>
                                </div>
                                {action.email_snippet && (
                                  <div style={{ fontSize: 11, color: C.textDim, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 10px", marginBottom: 8, fontStyle: "italic", lineHeight: 1.5 }}>
                                    "{action.email_snippet?.slice(0, 200)}{action.email_snippet?.length > 200 ? "..." : ""}"
                                  </div>
                                )}
                                {Object.keys(d).length > 0 && (
                                  <div style={{ fontSize: 11, color: C.textDim, marginBottom: 8 }}>
                                    {d.customer && <span style={{ marginRight: 8 }}>👤 {d.customer}</span>}
                                    {d.amount && <span style={{ marginRight: 8 }}>{fmtAmount(d.amount)}</span>}
                                    {d.supplier && <span style={{ marginRight: 8 }}>🏪 {d.supplier}</span>}
                                    {d.type && <span>{d.type}</span>}
                                  </div>
                                )}
                                <div style={{ display: "flex", gap: 8 }}>
                                  <button onClick={() => send("approve inbox action " + action.id)}
                                    style={{ ...S.btn("primary"), flex: 1, justifyContent: "center", fontSize: 11, padding: "7px 12px" }}>
                                    ✓ Approve
                                  </button>
                                  <button onClick={() => send("reject inbox action " + action.id)}
                                    style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", fontSize: 11, padding: "7px 12px", color: C.red, borderColor: C.red + "44" }}>
                                    ✗ Dismiss
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {m.widget.type === "subcontractor_statement" && (() => {
                      const { sub, payments, month, totalGross, totalDed, totalNet } = m.widget.data;
                      return (
                        <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.border}` }}>
                            <div style={{ fontSize: 12, fontWeight: 700 }}>CIS Statement — {sub.name}</div>
                            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{month} · CIS {sub.cis_rate}%</div>
                          </div>
                          {payments.map((p,i) => (
                            <div key={i} style={{ padding: "9px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                              <div><div style={{ fontWeight: 600 }}>{p.description || p.job_ref || "Payment"}</div><div style={{ fontSize: 11, color: C.muted }}>{p.date}</div></div>
                              <div style={{ textAlign: "right" }}>
                                <div>£{parseFloat(p.gross||0).toFixed(2)}</div>
                                <div style={{ fontSize: 11, color: C.red }}>-£{parseFloat(p.deduction||0).toFixed(2)}</div>
                              </div>
                            </div>
                          ))}
                          <div style={{ padding: "12px 14px" }}>
                            {[["Total Gross", totalGross], ["CIS Deduction", totalDed], ["Net Payable", totalNet]].map(([l,v],i) => (
                              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderTop: i > 0 ? `1px solid ${C.border}` : "none" }}>
                                <span style={{ color: C.muted }}>{l}</span>
                                <span style={{ fontWeight: i === 2 ? 700 : 400, color: i === 2 ? C.green : C.text }}>£{parseFloat(v||0).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                          <div style={{ padding: "8px 14px", borderTop: `1px solid ${C.border}` }}>
                            <button onClick={() => setView("Subcontractors")} style={{ ...S.btn("ghost"), width: "100%", justifyContent: "center", fontSize: 12 }}>Export PDF in Subcontractors tab →</button>
                          </div>
                        </div>
                      );
                    })()}
                    {m.widget.type === "signature_prompt" && (
                      <div style={{ background: C.surfaceHigh, border: `1px solid ${C.amber}44`, borderRadius: 10, padding: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.amber, marginBottom: 6 }}>✍ Customer Sign-off</div>
                        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 12 }}>
                          <div style={{ fontWeight: 600 }}>{m.widget.data.customer}</div>
                          <div style={{ color: C.muted, marginTop: 2 }}>{m.widget.data.title}</div>
                        </div>
                        <button onClick={() => setView("Jobs")} style={{ ...S.btn("primary"), width: "100%", justifyContent: "center" }}>
                          ✍ Open Signature Pad in Jobs tab →
                        </button>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 8, textAlign: "center" }}>
                          Open the job card and tap "Customer Sign-off" to capture the signature
                        </div>
                      </div>
                    )}
                    {m.widget.type === "support_escalated" && (
                      <div style={{ background: C.surfaceHigh, border: `1px solid ${C.blue}44`, borderRadius: 10, padding: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.blue, marginBottom: 6 }}>✓ Escalated to Support</div>
                        <div style={{ fontSize: 12, color: C.textDim }}>{m.widget.data.issue}</div>
                        {m.widget.data.email && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Reply to: {m.widget.data.email}</div>}
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Expected response within 1 business day</div>
                      </div>
                    )}
                    {m.widget.type === "accounting_sync" && (
                      <div style={{ background: C.surfaceHigh, border: `1px solid ${m.widget.data.success ? C.green + "44" : C.red + "44"}`, borderRadius: 10, padding: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: m.widget.data.platform === "Xero" ? "#13B5EA22" : "#2CA01C22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
                            {m.widget.data.platform === "Xero" ? "X" : "QB"}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: m.widget.data.success ? C.green : C.red }}>
                              {m.widget.data.success ? `✓ Synced to ${m.widget.data.platform}` : `✗ Sync failed`}
                            </div>
                            <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
                              {m.widget.data.isBill ? "Purchase bill created" : m.widget.data.markedPaid ? "Marked as paid" : "Invoice uploaded"}
                            </div>
                          </div>
                          {m.widget.data.amount > 0 && <div style={{ fontSize: 14, fontWeight: 700, color: C.amber }}>£{parseFloat(m.widget.data.amount || 0).toFixed(2)}</div>}
                        </div>
                        <div style={{ fontSize: 12, color: C.textDim }}>{m.widget.data.customer}{m.widget.data.invoice_id ? " · " + m.widget.data.invoice_id : ""}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div style={S.aiMsg("assistant")}>
                <div style={S.avatar("assistant")}>⚡</div>
                <div style={{ ...S.aiBubble("assistant"), color: C.muted, display: "flex", alignItems: "center", gap: 4, padding: "10px 14px" }} aria-label="Trade PA is thinking">
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{
                      width: 7, height: 7, borderRadius: "50%",
                      background: C.muted,
                      display: "inline-block",
                      animation: `typing-dot 1.2s ease-in-out ${i * 0.15}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Phase 2: unified status strip — one row, colour-coded by voiceState */}
          {voiceState !== "idle" && (
            <div
              key={voiceState}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 12px",
                background: vt.color + "18",
                border: `1px solid ${vt.color}44`,
                borderRadius: 10,
                fontSize: 12, color: vt.color,
                animation: "status-strip-in 0.22s ease-out",
              }}
            >
              {voiceState === "listening" && (
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: vt.color, animation: "bellPulse 1s ease infinite" }} />
              )}
              {(voiceState === "transcribing" || voiceState === "thinking") && (
                <div style={{
                  width: 12, height: 12, borderRadius: "50%",
                  border: `2px solid ${vt.color}33`,
                  borderTopColor: vt.color,
                  animation: "mic-spin 0.8s linear infinite",
                }} />
              )}
              {voiceState === "speaking" && (
                <div style={{ display: "flex", alignItems: "center", gap: 2, height: 12 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 2, height: 10, borderRadius: 1, background: vt.color,
                      animation: `speak-wave 0.9s ease-in-out ${i * 0.12}s infinite`,
                    }} />
                  ))}
                </div>
              )}
              <span style={{ fontWeight: 600 }}>{vt.label}</span>
              <span style={{ color: vt.color + "aa", fontWeight: 400 }}>· {vt.sub}</span>
            </div>
          )}
        </>
      )}

      {/* ── INPUT BAR — in flow, pinned by flex at bottom ────────────────── */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexShrink: 0, paddingTop: 6 }}>
        <textarea
          style={{ ...S.input, flex: 1, minHeight: 46, maxHeight: 120, resize: "none", fontSize: 14, padding: "11px 14px" }}
          placeholder={isHome ? "Ask Trade PA anything..." : "Type here, or tap 🎙 to speak..."}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          rows={2}
        />
        <button
          onClick={() => { unlockAudio(); abortSpeech(); recording ? stopRecording() : startRecording(true); }}
          disabled={transcribing}
          aria-label={vt.label}
          style={{
            padding: "10px 12px", borderRadius: 10,
            border: `1px solid ${voiceState === "idle" ? C.border : vt.color}`,
            background: voiceState === "idle" ? C.surfaceHigh : vt.color + "22",
            color: voiceState === "idle" ? C.muted : vt.color,
            fontSize: 13, fontFamily: "'DM Mono',monospace",
            cursor: transcribing ? "default" : "pointer",
            whiteSpace: "nowrap", flexShrink: 0,
            transition: "background 0.2s, border-color 0.2s, color 0.2s",
          }}
        >{voiceState === "transcribing" ? "⏳"
          : voiceState === "thinking"   ? "…"
          : voiceState === "speaking"   ? "🔊"
          : voiceState === "listening"  ? "⏹"
          :                               "🎙"}</button>
        <button onClick={() => { unlockAudio(); send(input); }} style={{ ...S.btn("primary"), padding: "11px 16px", flexShrink: 0 }} disabled={loading || !input.trim()}>Send</button>
      </div>

      {/* ── Limit-reached modal (sub-item 3) ──────────────────────────── */}
      {limitModal && (() => {
        const isIOSNative = typeof window !== "undefined"
          && window.Capacitor?.isNativePlatform?.()
          && window.Capacitor?.getPlatform?.() === "ios";

        // Title / subtitle per reason
        const COPY = {
          limit_reached: {
            title: "You've hit your monthly limit",
            subtitle: `You've used all ${usageCaps?.convos ?? 500} AI conversations for this billing period. Your allowance resets on your next billing date.`,
            showAddons: true,
          },
          no_subscription: {
            title: "No active subscription",
            subtitle: "Your subscription isn't active. Reactivate from Settings → Plan & billing to continue.",
            showAddons: false,
          },
          account_locked: {
            title: "Account access paused",
            subtitle: "Your account access has been paused. Email hello@tradespa.co.uk and we'll sort this out quickly.",
            showAddons: false,
          },
          rate_limit_minute: {
            title: "Slow down a moment",
            subtitle: "You're sending messages faster than the rate limit. Wait 30 seconds and try again.",
            showAddons: false,
          },
          rate_limit_hour: {
            title: "Hourly rate limit reached",
            subtitle: "You've hit the hourly request limit. Try again shortly.",
            showAddons: false,
          },
          rate_limit_day: {
            title: "Daily rate limit reached",
            subtitle: "You've hit today's request limit. Resets tomorrow.",
            showAddons: false,
          },
        };
        const copy = COPY[limitModal.reason] || COPY.limit_reached;
        const subtitle = limitModal.message || copy.subtitle;
        const showBuy = copy.showAddons && !isIOSNative;
        const showUpgrade = copy.showAddons; // upgrade link works on iOS too (it's a nav, not a purchase)

        return (
          <div
            onClick={() => !limitBusy && setLimitModal(null)}
            style={{
              position: "fixed",
              top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: 16,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: "20px 20px 18px",
                width: "100%",
                maxWidth: 360,
                maxHeight: "90vh",
                overflowY: "auto",
              }}
            >
              <div style={{
                fontSize: 10, color: C.textDim, letterSpacing: "0.1em",
                textTransform: "uppercase", fontFamily: "'DM Mono', monospace", marginBottom: 10,
              }}>{copy.showAddons ? "Limit reached" : "Can't continue"}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{copy.title}</div>
              <div style={{ fontSize: 13, color: C.textDim, margin: "6px 0 16px", lineHeight: 1.55 }}>
                {subtitle}
              </div>

              {limitModal.pendingText && (
                <div style={{
                  background: C.surfaceHigh,
                  borderRadius: 6,
                  padding: "10px 12px",
                  marginBottom: 14,
                }}>
                  <div style={{
                    fontSize: 10, color: C.textDim, fontFamily: "'DM Mono', monospace",
                    letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4,
                  }}>Your message</div>
                  <div style={{
                    fontSize: 12, color: C.text, lineHeight: 1.5,
                    display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}>"{limitModal.pendingText}"</div>
                  {copy.showAddons && (
                    <div style={{ fontSize: 10.5, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
                      We'll send this automatically once your allowance is topped up.
                    </div>
                  )}
                </div>
              )}

              {limitError && (
                <div style={{
                  marginBottom: 14,
                  padding: "8px 10px",
                  borderRadius: 6,
                  fontSize: 11.5,
                  lineHeight: 1.5,
                  background: `${C.red}1a`,
                  border: `1px solid ${C.red}40`,
                  color: C.red,
                }}>✕ {limitError}</div>
              )}

              {/* Actions */}
              {showBuy && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                  <button
                    onClick={() => buyAddonAndRetry("conversations")}
                    disabled={limitBusy}
                    style={{
                      padding: "12px 14px",
                      border: `1px solid ${C.amber}`,
                      background: C.amber,
                      color: "#412402",
                      fontSize: 12, fontWeight: 700,
                      borderRadius: 6,
                      fontFamily: "'DM Mono', monospace",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      cursor: limitBusy ? "not-allowed" : "pointer",
                      opacity: limitBusy ? 0.6 : 1,
                    }}
                  >{limitBusy ? "Processing..." : "+200 conversations · £39"}</button>
                  <button
                    onClick={() => buyAddonAndRetry("combo")}
                    disabled={limitBusy}
                    style={{
                      padding: "10px 14px",
                      border: `1px solid ${C.amber}`,
                      background: "transparent",
                      color: C.amber,
                      fontSize: 11, fontWeight: 700,
                      borderRadius: 6,
                      fontFamily: "'DM Mono', monospace",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      cursor: limitBusy ? "not-allowed" : "pointer",
                      opacity: limitBusy ? 0.6 : 1,
                    }}
                  >Combo · +200 conv & +2h · £55</button>
                </div>
              )}
              {showUpgrade && (
                <button
                  onClick={() => { setLimitModal(null); if (setView) setView("Settings"); }}
                  disabled={limitBusy}
                  style={{
                    width: "100%",
                    padding: 10,
                    border: `1px solid ${C.border}`,
                    background: "transparent",
                    color: C.text,
                    fontSize: 11, fontWeight: 600,
                    borderRadius: 6,
                    fontFamily: "'DM Mono', monospace",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    cursor: limitBusy ? "not-allowed" : "pointer",
                    opacity: limitBusy ? 0.6 : 1,
                    marginBottom: 8,
                  }}
                >{isIOSNative ? "Manage plan →" : "Upgrade plan →"}</button>
              )}
              <button
                onClick={() => setLimitModal(null)}
                disabled={limitBusy}
                style={{
                  width: "100%",
                  padding: 8,
                  border: "none",
                  background: "transparent",
                  color: C.textDim,
                  fontSize: 11,
                  fontFamily: "'DM Mono', monospace",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  cursor: limitBusy ? "not-allowed" : "pointer",
                  opacity: limitBusy ? 0.6 : 1,
                }}
              >Close</button>
            </div>
          </div>
        );
      })()}
    </div>
  );

  // Phase 5a: overlay mode — render content inside a bottom-sheet shell when
  // overlayContext is set. Hands-free bumps the sheet taller (90% vs 80%).
  if (overlayContext) {
    const sheetHeight = handsFree ? "90vh" : "82vh";
    return (
      <div
        onClick={onCloseOverlay}
        style={{
          position: "fixed", inset: 0,
          background: "#000c",
          zIndex: 350,
          display: "flex", flexDirection: "column", justifyContent: "flex-end",
          animation: "pa-overlay-fade 0.2s ease-out",
        }}
      >
        <style>{`
          @keyframes pa-overlay-fade { from { opacity: 0; } to { opacity: 1; } }
          @keyframes pa-sheet-up   { from { transform: translateY(100%); } to { transform: translateY(0); } }
        `}</style>
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: C.bg,
            borderTopLeftRadius: 18, borderTopRightRadius: 18,
            height: sheetHeight,
            display: "flex", flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 -12px 48px rgba(0,0,0,0.4)",
            animation: "pa-sheet-up 0.26s cubic-bezier(0.25, 0.8, 0.25, 1)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          {/* Drag handle */}
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 8, paddingBottom: 4, flexShrink: 0 }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border }} />
          </div>

          {/* Sheet header: close · context · open-full-chat */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 12px 10px",
            borderBottom: `1px solid ${C.border}`,
            flexShrink: 0,
          }}>
            <button
              onClick={onCloseOverlay}
              aria-label="Close"
              style={{
                width: 36, height: 36, flexShrink: 0,
                display: "grid", placeItems: "center",
                background: "transparent", border: "none",
                color: C.text, cursor: "pointer", padding: 0,
                borderRadius: 8,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 1 }}>Trade PA</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{overlayContext}</div>
            </div>
            <button
              onClick={() => { if (onCloseOverlay) onCloseOverlay(); setView("AI Assistant"); }}
              style={{
                flexShrink: 0, padding: "5px 10px",
                background: "transparent",
                border: `1px solid ${C.border}`,
                borderRadius: 14,
                color: C.muted, fontSize: 11,
                fontFamily: "'DM Mono', monospace", letterSpacing: "0.04em",
                cursor: "pointer",
              }}
            >
              Open full chat ↗
            </button>
          </div>

          {/* Content column — reuses the full page content (chat view, mic hero, input bar) */}
          <div style={{ flex: 1, overflow: "hidden", padding: "10px 12px 12px" }}>
            {_pageContent}
          </div>
        </div>
      </div>
    );
  }

  return _pageContent;
}

// ─── Payments ─────────────────────────────────────────────────────────────────
// (Payments moved to ./views/Invoices.jsx — P7-7C)




// ─── Root ─────────────────────────────────────────────────────────────────────
// ─── DetailContactRow — full-width contact row used in Customer Detail modal ──
// Green tinted icon if value present (whole row is tappable to call/email/maps).
// Dashed grey icon + "+ Add" CTA if value missing (tap routes to Edit).
// (DetailContactRow moved to ./views/Customers.jsx — P7-7C)

// ─── ContactIcon — 22px coloured square showing phone/email/address presence ──
// Used by the Customers list and Customer Detail. Green when the field is set,
// dashed grey outline when missing.
// (ContactIcon moved to ./views/Customers.jsx — P7-7C)

// ─── vCard parser (used by ImportContacts) ────────────────────────────────────
// Parses a vCard (.vcf) file into customer-shaped objects.
// Handles vCard 3.0 + 4.0 line folding, common parameter syntax, skips nameless cards.
// (parseVCard moved to ./views/customers/ImportContacts.jsx — P7-7C)

// ─── ImportContacts — smart device detection + preview ────────────────────────
// Android Chrome: uses Contact Picker API (instant native picker).
// iOS / desktop / unsupported: falls back to .vcf file upload.
// Either path lands in a preview modal where the user picks which contacts
// to import, then bulk-adds them via the parent's onImport callback.
// (ImportContacts moved to ./views/customers/ImportContacts.jsx — P7-7C)

// ─── Customers ────────────────────────────────────────────────────────────────
// (Customers moved to ./views/Customers.jsx — P7-7C)

// (CustomerForm moved to ./views/customers/CustomerForm.jsx — P7-7C)

// ─── Invoices View ────────────────────────────────────────────────────────────
// ─── Send Invoice/Quote by Email ─────────────────────────────────────────────
// (sendDocumentEmail moved to ./views/Invoices.jsx — P7-7C)

// (InvoicesView moved to ./views/Invoices.jsx — P7-7C)

// ─── Quotes View ──────────────────────────────────────────────────────────────
// (QuotesView moved to ./views/Invoices.jsx — P7-7C)

// ─── Line Items Display ───────────────────────────────────────────────────────
// (LineItemsDisplay moved to ./views/Invoices.jsx — P7-7C)

// ─── CompanyForm — company name + address + multi-contact array editor ────────
// Rendered inside the Add Customer modal when form.isCompany === true.
// Domestic/single-contact users see CustomerForm instead. Parent holds:
//   form          — { name: company name, address, notes, isCompany: true, ... }
//   draftContacts — array of { tempId, name, role, phone, email, isPrimary, isBilling }
// On save the parent creates 1 customer row + N contact rows transactionally.
// (CompanyForm moved to ./views/customers/CompanyForm.jsx — P7-7C)

// ─── InboxView (AI Email Agent) ───────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────
// Email-action dispatch — shared between the Inbox tab's Approve/Dismiss UI
// AND the voice tools (approve_inbox_action, reject_inbox_action in AIAssistant).
//
// Previously the voice path just flipped the DB status without actually creating
// the job / sending the reply / parsing the PDF, so voice-approvals looked like
// they worked but were silent no-ops. Hoisting to module scope lets both paths
// share the real dispatch logic. Callers pass an env bag of state + setters +
// identity. `sendPush` is optional — voice omits it because the user triggered
// the action themselves and doesn't need a push notification on the same device.
// ────────────────────────────────────────────────────────────────────────────

// (executeEmailAction moved to ./views/Inbox.jsx — P7-7B)
// (updateEmailAIContext moved to ./views/Inbox.jsx — P7-7B)
// (logEmailFeedback moved to ./views/Inbox.jsx — P7-7B)
// (InboxView moved to ./views/Inbox.jsx — P7-7B)
// (EnquiriesTab moved to ./views/Enquiries.jsx — P7-7B)
// (buildComplianceDocHTML moved to ./views/Certificates.jsx — P7-7C)

// (printComplianceDoc moved to ./views/Certificates.jsx — P7-7C)

// (emailComplianceDoc moved to ./views/Certificates.jsx — P7-7C)

// ─── Signature Pad ────────────────────────────────────────────────────────────
// (SignaturePad moved to ./views/Certificates.jsx — P7-7C)

// ─── Trade Certificates ───────────────────────────────────────────────────────
// (CERT_CATEGORIES moved to ./views/Certificates.jsx — P7-7C)

// Flatten for easy lookup
// (TRADE_CERT_LIST moved to ./views/Certificates.jsx — P7-7C)

// (buildCertHTML moved to ./views/Certificates.jsx — P7-7C)

// ─── Certificates Tab (all trades) ────────────────────────────────────────────
// (CertificatesTab moved to ./views/Certificates.jsx — P7-7C)

// ─── Jobs Tab ─────────────────────────────────────────────────────────────────
// (JobsTab moved to ./views/Jobs.jsx — P7-7C)


// (MILEAGE_RATE moved to ./lib/constants.js — P1)

// (ExpensesTab moved to ./views/Expenses.jsx — P7-7A)
// (CISStatementsTab moved to ./views/CIS.jsx — P7-7A)
// (ReportsTab moved to ./views/Reports.jsx — P7-7B)
// (SubcontractorsTab moved to ./views/Subcontractors.jsx — P7-7B)
// (RAMS cluster — HAZARD_LIBRARY/METHOD_LIBRARY/COSHH_SUBSTANCES/RAMSTab moved to ./views/RAMS.jsx — P7-7B)
function JobsHub({ setView, jobs, enquiries, materials }) {
  const newEnquiries = (enquiries || []).filter(e => !e.status || e.status === "new");
  const activeJobs = (jobs || []).filter(j => j.status !== "complete" && j.status !== "completed");
  return (
    <HubPage
      title="Jobs"
      sub="Work in progress and the paperwork behind it"
      rows={[
        {
          name: "Jobs",
          meta: activeJobs.length > 0 ? `${activeJobs.length} active job${activeJobs.length === 1 ? "" : "s"}` : "No active jobs",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /></svg>,
          onClick: () => setView("Jobs"),
        },
        {
          name: "Enquiries",
          meta: newEnquiries.length > 0 ? `${newEnquiries.length} new enquir${newEnquiries.length === 1 ? "y" : "ies"}` : "No new enquiries",
          tint: newEnquiries.length > 0 ? "warn" : null,
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
          onClick: () => setView("Enquiries"),
        },
        {
          name: "Materials",
          meta: (materials || []).length > 0 ? `${materials.length} item${materials.length === 1 ? "" : "s"} logged` : "No materials logged",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
          onClick: () => setView("Materials"),
        },
        {
          name: "Stock",
          meta: "Van and site inventory",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>,
          onClick: () => setView("Stock"),
        },
        {
          name: "RAMS",
          meta: "Risk assessment and method statements",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
          onClick: () => setView("RAMS"),
        },
        {
          name: "Documents",
          meta: "Certificates, reports, shared files",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
          onClick: () => setView("Documents"),
        },
      ]}
    />
  );
}

// ─── DiaryHub — Diary bottom-tab landing ────────────────────────────────────
function DiaryHub({ setView, jobs, reminders }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayJobs = (jobs || []).filter(j => j.dateObj && isSameDay(new Date(j.dateObj), today));
  const upcomingReminders = (reminders || []).filter(r => !r.done && !r.dismissed);
  return (
    <HubPage
      title="Diary"
      sub="Schedule, reminders, and what's coming up"
      rows={[
        {
          name: "Schedule",
          meta: todayJobs.length > 0 ? `${todayJobs.length} job${todayJobs.length === 1 ? "" : "s"} today` : "Nothing scheduled today",
          tint: todayJobs.length > 0 ? "warn" : null,
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 11h18" /></svg>,
          onClick: () => setView("Schedule"),
        },
        {
          name: "Reminders",
          meta: upcomingReminders.length > 0 ? `${upcomingReminders.length} pending` : "Nothing pending",
          tint: upcomingReminders.length > 0 ? "warn" : null,
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
          onClick: () => setView("Reminders"),
        },
      ]}
    />
  );
}

// ─── AccountsHub — Accounts bottom-tab landing ──────────────────────────────
function AccountsHub({ setView, invoices }) {
  const allInvoices = (invoices || []).filter(i => !i.isQuote);
  const allQuotes = (invoices || []).filter(i => i.isQuote);
  const overdue = allInvoices.filter(i => i.status === "overdue" || i.status === "due");
  const overdueValue = overdue.reduce((s, i) => s + (i.amount || 0), 0);
  const outstanding = allInvoices.filter(i => i.status !== "paid");
  return (
    <HubPage
      title="Accounts"
      sub="Money in, money out, and HMRC-ready records"
      rows={[
        {
          name: "Invoices",
          meta: overdueValue > 0
            ? `${fmtAmount(overdueValue)} overdue · ${outstanding.length} outstanding`
            : outstanding.length > 0
              ? `${outstanding.length} outstanding`
              : "All paid up",
          tint: overdueValue > 0 ? "urgent" : outstanding.length > 0 ? "warn" : "ok",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
          onClick: () => setView("Invoices"),
        },
        {
          name: "Quotes",
          meta: allQuotes.length > 0 ? `${allQuotes.length} quote${allQuotes.length === 1 ? "" : "s"}` : "No quotes",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12h6m-3-3v6m9-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
          onClick: () => setView("Quotes"),
        },
        {
          name: "Payments",
          meta: "Stripe and bank transfers",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 10h.01M18 14h.01" /></svg>,
          onClick: () => setView("Payments"),
        },
        {
          name: "Expenses",
          meta: "Receipts, tools, materials spend",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
          onClick: () => setView("Expenses"),
        },
        {
          name: "Mileage",
          meta: "HMRC-rate tracking, auto-calculated",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 2" /></svg>,
          onClick: () => setView("Mileage"),
        },
        {
          name: "CIS",
          meta: "Construction industry scheme statements",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
          onClick: () => setView("CIS"),
        },
        {
          name: "Reports",
          meta: "P&L, income, expenses summaries",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
          onClick: () => setView("Reports"),
        },
      ]}
    />
  );
}

// ─── PeopleHub — People bottom-tab landing ──────────────────────────────────
function PeopleHub({ setView, customers, enquiries }) {
  const customerCount = (customers || []).length;
  const newEnquiryCount = (enquiries || []).filter(e => !e.status || e.status === "new").length;
  return (
    <HubPage
      title="People"
      sub="Customers, team, and the inbox"
      rows={[
        {
          name: "Customers",
          meta: customerCount > 0 ? `${customerCount} customer${customerCount === 1 ? "" : "s"}` : "No customers yet",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M5 21c0-3.87 3.13-7 7-7s7 3.13 7 7" /></svg>,
          onClick: () => setView("Customers"),
        },
        {
          name: "Inbox Actions",
          meta: newEnquiryCount > 0 ? `${newEnquiryCount} new message${newEnquiryCount === 1 ? "" : "s"}` : "AI suggests actions from email",
          tint: newEnquiryCount > 0 ? "warn" : null,
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" /></svg>,
          onClick: () => setView("Inbox"),
        },
        {
          name: "Workers",
          meta: "PAYE staff and self-employed labour on your team",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
          onClick: () => setView("Workers"),
        },
        {
          name: "Subcontractors",
          meta: "Your go-to people for overflow work",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a3 3 0 015.36-1.857M17 4a3 3 0 100 6 3 3 0 000-6zM12 12a4 4 0 100-8 4 4 0 000 8zM7 4a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
          onClick: () => setView("Subcontractors"),
        },
        {
          name: "Reviews",
          meta: "Google, Checkatrade, Trustpilot feedback",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
          onClick: () => setView("Reviews"),
        },
      ]}
    />
  );
}


function AppInner() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [planTier, setPlanTier] = useState("solo");
  const [userLimit, setUserLimit] = useState(1);
  const [pwaPrompt, setPwaPrompt] = useState(null); // Android install prompt
  const [showPwaBanner, setShowPwaBanner] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  // Desktop browser detection — true when running in a regular browser tab
  // (not installed as PWA) AND the viewport is wide enough for the rail layout.
  // Drives the desktop layout: left rail navigation, wider content area.
  const [isDesktopBrowser, setIsDesktopBrowser] = useState(false);
  useEffect(() => {
    const update = () => {
      const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
      const wideEnough = window.innerWidth >= 900;
      setIsDesktopBrowser(!standalone && wideEnough);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Pre-warm the offline cache shortly after login — fetches every
  // cached table in the background so the user has everything available
  // if they go offline immediately. 2s delay lets the app's own initial
  // loads go first. Fire-and-forget; no UI feedback.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const t = setTimeout(() => {
      if (!cancelled) prewarmCache();
    }, 2000);
    return () => { cancelled = true; clearTimeout(t); };
  }, [user?.id]);

  // Drain any pending writes queued from a previous session. Covers the
  // case where the user wrote offline, then closed the tab before signal
  // returned. OfflineBanner handles the live offline→online transition;
  // this handles "user already online when app starts up".
  useEffect(() => {
    if (!user?.id) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const t = setTimeout(() => { drainQueue(); }, 3000);
    return () => clearTimeout(t);
  }, [user?.id]);

  const [pdfHtml, setPdfHtml] = useState(null);
  const [offlineSettingsOpen, setOfflineSettingsOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);

  // Listen for changelog-open events fired by other components (e.g. the
  // "What's new" row inside Settings, which lives in a separate component
  // and can't see setChangelogOpen directly).
  useEffect(() => {
    const onOpen = () => setChangelogOpen(true);
    window.addEventListener("tp:open-changelog", onOpen);
    return () => window.removeEventListener("tp:open-changelog", onOpen);
  }, []);
  const [viewRaw, setViewRaw] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('xero') || params.has('qb')) return "Settings";
    if (params.has('stripe_connect')) return "Settings";
    if (params.has('email_connected') || params.has('email_error')) return "Inbox";
    return "AI Assistant";
  });
  const [activeCategory, setActiveCategory] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('xero') || params.has('qb')) return "admin";
    if (params.has('stripe_connect')) return "admin";
    if (params.has('email_connected') || params.has('email_error')) return "admin";
    return "work";
  });
  const view = viewRaw;
  const setView = (v) => {
    setViewRaw(v);
    const grp = viewGroup(v);
    if (grp) setActiveCategory(grp);
  };
  const [brand, setBrand] = useState(DEFAULT_BRAND);
  const { reminders, add, dismiss, markFired, remove } = useReminders(user?.id);
  const [dueNow, setDueNow] = useState([]);
  const [bellFlash, setBellFlash] = useState(false);
  const [twilioDevice, setTwilioDevice] = useState(null);
  const twilioDeviceRef = useRef(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [callMuted, setCallMuted] = useState(false);
  const [callSpeaker, setCallSpeaker] = useState(true); // browser defaults to speaker
  const [micBlocked, setMicBlocked] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  // Session D — voice-handle + hands-free mirror so Home can drive the AI directly
  const voiceHandle = useRef({ startVoice() {}, toggleHandsFree() {}, sendText() {} });
  const [aiHandsFree, setAiHandsFree] = useState(false);
  const [helpSlug, setHelpSlug] = useState(null);

  // Phase 5a: AI overlay — null when closed, or { context: "Viewing: …" } when open.
  // Set by FloatingMicButton (below) and unset by the overlay close/back.
  const [aiOverlay, setAiOverlay] = useState(null);

  // Phase 5b: context hint set by detail pages (JobsTab, InvoicesView) when a
  // record is selected. FloatingMicButton uses this for a richer context string.
  const [contextHint, setContextHint] = useState(null);

  // Top-level cache of pending inbox action count — so the voice assistant
  // always knows how many approvals are waiting, even when the user didn't
  // invoke voice from the Inbox tab. Loads on App mount, refreshes whenever
  // InboxView or the voice approve/reject handlers fire the cross-surface
  // "trade-pa-inbox-refreshed" event.
  const [pendingInboxCount, setPendingInboxCount] = useState(0);
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const loadCount = async () => {
      try {
        const r = await fetch(`/api/email/actions?userId=${user.id}&status=pending`);
        const d = await r.json();
        if (!cancelled) setPendingInboxCount((d.actions || []).length);
      } catch { /* silent — nice-to-have, not critical */ }
    };
    loadCount();
    const onRefresh = () => loadCount();
    window.addEventListener("trade-pa-inbox-refreshed", onRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener("trade-pa-inbox-refreshed", onRefresh);
    };
  }, [user?.id]);

  // ── Fair-use caps: usage tracking ─────────────────────────────
  const currentMonth = localMonth(); // "2026-04"
  const [usageData, setUsageData] = useState({ conversations_used: 0, handsfree_seconds_used: 0 });
  // Caps come from TIER_CONFIG (single source of truth). getTierConfig
  // handles legacy "pro" → "business" rename.
  const usageCaps = getTierConfig(planTier).caps;
  // Custom assistant persona — state here in App (passed to AIAssistant as props)
  const [assistantSetupOpen, setAssistantSetupOpen] = useState(false);
  const [assistantName, setAssistantName] = useState("Trade PA");
  const [assistantWakeWords, setAssistantWakeWords] = useState(["hey trade pa", "trade pa", "trade pay"]);
  const [assistantPersona, setAssistantPersona] = useState("");
  const [assistantSignoff, setAssistantSignoff] = useState("");
  // assistantVoice — one of Grok TTS's 5 voice IDs (eve/ara/leo/rex/sal).
  // Passed to /api/tts in speak() so the user's chosen voice is used.
  // Default "eve" matches /api/tts's server-side default.
  const [assistantVoice, setAssistantVoice] = useState("eve");
  const [userCommands, setUserCommands] = useState([]);
  const now = Date.now();

  // ── Onboarding flow ────────────────────────────────────────────────
  const [onboardingStep, setOnboardingStep] = useState(0); // 0=check, 1=welcome, 2=ai-chat, 3=assistant-setup, 4=install, 5=try-voice, 6=nav-tour, 99=complete
  const onboardingStepRef = useRef(0);
  useEffect(() => { onboardingStepRef.current = onboardingStep; }, [onboardingStep]);

  // Persist onboarding step
  useEffect(() => {
    if (!user?.id || onboardingStep === 0) return;
    try { localStorage.setItem(`trade-pa-onboarding-${user.id}`, String(onboardingStep)); } catch {}
  }, [onboardingStep, user?.id]);

  // Load onboarding step on login
  useEffect(() => {
    if (!user?.id) return;
    try {
      const saved = localStorage.getItem(`trade-pa-onboarding-${user.id}`);
      if (saved === "99") { setOnboardingStep(99); return; }
      if (saved && parseInt(saved) > 0) { setOnboardingStep(parseInt(saved)); return; }
    } catch {}
    // No saved step — check if this is genuinely a new user
    // (brand hasn't been set up yet)
  }, [user?.id]);

  // After brand loads, determine if onboarding is needed
  const brandLoadedRef = useRef(false);
  useEffect(() => {
    if (!user?.id || brandLoadedRef.current || onboardingStep === 99) return;
    // Canonical onboarding check: the existing public.user_onboarding table
    // (per-user, has voice_used / ai_used / dismissed / completed_at flags).
    // RLS allows each user to read/insert/update only their own row.
    //
    // Historical context: this used to rely on a 600ms setTimeout + a heuristic
    // on brand.tradingName ("Your Business", *"'s Trades"). That had two bugs:
    //   1. On 3G / cellular, brand load could exceed 600ms → false-positive "new"
    //   2. Users genuinely named "John's Trades" were misclassified as defaults
    // Both vanish once we read the explicit column.
    let cancelled = false;
    (async () => {
      if (onboardingStep > 0) { brandLoadedRef.current = true; return; }
      try {
        const { data: row } = await db
          .from("user_onboarding")
          .select("completed_at, dismissed")
          .eq("user_id", user.id)
          .maybeSingle();
        if (cancelled) return;
        brandLoadedRef.current = true;
        // Treat dismissed (user explicitly skipped onboarding) the same as
        // completed — don't pester them again on the next login.
        const done = row?.completed_at || row?.dismissed;
        setOnboardingStep(done ? 99 : 1);
      } catch (err) {
        // Network failure or query error — fall back to the old heuristic so
        // a returning user isn't stuck in onboarding if their connection is
        // flaky. Worst case: they see the welcome once and skip through.
        if (cancelled) return;
        brandLoadedRef.current = true;
        const looksDefault =
          !brand.tradingName ||
          brand.tradingName === "" ||
          brand.tradingName === "Your Business" ||
          brand.tradingName.endsWith("'s Trades");
        setOnboardingStep(looksDefault ? 1 : 99);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, onboardingStep]);

  const advanceOnboarding = (toStep) => { setOnboardingStep(toStep); };
  const completeOnboarding = async () => {
    setOnboardingStep(99);
    // Persist server-side so the next device / reinstall / native app never
    // re-triggers onboarding. Fire-and-forget — the local state is the source
    // of truth for this session, this is just for future sessions. Upsert so
    // first-time users get a row and returners just update completed_at.
    try {
      await db.from("user_onboarding")
        .upsert(
          { user_id: user.id, completed_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
    } catch (err) { console.warn("[onboarding] server mark failed:", err?.message); }
  };
  const [navTourStep, setNavTourStep] = useState(0);

  // Load assistant persona + custom commands on login
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data: s } = await db
        .from("user_settings")
        .select("assistant_name, assistant_wake_words, assistant_persona, assistant_signoff, assistant_voice")
        .eq("user_id", user.id)
        .maybeSingle();
      if (s) {
        if (s.assistant_name) setAssistantName(s.assistant_name);
        if (s.assistant_wake_words?.length) setAssistantWakeWords(s.assistant_wake_words);
        if (s.assistant_persona) setAssistantPersona(s.assistant_persona);
        if (s.assistant_signoff) setAssistantSignoff(s.assistant_signoff);
        if (s.assistant_voice) {
          // Migrate legacy voice IDs (british_female etc.) set before the
          // Grok TTS switch. Same mapping lives in AssistantSetup.jsx — keep
          // the two in sync when voices change.
          const LEGACY = { british_female: "ara", british_male: "leo", american_female: "eve", american_male: "rex" };
          const ALLOWED = new Set(["eve", "ara", "leo", "rex", "sal"]);
          const migrated = LEGACY[s.assistant_voice] || s.assistant_voice;
          setAssistantVoice(ALLOWED.has(migrated) ? migrated : "eve");
        }
      }
      const { data: cmds } = await db
        .from("user_commands")
        .select("*")
        .eq("user_id", user.id)
        .eq("enabled", true)
        .order("created_at", { ascending: true });
      if (cmds) setUserCommands(cmds);
    })();
  }, [user?.id]);

  // Load usage tracking for current month
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const { data, error } = await db
          .from("usage_tracking")
          .select("conversations_used, handsfree_seconds_used")
          .eq("user_id", user.id)
          .eq("month", currentMonth)
          .maybeSingle();
        if (!error && data) setUsageData(data);
      } catch (e) { console.warn("[usage] load failed:", e?.message); }
    })();
  }, [user?.id]);

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
    // Prevent iOS Safari from zooming in when focusing inputs with font-size < 16px
    if (viewport && !viewport.content.includes('maximum-scale')) {
      viewport.content = viewport.content + ', maximum-scale=1';
    }
    // Detect iOS and standalone mode
    const ua2 = navigator.userAgent.toLowerCase(); const ios = ua2.indexOf("iphone") !== -1 || ua2.indexOf("ipad") !== -1 || ua2.indexOf("ipod") !== -1;
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
        const { data: ct } = await db.from("call_tracking").select("twilio_number").eq("user_id", user.id).limit(1).maybeSingle();
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

        const tokenRes = await fetch("/api/calls/token", { method: "POST", headers: await authHeaders() });
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
            const r = await fetch("/api/calls/token", { method: "POST", headers: await authHeaders() });
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
    db.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
      // Tag Sentry errors with the current user so we can see who hit what
      try {
        if (session?.user) {
          Sentry.setUser({ id: session.user.id, email: session.user.email });
          setOwnerCookie(session.user.id);
        } else {
          Sentry.setUser(null);
        }
      } catch {}
    });
    const { data: { subscription } } = db.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      try {
        if (session?.user) {
          Sentry.setUser({ id: session.user.id, email: session.user.email });
          setOwnerCookie(session.user.id);
        } else {
          Sentry.setUser(null);
        }
      } catch {}
    });
    return () => subscription.unsubscribe();
  }, []);

  // Check subscription status whenever user changes
  useEffect(() => {
    if (!user) { setSubscriptionStatus(null); return; }

    // Exempt accounts skip subscription check entirely — treated as Business tier
    // so the caps are generous and all features are unlocked.
    const EXEMPT = ["thetradepa@gmail.com", "connor@tradespa.co.uk", "connor_mckay777@hotmail.com", "connor_mckay777@hotmail.co.uk", "landbheating@outlook.com", "shannonandrewsimpson@gmail.com"];
    if (EXEMPT.includes(user.email?.toLowerCase())) {
      setSubscriptionStatus("active");
      setPlanTier("business");
      setUserLimit(getTierConfig("business").userLimit);
      return;
    }

    async function checkSubscription() {
      const { data } = await db.from("subscriptions").select("status, current_period_end, stripe_price_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1);
      if (!data?.length) { setSubscriptionStatus("none"); return; }
      const sub = data[0];

      // Determine plan tier from DB's plan column (set by create-subscription.js).
      // normalizeTier handles legacy "pro" → "business" rename.
      const rawPlan = sub.plan || "solo";
      const detectedPlan = normalizeTier(rawPlan);
      setPlanTier(detectedPlan);
      setUserLimit(getTierConfig(detectedPlan).userLimit);

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
    db.from("user_settings")
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
        await db.from("user_settings").upsert({
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
    await db.auth.signOut();
    setJobsRaw([]); setInvoicesRaw([]); setEnquiriesRaw([]);
    setMaterialsRaw([]); setCustomersRaw([]);
    setCompanyId(null); setCompanyName(""); setMembers([]);
    setUser(null); setView("AI Assistant");
  };

  // ── State declarations ────────────────────────────────────────────────────
  const [jobs, setJobsRaw] = useState([]);
  const [invoices, setInvoicesRaw] = useState([]);
  const [enquiries, setEnquiriesRaw] = useState([]);
  const [materials, setMaterialsRaw] = useState([]);
  const [customers, setCustomersRaw] = useState([]);
  const [customerContacts, setCustomerContactsRaw] = useState([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [jobsRefreshKey, setJobsRefreshKey] = useState(0);
  const [companyId, setCompanyId] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [userRole, setUserRole] = useState("owner");
  const [members, setMembers] = useState([]);
  const [pendingInvite, setPendingInvite] = useState(null);

  // ── In-app notifications (bell icon feed) ─────────────────────────────────
  // Backed by in_app_notifications table. Populated server-side by portal.js
  // (customer views) and can be extended to webhook events, etc. We fetch
  // on load and poll every 60s so the bell badge stays fresh without
  // overwhelming the DB.
  const [inAppNotifs, setInAppNotifs] = useState([]);
  const loadInAppNotifs = async () => {
    if (!user?.id) return;
    try {
      const { data } = await db
        .from("in_app_notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) setInAppNotifs(data);
    } catch {
      // Silently ignore — a transient network blip shouldn't break the UI.
    }
  };
  useEffect(() => {
    if (!user?.id) return;
    loadInAppNotifs();
    const poll = setInterval(loadInAppNotifs, 60000);
    return () => clearInterval(poll);
  }, [user?.id]);

  // Mark a single notification as read. Optimistic update + DB write.
  const markNotifRead = async (id) => {
    setInAppNotifs(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    try {
      await db.from("in_app_notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    } catch {}
  };
  const markAllNotifsRead = async () => {
    const nowIso = new Date().toISOString();
    setInAppNotifs(prev => prev.map(n => n.read_at ? n : { ...n, read_at: nowIso }));
    try {
      await db.from("in_app_notifications")
        .update({ read_at: nowIso })
        .eq("user_id", user.id)
        .is("read_at", null);
    } catch {}
  };
  const dismissNotif = async (id) => {
    setInAppNotifs(prev => prev.filter(n => n.id !== id));
    try { await db.from("in_app_notifications").delete().eq("id", id); } catch {}
  };
  const openNotif = (n) => {
    markNotifRead(n.id);
    if (n.url && n.url !== "/") {
      // Strip leading slash to get the view name (e.g. "/Quotes" -> "Quotes")
      const view = n.url.startsWith("/") ? n.url.slice(1) : n.url;
      if (view) setView(view);
    }
  };

  const unreadNotifCount = inAppNotifs.filter(n => !n.read_at).length;

  // Bound trackEvent helper — captures current user + companyId so callers
  // don't have to pass them on every call. Stable reference via useRef so
  // child components don't re-render when companyId/user arrive.
  const trackEventRef = useRef(null);
  trackEventRef.current = (eventType, eventName, metadata) => {
    trackEvent(db, user?.id, companyId, eventType, eventName, metadata);
  };
  const track = (eventType, eventName, metadata) => {
    trackEventRef.current?.(eventType, eventName, metadata);
  };

  // ── Get or create company for user ───────────────────────────────────────
  const getOrCreateCompany = async (uid) => {
    // Check if user already belongs to a company
    const { data: membership } = await db
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
    const { data: invite } = await db
      .from("invites")
      .select("*")
      .eq("email", user.email)
      .eq("accepted", false)
      .single();

    if (invite) {
      // Accept the invite — join the existing company with permissions from invite
      await db.from("company_members").insert({
        company_id: invite.company_id,
        user_id: uid,
        role: invite.role || "member",
        invited_email: user.email,
        permissions: invite.permissions || null,
      });
      await db.from("invites").update({ accepted: true }).eq("id", invite.id);
      const { data: co } = await db.from("companies").select("name").eq("id", invite.company_id).single();
      setCompanyId(invite.company_id);
      setCompanyName(co?.name || "");
      setUserRole(invite.role || "member");
      setPendingInvite(null);
      return invite.company_id;
    }

    // No company yet — create a new one
    const compName = brand.tradingName || `${user.user_metadata?.full_name || "My"}'s Business`;
    const { data: newCompany } = await db
      .from("companies")
      .insert({ name: compName })
      .select()
      .single();

    if (newCompany) {
      await db.from("company_members").insert({
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
  // fetchAll is hoisted out of the mount useEffect so the manual refresh
  // button (header) and any other consumer can re-run it. Same data, same
  // setters — just a function we can call again on demand.
  const fetchAll = async () => {
    if (!user) return;
    setDbLoading(true);
    try {
      const cid = await getOrCreateCompany(user.id);
      if (!cid) { setDbLoading(false); return; }

      // Load members for team management via the get_company_members
      // RPC — a SECURITY DEFINER function that safely exposes
      // auth.users.email for members of the caller's own company.
      // Returns rows with a user_email column alongside the normal
      // company_members fields.
      const { data: mem } = await db.rpc("get_company_members", { p_company_id: cid });
      if (mem) setMembers(mem);

      const [j, inv, enq, mat, cust, contacts] = await Promise.all([
        db.from("jobs").select("*").eq("company_id", cid).order("date_obj", { ascending: true }),
        db.from("invoices").select("*").eq("company_id", cid).order("created_at", { ascending: false }),
        db.from("enquiries").select("*").eq("company_id", cid).order("created_at", { ascending: false }),
        db.from("materials").select("*").eq("company_id", cid).order("created_at", { ascending: true }),
        db.from("customers").select("*").eq("company_id", cid).order("name", { ascending: true }),
        db.from("customer_contacts").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
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
        // Chase tracking — DB uses snake_case, in-memory uses camelCase.
        // Mirror both so everywhere that reads either form works correctly.
        // See chase_invoice tool handler for the write side.
        chaseCount: r.chase_count || 0,
        lastChased: r.last_chased_at || null,
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
        receiptStoragePath: m.receipt_storage_path || "", // Supabase Storage path (preferred)
        receiptImage: m.receipt_image || "", // legacy base64 column — only one row in prod
      })));
      if (cust.data) setCustomersRaw(cust.data);
      if (contacts.data) setCustomerContactsRaw(contacts.data.map(c => ({
        id: c.id,
        customerId: c.customer_id,
        name: c.name || "",
        role: c.role || "",
        phone: c.phone || "",
        email: c.email || "",
        notes: c.notes || "",
        isPrimary: !!c.is_primary,
        isBilling: !!c.is_billing,
      })));
    } catch (e) { console.error("DB load error:", e); }
    setDbLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchAll();
  }, [user?.id]);

  // Manual refresh — bound to the header refresh button and exposed via
  // window._tradePaRefresh so anywhere else (e.g. a future pull-to-refresh
  // gesture, or an AI tool case) can trigger it without prop-drilling.
  // Also re-fetches in-app notifications so the bell badge stays in sync.
  // Bumping jobsRefreshKey forces JobsTab to re-mount which re-runs its
  // own per-tab loaders.
  const refreshAllData = async () => {
    if (dbLoading) return; // prevent rapid double-taps
    await Promise.all([
      fetchAll(),
      loadInAppNotifs(),
    ]);
    setJobsRefreshKey(k => k + 1);
  };
  useEffect(() => {
    window._tradePaRefresh = refreshAllData;
    return () => { delete window._tradePaRefresh; };
  }, [dbLoading]);

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
            if (!nextIds.has(id)) await db.from("jobs").delete().eq("id", id).eq("company_id", companyId);
          }
          for (const job of next) {
            if (!prevIds.has(String(job.id))) {
              await db.from("jobs").upsert({
                id: String(job.id), company_id: companyId, user_id: user.id,
                customer: job.customer, address: job.address, type: job.type,
                date: job.date, date_obj: job.dateObj || job.date_obj,
                status: job.status, value: job.value || 0, notes: job.notes || "",
              });
            } else {
              const old = prev.find(j => String(j.id) === String(job.id));
              if (JSON.stringify(old) !== JSON.stringify(job)) {
                await db.from("jobs").update({
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
            if (!nextIds.has(id)) await db.from("invoices").delete().eq("id", id).eq("company_id", companyId);
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
              await db.from("invoices").upsert(invRow);
            } else {
              const old = prev.find(i => i.id === inv.id);
              if (JSON.stringify(old) !== JSON.stringify(inv)) {
                const { id, company_id, user_id, ...updateFields } = invRow;
                await db.from("invoices").update(updateFields).eq("id", inv.id).eq("company_id", companyId);
              }
            }
          }
        } catch (e) {
          console.error("Invoices sync:", e);
          // Retry once after 3s — catches brief network blips on mobile
          setTimeout(async () => {
            try {
              for (const inv of next) {
                const invRow = { id: inv.id, company_id: companyId, user_id: user.id, customer: inv.customer || "", amount: inv.amount || 0, gross_amount: inv.grossAmount || inv.amount || 0, due: inv.due, status: inv.status, description: inv.description || "", is_quote: inv.isQuote || false, job_ref: inv.jobRef || "", line_items: JSON.stringify(inv.lineItems || []), vat_enabled: inv.vatEnabled || false, vat_rate: inv.vatRate || 20, payment_method: inv.paymentMethod || "both", cis_enabled: inv.cisEnabled || false, cis_rate: inv.cisRate || 20, cis_deduction: inv.cisDeduction || 0, cis_net_payable: inv.cisNetPayable || 0 };
                await db.from("invoices").upsert(invRow);
              }
            } catch(e2) { console.error("Invoices sync retry failed:", e2); }
          }, 3000);
        }
      })();
      return next;
    });
  };

  // ─── Enquiries sync wrapper ──────────────────────────────────────────────
  // Per-row upsert pattern. Previously this used wipe-and-reinsert on every
  // mutation which caused IDs to mutate on every write, silently breaking any
  // feature relying on stable enquiry references (reminders linked by
  // related_id, push notification deep links, etc).
  //
  // Assumes every enquiry now carries a real UUID in `id` — guaranteed by
  // the three creation paths that use newEnquiryId(): voice create_enquiry
  // tool, manual Add Enquiry form, and inbox email-to-enquiry conversion.
  const setEnquiries = (updater) => {
    setEnquiriesRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (!companyId) return next;
      (async () => {
        try {
          const prevIds = new Set(prev.map(e => e.id).filter(Boolean));
          const nextIds = new Set(next.map(e => e.id).filter(Boolean));
          // Delete rows that disappeared from the next state
          for (const id of prevIds) {
            if (!nextIds.has(id)) {
              await db.from("enquiries").delete().eq("id", id).eq("company_id", companyId);
            }
          }
          // Insert new rows + update changed rows
          for (const e of next) {
            const row = {
              company_id: companyId, user_id: user.id,
              name: e.name, source: e.source, msg: e.msg, time: e.time,
              urgent: e.urgent || false, status: e.status || "new",
              phone: e.phone || "", email: e.email || "", address: e.address || "",
            };
            if (!e.id || !prevIds.has(e.id)) {
              // New row. If e.id is already a uuid string, pass it through so
              // the client's reference matches the DB row. If e.id is missing
              // (shouldn't happen after the creation-path fixes, but defensive),
              // let Postgres generate one.
              if (e.id) row.id = e.id;
              await db.from("enquiries").insert(row);
            } else {
              const old = prev.find(x => x.id === e.id);
              if (JSON.stringify(old) !== JSON.stringify(e)) {
                await db.from("enquiries").update(row).eq("id", e.id).eq("company_id", companyId);
              }
            }
          }
        } catch (err) { console.error("Enquiries sync:", err); }
      })();
      return next;
    });
  };

  const setMaterials = (updater) => {
    // Use setMaterialsRaw directly — individual tools handle their own Supabase writes
    // The old delete+reinsert pattern was causing duplicates to re-appear after cleanup
    setMaterialsRaw(updater);
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
            if (!nextIds.has(id)) await db.from("customers").delete().eq("id", id).eq("company_id", companyId);
          }
          for (const c of next) {
            if (!prevIds.has(c.id)) {
              // Skip rows already inserted directly via db.from('customers').insert(...)
              // — those carry a created_at from the server or offline handler.
              // Without this, the Add Customer flow (which now pre-inserts to get
              // a real id before building contacts) would cause a duplicate insert.
              if (c.created_at) continue;
              await db.from("customers").insert({
                company_id: companyId, user_id: user.id,
                name: c.name, phone: c.phone || "", email: c.email || "",
                address: c.address || "", notes: c.notes || "",
                is_company: !!c.is_company,
              });
            } else {
              const old = prev.find(x => x.id === c.id);
              if (JSON.stringify(old) !== JSON.stringify(c)) {
                await db.from("customers").update({
                  name: c.name, phone: c.phone || "", email: c.email || "",
                  address: c.address || "", notes: c.notes || "",
                  is_company: !!c.is_company,
                }).eq("id", c.id).eq("company_id", companyId);
              }
            }
          }
        } catch (e) { console.error("Customers sync:", e); }
      })();
      return next;
    });
  };

  // ─── Customer contacts sync wrapper ──────────────────────────────────────
  // Same diff-and-sync pattern as setCustomers. Each contact belongs to exactly
  // one customer via customerId. Rows use UUID primary keys so client-side ID
  // is generated server-side on insert (we rely on Supabase gen_random_uuid).
  const setCustomerContacts = (updater) => {
    setCustomerContactsRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (!user?.id) return next;
      (async () => {
        try {
          const prevIds = new Set(prev.map(c => c.id).filter(Boolean));
          const nextIds = new Set(next.map(c => c.id).filter(Boolean));
          for (const id of prevIds) {
            if (!nextIds.has(id)) {
              await db.from("customer_contacts").delete().eq("id", id).eq("user_id", user.id);
            }
          }
          for (let idx = 0; idx < next.length; idx++) {
            const c = next[idx];
            if (!c.id || !prevIds.has(c.id)) {
              // New contact — insert and capture the server-assigned UUID back into state
              const { data: inserted } = await db.from("customer_contacts").insert({
                customer_id: c.customerId,
                user_id: user.id,
                company_id: companyId,
                name: c.name || "",
                role: c.role || "",
                phone: c.phone || "",
                email: c.email || "",
                notes: c.notes || "",
                is_primary: !!c.isPrimary,
                is_billing: !!c.isBilling,
              }).select().single();
              if (inserted) {
                setCustomerContactsRaw(curr => curr.map((x, i) => (i === idx && !x.id) ? { ...x, id: inserted.id } : x));
              }
            } else {
              const old = prev.find(x => x.id === c.id);
              if (JSON.stringify(old) !== JSON.stringify(c)) {
                await db.from("customer_contacts").update({
                  name: c.name || "",
                  role: c.role || "",
                  phone: c.phone || "",
                  email: c.email || "",
                  notes: c.notes || "",
                  is_primary: !!c.isPrimary,
                  is_billing: !!c.isBilling,
                }).eq("id", c.id).eq("user_id", user.id);
              }
            }
          }
        } catch (e) { console.error("Customer contacts sync:", e); }
      })();
      return next;
    });
  };

  // Watch for reminders that just became due
  // Show the in-app alert + flash the bell, but don't auto-dismiss —
  // the user must explicitly tap "Done ✓" so they don't lose track of
  // things they haven't actually followed through on yet.
  useEffect(() => {
    const t = setInterval(() => {
      const due = reminders.filter(r => !r.done && !r._due && r.time <= Date.now() && r.time > Date.now() - 60000);
      if (due.length > 0) {
        setDueNow(d => [...d, ...due.filter(r => !d.find(x => x.id === r.id))]);
        setBellFlash(true);
        setTimeout(() => setBellFlash(false), 3000);
        // Mark as 'fired' so we don't keep alerting on the same reminder,
        // but leave 'done' false so it stays visible in Upcoming as Overdue.
        due.forEach(r => markFired(r.id));
      }
    }, 5000);
    return () => clearInterval(t);
  }, [reminders]);

  const upcomingCount = reminders.filter(r => !r.done && !r._due && r.time > now).length;
  const overdueCount = reminders.filter(r => !r.done && !r._due && r.time <= now).length;
  const alertCount = dueNow.length + overdueCount;

  // Auth gate

  const handleScanReceipt = async (file) => {
    if (!file) return null;
    const { fileContent } = await fileToContentBlock(file);
    const resp = await fetch("/api/claude", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: [fileContent, { type: "text", text: "You are reading a UK supplier receipt. Return ONLY valid JSON with keys: supplier, date, total, vatAmount, vatRate, pricesIncVat, items (array of item, qty, unitPrice, unitPriceExVat)" }] }],
      }),
    });
    const data = await resp.json();
    const raw = (data.content && data.content[0] && data.content[0].text) || "";
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("Could not parse receipt");
    const parsed = JSON.parse(raw.slice(start, end + 1));
    const receiptId = "rcpt_" + Date.now();
    try { localStorage.setItem("trade-pa-receipt-" + receiptId, dataUrl); } catch (e2) {}
    const newMats = (parsed.items || []).map(function(item) {
      var vr = parseInt(parsed.vatRate || 0);
      var ve = vr > 0;
      var exVat = item.unitPriceExVat || (parsed.pricesIncVat && ve ? parseFloat((item.unitPrice / (1 + vr / 100)).toFixed(4)) : item.unitPrice) || 0;
      return { item: item.item, qty: item.qty || 1, unitPrice: parseFloat(exVat.toFixed(2)), supplier: parsed.supplier || "", status: "ordered", vatEnabled: ve, vatRate: ve ? vr : null, dueDate: parsed.date || "", receiptId: receiptId, receiptImage: dataUrl };
    });
    setMaterials(function(prev) { return [...(prev || []), ...newMats]; });
    return Object.assign({}, parsed, { receiptId: receiptId, receiptImage: dataUrl });
  };

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
          <button onClick={async () => { await db.auth.signOut(); setUser(null); }} style={{ background: "transparent", border: "none", color: "#555", fontSize: 13, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>
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

  // ── ONBOARDING: Step 0 — detecting if onboarding needed ─────────────
  if (onboardingStep === 0) return (
    <div style={{ minHeight: "100vh", background: "#0f0f0f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono',monospace", color: "#6b7280", fontSize: 13, gap: 12 }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: "#000" }}>TP</div>
    </div>
  );

  // ── ONBOARDING: Step 1 — Welcome screen ────────────────────────────
  if (onboardingStep === 1) return (
    <div style={{ minHeight: "100dvh", background: "#0a0a0a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'DM Sans', sans-serif", color: "#f0f0f0" }}>
      <div style={{ maxWidth: 340, width: "100%", textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: 18, background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 900, color: "#000", margin: "0 auto 28px", fontFamily: "'DM Mono',monospace" }}>TP</div>
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8 }}>Welcome to Trade PA</div>
        <div style={{ fontSize: 14, color: "#888", lineHeight: 1.7, marginBottom: 32 }}>Your AI-powered business assistant.<br/>Let's get you set up — takes about 2 minutes.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, textAlign: "left", marginBottom: 32 }}>
          {[
            { icon: "M19 11a7 7 0 01-14 0M12 18v4M8 22h8M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3z", label: "Tell me about your business" },
            { icon: "M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2", label: "Name your assistant" },
            { icon: "M13 10V3L4 14h7v7l9-11h-7z", label: "Try your first voice command" },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, background: "#1a1a1a", border: "1px solid #333", borderRadius: 12, padding: "12px 16px" }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: i === 0 ? "#f59e0b22" : "#1a1a1a", border: `1px solid ${i === 0 ? "#f59e0b44" : "#333"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={i === 0 ? "#f59e0b" : "#888"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon}/></svg>
              </div>
              <span style={{ fontSize: 13, color: i === 0 ? "#f0f0f0" : "#888" }}>{item.label}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => { advanceOnboarding(2); setView("AI Assistant"); }}
          style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: "#f59e0b", color: "#000", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}
        >Let's go</button>
      </div>
    </div>
  );

  return (
    <div style={S.app}>
      <OfflineBanner onOpenSettings={() => setOfflineSettingsOpen(true)} />
      <UpdateBanner />
      <OfflineSettings open={offlineSettingsOpen} onClose={() => setOfflineSettingsOpen(false)} />
      <ChangelogModal open={changelogOpen} onClose={() => setChangelogOpen(false)} />

      {/* ── ONBOARDING OVERLAYS ──────────────────────────────────────── */}

      {/* Step 4: Install prompt — skip on desktop */}
      {onboardingStep === 4 && isDesktopBrowser && (() => { advanceOnboarding(5); return null; })()}
      {onboardingStep === 4 && !isDesktopBrowser && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: "#0a0a0a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'DM Sans',sans-serif" }}>
          <div style={{ maxWidth: 340, width: "100%", textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#f0f0f0", marginBottom: 8 }}>Add to your home screen</div>
            <div style={{ fontSize: 13, color: "#888", lineHeight: 1.7, marginBottom: 28 }}>Trade PA works best as a home screen app. No app store needed — it installs in seconds.</div>
            {isIos ? (
              <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 14, padding: "16px 18px", textAlign: "left", marginBottom: 24 }}>
                {[
                  { n: "1", text: <>Tap the <strong style={{ color: "#f59e0b" }}>Share</strong> button in Safari</> },
                  { n: "2", text: <>Scroll down and tap <strong style={{ color: "#f59e0b" }}>Show More</strong></> },
                  { n: "3", text: <>Tap <strong style={{ color: "#f59e0b" }}>Add to Home Screen</strong></> },
                ].map(({ n, text }) => (
                  <div key={n} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: n !== "3" ? "1px solid #333" : "none" }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#000", flexShrink: 0 }}>{n}</div>
                    <span style={{ fontSize: 13, color: "#ccc" }}>{text}</span>
                  </div>
                ))}
              </div>
            ) : pwaPrompt ? (
              <button onClick={async () => { pwaPrompt.prompt(); const { outcome } = await pwaPrompt.userChoice; if (outcome === "accepted") advanceOnboarding(5); }} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: "#f59e0b", color: "#000", fontSize: 15, fontWeight: 600, cursor: "pointer", marginBottom: 24 }}>Install app</button>
            ) : (
              <div style={{ fontSize: 12, color: "#666", marginBottom: 24 }}>Open in Chrome or Safari for the best install experience.</div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => advanceOnboarding(5)} style={{ flex: 1, padding: 12, borderRadius: 12, border: "1px solid #333", background: "transparent", color: "#888", fontSize: 13, cursor: "pointer" }}>I'll do it later</button>
              <button onClick={() => advanceOnboarding(5)} style={{ flex: 1, padding: 12, borderRadius: 12, border: "none", background: "#f59e0b", color: "#000", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Done — next</button>
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Try your first voice command */}
      {onboardingStep === 5 && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: "#0a0a0a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'DM Sans',sans-serif" }}>
          <div style={{ maxWidth: 340, width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#888", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Last step</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#f0f0f0", marginBottom: 8 }}>Try your first command</div>
            <div style={{ fontSize: 13, color: "#888", lineHeight: 1.7, marginBottom: 28 }}>{isDesktopBrowser ? "Type this in the chat box..." : "Tap the mic and say..."}</div>
            <div style={{ background: "#f59e0b0a", border: "1px solid #f59e0b33", borderRadius: 14, padding: "18px 22px", marginBottom: 28 }}>
              <div style={{ fontSize: 16, color: "#f59e0b", fontFamily: "'DM Mono',monospace", lineHeight: 1.6 }}>"Add a customer called John Smith, 07700 900456"</div>
            </div>
            <button
              onClick={() => {
                advanceOnboarding(6);
                setView("AI Assistant");
                // Send the command in background — AI processes while nav tour plays
                setTimeout(() => voiceHandle.current?.sendText?.("Add a customer called John Smith, phone 07700 900456"), 400);
              }}
              style={{ width: 110, height: 110, borderRadius: "50%", background: "#f59e0b", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}
            >
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>
            </button>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 20 }}>Or type it — whatever's easier right now</div>
            <button onClick={() => advanceOnboarding(6)} style={{ padding: "8px 18px", borderRadius: 10, border: "1px solid #333", background: "transparent", color: "#666", fontSize: 12, cursor: "pointer" }}>Skip — show me around first</button>
          </div>
        </div>
      )}

      {/* Step 6: Navigation tour overlay — device-aware */}
      {onboardingStep === 6 && (() => {
        const MOBILE_TOUR = [
          { label: "This is home", desc: "Your PA lives here. Tap the mic to get started.", tabIndex: 0 },
          { label: "Your jobs", desc: "Job cards, materials, labour, photos, certs, and daywork.", tabIndex: 1 },
          { label: "Your diary", desc: "Your schedule. Book jobs by voice or tap to add.", tabIndex: 2 },
          { label: "Accounts", desc: "Invoices, quotes, expenses, mileage, CIS — all your money stuff.", tabIndex: 3 },
          { label: "People", desc: "Customers, subcontractors, and your team.", tabIndex: 4 },
          { label: "Settings", desc: "Tap your avatar to open Settings. Bank details, logo, trade registrations.", tabIndex: -1 },
          { label: "Speak from anywhere", desc: "This mic button follows you to every screen. Tap it — hands-free, no touching your phone.", tabIndex: -2 },
        ];
        const DESKTOP_TOUR = [
          { label: "Home", desc: "Your PA lives here. Type commands or use the mic.", group: "home", itemIndex: 0 },
          { label: "Jobs", desc: "Enquiries, job cards, materials, stock, RAMS, and documents.", group: "work", itemIndex: -1 },
          { label: "Diary", desc: "Your schedule and reminders. Book jobs by voice or click to add.", group: "diary", itemIndex: -1 },
          { label: "Accounts", desc: "Invoices, quotes, expenses, mileage, payments, CIS, and reports.", group: "money", itemIndex: -1 },
          { label: "People", desc: "Customers, subcontractors, and your team.", group: "people", itemIndex: -1 },
          { label: "Settings", desc: "Click your avatar in the top right. Bank details, logo, trade registrations.", group: "admin", itemIndex: -1 },
        ];
        const TOUR = isDesktopBrowser ? DESKTOP_TOUR : MOBILE_TOUR;
        const current = TOUR[navTourStep];
        if (!current) return null;
        const advance = () => { if (navTourStep < TOUR.length - 1) setNavTourStep(s => s + 1); else completeOnboarding(); };
        const dotRow = (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 5 }}>
              {TOUR.map((_, i) => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i === navTourStep ? "#f59e0b" : "#444" }} />)}
            </div>
            <span style={{ fontSize: 12, color: navTourStep < TOUR.length - 1 ? "#f59e0b" : "#4ade80", fontWeight: 600 }}>
              {navTourStep < TOUR.length - 1 ? (isDesktopBrowser ? "Click to continue" : "Tap to continue") : "Done — let's go!"}
            </span>
          </div>
        );
        const tooltip = (
          <div style={{ background: "#1a1a1a", border: "1.5px solid #f59e0b", borderRadius: 14, padding: "14px 18px", maxWidth: 280, cursor: "pointer" }} onClick={advance}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#f0f0f0", marginBottom: 4 }}>{current.label}</div>
            <div style={{ fontSize: 12, color: "#aaa", lineHeight: 1.6, marginBottom: 10 }}>{current.desc}</div>
            {dotRow}
          </div>
        );

        if (isDesktopBrowser) {
          // Desktop: highlight sidebar groups
          const sidebarGroups = ["home", "work", "diary", "money", "people", "admin"];
          const highlightIndex = sidebarGroups.indexOf(current.group);
          return (
            <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: "#000c", display: "flex" }} onClick={advance}>
              {/* Fake sidebar with highlighted group */}
              <div style={{ width: 220, flexShrink: 0, padding: "16px 8px", background: "#111", borderRight: "1px solid #333" }}>
                {sidebarGroups.map((gId, gi) => {
                  const isActive = gi === highlightIndex;
                  const labels = { home: "Home", work: "Jobs", diary: "Diary", money: "Accounts", people: "People", admin: "Admin" };
                  return (
                    <div key={gId} style={{ marginBottom: 14, opacity: isActive ? 1 : 0.15 }}>
                      <div style={{ fontSize: 9, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em", padding: "4px 12px 6px", fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{labels[gId]}</div>
                      {isActive && (
                        <div style={{ padding: "7px 12px", borderRadius: 10, background: "#f59e0b", color: "#000", fontSize: 12, fontWeight: 700, fontFamily: "'DM Mono',monospace", boxShadow: "0 0 0 2px #f59e0b66" }}>
                          {labels[gId] === "Home" ? "Home" : labels[gId]}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Tooltip positioned next to sidebar */}
              <div style={{ flex: 1, display: "flex", alignItems: highlightIndex <= 2 ? "flex-start" : "center", justifyContent: "flex-start", padding: "80px 40px" }} onClick={e => e.stopPropagation()}>
                {tooltip}
              </div>
            </div>
          );
        }

        // Mobile: highlight bottom tabs
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: "#000c", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
            onClick={advance}>
            {/* Tooltip */}
            <div style={{ position: "absolute", bottom: current.tabIndex === -2 ? 90 : current.tabIndex === -1 ? "auto" : 66, top: current.tabIndex === -1 ? 56 : "auto", left: 16, right: 16, display: "flex", justifyContent: current.tabIndex === -1 ? "flex-end" : current.tabIndex === -2 ? "flex-end" : "center" }} onClick={e => e.stopPropagation()}>
              {tooltip}
            </div>
            {/* Highlighted nav bar */}
            {current.tabIndex >= 0 && (
              <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", padding: "10px 12px 20px", background: "#111" }}>
                {["Home", "Jobs", "Diary", "Accounts", "People"].map((t, i) => (
                  <div key={t} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 8px", borderRadius: 10, opacity: i === current.tabIndex ? 1 : 0.2, background: i === current.tabIndex ? "#f59e0b11" : "transparent", boxShadow: i === current.tabIndex ? "0 0 0 2px #f59e0b66" : "none" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={i === current.tabIndex ? "#f59e0b" : "#888"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {i === 0 && <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>}
                      {i === 1 && <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>}
                      {i === 2 && <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>}
                      {i === 3 && <><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></>}
                      {i === 4 && <><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/></>}
                    </svg>
                    <span style={{ fontSize: 10, color: i === current.tabIndex ? "#f59e0b" : "#888" }}>{t}</span>
                  </div>
                ))}
              </div>
            )}
            {/* Settings highlight */}
            {current.tabIndex === -1 && (
              <div style={{ position: "absolute", top: 10, right: 14, padding: 4, borderRadius: "50%", boxShadow: "0 0 0 3px #f59e0b66", background: "#f59e0b11" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#000" }}>{brand.ownerName?.[0] || "U"}</div>
              </div>
            )}
            {/* Mic highlight */}
            {current.tabIndex === -2 && (
              <div style={{ position: "absolute", right: 16, bottom: 24, width: 56, height: 56, borderRadius: "50%", background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 4px #f59e0b66" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/></svg>
              </div>
            )}
          </div>
        );
      })()}
      {pdfHtml && <PDFOverlay html={pdfHtml} onClose={() => setPdfHtml(null)} />}
      {incomingCall?.call && <IncomingCallScreen callerName={incomingCall.callerName} callerNumber={incomingCall.callerNumber} onAnswer={answerCall} onDecline={declineCall} />}
      {activeCall?.call && <ActiveCallScreen callerName={activeCall.callerName} callerNumber={activeCall.callerNumber} direction={activeCall.direction} startTime={activeCall.startTime} muted={callMuted} onMute={toggleMute} onHangUp={hangUp} speaker={callSpeaker} onSpeaker={toggleSpeaker} />}
      {micBlocked && (
        <div style={{ position: "fixed", top: "max(52px, env(safe-area-inset-top, 52px))", left: 0, right: 0, zIndex: 200, background: "#ef4444", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16 }}>🎙️</span>
          <div style={{ flex: 1, fontSize: 12, color: "#fff", lineHeight: 1.5 }}>
            <strong>Microphone blocked</strong> — calls can't ring in the app. Go to your browser/device settings and allow microphone access for Trade PA.
          </div>
          <button onClick={() => setMicBlocked(false)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: "0 4px" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>
      )}

      {/* PWA Install Banner */}
      {showPwaBanner && !isStandalone && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 500, padding: "12px 16px", paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))", background: "#1a1a1a", borderTop: "1px solid #2a2a2a", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, background: "#f59e0b", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, color: "#000", flexShrink: 0 }}>TP</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f0f0f0" }}>Install Trade PA</div>
            {isIos
              ? <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>Tap <strong style={{ color: "#f59e0b" }}>Share</strong> → <strong style={{ color: "#f59e0b" }}>Show More</strong> → <strong style={{ color: "#f59e0b" }}>Add to Home Screen</strong></div>
              : <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>Add to your home screen for the best experience</div>
            }
          </div>
          {pwaPrompt && !isIos && (
            <button onClick={async () => { pwaPrompt.prompt(); const { outcome } = await pwaPrompt.userChoice; if (outcome === "accepted") setShowPwaBanner(false); }} style={{ background: "#f59e0b", color: "#000", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono',monospace", flexShrink: 0 }}>Install →</button>
          )}
          <button aria-label="Close" onClick={() => setShowPwaBanner(false)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", flexShrink: 0, padding: "0 4px" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>
      )}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html,body{width:100%;overflow-x:hidden;}
        ::-webkit-scrollbar{width:5px;}
        ::-webkit-scrollbar-track{background:var(--c-surface);}
        ::-webkit-scrollbar-thumb{background:var(--c-border);border-radius:3px;}
        .nav-scroll::-webkit-scrollbar{display:none;}
        button:hover:not(:disabled){opacity:0.82;}
        input:focus,textarea:focus{border-color:#f59e0b !important;outline:none;}
        @keyframes bellPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.3)}}
        img{max-width:100%;}
        /* iOS Safari zooms into any input/textarea/select with computed
           font-size < 16px when tapped, and never zooms back out. The fix
           is to enforce a 16px minimum globally — the !important wins
           against inline styles like fontSize: 11/12/13 scattered throughout
           the codebase. Slightly chunkier inputs are an acceptable trade for
           "phone form-filling that doesn't make you want to throw it out
           the window." Date / time / number inputs are included because
           they trigger the same zoom behaviour. */
        input,textarea,select{font-size:16px !important;}
      `}</style>
      <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 100, width: "100%" }}>
        {/* New simplified header — Session C + mockup-faithful: brand + bell + avatar only */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", paddingTop: "max(12px, env(safe-area-inset-top, 12px))", height: "calc(54px + env(safe-area-inset-top, 0px))", boxSizing: "border-box", position: "relative" }}>
          {/* Brand — tap returns to Home (Dashboard) */}
          <div style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }} onClick={() => setView("AI Assistant")}>
            <div style={{
              width: 30, height: 30,
              background: C.amber,
              color: "#000",
              borderRadius: 8,
              display: "grid", placeItems: "center",
              fontFamily: "'DM Mono', monospace",
              fontSize: 12, fontWeight: 900,
            }}>TP</div>
            <div style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 12, fontWeight: 700,
              letterSpacing: "0.14em",
              color: C.text,
            }}>TRADE PA</div>
          </div>
          {/* Right: bell + avatar */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Manual refresh — re-fetches jobs/invoices/enquiries/materials/
                customers/notifications from Supabase. Tradies on flaky 4G
                often have stale state (especially after voice-driven changes
                from another device); this button is the explicit "give me
                the latest" without losing app state, modals, or AI context. */}
            <button
              onClick={() => { if (typeof window._tradePaRefresh === "function") window._tradePaRefresh(); }}
              disabled={dbLoading}
              aria-label="Refresh data"
              title="Refresh"
              style={{
                width: 36, height: 36,
                background: "transparent",
                border: "none",
                borderRadius: 10,
                color: dbLoading ? C.amber : C.textDim,
                cursor: dbLoading ? "wait" : "pointer",
                display: "grid", placeItems: "center",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: dbLoading ? "spin 0.9s linear infinite" : "none", transformOrigin: "center" }}>
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
            {/* Notification bell with count.
                The badge surfaces two signals in priority order:
                  1. alertCount (overdue/due-now reminders) — red, most urgent
                  2. unreadNotifCount (in-app notifs — customer viewed, etc) — amber
                Future reminders are NOT badged here — they're surfaced via the
                Reminders bottom-nav badge instead. Otherwise the bell would
                claim "you have things to look at" when tapping it leads to a
                panel that doesn't show reminders.
                Tap routing: red badge → Reminders (the actionable surface for
                overdue items). Amber badge → Notifications. Both → Notifications
                (it has links into Reminders inside it). */}
            <button
              onClick={() => {
                if (alertCount > 0 && unreadNotifCount === 0) setView("Reminders");
                else setView("Notifications");
              }}
              aria-label="Notifications"
              style={{
                position: "relative",
                width: 36, height: 36,
                background: "transparent",
                border: "none",
                borderRadius: 10,
                color: C.textDim,
                cursor: "pointer",
                display: "grid", placeItems: "center",
              }}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: bellFlash ? "bellPulse 0.4s ease 3" : "none" }}>
                <path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {(alertCount > 0 || unreadNotifCount > 0) && (
                <div style={{
                  position: "absolute",
                  top: 2, right: 2,
                  minWidth: 18, height: 18,
                  padding: "0 5px",
                  background: alertCount > 0 ? C.red : C.amber,
                  color: alertCount > 0 ? "#fff" : "#000",
                  borderRadius: 9,
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10, fontWeight: 700,
                  display: "grid", placeItems: "center",
                  border: `2px solid ${C.surface}`,
                }}>{alertCount > 0 ? alertCount : unreadNotifCount}</div>
              )}
            </button>
            {/* Avatar button — opens dropdown menu */}
            <button
              onClick={() => setAvatarMenuOpen(v => !v)}
              aria-label="Account menu"
              aria-expanded={avatarMenuOpen}
              style={{
                position: "relative",
                width: 34, height: 34,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${C.amber}, #B45309)`,
                color: "#000",
                border: "none",
                display: "grid", placeItems: "center",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13, fontWeight: 700,
                cursor: "pointer",
                padding: 0,
              }}
            >
              {(brand?.email || user?.email || "?")[0].toUpperCase()}
              <span style={{
                position: "absolute",
                bottom: -2, right: -2,
                width: 10, height: 10,
                background: C.green,
                borderRadius: "50%",
                border: `2px solid ${C.surface}`,
              }} />
            </button>
          </div>

          {/* Avatar dropdown menu — overlay, click-outside dismisses */}
          {avatarMenuOpen && (
            <>
              {/* Transparent click-catcher to dismiss on outside-click */}
              <div
                onClick={() => setAvatarMenuOpen(false)}
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 199,
                  background: "transparent",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% - 4px)",
                  right: 14,
                  width: 240,
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  boxShadow: "0 20px 50px -10px rgba(0,0,0,0.7), 0 0 40px -10px rgba(245,158,11,0.12)",
                  padding: 6,
                  zIndex: 200,
                }}
                role="menu"
              >
                {/* User header */}
                <div style={{ padding: "10px 10px 10px", borderBottom: `1px solid ${C.border}`, marginBottom: 4 }}>
                  <div style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 13, fontWeight: 700,
                    color: C.text,
                    letterSpacing: "-0.01em",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{brand?.tradingName || companyName || "Account"}</div>
                  <div style={{
                    fontSize: 11,
                    color: C.textDim,
                    marginTop: 2,
                    fontFamily: "'DM Mono', monospace",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{brand?.email || user?.email || ""}</div>
                </div>

                {/* Settings */}
                <button
                  onClick={() => { setAvatarMenuOpen(false); setView("Settings"); }}
                  role="menuitem"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "18px 1fr 12px",
                    gap: 10,
                    alignItems: "center",
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    background: "transparent",
                    border: "none",
                    color: C.text,
                    fontSize: 13, fontWeight: 500,
                    fontFamily: "'DM Sans', sans-serif",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" style={{ color: C.textDim }}>
                    <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Settings</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12" style={{ color: C.textFaint || C.muted }}>
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* AI Assistant config */}
                <button
                  onClick={() => { setAvatarMenuOpen(false); setAssistantSetupOpen(true); }}
                  role="menuitem"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "18px 1fr 12px",
                    gap: 10,
                    alignItems: "center",
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    background: "transparent",
                    border: "none",
                    color: C.text,
                    fontSize: 13, fontWeight: 500,
                    fontFamily: "'DM Sans', sans-serif",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" style={{ color: C.textDim }}>
                    <path d="M19 11a7 7 0 01-14 0M12 18v4M8 22h8M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3z" />
                  </svg>
                  <span>AI Assistant config</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12" style={{ color: C.textFaint || C.muted }}>
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Help & feedback */}
                <button
                  onClick={() => { setAvatarMenuOpen(false); setHelpSlug(null); setHelpOpen(true); }}
                  role="menuitem"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "18px 1fr 12px",
                    gap: 10,
                    alignItems: "center",
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    background: "transparent",
                    border: "none",
                    color: C.text,
                    fontSize: 13, fontWeight: 500,
                    fontFamily: "'DM Sans', sans-serif",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" style={{ color: C.textDim }}>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01" />
                  </svg>
                  <span>Help & feedback</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12" style={{ color: C.textFaint || C.muted }}>
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Divider */}
                <div style={{ height: 1, background: C.border, margin: "4px 6px" }} />

                {/* Sign out */}
                <button
                  onClick={() => { setAvatarMenuOpen(false); handleLogout(); }}
                  role="menuitem"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "18px 1fr",
                    gap: 10,
                    alignItems: "center",
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    background: "transparent",
                    border: "none",
                    color: C.red,
                    fontSize: 13, fontWeight: 500,
                    fontFamily: "'DM Sans', sans-serif",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                    <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Sign out</span>
                </button>
              </div>
            </>
          )}
        </div>
        {/* Top tab bar (category pills + sub-tabs) — KILLED on mobile.
            Desktop browser still uses its side-nav below (unchanged). */}
      </header>
      <div style={isDesktopBrowser ? { display: "flex", alignItems: "flex-start", width: "100%" } : {}}>
        {isDesktopBrowser && (
          <nav style={{ width: 220, flexShrink: 0, padding: "16px 8px", borderRight: `1px solid ${C.border}`, position: "sticky", top: "calc(48px + env(safe-area-inset-top, 0px))", maxHeight: "calc(100vh - 48px)", overflowY: "auto", boxSizing: "border-box" }}>
            {NAV_GROUPS.map(g => {
              const allowed = g.views.filter(v => {
                if (userRole !== "owner" && v === "Settings") return false;
                const myMember = members.find(m => m.user_id === user?.id);
                const perms = myMember?.permissions;
                return !perms || perms[v] !== false;
              });
              if (!allowed.length) return null;
              const SIDEBAR_ICONS = {
                "AI Assistant": "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z",
                "Enquiries": "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z",
                "Jobs": "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 3h6v4H9V3z",
                "Materials": "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
                "Stock": "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z",
                "RAMS": "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
                "Documents": "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6M16 13H8M16 17H8M10 9H8",
                "Schedule": "M3 5a2 2 0 012-2h14a2 2 0 012 2v16a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM16 2v4M8 2v4M3 10h18",
                "Reminders": "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0",
                "Invoices": "M2 6a2 2 0 012-2h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM12 8v8M8 12h8",
                "Quotes": "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
                "Expenses": "M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6",
                "Mileage": "M12 22s-8-4.5-8-11.8A8 8 0 0112 2a8 8 0 018 8.2c0 7.3-8 11.8-8 11.8zM12 7v5l3 2",
                "Payments": "M2 6a2 2 0 012-2h16a2 2 0 012 2v4H2V6zM2 14h20v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z",
                "CIS": "M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2zM9 7h6M9 11h6M9 15h4",
                "Reports": "M18 20V10M12 20V4M6 20v-6",
                "Customers": "M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M8.5 3a4 4 0 110 8 4 4 0 010-8zM20 8v6M23 11h-6",
                "Workers": "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 110 8 4 4 0 010-8z",
                "Subcontractors": "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 3a4 4 0 110 8 4 4 0 010-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
                "Reviews": "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
                "Inbox": "M3 7l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
                "Settings": "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
              };
              return (
                <div key={g.id} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", padding: "4px 12px 6px", fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{g.label}</div>
                  {allowed.map(v => {
                    const active = view === v;
                    const label = v === "AI Assistant" ? "Home" : v;
                    return (
                      <button
                        key={v}
                        onClick={() => { setActiveCategory(g.id); setView(v); }}
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          width: "100%", padding: "7px 12px", marginBottom: 1,
                          border: "none", borderRadius: 10,
                          background: active ? C.amber : "transparent",
                          color: active ? "#000" : C.text,
                          fontSize: 12, fontWeight: active ? 700 : 500,
                          fontFamily: "'DM Mono',monospace",
                          cursor: "pointer", textAlign: "left",
                          transition: "background 0.12s",
                        }}
                        onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.surfaceHigh; }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={active ? "#000" : C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d={SIDEBAR_ICONS[v] || "M4 6h16M4 12h16M4 18h16"}/></svg>
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>
        )}
      <main style={{ ...S.main, paddingTop: view === "AI Assistant" || view === "Reminders" || view === "Notifications" ? 16 : 24, paddingBottom: isDesktopBrowser ? undefined : "60px", ...(isDesktopBrowser ? { flex: 1, maxWidth: "none", padding: "24px 32px", boxSizing: "border-box" } : {}) }}>
        <div style={isDesktopBrowser ? { maxWidth: 720, margin: "0 auto", width: "100%" } : { display: "contents" }}>
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
        {view === "Dashboard" && (() => { setView("AI Assistant"); return null; })()}
        {view === "JobsHub" && <JobsHub setView={setView} jobs={jobs} enquiries={enquiries} materials={materials} />}
        {view === "DiaryHub" && <DiaryHub setView={setView} jobs={jobs} reminders={reminders} />}
        {view === "AccountsHub" && <AccountsHub setView={setView} invoices={invoices} />}
        {view === "PeopleHub" && <PeopleHub setView={setView} customers={customers} enquiries={enquiries} />}
        {view === "Schedule" && <Schedule jobs={jobs} setJobs={setJobs} customers={customers} setContextHint={setContextHint} />}
        {view === "Enquiries" && <EnquiriesTab enquiries={enquiries} setEnquiries={setEnquiries} customers={customers} setCustomers={setCustomers} invoices={invoices} setInvoices={setInvoices} brand={brand} user={user} setView={setView} setContextHint={setContextHint} />}
        {view === "Jobs" && <JobsTab key={jobsRefreshKey} user={user} brand={brand} customers={customers} invoices={invoices} setInvoices={setInvoices} setView={setView} setContextHint={setContextHint} />}
        {view === "Customers" && <Customers customers={customers} setCustomers={setCustomers} customerContacts={customerContacts} setCustomerContacts={setCustomerContacts} jobs={jobs} invoices={invoices} setView={setView} user={user} makeCall={makeCall} hasTwilio={!!twilioDevice} setContextHint={setContextHint} companyId={companyId} />}
        {view === "Invoices" && <InvoicesView brand={brand} invoices={invoices} setInvoices={setInvoices} user={user} customers={customers} customerContacts={customerContacts} setContextHint={setContextHint} />}
        {view === "Quotes" && <QuotesView brand={brand} invoices={invoices} setInvoices={setInvoices} setView={setView} user={user} customers={customers} customerContacts={customerContacts} setContextHint={setContextHint} />}
        {view === "Materials" && <Materials materials={materials} setMaterials={setMaterials} jobs={jobs} user={user} companyId={companyId} setContextHint={setContextHint} />}
        {view === "Expenses" && <ExpensesTab user={user} setContextHint={setContextHint} />}
        {view === "CIS" && <CISStatementsTab user={user} setContextHint={setContextHint} />}
        <div style={{ display: (view === "AI Assistant" || aiOverlay) ? "block" : "none" }}><AIAssistant brand={brand} setBrand={setBrand} jobs={jobs} setJobs={setJobs} invoices={invoices} setInvoices={setInvoices} enquiries={enquiries} setEnquiries={setEnquiries} materials={materials} setMaterials={setMaterials} setMaterialsRaw={setMaterialsRaw} companyId={companyId} customers={customers} setCustomers={setCustomers} onAddReminder={add} setView={setView} user={user} onShowPdf={(inv) => downloadInvoicePDF(brand, inv)} onScanReceipt={handleScanReceipt} sendPush={sendPush} assistantName={assistantName} assistantWakeWords={assistantWakeWords} assistantPersona={assistantPersona} assistantSignoff={assistantSignoff} assistantVoice={assistantVoice} userCommands={userCommands} usageData={usageData} setUsageData={setUsageData} usageCaps={usageCaps} currentMonth={currentMonth} voiceHandle={voiceHandle} onHandsFreeChange={setAiHandsFree} overlayContext={view === "AI Assistant" ? null : aiOverlay?.context || null} onCloseOverlay={() => setAiOverlay(null)} onboardingStep={onboardingStep} advanceOnboarding={advanceOnboarding} pendingInboxCount={pendingInboxCount} /></div>
        {view === "Reminders" && <Reminders reminders={reminders} onAdd={add} onDismiss={dismiss} onRemove={remove} dueNow={dueNow} onClearDue={() => setDueNow([])} />}
        {view === "Notifications" && (
          <Notifications
            notifications={inAppNotifs}
            onMarkRead={markNotifRead}
            onMarkAllRead={markAllNotifsRead}
            onDismiss={dismissNotif}
            onOpen={openNotif}
          />
        )}
        {view === "Payments" && <Payments brand={brand} invoices={invoices} setInvoices={setInvoices} customers={customers} user={user} sendPush={sendPush} setContextHint={setContextHint} />}
        {view === "Inbox" && <InboxView user={user} brand={brand} jobs={jobs} setJobs={setJobs} invoices={invoices} setInvoices={setInvoices} enquiries={enquiries} setEnquiries={setEnquiries} materials={materials} setMaterials={setMaterials} customers={customers} setCustomers={setCustomers} setLastAction={() => {}} setContextHint={setContextHint} sendPush={sendPush} />}
        {view === "Reports" && <ReportsTab invoices={invoices} jobs={jobs} materials={materials} customers={customers} enquiries={enquiries} brand={brand} user={user} setContextHint={setContextHint} />}
        {view === "Mileage" && <MileageTab user={user} setContextHint={setContextHint} />}
        {view === "Subcontractors" && <SubcontractorsTab user={user} brand={brand} setContextHint={setContextHint} />}
        {view === "Workers" && <SubcontractorsTab user={user} brand={brand} setContextHint={setContextHint} mode="workers" />}
        {view === "Documents" && <DocumentsTab user={user} customers={customers} setContextHint={setContextHint} />}
        {view === "Reviews" && <ReviewsTab user={user} brand={brand} customers={customers} setContextHint={setContextHint} />}
        {view === "Stock" && <StockTab user={user} setContextHint={setContextHint} />}
        {view === "RAMS" && <RAMSTab user={user} brand={brand} setContextHint={setContextHint} />}
        {view === "Settings" && <ErrorBoundary><Settings brand={brand} setBrand={setBrand} companyId={companyId} companyName={companyName} userRole={userRole} members={members} user={user} planTier={planTier} userLimit={userLimit} openAssistantSetup={() => setAssistantSetupOpen(true)} openFeedback={() => setFeedbackOpen(true)} assistantName={assistantName} assistantWakeWords={assistantWakeWords} userCommandsCount={userCommands.length} usageData={usageData} usageCaps={usageCaps} /></ErrorBoundary>}
        </div>
      </main>
      </div>
      {(onboardingStep === 99 || onboardingStep === 0) ? <BottomTabBar view={view} setView={setView} isDesktopBrowser={isDesktopBrowser} /> : null}
      {(onboardingStep >= 99 || onboardingStep === 0) && <FloatingMicButton
        visible={view !== "AI Assistant" && !aiOverlay}
        handsFree={aiHandsFree}
        onTap={() => setAiOverlay({ context: contextHint || `Viewing: ${view}` })}
      />}
      <HelpCentre open={helpOpen} openSlug={helpSlug} onClose={() => { setHelpOpen(false); setHelpSlug(null); }} />
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} user={user} brand={brand} currentView={view} />
      <AssistantSetup
        open={assistantSetupOpen || onboardingStep === 3}
        onClose={() => { setAssistantSetupOpen(false); if (onboardingStepRef.current === 3) advanceOnboarding(4); }}
        db={db}
        user={user}
        tools={null}
        mode={onboardingStep === 3 ? "onboard" : "edit"}
        onSaved={(s) => {
          setAssistantName(s.assistant_name);
          setAssistantWakeWords(s.assistant_wake_words);
          setAssistantPersona(s.assistant_persona);
          setAssistantSignoff(s.assistant_signoff || "");
          // Update voice live so the next speak() uses the new choice
          // without needing a page reload.
          if (s.assistant_voice) setAssistantVoice(s.assistant_voice);
          db.from("user_commands")
            .select("*").eq("user_id", user.id).eq("enabled", true)
            .order("created_at", { ascending: true })
            .then(({ data }) => { if (data) setUserCommands(data); });
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}
