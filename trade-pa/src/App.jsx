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
import { isWeb } from "./lib/platform.js";
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
// ─── P8: Hubs (28 Apr 2026) ────────────────────────────────────────────────
// Verbatim moves — no behavioural changes.
import { JobsHub } from "./views/hubs/JobsHub.jsx";
import { DiaryHub } from "./views/hubs/DiaryHub.jsx";
import { AccountsHub } from "./views/hubs/AccountsHub.jsx";
import { PeopleHub } from "./views/hubs/PeopleHub.jsx";
// ─── P10: AIAssistant extracted from App.jsx (28 Apr 2026) ─────────────────
// Verbatim move — no behavioural changes. AIAssistant body (~7,850 lines)
// now lives in ./ai/AIAssistant.jsx as a named export.
import { AIAssistant } from "./ai/AIAssistant.jsx";

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
// ─── AI Assistant ─────────────────────────────────────────────────────────────
// (AIAssistant moved to ./ai/AIAssistant.jsx — P10)


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
// (JobsHub moved to ./views/hubs/JobsHub.jsx — P8)
// (DiaryHub moved to ./views/hubs/DiaryHub.jsx — P8)
// (AccountsHub moved to ./views/hubs/AccountsHub.jsx — P8)
// (PeopleHub moved to ./views/hubs/PeopleHub.jsx — P8)
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

    // SAFETY GUARD (added 30 Apr 2026): refuse to save brand if it has no real
    // business data populated. Prevents fresh-device init or state races from
    // overwriting real Supabase data with empty defaults — root cause of the
    // brand_data wipe at 06:51 UTC on 30 Apr.
    const hasRealData = !!(brand.email || brand.phone || brand.address || brand.vatNumber || brand.utrNumber || brand.bankName);
    if (!hasRealData) {
      console.warn("[brand-save] Refusing to save: no real business data present (likely fresh-device init or state race).");
      return;
    }

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
      {showPwaBanner && !isStandalone && isWeb() && (
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
        <div style={{ height: "100%", transform: "translateZ(0)" }}><AIAssistant isVisible={view === "AI Assistant" || !!aiOverlay} brand={brand} setBrand={setBrand} jobs={jobs} setJobs={setJobs} invoices={invoices} setInvoices={setInvoices} enquiries={enquiries} setEnquiries={setEnquiries} materials={materials} setMaterials={setMaterials} setMaterialsRaw={setMaterialsRaw} companyId={companyId} customers={customers} setCustomers={setCustomers} onAddReminder={add} setView={setView} user={user} onShowPdf={(inv) => downloadInvoicePDF(brand, inv)} onScanReceipt={handleScanReceipt} sendPush={sendPush} assistantName={assistantName} assistantWakeWords={assistantWakeWords} assistantPersona={assistantPersona} assistantSignoff={assistantSignoff} assistantVoice={assistantVoice} userCommands={userCommands} usageData={usageData} setUsageData={setUsageData} usageCaps={usageCaps} currentMonth={currentMonth} voiceHandle={voiceHandle} onHandsFreeChange={setAiHandsFree} overlayContext={view === "AI Assistant" ? null : aiOverlay?.context || null} onCloseOverlay={() => setAiOverlay(null)} onboardingStep={onboardingStep} advanceOnboarding={advanceOnboarding} pendingInboxCount={pendingInboxCount} /></div>
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
