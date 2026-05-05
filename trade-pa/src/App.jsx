
        created_at: m.created_at,import React, { useState, useRef, useEffect, Component } from "react";

        created_at: m.created_at,import * as Sentry from "@sentry/react";

        created_at: m.created_at,import { db } from "./lib/db.js";

        created_at: m.created_at,import { Device } from "@twilio/voice-sdk";

        created_at: m.created_at,import HelpCentre from "./HelpCentre.jsx";

        created_at: m.created_at,import AssistantSetup from "./AssistantSetup.jsx";

        created_at: m.created_at,import FieldMic from "./components/FieldMic.jsx";

        created_at: m.created_at,import OfflineBanner from "./components/OfflineBanner.jsx";

        created_at: m.created_at,import OfflineSettings from "./components/OfflineSettings.jsx";

        created_at: m.created_at,import UpdateBanner from "./components/UpdateBanner.jsx";

        created_at: m.created_at,import ChangelogModal from "./components/ChangelogModal.jsx";

        created_at: m.created_at,import { prewarmCache } from "./lib/prewarm.js";

        created_at: m.created_at,import { drainQueue } from "./lib/writeQueue.js";

        created_at: m.created_at,// ─── P1: Pure helpers extracted from App.jsx (28 Apr 2026) ──────────────────

        created_at: m.created_at,// All exports below are verbatim moves — no behavioural changes.

        created_at: m.created_at,import { TIER_CONFIG, normalizeTier, getTierConfig } from "./lib/plan.js";

        created_at: m.created_at,import { trackEvent } from "./lib/tracking.js";

        created_at: m.created_at,import { authHeaders, setOwnerCookie } from "./lib/auth.js";

        created_at: m.created_at,import { isWeb, useIsTablet } from "./lib/platform.js";

        created_at: m.created_at,import { fmtCurrency, fmtAmount, vatLabel, relTime } from "./lib/format.js";

        created_at: m.created_at,import { localDate, localMonth, localYear, weekBounds, groupByRecency } from "./lib/time.js";

        created_at: m.created_at,import {

        created_at: m.created_at,  DEFAULT_BRAND, DEFAULT_SUPPLIERS, ALL_CERTS,

        created_at: m.created_at,  NAV_GROUPS, viewGroup, MILEAGE_RATE,

        created_at: m.created_at,} from "./lib/constants.js";

        created_at: m.created_at,import { fileToContentBlock, openHtmlPreview, urlBase64ToUint8Array } from "./lib/files.js";

        created_at: m.created_at,import { uploadReceiptToStorage, getSignedReceiptUrl, getReceiptViewUrl } from "./lib/receipts.js";

        created_at: m.created_at,import { buildToolSubset } from "./lib/tool-routing.js";

        created_at: m.created_at,import { buildEmailHTML, buildRef, buildInvoiceHTML, downloadInvoicePDF } from "./lib/invoice-html.js";

        created_at: m.created_at,import {

        created_at: m.created_at,  generatePortalToken, newEnquiryId,

        created_at: m.created_at,  nextInvoiceId, nextQuoteId, isExemptAccount,

        created_at: m.created_at,} from "./lib/ids.js";

        created_at: m.created_at,// ─── P2: Theme + hooks extracted from App.jsx (28 Apr 2026) ────────────────

        created_at: m.created_at,// Verbatim moves — no behavioural changes.

        created_at: m.created_at,import { C, DARK_PALETTE, LIGHT_PALETTE, applyPalette } from "./theme/colors.js";

        created_at: m.created_at,import { S } from "./theme/styles.js";

        created_at: m.created_at,import { ThemeContext, ThemeProvider, useTheme } from "./theme/ThemeProvider.jsx";

        created_at: m.created_at,import { useWhisper } from "./hooks/useWhisper.js";

        created_at: m.created_at,import { useReminders } from "./hooks/useReminders.js";

        created_at: m.created_at,// ─── P3: UI primitives extracted from App.jsx (28 Apr 2026) ────────────────

        created_at: m.created_at,// Verbatim moves — no behavioural changes. portalUrl helper hoisted to lib/portal.js

        created_at: m.created_at,// so PortalLinkPanel and portalCtaBlock (still in App.jsx) can both import it.

        created_at: m.created_at,import { portalUrl } from "./lib/portal.js";

        created_at: m.created_at,import { PDFOverlay } from "./components/PDFOverlay.jsx";

        created_at: m.created_at,import { DetailPage } from "./components/DetailPage.jsx";

        created_at: m.created_at,import { FloatingMicButton } from "./components/FloatingMicButton.jsx";

        created_at: m.created_at,import { MicButton } from "./components/MicButton.jsx";

        created_at: m.created_at,import { VoiceFillButton } from "./components/VoiceFillButton.jsx";

        created_at: m.created_at,import { LineItemsBuilder } from "./components/LineItemsBuilder.jsx";

        created_at: m.created_at,import { PortalLinkPanel } from "./components/PortalLinkPanel.jsx";

        created_at: m.created_at,import { IncomingCallScreen } from "./components/IncomingCallScreen.jsx";

        created_at: m.created_at,import { ActiveCallScreen } from "./components/ActiveCallScreen.jsx";

        created_at: m.created_at,import { HubPage } from "./components/HubPage.jsx";

        created_at: m.created_at,import { BottomTabBar } from "./components/BottomTabBar.jsx";

        created_at: m.created_at,import { LandingPage } from "./auth/LandingPage.jsx";

        created_at: m.created_at,import { Notifications } from "./notifications/Notifications.jsx";

        created_at: m.created_at,import { Reminders } from "./notifications/Reminders.jsx";

        created_at: m.created_at,import { FeedbackModal } from "./modals/FeedbackModal.jsx";

        created_at: m.created_at,import { InvoiceModal } from "./modals/InvoiceModal.jsx";

        created_at: m.created_at,import { QuoteModal } from "./modals/QuoteModal.jsx";

        created_at: m.created_at,import { AssignToJobModal } from "./modals/AssignToJobModal.jsx";

        created_at: m.created_at,// ─── P7 prelude: cross-cutters lifted to lib/ (28 Apr 2026) ────────────────

        created_at: m.created_at,// Hoisted ahead of view extraction so each extracted view can import these

        created_at: m.created_at,// directly. Verbatim moves — no behavioural changes.

        created_at: m.created_at,import { statusColor, statusLabel } from "./lib/status.js";

        created_at: m.created_at,import { SUB_INVOICE_SCAN_PROMPT } from "./lib/scan-prompts.js";

        created_at: m.created_at,import { isSameDay } from "./lib/date-helpers.js";

        created_at: m.created_at,import { portalCtaBlock } from "./lib/portal-extras.js";

        created_at: m.created_at,import { syncInvoiceToAccounting } from "./lib/accounting.js";

        created_at: m.created_at,import { tmReadWorkers, tmReadSubs } from "./lib/team-members.js";

        created_at: m.created_at,// ─── P7 sub-batch A: small isolated views (28 Apr 2026) ────────────────────

        created_at: m.created_at,// Verbatim moves — no behavioural changes.

        created_at: m.created_at,import { Dashboard } from "./views/Dashboard.jsx";

        created_at: m.created_at,import { Schedule } from "./views/Schedule.jsx";

        created_at: m.created_at,import { MileageTab } from "./views/Mileage.jsx";

        created_at: m.created_at,import { StockTab } from "./views/Stock.jsx";

        created_at: m.created_at,import { DocumentsTab } from "./views/Documents.jsx";

        created_at: m.created_at,import { ReviewsTab } from "./views/Reviews.jsx";

        created_at: m.created_at,import { ExpensesTab } from "./views/Expenses.jsx";

        created_at: m.created_at,import { CISStatementsTab } from "./views/CIS.jsx";

        created_at: m.created_at,import { PurchaseOrdersTab } from "./views/PurchaseOrders.jsx";

        created_at: m.created_at,import { RecentlyDeleted } from "./views/RecentlyDeleted.jsx";

        created_at: m.created_at,// ─── P7 sub-batch B: medium views with helper clusters (28 Apr 2026) ───────

        created_at: m.created_at,// Verbatim moves — no behavioural changes. Inbox helpers + RAMS libraries

        created_at: m.created_at,// re-imported here so AIAssistant (still in App.jsx until P10) can keep

        created_at: m.created_at,// calling them.

        created_at: m.created_at,import { Materials } from "./views/Materials.jsx";

        created_at: m.created_at,import {

        created_at: m.created_at,  InboxView,

        created_at: m.created_at,  executeEmailAction,

        created_at: m.created_at,  updateEmailAIContext,

        created_at: m.created_at,  logEmailFeedback,

        created_at: m.created_at,} from "./views/Inbox.jsx";

        created_at: m.created_at,import { EnquiriesTab } from "./views/Enquiries.jsx";

        created_at: m.created_at,import {

        created_at: m.created_at,  RAMSTab,

        created_at: m.created_at,  HAZARD_LIBRARY,

        created_at: m.created_at,  METHOD_LIBRARY,

        created_at: m.created_at,  COSHH_SUBSTANCES,

        created_at: m.created_at,} from "./views/RAMS.jsx";

        created_at: m.created_at,import { SubcontractorsTab } from "./views/Subcontractors.jsx";

        created_at: m.created_at,import { ReportsTab } from "./views/Reports.jsx";

        created_at: m.created_at,// ─── P7 sub-batch C: large clusters (28 Apr 2026) ──────────────────────────

        created_at: m.created_at,// Verbatim moves — no behavioural changes. InvoicePreview re-imported here

        created_at: m.created_at,// so Settings (still in App.jsx until P9) can keep rendering it from the

        created_at: m.created_at,// Branding section preview.

        created_at: m.created_at,import {

        created_at: m.created_at,  InvoicePreview,

        created_at: m.created_at,  Payments,

        created_at: m.created_at,  InvoicesView,

        created_at: m.created_at,  QuotesView,

        created_at: m.created_at,} from "./views/Invoices.jsx";

        created_at: m.created_at,import { Customers } from "./views/Customers.jsx";

        created_at: m.created_at,import { JobsTab } from "./views/Jobs.jsx";

        created_at: m.created_at,// ─── P8: Hubs (28 Apr 2026) ────────────────────────────────────────────────

        created_at: m.created_at,// Verbatim moves — no behavioural changes.

        created_at: m.created_at,import { JobsHub } from "./views/hubs/JobsHub.jsx";

        created_at: m.created_at,import { DiaryHub } from "./views/hubs/DiaryHub.jsx";

        created_at: m.created_at,import { AccountsHub } from "./views/hubs/AccountsHub.jsx";

        created_at: m.created_at,import { PeopleHub } from "./views/hubs/PeopleHub.jsx";

        created_at: m.created_at,// ─── P10: AIAssistant extracted from App.jsx (28 Apr 2026) ─────────────────

        created_at: m.created_at,// Verbatim move — no behavioural changes. AIAssistant body (~7,850 lines)

        created_at: m.created_at,// now lives in ./ai/AIAssistant.jsx as a named export.

        created_at: m.created_at,import { AIAssistant } from "./ai/AIAssistant.jsx";

        created_at: m.created_at,

        created_at: m.created_at,// Error boundary to catch Settings crashes and show the actual error

        created_at: m.created_at,class ErrorBoundary extends Component {

        created_at: m.created_at,  constructor(props) { super(props); this.state = { error: null }; }

        created_at: m.created_at,  static getDerivedStateFromError(error) { return { error }; }

        created_at: m.created_at,  render() {

        created_at: m.created_at,    if (this.state.error) {

        created_at: m.created_at,      return (

        created_at: m.created_at,        <div style={{ padding: 24, background: "#1a1a1a", borderRadius: 12, border: "1px solid #ef4444" }}>

        created_at: m.created_at,          <div style={{ color: "#ef4444", fontWeight: 700, marginBottom: 8, fontFamily: "'DM Mono',monospace", fontSize: 13 }}>Settings crashed — error details:</div>

        created_at: m.created_at,          <div style={{ color: "#fca5a5", fontSize: 12, fontFamily: "'DM Mono',monospace", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{this.state.error?.message || String(this.state.error)}</div>

        created_at: m.created_at,          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 12, background: "#f59e0b", color: "#000", border: "none", borderRadius: 10, padding: "8px 16px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Try again</button>

        created_at: m.created_at,        </div>

        created_at: m.created_at,      );

        created_at: m.created_at,    }

        created_at: m.created_at,    return this.props.children;

        created_at: m.created_at,  }

        created_at: m.created_at,}

        created_at: m.created_at,window._supabase = db;

        created_at: m.created_at,

        created_at: m.created_at,// (syncInvoiceToAccounting moved to ./lib/accounting.js — P7 prelude)

        created_at: m.created_at,

        created_at: m.created_at,

        created_at: m.created_at,const JOBS = [];

        created_at: m.created_at,const INVOICES_INIT = [];

        created_at: m.created_at,const ENQUIRIES = [];

        created_at: m.created_at,const MATERIALS = [];

        created_at: m.created_at,// (statusColor + statusLabel moved to ./lib/status.js — P7 prelude)

        created_at: m.created_at,

        created_at: m.created_at,// ── Shared list utilities (Phase 3: jobs / invoices / materials etc.) ──────

        created_at: m.created_at,// Module-scope so list screens share one source of truth. Hoisted after

        created_at: m.created_at,// JobsTab + InvoicesView triple-duplicated these; Materials now reuses.

        created_at: m.created_at,// (relTime, weekBounds, groupByRecency moved to ./lib/time.js + ./lib/format.js — P1)

        created_at: m.created_at,

        created_at: m.created_at,// (DEFAULT_BRAND, vatLabel, fmtCurrency, fmtAmount, localDate/Month/Year,

        created_at: m.created_at,//  fileToContentBlock moved to ./lib/constants.js, ./lib/format.js,

        created_at: m.created_at,//  ./lib/time.js, ./lib/files.js — P1)

        created_at: m.created_at,

        created_at: m.created_at,

        created_at: m.created_at,

        created_at: m.created_at,// which the terse version silently fudged.

        created_at: m.created_at,// (SUB_INVOICE_SCAN_PROMPT moved to ./lib/scan-prompts.js — P7 prelude)

        created_at: m.created_at,

        created_at: m.created_at,// Shared helper: open arbitrary HTML in a print-friendly preview that ALSO

        created_at: m.created_at,

        created_at: m.created_at,

        created_at: m.created_at,// ─── Invoice Preview ──────────────────────────────────────────────────────────

        created_at: m.created_at,// (InvoicePreview moved to ./views/Invoices.jsx — P7-7C)

        created_at: m.created_at,

        created_at: m.created_at,// ─── Settings ─────────────────────────────────────────────────────────────────

        created_at: m.created_at,// ─── Team Invite ──────────────────────────────────────────────────────────────

        created_at: m.created_at,// ─── Call Tracking Settings ────────────────────────────────────────────────────

        created_at: m.created_at,function CallTrackingSettings({ user }) {

        created_at: m.created_at,  const [callTracking, setCallTracking] = useState(null);

        created_at: m.created_at,  const [forwardTo, setForwardTo] = useState("");

        created_at: m.created_at,  const [selectedPhonePlan, setSelectedPhonePlan] = useState("phone_300"); // default to popular tier

        created_at: m.created_at,  const [saving, setSaving] = useState(false);

        created_at: m.created_at,  const [error, setError] = useState("");

        created_at: m.created_at,  const [loaded, setLoaded] = useState(false);

        created_at: m.created_at,  const [showPortInfo, setShowPortInfo] = useState(false);

        created_at: m.created_at,  const [micStatus, setMicStatus] = useState(null); // granted | denied | prompt | unknown

        created_at: m.created_at,

        created_at: m.created_at,  // Phone plan tiers (display only — pricing authoritative server-side)

        created_at: m.created_at,  const PHONE_TIERS = [

        created_at: m.created_at,    { key: "phone_100",       mins: "100 mins",   price: "£20",  desc: "Occasional use" },

        created_at: m.created_at,    { key: "phone_300",       mins: "300 mins",   price: "£40",  desc: "Most popular", popular: true },

        created_at: m.created_at,    { key: "phone_600",       mins: "600 mins",   price: "£65",  desc: "Busy tradesperson" },

        created_at: m.created_at,    { key: "phone_unlimited", mins: "Unlimited",  price: "£104", desc: "Fair use — 3,000 mins" },

        created_at: m.created_at,  ];

        created_at: m.created_at,

        created_at: m.created_at,  useEffect(() => {

        created_at: m.created_at,    if (!user?.id) return;

        created_at: m.created_at,    db.from("call_tracking")

        created_at: m.created_at,      .select("*")

        created_at: m.created_at,      .eq("user_id", user.id)

        created_at: m.created_at,      .limit(1)

        created_at: m.created_at,      .then(({ data }) => {

        created_at: m.created_at,        setCallTracking(data?.[0] || null);

        created_at: m.created_at,        setLoaded(true);

        created_at: m.created_at,      })

        created_at: m.created_at,      .catch(() => setLoaded(true));

        created_at: m.created_at,  }, [user?.id]);

        created_at: m.created_at,

        created_at: m.created_at,  // Check mic permission status whenever call tracking is active

        created_at: m.created_at,  useEffect(() => {

        created_at: m.created_at,    if (!callTracking?.twilio_number) return;

        created_at: m.created_at,    navigator.permissions?.query({ name: "microphone" })

        created_at: m.created_at,      .then(result => {

        created_at: m.created_at,        setMicStatus(result.state);

        created_at: m.created_at,        result.onchange = () => setMicStatus(result.state);

        created_at: m.created_at,      })

        created_at: m.created_at,      .catch(() => setMicStatus("unknown"));

        created_at: m.created_at,  }, [callTracking?.twilio_number]);

        created_at: m.created_at,

        created_at: m.created_at,  const activate = async () => {

        created_at: m.created_at,    if (!forwardTo.trim()) { setError("Please enter your mobile number for missed call fallback"); return; }

        created_at: m.created_at,    if (!selectedPhonePlan) { setError("Please choose a plan"); return; }

        created_at: m.created_at,

        created_at: m.created_at,    // Request microphone permission upfront so it's ready when calls arrive

        created_at: m.created_at,    try {

        created_at: m.created_at,      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        created_at: m.created_at,      stream.getTracks().forEach(t => t.stop());

        created_at: m.created_at,    } catch (err) {

        created_at: m.created_at,      setError("Microphone access is required to receive calls. Please tap Allow when your browser asks, or enable it in your browser settings.");

        created_at: m.created_at,      return;

        created_at: m.created_at,    }

        created_at: m.created_at,

        created_at: m.created_at,    setSaving(true); setError("");

        created_at: m.created_at,    try {

        created_at: m.created_at,      const res = await fetch("/api/stripe/create-phone-subscription", {

        created_at: m.created_at,        method: "POST",

        created_at: m.created_at,        headers: await authHeaders(),

        created_at: m.created_at,        body: JSON.stringify({

        created_at: m.created_at,          phone_plan: selectedPhonePlan,

        created_at: m.created_at,          forward_to: forwardTo.trim(),

        created_at: m.created_at,        }),

        created_at: m.created_at,      });

        created_at: m.created_at,      const data = await res.json();

        created_at: m.created_at,      if (data.error) throw new Error(data.message || data.error);

        created_at: m.created_at,      setCallTracking({

        created_at: m.created_at,        twilio_number: data.twilio_number,

        created_at: m.created_at,        forwarding_code: data.forwarding_code,

        created_at: m.created_at,        disable_code: data.disable_code,

        created_at: m.created_at,        forward_to: forwardTo.trim(),

        created_at: m.created_at,        phone_plan: data.phone_plan,

        created_at: m.created_at,        monthly_minute_quota: data.monthly_minute_quota,

        created_at: m.created_at,        minutes_used_month: 0,

        created_at: m.created_at,      });

        created_at: m.created_at,    } catch (err) {

        created_at: m.created_at,      setError(err.message);

        created_at: m.created_at,    }

        created_at: m.created_at,    setSaving(false);

        created_at: m.created_at,  };

        created_at: m.created_at,

        created_at: m.created_at,  // ─── In-app phone plan switch (existing subscribers) ───────────────────

        created_at: m.created_at,  // changePlan state: null (closed) | 'picker' (tier list) | phone_plan key (confirming switch to this)

        created_at: m.created_at,  const [changePlan, setChangePlan] = useState(null);

        created_at: m.created_at,  const [changeBusy, setChangeBusy] = useState(false);

        created_at: m.created_at,  const [changeResult, setChangeResult] = useState(null); // { type, message }

        created_at: m.created_at,

        created_at: m.created_at,  const switchPlan = async (targetPlan) => {

        created_at: m.created_at,    setChangeBusy(true);

        created_at: m.created_at,    setChangeResult(null);

        created_at: m.created_at,    try {

        created_at: m.created_at,      const res = await fetch("/api/stripe/update-phone-plan", {

        created_at: m.created_at,        method: "POST",

        created_at: m.created_at,        headers: await authHeaders(),

        created_at: m.created_at,        body: JSON.stringify({ phone_plan: targetPlan }),

        created_at: m.created_at,      });

        created_at: m.created_at,      const data = await res.json();

        created_at: m.created_at,      if (!res.ok || !data.success) {

        created_at: m.created_at,        setChangeResult({ type: "error", message: data.message || "Plan change failed." });

        created_at: m.created_at,      } else {

        created_at: m.created_at,        setChangeResult({ type: "success", message: data.message || "Plan updated." });

        created_at: m.created_at,        // Refresh call_tracking from DB — webhook will have updated it server-side.

        created_at: m.created_at,        // Tiny delay so webhook has a chance to land.

        created_at: m.created_at,        setTimeout(() => {

        created_at: m.created_at,          if (!user?.id) return;

        created_at: m.created_at,          db.from("call_tracking")

        created_at: m.created_at,            .select("*")

        created_at: m.created_at,            .eq("user_id", user.id)

        created_at: m.created_at,            .limit(1)

        created_at: m.created_at,            .then(({ data: rows }) => {

        created_at: m.created_at,              if (rows?.[0]) setCallTracking(rows[0]);

        created_at: m.created_at,            });

        created_at: m.created_at,        }, 1200);

        created_at: m.created_at,      }

        created_at: m.created_at,    } catch (err) {

        created_at: m.created_at,      console.error("[switch-phone-plan]", err);

        created_at: m.created_at,      setChangeResult({ type: "error", message: "Couldn't change plan. Please try again or email hello@tradespa.co.uk" });

        created_at: m.created_at,    } finally {

        created_at: m.created_at,      setChangeBusy(false);

        created_at: m.created_at,      setChangePlan(null);

        created_at: m.created_at,    }

        created_at: m.created_at,  };

        created_at: m.created_at,

        created_at: m.created_at,  if (!loaded) return <div style={{ fontSize: 12, color: C.muted }}>Loading...</div>;

        created_at: m.created_at,

        created_at: m.created_at,  if (callTracking?.twilio_number) {

        created_at: m.created_at,    const minsUsed = callTracking.minutes_used_month ?? 0;

        created_at: m.created_at,    const minsQuota = callTracking.monthly_minute_quota ?? null;

        created_at: m.created_at,    const pct = minsQuota ? Math.min(1, minsUsed / minsQuota) : 0;

        created_at: m.created_at,    const planLabel = callTracking.phone_plan

        created_at: m.created_at,      ? PHONE_TIERS.find(t => t.key === callTracking.phone_plan)?.mins || callTracking.phone_plan

        created_at: m.created_at,      : null;

        created_at: m.created_at,

        created_at: m.created_at,    return (

        created_at: m.created_at,      <div>

        created_at: m.created_at,        {/* Microphone blocked warning */}

        created_at: m.created_at,        {micStatus === "denied" && (

        created_at: m.created_at,          <div style={{ background: "#ef444418", border: "1px solid #ef444444", borderRadius: 8, padding: 12, marginBottom: 14, display: "flex", gap: 10, alignItems: "flex-start" }}>

        created_at: m.created_at,            <span style={{ fontSize: 16, flexShrink: 0 }}>🎙️</span>

        created_at: m.created_at,            <div>

        created_at: m.created_at,              <div style={{ fontSize: 12, fontWeight: 700, color: "#ef4444", marginBottom: 4 }}>Microphone access blocked</div>

        created_at: m.created_at,              <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>Calls can't come through without microphone access. On iPhone: Settings → Safari → Microphone → Allow. On desktop: click the lock icon in your browser address bar and allow microphone.</div>

        created_at: m.created_at,            </div>

        created_at: m.created_at,          </div>

        created_at: m.created_at,        )}

        created_at: m.created_at,        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>

        created_at: m.created_at,          <div style={S.badge(C.green)}>✓ Active</div>

        created_at: m.created_at,          <div style={{ fontSize: 12, color: C.muted }}>Business phone is live{planLabel ? ` · ${planLabel}` : ""}</div>

        created_at: m.created_at,        </div>

        created_at: m.created_at,        <div style={{ background: C.surfaceHigh, borderRadius: 8, padding: 14, marginBottom: 10 }}>

        created_at: m.created_at,          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Your business number</div>

        created_at: m.created_at,          <div style={{ fontSize: 17, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: C.amber, marginBottom: 4 }}>{callTracking.twilio_number}</div>

        created_at: m.created_at,          <div style={{ fontSize: 11, color: C.muted }}>Give this number to customers — all calls ring inside the Trade PA app</div>

        created_at: m.created_at,        </div>

        created_at: m.created_at,        {minsQuota && (

        created_at: m.created_at,          <div style={{ background: C.surfaceHigh, borderRadius: 8, padding: 14, marginBottom: 10 }}>

        created_at: m.created_at,            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>

        created_at: m.created_at,              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>This month</div>

        created_at: m.created_at,              <div style={{ fontSize: 12, color: C.text, fontFamily: "'DM Mono',monospace" }}>{minsUsed} / {minsQuota} mins</div>

        created_at: m.created_at,            </div>

        created_at: m.created_at,            <div style={{ width: "100%", height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>

        created_at: m.created_at,              <div style={{ width: `${pct * 100}%`, height: "100%", background: pct >= 1 ? C.red : pct >= 0.8 ? C.amber : C.green, transition: "width 0.3s" }} />

        created_at: m.created_at,            </div>

        created_at: m.created_at,            <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Resets with your monthly billing.</div>

        created_at: m.created_at,          </div>

        created_at: m.created_at,        )}

        created_at: m.created_at,

        created_at: m.created_at,        {/* ── Change plan (in-app) ─────────────────────────────────────── */}

        created_at: m.created_at,        <div style={{ background: C.surfaceHigh, borderRadius: 8, padding: 14, marginBottom: 10 }}>

        created_at: m.created_at,          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>

        created_at: m.created_at,            <div style={{ minWidth: 0 }}>

        created_at: m.created_at,              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Need more minutes?</div>

        created_at: m.created_at,              <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5 }}>Switch plan instantly. Prorated against your next invoice.</div>

        created_at: m.created_at,            </div>

        created_at: m.created_at,            <button

        created_at: m.created_at,              onClick={() => { setChangeResult(null); setChangePlan("picker"); }}

        created_at: m.created_at,              disabled={changeBusy}

        created_at: m.created_at,              style={{

        created_at: m.created_at,                padding: "6px 12px",

        created_at: m.created_at,                border: `1px solid ${C.amber}`,

        created_at: m.created_at,                background: "transparent",

        created_at: m.created_at,                color: C.amber,

        created_at: m.created_at,                fontSize: 10,

        created_at: m.created_at,                fontFamily: "'DM Mono', monospace",

        created_at: m.created_at,                letterSpacing: "0.08em",

        created_at: m.created_at,                textTransform: "uppercase",

        created_at: m.created_at,                fontWeight: 700,

        created_at: m.created_at,                borderRadius: 4,

        created_at: m.created_at,                cursor: changeBusy ? "not-allowed" : "pointer",

        created_at: m.created_at,                opacity: changeBusy ? 0.5 : 1,

        created_at: m.created_at,                flexShrink: 0,

        created_at: m.created_at,              }}

        created_at: m.created_at,            >Change →</button>

        created_at: m.created_at,          </div>

        created_at: m.created_at,          {changeResult && (

        created_at: m.created_at,            <div style={{

        created_at: m.created_at,              marginTop: 10,

        created_at: m.created_at,              padding: "8px 10px",

        created_at: m.created_at,              borderRadius: 6,

        created_at: m.created_at,              fontSize: 11.5,

        created_at: m.created_at,              lineHeight: 1.5,

        created_at: m.created_at,              background: changeResult.type === "success" ? `${C.green}1a` : `${C.red}1a`,

        created_at: m.created_at,              border: `1px solid ${changeResult.type === "success" ? `${C.green}40` : `${C.red}40`}`,

        created_at: m.created_at,              color: changeResult.type === "success" ? C.green : C.red,

        created_at: m.created_at,            }}>

        created_at: m.created_at,              {changeResult.type === "success" ? `✓ ${changeResult.message}` : `✕ ${changeResult.message}`}

        created_at: m.created_at,            </div>

        created_at: m.created_at,          )}

        created_at: m.created_at,        </div>

        created_at: m.created_at,        <div style={{ background: C.surfaceHigh, borderRadius: 8, padding: 14, marginBottom: 10 }}>

        created_at: m.created_at,          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>How calls work</div>

        created_at: m.created_at,          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

        created_at: m.created_at,            {[

        created_at: m.created_at,              { icon: "📱", label: "Rings in Trade PA app", desc: "Answer directly — no second SIM needed" },

        created_at: m.created_at,              { icon: "⏱️", label: "30s fallback", desc: `If you don't answer, rings ${callTracking.forward_to || "your mobile"}` },

        created_at: m.created_at,              { icon: "🎙️", label: "Auto-recorded", desc: "Known customers are recorded, transcribed & logged" },

        created_at: m.created_at,              { icon: "🤖", label: "AI classified", desc: "Every call summarised and actioned automatically" },

        created_at: m.created_at,            ].map(({ icon, label, desc }) => (

        created_at: m.created_at,              <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>

        created_at: m.created_at,                <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>{icon}</span>

        created_at: m.created_at,                <div>

        created_at: m.created_at,                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{label}</div>

        created_at: m.created_at,                  <div style={{ fontSize: 11, color: C.muted }}>{desc}</div>

        created_at: m.created_at,                </div>

        created_at: m.created_at,              </div>

        created_at: m.created_at,            ))}

        created_at: m.created_at,          </div>

        created_at: m.created_at,        </div>

        created_at: m.created_at,        <div onClick={() => setShowPortInfo(p => !p)} style={{ background: C.surfaceHigh, borderRadius: 8, padding: 12, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>

        created_at: m.created_at,          <div style={{ fontSize: 12, color: C.muted }}>Want to use your existing number?</div>

        created_at: m.created_at,          <div style={{ fontSize: 11, color: C.amber }}>{showPortInfo ? "▲ Hide" : "▼ Show"}</div>

        created_at: m.created_at,        </div>

        created_at: m.created_at,        {showPortInfo && (

        created_at: m.created_at,          <div style={{ background: C.surfaceHigh, borderRadius: 8, padding: 14, marginTop: 2, borderTop: `1px solid ${C.border}` }}>

        created_at: m.created_at,            <div style={{ fontSize: 12, color: C.text, lineHeight: 1.7, marginBottom: 8 }}>You can port your existing mobile or landline number into Trade PA so customers keep calling the same number they always have.</div>

        created_at: m.created_at,            <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>UK number porting typically takes 2–4 weeks. Contact us at <span style={{ color: C.amber }}>hello@tradespa.co.uk</span> to get started — we'll handle the process with you.</div>

        created_at: m.created_at,          </div>

        created_at: m.created_at,        )}

        created_at: m.created_at,

        created_at: m.created_at,        {/* ── Plan change modal (picker + confirm, single modal, two states) ── */}

        created_at: m.created_at,        {changePlan && (

        created_at: m.created_at,          <div

        created_at: m.created_at,            onClick={() => !changeBusy && setChangePlan(null)}

        created_at: m.created_at,            style={{

        created_at: m.created_at,              position: "fixed",

        created_at: m.created_at,              top: 0, left: 0, right: 0, bottom: 0,

        created_at: m.created_at,              background: "rgba(0,0,0,0.6)",

        created_at: m.created_at,              display: "flex",

        created_at: m.created_at,              alignItems: "center",

        created_at: m.created_at,              justifyContent: "center",

        created_at: m.created_at,              zIndex: 9999,

        created_at: m.created_at,              padding: 16,

        created_at: m.created_at,            }}

        created_at: m.created_at,          >

        created_at: m.created_at,            <div

        created_at: m.created_at,              onClick={(e) => e.stopPropagation()}

        created_at: m.created_at,              style={{

        created_at: m.created_at,                background: C.surface,

        created_at: m.created_at,                border: `1px solid ${C.border}`,

        created_at: m.created_at,                borderRadius: 12,

        created_at: m.created_at,                padding: "20px 20px 18px",

        created_at: m.created_at,                width: "100%",

        created_at: m.created_at,                maxWidth: 360,

        created_at: m.created_at,                maxHeight: "90vh",

        created_at: m.created_at,                overflowY: "auto",

        created_at: m.created_at,              }}

        created_at: m.created_at,            >

        created_at: m.created_at,              {changePlan === "picker" ? (

        created_at: m.created_at,                <>

        created_at: m.created_at,                  <div style={{

        created_at: m.created_at,                    fontSize: 10, color: C.textDim, letterSpacing: "0.1em",

        created_at: m.created_at,                    textTransform: "uppercase", fontFamily: "'DM Mono', monospace", marginBottom: 10,

        created_at: m.created_at,                  }}>Change phone plan</div>

        created_at: m.created_at,                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>Pick your new plan</div>

        created_at: m.created_at,                  <div style={{ fontSize: 12, color: C.textDim, marginBottom: 16, lineHeight: 1.5 }}>

        created_at: m.created_at,                    Prorated charge applies to your next invoice. New allowance is live immediately.

        created_at: m.created_at,                  </div>

        created_at: m.created_at,                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>

        created_at: m.created_at,                    {PHONE_TIERS.map(tier => {

        created_at: m.created_at,                      const isCurrent = tier.key === callTracking.phone_plan;

        created_at: m.created_at,                      return (

        created_at: m.created_at,                        <button

        created_at: m.created_at,                          key={tier.key}

        created_at: m.created_at,                          onClick={() => !isCurrent && setChangePlan(tier.key)}

        created_at: m.created_at,                          disabled={isCurrent}

        created_at: m.created_at,                          style={{

        created_at: m.created_at,                            display: "flex",

        created_at: m.created_at,                            justifyContent: "space-between",

        created_at: m.created_at,                            alignItems: "center",

        created_at: m.created_at,                            padding: "11px 12px",

        created_at: m.created_at,                            background: C.surfaceHigh,

        created_at: m.created_at,                            borderRadius: 6,

        created_at: m.created_at,                            border: isCurrent ? `1px solid ${C.green}60` : `1px solid transparent`,

        created_at: m.created_at,                            cursor: isCurrent ? "default" : "pointer",

        created_at: m.created_at,                            textAlign: "left",

        created_at: m.created_at,                            opacity: isCurrent ? 0.75 : 1,

        created_at: m.created_at,                          }}

        created_at: m.created_at,                        >

        created_at: m.created_at,                          <div style={{ minWidth: 0 }}>

        created_at: m.created_at,                            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{tier.mins}</div>

        created_at: m.created_at,                            <div style={{ fontSize: 11, color: C.muted, fontFamily: "'DM Mono',monospace", marginTop: 2 }}>{tier.price} · {tier.desc}</div>

        created_at: m.created_at,                          </div>

        created_at: m.created_at,                          {isCurrent ? (

        created_at: m.created_at,                            <span style={{

        created_at: m.created_at,                              fontSize: 9, fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em",

        created_at: m.created_at,                              textTransform: "uppercase", color: C.green, fontWeight: 700,

        created_at: m.created_at,                              background: `${C.green}1a`, border: `1px solid ${C.green}40`,

        created_at: m.created_at,                              padding: "3px 8px", borderRadius: 4, flexShrink: 0,

        created_at: m.created_at,                            }}>CURRENT</span>

        created_at: m.created_at,                          ) : (

        created_at: m.created_at,                            <span style={{

        created_at: m.created_at,                              fontSize: 10, fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em",

        created_at: m.created_at,                              textTransform: "uppercase", color: C.amber, fontWeight: 700, flexShrink: 0,

        created_at: m.created_at,                            }}>Switch →</span>

        created_at: m.created_at,                          )}

        created_at: m.created_at,                        </button>

        created_at: m.created_at,                      );

        created_at: m.created_at,                    })}

        created_at: m.created_at,                  </div>

        created_at: m.created_at,                  <button

        created_at: m.created_at,                    onClick={() => setChangePlan(null)}

        created_at: m.created_at,                    style={{

        created_at: m.created_at,                      width: "100%",

        created_at: m.created_at,                      padding: 10,

        created_at: m.created_at,                      border: `1px solid ${C.border}`,

        created_at: m.created_at,                      background: "transparent",

        created_at: m.created_at,                      color: C.text,

        created_at: m.created_at,                      fontSize: 11, fontWeight: 600,

        created_at: m.created_at,                      borderRadius: 6,

        created_at: m.created_at,                      fontFamily: "'DM Mono', monospace",

        created_at: m.created_at,                      letterSpacing: "0.08em",

        created_at: m.created_at,                      textTransform: "uppercase",

        created_at: m.created_at,                      cursor: "pointer",

        created_at: m.created_at,                    }}

        created_at: m.created_at,                  >Cancel</button>

        created_at: m.created_at,                </>

        created_at: m.created_at,              ) : (() => {

        created_at: m.created_at,                const currentTier = PHONE_TIERS.find(t => t.key === callTracking.phone_plan);

        created_at: m.created_at,                const targetTier  = PHONE_TIERS.find(t => t.key === changePlan);

        created_at: m.created_at,                if (!targetTier) return null;

        created_at: m.created_at,                return (

        created_at: m.created_at,                  <>

        created_at: m.created_at,                    <div style={{

        created_at: m.created_at,                      fontSize: 10, color: C.textDim, letterSpacing: "0.1em",

        created_at: m.created_at,                      textTransform: "uppercase", fontFamily: "'DM Mono', monospace", marginBottom: 10,

        created_at: m.created_at,                    }}>Confirm switch</div>

        created_at: m.created_at,                    <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>

        created_at: m.created_at,                      {currentTier?.mins || "current"} → {targetTier.mins}

        created_at: m.created_at,                    </div>

        created_at: m.created_at,                    <div style={{ fontSize: 13, color: C.textDim, margin: "6px 0 16px", lineHeight: 1.55 }}>

        created_at: m.created_at,                      New price:{" "}

        created_at: m.created_at,                      <span style={{ color: C.amber, fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>

        created_at: m.created_at,                        {targetTier.price}/mo

        created_at: m.created_at,                      </span>.

        created_at: m.created_at,                    </div>

        created_at: m.created_at,                    <div style={{

        created_at: m.created_at,                      background: C.surfaceHigh,

        created_at: m.created_at,                      borderRadius: 6,

        created_at: m.created_at,                      padding: "11px 12px",

        created_at: m.created_at,                      marginBottom: 18,

        created_at: m.created_at,                    }}>

        created_at: m.created_at,                      <div style={{

        created_at: m.created_at,                        fontSize: 10, color: C.textDim, fontFamily: "'DM Mono', monospace",

        created_at: m.created_at,                        letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4,

        created_at: m.created_at,                      }}>What happens</div>

        created_at: m.created_at,                      <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.55 }}>

        created_at: m.created_at,                        Your allowance changes to <strong>{targetTier.mins}</strong> right away. A prorated charge (or credit) for the rest of this billing period is added to your next invoice. Your Trade PA number stays the same.

        created_at: m.created_at,                      </div>

        created_at: m.created_at,                    </div>

        created_at: m.created_at,                    <div style={{ display: "flex", gap: 8 }}>

        created_at: m.created_at,                      <button

        created_at: m.created_at,                        onClick={() => setChangePlan("picker")}

        created_at: m.created_at,                        disabled={changeBusy}

        created_at: m.created_at,                        style={{

        created_at: m.created_at,                          flex: 1,

        created_at: m.created_at,                          padding: 10,

        created_at: m.created_at,                          border: `1px solid ${C.border}`,

        created_at: m.created_at,                          background: "transparent",

        created_at: m.created_at,                          color: C.text,

        created_at: m.created_at,                          fontSize: 11, fontWeight: 600,

        created_at: m.created_at,                          borderRadius: 6,

        created_at: m.created_at,                          fontFamily: "'DM Mono', monospace",

        created_at: m.created_at,                          letterSpacing: "0.08em",

        created_at: m.created_at,                          textTransform: "uppercase",

        created_at: m.created_at,                          cursor: changeBusy ? "not-allowed" : "pointer",

        created_at: m.created_at,                          opacity: changeBusy ? 0.5 : 1,

        created_at: m.created_at,                        }}

        created_at: m.created_at,                      >Back</button>

        created_at: m.created_at,                      <button

        created_at: m.created_at,                        onClick={() => switchPlan(changePlan)}

        created_at: m.created_at,                        disabled={changeBusy}

        created_at: m.created_at,                        style={{

        created_at: m.created_at,                          flex: 1.6,

        created_at: m.created_at,                          padding: 10,

        created_at: m.created_at,                          border: `1px solid ${C.amber}`,

        created_at: m.created_at,                          background: C.amber,

        created_at: m.created_at,                          color: "#412402",

        created_at: m.created_at,                          fontSize: 11, fontWeight: 700,

        created_at: m.created_at,                          borderRadius: 6,

        created_at: m.created_at,                          fontFamily: "'DM Mono', monospace",

        created_at: m.created_at,                          letterSpacing: "0.08em",

        created_at: m.created_at,                          textTransform: "uppercase",

        created_at: m.created_at,                          cursor: changeBusy ? "not-allowed" : "pointer",

        created_at: m.created_at,                          opacity: changeBusy ? 0.5 : 1,

        created_at: m.created_at,                        }}

        created_at: m.created_at,                      >{changeBusy ? "Switching..." : `Confirm · ${targetTier.price}/mo`}</button>

        created_at: m.created_at,                    </div>

        created_at: m.created_at,                  </>

        created_at: m.created_at,                );

        created_at: m.created_at,              })()}

        created_at: m.created_at,            </div>

        created_at: m.created_at,          </div>

        created_at: m.created_at,        )}

        created_at: m.created_at,      </div>

        created_at: m.created_at,    );

        created_at: m.created_at,  }

        created_at: m.created_at,

        created_at: m.created_at,  return (

        created_at: m.created_at,    <div>

        created_at: m.created_at,      <div style={{ background: `${C.amber}12`, border: `1px solid ${C.amber}30`, borderRadius: 10, padding: 14, marginBottom: 16 }}>

        created_at: m.created_at,        <div style={{ fontSize: 13, fontWeight: 700, color: C.amber, marginBottom: 8 }}>📞 Business Phone, Built In</div>

        created_at: m.created_at,        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>

        created_at: m.created_at,          {[

        created_at: m.created_at,            "Get a dedicated business number instantly",

        created_at: m.created_at,            "Calls ring inside the Trade PA app — no second SIM",

        created_at: m.created_at,            "Every call recorded, transcribed & AI-classified",

        created_at: m.created_at,            "Missed calls fall back to your real mobile",

        created_at: m.created_at,            "Full call history logged against customers & jobs",

        created_at: m.created_at,          ].map(f => (

        created_at: m.created_at,            <div key={f} style={{ fontSize: 12, color: C.text, display: "flex", gap: 8 }}>

        created_at: m.created_at,              <span style={{ color: C.green, flexShrink: 0 }}>✓</span>

        created_at: m.created_at,              <span>{f}</span>

        created_at: m.created_at,            </div>

        created_at: m.created_at,          ))}

        created_at: m.created_at,        </div>

        created_at: m.created_at,      </div>

        created_at: m.created_at,

        created_at: m.created_at,      {/* Phone plan picker — 4 tiers */}

        created_at: m.created_at,      <label style={{ ...S.label, marginBottom: 10 }}>Choose your plan</label>

        created_at: m.created_at,      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>

        created_at: m.created_at,        {PHONE_TIERS.map(tier => {

        created_at: m.created_at,          const isSelected = selectedPhonePlan === tier.key;

        created_at: m.created_at,          return (

        created_at: m.created_at,            <div

        created_at: m.created_at,              key={tier.key}

        created_at: m.created_at,              onClick={() => setSelectedPhonePlan(tier.key)}

        created_at: m.created_at,              style={{

        created_at: m.created_at,                background: isSelected ? `${C.amber}14` : C.surfaceHigh,

        created_at: m.created_at,                border: `1.5px solid ${isSelected ? C.amber : C.border}`,

        created_at: m.created_at,                borderRadius: 8,

        created_at: m.created_at,                padding: "10px 12px",

        created_at: m.created_at,                cursor: "pointer",

        created_at: m.created_at,                position: "relative",

        created_at: m.created_at,                transition: "all 0.15s",

        created_at: m.created_at,              }}

        created_at: m.created_at,            >

        created_at: m.created_at,              {tier.popular && <div style={{ position: "absolute", top: -7, right: 8, background: C.amber, color: "#000", fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 100, fontFamily: "'DM Mono',monospace", letterSpacing: "0.04em" }}>POPULAR</div>}

        created_at: m.created_at,              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>

        created_at: m.created_at,                <div style={{ fontSize: 12, fontWeight: 700, color: C.text, fontFamily: "'DM Mono',monospace" }}>{tier.mins}</div>

        created_at: m.created_at,                <div style={{ fontSize: 14, fontWeight: 700, color: isSelected ? C.amber : C.text, fontFamily: "'DM Mono',monospace" }}>{tier.price}</div>

        created_at: m.created_at,              </div>

        created_at: m.created_at,              <div style={{ fontSize: 10, color: C.muted }}>{tier.desc}</div>

        created_at: m.created_at,              <div style={{ fontSize: 9, color: C.muted, marginTop: 2, fontFamily: "'DM Mono',monospace" }}>/month</div>

        created_at: m.created_at,            </div>

        created_at: m.created_at,          );

        created_at: m.created_at,        })}

        created_at: m.created_at,      </div>

        created_at: m.created_at,

        created_at: m.created_at,      <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, lineHeight: 1.6 }}>

        created_at: m.created_at,        Enter your personal mobile as a fallback. If you don't answer in the app within 30 seconds, the call will ring your mobile instead so you never miss anything.

        created_at: m.created_at,      </div>

        created_at: m.created_at,      <label style={S.label}>Fallback mobile number</label>

        created_at: m.created_at,      <input style={{ ...S.input, marginBottom: 10 }} placeholder="e.g. 07700 900123" value={forwardTo} onChange={e => setForwardTo(e.target.value)} />

        created_at: m.created_at,      {error && <div style={{ fontSize: 12, color: C.red, marginBottom: 8 }}>{error}</div>}

        created_at: m.created_at,      <button style={S.btn("primary")} disabled={saving} onClick={activate}>{saving ? "Setting up your number..." : "Subscribe & activate →"}</button>

        created_at: m.created_at,      <div style={{ fontSize: 11, color: C.muted, marginTop: 10 }}>Uses your existing Trade PA payment method · Cancel anytime from Stripe billing portal</div>

        created_at: m.created_at,      <div style={{ marginTop: 14, padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>

        created_at: m.created_at,        <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>Already have a business number? You can port it across so customers keep calling the same number. Email <span style={{ color: C.amber }}>hello@tradespa.co.uk</span> to get started.</div>

        created_at: m.created_at,      </div>

        created_at: m.created_at,    </div>

        created_at: m.created_at,  );

        created_at: m.created_at,}

        created_at: m.created_at,

        created_at: m.created_at,function TeamInvite({ companyId, planTier, currentMemberCount }) {

        created_at: m.created_at,  const ALL_SECTIONS = ["Dashboard", "Schedule", "Jobs", "Customers", "Invoices", "Quotes", "Materials", "Expenses", "CIS", "AI Assistant", "Reminders", "Payments", "Inbox", "Reports", "Mileage", "Workers", "Subcontractors", "Documents", "Reviews", "Stock", "RAMS"];

        created_at: m.created_at,  const [email, setEmail] = useState("");

        created_at: m.created_at,  const [role, setRole] = useState("member");

        created_at: m.created_at,  const [sending, setSending] = useState(false);

        created_at: m.created_at,  const [sent, setSent] = useState(false);

        created_at: m.created_at,  const [error, setError] = useState("");

        created_at: m.created_at,  const [showForm, setShowForm] = useState(false);

        created_at: m.created_at,  const [permissions, setPermissions] = useState(() => {

        created_at: m.created_at,    const p = {};

        created_at: m.created_at,    ALL_SECTIONS.forEach(s => p[s] = true);

        created_at: m.created_at,    return p;

        created_at: m.created_at,  });

        created_at: m.created_at,

        created_at: m.created_at,  const togglePerm = (section) => setPermissions(p => ({ ...p, [section]: !p[section] }));

        created_at: m.created_at,

        created_at: m.created_at,  const sendInvite = async () => {

        created_at: m.created_at,    if (!email || !companyId) return;

        created_at: m.created_at,

        created_at: m.created_at,    // Check user limit based on plan

        created_at: m.created_at,    const tierCfg = getTierConfig(planTier);

        created_at: m.created_at,    const maxUsers = tierCfg.userLimit;

        created_at: m.created_at,    if (currentMemberCount >= maxUsers) {

        created_at: m.created_at,      setError(`Your ${tierCfg.label} plan allows up to ${maxUsers} user${maxUsers === 1 ? "" : "s"}. Upgrade your plan to add more team members.`);

        created_at: m.created_at,      return;

        created_at: m.created_at,    }

        created_at: m.created_at,

        created_at: m.created_at,    setSending(true); setError("");

        created_at: m.created_at,    try {

        created_at: m.created_at,      const { data: existing } = await db

        created_at: m.created_at,        .from("invites")

        created_at: m.created_at,        .select("id")

        created_at: m.created_at,        .eq("company_id", companyId)

        created_at: m.created_at,        .eq("email", email.toLowerCase())

        created_at: m.created_at,        .eq("accepted", false);

        created_at: m.created_at,

        created_at: m.created_at,      if (existing && existing.length > 0) {

        created_at: m.created_at,        setError("An invite has already been sent to this email.");

        created_at: m.created_at,        setSending(false);

        created_at: m.created_at,        return;

        created_at: m.created_at,      }

        created_at: m.created_at,

        created_at: m.created_at,      await db.from("invites").insert({

        created_at: m.created_at,        company_id: companyId,

        created_at: m.created_at,        invited_by: (await db.auth.getUser()).data.user.id,

        created_at: m.created_at,        email: email.toLowerCase(),

        created_at: m.created_at,        role,

        created_at: m.created_at,        permissions: role === "owner" ? null : permissions,

        created_at: m.created_at,        accepted: false,

        created_at: m.created_at,      });

        created_at: m.created_at,

        created_at: m.created_at,      setSent(true);

        created_at: m.created_at,      setEmail("");

        created_at: m.created_at,      setTimeout(() => { setSent(false); setShowForm(false); }, 3000);

        created_at: m.created_at,    } catch (e) {

        created_at: m.created_at,      setError("Failed to send invite. Please try again.");

        created_at: m.created_at,    }

        created_at: m.created_at,    setSending(false);

        created_at: m.created_at,  };

        created_at: m.created_at,

        created_at: m.created_at,  if (!showForm) return (

        created_at: m.created_at,    <button style={S.btn("primary")} onClick={() => setShowForm(true)}>+ Invite Team Member</button>

        created_at: m.created_at,  );

        created_at: m.created_at,

        created_at: m.created_at,  return (

        created_at: m.created_at,    <div style={{ ...S.card, background: C.surfaceHigh, padding: 16 }}>

        created_at: m.created_at,      {sent ? (

        created_at: m.created_at,        <div style={{ fontSize: 12, color: C.green }}>✓ Invite sent — they'll join when they sign up with this email.</div>

        created_at: m.created_at,      ) : (

        created_at: m.created_at,        <>

        created_at: m.created_at,          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Invite a team member</div>

        created_at: m.created_at,          {error && <div style={{ fontSize: 11, color: C.red, marginBottom: 8 }}>{error}</div>}

        created_at: m.created_at,

        created_at: m.created_at,          <label style={S.label}>Email address</label>

        created_at: m.created_at,          <input

        created_at: m.created_at,            style={{ ...S.input, marginBottom: 14 }}

        created_at: m.created_at,            type="email"

        created_at: m.created_at,            placeholder="colleague@email.com"

        created_at: m.created_at,            value={email}

        created_at: m.created_at,            onChange={e => setEmail(e.target.value)}

        created_at: m.created_at,          />

        created_at: m.created_at,

        created_at: m.created_at,          <label style={S.label}>Role</label>

        created_at: m.created_at,          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>

        created_at: m.created_at,            {[["member", "Member"], ["owner", "Owner"]].map(([v, l]) => (

        created_at: m.created_at,              <button key={v} onClick={() => setRole(v)} style={S.pill(C.amber, role === v)}>{l}</button>

        created_at: m.created_at,            ))}

        created_at: m.created_at,          </div>

        created_at: m.created_at,

        created_at: m.created_at,          {role === "member" && (

        created_at: m.created_at,            <>

        created_at: m.created_at,              <label style={S.label}>Section Access</label>

        created_at: m.created_at,              <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>

        created_at: m.created_at,                Choose which sections this member can see. Toggle off to restrict access.

        created_at: m.created_at,              </div>

        created_at: m.created_at,              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>

        created_at: m.created_at,                {ALL_SECTIONS.map(section => {

        created_at: m.created_at,                  const allowed = permissions[section] !== false;

        created_at: m.created_at,                  return (

        created_at: m.created_at,                    <button

        created_at: m.created_at,                      key={section}

        created_at: m.created_at,                      onClick={() => togglePerm(section)}

        created_at: m.created_at,                      style={{

        created_at: m.created_at,                        padding: "5px 12px", borderRadius: 12, fontSize: 11,

        created_at: m.created_at,                        fontFamily: "'DM Mono',monospace", fontWeight: 600, cursor: "pointer",

        created_at: m.created_at,                        border: `1px solid ${allowed ? C.green + "66" : C.border}`,

        created_at: m.created_at,                        background: allowed ? C.green + "18" : C.surface,

        created_at: m.created_at,                        color: allowed ? C.green : C.muted,

        created_at: m.created_at,                      }}

        created_at: m.created_at,                    >

        created_at: m.created_at,                      {allowed ? "✓" : "✗"} {section}

        created_at: m.created_at,                    </button>

        created_at: m.created_at,                  );

        created_at: m.created_at,                })}

        created_at: m.created_at,              </div>

        created_at: m.created_at,              <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>

        created_at: m.created_at,                {Object.values(permissions).filter(Boolean).length} of {ALL_SECTIONS.length} sections enabled

        created_at: m.created_at,              </div>

        created_at: m.created_at,            </>

        created_at: m.created_at,          )}

        created_at: m.created_at,

        created_at: m.created_at,          {role === "owner" && (

        created_at: m.created_at,            <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>

        created_at: m.created_at,              Owners have full access to all sections including Settings.

        created_at: m.created_at,            </div>

        created_at: m.created_at,          )}

        created_at: m.created_at,

        created_at: m.created_at,          <div style={{ display: "flex", gap: 8 }}>

        created_at: m.created_at,            <button style={S.btn("primary", !email || sending)} disabled={!email || sending} onClick={sendInvite}>

        created_at: m.created_at,              {sending ? "Sending..." : "Send Invite →"}

        created_at: m.created_at,            </button>

        created_at: m.created_at,            <button style={S.btn("ghost")} onClick={() => { setShowForm(false); setError(""); }}>Cancel</button>

        created_at: m.created_at,          </div>

        created_at: m.created_at,        </>

        created_at: m.created_at,      )}

        created_at: m.created_at,    </div>

        created_at: m.created_at,  );

        created_at: m.created_at,}

        created_at: m.created_at,

        created_at: m.created_at,// (ALL_CERTS moved to ./lib/constants.js — P1)

        created_at: m.created_at,

        created_at: m.created_at,function CertificationsCard({ brand, setBrand }) {

        created_at: m.created_at,  const [expanded, setExpanded] = useState(false);

        created_at: m.created_at,  const enabledCerts = ALL_CERTS.filter(c => brand[c.key]);

        created_at: m.created_at,  const visibleCerts = expanded ? ALL_CERTS : (enabledCerts.length > 0 ? enabledCerts : ALL_CERTS.slice(0, 4));

        created_at: m.created_at,  return (

        created_at: m.created_at,    <div style={S.card}>

        created_at: m.created_at,      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>

        created_at: m.created_at,        <div style={S.sectionTitle}>Certifications & Compliance</div>

        created_at: m.created_at,        <button onClick={() => setExpanded(e => !e)} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px" }}>

        created_at: m.created_at,          {expanded ? "Show less ↑" : `Show all (${ALL_CERTS.length}) ↓`}

        created_at: m.created_at,        </button>

        created_at: m.created_at,      </div>

        created_at: m.created_at,      <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>

        created_at: m.created_at,        {enabledCerts.length > 0 ? `${enabledCerts.length} shown on invoices & quotes` : "Tap to enable certifications shown on your invoices."}

        created_at: m.created_at,      </div>

        created_at: m.created_at,      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>

        created_at: m.created_at,        {visibleCerts.map((cert) => {

        created_at: m.created_at,          const on = brand[cert.key] || false;

        created_at: m.created_at,          return (

        created_at: m.created_at,            <div key={cert.key}

        created_at: m.created_at,              style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 14px", background: on ? brand.accentColor + "11" : C.surfaceHigh, border: `1px solid ${on ? brand.accentColor + "44" : C.border}`, borderRadius: 8, cursor: "pointer", transition: "all 0.15s" }}

        created_at: m.created_at,              onClick={() => setBrand(b => ({ ...b, [cert.key]: !on }))}>

        created_at: m.created_at,              <div style={{ fontSize: 18, flexShrink: 0, width: 24, textAlign: "center" }}>{cert.icon}</div>

        created_at: m.created_at,              <div style={{ flex: 1, fontSize: 13, fontWeight: on ? 600 : 400, color: on ? C.text : C.textDim }}>{cert.label}</div>

        created_at: m.created_at,              <div style={{ width: 36, height: 20, borderRadius: 10, background: on ? brand.accentColor : C.border, position: "relative", flexShrink: 0, transition: "all 0.2s" }}>

        created_at: m.created_at,                <div style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "all 0.2s" }} />

        created_at: m.created_at,              </div>

        created_at: m.created_at,            </div>

        created_at: m.created_at,          );

        created_at: m.created_at,        })}

        created_at: m.created_at,      </div>

        created_at: m.created_at,    </div>

        created_at: m.created_at,  );

        created_at: m.created_at,}

        created_at: m.created_at,

        created_at: m.created_at,// ─── Recently Deleted (holding bay UI) ───────────────────────────────────

        created_at: m.created_at,//

        created_at: m.created_at,// Lists soft-deleted rows from across all soft-delete tables, grouped by

        created_at: m.created_at,// type. Tap → Restore (clear deleted_at + cascade_id) or Delete forever

        created_at: m.created_at,// (hard DELETE). 14-day retention is enforced server-side by the

        created_at: m.created_at,// purge_expired_soft_deletes() pg_cron job — we just show what's still

        created_at: m.created_at,// in the bay.

        created_at: m.created_at,//

        created_at: m.created_at,// Only loads top 100 most-recently-deleted across all tables to keep

        created_at: m.created_at,// initial render fast — a Trash with 5,000 items is unlikely on a

        created_at: m.created_at,// pre-launch product but defensive cap regardless.

        created_at: m.created_at,// (RecentlyDeleted moved to ./views/RecentlyDeleted.jsx — P7-7A)

        created_at: m.created_at,function Settings({ brand, setBrand, companyId, companyName, userRole, members, user, planTier, userLimit, openAssistantSetup, openFeedback, assistantName, assistantWakeWords, userCommandsCount, usageData, usageCaps }) {

        created_at: m.created_at,  // ── Account deletion state (Apple Guideline 5.1.1(v) — required) ────────

        created_at: m.created_at,  // Hard delete with type-to-confirm: user must type their email exactly to

        created_at: m.created_at,  // unlock the destructive button. Server enforces the same check as a

        created_at: m.created_at,  // belt-and-braces guard. Calls /api/delete-account which cascades through

        created_at: m.created_at,  // every user_id-scoped table, cancels Stripe subscription, deletes auth row.

        created_at: m.created_at,  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

        created_at: m.created_at,  const [deleteConfirmText, setDeleteConfirmText] = useState("");

        created_at: m.created_at,  const [deletingAccount, setDeletingAccount] = useState(false);

        created_at: m.created_at,  const [deleteError, setDeleteError] = useState("");

        created_at: m.created_at,

        created_at: m.created_at,  const handleDeleteAccount = async () => {

        created_at: m.created_at,    if (deleteConfirmText.trim().toLowerCase() !== (user?.email || "").toLowerCase()) {

        created_at: m.created_at,      setDeleteError("The email you typed doesn't match your account email.");

        created_at: m.created_at,      return;

        created_at: m.created_at,    }

        created_at: m.created_at,    setDeletingAccount(true);

        created_at: m.created_at,    setDeleteError("");

        created_at: m.created_at,    try {

        created_at: m.created_at,      const { data: { session } } = await db.auth.getSession();

        created_at: m.created_at,      const token = session?.access_token;

        created_at: m.created_at,      if (!token) {

        created_at: m.created_at,        setDeleteError("Could not verify your session. Please sign out and back in, then try again.");

        created_at: m.created_at,        setDeletingAccount(false);

        created_at: m.created_at,        return;

        created_at: m.created_at,      }

        created_at: m.created_at,      const res = await fetch("/api/delete-account", {

        created_at: m.created_at,        method: "POST",

        created_at: m.created_at,        headers: {

        created_at: m.created_at,          "Content-Type": "application/json",

        created_at: m.created_at,          "Authorization": `Bearer ${token}`,

        created_at: m.created_at,        },

        created_at: m.created_at,        body: JSON.stringify({ confirmEmail: deleteConfirmText.trim() }),

        created_at: m.created_at,      });

        created_at: m.created_at,      const json = await res.json();

        created_at: m.created_at,      if (!res.ok) {

        created_at: m.created_at,        setDeleteError(json.error || "Account deletion failed. Please try again or contact support.");

        created_at: m.created_at,        setDeletingAccount(false);

        created_at: m.created_at,        return;

        created_at: m.created_at,      }

        created_at: m.created_at,      // Success — sign out locally and reload. The auth row is gone server-side

        created_at: m.created_at,      // so the existing session token is now invalid; reload kicks the user

        created_at: m.created_at,      // back to the AuthScreen.

        created_at: m.created_at,      try { await db.auth.signOut(); } catch {}

        created_at: m.created_at,      window.location.reload();

        created_at: m.created_at,    } catch (err) {

        created_at: m.created_at,      setDeleteError("Network error: " + (err.message || "unknown") + ". Please try again.");

        created_at: m.created_at,      setDeletingAccount(false);

        created_at: m.created_at,    }

        created_at: m.created_at,  };

        created_at: m.created_at,  const { theme, resolvedTheme, setTheme } = useTheme();

        created_at: m.created_at,  const [saved, setSaved] = useState(false);

        created_at: m.created_at,  const [preview, setPreview] = useState(false);

        created_at: m.created_at,  const [reportLoading, setReportLoading] = useState(false);

        created_at: m.created_at,  const [reportText, setReportText] = useState(null);

        created_at: m.created_at,  const [reportError, setReportError] = useState(null);

        created_at: m.created_at,

        created_at: m.created_at,  // ─── Add-on purchase (Plan & billing subview) ────────────────────────────

        created_at: m.created_at,  const [addonConfirm, setAddonConfirm] = useState(null); // addon_type key being confirmed

        created_at: m.created_at,  const [addonBusy, setAddonBusy] = useState(false);

        created_at: m.created_at,  const [addonResult, setAddonResult] = useState(null);   // { type, message, displayName? }

        created_at: m.created_at,  const ADDON_DISPLAY = {

        created_at: m.created_at,    conversations: { title: "+200 conversations", subtitle: "200 extra AI conversations, active right away. Expires end of this month.", pricePence: 3900 },

        created_at: m.created_at,    handsfree:     { title: "+2 hours hands-free", subtitle: "2 extra hours of hands-free mic time, active right away. Expires end of this month.", pricePence: 1900 },

        created_at: m.created_at,    combo:         { title: "+200 conversations & +2 hours hands-free", subtitle: "Both combined — 200 conversations and 2 hours of hands-free, active right away. Expires end of this month.", pricePence: 5500 },

        created_at: m.created_at,  };

        created_at: m.created_at,  const purchaseAddon = async (addonType) => {

        created_at: m.created_at,    setAddonBusy(true);

        created_at: m.created_at,    setAddonResult(null);

        created_at: m.created_at,    try {

        created_at: m.created_at,      const { data: { session } } = await window._supabase.auth.getSession();

        created_at: m.created_at,      const token = session?.access_token;

        created_at: m.created_at,      if (!token) {

        created_at: m.created_at,        setAddonResult({ type: "error", message: "Please log in again to buy add-ons." });

        created_at: m.created_at,        return;

        created_at: m.created_at,      }

        created_at: m.created_at,      const res = await fetch("/api/stripe/purchase-addon", {

        created_at: m.created_at,        method: "POST",

        created_at: m.created_at,        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },

        created_at: m.created_at,        body: JSON.stringify({ addon_type: addonType }),

        created_at: m.created_at,      });

        created_at: m.created_at,      const data = await res.json();

        created_at: m.created_at,      if (!res.ok || !data.success) {

        created_at: m.created_at,        setAddonResult({ type: "error", message: data.message || "Add-on purchase failed. Please try again." });

        created_at: m.created_at,      } else {

        created_at: m.created_at,        setAddonResult({ type: "success", displayName: data.display_name, message: "Active now — extra allowance available this month." });

        created_at: m.created_at,      }

        created_at: m.created_at,    } catch (err) {

        created_at: m.created_at,      console.error("[purchase-addon]", err);

        created_at: m.created_at,      setAddonResult({ type: "error", message: "Couldn't complete purchase. Please try again or email hello@tradespa.co.uk" });

        created_at: m.created_at,    } finally {

        created_at: m.created_at,      setAddonBusy(false);

        created_at: m.created_at,      setAddonConfirm(null);

        created_at: m.created_at,    }

        created_at: m.created_at,  };

        created_at: m.created_at,

        created_at: m.created_at,  const generateReport = async () => {

        created_at: m.created_at,    setReportLoading(true);

        created_at: m.created_at,    setReportText(null);

        created_at: m.created_at,    setReportError(null);

        created_at: m.created_at,    try {

        created_at: m.created_at,      const res = await fetch("/api/error-report", {

        created_at: m.created_at,        method: "POST",

        created_at: m.created_at,        headers: await authHeaders(),

        created_at: m.created_at,        body: JSON.stringify({

        created_at: m.created_at,          userEmail: brand?.email || user?.email,

        created_at: m.created_at,          sendEmail: !!(brand?.email || user?.email),

        created_at: m.created_at,          daysBack: 30,

        created_at: m.created_at,        }),

        created_at: m.created_at,      });

        created_at: m.created_at,      const data = await res.json();

        created_at: m.created_at,      if (data.report) {

        created_at: m.created_at,        setReportText(data.report);

        created_at: m.created_at,      } else {

        created_at: m.created_at,        setReportText("No errors logged in the last 30 days. All good! ✓");

        created_at: m.created_at,      }

        created_at: m.created_at,    } catch(e) {

        created_at: m.created_at,      setReportError("Failed to generate report: " + e.message);

        created_at: m.created_at,    }

        created_at: m.created_at,    setReportLoading(false);

        created_at: m.created_at,  };

        created_at: m.created_at,  const [xeroConnected, setXeroConnected] = useState(false);

        created_at: m.created_at,  const [qbConnected, setQbConnected] = useState(false);

        created_at: m.created_at,  // Hoisted out of nested IIFEs in the Business drill-in (React error #310 fix):

        created_at: m.created_at,  // hooks must be called in the same order every render regardless of subview,

        created_at: m.created_at,  // so these cannot live inside an IIFE inside a conditionally-rendered branch.

        created_at: m.created_at,  const [reviewLinksOpen, setReviewLinksOpen] = useState(false);

        created_at: m.created_at,  const [vatChecking, setVatChecking] = useState(false);

        created_at: m.created_at,  const [vatError, setVatError] = useState("");

        created_at: m.created_at,  const logoRef = useRef();

        created_at: m.created_at,  const set = (k) => (e) => setBrand(b => ({ ...b, [k]: e.target.value }));

        created_at: m.created_at,

        created_at: m.created_at,  // Check connection status — from Supabase DB on load (persists across reloads)

        created_at: m.created_at,  useEffect(() => {

        created_at: m.created_at,    const params = new URLSearchParams(window.location.search);

        created_at: m.created_at,    if (params.has('xero') || params.has('qb')) {

        created_at: m.created_at,      if (params.get('xero') === 'error') alert(`Xero connection failed: ${params.get('msg') || 'unknown error'}`);

        created_at: m.created_at,      if (params.get('qb') === 'error') alert(`QuickBooks connection failed: ${params.get('msg') || 'unknown error'}`);

        created_at: m.created_at,      window.history.replaceState({}, '', window.location.pathname);

        created_at: m.created_at,    }

        created_at: m.created_at,    if (params.has('stripe_connect')) {

        created_at: m.created_at,      const status = params.get('stripe_connect');

        created_at: m.created_at,      if (status === 'success') alert("✓ Stripe connected — you can now accept card payments through your customer portal links.");

        created_at: m.created_at,      else if (status === 'pending') alert("Stripe onboarding isn't fully complete yet. You can tap Connect Stripe again in Settings to finish — your progress is saved.");

        created_at: m.created_at,      else if (status === 'cancelled') alert("Stripe connection cancelled. You can try again anytime from Settings → Integrations.");

        created_at: m.created_at,      else if (status === 'error') alert(`Stripe connection failed: ${params.get('reason') || 'unknown error'}`);

        created_at: m.created_at,      window.history.replaceState({}, '', window.location.pathname);

        created_at: m.created_at,    }

        created_at: m.created_at,    // Always check DB for actual connection status

        created_at: m.created_at,    if (!user?.id) return;

        created_at: m.created_at,    db

        created_at: m.created_at,      .from("accounting_connections")

        created_at: m.created_at,      .select("provider")

        created_at: m.created_at,      .eq("user_id", user.id)

        created_at: m.created_at,      .then(({ data }) => {

        created_at: m.created_at,        if (data) {

        created_at: m.created_at,          setXeroConnected(data.some(r => r.provider === "xero"));

        created_at: m.created_at,          setQbConnected(data.some(r => r.provider === "quickbooks"));

        created_at: m.created_at,        }

        created_at: m.created_at,      });

        created_at: m.created_at,  }, [user?.id]);

        created_at: m.created_at,

        created_at: m.created_at,  const handleLogo = (e) => {

        created_at: m.created_at,    const file = e.target.files[0];

        created_at: m.created_at,    if (!file) return;

        created_at: m.created_at,    // Compress image before storing to prevent localStorage overflow

        created_at: m.created_at,    const img = new Image();

        created_at: m.created_at,    const url = URL.createObjectURL(file);

        created_at: m.created_at,    img.onload = () => {

        created_at: m.created_at,      URL.revokeObjectURL(url);

        created_at: m.created_at,      const MAX = 400; // max dimension px

        created_at: m.created_at,      let { width, height } = img;

        created_at: m.created_at,      if (width > MAX || height > MAX) {

        created_at: m.created_at,        const ratio = Math.min(MAX / width, MAX / height);

        created_at: m.created_at,        width = Math.round(width * ratio);

        created_at: m.created_at,        height = Math.round(height * ratio);

        created_at: m.created_at,      }

        created_at: m.created_at,      const canvas = document.createElement("canvas");

        created_at: m.created_at,      canvas.width = width;

        created_at: m.created_at,      canvas.height = height;

        created_at: m.created_at,      canvas.getContext("2d").drawImage(img, 0, 0, width, height);

        created_at: m.created_at,      const compressed = canvas.toDataURL("image/jpeg", 0.8);

        created_at: m.created_at,      setBrand(b => ({ ...b, logo: compressed }));

        created_at: m.created_at,    };

        created_at: m.created_at,    img.onerror = () => URL.revokeObjectURL(url);

        created_at: m.created_at,    img.src = url;

        created_at: m.created_at,    // Reset input so same file can be re-selected

        created_at: m.created_at,    e.target.value = "";

        created_at: m.created_at,  };

        created_at: m.created_at,

        created_at: m.created_at,  const save = () => {

        created_at: m.created_at,    setSaved(true);

        created_at: m.created_at,    setTimeout(() => setSaved(false), 2500);

        created_at: m.created_at,  };

        created_at: m.created_at,

        created_at: m.created_at,  const ACCENT_PRESETS = ["#f59e0b", "#3b82f6", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#0ea5e9", "#1a1a1a"];

        created_at: m.created_at,

        created_at: m.created_at,  // ─── New navigation architecture (mockup-faithful redesign) ────────────────

        created_at: m.created_at,  // subview: null = landing page; otherwise a category id from CATEGORIES below.

        created_at: m.created_at,  const [subview, setSubview] = useState(null);

        created_at: m.created_at,  const [searchQuery, setSearchQuery] = useState("");

        created_at: m.created_at,  const [toast, setToast] = useState(null); // { text, sub } | null

        created_at: m.created_at,  const toastTimerRef = useRef(null);

        created_at: m.created_at,

        created_at: m.created_at,  const showToast = (text, sub = "SAVED AUTOMATICALLY") => {

        created_at: m.created_at,    setToast({ text, sub });

        created_at: m.created_at,    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);

        created_at: m.created_at,    toastTimerRef.current = setTimeout(() => setToast(null), 2400);

        created_at: m.created_at,  };

        created_at: m.created_at,

        created_at: m.created_at,  // Fire toast on brand changes — debounced 2s after the last edit, matching the

        created_at: m.created_at,  // existing brand→Supabase sync timing so the toast appears when the save lands.

        created_at: m.created_at,  // Skip the first render so we don't flash a toast on initial load.

        created_at: m.created_at,  const lastBrandRef = useRef(null);

        created_at: m.created_at,  const brandToastTimerRef = useRef(null);

        created_at: m.created_at,  useEffect(() => {

        created_at: m.created_at,    // Skip very first render (no prior brand to compare against)

        created_at: m.created_at,    if (lastBrandRef.current === null) {

        created_at: m.created_at,      lastBrandRef.current = brand;

        created_at: m.created_at,      return;

        created_at: m.created_at,    }

        created_at: m.created_at,    if (lastBrandRef.current === brand) return; // identity check, no change

        created_at: m.created_at,    lastBrandRef.current = brand;

        created_at: m.created_at,    // Debounce so rapid keystrokes only trigger one toast

        created_at: m.created_at,    if (brandToastTimerRef.current) clearTimeout(brandToastTimerRef.current);

        created_at: m.created_at,    brandToastTimerRef.current = setTimeout(() => {

        created_at: m.created_at,      showToast("Saved");

        created_at: m.created_at,    }, 2100); // slightly after the existing 2s Supabase sync

        created_at: m.created_at,  }, [brand]);

        created_at: m.created_at,

        created_at: m.created_at,  // Computed status pills for each category (shown on the landing cards)

        created_at: m.created_at,  const tradeCount = (brand.tradeTypes || []).length;

        created_at: m.created_at,  const integrationsConnected = [xeroConnected, qbConnected, !!brand?.stripeAccountId].filter(Boolean).length;

        created_at: m.created_at,  const memberCount = (members || []).length;

        created_at: m.created_at,

        created_at: m.created_at,  // Categories config — drives the landing page rendering and drill-in routing

        created_at: m.created_at,  const CATEGORIES = [

        created_at: m.created_at,    {

        created_at: m.created_at,      id: "ai-assistant",

        created_at: m.created_at,      group: "YOUR PA",

        created_at: m.created_at,      name: "AI Assistant",

        created_at: m.created_at,      sub: "Name · wake words · personality · commands",

        created_at: m.created_at,      featured: true,

        created_at: m.created_at,      icon: (

        created_at: m.created_at,        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">

        created_at: m.created_at,          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-14 0M12 18v4M8 22h8M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3z" />

        created_at: m.created_at,        </svg>

        created_at: m.created_at,      ),

        created_at: m.created_at,      iconTint: "amber",

        created_at: m.created_at,      status: { text: assistantName || "Trade PA", color: "amber" },

        created_at: m.created_at,    },

        created_at: m.created_at,    {

        created_at: m.created_at,      id: "phone-calls",

        created_at: m.created_at,      group: "YOUR PA",

        created_at: m.created_at,      name: "Phone & Calls",

        created_at: m.created_at,      sub: "Business number · recording · transcription",

        created_at: m.created_at,      icon: (

        created_at: m.created_at,        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">

        created_at: m.created_at,          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />

        created_at: m.created_at,        </svg>

        created_at: m.created_at,      ),

        created_at: m.created_at,      iconTint: "amber",

        created_at: m.created_at,      status: { text: "● Active", color: "green" },

        created_at: m.created_at,    },

        created_at: m.created_at,    {

        created_at: m.created_at,      id: "business",

        created_at: m.created_at,      group: "BUSINESS",

        created_at: m.created_at,      name: "Business profile",

        created_at: m.created_at,      sub: "Trading name · address · VAT · UTR",

        created_at: m.created_at,      icon: (

        created_at: m.created_at,        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">

        created_at: m.created_at,          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11m4-11v11m8-11v11m4-11v11" />

        created_at: m.created_at,        </svg>

        created_at: m.created_at,      ),

        created_at: m.created_at,      iconTint: "blue",

        created_at: m.created_at,    },

        created_at: m.created_at,    {

        created_at: m.created_at,      id: "invoices",

        created_at: m.created_at,      group: "BUSINESS",

        created_at: m.created_at,      name: "Invoices & payments",

        created_at: m.created_at,      sub: "Bank · terms · reference format · footer",

        created_at: m.created_at,      icon: (

        created_at: m.created_at,        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">

        created_at: m.created_at,          <circle cx="12" cy="12" r="9" />

        created_at: m.created_at,          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.66 0-3 .9-3 2s1.34 2 3 2 3 .9 3 2-1.34 2-3 2m0-8c1.11 0 2.08.4 2.6 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.4-2.6-1" />

        created_at: m.created_at,        </svg>

        created_at: m.created_at,      ),

        created_at: m.created_at,      iconTint: "blue",

        created_at: m.created_at,    },

        created_at: m.created_at,    {

        created_at: m.created_at,      id: "branding",

        created_at: m.created_at,      group: "BUSINESS",

        created_at: m.created_at,      name: "Branding",

        created_at: m.created_at,      sub: "Logo · colour · appearance",

        created_at: m.created_at,      icon: (

        created_at: m.created_at,        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">

        created_at: m.created_at,          <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />

        created_at: m.created_at,        </svg>

        created_at: m.created_at,      ),

        created_at: m.created_at,      iconTint: "purple",

        created_at: m.created_at,    },

        created_at: m.created_at,    {

        created_at: m.created_at,      id: "compliance",

        created_at: m.created_at,      group: "BUSINESS",

        created_at: m.created_at,      name: "Compliance & trade",

        created_at: m.created_at,      sub: "Gas Safe · NICEIC · certifications · numbering",

        created_at: m.created_at,      icon: (

        created_at: m.created_at,        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">

        created_at: m.created_at,          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />

        created_at: m.created_at,        </svg>

        created_at: m.created_at,      ),

        created_at: m.created_at,      iconTint: "green",

        created_at: m.created_at,      status: tradeCount > 0 ? { text: `${tradeCount} trade${tradeCount === 1 ? "" : "s"}`, color: "amber" } : null,

        created_at: m.created_at,    },

        created_at: m.created_at,    {

        created_at: m.created_at,      id: "notifications",

        created_at: m.created_at,      group: "WORKFLOW",

        created_at: m.created_at,      name: "Notifications",

        created_at: m.created_at,      sub: "Evening briefing · reminders · alerts",

        created_at: m.created_at,      icon: (

        created_at: m.created_at,        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">

        created_at: m.created_at,          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />

        created_at: m.created_at,        </svg>

        created_at: m.created_at,      ),

        created_at: m.created_at,      iconTint: "neutral",

        created_at: m.created_at,      status: brand.eveningBriefing ? { text: "● On", color: "green" } : null,

        created_at: m.created_at,    },

        created_at: m.created_at,    {

        created_at: m.created_at,      id: "team",

        created_at: m.created_at,      group: "WORKFLOW",

        created_at: m.created_at,      name: "Team",

        created_at: m.created_at,      sub: "Workspace · members · permissions",

        created_at: m.created_at,      icon: (

        created_at: m.created_at,        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">

        created_at: m.created_at,          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a3 3 0 015.36-1.857M17 4a3 3 0 00-3 3c0 1.66 1.34 3 3 3s3-1.34 3-3-1.34-3-3-3zM12 12a4 4 0 100-8 4 4 0 000 8zM7 4a3 3 0 11-6 0 3 3 0 016 0z" />

        created_at: m.created_at,        </svg>

        created_at: m.created_at,      ),

        created_at: m.created_at,      iconTint: "neutral",

        created_at: m.created_at,      status: { text: `${memberCount} member${memberCount === 1 ? "" : "s"}` },

        created_at: m.created_at,    },

        created_at: m.created_at,    {

        created_at: m.created_at,      id: "integrations",

        created_at: m.created_at,      group: "WORKFLOW",

        created_at: m.created_at,      name: "Integrations",

        created_at: m.created_at,      sub: "Xero · QuickBooks · Stripe · more",

        created_at: m.created_at,      icon: (

        created_at: m.created_at,        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">

        created_at: m.created_at,          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />

        created_at: m.created_at,        </svg>

        created_at: m.created_at,      ),

        created_at: m.created_at,      iconTint: "neutral",

        created_at: m.created_at,      status: integrationsConnected > 0 ? { text: `${integrationsConnected} connected`, color: "green" } : null,

        created_at: m.created_at,    },

        created_at: m.created_at,    {

        created_at: m.created_at,      id: "plan",

        created_at: m.created_at,      group: "ACCOUNT",

        created_at: m.created_at,      name: "Plan & billing",

        created_at: m.created_at,      sub: "Pro · unlimited · manage subscription",

        created_at: m.created_at,      icon: (

        created_at: m.created_at,        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">

        created_at: m.created_at,          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M21 12c0 1.66-4 3-9 3s-9-1.34-9-3m18 0V5c0-1.66-4-3-9-3S3 3.34 3 5v7m18 0v7c0 1.66-4 3-9 3s-9-1.34-9-3v-7" />

        created_at: m.created_at,        </svg>

        created_at: m.created_at,      ),

        created_at: m.created_at,      iconTint: "neutral",

        created_at: m.created_at,      status: { text: getTierConfig(planTier).badgeText, color: "amber" },

        created_at: m.created_at,    },

        created_at: m.created_at,    {

        created_at: m.created_at,      id: "help",

        created_at: m.created_at,      group: "ACCOUNT",

        created_at: m.created_at,      name: "Help & feedback",

        created_at: m.created_at,      sub: "Report a bug · suggest an idea · contact",

        created_at: m.created_at,      icon: (

        created_at: m.created_at,        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">

        created_at: m.created_at,          <circle cx="12" cy="12" r="9" />

        created_at: m.created_at,          <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01" />

        created_at: m.created_at,        </svg>

        created_at: m.created_at,      ),

        created_at: m.created_at,      iconTint: "neutral",

        created_at: m.created_at,    },

        created_at: m.created_at,    {

        created_at: m.created_at,      id: "diagnostics",

        created_at: m.created_at,      group: "ACCOUNT",

        created_at: m.created_at,      name: "Diagnostics",

        created_at: m.created_at,      sub: "Error reports · system health",

        created_at: m.created_at,      icon: (

        created_at: m.created_at,        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">

        created_at: m.created_at,          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17H7A5 5 0 017 7h2m6 10h2a5 5 0 000-10h-2m-7 5h10" />

        created_at: m.created_at,        </svg>

        created_at: m.created_at,      ),

        created_at: m.created_at,      iconTint: "neutral",

        created_at: m.created_at,    },

        created_at: m.created_at,    {

        created_at: m.created_at,      id: "recently-deleted",

        created_at: m.created_at,      group: "WORKFLOW",

        created_at: m.created_at,      name: "Recently deleted",

        created_at: m.created_at,      sub: "Restore items deleted in the last 14 days",

        created_at: m.created_at,      icon: (

        created_at: m.created_at,        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">

        created_at: m.created_at,          {/* Trash bin: lid + body + two vertical lines for the slats — same

        created_at: m.created_at,              visual language as the system trash on iOS/Android. Clearer

        created_at: m.created_at,              "this is the bin" read than the previous abstract clock-arrow. */}

        created_at: m.created_at,          <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6" />

        created_at: m.created_at,        </svg>

        created_at: m.created_at,      ),

        created_at: m.created_at,      iconTint: "amber",

        created_at: m.created_at,    },

        created_at: m.created_at,    // Admin views moved to the separate portal at admin.tradespa.co.uk —

        created_at: m.created_at,    // see the trade-pa-admin repo. Admins sign in there with the same

        created_at: m.created_at,    // credentials, gated server-side by admin_is_admin() RPC.

        created_at: m.created_at,  ];

        created_at: m.created_at,

        created_at: m.created_at,  // Tints for category icons (mockup uses several tones)

        created_at: m.created_at,  const TINTS = {

        created_at: m.created_at,    amber: { bg: `${C.amber}1f`, color: C.amber, border: `${C.amber}40` },

        created_at: m.created_at,    green: { bg: `${C.green}1f`, color: C.green, border: `${C.green}40` },

        created_at: m.created_at,    blue:  { bg: `${C.blue}1f`,  color: C.blue,  border: `${C.blue}40`  },

        created_at: m.created_at,    purple:{ bg: "rgba(167,139,250,0.18)", color: "#a78bfa", border: "rgba(167,139,250,0.3)" },

        created_at: m.created_at,    neutral:{ bg: C.surfaceHigh, color: C.textDim, border: C.border },

        created_at: m.created_at,  };

        created_at: m.created_at,

        created_at: m.created_at,  // Status pill colour map

        created_at: m.created_at,  const STATUS_COLOURS = {

        created_at: m.created_at,    green: C.green,

        created_at: m.created_at,    amber: C.amber,

        created_at: m.created_at,    red: C.red,

        created_at: m.created_at,    blue: C.blue,

        created_at: m.created_at,  };

        created_at: m.created_at,

        created_at: m.created_at,  // Filter categories by search query (matches name OR sub-line)

        created_at: m.created_at,  const q = searchQuery.toLowerCase();

        created_at: m.created_at,  const filteredCategories = q

        created_at: m.created_at,    ? CATEGORIES.filter(c => c.name.toLowerCase().includes(q) || c.sub.toLowerCase().includes(q))

        created_at: m.created_at,    : CATEGORIES;

        created_at: m.created_at,

        created_at: m.created_at,  // Group for landing-page rendering — preserves group order from CATEGORIES array

        created_at: m.created_at,  const groups = (() => {

        created_at: m.created_at,    const g = {};

        created_at: m.created_at,    const order = [];

        created_at: m.created_at,    for (const c of filteredCategories) {

        created_at: m.created_at,      if (!g[c.group]) { g[c.group] = []; order.push(c.group); }

        created_at: m.created_at,      g[c.group].push(c);

        created_at: m.created_at,    }

        created_at: m.created_at,    return order.map(name => ({ name, items: g[name] }));

        created_at: m.created_at,  })();

        created_at: m.created_at,

        created_at: m.created_at,  const activeCategory = subview ? CATEGORIES.find(c => c.id === subview) : null;

        created_at: m.created_at,

        created_at: m.created_at,  return (

        created_at: m.created_at,    <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "relative" }}>

        created_at: m.created_at,

        created_at: m.created_at,      {/* ─── LANDING PAGE ─────────────────────────────────────────────────── */}

        created_at: m.created_at,      {!subview && (

        created_at: m.created_at,        <>

        created_at: m.created_at,          {/* Page header */}

        created_at: m.created_at,          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>

        created_at: m.created_at,            <div style={{

        created_at: m.created_at,              fontFamily: "'DM Mono', monospace",

        created_at: m.created_at,              fontSize: 10,

        created_at: m.created_at,              textTransform: "uppercase",

        created_at: m.created_at,              letterSpacing: "0.14em",

        created_at: m.created_at,              color: C.amber,

        created_at: m.created_at,              fontWeight: 500,

        created_at: m.created_at,            }}>Settings</div>

        created_at: m.created_at,            <div style={{

        created_at: m.created_at,              fontFamily: "'DM Sans', sans-serif",

        created_at: m.created_at,              fontSize: 24,

        created_at: m.created_at,              fontWeight: 700,

        created_at: m.created_at,              letterSpacing: "-0.02em",

        created_at: m.created_at,              color: C.text,

        created_at: m.created_at,              lineHeight: 1.1,

        created_at: m.created_at,            }}>Settings</div>

        created_at: m.created_at,          </div>

        created_at: m.created_at,

        created_at: m.created_at,          {/* Search bar */}

        created_at: m.created_at,          <div style={{

        created_at: m.created_at,            background: C.surfaceHigh,

        created_at: m.created_at,            border: `1px solid ${C.border}`,

        created_at: m.created_at,            borderRadius: 12,

        created_at: m.created_at,            padding: "10px 12px",

        created_at: m.created_at,            display: "flex",

        created_at: m.created_at,            alignItems: "center",

        created_at: m.created_at,            gap: 8,

        created_at: m.created_at,          }}>

        created_at: m.created_at,            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>

        created_at: m.created_at,              <circle cx="11" cy="11" r="8" />

        created_at: m.created_at,              <path d="m21 21-4.35-4.35" />

        created_at: m.created_at,            </svg>

        created_at: m.created_at,            <input

        created_at: m.created_at,              placeholder="Search settings…"

        created_at: m.created_at,              value={searchQuery}

        created_at: m.created_at,              onChange={e => setSearchQuery(e.target.value)}

        created_at: m.created_at,              style={{

        created_at: m.created_at,                flex: 1,

        created_at: m.created_at,                background: "transparent",

        created_at: m.created_at,                border: "none",

        created_at: m.created_at,                outline: "none",

        created_at: m.created_at,                color: C.text,

        created_at: m.created_at,                fontSize: 16,

        created_at: m.created_at,                fontFamily: "'DM Sans', sans-serif",

        created_at: m.created_at,                minWidth: 0,

        created_at: m.created_at,              }}

        created_at: m.created_at,            />

        created_at: m.created_at,            {searchQuery && (

        created_at: m.created_at,              <button

        created_at: m.created_at,                onClick={() => setSearchQuery("")}

        created_at: m.created_at,                aria-label="Clear search"

        created_at: m.created_at,                style={{

        created_at: m.created_at,                  background: "transparent",

        created_at: m.created_at,                  border: "none",

        created_at: m.created_at,                  color: C.textDim,

        created_at: m.created_at,                  cursor: "pointer",

        created_at: m.created_at,                  padding: 4,

        created_at: m.created_at,                  display: "grid",

        created_at: m.created_at,                  placeItems: "center",

        created_at: m.created_at,                  

        created_at: m.created_at,                }}

        created_at: m.created_at,              ><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>

        created_at: m.created_at,            )}

        created_at: m.created_at,          </div>

        created_at: m.created_at,

        created_at: m.created_at,          {/* Category groups */}

        created_at: m.created_at,          {groups.length === 0 ? (

        created_at: m.created_at,            <div style={{

        created_at: m.created_at,              background: C.surface,

        created_at: m.created_at,              border: `1px solid ${C.border}`,

        created_at: m.created_at,              borderRadius: 14,

        created_at: m.created_at,              padding: 24,

        created_at: m.created_at,              textAlign: "center",

        created_at: m.created_at,              color: C.textDim,

        created_at: m.created_at,              fontSize: 14,

        created_at: m.created_at,            }}>No settings match "{searchQuery}".</div>

        created_at: m.created_at,          ) : (

        created_at: m.created_at,            groups.map(group => (

        created_at: m.created_at,              <div key={group.name} style={{ display: "flex", flexDirection: "column", gap: 6 }}>

        created_at: m.created_at,                <div style={{

        created_at: m.created_at,                  fontFamily: "'DM Mono', monospace",

        created_at: m.created_at,                  fontSize: 10,

        created_at: m.created_at,                  color: C.muted,

        created_at: m.created_at,                  letterSpacing: "0.14em",

        created_at: m.created_at,                  fontWeight: 700,

        created_at: m.created_at,                  paddingLeft: 4,

        created_at: m.created_at,                  marginBottom: 2,

        created_at: m.created_at,                }}>{group.name}</div>

        created_at: m.created_at,                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>

        created_at: m.created_at,                  {group.items.map(cat => {

        created_at: m.created_at,                    const tint = TINTS[cat.iconTint || "neutral"] || TINTS.neutral;

        created_at: m.created_at,                    const isFeatured = !!cat.featured;

        created_at: m.created_at,                    return (

        created_at: m.created_at,                      <div

        created_at: m.created_at,                        key={cat.id}

        created_at: m.created_at,                        onClick={() => setSubview(cat.id)}

        created_at: m.created_at,                        style={{

        created_at: m.created_at,                          background: isFeatured ? `linear-gradient(135deg, ${C.amber}10, ${C.amber}04)` : C.surfaceHigh,

        created_at: m.created_at,                          border: `1px solid ${isFeatured ? `${C.amber}40` : C.border}`,

        created_at: m.created_at,                          borderRadius: 14,

        created_at: m.created_at,                          padding: 12,

        created_at: m.created_at,                          cursor: "pointer",

        created_at: m.created_at,                          display: "grid",

        created_at: m.created_at,                          gridTemplateColumns: "40px 1fr auto",

        created_at: m.created_at,                          gap: 12,

        created_at: m.created_at,                          alignItems: "center",

        created_at: m.created_at,                          transition: "background 150ms ease",

        created_at: m.created_at,                        }}

        created_at: m.created_at,                      >

        created_at: m.created_at,                        {/* Icon */}

        created_at: m.created_at,                        <div style={{

        created_at: m.created_at,                          width: 40, height: 40,

        created_at: m.created_at,                          borderRadius: 10,

        created_at: m.created_at,                          background: tint.bg,

        created_at: m.created_at,                          border: `1px solid ${tint.border}`,

        created_at: m.created_at,                          color: tint.color,

        created_at: m.created_at,                          display: "grid",

        created_at: m.created_at,                          placeItems: "center",

        created_at: m.created_at,                          flexShrink: 0,

        created_at: m.created_at,                        }}>

        created_at: m.created_at,                          <div style={{ width: 20, height: 20 }}>{cat.icon}</div>

        created_at: m.created_at,                        </div>

        created_at: m.created_at,                        {/* Body */}

        created_at: m.created_at,                        <div style={{ minWidth: 0 }}>

        created_at: m.created_at,                          <div style={{

        created_at: m.created_at,                            fontFamily: "'DM Sans', sans-serif",

        created_at: m.created_at,                            fontSize: 14,

        created_at: m.created_at,                            fontWeight: 700,

        created_at: m.created_at,                            color: C.text,

        created_at: m.created_at,                            lineHeight: 1.2,

        created_at: m.created_at,                            marginBottom: 3,

        created_at: m.created_at,                            letterSpacing: "-0.01em",

        created_at: m.created_at,                          }}>{cat.name}</div>

        created_at: m.created_at,                          <div style={{

        created_at: m.created_at,                            fontSize: 11.5,

        created_at: m.created_at,                            color: C.textDim,

        created_at: m.created_at,                            lineHeight: 1.3,

        created_at: m.created_at,                            overflow: "hidden",

        created_at: m.created_at,                            textOverflow: "ellipsis",

        created_at: m.created_at,                            whiteSpace: "nowrap",

        created_at: m.created_at,                          }}>{cat.sub}</div>

        created_at: m.created_at,                        </div>

        created_at: m.created_at,                        {/* Right column */}

        created_at: m.created_at,                        <div style={{

        created_at: m.created_at,                          display: "flex",

        created_at: m.created_at,                          alignItems: "center",

        created_at: m.created_at,                          gap: 8,

        created_at: m.created_at,                          flexShrink: 0,

        created_at: m.created_at,                        }}>

        created_at: m.created_at,                          {cat.status && (

        created_at: m.created_at,                            <span style={{

        created_at: m.created_at,                              fontFamily: "'DM Mono', monospace",

        created_at: m.created_at,                              fontSize: 10,

        created_at: m.created_at,                              fontWeight: 700,

        created_at: m.created_at,                              letterSpacing: "0.06em",

        created_at: m.created_at,                              color: cat.status.color ? STATUS_COLOURS[cat.status.color] || C.textDim : C.textDim,

        created_at: m.created_at,                            }}>{cat.status.text}</span>

        created_at: m.created_at,                          )}

        created_at: m.created_at,                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">

        created_at: m.created_at,                            <path d="M9 5l7 7-7 7" />

        created_at: m.created_at,                          </svg>

        created_at: m.created_at,                        </div>

        created_at: m.created_at,                      </div>

        created_at: m.created_at,                    );

        created_at: m.created_at,                  })}

        created_at: m.created_at,                </div>

        created_at: m.created_at,              </div>

        created_at: m.created_at,            ))

        created_at: m.created_at,          )}

        created_at: m.created_at,

        created_at: m.created_at,          {/* Footer */}

        created_at: m.created_at,          <div style={{

        created_at: m.created_at,            marginTop: 18,

        created_at: m.created_at,            padding: "16px 4px 4px",

        created_at: m.created_at,            borderTop: `1px solid ${C.border}`,

        created_at: m.created_at,            display: "flex",

        created_at: m.created_at,            justifyContent: "space-between",

        created_at: m.created_at,            alignItems: "center",

        created_at: m.created_at,            gap: 12,

        created_at: m.created_at,          }}>

        created_at: m.created_at,            <div style={{

        created_at: m.created_at,              fontFamily: "'DM Mono', monospace",

        created_at: m.created_at,              fontSize: 10,

        created_at: m.created_at,              color: C.muted,

        created_at: m.created_at,              letterSpacing: "0.06em",

        created_at: m.created_at,              overflow: "hidden",

        created_at: m.created_at,              textOverflow: "ellipsis",

        created_at: m.created_at,              whiteSpace: "nowrap",

        created_at: m.created_at,              minWidth: 0,

        created_at: m.created_at,            }}>v1.8.2 · {brand?.email || user?.email || ""}</div>

        created_at: m.created_at,            <button

        created_at: m.created_at,              onClick={async () => {

        created_at: m.created_at,                if (!window.confirm("Sign out of Trade PA?")) return;

        created_at: m.created_at,                try { await db.auth.signOut(); window.location.reload(); }

        created_at: m.created_at,                catch (e) { alert("Sign out failed: " + e.message); }

        created_at: m.created_at,              }}

        created_at: m.created_at,              style={{

        created_at: m.created_at,                background: "transparent",

        created_at: m.created_at,                border: "none",

        created_at: m.created_at,                color: C.red,

        created_at: m.created_at,                fontFamily: "'DM Mono', monospace",

        created_at: m.created_at,                fontSize: 11,

        created_at: m.created_at,                fontWeight: 700,

        created_at: m.created_at,                letterSpacing: "0.06em",

        created_at: m.created_at,                textTransform: "uppercase",

        created_at: m.created_at,                cursor: "pointer",

        created_at: m.created_at,                padding: "6px 0",

        created_at: m.created_at,                flexShrink: 0,

        created_at: m.created_at,              }}

        created_at: m.created_at,            >Sign out</button>

        created_at: m.created_at,          </div>

        created_at: m.created_at,        </>

        created_at: m.created_at,      )}

        created_at: m.created_at,

        created_at: m.created_at,      {/* ─── DRILL-IN: app bar + intro hero, then existing content ────────── */}

        created_at: m.created_at,      {subview && (

        created_at: m.created_at,        <>

        created_at: m.created_at,          {/* App bar */}

        created_at: m.created_at,          <div style={{

        created_at: m.created_at,            display: "flex",

        created_at: m.created_at,            alignItems: "center",

        created_at: m.created_at,            justifyContent: "space-between",

        created_at: m.created_at,            padding: "4px 0 8px",

        created_at: m.created_at,            marginBottom: 4,

        created_at: m.created_at,          }}>

        created_at: m.created_at,            <button

        created_at: m.created_at,              onClick={() => setSubview(null)}

        created_at: m.created_at,              aria-label="Back to settings"

        created_at: m.created_at,              style={{

        created_at: m.created_at,                background: "transparent",

        created_at: m.created_at,                border: "none",

        created_at: m.created_at,                color: C.text,

        created_at: m.created_at,                cursor: "pointer",

        created_at: m.created_at,                padding: 6,

        created_at: m.created_at,                display: "grid",

        created_at: m.created_at,                placeItems: "center",

        created_at: m.created_at,              }}

        created_at: m.created_at,            >

        created_at: m.created_at,              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">

        created_at: m.created_at,                <path d="M15 19l-7-7 7-7" />

        created_at: m.created_at,              </svg>

        created_at: m.created_at,            </button>

        created_at: m.created_at,            <div style={{

        created_at: m.created_at,              fontFamily: "'DM Mono', monospace",

        created_at: m.created_at,              fontSize: 10,

        created_at: m.created_at,              color: C.muted,

        created_at: m.created_at,              letterSpacing: "0.14em",

        created_at: m.created_at,              textTransform: "uppercase",

        created_at: m.created_at,              fontWeight: 600,

        created_at: m.created_at,            }}>SETTINGS / {(activeCategory?.name || "").toUpperCase()}</div>

        created_at: m.created_at,            <div style={{ width: 32 }} />

        created_at: m.created_at,          </div>

        created_at: m.created_at,

        created_at: m.created_at,          {/* Intro hero */}

        created_at: m.created_at,          {activeCategory && (() => {

        created_at: m.created_at,            const tint = TINTS[activeCategory.iconTint || "neutral"] || TINTS.neutral;

        created_at: m.created_at,            return (

        created_at: m.created_at,              <div style={{

        created_at: m.created_at,                background: `linear-gradient(135deg, ${tint.bg}, transparent)`,

        created_at: m.created_at,                border: `1px solid ${tint.border}`,

        created_at: m.created_at,                borderRadius: 14,

        created_at: m.created_at,                padding: 16,

        created_at: m.created_at,                display: "flex",

        created_at: m.created_at,                gap: 14,

        created_at: m.created_at,                alignItems: "center",

        created_at: m.created_at,                marginBottom: 6,

        created_at: m.created_at,              }}>

        created_at: m.created_at,                <div style={{

        created_at: m.created_at,                  width: 44, height: 44,

        created_at: m.created_at,                  borderRadius: 12,

        created_at: m.created_at,                  background: tint.bg,

        created_at: m.created_at,                  border: `1px solid ${tint.border}`,

        created_at: m.created_at,                  color: tint.color,

        created_at: m.created_at,                  display: "grid",

        created_at: m.created_at,                  placeItems: "center",

        created_at: m.created_at,                  flexShrink: 0,

        created_at: m.created_at,                }}>

        created_at: m.created_at,                  <div style={{ width: 22, height: 22 }}>{activeCategory.icon}</div>

        created_at: m.created_at,                </div>

        created_at: m.created_at,                <div style={{ flex: 1, minWidth: 0 }}>

        created_at: m.created_at,                  <div style={{

        created_at: m.created_at,                    fontFamily: "'DM Sans', sans-serif",

        created_at: m.created_at,                    fontSize: 16,

        created_at: m.created_at,                    fontWeight: 700,

        created_at: m.created_at,                    color: C.text,

        created_at: m.created_at,                    letterSpacing: "-0.01em",

        created_at: m.created_at,                    lineHeight: 1.15,

        created_at: m.created_at,                    marginBottom: 3,

        created_at: m.created_at,                  }}>{activeCategory.name}</div>

        created_at: m.created_at,                  <div style={{

        created_at: m.created_at,                    fontSize: 12,

        created_at: m.created_at,                    color: C.textDim,

        created_at: m.created_at,                    lineHeight: 1.4,

        created_at: m.created_at,                  }}>{activeCategory.sub}</div>

        created_at: m.created_at,                </div>

        created_at: m.created_at,              </div>

        created_at: m.created_at,            );

        created_at: m.created_at,          })()}

        created_at: m.created_at,        </>

        created_at: m.created_at,      )}

        created_at: m.created_at,

        created_at: m.created_at,      {/* ─── DRILL-IN CONTENT — each section conditionally renders by subview ─── */}

        created_at: m.created_at,      {subview && (<>

        created_at: m.created_at,

        created_at: m.created_at,      {subview === "branding" && (<>

        created_at: m.created_at,      {/* Preview Invoice quick action — moved here from the old Save Changes bar */}

        created_at: m.created_at,      <button

        created_at: m.created_at,        onClick={() => setPreview(true)}

        created_at: m.created_at,        style={{

        created_at: m.created_at,          background: C.surfaceHigh,

        created_at: m.created_at,          border: `1px solid ${C.border}`,

        created_at: m.created_at,          borderRadius: 10,

        created_at: m.created_at,          padding: "12px 14px",

        created_at: m.created_at,          display: "flex",

        created_at: m.created_at,          alignItems: "center",

        created_at: m.created_at,          justifyContent: "space-between",

        created_at: m.created_at,          gap: 12,

        created_at: m.created_at,          cursor: "pointer",

        created_at: m.created_at,          width: "100%",

        created_at: m.created_at,          color: C.text,

        created_at: m.created_at,          fontFamily: "'DM Sans', sans-serif",

        created_at: m.created_at,          marginBottom: 2,

        created_at: m.created_at,        }}

        created_at: m.created_at,      >

        created_at: m.created_at,        <div style={{ textAlign: "left" }}>

        created_at: m.created_at,          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em" }}>Preview an invoice</div>

        created_at: m.created_at,          <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>See how your branding looks on a real invoice</div>

        created_at: m.created_at,        </div>

        created_at: m.created_at,        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">

        created_at: m.created_at,          <path d="M9 5l7 7-7 7" />

        created_at: m.created_at,        </svg>

        created_at: m.created_at,      </button>

        created_at: m.created_at,      <div style={S.grid2}>

        created_at: m.created_at,        {/* Logo upload */}

        created_at: m.created_at,        <div style={S.card}>

        created_at: m.created_at,          <div style={S.sectionTitle}>Logo</div>

        created_at: m.created_at,          <div

        created_at: m.created_at,            onClick={() => logoRef.current.click()}

        created_at: m.created_at,            style={{ border: `2px dashed ${brand.logo ? C.green : C.border}`, borderRadius: 10, padding: 24, textAlign: "center", cursor: "pointer", transition: "all 0.2s", background: brand.logo ? C.green + "08" : "transparent" }}

        created_at: m.created_at,          >

        created_at: m.created_at,            {brand.logo

        created_at: m.created_at,              ? <img src={brand.logo} alt="logo" style={{ maxHeight: 80, maxWidth: 200, objectFit: "contain", margin: "0 auto 10px", display: "block" }} />

        created_at: m.created_at,              : <div style={{ fontSize: 32, marginBottom: 8 }}>🖼</div>}

        created_at: m.created_at,            <div style={{ fontSize: 12, color: brand.logo ? C.green : C.muted }}>{brand.logo ? "Click to change logo" : "Click to upload logo"}</div>

        created_at: m.created_at,            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>PNG or JPG, max 2MB. Transparent PNG works best.</div>

        created_at: m.created_at,            <input ref={logoRef} type="file" accept="image/*" onChange={handleLogo} style={{ display: "none" }} />

        created_at: m.created_at,          </div>

        created_at: m.created_at,          {brand.logo && (

        created_at: m.created_at,            <button style={{ ...S.btn("ghost"), marginTop: 10, fontSize: 11 }} onClick={() => setBrand(b => ({ ...b, logo: null }))}>Remove logo</button>

        created_at: m.created_at,          )}

        created_at: m.created_at,        </div>

        created_at: m.created_at,

        created_at: m.created_at,        {/* Accent colour */}

        created_at: m.created_at,        <div style={S.card}>

        created_at: m.created_at,          <div style={S.sectionTitle}>Brand Colour</div>

        created_at: m.created_at,          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>

        created_at: m.created_at,            {ACCENT_PRESETS.map(col => (

        created_at: m.created_at,              <div key={col} onClick={() => setBrand(b => ({ ...b, accentColor: col }))} style={{ width: 36, height: 36, borderRadius: 8, background: col, cursor: "pointer", border: `3px solid ${brand.accentColor === col ? "#fff" : "transparent"}`, transition: "all 0.15s", boxShadow: brand.accentColor === col ? `0 0 0 1px ${col}` : "none" }} />

        created_at: m.created_at,            ))}

        created_at: m.created_at,          </div>

        created_at: m.created_at,          <label style={S.label}>Custom Colour</label>

        created_at: m.created_at,          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>

        created_at: m.created_at,            <input type="color" value={brand.accentColor} onChange={e => setBrand(b => ({ ...b, accentColor: e.target.value }))} style={{ width: 44, height: 36, borderRadius: 8, border: `1px solid ${C.border}`, background: "none", cursor: "pointer", padding: 2 }} />

        created_at: m.created_at,            <input style={{ ...S.input, flex: 1 }} value={brand.accentColor} onChange={set("accentColor")} placeholder="#f59e0b" />

        created_at: m.created_at,          </div>

        created_at: m.created_at,          <div style={{ marginTop: 16 }}>

        created_at: m.created_at,            <div style={S.sectionTitle}>Preview</div>

        created_at: m.created_at,            <div style={{ height: 6, borderRadius: 3, background: brand.accentColor, marginBottom: 8 }} />

        created_at: m.created_at,            <div style={{ display: "flex", gap: 8 }}>

        created_at: m.created_at,              <div style={{ padding: "6px 14px", borderRadius: 10, background: brand.accentColor, color: "#fff", fontSize: 12, fontWeight: 700 }}>Button</div>

        created_at: m.created_at,              <div style={{ padding: "6px 14px", borderRadius: 10, background: brand.accentColor + "22", border: `1px solid ${brand.accentColor}`, color: brand.accentColor, fontSize: 12, fontWeight: 700 }}>Badge</div>

        created_at: m.created_at,            </div>

        created_at: m.created_at,          </div>

        created_at: m.created_at,        </div>

        created_at: m.created_at,      </div>

        created_at: m.created_at,      </>)}

        created_at: m.created_at,

        created_at: m.created_at,      {subview === "plan" && (<>

        created_at: m.created_at,      {/* Plan hero — big, clear at-a-glance status. Reads all presentation

        created_at: m.created_at,          details from TIER_CONFIG so a tier added/renamed upstream flows

        created_at: m.created_at,          through without editing this block. */}

        created_at: m.created_at,      {(() => {

        created_at: m.created_at,        const tierCfg = getTierConfig(planTier);

        created_at: m.created_at,        // Map the tier's colorKey to the actual colour token for this theme.

        created_at: m.created_at,        const tierColour = tierCfg.colorKey === "blue" ? C.blue

        created_at: m.created_at,                        : tierCfg.colorKey === "green" ? C.green

        created_at: m.created_at,                        : tierCfg.colorKey === "muted" ? C.muted

        created_at: m.created_at,                        : C.amber;

        created_at: m.created_at,        return (

        created_at: m.created_at,      <div style={{

        created_at: m.created_at,        background: `linear-gradient(135deg, ${tierColour}14, transparent)`,

        created_at: m.created_at,        border: `1px solid ${tierColour}40`,

        created_at: m.created_at,        borderRadius: 14,

        created_at: m.created_at,        padding: 18,

        created_at: m.created_at,        display: "flex",

        created_at: m.created_at,        flexDirection: "column",

        created_at: m.created_at,        gap: 12,

        created_at: m.created_at,      }}>

        created_at: m.created_at,        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>

        created_at: m.created_at,          <div style={{ minWidth: 0 }}>

        created_at: m.created_at,            <div style={{

        created_at: m.created_at,              fontFamily: "'DM Mono', monospace",

        created_at: m.created_at,              fontSize: 10,

        created_at: m.created_at,              color: C.muted,

        created_at: m.created_at,              letterSpacing: "0.12em",

        created_at: m.created_at,              fontWeight: 700,

        created_at: m.created_at,              marginBottom: 4,

        created_at: m.created_at,            }}>CURRENT PLAN</div>

        created_at: m.created_at,            <div style={{

        created_at: m.created_at,              fontFamily: "'DM Sans', sans-serif",

        created_at: m.created_at,              fontSize: 22,

        created_at: m.created_at,              fontWeight: 700,

        created_at: m.created_at,              letterSpacing: "-0.02em",

        created_at: m.created_at,              color: C.text,

        created_at: m.created_at,              lineHeight: 1.1,

        created_at: m.created_at,            }}>Trade PA {tierCfg.label}</div>

        created_at: m.created_at,            <div style={{ fontSize: 12, color: C.textDim, marginTop: 3 }}>

        created_at: m.created_at,              {tierCfg.priceDisplay}

        created_at: m.created_at,            </div>

        created_at: m.created_at,          </div>

        created_at: m.created_at,          <span style={{

        created_at: m.created_at,            fontFamily: "'DM Mono', monospace",

        created_at: m.created_at,            fontSize: 11,

        created_at: m.created_at,            fontWeight: 700,

        created_at: m.created_at,            letterSpacing: "0.1em",

        created_at: m.created_at,            color: tierColour,

        created_at: m.created_at,            background: `${tierColour}1a`,

        created_at: m.created_at,            border: `1px solid ${tierColour}40`,

        created_at: m.created_at,            padding: "4px 10px",

        created_at: m.created_at,            borderRadius: 10,

        created_at: m.created_at,            flexShrink: 0,

        created_at: m.created_at,          }}>{tierCfg.badgeText}</span>

        created_at: m.created_at,        </div>

        created_at: m.created_at,      </div>

        created_at: m.created_at,        );

        created_at: m.created_at,      })()}

        created_at: m.created_at,

        created_at: m.created_at,      {/* Upgrade CTA row — only shown for plans below Business. */}

        created_at: m.created_at,      {planTier !== "business" && (

        created_at: m.created_at,        <a

        created_at: m.created_at,          href="mailto:hello@tradespa.co.uk?subject=Trade%20PA%20upgrade%20request"

        created_at: m.created_at,          style={{

        created_at: m.created_at,            background: C.surfaceHigh,

        created_at: m.created_at,            border: `1px solid ${C.border}`,

        created_at: m.created_at,            borderRadius: 12,

        created_at: m.created_at,            padding: "12px 14px",

        created_at: m.created_at,            display: "flex",

        created_at: m.created_at,            alignItems: "center",

        created_at: m.created_at,            justifyContent: "space-between",

        created_at: m.created_at,            gap: 12,

        created_at: m.created_at,            textDecoration: "none",

        created_at: m.created_at,            color: C.text,

        created_at: m.created_at,          }}

        created_at: m.created_at,        >

        created_at: m.created_at,          <div style={{ minWidth: 0 }}>

        created_at: m.created_at,            <div style={{

        created_at: m.created_at,              fontFamily: "'DM Sans', sans-serif",

        created_at: m.created_at,              fontSize: 14,

        created_at: m.created_at,              fontWeight: 700,

        created_at: m.created_at,              letterSpacing: "-0.01em",

        created_at: m.created_at,              color: C.amber,

        created_at: m.created_at,            }}>Upgrade plan →</div>

        created_at: m.created_at,            <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 2 }}>

        created_at: m.created_at,              {(() => {

        created_at: m.created_at,                // Suggest the next tier up from the user's current one.

        created_at: m.created_at,                // Business is the ceiling — this block doesn't render above.

        created_at: m.created_at,                if (planTier === "solo") return "Pro Solo (£59/mo · 2× capacity), Team (£89/mo · 5 users) or Business (£129/mo · 10 users)";

        created_at: m.created_at,                if (planTier === "pro_solo") return "Team (£89/mo · 5 users) or Business (£129/mo · 10 users)";

        created_at: m.created_at,                if (planTier === "team") return "Business — £129/mo · up to 10 users";

        created_at: m.created_at,                return "Business — £129/mo · up to 10 users";

        created_at: m.created_at,              })()}

        created_at: m.created_at,            </div>

        created_at: m.created_at,          </div>

        created_at: m.created_at,          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">

        created_at: m.created_at,            <path d="M9 5l7 7-7 7" />

        created_at: m.created_at,          </svg>

        created_at: m.created_at,        </a>

        created_at: m.created_at,      )}

        created_at: m.created_at,

        created_at: m.created_at,      {/* Manage subscription — Stripe Customer Portal */}

        created_at: m.created_at,      {/* On iOS native builds (Capacitor), hide the portal button and */}

        created_at: m.created_at,      {/* direct users to the web — Apple requires IAP for in-app sub */}

        created_at: m.created_at,      {/* management. Web PWA + Android are fine. */}

        created_at: m.created_at,      {(() => {

        created_at: m.created_at,        const isIOSNative = typeof window !== "undefined"

        created_at: m.created_at,          && window.Capacitor?.isNativePlatform?.()

        created_at: m.created_at,          && window.Capacitor?.getPlatform?.() === "ios";

        created_at: m.created_at,

        created_at: m.created_at,        const openPortal = async () => {

        created_at: m.created_at,          try {

        created_at: m.created_at,            const { data: { session } } = await window._supabase.auth.getSession();

        created_at: m.created_at,            const token = session?.access_token;

        created_at: m.created_at,            if (!token) {

        created_at: m.created_at,              alert("Please log in again to manage your subscription.");

        created_at: m.created_at,              return;

        created_at: m.created_at,            }

        created_at: m.created_at,            const res = await fetch("/api/stripe/portal", {

        created_at: m.created_at,              method: "POST",

        created_at: m.created_at,              headers: {

        created_at: m.created_at,                "Authorization": `Bearer ${token}`,

        created_at: m.created_at,                "Content-Type": "application/json",

        created_at: m.created_at,              },

        created_at: m.created_at,            });

        created_at: m.created_at,            const data = await res.json();

        created_at: m.created_at,            if (!res.ok) {

        created_at: m.created_at,              alert(data.message || data.error || "Couldn't open billing portal.");

        created_at: m.created_at,              return;

        created_at: m.created_at,            }

        created_at: m.created_at,            window.location.href = data.url;

        created_at: m.created_at,          } catch (err) {

        created_at: m.created_at,            console.error("[stripe-portal]", err);

        created_at: m.created_at,            alert("Couldn't open billing portal. Please try again or email hello@tradespa.co.uk");

        created_at: m.created_at,          }

        created_at: m.created_at,        };

        created_at: m.created_at,

        created_at: m.created_at,        return (

        created_at: m.created_at,          <div style={{

        created_at: m.created_at,            background: C.surfaceHigh,

        created_at: m.created_at,            border: `1px solid ${C.border}`,

        created_at: m.created_at,            borderRadius: 12,

        created_at: m.created_at,            padding: "12px 14px",

        created_at: m.created_at,            display: "flex",

        created_at: m.created_at,            alignItems: "center",

        created_at: m.created_at,            justifyContent: "space-between",

        created_at: m.created_at,            gap: 12,

        created_at: m.created_at,          }}>

        created_at: m.created_at,            <div style={{ minWidth: 0 }}>

        created_at: m.created_at,              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>

        created_at: m.created_at,                Manage subscription

        created_at: m.created_at,              </div>

        created_at: m.created_at,              <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 2 }}>

        created_at: m.created_at,                {isIOSNative

        created_at: m.created_at,                  ? "Update payment, invoices, cancellation on the web"

        created_at: m.created_at,                  : "Update payment, download invoices, cancel or switch plan"}

        created_at: m.created_at,              </div>

        created_at: m.created_at,            </div>

        created_at: m.created_at,            {isIOSNative ? (

        created_at: m.created_at,              <a

        created_at: m.created_at,                href="https://www.tradespa.co.uk"

        created_at: m.created_at,                target="_blank"

        created_at: m.created_at,                rel="noopener noreferrer"

        created_at: m.created_at,                style={{

        created_at: m.created_at,                  fontFamily: "'DM Mono', monospace",

        created_at: m.created_at,                  fontSize: 10,

        created_at: m.created_at,                  color: C.amber,

        created_at: m.created_at,                  letterSpacing: "0.08em",

        created_at: m.created_at,                  fontWeight: 700,

        created_at: m.created_at,                  textDecoration: "none",

        created_at: m.created_at,                  textTransform: "uppercase",

        created_at: m.created_at,                  flexShrink: 0,

        created_at: m.created_at,                }}

        created_at: m.created_at,              >

        created_at: m.created_at,                Open web →

        created_at: m.created_at,              </a>

        created_at: m.created_at,            ) : (

        created_at: m.created_at,              <button

        created_at: m.created_at,                onClick={openPortal}

        created_at: m.created_at,                style={{

        created_at: m.created_at,                  fontFamily: "'DM Mono', monospace",

        created_at: m.created_at,                  fontSize: 10,

        created_at: m.created_at,                  color: C.amber,

        created_at: m.created_at,                  letterSpacing: "0.08em",

        created_at: m.created_at,                  fontWeight: 700,

        created_at: m.created_at,                  textTransform: "uppercase",

        created_at: m.created_at,                  background: "transparent",

        created_at: m.created_at,                  border: `1px solid ${C.amber}`,

        created_at: m.created_at,                  borderRadius: 6,

        created_at: m.created_at,                  padding: "6px 12px",

        created_at: m.created_at,                  cursor: "pointer",

        created_at: m.created_at,                  flexShrink: 0,

        created_at: m.created_at,                }}

        created_at: m.created_at,              >

        created_at: m.created_at,                Manage →

        created_at: m.created_at,              </button>

        created_at: m.created_at,            )}

        created_at: m.created_at,          </div>

        created_at: m.created_at,        );

        created_at: m.created_at,      })()}

        created_at: m.created_at,

        created_at: m.created_at,      {/* ── Monthly Usage (moved from AI Assistant subview) ─────────────── */}

        created_at: m.created_at,      <div style={S.card}>

        created_at: m.created_at,        <div style={S.sectionTitle}>Monthly Usage</div>

        created_at: m.created_at,        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>

        created_at: m.created_at,          Your allowance resets on the 1st of each month.

        created_at: m.created_at,        </div>

        created_at: m.created_at,        {(() => {

        created_at: m.created_at,          const convUsed = usageData?.conversations_used || 0;

        created_at: m.created_at,          const convCap = usageCaps?.convos || 100;

        created_at: m.created_at,          const convUnlimited = convCap === Infinity;

        created_at: m.created_at,          const convPct = convUnlimited ? 0 : Math.min(1, convUsed / convCap);

        created_at: m.created_at,          const hfUsed = Math.round((usageData?.handsfree_seconds_used || 0) / 60);

        created_at: m.created_at,          const hfCap = usageCaps?.hf_hours === Infinity ? Infinity : (usageCaps?.hf_hours || 1) * 60;

        created_at: m.created_at,          const hfUnlimited = hfCap === Infinity;

        created_at: m.created_at,          const hfPct = hfUnlimited ? 0 : Math.min(1, hfUsed / hfCap);

        created_at: m.created_at,          const barStyle = () => ({

        created_at: m.created_at,            height: 8, borderRadius: 4, background: C.surfaceHigh, overflow: "hidden", marginTop: 6, marginBottom: 14,

        created_at: m.created_at,          });

        created_at: m.created_at,          const fillStyle = (pct) => ({

        created_at: m.created_at,            height: "100%", borderRadius: 4, width: (pct * 100) + "%",

        created_at: m.created_at,            background: pct >= 1 ? "#ef4444" : pct >= 0.8 ? C.amber : C.green,

        created_at: m.created_at,            transition: "width 0.3s ease",

        created_at: m.created_at,          });

        created_at: m.created_at,          const unlimitedPill = (

        created_at: m.created_at,            <span style={{

        created_at: m.created_at,              fontFamily: "'DM Mono', monospace",

        created_at: m.created_at,              fontSize: 10,

        created_at: m.created_at,              fontWeight: 700,

        created_at: m.created_at,              letterSpacing: "0.1em",

        created_at: m.created_at,              color: C.green,

        created_at: m.created_at,              background: `${C.green}1a`,

        created_at: m.created_at,              border: `1px solid ${C.green}40`,

        created_at: m.created_at,              padding: "3px 8px",

        created_at: m.created_at,              borderRadius: 4,

        created_at: m.created_at,            }}>UNLIMITED</span>

        created_at: m.created_at,          );

        created_at: m.created_at,          const renderRow = (label, usedText, unlimited, pct) => (

        created_at: m.created_at,            <>

        created_at: m.created_at,              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, marginBottom: unlimited ? 14 : 0 }}>

        created_at: m.created_at,                <span style={{ color: C.text, fontWeight: 600 }}>{label}</span>

        created_at: m.created_at,                {unlimited ? unlimitedPill : (

        created_at: m.created_at,                  <span style={{ color: pct >= 0.8 ? C.amber : C.muted, fontFamily: "'DM Mono',monospace" }}>

        created_at: m.created_at,                    {usedText}

        created_at: m.created_at,                  </span>

        created_at: m.created_at,                )}

        created_at: m.created_at,              </div>

        created_at: m.created_at,              {!unlimited && <div style={barStyle()}><div style={fillStyle(pct)} /></div>}

        created_at: m.created_at,            </>

        created_at: m.created_at,          );

        created_at: m.created_at,          return (<>

        created_at: m.created_at,            {renderRow("AI Conversations", `${convUsed} / ${convCap}`, convUnlimited, convPct)}

        created_at: m.created_at,            {renderRow("Hands-free time",  `${hfUsed} / ${hfCap} min`, hfUnlimited,   hfPct)}

        created_at: m.created_at,            <div style={{

        created_at: m.created_at,              fontFamily: "'DM Mono', monospace",

        created_at: m.created_at,              fontSize: 10,

        created_at: m.created_at,              color: C.muted,

        created_at: m.created_at,              letterSpacing: "0.1em",

        created_at: m.created_at,              textAlign: "center",

        created_at: m.created_at,              paddingTop: 10,

        created_at: m.created_at,              borderTop: `1px solid ${C.border}`,

        created_at: m.created_at,              fontWeight: 600,

        created_at: m.created_at,            }}>

        created_at: m.created_at,              {getTierConfig(planTier).badgeText} PLAN · RESETS 1ST OF EACH MONTH

        created_at: m.created_at,            </div>

        created_at: m.created_at,          </>);

        created_at: m.created_at,        })()}

        created_at: m.created_at,      </div>

        created_at: m.created_at,

        created_at: m.created_at,      {/* ── Add-ons (iOS Level B: neutral link, no prices/no "buy") ─────── */}

        created_at: m.created_at,      {(() => {

        created_at: m.created_at,        const isIOSNative = typeof window !== "undefined"

        created_at: m.created_at,          && window.Capacitor?.isNativePlatform?.()

        created_at: m.created_at,          && window.Capacitor?.getPlatform?.() === "ios";

        created_at: m.created_at,

        created_at: m.created_at,        if (isIOSNative) {

        created_at: m.created_at,          return (

        created_at: m.created_at,            <div style={S.card}>

        created_at: m.created_at,              <div style={S.sectionTitle}>Running low?</div>

        created_at: m.created_at,              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>

        created_at: m.created_at,                Manage your plan on the web at{" "}

        created_at: m.created_at,                <a href="https://www.tradespa.co.uk" target="_blank" rel="noopener noreferrer" style={{ color: C.amber, textDecoration: "none", fontWeight: 600 }}>

        created_at: m.created_at,                  tradespa.co.uk

        created_at: m.created_at,                </a>.

        created_at: m.created_at,              </div>

        created_at: m.created_at,            </div>

        created_at: m.created_at,          );

        created_at: m.created_at,        }

        created_at: m.created_at,

        created_at: m.created_at,        const items = [

        created_at: m.created_at,          { key: "conversations", label: "+200 conversations",         price: "£39 one-off",            highlight: false },

        created_at: m.created_at,          { key: "handsfree",     label: "+2 hours hands-free",        price: "£19 one-off",            highlight: false },

        created_at: m.created_at,          { key: "combo",         label: "+200 conv & +2h hands-free", price: "£55 one-off · save £3",  highlight: true  },

        created_at: m.created_at,        ];

        created_at: m.created_at,

        created_at: m.created_at,        return (

        created_at: m.created_at,          <div style={S.card}>

        created_at: m.created_at,            <div style={S.sectionTitle}>Add-ons</div>

        created_at: m.created_at,            <div style={{ fontSize: 12, color: C.muted, marginBottom: 14, lineHeight: 1.6 }}>

        created_at: m.created_at,              Top up this month's allowance. Charged to your saved card, expires end of month.

        created_at: m.created_at,            </div>

        created_at: m.created_at,            {addonResult && (

        created_at: m.created_at,              <div style={{

        created_at: m.created_at,                marginBottom: 12,

        created_at: m.created_at,                padding: "10px 12px",

        created_at: m.created_at,                borderRadius: 6,

        created_at: m.created_at,                fontSize: 12,

        created_at: m.created_at,                lineHeight: 1.5,

        created_at: m.created_at,                background: addonResult.type === "success" ? `${C.green}1a` : `${C.red}1a`,

        created_at: m.created_at,                border: `1px solid ${addonResult.type === "success" ? `${C.green}40` : `${C.red}40`}`,

        created_at: m.created_at,                color: addonResult.type === "success" ? C.green : C.red,

        created_at: m.created_at,              }}>

        created_at: m.created_at,                {addonResult.type === "success"

        created_at: m.created_at,                  ? `✓ ${addonResult.displayName || "Add-on"} — ${addonResult.message}`

        created_at: m.created_at,                  : `✕ ${addonResult.message}`}

        created_at: m.created_at,              </div>

        created_at: m.created_at,            )}

        created_at: m.created_at,            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

        created_at: m.created_at,              {items.map(item => (

        created_at: m.created_at,                <div key={item.key} style={{

        created_at: m.created_at,                  display: "flex",

        created_at: m.created_at,                  justifyContent: "space-between",

        created_at: m.created_at,                  alignItems: "center",

        created_at: m.created_at,                  padding: "11px 12px",

        created_at: m.created_at,                  background: C.surfaceHigh,

        created_at: m.created_at,                  borderRadius: 6,

        created_at: m.created_at,                  border: item.highlight ? `1px solid ${C.amber}40` : `1px solid transparent`,

        created_at: m.created_at,                }}>

        created_at: m.created_at,                  <div style={{ minWidth: 0 }}>

        created_at: m.created_at,                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{item.label}</div>

        created_at: m.created_at,                    <div style={{ fontSize: 11, color: C.muted, fontFamily: "'DM Mono',monospace", marginTop: 2 }}>{item.price}</div>

        created_at: m.created_at,                  </div>

        created_at: m.created_at,                  <button

        created_at: m.created_at,                    onClick={() => setAddonConfirm(item.key)}

        created_at: m.created_at,                    disabled={addonBusy}

        created_at: m.created_at,                    style={{

        created_at: m.created_at,                      padding: "6px 12px",

        created_at: m.created_at,                      border: `1px solid ${C.amber}`,

        created_at: m.created_at,                      background: item.highlight ? C.amber : "transparent",

        created_at: m.created_at,                      color: item.highlight ? "#412402" : C.amber,

        created_at: m.created_at,                      fontSize: 10,

        created_at: m.created_at,                      fontFamily: "'DM Mono', monospace",

        created_at: m.created_at,                      letterSpacing: "0.08em",

        created_at: m.created_at,                      textTransform: "uppercase",

        created_at: m.created_at,                      fontWeight: 700,

        created_at: m.created_at,                      borderRadius: 4,

        created_at: m.created_at,                      cursor: addonBusy ? "not-allowed" : "pointer",

        created_at: m.created_at,                      opacity: addonBusy ? 0.5 : 1,

        created_at: m.created_at,                      flexShrink: 0,

        created_at: m.created_at,                    }}

        created_at: m.created_at,                  >Buy →</button>

        created_at: m.created_at,                </div>

        created_at: m.created_at,              ))}

        created_at: m.created_at,            </div>

        created_at: m.created_at,          </div>

        created_at: m.created_at,        );

        created_at: m.created_at,      })()}

        created_at: m.created_at,

        created_at: m.created_at,      {/* ── Confirmation modal (custom styled) ─────────────────────────── */}

        created_at: m.created_at,      {addonConfirm && ADDON_DISPLAY[addonConfirm] && (

        created_at: m.created_at,        <div

        created_at: m.created_at,          onClick={() => !addonBusy && setAddonConfirm(null)}

        created_at: m.created_at,          style={{

        created_at: m.created_at,            position: "fixed",

        created_at: m.created_at,            top: 0, left: 0, right: 0, bottom: 0,

        created_at: m.created_at,            background: "rgba(0,0,0,0.6)",

        created_at: m.created_at,            display: "flex",

        created_at: m.created_at,            alignItems: "center",

        created_at: m.created_at,            justifyContent: "center",

        created_at: m.created_at,            zIndex: 9999,

        created_at: m.created_at,            padding: 16,

        created_at: m.created_at,          }}

        created_at: m.created_at,        >

        created_at: m.created_at,          <div

        created_at: m.created_at,            onClick={(e) => e.stopPropagation()}

        created_at: m.created_at,            style={{

        created_at: m.created_at,              background: C.surface,

        created_at: m.created_at,              border: `1px solid ${C.border}`,

        created_at: m.created_at,              borderRadius: 12,

        created_at: m.created_at,              padding: "20px 20px 18px",

        created_at: m.created_at,              width: "100%",

        created_at: m.created_at,              maxWidth: 340,

        created_at: m.created_at,            }}

        created_at: m.created_at,          >

        created_at: m.created_at,            <div style={{

        created_at: m.created_at,              fontSize: 10,

        created_at: m.created_at,              color: C.textDim,

        created_at: m.created_at,              letterSpacing: "0.1em",

        created_at: m.created_at,              textTransform: "uppercase",

        created_at: m.created_at,              fontFamily: "'DM Mono', monospace",

        created_at: m.created_at,              marginBottom: 10,

        created_at: m.created_at,            }}>Confirm add-on</div>

        created_at: m.created_at,            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>

        created_at: m.created_at,              {ADDON_DISPLAY[addonConfirm].title}

        created_at: m.created_at,            </div>

        created_at: m.created_at,            <div style={{ fontSize: 13, color: C.textDim, margin: "6px 0 16px", lineHeight: 1.55 }}>

        created_at: m.created_at,              We'll charge{" "}

        created_at: m.created_at,              <span style={{ color: C.amber, fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>

        created_at: m.created_at,                £{(ADDON_DISPLAY[addonConfirm].pricePence / 100).toFixed(2)}

        created_at: m.created_at,              </span>

        created_at: m.created_at,              {" "}to your card on file.

        created_at: m.created_at,            </div>

        created_at: m.created_at,            <div style={{

        created_at: m.created_at,              background: C.surfaceHigh,

        created_at: m.created_at,              borderRadius: 6,

        created_at: m.created_at,              padding: "11px 12px",

        created_at: m.created_at,              marginBottom: 18,

        created_at: m.created_at,            }}>

        created_at: m.created_at,              <div style={{

        created_at: m.created_at,                fontSize: 10,

        created_at: m.created_at,                color: C.textDim,

        created_at: m.created_at,                fontFamily: "'DM Mono', monospace",

        created_at: m.created_at,                letterSpacing: "0.1em",

        created_at: m.created_at,                textTransform: "uppercase",

        created_at: m.created_at,                marginBottom: 4,

        created_at: m.created_at,              }}>You'll get</div>

        created_at: m.created_at,              <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.55 }}>

        created_at: m.created_at,                {ADDON_DISPLAY[addonConfirm].subtitle}

        created_at: m.created_at,              </div>

        created_at: m.created_at,            </div>

        created_at: m.created_at,            <div style={{ display: "flex", gap: 8 }}>

        created_at: m.created_at,              <button

        created_at: m.created_at,                onClick={() => setAddonConfirm(null)}

        created_at: m.created_at,                disabled={addonBusy}

        created_at: m.created_at,                style={{

        created_at: m.created_at,                  flex: 1,

        created_at: m.created_at,                  padding: 10,

        created_at: m.created_at,                  border: `1px solid ${C.border}`,

        created_at: m.created_at,                  background: "transparent",

        created_at: m.created_at,                  color: C.text,

        created_at: m.created_at,                  fontSize: 11,

        created_at: m.created_at,                  fontWeight: 600,

        created_at: m.created_at,                  borderRadius: 6,

        created_at: m.created_at,                  fontFamily: "'DM Mono', monospace",

        created_at: m.created_at,                  letterSpacing: "0.08em",

        created_at: m.created_at,                  textTransform: "uppercase",

        created_at: m.created_at,                  cursor: addonBusy ? "not-allowed" : "pointer",

        created_at: m.created_at,                  opacity: addonBusy ? 0.5 : 1,

        created_at: m.created_at,                }}

        created_at: m.created_at,              >Cancel</button>

        created_at: m.created_at,              <button

        created_at: m.created_at,                onClick={() => purchaseAddon(addonConfirm)}

        created_at: m.created_at,                disabled={addonBusy}

        created_at: m.created_at,                style={{

        created_at: m.created_at,                  flex: 1.6,

        created_at: m.created_at,                  padding: 10,

        created_at: m.created_at,                  border: `1px solid ${C.amber}`,

        created_at: m.created_at,                  background: C.amber,

        created_at: m.created_at,                  color: "#412402",

        created_at: m.created_at,                  fontSize: 11,

        created_at: m.created_at,                  fontWeight: 700,

        created_at: m.created_at,                  borderRadius: 6,

        created_at: m.created_at,                  fontFamily: "'DM Mono', monospace",

        created_at: m.created_at,                  letterSpacing: "0.08em",

        created_at: m.created_at,                  textTransform: "uppercase",

        created_at: m.created_at,                  cursor: addonBusy ? "not-allowed" : "pointer",

        created_at: m.created_at,                  opacity: addonBusy ? 0.5 : 1,

        created_at: m.created_at,                }}

        created_at: m.created_at,              >

        created_at: m.created_at,                {addonBusy ? "Processing..." : `Confirm · £${Math.round(ADDON_DISPLAY[addonConfirm].pricePence / 100)}`}

        created_at: m.created_at,              </button>

        created_at: m.created_at,            </div>

        created_at: m.created_at,          </div>

        created_at: m.created_at,        </div>

        created_at: m.created_at,      )}

        created_at: m.created_at,

        created_at: m.created_at,      </>)}

        created_at: m.created_at,

        created_at: m.created_at,      {subview === "branding" && (

        created_at: m.created_at,      <div style={S.card}>

        created_at: m.created_at,        <div style={S.sectionTitle}>Appearance</div>

        created_at: m.created_at,        <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>

        created_at: m.created_at,          Choose how Trade PA looks. Light mode is easier to read in bright sunlight on site. Auto follows your phone's setting.

        created_at: m.created_at,        </div>

        created_at: m.created_at,        <div style={{ display: "flex", gap: 8 }}>

        created_at: m.created_at,          {[

        created_at: m.created_at,            { k: "auto", label: "Auto", icon: "🌓", sub: "Follows phone" },

        created_at: m.created_at,            { k: "light", label: "Light", icon: "☀️", sub: "Bright / outdoor" },

        created_at: m.created_at,            { k: "dark", label: "Dark", icon: "🌙", sub: "Low light / van" },

        created_at: m.created_at,          ].map(opt => {

        created_at: m.created_at,            const active = theme === opt.k;

        created_at: m.created_at,            return (

        created_at: m.created_at,              <button

        created_at: m.created_at,                key={opt.k}

        created_at: m.created_at,                onClick={() => setTheme(opt.k)}

        created_at: m.created_at,                style={{

        created_at: m.created_at,                  flex: 1,

        created_at: m.created_at,                  padding: "14px 8px",

        created_at: m.created_at,                  borderRadius: 10,

        created_at: m.created_at,                  border: `2px solid ${active ? C.amber : C.border}`,

        created_at: m.created_at,                  background: active ? "rgba(245,158,11,0.12)" : C.surfaceHigh,

        created_at: m.created_at,                  color: active ? C.amber : C.text,

        created_at: m.created_at,                  cursor: "pointer",

        created_at: m.created_at,                  fontFamily: "'DM Mono',monospace",

        created_at: m.created_at,                  fontWeight: active ? 700 : 500,

        created_at: m.created_at,                  fontSize: 12,

        created_at: m.created_at,                  display: "flex",

        created_at: m.created_at,                  flexDirection: "column",

        created_at: m.created_at,                  alignItems: "center",

        created_at: m.created_at,                  gap: 4,

        created_at: m.created_at,                  transition: "all 0.15s",

        created_at: m.created_at,                }}

        created_at: m.created_at,              >

        created_at: m.created_at,                <span style={{ fontSize: 20 }}>{opt.icon}</span>

        created_at: m.created_at,                <span>{opt.label}</span>

        created_at: m.created_at,                <span style={{ fontSize: 10, color: C.muted, fontWeight: 400 }}>{opt.sub}</span>

        created_at: m.created_at,              </button>

        created_at: m.created_at,            );

        created_at: m.created_at,          })}

        created_at: m.created_at,        </div>

        created_at: m.created_at,        {theme === "auto" && (

        created_at: m.created_at,          <div style={{ fontSize: 11, color: C.muted, marginTop: 10, textAlign: "center" }}>

        created_at: m.created_at,            Currently showing: <strong style={{ color: C.text }}>{resolvedTheme}</strong> mode

        created_at: m.created_at,          </div>

        created_at: m.created_at,        )}

        created_at: m.created_at,      </div>

        created_at: m.created_at,      )}

        created_at: m.created_at,

        created_at: m.created_at,      {subview === "business" && (

        created_at: m.created_at,      <div style={S.card}>

        created_at: m.created_at,        <div style={S.sectionTitle}>Business Information</div>

        created_at: m.created_at,        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        created_at: m.created_at,          {[

        created_at: m.created_at,            { k: "tradingName", l: "Trading Name" },

        created_at: m.created_at,            { k: "tagline", l: "Tagline (shown on invoice)" },

        created_at: m.created_at,            { k: "phone", l: "Phone Number" },

        created_at: m.created_at,            { k: "email", l: "Email Address" },

        created_at: m.created_at,            { k: "website", l: "Website" },

        created_at: m.created_at,          ].map(({ k, l }) => (

        created_at: m.created_at,            <div key={k}>

        created_at: m.created_at,              <label style={S.label}>{l}</label>

        created_at: m.created_at,              <input style={S.input} value={brand[k]} onChange={set(k)} />

        created_at: m.created_at,            </div>

        created_at: m.created_at,          ))}

        created_at: m.created_at,

        created_at: m.created_at,          {/* Review & Profile Links — collapsible */}

        created_at: m.created_at,          {(() => {

        created_at: m.created_at,            const reviewFields = [

        created_at: m.created_at,              { k: "googleReviewUrl", l: "Google Review", icon: "🔍" },

        created_at: m.created_at,              { k: "reviewUrlCheckatrade", l: "Checkatrade", icon: "🏠" },

        created_at: m.created_at,              { k: "reviewUrlTrustpilot", l: "Trustpilot", icon: "⭐" },

        created_at: m.created_at,              { k: "reviewUrlFacebook", l: "Facebook", icon: "👍" },

        created_at: m.created_at,              { k: "reviewUrlWhich", l: "Which? Trusted Traders", icon: "✅" },

        created_at: m.created_at,              { k: "reviewUrlMyBuilder", l: "MyBuilder", icon: "🔨" },

        created_at: m.created_at,              { k: "reviewUrlRatedPeople", l: "Rated People", icon: "👷" },

        created_at: m.created_at,            ];

        created_at: m.created_at,            const filledCount = reviewFields.filter(f => brand[f.k]).length;

        created_at: m.created_at,            return (

        created_at: m.created_at,              <div>

        created_at: m.created_at,                <div onClick={() => setReviewLinksOpen(o => !o)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8, cursor: "pointer", userSelect: "none" }}>

        created_at: m.created_at,                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

        created_at: m.created_at,                    <span style={{ fontSize: 14 }}>🔗</span>

        created_at: m.created_at,                    <div>

        created_at: m.created_at,                      <div style={{ fontSize: 12, fontWeight: 600 }}>Review & Profile Links</div>

        created_at: m.created_at,                      <div style={{ fontSize: 11, color: C.muted }}>{filledCount > 0 ? `${filledCount} link${filledCount !== 1 ? "s" : ""} added` : "Add your review platform links"}</div>

        created_at: m.created_at,                    </div>

        created_at: m.created_at,                  </div>

        created_at: m.created_at,                  <span style={{ color: C.muted, fontSize: 16, transform: reviewLinksOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>

        created_at: m.created_at,                </div>

        created_at: m.created_at,                {reviewLinksOpen && (

        created_at: m.created_at,                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10, padding: "12px 14px", background: C.surfaceHigh, borderRadius: 8 }}>

        created_at: m.created_at,                    {reviewFields.map(({ k, l, icon }) => (

        created_at: m.created_at,                      <div key={k}>

        created_at: m.created_at,                        <label style={S.label}>{icon} {l}</label>

        created_at: m.created_at,                        <input style={S.input} value={brand[k] || ""} onChange={set(k)} placeholder="https://" />

        created_at: m.created_at,                      </div>

        created_at: m.created_at,                    ))}

        created_at: m.created_at,                  </div>

        created_at: m.created_at,                )}

        created_at: m.created_at,              </div>

        created_at: m.created_at,            );

        created_at: m.created_at,          })()}

        created_at: m.created_at,

        created_at: m.created_at,          {/* VAT Number — with live verification */}

        created_at: m.created_at,          <div>

        created_at: m.created_at,            <label style={S.label}>UTR Number (Unique Taxpayer Reference)</label>

        created_at: m.created_at,            <input style={S.input} value={brand.utrNumber || ""} onChange={set("utrNumber")} placeholder="e.g. 1234567890" />

        created_at: m.created_at,          </div>

        created_at: m.created_at,

        created_at: m.created_at,          {/* VAT Number — with live verification */}

        created_at: m.created_at,          {(() => {

        created_at: m.created_at,            const vatVerif = brand.registrationVerifications?.vatNumber;

        created_at: m.created_at,            const exempt = isExemptAccount(user?.email);

        created_at: m.created_at,            const isVerified = exempt || vatVerif?.verified;

        created_at: m.created_at,

        created_at: m.created_at,            const checkVat = async () => {

        created_at: m.created_at,              const num = (brand.vatNumber || "").replace(/\s/g, "").replace(/^GB/i, "");

        created_at: m.created_at,              if (!num || num.length < 9) { setVatError("Enter a valid UK VAT number (9 digits)"); return; }

        created_at: m.created_at,              setVatChecking(true); setVatError("");

        created_at: m.created_at,              try {

        created_at: m.created_at,                // VAT Sense free API — validates against HMRC

        created_at: m.created_at,                const res = await fetch(`https://api.vatsense.com/1.0/validate?vat_number=GB${num}`, {

        created_at: m.created_at,                  headers: { "Authorization": `Basic ${btoa("user:" + (import.meta.env.VITE_VAT_SENSE_KEY || ""))}` }

        created_at: m.created_at,                });

        created_at: m.created_at,                const data = await res.json();

        created_at: m.created_at,                if (data.success && data.data?.valid) {

        created_at: m.created_at,                  const companyName = data.data?.company?.company_name || "";

        created_at: m.created_at,                  setBrand(b => ({ ...b,

        created_at: m.created_at,                    registrationVerifications: { ...(b.registrationVerifications || {}),

        created_at: m.created_at,                      vatNumber: { verified: true, date: new Date().toISOString(), method: "auto", companyName }

        created_at: m.created_at,                    }

        created_at: m.created_at,                  }));

        created_at: m.created_at,                  setVatError("");

        created_at: m.created_at,                } else {

        created_at: m.created_at,                  setVatError("VAT number not found on HMRC register — check it's correct");

        created_at: m.created_at,                }

        created_at: m.created_at,              } catch {

        created_at: m.created_at,                setVatError("Could not reach verification service — check your connection");

        created_at: m.created_at,              }

        created_at: m.created_at,              setVatChecking(false);

        created_at: m.created_at,            };

        created_at: m.created_at,

        created_at: m.created_at,            return (

        created_at: m.created_at,              <div>

        created_at: m.created_at,                <label style={S.label}>VAT Number</label>

        created_at: m.created_at,                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>

        created_at: m.created_at,                  <div style={{ flex: 1 }}>

        created_at: m.created_at,                    <input

        created_at: m.created_at,                      style={{ ...S.input, borderColor: (isVerified || exempt) ? C.green + "66" : brand.vatNumber ? C.amber + "66" : C.border }}

        created_at: m.created_at,                      placeholder="e.g. GB123456789"

        created_at: m.created_at,                      value={brand.vatNumber}

        created_at: m.created_at,                      onChange={e => {

        created_at: m.created_at,                        setBrand(b => ({ ...b, vatNumber: e.target.value,

        created_at: m.created_at,                          registrationVerifications: { ...(b.registrationVerifications || {}), vatNumber: undefined }

        created_at: m.created_at,                        }));

        created_at: m.created_at,                        setVatError("");

        created_at: m.created_at,                      }}

        created_at: m.created_at,                    />

        created_at: m.created_at,                    {!exempt && isVerified && (

        created_at: m.created_at,                      <div style={{ fontSize: 11, color: C.green, marginTop: 4 }}>

        created_at: m.created_at,                        ✓ Verified against HMRC · {vatVerif.companyName && <strong>{vatVerif.companyName}</strong>} · {new Date(vatVerif.date).toLocaleDateString("en-GB")}

        created_at: m.created_at,                      </div>

        created_at: m.created_at,                    )}

        created_at: m.created_at,                    {!exempt && !isVerified && brand.vatNumber && (

        created_at: m.created_at,                      <div style={{ fontSize: 11, color: C.amber, marginTop: 4 }}>

        created_at: m.created_at,                        ⚠ VAT number not yet verified — it will not appear on invoices until confirmed

        created_at: m.created_at,                      </div>

        created_at: m.created_at,                    )}

        created_at: m.created_at,                    {vatError && <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>{vatError}</div>}

        created_at: m.created_at,                  </div>

        created_at: m.created_at,                  {exempt && brand.vatNumber && (

        created_at: m.created_at,                    <span style={{ ...S.badge(C.blue), fontSize: 10, marginTop: 2 }}>✓ Test account</span>

        created_at: m.created_at,                  )}

        created_at: m.created_at,                  {!exempt && brand.vatNumber && !isVerified && (

        created_at: m.created_at,                    <button style={{ ...S.btn("primary"), fontSize: 11, flexShrink: 0, marginTop: 2 }} disabled={vatChecking} onClick={checkVat}>

        created_at: m.created_at,                      {vatChecking ? "Checking..." : "Verify with HMRC →"}

        created_at: m.created_at,                    </button>

        created_at: m.created_at,                  )}

        created_at: m.created_at,                  {!exempt && isVerified && (

        created_at: m.created_at,                    <button style={{ ...S.btn("ghost"), fontSize: 10, flexShrink: 0, marginTop: 2, color: C.muted }}

        created_at: m.created_at,                      onClick={() => setBrand(b => ({ ...b, registrationVerifications: { ...(b.registrationVerifications || {}), vatNumber: undefined } }))}>

        created_at: m.created_at,                      Re-check

        created_at: m.created_at,                    </button>

        created_at: m.created_at,                  )}

        created_at: m.created_at,                </div>

        created_at: m.created_at,              </div>

        created_at: m.created_at,            );

        created_at: m.created_at,          })()}

        created_at: m.created_at,          <div>

        created_at: m.created_at,            <label style={S.label}>Business Address</label>

        created_at: m.created_at,            <textarea style={{ ...S.input, resize: "vertical", minHeight: 80 }} value={brand.address} onChange={set("address")} />

        created_at: m.created_at,          </div>

        created_at: m.created_at,        </div>

        created_at: m.created_at,      </div>

        created_at: m.created_at,      )}

        created_at: m.created_at,

        created_at: m.created_at,      {subview === "invoices" && (

        created_at: m.created_at,      <div style={S.grid2}>

        created_at: m.created_at,        <div style={S.card}>

        created_at: m.created_at,          <div style={S.sectionTitle}>Bank Details (shown on invoice)</div>

        created_at: m.created_at,          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

        created_at: m.created_at,            {[

        created_at: m.created_at,              { k: "bankName", l: "Bank Name" },

        created_at: m.created_at,              { k: "sortCode", l: "Sort Code" },

        created_at: m.created_at,              { k: "accountNumber", l: "Account Number" },

        created_at: m.created_at,              { k: "accountName", l: "Account Name" },

        created_at: m.created_at,            ].map(({ k, l }) => (

        created_at: m.created_at,              <div key={k}>

        created_at: m.created_at,                <label style={S.label}>{l}</label>

        created_at: m.created_at,                <input style={S.input} value={brand[k]} onChange={set(k)} />

        created_at: m.created_at,              </div>

        created_at: m.created_at,            ))}

        created_at: m.created_at,          </div>

        created_at: m.created_at,        </div>

        created_at: m.created_at,

        created_at: m.created_at,        <div style={S.card}>

        created_at: m.created_at,          <div style={S.sectionTitle}>Invoice Defaults</div>

        created_at: m.created_at,

        created_at: m.created_at,          <div style={{ marginBottom: 16 }}>

        created_at: m.created_at,            <label style={S.label}>Default Payment Terms</label>

        created_at: m.created_at,            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>

        created_at: m.created_at,              {["0", "7", "14"].map(d => (

        created_at: m.created_at,                <button key={d} onClick={() => setBrand(b => ({ ...b, paymentTerms: d }))} style={S.pill(brand.accentColor, brand.paymentTerms === d)}>{d} days</button>

        created_at: m.created_at,              ))}

        created_at: m.created_at,              <button onClick={() => setBrand(b => ({ ...b, paymentTerms: "custom" }))} style={S.pill(brand.accentColor, !["0","7","14"].includes(brand.paymentTerms))}>Custom</button>

        created_at: m.created_at,            </div>

        created_at: m.created_at,            {!["0","7","14"].includes(brand.paymentTerms) && (

        created_at: m.created_at,              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>

        created_at: m.created_at,                <input

        created_at: m.created_at,                  style={{ ...S.input, width: 80 }}

        created_at: m.created_at,                  type="number"

        created_at: m.created_at,                  min="1"

        created_at: m.created_at,                  placeholder="e.g. 60"

        created_at: m.created_at,                  value={["0","7","14","custom"].includes(brand.paymentTerms) ? "" : brand.paymentTerms}

        created_at: m.created_at,                  onChange={e => setBrand(b => ({ ...b, paymentTerms: e.target.value }))}

        created_at: m.created_at,                />

        created_at: m.created_at,                <span style={{ fontSize: 12, color: C.muted }}>days</span>

        created_at: m.created_at,              </div>

        created_at: m.created_at,            )}

        created_at: m.created_at,          </div>

        created_at: m.created_at,

        created_at: m.created_at,          <div style={{ marginBottom: 16 }}>

        created_at: m.created_at,            <label style={S.label}>Default Quote Validity</label>

        created_at: m.created_at,            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>

        created_at: m.created_at,              {["14", "30", "60", "90"].map(d => (

        created_at: m.created_at,                <button key={d} onClick={() => setBrand(b => ({ ...b, quoteValidity: d }))} style={S.pill(brand.accentColor, (brand.quoteValidity || "30") === d)}>{d} days</button>

        created_at: m.created_at,              ))}

        created_at: m.created_at,              <button onClick={() => setBrand(b => ({ ...b, quoteValidity: "custom" }))} style={S.pill(brand.accentColor, !["14","30","60","90"].includes(brand.quoteValidity || "30"))}>Custom</button>

        created_at: m.created_at,            </div>

        created_at: m.created_at,            {!["14","30","60","90"].includes(brand.quoteValidity || "30") && (

        created_at: m.created_at,              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>

        created_at: m.created_at,                <input

        created_at: m.created_at,                  style={{ ...S.input, width: 80 }}

        created_at: m.created_at,                  type="number"

        created_at: m.created_at,                  min="1"

        created_at: m.created_at,                  placeholder="e.g. 45"

        created_at: m.created_at,                  value={["14","30","60","90","custom"].includes(brand.quoteValidity || "") ? "" : (brand.quoteValidity || "")}

        created_at: m.created_at,                  onChange={e => setBrand(b => ({ ...b, quoteValidity: e.target.value }))}

        created_at: m.created_at,                />

        created_at: m.created_at,                <span style={{ fontSize: 12, color: C.muted }}>days</span>

        created_at: m.created_at,              </div>

        created_at: m.created_at,            )}

        created_at: m.created_at,            <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Quotes auto-flag as expired after this many days. You can extend any expired quote from the Quotes tab.</div>

        created_at: m.created_at,          </div>

        created_at: m.created_at,

        created_at: m.created_at,          <div style={{ marginBottom: 16 }}>

        created_at: m.created_at,            <label style={S.label}>Payment Method on Invoices</label>

        created_at: m.created_at,            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>

        created_at: m.created_at,              {[

        created_at: m.created_at,                { v: "bacs", label: "🏦 BACS only" },

        created_at: m.created_at,                { v: "card", label: "💳 Card only" },

        created_at: m.created_at,                { v: "both", label: "🏦💳 Both options" },

        created_at: m.created_at,              ].map(({ v, label }) => (

        created_at: m.created_at,                <button key={v} onClick={() => setBrand(b => ({ ...b, defaultPaymentMethod: v }))} style={S.pill(brand.accentColor, brand.defaultPaymentMethod === v)}>{label}</button>

        created_at: m.created_at,              ))}

        created_at: m.created_at,            </div>

        created_at: m.created_at,            <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>

        created_at: m.created_at,              {brand.defaultPaymentMethod === "bacs" && "Invoice shows bank details only. Good for customers who prefer traditional bank transfer."}

        created_at: m.created_at,              {brand.defaultPaymentMethod === "card" && "Invoice shows a Stripe payment link only. Fastest way to get paid."}

        created_at: m.created_at,              {brand.defaultPaymentMethod === "both" && "Invoice shows both options. Customer chooses. Recommended for mixed customer base."}

        created_at: m.created_at,            </div>

        created_at: m.created_at,          </div>

        created_at: m.created_at,

        created_at: m.created_at,          <div style={{ marginBottom: 16 }}>

        created_at: m.created_at,            <label style={S.label}>Payment Reference Format</label>

        created_at: m.created_at,            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

        created_at: m.created_at,              {[

        created_at: m.created_at,                { v: "invoice_number", label: "Invoice number", example: "INV-041" },

        created_at: m.created_at,                { v: "surname_invoice", label: "Surname + invoice", example: "OLIVER-INV-041" },

        created_at: m.created_at,                { v: "custom_prefix", label: "Custom prefix + number", example: `${brand.refPrefix || "DPH"}-041` },

        created_at: m.created_at,                { v: "number_only", label: "Number only", example: "041" },

        created_at: m.created_at,              ].map(({ v, label, example }) => (

        created_at: m.created_at,                <div key={v} onClick={() => setBrand(b => ({ ...b, refFormat: v }))} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 8, border: `1px solid ${brand.refFormat === v ? brand.accentColor : C.border}`, background: brand.refFormat === v ? brand.accentColor + "11" : C.surfaceHigh, cursor: "pointer", transition: "all 0.15s" }}>

        created_at: m.created_at,                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

        created_at: m.created_at,                    <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${brand.refFormat === v ? brand.accentColor : C.muted}`, background: brand.refFormat === v ? brand.accentColor : "transparent", flexShrink: 0 }} />

        created_at: m.created_at,                    <span style={{ fontSize: 12, color: brand.refFormat === v ? C.text : C.textDim }}>{label}</span>

        created_at: m.created_at,                  </div>

        created_at: m.created_at,                  <span style={{ fontSize: 11, fontWeight: 700, color: brand.refFormat === v ? brand.accentColor : C.muted, letterSpacing: "0.04em" }}>{example}</span>

        created_at: m.created_at,                </div>

        created_at: m.created_at,              ))}

        created_at: m.created_at,            </div>

        created_at: m.created_at,            {brand.refFormat === "custom_prefix" && (

        created_at: m.created_at,              <div style={{ marginTop: 10 }}>

        created_at: m.created_at,                <label style={S.label}>Your Custom Prefix</label>

        created_at: m.created_at,                <input style={S.input} value={brand.refPrefix || ""} onChange={e => setBrand(b => ({ ...b, refPrefix: e.target.value.toUpperCase() }))} placeholder="e.g. DPH, DAVE, PLB" maxLength={8} />

        created_at: m.created_at,              </div>

        created_at: m.created_at,            )}

        created_at: m.created_at,            <div style={{ marginTop: 10, padding: "8px 12px", background: C.surfaceHigh, borderRadius: 10, border: `1px solid ${C.border}` }}>

        created_at: m.created_at,              <span style={{ fontSize: 11, color: C.muted }}>Preview: </span>

        created_at: m.created_at,              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", color: C.text }}>{buildRef(brand, { id: "INV-041", customer: "James Oliver" })}</span>

        created_at: m.created_at,            </div>

        created_at: m.created_at,          </div>

        created_at: m.created_at,

        created_at: m.created_at,          <div style={{ marginBottom: 16 }}>

        created_at: m.created_at,            <label style={S.label}>Invoice Footer Note</label>

        created_at: m.created_at,            <textarea style={{ ...S.input, resize: "vertical", minHeight: 70 }} value={brand.invoiceNote} onChange={set("invoiceNote")} />

        created_at: m.created_at,          </div>

        created_at: m.created_at,          <div>

        created_at: m.created_at,            <label style={S.label}>Next Invoice Number</label>

        created_at: m.created_at,            <input style={S.input} defaultValue="INV-043" />

        created_at: m.created_at,          </div>

        created_at: m.created_at,        </div>

        created_at: m.created_at,      </div>

        created_at: m.created_at,      )}

        created_at: m.created_at,

        created_at: m.created_at,      {subview === "compliance" && (<>

        created_at: m.created_at,      <CertificationsCard brand={brand} setBrand={setBrand} />

        created_at: m.created_at,      </>)}

        created_at: m.created_at,

        created_at: m.created_at,      {subview === "integrations" && (

        created_at: m.created_at,      <div style={S.card}>

        created_at: m.created_at,        <div style={S.sectionTitle}>Accounting Integrations</div>

        created_at: m.created_at,        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>

        created_at: m.created_at,          Connect your accounting software. Invoices created in Trade PA will automatically sync across.

        created_at: m.created_at,        </div>

        created_at: m.created_at,

        created_at: m.created_at,        {/* Xero */}

        created_at: m.created_at,        <div style={{ padding: "14px 16px", background: C.surfaceHigh, borderRadius: 8, marginBottom: 10, display: "flex", alignItems: "center", gap: 16 }}>

        created_at: m.created_at,          <div style={{ width: 40, height: 40, borderRadius: 8, background: "#13B5EA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>

        created_at: m.created_at,            <span style={{ color: "#fff", fontWeight: 900, fontSize: 14 }}>X</span>

        created_at: m.created_at,          </div>

        created_at: m.created_at,          <div style={{ flex: 1 }}>

        created_at: m.created_at,            <div style={{ fontSize: 13, fontWeight: 700 }}>Xero</div>

        created_at: m.created_at,            <div style={{ fontSize: 11, color: C.muted }}>

        created_at: m.created_at,              {xeroConnected ? "Connected — invoices will sync automatically" : "Not connected"}

        created_at: m.created_at,            </div>

        created_at: m.created_at,          </div>

        created_at: m.created_at,          {xeroConnected ? (

        created_at: m.created_at,            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

        created_at: m.created_at,              <div style={S.badge(C.green)}>✓ Connected</div>

        created_at: m.created_at,              <button

        created_at: m.created_at,                onClick={async () => {

        created_at: m.created_at,                  if (!confirm("Disconnect Xero? Invoices will stop syncing. You can reconnect anytime.")) return;

        created_at: m.created_at,                  // Client-side disconnect — deletes the connection row directly.

        created_at: m.created_at,                  // Keeping it local (no new serverless endpoint) since the

        created_at: m.created_at,                  // accounting_connections table is RLS-scoped to user_id and

        created_at: m.created_at,                  // delete just means "stop syncing", doesn't revoke Xero tokens.

        created_at: m.created_at,                  if (!user?.id) return;

        created_at: m.created_at,                  try {

        created_at: m.created_at,                    await db.from("accounting_connections").delete().eq("user_id", user.id).eq("provider", "xero");

        created_at: m.created_at,                    setXeroConnected(false);

        created_at: m.created_at,                  } catch (err) {

        created_at: m.created_at,                    alert("Could not disconnect — try again.");

        created_at: m.created_at,                  }

        created_at: m.created_at,                }}

        created_at: m.created_at,                style={{ ...S.btn("ghost"), fontSize: 11, color: C.muted }}

        created_at: m.created_at,              >Disconnect</button>

        created_at: m.created_at,            </div>

        created_at: m.created_at,          ) : (

        created_at: m.created_at,            <a

        created_at: m.created_at,              href={`/api/auth/xero/connect?userId=${user?.id}`}

        created_at: m.created_at,              style={{ ...S.btn("primary"), textDecoration: "none", background: "#13B5EA", fontSize: 12 }}

        created_at: m.created_at,            >Connect Xero</a>

        created_at: m.created_at,          )}

        created_at: m.created_at,        </div>

        created_at: m.created_at,

        created_at: m.created_at,        {/* QuickBooks */}

        created_at: m.created_at,        <div style={{ padding: "14px 16px", background: C.surfaceHigh, borderRadius: 8, display: "flex", alignItems: "center", gap: 16 }}>

        created_at: m.created_at,          <div style={{ width: 40, height: 40, borderRadius: 8, background: "#2CA01C", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>

        created_at: m.created_at,            <span style={{ color: "#fff", fontWeight: 900, fontSize: 11 }}>QB</span>

        created_at: m.created_at,          </div>

        created_at: m.created_at,          <div style={{ flex: 1 }}>

        created_at: m.created_at,            <div style={{ fontSize: 13, fontWeight: 700 }}>QuickBooks</div>

        created_at: m.created_at,            <div style={{ fontSize: 11, color: C.muted }}>

        created_at: m.created_at,              {qbConnected ? "Connected — invoices will sync automatically" : "Not connected"}

        created_at: m.created_at,            </div>

        created_at: m.created_at,          </div>

        created_at: m.created_at,          {qbConnected ? (

        created_at: m.created_at,            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

        created_at: m.created_at,              <div style={S.badge(C.green)}>✓ Connected</div>

        created_at: m.created_at,              <button

        created_at: m.created_at,                onClick={async () => {

        created_at: m.created_at,                  if (!confirm("Disconnect QuickBooks? Invoices will stop syncing. You can reconnect anytime.")) return;

        created_at: m.created_at,                  if (!user?.id) return;

        created_at: m.created_at,                  try {

        created_at: m.created_at,                    await db.from("accounting_connections").delete().eq("user_id", user.id).eq("provider", "quickbooks");

        created_at: m.created_at,                    setQbConnected(false);

        created_at: m.created_at,                  } catch (err) {

        created_at: m.created_at,                    alert("Could not disconnect — try again.");

        created_at: m.created_at,                  }

        created_at: m.created_at,                }}

        created_at: m.created_at,                style={{ ...S.btn("ghost"), fontSize: 11, color: C.muted }}

        created_at: m.created_at,              >Disconnect</button>

        created_at: m.created_at,            </div>

        created_at: m.created_at,          ) : (

        created_at: m.created_at,            <a

        created_at: m.created_at,              href={`/api/auth/quickbooks/connect?userId=${user?.id}`}

        created_at: m.created_at,              style={{ ...S.btn("primary"), textDecoration: "none", background: "#2CA01C", fontSize: 12 }}

        created_at: m.created_at,            >Connect QuickBooks</a>

        created_at: m.created_at,          )}

        created_at: m.created_at,        </div>

        created_at: m.created_at,

        created_at: m.created_at,        {/* ── Card Payments (Stripe Connect Standard) ──────────────────────

        created_at: m.created_at,            Lets the tradesperson take card payments through their customer

        created_at: m.created_at,            portal links. Money goes direct to their own Stripe account —

        created_at: m.created_at,            Trade PA takes no cut. */}

        created_at: m.created_at,        <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${C.border}` }}>

        created_at: m.created_at,          <div style={S.sectionTitle}>Card Payments</div>

        created_at: m.created_at,          <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>

        created_at: m.created_at,            Connect Stripe to let your customers pay quotes and invoices by card directly from the portal link. Money goes to your Stripe account — we don't take a cut.

        created_at: m.created_at,          </div>

        created_at: m.created_at,          <div style={{ padding: "14px 16px", background: C.surfaceHigh, borderRadius: 8, display: "flex", alignItems: "center", gap: 16 }}>

        created_at: m.created_at,            <div style={{ width: 40, height: 40, borderRadius: 8, background: "#635BFF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>

        created_at: m.created_at,              <span style={{ color: "#fff", fontWeight: 900, fontSize: 14 }}>S</span>

        created_at: m.created_at,            </div>

        created_at: m.created_at,            <div style={{ flex: 1 }}>

        created_at: m.created_at,              <div style={{ fontSize: 13, fontWeight: 700 }}>Stripe</div>

        created_at: m.created_at,              <div style={{ fontSize: 11, color: C.muted }}>

        created_at: m.created_at,                {brand?.stripeAccountId

        created_at: m.created_at,                  ? `Connected${brand.stripeConnectedAt ? ` since ${new Date(brand.stripeConnectedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}`

        created_at: m.created_at,                  : "Not connected — your portal pages will show bank transfer only"}

        created_at: m.created_at,              </div>

        created_at: m.created_at,            </div>

        created_at: m.created_at,            {brand?.stripeAccountId ? (

        created_at: m.created_at,              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

        created_at: m.created_at,                <div style={S.badge(C.green)}>✓ Connected</div>

        created_at: m.created_at,                <button

        created_at: m.created_at,                  onClick={() => {

        created_at: m.created_at,                    if (!confirm("Disconnect Stripe? Card payments will stop working on your customer portal links. Your Stripe account stays intact — this only unlinks it from Trade PA. You can reconnect anytime.")) return;

        created_at: m.created_at,                    // Clear the Stripe link from brand_data. The setBrand updater

        created_at: m.created_at,                    // triggers the normal background sync to user_settings, so

        created_at: m.created_at,                    // no direct DB call needed here.

        created_at: m.created_at,                    setBrand(b => ({ ...b, stripeAccountId: null, stripeConnectedAt: null }));

        created_at: m.created_at,                  }}

        created_at: m.created_at,                  style={{ ...S.btn("ghost"), fontSize: 11, color: C.muted }}

        created_at: m.created_at,                >Disconnect</button>

        created_at: m.created_at,              </div>

        created_at: m.created_at,            ) : (

        created_at: m.created_at,              <a

        created_at: m.created_at,                href={`/api/stripe/connect-onboard?userId=${user?.id}`}

        created_at: m.created_at,                style={{ ...S.btn("primary"), textDecoration: "none", background: "#635BFF", fontSize: 12 }}

        created_at: m.created_at,              >Connect Stripe</a>

        created_at: m.created_at,            )}

        created_at: m.created_at,          </div>

        created_at: m.created_at,        </div>

        created_at: m.created_at,      </div>

        created_at: m.created_at,      )}

        created_at: m.created_at,

        created_at: m.created_at,      {subview === "compliance" && (<>

        created_at: m.created_at,      <div style={S.card}>

        created_at: m.created_at,        <div style={S.sectionTitle}>Trade Registrations</div>

        created_at: m.created_at,        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>

        created_at: m.created_at,          Select your trade types. Registration numbers feed directly onto certificates — they cannot be edited on the certificate itself. Verify each number to build your compliance audit trail.

        created_at: m.created_at,        </div>

        created_at: m.created_at,

        created_at: m.created_at,        {/* Trade type selector */}

        created_at: m.created_at,        <div style={{ marginBottom: 20 }}>

        created_at: m.created_at,          <label style={S.label}>Your Trade Types</label>

        created_at: m.created_at,          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>

        created_at: m.created_at,            {[

        created_at: m.created_at,              { k: "gas", l: "🔥 Gas" },

        created_at: m.created_at,              { k: "electrical", l: "⚡ Electrical" },

        created_at: m.created_at,              { k: "oil", l: "🛢 Oil" },

        created_at: m.created_at,              { k: "solidfuel", l: "🪵 Solid Fuel" },

        created_at: m.created_at,              { k: "renewables", l: "☀️ Renewables" },

        created_at: m.created_at,              { k: "plumbing", l: "💧 Plumbing" },

        created_at: m.created_at,              { k: "glazing", l: "🪟 Glazing/Windows" },

        created_at: m.created_at,              { k: "refrigeration", l: "❄️ Refrigeration/AC" },

        created_at: m.created_at,              { k: "general", l: "🏗 General Building" },

        created_at: m.created_at,            ].map(({ k, l }) => {

        created_at: m.created_at,              const active = (brand.tradeTypes || []).includes(k);

        created_at: m.created_at,              return (

        created_at: m.created_at,                <button key={k}

        created_at: m.created_at,                  onClick={() => setBrand(b => ({ ...b, tradeTypes: active ? (b.tradeTypes || []).filter(t => t !== k) : [...(b.tradeTypes || []), k] }))}

        created_at: m.created_at,                  style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${active ? C.amber + "88" : C.border}`, background: active ? C.amber + "18" : C.surfaceHigh, color: active ? C.amber : C.muted, fontSize: 12, cursor: "pointer", fontFamily: "'DM Mono',monospace", fontWeight: active ? 700 : 400 }}>

        created_at: m.created_at,                  {l}

        created_at: m.created_at,                </button>

        created_at: m.created_at,              );

        created_at: m.created_at,            })}

        created_at: m.created_at,          </div>

        created_at: m.created_at,        </div>

        created_at: m.created_at,

        created_at: m.created_at,        {/* Registration fields per trade */}

        created_at: m.created_at,        {(brand.tradeTypes || []).length === 0 && (

        created_at: m.created_at,          <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>Select your trade types above to see relevant registration fields.</div>

        created_at: m.created_at,        )}

        created_at: m.created_at,

        created_at: m.created_at,        {(() => {

        created_at: m.created_at,          const trades = brand.tradeTypes || [];

        created_at: m.created_at,          const verifs = brand.registrationVerifications || {};

        created_at: m.created_at,          const fields = [];

        created_at: m.created_at,          const exemptUser = isExemptAccount(user?.email);

        created_at: m.created_at,

        created_at: m.created_at,          const RegField = ({ fieldKey, label, registerUrl, verifyLabel, placeholder }) => {

        created_at: m.created_at,            const val = brand[fieldKey] || "";

        created_at: m.created_at,            const v = verifs[fieldKey];

        created_at: m.created_at,            const verified = exemptUser || v?.verified;

        created_at: m.created_at,            const verifiedDate = v?.date ? new Date(v.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";

        created_at: m.created_at,            const isAutoVerified = v?.method === "auto";

        created_at: m.created_at,            return (

        created_at: m.created_at,              <div style={{ background: C.surfaceHigh, borderRadius: 10, padding: 14, marginBottom: 10 }}>

        created_at: m.created_at,                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>

        created_at: m.created_at,                  <label style={{ ...S.label, margin: 0 }}>{label}</label>

        created_at: m.created_at,                  {verified && !exemptUser && <span style={{ ...S.badge(C.green), fontSize: 10 }}>{isAutoVerified ? "✓ Auto-verified" : "✓ Confirmed"} {verifiedDate}</span>}

        created_at: m.created_at,                  {exemptUser && val && <span style={{ ...S.badge(C.blue), fontSize: 10 }}>✓ Test account</span>}

        created_at: m.created_at,                  {!verified && !exemptUser && val && <span style={{ ...S.badge(C.amber), fontSize: 10 }}>⚠ Not yet verified</span>}

        created_at: m.created_at,                </div>

        created_at: m.created_at,                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>

        created_at: m.created_at,                  <input

        created_at: m.created_at,                    style={{ ...S.input, flex: 1, borderColor: verified ? C.green + "66" : val && !verified ? C.amber + "66" : C.border }}

        created_at: m.created_at,                    placeholder={placeholder || "Enter number"}

        created_at: m.created_at,                    value={val}

        created_at: m.created_at,                    onChange={e => setBrand(b => ({ ...b, [fieldKey]: e.target.value, registrationVerifications: { ...(b.registrationVerifications || {}), [fieldKey]: undefined } }))}

        created_at: m.created_at,                  />

        created_at: m.created_at,                  {!exemptUser && val && !verified && registerUrl && (

        created_at: m.created_at,                    <button

        created_at: m.created_at,                      style={{ ...S.btn("ghost"), fontSize: 11, flexShrink: 0 }}

        created_at: m.created_at,                      onClick={() => window.open(registerUrl, "_blank", "width=900,height=700")}

        created_at: m.created_at,                    >🔍 Verify →</button>

        created_at: m.created_at,                  )}

        created_at: m.created_at,                  {!exemptUser && val && !verified && (

        created_at: m.created_at,                    <button

        created_at: m.created_at,                      style={{ ...S.btn("primary"), fontSize: 11, flexShrink: 0 }}

        created_at: m.created_at,                      onClick={() => setBrand(b => ({ ...b, registrationVerifications: { ...(b.registrationVerifications || {}), [fieldKey]: { verified: true, date: new Date().toISOString(), method: "manual" } } }))}

        created_at: m.created_at,                    >✓ Confirmed</button>

        created_at: m.created_at,                  )}

        created_at: m.created_at,                  {!exemptUser && val && verified && !isAutoVerified && (

        created_at: m.created_at,                    <button style={{ ...S.btn("ghost"), fontSize: 10, flexShrink: 0, color: C.muted }}

        created_at: m.created_at,                      onClick={() => setBrand(b => ({ ...b, registrationVerifications: { ...(b.registrationVerifications || {}), [fieldKey]: undefined } }))}>

        created_at: m.created_at,                      Re-check

        created_at: m.created_at,                    </button>

        created_at: m.created_at,                  )}

        created_at: m.created_at,                </div>

        created_at: m.created_at,                {!exemptUser && val && !verified && registerUrl && (

        created_at: m.created_at,                  <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>

        created_at: m.created_at,                    Tap Verify → to open the official register in a new window, then tap Confirmed once you've checked your number is valid and active.

        created_at: m.created_at,                  </div>

        created_at: m.created_at,                )}

        created_at: m.created_at,              </div>

        created_at: m.created_at,            );

        created_at: m.created_at,          };

        created_at: m.created_at,

        created_at: m.created_at,          if (trades.includes("gas")) fields.push(

        created_at: m.created_at,            <RegField key="gas" fieldKey="gasSafeNumber" label="🔥 Gas Safe Register Number"

        created_at: m.created_at,              registerUrl={`https://www.gassaferegister.co.uk/find-an-engineer-or-check-the-register/check-an-engineer/?licenceNumber=${brand.gasSafeNumber || ""}`}

        created_at: m.created_at,              placeholder="7-digit licence number e.g. 1234567" />

        created_at: m.created_at,          );

        created_at: m.created_at,          if (trades.includes("electrical")) {

        created_at: m.created_at,            fields.push(<div key="elec-header" style={{ fontSize: 11, color: C.muted, marginBottom: 6, marginTop: 4 }}>Add whichever electrical scheme you belong to:</div>);

        created_at: m.created_at,            fields.push(<RegField key="niceic" fieldKey="niceicNumber" label="⚡ NICEIC Number"

        created_at: m.created_at,              registerUrl={`https://www.niceic.com/find-a-contractor`} placeholder="e.g. 7654321" />);

        created_at: m.created_at,            fields.push(<RegField key="napit" fieldKey="napitNumber" label="⚡ NAPIT Number"

        created_at: m.created_at,              registerUrl="https://www.napit.org.uk/find-a-member" placeholder="e.g. NAP/12345" />);

        created_at: m.created_at,            fields.push(<RegField key="elecsa" fieldKey="elecsaNumber" label="⚡ ELECSA Number"

        created_at: m.created_at,              registerUrl="https://www.elecsa.co.uk/find-a-member" placeholder="e.g. 12345" />);

        created_at: m.created_at,          }

        created_at: m.created_at,          if (trades.includes("oil")) fields.push(

        created_at: m.created_at,            <RegField key="oftec" fieldKey="oftecNumber" label="🛢 OFTEC Registration Number"

        created_at: m.created_at,              registerUrl="https://www.oftec.org/consumers/find-a-registered-technician" placeholder="e.g. C12345" />

        created_at: m.created_at,          );

        created_at: m.created_at,          if (trades.includes("solidfuel")) fields.push(

        created_at: m.created_at,            <RegField key="hetas" fieldKey="hetasNumber" label="🪵 HETAS Registration Number"

        created_at: m.created_at,              registerUrl="https://www.hetas.co.uk/find-an-approved-business" placeholder="e.g. H12345" />

        created_at: m.created_at,          );

        created_at: m.created_at,          if (trades.includes("renewables")) fields.push(

        created_at: m.created_at,            <RegField key="mcs" fieldKey="mcsNumber" label="☀️ MCS Certification Number"

        created_at: m.created_at,              registerUrl="https://mcscertified.com/find-an-installer" placeholder="e.g. NAP-12345-678" />

        created_at: m.created_at,          );

        created_at: m.created_at,          if (trades.includes("refrigeration")) fields.push(

        created_at: m.created_at,            <RegField key="fgas" fieldKey="fgasNumber" label="❄️ F-Gas Certificate Number"

        created_at: m.created_at,              registerUrl="https://www.fgas.org.uk" placeholder="Company cert number" />

        created_at: m.created_at,          );

        created_at: m.created_at,          if (trades.includes("plumbing")) fields.push(

        created_at: m.created_at,            <RegField key="aphc" fieldKey="aphcNumber" label="💧 APHC / WaterSafe Number"

        created_at: m.created_at,              registerUrl="https://watersafe.org.uk/find-a-plumber" placeholder="e.g. WS12345" />

        created_at: m.created_at,          );

        created_at: m.created_at,          if (trades.includes("glazing")) fields.push(

        created_at: m.created_at,            <RegField key="fensa" fieldKey="fensaNumber" label="🪟 FENSA Registration Number"

        created_at: m.created_at,              registerUrl="https://www.fensa.org.uk/homeowner/find-a-fensa-installer" placeholder="e.g. 12345" />

        created_at: m.created_at,          );

        created_at: m.created_at,          if (trades.includes("general")) fields.push(

        created_at: m.created_at,            <RegField key="cscs" fieldKey="cscsNumber" label="🏗 CSCS Card Number"

        created_at: m.created_at,              registerUrl="https://www.cscs.uk.com/checking-cards/check-a-cscs-card" placeholder="e.g. 1234567890" />

        created_at: m.created_at,          );

        created_at: m.created_at,

        created_at: m.created_at,          return fields;

        created_at: m.created_at,        })()}

        created_at: m.created_at,

        created_at: m.created_at,        {/* Gas Safe Logo Upload — only if gas trade selected */}

        created_at: m.created_at,        {(brand.tradeTypes || []).includes("gas") && (

        created_at: m.created_at,          <div style={{ marginTop: 16 }}>

        created_at: m.created_at,            <label style={S.label}>Gas Safe Logo</label>

        created_at: m.created_at,            <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, lineHeight: 1.6 }}>

        created_at: m.created_at,              Contact Gas Safe Register on 0800 408 5500 to request authorisation to use their logo digitally. Once approved, upload it here and it will appear on all gas safety certificates.

        created_at: m.created_at,            </div>

        created_at: m.created_at,            {brand.gasSafeLogo ? (

        created_at: m.created_at,              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>

        created_at: m.created_at,                <img src={brand.gasSafeLogo} alt="Gas Safe logo" style={{ height: 48, objectFit: "contain", background: "#fff", padding: 6, borderRadius: 10 }} />

        created_at: m.created_at,                <div style={{ flex: 1 }}>

        created_at: m.created_at,                  <div style={S.badge(C.green)}>✓ Logo uploaded</div>

        created_at: m.created_at,                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Appears on all gas safety certificates</div>

        created_at: m.created_at,                </div>

        created_at: m.created_at,                <button style={{ ...S.btn("ghost"), fontSize: 11, color: C.red }} onClick={() => setBrand(b => ({ ...b, gasSafeLogo: null }))}>Remove</button>

        created_at: m.created_at,              </div>

        created_at: m.created_at,            ) : (

        created_at: m.created_at,              <div>

        created_at: m.created_at,                <input type="file" accept="image/*" style={{ display: "none" }} id="gasSafeLogoInput"

        created_at: m.created_at,                  onChange={e => {

        created_at: m.created_at,                    const file = e.target.files[0];

        created_at: m.created_at,                    if (!file) return;

        created_at: m.created_at,                    const img = new Image();

        created_at: m.created_at,                    const url = URL.createObjectURL(file);

        created_at: m.created_at,                    img.onload = () => {

        created_at: m.created_at,                      const canvas = document.createElement("canvas");

        created_at: m.created_at,                      const scale = Math.min(1, 200 / img.width, 80 / img.height);

        created_at: m.created_at,                      canvas.width = img.width * scale;

        created_at: m.created_at,                      canvas.height = img.height * scale;

        created_at: m.created_at,                      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);

        created_at: m.created_at,                      setBrand(b => ({ ...b, gasSafeLogo: canvas.toDataURL("image/png") }));

        created_at: m.created_at,                      URL.revokeObjectURL(url);

        created_at: m.created_at,                    };

        created_at: m.created_at,                    img.src = url;

        created_at: m.created_at,                    e.target.value = "";

        created_at: m.created_at,                  }}

        created_at: m.created_at,                />

        created_at: m.created_at,                <button style={S.btn("ghost")} onClick={() => document.getElementById("gasSafeLogoInput").click()}>📤 Upload Gas Safe Logo</button>

        created_at: m.created_at,                <div style={{ fontSize: 11, color: C.amber, marginTop: 8 }}>⚠️ Only upload once Gas Safe Register has authorised you to use it digitally.</div>

        created_at: m.created_at,              </div>

        created_at: m.created_at,            )}

        created_at: m.created_at,          </div>

        created_at: m.created_at,        )}

        created_at: m.created_at,      </div>

        created_at: m.created_at,

        created_at: m.created_at,      {/* Gas Safe Certificates — Sequential Numbering */}

        created_at: m.created_at,      <div style={S.card}>

        created_at: m.created_at,        <div style={S.sectionTitle}>Certificate Numbering</div>

        created_at: m.created_at,        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>

        created_at: m.created_at,          Sequential certificate reference numbers for your audit trail. Each certificate gets the next number automatically.

        created_at: m.created_at,        </div>

        created_at: m.created_at,        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>

        created_at: m.created_at,          <div>

        created_at: m.created_at,            <label style={S.label}>Certificate Prefix</label>

        created_at: m.created_at,            <input style={S.input} placeholder="e.g. GS or your initials" value={brand.certPrefix || "CERT"} onChange={set("certPrefix")} />

        created_at: m.created_at,            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Creates: {(brand.certPrefix || "CERT")}-001</div>

        created_at: m.created_at,          </div>

        created_at: m.created_at,          <div>

        created_at: m.created_at,            <label style={S.label}>Next Certificate Number</label>

        created_at: m.created_at,            <input style={S.input} type="number" min="1" value={brand.certNextNumber || 1} onChange={e => setBrand(b => ({ ...b, certNextNumber: parseInt(e.target.value) || 1 }))} />

        created_at: m.created_at,          </div>

        created_at: m.created_at,        </div>

        created_at: m.created_at,        <div style={{ background: C.surfaceHigh, borderRadius: 8, padding: 14 }}>

        created_at: m.created_at,          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Next certificate will be:</div>

        created_at: m.created_at,          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: C.amber }}>

        created_at: m.created_at,            {(brand.certPrefix || "CERT")}-{String(brand.certNextNumber || 1).padStart(3, "0")}

        created_at: m.created_at,          </div>

        created_at: m.created_at,        </div>

        created_at: m.created_at,      </div>

        created_at: m.created_at,      </>)}

        created_at: m.created_at,

        created_at: m.created_at,      {subview === "ai-assistant" && (<>

        created_at: m.created_at,      <div style={S.card}>

        created_at: m.created_at,        <div style={S.sectionTitle}>Your Assistant</div>

        created_at: m.created_at,        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>

        created_at: m.created_at,          Name your AI, set its personality, choose wake words, and teach it your own voice commands.

        created_at: m.created_at,        </div>

        created_at: m.created_at,        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>

        created_at: m.created_at,          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: C.surfaceHigh, borderRadius: 8, border: `1px solid ${C.border}` }}>

        created_at: m.created_at,            <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>Name</div>

        created_at: m.created_at,            <div style={{ fontSize: 13, fontWeight: 700, color: C.amber }}>{assistantName || "Trade PA"}</div>

        created_at: m.created_at,          </div>

        created_at: m.created_at,          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: C.surfaceHigh, borderRadius: 8, border: `1px solid ${C.border}` }}>

        created_at: m.created_at,            <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>Wake words</div>

        created_at: m.created_at,            <div style={{ fontSize: 12, color: C.text, fontFamily: "'DM Mono',monospace" }}>{(assistantWakeWords || []).slice(0, 2).join(", ")}{(assistantWakeWords || []).length > 2 ? ` +${assistantWakeWords.length - 2}` : ""}</div>

        created_at: m.created_at,          </div>

        created_at: m.created_at,          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: C.surfaceHigh, borderRadius: 8, border: `1px solid ${C.border}` }}>

        created_at: m.created_at,            <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>Custom commands</div>

        created_at: m.created_at,            <div style={{ fontSize: 13, fontWeight: 700, color: (userCommandsCount || 0) > 0 ? C.green : C.muted }}>{userCommandsCount || 0}</div>

        created_at: m.created_at,          </div>

        created_at: m.created_at,        </div>

        created_at: m.created_at,        <button onClick={() => openAssistantSetup && openAssistantSetup()} style={{ ...S.btn("primary"), width: "100%", justifyContent: "center" }}>

        created_at: m.created_at,          ⚙ Manage assistant

        created_at: m.created_at,        </button>

        created_at: m.created_at,      </div>

        created_at: m.created_at,      </>)}

        created_at: m.created_at,

        created_at: m.created_at,      {subview === "phone-calls" && (

        created_at: m.created_at,      <div style={S.card}>

        created_at: m.created_at,        <div style={S.sectionTitle}>Call Tracking</div>

        created_at: m.created_at,        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>

        created_at: m.created_at,          AI-powered call recording and transcription. Known customers who call are automatically recorded, transcribed and linked to their job or customer record. Unknown callers pass straight through unrecorded.

        created_at: m.created_at,        </div>

        created_at: m.created_at,        <CallTrackingSettings user={user} />

        created_at: m.created_at,      </div>

        created_at: m.created_at,      )}

        created_at: m.created_at,

        created_at: m.created_at,      {subview === "notifications" && (

        created_at: m.created_at,      <div style={S.card}>

        created_at: m.created_at,        <div style={S.sectionTitle}>Evening Schedule Briefing</div>

        created_at: m.created_at,        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>

        created_at: m.created_at,          Get a text message each evening with your schedule for the next day — so you're always prepared. Sends even when nothing is booked, so you always know the app is working.

        created_at: m.created_at,        </div>

        created_at: m.created_at,

        created_at: m.created_at,        {/* Toggle */}

        created_at: m.created_at,        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: C.surfaceHigh, borderRadius: 8, marginBottom: 12, cursor: "pointer" }}

        created_at: m.created_at,          onClick={() => setBrand(b => ({ ...b, eveningBriefing: !b.eveningBriefing }))}>

        created_at: m.created_at,          <div>

        created_at: m.created_at,            <div style={{ fontSize: 13, fontWeight: 600 }}>Send evening briefing</div>

        created_at: m.created_at,            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>

        created_at: m.created_at,              SMS to {brand.phone || "your phone number"}{!brand.phone && <span style={{ color: C.amber }}> — set your phone number above first</span>}

        created_at: m.created_at,            </div>

        created_at: m.created_at,          </div>

        created_at: m.created_at,          <div style={{ width: 44, height: 24, borderRadius: 12, background: brand.eveningBriefing ? C.amber : C.border, position: "relative", flexShrink: 0, transition: "background 0.2s" }}>

        created_at: m.created_at,            <div style={{ position: "absolute", top: 2, left: brand.eveningBriefing ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px #0004" }} />

        created_at: m.created_at,          </div>

        created_at: m.created_at,        </div>

        created_at: m.created_at,

        created_at: m.created_at,        {/* Time picker — only shown when enabled */}

        created_at: m.created_at,        {brand.eveningBriefing && (

        created_at: m.created_at,          <div>

        created_at: m.created_at,            <label style={S.label}>Send time</label>

        created_at: m.created_at,            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>

        created_at: m.created_at,              <input

        created_at: m.created_at,                type="time"

        created_at: m.created_at,                style={{ ...S.input, maxWidth: 140 }}

        created_at: m.created_at,                value={brand.eveningBriefingTime || "18:00"}

        created_at: m.created_at,                onChange={e => setBrand(b => ({ ...b, eveningBriefingTime: e.target.value }))}

        created_at: m.created_at,              />

        created_at: m.created_at,              <div style={{ fontSize: 11, color: C.muted }}>UK time · default 6:00 PM</div>

        created_at: m.created_at,            </div>

        created_at: m.created_at,            <div style={{ marginTop: 12, padding: "10px 14px", background: C.green + "11", border: `1px solid ${C.green}33`, borderRadius: 8, fontSize: 11, color: C.green, lineHeight: 1.6 }}>

        created_at: m.created_at,              ✓ Briefing active — you'll receive a text each evening at {brand.eveningBriefingTime || "18:00"} with tomorrow's schedule.

        created_at: m.created_at,            </div>

        created_at: m.created_at,          </div>

        created_at: m.created_at,        )}

        created_at: m.created_at,

        created_at: m.created_at,        {/* ── Calendar Subscription (live iCal feed) ─────────────────────────

        created_at: m.created_at,            One-time setup — generates a private URL the user adds to Google

        created_at: m.created_at,            or Apple Calendar as a "subscribed calendar". Their calendar then

        created_at: m.created_at,            auto-refreshes every few hours, so jobs booked in Trade PA appear

        created_at: m.created_at,            on their phone calendar without manual export. */}

        created_at: m.created_at,        <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>

        created_at: m.created_at,          <div style={S.sectionTitle}>Calendar Subscription</div>

        created_at: m.created_at,          <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>

        created_at: m.created_at,            Sync your Trade PA schedule to Google Calendar, Apple Calendar or any iCal-compatible app. Jobs you book in Trade PA appear automatically — no manual export each time.

        created_at: m.created_at,          </div>

        created_at: m.created_at,          {brand.calendarToken ? (

        created_at: m.created_at,            <>

        created_at: m.created_at,              <label style={S.label}>Your private subscription URL</label>

        created_at: m.created_at,              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>

        created_at: m.created_at,                <input

        created_at: m.created_at,                  readOnly

        created_at: m.created_at,                  style={{ ...S.input, fontFamily: "'DM Mono',monospace", fontSize: 11 }}

        created_at: m.created_at,                  value={`${typeof window !== "undefined" ? window.location.origin : "https://www.tradespa.co.uk"}/api/calendar/${brand.calendarToken}.ics`}

        created_at: m.created_at,                  onClick={e => e.target.select()}

        created_at: m.created_at,                />

        created_at: m.created_at,                <button

        created_at: m.created_at,                  onClick={() => {

        created_at: m.created_at,                    const url = `${window.location.origin}/api/calendar/${brand.calendarToken}.ics`;

        created_at: m.created_at,                    if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});

        created_at: m.created_at,                  }}

        created_at: m.created_at,                  style={{ ...S.btn("ghost"), fontSize: 11 }}

        created_at: m.created_at,                >Copy</button>

        created_at: m.created_at,              </div>

        created_at: m.created_at,              <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", fontSize: 11, color: C.textDim, lineHeight: 1.7, marginBottom: 10 }}>

        created_at: m.created_at,                <div style={{ fontWeight: 600, color: C.text, marginBottom: 6 }}>How to subscribe</div>

        created_at: m.created_at,                <div><strong>Google Calendar:</strong> Settings → Add calendar → From URL → paste the link.</div>

        created_at: m.created_at,                <div><strong>Apple (iPhone):</strong> Settings app → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar → paste the link.</div>

        created_at: m.created_at,                <div><strong>Apple (Mac):</strong> Calendar app → File → New Calendar Subscription → paste the link.</div>

        created_at: m.created_at,                <div style={{ marginTop: 8, color: C.muted }}>Calendars typically refresh every few hours — for instant updates, set the refresh interval to "every hour" in your calendar app's subscription settings.</div>

        created_at: m.created_at,              </div>

        created_at: m.created_at,              <button

        created_at: m.created_at,                onClick={() => {

        created_at: m.created_at,                  if (!confirm("Generate a new URL? The old one will stop working — you'll need to update any calendars subscribed to it.")) return;

        created_at: m.created_at,                  const t = Array.from(crypto.getRandomValues(new Uint8Array(24)))

        created_at: m.created_at,                    .map(b => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");

        created_at: m.created_at,                  setBrand(b => ({ ...b, calendarToken: t }));

        created_at: m.created_at,                }}

        created_at: m.created_at,                style={{ ...S.btn("ghost"), fontSize: 11, color: C.muted }}

        created_at: m.created_at,              >↻ Generate new URL (revoke old)</button>

        created_at: m.created_at,            </>

        created_at: m.created_at,          ) : (

        created_at: m.created_at,            <button

        created_at: m.created_at,              onClick={() => {

        created_at: m.created_at,                // 24-byte cryptographically random token, 36-char alphanumeric

        created_at: m.created_at,                const t = Array.from(crypto.getRandomValues(new Uint8Array(24)))

        created_at: m.created_at,                  .map(b => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");

        created_at: m.created_at,                setBrand(b => ({ ...b, calendarToken: t }));

        created_at: m.created_at,              }}

        created_at: m.created_at,              style={S.btn("primary")}

        created_at: m.created_at,            >Generate Subscription URL</button>

        created_at: m.created_at,          )}

        created_at: m.created_at,        </div>

        created_at: m.created_at,      </div>

        created_at: m.created_at,      )}

        created_at: m.created_at,

        created_at: m.created_at,      {subview === "team" && (

        created_at: m.created_at,      <div style={S.card}>

        created_at: m.created_at,        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>

        created_at: m.created_at,          <div style={S.sectionTitle}>Team Access</div>

        created_at: m.created_at,          {userRole === "owner" && <TeamInvite companyId={companyId} planTier={planTier} currentMemberCount={members.length} userLimit={userLimit} />}

        created_at: m.created_at,        </div>

        created_at: m.created_at,

        created_at: m.created_at,        <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8, marginBottom: 14 }}>

        created_at: m.created_at,          <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>Company Workspace</div>

        created_at: m.created_at,          <div style={{ fontSize: 13, fontWeight: 600 }}>{companyName || "Your Business"}</div>

        created_at: m.created_at,          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>All team members share the same data. Owners can control which sections each member can access.</div>

        created_at: m.created_at,        </div>

        created_at: m.created_at,

        created_at: m.created_at,        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>Team Members</div>

        created_at: m.created_at,        {members.map((m, i) => {

        created_at: m.created_at,          const isMe = m.user_id === user?.id;

        created_at: m.created_at,          const isOwner = m.role === "owner";

        created_at: m.created_at,          const email = m.invited_email || m.users?.email || "Team member";

        created_at: m.created_at,          const initials = email[0].toUpperCase();

        created_at: m.created_at,          const perms = m.permissions || {};

        created_at: m.created_at,          const ALL_SECTIONS = ["Dashboard", "Schedule", "Jobs", "Customers", "Invoices", "Quotes", "Materials", "Expenses", "CIS", "AI Assistant", "Reminders", "Payments", "Inbox", "Reports", "Mileage", "Workers", "Subcontractors", "Documents", "Reviews", "Stock", "RAMS"];

        created_at: m.created_at,

        created_at: m.created_at,          return (

        created_at: m.created_at,            <div key={i} style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 14, marginBottom: 14 }}>

        created_at: m.created_at,              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: isOwner || isMe ? 0 : 12 }}>

        created_at: m.created_at,                <div style={{ width: 32, height: 32, borderRadius: "50%", background: isMe ? C.amber + "22" : C.surfaceHigh, border: `1px solid ${isMe ? C.amber + "44" : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: isMe ? C.amber : C.muted, flexShrink: 0 }}>

        created_at: m.created_at,                  {initials}

        created_at: m.created_at,                </div>

        created_at: m.created_at,                <div style={{ flex: 1 }}>

        created_at: m.created_at,                  <div style={{ fontSize: 13 }}>{email}{isMe ? " (You)" : ""}</div>

        created_at: m.created_at,                </div>

        created_at: m.created_at,                <div style={S.badge(isOwner ? C.amber : C.blue)}>{m.role}</div>

        created_at: m.created_at,              </div>

        created_at: m.created_at,

        created_at: m.created_at,              {/* Permission toggles — only shown for non-owners, only editable by the account owner */}

        created_at: m.created_at,              {!isOwner && (

        created_at: m.created_at,                <div style={{ marginTop: 12, paddingLeft: 44 }}>

        created_at: m.created_at,                  <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Section Access</div>

        created_at: m.created_at,                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>

        created_at: m.created_at,                    {ALL_SECTIONS.map(section => {

        created_at: m.created_at,                      const allowed = perms[section] !== false;

        created_at: m.created_at,                      const canEdit = userRole === "owner" && !isMe;

        created_at: m.created_at,                      return (

        created_at: m.created_at,                        <button

        created_at: m.created_at,                          key={section}

        created_at: m.created_at,                          disabled={!canEdit}

        created_at: m.created_at,                          onClick={async () => {

        created_at: m.created_at,                            if (!canEdit) return;

        created_at: m.created_at,                            const newPerms = { ...perms, [section]: !allowed };

        created_at: m.created_at,                            const updated = members.map((mem, j) => j === i ? { ...mem, permissions: newPerms } : mem);

        created_at: m.created_at,                            // Update in Supabase

        created_at: m.created_at,                            try {

        created_at: m.created_at,                              await db.from("company_members")

        created_at: m.created_at,                                .update({ permissions: newPerms })

        created_at: m.created_at,                                .eq("company_id", companyId)

        created_at: m.created_at,                                .eq("user_id", m.user_id);

        created_at: m.created_at,                            } catch (e) { console.error("Permission update failed:", e); }

        created_at: m.created_at,                          }}

        created_at: m.created_at,                          style={{

        created_at: m.created_at,                            padding: "3px 10px", borderRadius: 12, fontSize: 10, fontFamily: "'DM Mono',monospace", fontWeight: 600,

        created_at: m.created_at,                            border: `1px solid ${allowed ? C.green + "66" : C.border}`,

        created_at: m.created_at,                            background: allowed ? C.green + "18" : C.surfaceHigh,

        created_at: m.created_at,                            color: allowed ? C.green : C.muted,

        created_at: m.created_at,                            cursor: canEdit ? "pointer" : "default",

        created_at: m.created_at,                            opacity: canEdit ? 1 : 0.7,

        created_at: m.created_at,                          }}

        created_at: m.created_at,                        >

        created_at: m.created_at,                          {allowed ? "✓" : "✗"} {section}

        created_at: m.created_at,                        </button>

        created_at: m.created_at,                      );

        created_at: m.created_at,                    })}

        created_at: m.created_at,                  </div>

        created_at: m.created_at,                  {!userRole === "owner" && <div style={{ fontSize: 10, color: C.muted, marginTop: 6 }}>Only the owner can change permissions.</div>}

        created_at: m.created_at,                </div>

        created_at: m.created_at,              )}

        created_at: m.created_at,              {isOwner && !isMe && (

        created_at: m.created_at,                <div style={{ paddingLeft: 44, marginTop: 6, fontSize: 11, color: C.muted }}>Owners always have full access to all sections.</div>

        created_at: m.created_at,              )}

        created_at: m.created_at,            </div>

        created_at: m.created_at,          );

        created_at: m.created_at,        })}

        created_at: m.created_at,

        created_at: m.created_at,        {userRole !== "owner" && (

        created_at: m.created_at,          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Contact the account owner to change your access permissions.</div>

        created_at: m.created_at,        )}

        created_at: m.created_at,      </div>

        created_at: m.created_at,      )}

        created_at: m.created_at,

        created_at: m.created_at,      {subview === "recently-deleted" && (

        created_at: m.created_at,        <RecentlyDeleted user={user} />

        created_at: m.created_at,      )}

        created_at: m.created_at,

        created_at: m.created_at,      {subview === "help" && (<>

        created_at: m.created_at,      {/* What's new row — fires a window event to open the changelog modal.

        created_at: m.created_at,          The modal state lives in the main App component (out of this

        created_at: m.created_at,          Settings component's scope), so we dispatch a custom event that

        created_at: m.created_at,          App listens for. Cleaner than prop-threading through the whole

        created_at: m.created_at,          Settings tree. */}

        created_at: m.created_at,      <button

        created_at: m.created_at,        onClick={() => window.dispatchEvent(new CustomEvent("tp:open-changelog"))}

        created_at: m.created_at,        style={{

        created_at: m.created_at,          background: C.surfaceHigh,

        created_at: m.created_at,          border: `1px solid ${C.border}`,

        created_at: m.created_at,          borderRadius: 12,

        created_at: m.created_at,          padding: "12px 14px",

        created_at: m.created_at,          display: "flex",

        created_at: m.created_at,          alignItems: "center",

        created_at: m.created_at,          justifyContent: "space-between",

        created_at: m.created_at,          gap: 12,

        created_at: m.created_at,          cursor: "pointer",

        created_at: m.created_at,          width: "100%",

        created_at: m.created_at,          textAlign: "left",

        created_at: m.created_at,          color: C.text,

        created_at: m.created_at,          fontFamily: "'DM Sans', sans-serif",

        created_at: m.created_at,        }}

        created_at: m.created_at,      >

        created_at: m.created_at,        <div style={{ minWidth: 0 }}>

        created_at: m.created_at,          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>What's new ✨</div>

        created_at: m.created_at,          <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 2 }}>See the latest features and improvements</div>

        created_at: m.created_at,        </div>

        created_at: m.created_at,        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">

        created_at: m.created_at,          <path d="M9 5l7 7-7 7" />

        created_at: m.created_at,        </svg>

        created_at: m.created_at,      </button>

        created_at: m.created_at,

        created_at: m.created_at,      {/* Send feedback row — opens the existing feedback modal */}

        created_at: m.created_at,      <button

        created_at: m.created_at,        onClick={openFeedback}

        created_at: m.created_at,        style={{

        created_at: m.created_at,          background: C.surfaceHigh,

        created_at: m.created_at,          border: `1px solid ${C.border}`,

        created_at: m.created_at,          borderRadius: 12,

        created_at: m.created_at,          padding: "12px 14px",

        created_at: m.created_at,          display: "flex",

        created_at: m.created_at,          alignItems: "center",

        created_at: m.created_at,          justifyContent: "space-between",

        created_at: m.created_at,          gap: 12,

        created_at: m.created_at,          cursor: "pointer",

        created_at: m.created_at,          width: "100%",

        created_at: m.created_at,          textAlign: "left",

        created_at: m.created_at,          color: C.text,

        created_at: m.created_at,          fontFamily: "'DM Sans', sans-serif",

        created_at: m.created_at,        }}

        created_at: m.created_at,      >

        created_at: m.created_at,        <div style={{ minWidth: 0 }}>

        created_at: m.created_at,          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>Send feedback</div>

        created_at: m.created_at,          <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 2 }}>Report a bug, suggest an idea, or tell us what's working</div>

        created_at: m.created_at,        </div>

        created_at: m.created_at,        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">

        created_at: m.created_at,          <path d="M9 5l7 7-7 7" />

        created_at: m.created_at,        </svg>

        created_at: m.created_at,      </button>

        created_at: m.created_at,

        created_at: m.created_at,      {/* Email support row */}

        created_at: m.created_at,      <a

        created_at: m.created_at,        href="mailto:hello@tradespa.co.uk?subject=Trade%20PA%20support"

        created_at: m.created_at,        style={{

        created_at: m.created_at,          background: C.surfaceHigh,

        created_at: m.created_at,          border: `1px solid ${C.border}`,

        created_at: m.created_at,          borderRadius: 12,

        created_at: m.created_at,          padding: "12px 14px",

        created_at: m.created_at,          display: "flex",

        created_at: m.created_at,          alignItems: "center",

        created_at: m.created_at,          justifyContent: "space-between",

        created_at: m.created_at,          gap: 12,

        created_at: m.created_at,          textDecoration: "none",

        created_at: m.created_at,          color: C.text,

        created_at: m.created_at,        }}

        created_at: m.created_at,      >

        created_at: m.created_at,        <div style={{ minWidth: 0 }}>

        created_at: m.created_at,          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>Email us</div>

        created_at: m.created_at,          <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 2, fontFamily: "'DM Mono', monospace" }}>hello@tradespa.co.uk</div>

        created_at: m.created_at,        </div>

        created_at: m.created_at,        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">

        created_at: m.created_at,          <path d="M9 5l7 7-7 7" />

        created_at: m.created_at,        </svg>

        created_at: m.created_at,      </a>

        created_at: m.created_at,

        created_at: m.created_at,      {/* Visit website row */}

        created_at: m.created_at,      <a

        created_at: m.created_at,        href="https://tradespa.co.uk"

        created_at: m.created_at,        target="_blank"

        created_at: m.created_at,        rel="noopener noreferrer"

        created_at: m.created_at,        style={{

        created_at: m.created_at,          background: C.surfaceHigh,

        created_at: m.created_at,          border: `1px solid ${C.border}`,

        created_at: m.created_at,          borderRadius: 12,

        created_at: m.created_at,          padding: "12px 14px",

        created_at: m.created_at,          display: "flex",

        created_at: m.created_at,          alignItems: "center",

        created_at: m.created_at,          justifyContent: "space-between",

        created_at: m.created_at,          gap: 12,

        created_at: m.created_at,          textDecoration: "none",

        created_at: m.created_at,          color: C.text,

        created_at: m.created_at,        }}

        created_at: m.created_at,      >

        created_at: m.created_at,        <div style={{ minWidth: 0 }}>

        created_at: m.created_at,          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>Visit website</div>

        created_at: m.created_at,          <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 2, fontFamily: "'DM Mono', monospace" }}>tradespa.co.uk</div>

        created_at: m.created_at,        </div>

        created_at: m.created_at,        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">

        created_at: m.created_at,          <path d="M7 17L17 7M17 7H9M17 7V15" />

        created_at: m.created_at,        </svg>

        created_at: m.created_at,      </a>

        created_at: m.created_at,      </>)}

        created_at: m.created_at,

        created_at: m.created_at,      {subview === "diagnostics" && (<>

        created_at: m.created_at,      {/* Generate report row — slim tappable, state changes during loading */}

        created_at: m.created_at,      <button

        created_at: m.created_at,        onClick={generateReport}

        created_at: m.created_at,        disabled={reportLoading}

        created_at: m.created_at,        style={{

        created_at: m.created_at,          background: C.surfaceHigh,

        created_at: m.created_at,          border: `1px solid ${C.border}`,

        created_at: m.created_at,          borderRadius: 12,

        created_at: m.created_at,          padding: "12px 14px",

        created_at: m.created_at,          display: "flex",

        created_at: m.created_at,          alignItems: "center",

        created_at: m.created_at,          justifyContent: "space-between",

        created_at: m.created_at,          gap: 12,

        created_at: m.created_at,          cursor: reportLoading ? "wait" : "pointer",

        created_at: m.created_at,          width: "100%",

        created_at: m.created_at,          textAlign: "left",

        created_at: m.created_at,          color: C.text,

        created_at: m.created_at,          fontFamily: "'DM Sans', sans-serif",

        created_at: m.created_at,          opacity: reportLoading ? 0.65 : 1,

        created_at: m.created_at,        }}

        created_at: m.created_at,      >

        created_at: m.created_at,        <div style={{ minWidth: 0 }}>

        created_at: m.created_at,          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>

        created_at: m.created_at,            {reportLoading ? "Generating report…" : "Generate error report"}

        created_at: m.created_at,          </div>

        created_at: m.created_at,          <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 2 }}>

        created_at: m.created_at,            Last 30 days of errors, PA mistakes, voice failures

        created_at: m.created_at,            {brand?.email && <span style={{ color: C.amber }}> · emails to {brand.email}</span>}

        created_at: m.created_at,          </div>

        created_at: m.created_at,        </div>

        created_at: m.created_at,        {reportLoading ? (

        created_at: m.created_at,          <div style={{ fontSize: 14, color: C.amber }}>⏳</div>

        created_at: m.created_at,        ) : (

        created_at: m.created_at,          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">

        created_at: m.created_at,            <path d="M9 5l7 7-7 7" />

        created_at: m.created_at,          </svg>

        created_at: m.created_at,        )}

        created_at: m.created_at,      </button>

        created_at: m.created_at,

        created_at: m.created_at,      {/* Error state */}

        created_at: m.created_at,      {reportError && (

        created_at: m.created_at,        <div style={{

        created_at: m.created_at,          background: `${C.red}14`,

        created_at: m.created_at,          border: `1px solid ${C.red}40`,

        created_at: m.created_at,          borderRadius: 10,

        created_at: m.created_at,          padding: "10px 14px",

        created_at: m.created_at,          fontSize: 12,

        created_at: m.created_at,          color: C.red,

        created_at: m.created_at,        }}>{reportError}</div>

        created_at: m.created_at,      )}

        created_at: m.created_at,

        created_at: m.created_at,      {/* Report ready panel */}

        created_at: m.created_at,      {reportText && (

        created_at: m.created_at,        <div style={{

        created_at: m.created_at,          background: C.surfaceHigh,

        created_at: m.created_at,          border: `1px solid ${reportText.startsWith("No errors") ? `${C.green}33` : C.border}`,

        created_at: m.created_at,          borderRadius: 12,

        created_at: m.created_at,          padding: 14,

        created_at: m.created_at,        }}>

        created_at: m.created_at,          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>

        created_at: m.created_at,            <div style={{

        created_at: m.created_at,              fontFamily: "'DM Mono', monospace",

        created_at: m.created_at,              fontSize: 10,

        created_at: m.created_at,              color: reportText.startsWith("No errors") ? C.green : C.amber,

        created_at: m.created_at,              fontWeight: 700,

        created_at: m.created_at,              letterSpacing: "0.1em",

        created_at: m.created_at,            }}>

        created_at: m.created_at,              {reportText.startsWith("No errors") ? "✓ NO ISSUES FOUND" : "📋 REPORT READY"}

        created_at: m.created_at,            </div>

        created_at: m.created_at,            <button

        created_at: m.created_at,              onClick={() => { navigator.clipboard.writeText(reportText); showToast("Copied to clipboard", "READY TO PASTE"); }}

        created_at: m.created_at,              style={{

        created_at: m.created_at,                fontFamily: "'DM Mono', monospace",

        created_at: m.created_at,                fontSize: 10,

        created_at: m.created_at,                letterSpacing: "0.08em",

        created_at: m.created_at,                fontWeight: 700,

        created_at: m.created_at,                color: C.amber,

        created_at: m.created_at,                background: "transparent",

        created_at: m.created_at,                border: "none",

        created_at: m.created_at,                cursor: "pointer",

        created_at: m.created_at,                padding: 0,

        created_at: m.created_at,                textTransform: "uppercase",

        created_at: m.created_at,              }}

        created_at: m.created_at,            >Copy</button>

        created_at: m.created_at,          </div>

        created_at: m.created_at,          <textarea

        created_at: m.created_at,            readOnly

        created_at: m.created_at,            value={reportText}

        created_at: m.created_at,            style={{ ...S.input, fontSize: 11, height: 180, resize: "vertical", fontFamily: "monospace", opacity: 0.8 }}

        created_at: m.created_at,          />

        created_at: m.created_at,          {!reportText.startsWith("No errors") && (

        created_at: m.created_at,            <div style={{ fontSize: 11, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>

        created_at: m.created_at,              Paste this into a Claude session with: <span style={{ color: C.amber, fontFamily: "'DM Mono',monospace" }}>"Fix these issues in my Trade PA App.jsx"</span>

        created_at: m.created_at,            </div>

        created_at: m.created_at,          )}

        created_at: m.created_at,        </div>

        created_at: m.created_at,      )}

        created_at: m.created_at,      </>)}

        created_at: m.created_at,

        created_at: m.created_at,      {/* Preview Modal */}

        created_at: m.created_at,      {preview && (

        created_at: m.created_at,        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 24 }} onClick={() => setPreview(false)}>

        created_at: m.created_at,          <div onClick={e => e.stopPropagation()} style={{ maxHeight: "90vh", overflowY: "auto", borderRadius: 12 }}>

        created_at: m.created_at,            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>

        created_at: m.created_at,              <div style={{ fontSize: 12, color: C.muted, fontFamily: "'DM Mono',monospace" }}>INVOICE PREVIEW</div>

        created_at: m.created_at,              <button aria-label="Close" onClick={() => setPreview(false)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>

        created_at: m.created_at,            </div>

        created_at: m.created_at,            <InvoicePreview brand={brand} />

        created_at: m.created_at,          </div>

        created_at: m.created_at,        </div>

        created_at: m.created_at,      )}

        created_at: m.created_at,      </>)}

        created_at: m.created_at,

        created_at: m.created_at,      {/* ─── Auto-save Toast ──────────────────────────────────────────────── */}

        created_at: m.created_at,      {toast && (

        created_at: m.created_at,        <div style={{

        created_at: m.created_at,          position: "fixed",

        created_at: m.created_at,          bottom: "max(24px, env(safe-area-inset-bottom, 24px))",

        created_at: m.created_at,          left: "50%",

        created_at: m.created_at,          transform: "translateX(-50%)",

        created_at: m.created_at,          zIndex: 500,

        created_at: m.created_at,          background: C.surface,

        created_at: m.created_at,          border: `1px solid ${C.green}40`,

        created_at: m.created_at,          borderRadius: 12,

        created_at: m.created_at,          padding: "10px 14px 10px 12px",

        created_at: m.created_at,          boxShadow: `0 12px 32px -8px rgba(0,0,0,0.6), 0 0 40px -8px ${C.green}30`,

        created_at: m.created_at,          display: "flex",

        created_at: m.created_at,          alignItems: "center",

        created_at: m.created_at,          gap: 10,

        created_at: m.created_at,          minWidth: 200,

        created_at: m.created_at,          maxWidth: "calc(100% - 32px)",

        created_at: m.created_at,          animation: "toast-in 200ms ease-out",

        created_at: m.created_at,        }}>

        created_at: m.created_at,          <div style={{

        created_at: m.created_at,            width: 28, height: 28,

        created_at: m.created_at,            borderRadius: "50%",

        created_at: m.created_at,            background: `${C.green}1f`,

        created_at: m.created_at,            border: `1px solid ${C.green}40`,

        created_at: m.created_at,            color: C.green,

        created_at: m.created_at,            display: "grid",

        created_at: m.created_at,            placeItems: "center",

        created_at: m.created_at,            flexShrink: 0,

        created_at: m.created_at,          }}>

        created_at: m.created_at,            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">

        created_at: m.created_at,              <polyline points="20 6 9 17 4 12" />

        created_at: m.created_at,            </svg>

        created_at: m.created_at,          </div>

        created_at: m.created_at,          <div style={{ minWidth: 0 }}>

        created_at: m.created_at,            <div style={{

        created_at: m.created_at,              fontFamily: "'DM Sans', sans-serif",

        created_at: m.created_at,              fontSize: 13,

        created_at: m.created_at,              fontWeight: 600,

        created_at: m.created_at,              color: C.text,

        created_at: m.created_at,              lineHeight: 1.2,

        created_at: m.created_at,            }}>{toast.text}</div>

        created_at: m.created_at,            {toast.sub && (

        created_at: m.created_at,              <div style={{

        created_at: m.created_at,                fontFamily: "'DM Mono', monospace",

        created_at: m.created_at,                fontSize: 9,

        created_at: m.created_at,                color: C.green,

        created_at: m.created_at,                letterSpacing: "0.1em",

        created_at: m.created_at,                marginTop: 2,

        created_at: m.created_at,                fontWeight: 700,

        created_at: m.created_at,              }}>{toast.sub}</div>

        created_at: m.created_at,            )}

        created_at: m.created_at,          </div>

        created_at: m.created_at,        </div>

        created_at: m.created_at,      )}

        created_at: m.created_at,

        created_at: m.created_at,      {/* ── Account section: delete account (Apple 5.1.1(v) compliance) ─── */}

        created_at: m.created_at,      <div style={{ ...S.card, marginTop: 16, border: `1px solid ${C.border}` }}>

        created_at: m.created_at,        <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>Account</div>

        created_at: m.created_at,        <div style={{ fontSize: 13, color: C.text, marginBottom: 6, fontWeight: 600 }}>Delete account</div>

        created_at: m.created_at,        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, marginBottom: 14 }}>

        created_at: m.created_at,          Permanently delete your Trade PA account and all your data — jobs, invoices, customers, materials, settings, AI conversation history. Any active subscription will be cancelled. This cannot be undone.

        created_at: m.created_at,        </div>

        created_at: m.created_at,        <button

        created_at: m.created_at,          onClick={() => { setDeleteModalOpen(true); setDeleteConfirmText(""); setDeleteError(""); }}

        created_at: m.created_at,          style={{

        created_at: m.created_at,            background: "transparent",

        created_at: m.created_at,            border: `1px solid ${C.red}`,

        created_at: m.created_at,            color: C.red,

        created_at: m.created_at,            padding: "10px 16px",

        created_at: m.created_at,            borderRadius: 8,

        created_at: m.created_at,            fontSize: 12,

        created_at: m.created_at,            fontWeight: 700,

        created_at: m.created_at,            fontFamily: "'DM Mono', monospace",

        created_at: m.created_at,            letterSpacing: "0.04em",

        created_at: m.created_at,            cursor: "pointer",

        created_at: m.created_at,          }}

        created_at: m.created_at,        >Delete account</button>

        created_at: m.created_at,      </div>

        created_at: m.created_at,

        created_at: m.created_at,      {/* Confirmation modal — must type email exactly to enable the button */}

        created_at: m.created_at,      {deleteModalOpen && (

        created_at: m.created_at,        <div

        created_at: m.created_at,          onClick={() => { if (!deletingAccount) setDeleteModalOpen(false); }}

        created_at: m.created_at,          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}

        created_at: m.created_at,        >

        created_at: m.created_at,          <div

        created_at: m.created_at,            onClick={(e) => e.stopPropagation()}

        created_at: m.created_at,            style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, maxWidth: 440, width: "100%" }}

        created_at: m.created_at,          >

        created_at: m.created_at,            <div style={{ fontSize: 16, fontWeight: 700, color: C.red, marginBottom: 8 }}>Delete account permanently?</div>

        created_at: m.created_at,            <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, marginBottom: 14 }}>

        created_at: m.created_at,              This will permanently remove your account and all associated data. This action cannot be undone.

        created_at: m.created_at,            </div>

        created_at: m.created_at,            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginBottom: 14 }}>

        created_at: m.created_at,              The following will be deleted forever:

        created_at: m.created_at,              <ul style={{ margin: "8px 0 0 0", paddingLeft: 18 }}>

        created_at: m.created_at,                <li>All jobs, invoices, quotes, and customers</li>

        created_at: m.created_at,                <li>Materials, expenses, mileage, CIS records</li>

        created_at: m.created_at,                <li>RAMS, certificates, documents, photos</li>

        created_at: m.created_at,                <li>AI Assistant conversation history and memory</li>

        created_at: m.created_at,                <li>Your business profile and settings</li>

        created_at: m.created_at,              </ul>

        created_at: m.created_at,            </div>

        created_at: m.created_at,            <div style={{ fontSize: 12, color: C.text, marginBottom: 6 }}>

        created_at: m.created_at,              To confirm, type your email address: <span style={{ fontFamily: "'DM Mono', monospace", color: C.amber }}>{user?.email}</span>

        created_at: m.created_at,            </div>

        created_at: m.created_at,            <input

        created_at: m.created_at,              type="email"

        created_at: m.created_at,              value={deleteConfirmText}

        created_at: m.created_at,              onChange={(e) => { setDeleteConfirmText(e.target.value); setDeleteError(""); }}

        created_at: m.created_at,              placeholder="your.email@example.com"

        created_at: m.created_at,              autoComplete="off"

        created_at: m.created_at,              autoCorrect="off"

        created_at: m.created_at,              autoCapitalize="off"

        created_at: m.created_at,              spellCheck={false}

        created_at: m.created_at,              disabled={deletingAccount}

        created_at: m.created_at,              style={{

        created_at: m.created_at,                width: "100%", boxSizing: "border-box",

        created_at: m.created_at,                background: C.surfaceHigh,

        created_at: m.created_at,                border: `1px solid ${C.border}`,

        created_at: m.created_at,                borderRadius: 8,

        created_at: m.created_at,                padding: "10px 14px",

        created_at: m.created_at,                color: C.text,

        created_at: m.created_at,                fontSize: 13,

        created_at: m.created_at,                fontFamily: "'DM Mono', monospace",

        created_at: m.created_at,                outline: "none",

        created_at: m.created_at,                marginBottom: 12,

        created_at: m.created_at,              }}

        created_at: m.created_at,            />

        created_at: m.created_at,            {deleteError && (

        created_at: m.created_at,              <div style={{ background: "#ef444422", border: "1px solid #ef444444", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: C.red, marginBottom: 12, lineHeight: 1.5 }}>

        created_at: m.created_at,                {deleteError}

        created_at: m.created_at,              </div>

        created_at: m.created_at,            )}

        created_at: m.created_at,            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>

        created_at: m.created_at,              <button

        created_at: m.created_at,                onClick={() => { if (!deletingAccount) setDeleteModalOpen(false); }}

        created_at: m.created_at,                disabled={deletingAccount}

        created_at: m.created_at,                style={{

        created_at: m.created_at,                  background: "transparent",

        created_at: m.created_at,                  border: `1px solid ${C.border}`,

        created_at: m.created_at,                  color: C.text,

        created_at: m.created_at,                  padding: "10px 16px",

        created_at: m.created_at,                  borderRadius: 8,

        created_at: m.created_at,                  fontSize: 12,

        created_at: m.created_at,                  fontWeight: 700,

        created_at: m.created_at,                  fontFamily: "'DM Mono', monospace",

        created_at: m.created_at,                  cursor: deletingAccount ? "not-allowed" : "pointer",

        created_at: m.created_at,                  opacity: deletingAccount ? 0.5 : 1,

        created_at: m.created_at,                }}

        created_at: m.created_at,              >Cancel</button>

        created_at: m.created_at,              <button

        created_at: m.created_at,                onClick={handleDeleteAccount}

        created_at: m.created_at,                disabled={deletingAccount || deleteConfirmText.trim().toLowerCase() !== (user?.email || "").toLowerCase()}

        created_at: m.created_at,                style={{

        created_at: m.created_at,                  background: C.red,

        created_at: m.created_at,                  border: "none",

        created_at: m.created_at,                  color: "#fff",

        created_at: m.created_at,                  padding: "10px 16px",

        created_at: m.created_at,                  borderRadius: 8,

        created_at: m.created_at,                  fontSize: 12,

        created_at: m.created_at,                  fontWeight: 700,

        created_at: m.created_at,                  fontFamily: "'DM Mono', monospace",

        created_at: m.created_at,                  cursor: (deletingAccount || deleteConfirmText.trim().toLowerCase() !== (user?.email || "").toLowerCase()) ? "not-allowed" : "pointer",

        created_at: m.created_at,                  opacity: (deletingAccount || deleteConfirmText.trim().toLowerCase() !== (user?.email || "").toLowerCase()) ? 0.5 : 1,

        created_at: m.created_at,                }}

        created_at: m.created_at,              >{deletingAccount ? "Deleting…" : "Delete forever"}</button>

        created_at: m.created_at,            </div>

        created_at: m.created_at,          </div>

        created_at: m.created_at,        </div>

        created_at: m.created_at,      )}

        created_at: m.created_at,    </div>

        created_at: m.created_at,  );

        created_at: m.created_at,}

        created_at: m.created_at,

        created_at: m.created_at,// ─── Dashboard ────────────────────────────────────────────────────────────────

        created_at: m.created_at,// (Dashboard moved to ./views/Dashboard.jsx — P7-7A)

        created_at: m.created_at,

        created_at: m.created_at,// (Schedule helpers getWeekStart/formatDayLabel moved to ./views/Schedule.jsx — P7-7A)

        created_at: m.created_at,// (Schedule moved to ./views/Schedule.jsx — P7-7A)

        created_at: m.created_at,// (Materials cluster — MaterialRow + Materials moved to ./views/Materials.jsx — P7-7B)

        created_at: m.created_at,// ─── AI Assistant ─────────────────────────────────────────────────────────────

        created_at: m.created_at,// (AIAssistant moved to ./ai/AIAssistant.jsx — P10)

        created_at: m.created_at,

        created_at: m.created_at,

        created_at: m.created_at,// ─── Payments ─────────────────────────────────────────────────────────────────

        created_at: m.created_at,// (Payments moved to ./views/Invoices.jsx — P7-7C)

        created_at: m.created_at,

        created_at: m.created_at,

        created_at: m.created_at,

        created_at: m.created_at,

        created_at: m.created_at,// ─── Root ─────────────────────────────────────────────────────────────────────

        created_at: m.created_at,// ─── DetailContactRow — full-width contact row used in Customer Detail modal ──

        created_at: m.created_at,// Green tinted icon if value present (whole row is tappable to call/email/maps).

        created_at: m.created_at,// Dashed grey icon + "+ Add" CTA if value missing (tap routes to Edit).

        created_at: m.created_at,// (DetailContactRow moved to ./views/Customers.jsx — P7-7C)

        created_at: m.created_at,

        created_at: m.created_at,// ─── ContactIcon — 22px coloured square showing phone/email/address presence ──

        created_at: m.created_at,// Used by the Customers list and Customer Detail. Green when the field is set,

        created_at: m.created_at,// dashed grey outline when missing.

        created_at: m.created_at,// (ContactIcon moved to ./views/Customers.jsx — P7-7C)

        created_at: m.created_at,

        created_at: m.created_at,// ─── vCard parser (used by ImportContacts) ────────────────────────────────────

        created_at: m.created_at,// Parses a vCard (.vcf) file into customer-shaped objects.

        created_at: m.created_at,// Handles vCard 3.0 + 4.0 line folding, common parameter syntax, skips nameless cards.

        created_at: m.created_at,// (parseVCard moved to ./views/customers/ImportContacts.jsx — P7-7C)

        created_at: m.created_at,

        created_at: m.created_at,// ─── ImportContacts — smart device detection + preview ────────────────────────

        created_at: m.created_at,// Android Chrome: uses Contact Picker API (instant native picker).

        created_at: m.created_at,// iOS / desktop / unsupported: falls back to .vcf file upload.

        created_at: m.created_at,// Either path lands in a preview modal where the user picks which contacts

        created_at: m.created_at,// to import, then bulk-adds them via the parent's onImport callback.

        created_at: m.created_at,// (ImportContacts moved to ./views/customers/ImportContacts.jsx — P7-7C)

        created_at: m.created_at,

        created_at: m.created_at,// ─── Customers ────────────────────────────────────────────────────────────────

        created_at: m.created_at,// (Customers moved to ./views/Customers.jsx — P7-7C)

        created_at: m.created_at,

        created_at: m.created_at,// (CustomerForm moved to ./views/customers/CustomerForm.jsx — P7-7C)

        created_at: m.created_at,

        created_at: m.created_at,// ─── Invoices View ────────────────────────────────────────────────────────────

        created_at: m.created_at,// ─── Send Invoice/Quote by Email ─────────────────────────────────────────────

        created_at: m.created_at,// (sendDocumentEmail moved to ./views/Invoices.jsx — P7-7C)

        created_at: m.created_at,

        created_at: m.created_at,// (InvoicesView moved to ./views/Invoices.jsx — P7-7C)

        created_at: m.created_at,

        created_at: m.created_at,// ─── Quotes View ──────────────────────────────────────────────────────────────

        created_at: m.created_at,// (QuotesView moved to ./views/Invoices.jsx — P7-7C)

        created_at: m.created_at,

        created_at: m.created_at,// ─── Line Items Display ───────────────────────────────────────────────────────

        created_at: m.created_at,// (LineItemsDisplay moved to ./views/Invoices.jsx — P7-7C)

        created_at: m.created_at,

        created_at: m.created_at,// ─── CompanyForm — company name + address + multi-contact array editor ────────

        created_at: m.created_at,// Rendered inside the Add Customer modal when form.isCompany === true.

        created_at: m.created_at,// Domestic/single-contact users see CustomerForm instead. Parent holds:

        created_at: m.created_at,//   form          — { name: company name, address, notes, isCompany: true, ... }

        created_at: m.created_at,//   draftContacts — array of { tempId, name, role, phone, email, isPrimary, isBilling }

        created_at: m.created_at,// On save the parent creates 1 customer row + N contact rows transactionally.

        created_at: m.created_at,// (CompanyForm moved to ./views/customers/CompanyForm.jsx — P7-7C)

        created_at: m.created_at,

        created_at: m.created_at,// ─── InboxView (AI Email Agent) ───────────────────────────────────────────────

        created_at: m.created_at,// ────────────────────────────────────────────────────────────────────────────

        created_at: m.created_at,// Email-action dispatch — shared between the Inbox tab's Approve/Dismiss UI

        created_at: m.created_at,// AND the voice tools (approve_inbox_action, reject_inbox_action in AIAssistant).

        created_at: m.created_at,//

        created_at: m.created_at,// Previously the voice path just flipped the DB status without actually creating

        created_at: m.created_at,// the job / sending the reply / parsing the PDF, so voice-approvals looked like

        created_at: m.created_at,// they worked but were silent no-ops. Hoisting to module scope lets both paths

        created_at: m.created_at,// share the real dispatch logic. Callers pass an env bag of state + setters +

        created_at: m.created_at,// identity. `sendPush` is optional — voice omits it because the user triggered

        created_at: m.created_at,// the action themselves and doesn't need a push notification on the same device.

        created_at: m.created_at,// ────────────────────────────────────────────────────────────────────────────

        created_at: m.created_at,

        created_at: m.created_at,// (executeEmailAction moved to ./views/Inbox.jsx — P7-7B)

        created_at: m.created_at,// (updateEmailAIContext moved to ./views/Inbox.jsx — P7-7B)

        created_at: m.created_at,// (logEmailFeedback moved to ./views/Inbox.jsx — P7-7B)

        created_at: m.created_at,// (InboxView moved to ./views/Inbox.jsx — P7-7B)

        created_at: m.created_at,// (EnquiriesTab moved to ./views/Enquiries.jsx — P7-7B)

        created_at: m.created_at,// (buildComplianceDocHTML moved to ./views/Certificates.jsx — P7-7C)

        created_at: m.created_at,

        created_at: m.created_at,// (printComplianceDoc moved to ./views/Certificates.jsx — P7-7C)

        created_at: m.created_at,

        created_at: m.created_at,// (emailComplianceDoc moved to ./views/Certificates.jsx — P7-7C)

        created_at: m.created_at,

        created_at: m.created_at,// ─── Signature Pad ────────────────────────────────────────────────────────────

        created_at: m.created_at,// (SignaturePad moved to ./views/Certificates.jsx — P7-7C)

        created_at: m.created_at,

        created_at: m.created_at,// ─── Trade Certificates ───────────────────────────────────────────────────────

        created_at: m.created_at,// (CERT_CATEGORIES moved to ./views/Certificates.jsx — P7-7C)

        created_at: m.created_at,

        created_at: m.created_at,// Flatten for easy lookup

        created_at: m.created_at,// (TRADE_CERT_LIST moved to ./views/Certificates.jsx — P7-7C)

        created_at: m.created_at,

        created_at: m.created_at,// (buildCertHTML moved to ./views/Certificates.jsx — P7-7C)

        created_at: m.created_at,

        created_at: m.created_at,// ─── Certificates Tab (all trades) ────────────────────────────────────────────

        created_at: m.created_at,// (CertificatesTab moved to ./views/Certificates.jsx — P7-7C)

        created_at: m.created_at,

        created_at: m.created_at,// ─── Jobs Tab ─────────────────────────────────────────────────────────────────

        created_at: m.created_at,// (JobsTab moved to ./views/Jobs.jsx — P7-7C)

        created_at: m.created_at,

        created_at: m.created_at,

        created_at: m.created_at,// (MILEAGE_RATE moved to ./lib/constants.js — P1)

        created_at: m.created_at,

        created_at: m.created_at,// (ExpensesTab moved to ./views/Expenses.jsx — P7-7A)

        created_at: m.created_at,// (CISStatementsTab moved to ./views/CIS.jsx — P7-7A)

        created_at: m.created_at,// (ReportsTab moved to ./views/Reports.jsx — P7-7B)

        created_at: m.created_at,// (SubcontractorsTab moved to ./views/Subcontractors.jsx — P7-7B)

        created_at: m.created_at,// (RAMS cluster — HAZARD_LIBRARY/METHOD_LIBRARY/COSHH_SUBSTANCES/RAMSTab moved to ./views/RAMS.jsx — P7-7B)

        created_at: m.created_at,// (JobsHub moved to ./views/hubs/JobsHub.jsx — P8)

        created_at: m.created_at,// (DiaryHub moved to ./views/hubs/DiaryHub.jsx — P8)

        created_at: m.created_at,// (AccountsHub moved to ./views/hubs/AccountsHub.jsx — P8)

        created_at: m.created_at,// (PeopleHub moved to ./views/hubs/PeopleHub.jsx — P8)

        created_at: m.created_at,function AppInner() {

        created_at: m.created_at,  const [user, setUser] = useState(null);

        created_at: m.created_at,  const [authLoading, setAuthLoading] = useState(true);

        created_at: m.created_at,  const [subscriptionStatus, setSubscriptionStatus] = useState(null);

        created_at: m.created_at,  const [planTier, setPlanTier] = useState("solo");

        created_at: m.created_at,  const [userLimit, setUserLimit] = useState(1);

        created_at: m.created_at,  const [pwaPrompt, setPwaPrompt] = useState(null); // Android install prompt

        created_at: m.created_at,  const [showPwaBanner, setShowPwaBanner] = useState(false);

        created_at: m.created_at,  const [isIos, setIsIos] = useState(false);

        created_at: m.created_at,  const [isStandalone, setIsStandalone] = useState(false);

        created_at: m.created_at,  // Tablet detection — viewport-based, reactive to rotation. Catches

        created_at: m.created_at,  // iPad/Android tablets in any context (browser, PWA, native Capacitor).

        created_at: m.created_at,  // Takes precedence over isDesktopBrowser when both could be true (e.g.

        created_at: m.created_at,  // iPad in browser at 1024px — tablet layout wins).

        created_at: m.created_at,  const isTablet = useIsTablet();

        created_at: m.created_at,

        created_at: m.created_at,  // Desktop browser detection — true when running in a regular browser tab

        created_at: m.created_at,  // (not installed as PWA) AND the viewport is wide enough for the rail layout.

        created_at: m.created_at,  // Drives the desktop layout: left rail navigation, wider content area.

        created_at: m.created_at,  const [isDesktopBrowser, setIsDesktopBrowser] = useState(false);

        created_at: m.created_at,  useEffect(() => {

        created_at: m.created_at,    const update = () => {

        created_at: m.created_at,      const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

        created_at: m.created_at,      const wideEnough = window.innerWidth >= 900;

        created_at: m.created_at,      setIsDesktopBrowser(!standalone && wideEnough);

        created_at: m.created_at,    };

        created_at: m.created_at,    update();

        created_at: m.created_at,    window.addEventListener('resize', update);

        created_at: m.created_at,    return () => window.removeEventListener('resize', update);

        created_at: m.created_at,  }, []);

        created_at: m.created_at,

        created_at: m.created_at,  // ── Keyboard shortcuts (iPad-with-keyboard + desktop browser) ─────────

        created_at: m.created_at,  // Cmd/Ctrl + N — jump to view N (1=Home, 2=Enquiries, 3=Jobs, 4=Schedule,

        created_at: m.created_at,  //                5=Reminders, 6=Invoices, 7=Customers)

        created_at: m.created_at,  // Cmd/Ctrl + ,  — jump to Settings (Mac convention)

        created_at: m.created_at,  // Cmd/Ctrl + K  — focus AI input (jump to talk/type)

        created_at: m.created_at,  // Cmd/Ctrl + /  — toggle keyboard shortcuts cheat sheet

        created_at: m.created_at,  //

        created_at: m.created_at,  // Only fires when not inside an input/textarea/contenteditable, so typing

        created_at: m.created_at,  // in a field never accidentally triggers nav. Respects sensible defaults

        created_at: m.created_at,  // (Cmd+1 normally switches browser tab; we only override on iPad and

        created_at: m.created_at,  // when an interactive element doesn't already need the key).

        created_at: m.created_at,  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

        created_at: m.created_at,  useEffect(() => {

        created_at: m.created_at,    const isEditableTarget = (el) => {

        created_at: m.created_at,      if (!el) return false;

        created_at: m.created_at,      const tag = el.tagName;

        created_at: m.created_at,      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;

        created_at: m.created_at,      if (el.isContentEditable) return true;

        created_at: m.created_at,      return false;

        created_at: m.created_at,    };

        created_at: m.created_at,    const VIEW_FOR_KEY = {

        created_at: m.created_at,      "1": "AI Assistant",

        created_at: m.created_at,      "2": "Enquiries",

        created_at: m.created_at,      "3": "Jobs",

        created_at: m.created_at,      "4": "Schedule",

        created_at: m.created_at,      "5": "Reminders",

        created_at: m.created_at,      "6": "Invoices",

        created_at: m.created_at,      "7": "Customers",

        created_at: m.created_at,    };

        created_at: m.created_at,    const onKeyDown = (e) => {

        created_at: m.created_at,      const mod = e.metaKey || e.ctrlKey;

        created_at: m.created_at,      if (!mod) return;

        created_at: m.created_at,      // Ignore if user is typing somewhere

        created_at: m.created_at,      if (isEditableTarget(e.target)) return;

        created_at: m.created_at,

        created_at: m.created_at,      // Cmd/Ctrl + 1..7 — view jumps

        created_at: m.created_at,      if (VIEW_FOR_KEY[e.key]) {

        created_at: m.created_at,        e.preventDefault();

        created_at: m.created_at,        setView(VIEW_FOR_KEY[e.key]);

        created_at: m.created_at,        return;

        created_at: m.created_at,      }

        created_at: m.created_at,      // Cmd/Ctrl + , — Settings (Mac convention)

        created_at: m.created_at,      if (e.key === ",") {

        created_at: m.created_at,        e.preventDefault();

        created_at: m.created_at,        setView("Settings");

        created_at: m.created_at,        return;

        created_at: m.created_at,      }

        created_at: m.created_at,      // Cmd/Ctrl + K — focus AI input. AIAssistant listens for this event.

        created_at: m.created_at,      if (e.key === "k" || e.key === "K") {

        created_at: m.created_at,        e.preventDefault();

        created_at: m.created_at,        setView("AI Assistant");

        created_at: m.created_at,        // Defer until after the view switch + AIAssistant becomes visible

        created_at: m.created_at,        setTimeout(() => {

        created_at: m.created_at,          window.dispatchEvent(new CustomEvent("tp:focus-ai-input"));

        created_at: m.created_at,        }, 50);

        created_at: m.created_at,        return;

        created_at: m.created_at,      }

        created_at: m.created_at,      // Cmd/Ctrl + / — toggle the cheat sheet overlay

        created_at: m.created_at,      if (e.key === "/" || e.key === "?") {

        created_at: m.created_at,        e.preventDefault();

        created_at: m.created_at,        setShowShortcutsHelp(s => !s);

        created_at: m.created_at,        return;

        created_at: m.created_at,      }

        created_at: m.created_at,    };

        created_at: m.created_at,    window.addEventListener("keydown", onKeyDown);

        created_at: m.created_at,    return () => window.removeEventListener("keydown", onKeyDown);

        created_at: m.created_at,  }, []);

        created_at: m.created_at,

        created_at: m.created_at,  // Pre-warm the offline cache shortly after login — fetches every

        created_at: m.created_at,  // cached table in the background so the user has everything available

        created_at: m.created_at,  // if they go offline immediately. 2s delay lets the app's own initial

        created_at: m.created_at,  // loads go first. Fire-and-forget; no UI feedback.

        created_at: m.created_at,  useEffect(() => {

        created_at: m.created_at,    if (!user?.id) return;

        created_at: m.created_at,    let cancelled = false;

        created_at: m.created_at,    const t = setTimeout(() => {

        created_at: m.created_at,      if (!cancelled) prewarmCache();

        created_at: m.created_at,    }, 2000);

        created_at: m.created_at,    return () => { cancelled = true; clearTimeout(t); };

        created_at: m.created_at,  }, [user?.id]);

        created_at: m.created_at,

        created_at: m.created_at,  // Drain any pending writes queued from a previous session. Covers the

        created_at: m.created_at,  // case where the user wrote offline, then closed the tab before signal

        created_at: m.created_at,  // returned. OfflineBanner handles the live offline→online transition;

        created_at: m.created_at,  // this handles "user already online when app starts up".

        created_at: m.created_at,  useEffect(() => {

        created_at: m.created_at,    if (!user?.id) return;

        created_at: m.created_at,    if (typeof navigator !== "undefined" && !navigator.onLine) return;

        created_at: m.created_at,    const t = setTimeout(() => { drainQueue(); }, 3000);

        created_at: m.created_at,    return () => clearTimeout(t);

        created_at: m.created_at,  }, [user?.id]);

        created_at: m.created_at,

        created_at: m.created_at,  const [pdfHtml, setPdfHtml] = useState(null);

        created_at: m.created_at,  const [offlineSettingsOpen, setOfflineSettingsOpen] = useState(false);

        created_at: m.created_at,  const [changelogOpen, setChangelogOpen] = useState(false);

        created_at: m.created_at,

        created_at: m.created_at,  // Listen for changelog-open events fired by other components (e.g. the

        created_at: m.created_at,  // "What's new" row inside Settings, which lives in a separate component

        created_at: m.created_at,  // and can't see setChangelogOpen directly).

        created_at: m.created_at,  useEffect(() => {

        created_at: m.created_at,    const onOpen = () => setChangelogOpen(true);

        created_at: m.created_at,    window.addEventListener("tp:open-changelog", onOpen);

        created_at: m.created_at,    return () => window.removeEventListener("tp:open-changelog", onOpen);

        created_at: m.created_at,  }, []);

        created_at: m.created_at,  const [viewRaw, setViewRaw] = useState(() => {

        created_at: m.created_at,    const params = new URLSearchParams(window.location.search);

        created_at: m.created_at,    if (params.has('xero') || params.has('qb')) return "Settings";

        created_at: m.created_at,    if (params.has('stripe_connect')) return "Settings";

        created_at: m.created_at,    if (params.has('email_connected') || params.has('email_error')) return "Inbox";

        created_at: m.created_at,    return "AI Assistant";

        created_at: m.created_at,  });

        created_at: m.created_at,  const [activeCategory, setActiveCategory] = useState(() => {

        created_at: m.created_at,    const params = new URLSearchParams(window.location.search);

        created_at: m.created_at,    if (params.has('xero') || params.has('qb')) return "admin";

        created_at: m.created_at,    if (params.has('stripe_connect')) return "admin";

        created_at: m.created_at,    if (params.has('email_connected') || params.has('email_error')) return "admin";

        created_at: m.created_at,    return "work";

        created_at: m.created_at,  });

        created_at: m.created_at,  const view = viewRaw;

        created_at: m.created_at,  const setView = (v) => {

        created_at: m.created_at,    setViewRaw(v);

        created_at: m.created_at,    const grp = viewGroup(v);

        created_at: m.created_at,    if (grp) setActiveCategory(grp);

        created_at: m.created_at,  };

        created_at: m.created_at,  const [brand, setBrand] = useState(DEFAULT_BRAND);

        created_at: m.created_at,  const { reminders, add, dismiss, markFired, remove } = useReminders(user?.id);

        created_at: m.created_at,  const [dueNow, setDueNow] = useState([]);

        created_at: m.created_at,  const [bellFlash, setBellFlash] = useState(false);

        created_at: m.created_at,  const [twilioDevice, setTwilioDevice] = useState(null);

        created_at: m.created_at,  const twilioDeviceRef = useRef(null);

        created_at: m.created_at,  const [incomingCall, setIncomingCall] = useState(null);

        created_at: m.created_at,  const [activeCall, setActiveCall] = useState(null);

        created_at: m.created_at,  const [callMuted, setCallMuted] = useState(false);

        created_at: m.created_at,  const [callSpeaker, setCallSpeaker] = useState(true); // browser defaults to speaker

        created_at: m.created_at,  const [micBlocked, setMicBlocked] = useState(false);

        created_at: m.created_at,  const [helpOpen, setHelpOpen] = useState(false);

        created_at: m.created_at,  const [feedbackOpen, setFeedbackOpen] = useState(false);

        created_at: m.created_at,  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);

        created_at: m.created_at,  // Session D — voice-handle + hands-free mirror so Home can drive the AI directly

        created_at: m.created_at,  const voiceHandle = useRef({ startVoice() {}, toggleHandsFree() {}, sendText() {} });

        created_at: m.created_at,  const [aiHandsFree, setAiHandsFree] = useState(false);

        created_at: m.created_at,  const [helpSlug, setHelpSlug] = useState(null);

        created_at: m.created_at,

        created_at: m.created_at,  // Phase 5a: AI overlay — null when closed, or { context: "Viewing: …" } when open.

        created_at: m.created_at,  // Set by FloatingMicButton (below) and unset by the overlay close/back.

        created_at: m.created_at,  const [aiOverlay, setAiOverlay] = useState(null);

        created_at: m.created_at,

        created_at: m.created_at,  // Phase 5b: context hint set by detail pages (JobsTab, InvoicesView) when a

        created_at: m.created_at,  // record is selected. FloatingMicButton uses this for a richer context string.

        created_at: m.created_at,  const [contextHint, setContextHint] = useState(null);

        created_at: m.created_at,

        created_at: m.created_at,  // Top-level cache of pending inbox action count — so the voice assistant

        created_at: m.created_at,  // always knows how many approvals are waiting, even when the user didn't

        created_at: m.created_at,  // invoke voice from the Inbox tab. Loads on App mount, refreshes whenever

        created_at: m.created_at,  // InboxView or the voice approve/reject handlers fire the cross-surface

        created_at: m.created_at,  // "trade-pa-inbox-refreshed" event.

        created_at: m.created_at,  const [pendingInboxCount, setPendingInboxCount] = useState(0);

        created_at: m.created_at,  useEffect(() => {

        created_at: m.created_at,    if (!user?.id) return;

        created_at: m.created_at,    let cancelled = false;

        created_at: m.created_at,    const loadCount = async () => {

        created_at: m.created_at,      try {

        created_at: m.created_at,        const r = await fetch(`/api/email/actions?userId=${user.id}&status=pending`);

        created_at: m.created_at,        const d = await r.json();

        created_at: m.created_at,        if (!cancelled) setPendingInboxCount((d.actions || []).length);

        created_at: m.created_at,      } catch { /* silent — nice-to-have, not critical */ }

        created_at: m.created_at,    };

        created_at: m.created_at,    loadCount();

        created_at: m.created_at,    const onRefresh = () => loadCount();

        created_at: m.created_at,    window.addEventListener("trade-pa-inbox-refreshed", onRefresh);

        created_at: m.created_at,    return () => {

        created_at: m.created_at,      cancelled = true;

        created_at: m.created_at,      window.removeEventListener("trade-pa-inbox-refreshed", onRefresh);

        created_at: m.created_at,    };

        created_at: m.created_at,  }, [user?.id]);

        created_at: m.created_at,

        created_at: m.created_at,  // ── Fair-use caps: usage tracking ─────────────────────────────

        created_at: m.created_at,  const currentMonth = localMonth(); // "2026-04"

        created_at: m.created_at,  const [usageData, setUsageData] = useState({ conversations_used: 0, handsfree_seconds_used: 0 });

        created_at: m.created_at,  // Caps come from TIER_CONFIG (single source of truth). getTierConfig

        created_at: m.created_at,  // handles legacy "pro" → "business" rename.

        created_at: m.created_at,  const usageCaps = getTierConfig(planTier).caps;

        created_at: m.created_at,  // Custom assistant persona — state here in App (passed to AIAssistant as props)

        created_at: m.created_at,  const [assistantSetupOpen, setAssistantSetupOpen] = useState(false);

        created_at: m.created_at,  const [assistantName, setAssistantName] = useState("Trade PA");

        created_at: m.created_at,  const [assistantWakeWords, setAssistantWakeWords] = useState(["hey trade pa", "trade pa", "trade pay"]);

        created_at: m.created_at,  const [assistantPersona, setAssistantPersona] = useState("");

        created_at: m.created_at,  const [assistantSignoff, setAssistantSignoff] = useState("");

        created_at: m.created_at,  // assistantVoice — one of Grok TTS's 5 voice IDs (eve/ara/leo/rex/sal).

        created_at: m.created_at,  // Passed to /api/tts in speak() so the user's chosen voice is used.

        created_at: m.created_at,  // Default "eve" matches /api/tts's server-side default.

        created_at: m.created_at,  const [assistantVoice, setAssistantVoice] = useState("eve");

        created_at: m.created_at,  const [userCommands, setUserCommands] = useState([]);

        created_at: m.created_at,  const now = Date.now();

        created_at: m.created_at,

        created_at: m.created_at,  // ── Onboarding flow ────────────────────────────────────────────────

        created_at: m.created_at,  const [onboardingStep, setOnboardingStep] = useState(0); // 0=check, 1=welcome, 2=ai-chat, 3=assistant-setup, 4=install, 5=try-voice, 6=nav-tour, 99=complete

        created_at: m.created_at,  const onboardingStepRef = useRef(0);

        created_at: m.created_at,  useEffect(() => { onboardingStepRef.current = onboardingStep; }, [onboardingStep]);

        created_at: m.created_at,

        created_at: m.created_at,  // Persist onboarding step

        created_at: m.created_at,  useEffect(() => {

        created_at: m.created_at,    if (!user?.id || onboardingStep === 0) return;

        created_at: m.created_at,    try { localStorage.setItem(`trade-pa-onboarding-${user.id}`, String(onboardingStep)); } catch {}

        created_at: m.created_at,  }, [onboardingStep, user?.id]);

        created_at: m.created_at,

        created_at: m.created_at,  // Load onboarding step on login

        created_at: m.created_at,  useEffect(() => {

        created_at: m.created_at,    if (!user?.id) return;

        created_at: m.created_at,    try {

        created_at: m.created_at,      const saved = localStorage.getItem(`trade-pa-onboarding-${user.id}`);

        created_at: m.created_at,      if (saved === "99") { setOnboardingStep(99); return; }

        created_at: m.created_at,      if (saved && parseInt(saved) > 0) { setOnboardingStep(parseInt(saved)); return; }

        created_at: m.created_at,    } catch {}

        created_at: m.created_at,    // No saved step — check if this is genuinely a new user

        created_at: m.created_at,    // (brand hasn't been set up yet)

        created_at: m.created_at,  }, [user?.id]);

        created_at: m.created_at,

        created_at: m.created_at,  // After brand loads, determine if onboarding is needed

        created_at: m.created_at,  const brandLoadedRef = useRef(false);

        created_at: m.created_at,  useEffect(() => {

        created_at: m.created_at,    if (!user?.id || brandLoadedRef.current || onboardingStep === 99) return;

        created_at: m.created_at,    // Canonical onboarding check: the existing public.user_onboarding table

        created_at: m.created_at,    // (per-user, has voice_used / ai_used / dismissed / completed_at flags).

        created_at: m.created_at,    // RLS allows each user to read/insert/update only their own row.

        created_at: m.created_at,    //

        created_at: m.created_at,    // Historical context: this used to rely on a 600ms setTimeout + a heuristic

        created_at: m.created_at,    // on brand.tradingName ("Your Business", *"'s Trades"). That had two bugs:

        created_at: m.created_at,    //   1. On 3G / cellular, brand load could exceed 600ms → false-positive "new"

        created_at: m.created_at,    //   2. Users genuinely named "John's Trades" were misclassified as defaults

        created_at: m.created_at,    // Both vanish once we read the explicit column.

        created_at: m.created_at,    let cancelled = false;

        created_at: m.created_at,    (async () => {

        created_at: m.created_at,      if (onboardingStep > 0) { brandLoadedRef.current = true; return; }

        created_at: m.created_at,      try {

        created_at: m.created_at,        const { data: row } = await db

        created_at: m.created_at,          .from("user_onboarding")

        created_at: m.created_at,          .select("completed_at, dismissed")

        created_at: m.created_at,          .eq("user_id", user.id)

        created_at: m.created_at,          .maybeSingle();

        created_at: m.created_at,        if (cancelled) return;

        created_at: m.created_at,        brandLoadedRef.current = true;

        created_at: m.created_at,        // Treat dismissed (user explicitly skipped onboarding) the same as

        created_at: m.created_at,        // completed — don't pester them again on the next login.

        created_at: m.created_at,        const done = row?.completed_at || row?.dismissed;

        created_at: m.created_at,        setOnboardingStep(done ? 99 : 1);

        created_at: m.created_at,      } catch (err) {

        created_at: m.created_at,        // Network failure or query error — fall back to the old heuristic so

        created_at: m.created_at,        // a returning user isn't stuck in onboarding if their connection is

        created_at: m.created_at,        // flaky. Worst case: they see the welcome once and skip through.

        created_at: m.created_at,        if (cancelled) return;

        created_at: m.created_at,        brandLoadedRef.current = true;

        created_at: m.created_at,        const looksDefault =

        created_at: m.created_at,          !brand.tradingName ||

        created_at: m.created_at,          brand.tradingName === "" ||

        created_at: m.created_at,          brand.tradingName === "Your Business" ||

        created_at: m.created_at,          brand.tradingName.endsWith("'s Trades");

        created_at: m.created_at,        setOnboardingStep(looksDefault ? 1 : 99);

        created_at: m.created_at,      }

        created_at: m.created_at,    })();

        created_at: m.created_at,    return () => { cancelled = true; };

        created_at: m.created_at,  }, [user?.id, onboardingStep]);

        created_at: m.created_at,

        created_at: m.created_at,  const advanceOnboarding = (toStep) => { setOnboardingStep(toStep); };

        created_at: m.created_at,  const completeOnboarding = async () => {

        created_at: m.created_at,    setOnboardingStep(99);

        created_at: m.created_at,    // Persist server-side so the next device / reinstall / native app never

        created_at: m.created_at,    // re-triggers onboarding. Fire-and-forget — the local state is the source

        created_at: m.created_at,    // of truth for this session, this is just for future sessions. Upsert so

        created_at: m.created_at,    // first-time users get a row and returners just update completed_at.

        created_at: m.created_at,    try {

        created_at: m.created_at,      await db.from("user_onboarding")

        created_at: m.created_at,        .upsert(

        created_at: m.created_at,          { user_id: user.id, completed_at: new Date().toISOString() },

        created_at: m.created_at,          { onConflict: "user_id" }

        created_at: m.created_at,        );

        created_at: m.created_at,    } catch (err) { console.warn("[onboarding] server mark failed:", err?.message); }

        created_at: m.created_at,  };

        created_at: m.created_at,  const [navTourStep, setNavTourStep] = useState(0);

        created_at: m.created_at,

        created_at: m.created_at,  // Load assistant persona + custom commands on login

        created_at: m.created_at,  useEffect(() => {

        created_at: m.created_at,    if (!user?.id) return;

        created_at: m.created_at,    (async () => {

        created_at: m.created_at,      const { data: s } = await db

        created_at: m.created_at,        .from("user_settings")

        created_at: m.created_at,        .select("assistant_name, assistant_wake_words, assistant_persona, assistant_signoff, assistant_voice")

        created_at: m.created_at,        .eq("user_id", user.id)

        created_at: m.created_at,        .maybeSingle();

        created_at: m.created_at,      if (s) {

        created_at: m.created_at,        if (s.assistant_name) setAssistantName(s.assistant_name);

        created_at: m.created_at,        if (s.assistant_wake_words?.length) setAssistantWakeWords(s.assistant_wake_words);

        created_at: m.created_at,        if (s.assistant_persona) setAssistantPersona(s.assistant_persona);

        created_at: m.created_at,        if (s.assistant_signoff) setAssistantSignoff(s.assistant_signoff);

        created_at: m.created_at,        if (s.assistant_voice) {

        created_at: m.created_at,          // Migrate legacy voice IDs (british_female etc.) set before the

        created_at: m.created_at,          // Grok TTS switch. Same mapping lives in AssistantSetup.jsx — keep

        created_at: m.created_at,          // the two in sync when voices change.

        created_at: m.created_at,          const LEGACY = { british_female: "ara", british_male: "leo", american_female: "eve", american_male: "rex" };

        created_at: m.created_at,          const ALLOWED = new Set(["eve", "ara", "leo", "rex", "sal"]);

        created_at: m.created_at,          const migrated = LEGACY[s.assistant_voice] || s.assistant_voice;

        created_at: m.created_at,          setAssistantVoice(ALLOWED.has(migrated) ? migrated : "eve");

        created_at: m.created_at,        }

        created_at: m.created_at,      }

        created_at: m.created_at,      const { data: cmds } = await db

        created_at: m.created_at,        .from("user_commands")

        created_at: m.created_at,        .select("*")

        created_at: m.created_at,        .eq("user_id", user.id)

        created_at: m.created_at,        .eq("enabled", true)

        created_at: m.created_at,        .order("created_at", { ascending: true });

        created_at: m.created_at,      if (cmds) setUserCommands(cmds);

        created_at: m.created_at,    })();

        created_at: m.created_at,  }, [user?.id]);

        created_at: m.created_at,

        created_at: m.created_at,  // Load usage tracking for current month

        created_at: m.created_at,  useEffect(() => {

        created_at: m.created_at,    if (!user?.id) return;

        created_at: m.created_at,    (async () => {

        created_at: m.created_at,      try {

        created_at: m.created_at,        const { data, error } = await db

        created_at: m.created_at,          .from("usage_tracking")

        created_at: m.created_at,          .select("conversations_used, handsfree_seconds_used")

        created_at: m.created_at,          .eq("user_id", user.id)

        created_at: m.created_at,          .eq("month", currentMonth)

        created_at: m.created_at,          .maybeSingle();

        created_at: m.created_at,        if (!error && data) setUsageData(data);

        created_at: m.created_at,      } catch (e) { console.warn("[usage] load failed:", e?.message); }

        created_at: m.created_at,    })();

        created_at: m.created_at,  }, [user?.id]);

        created_at: m.created_at,

        created_at: m.created_at,  // Send push notification to this user via server

        created_at: m.created_at,  const sendPush = (opts) => {

        created_at: m.created_at,    if (!user?.id) return;

        created_at: m.created_at,    fetch("/api/push/send", {

        created_at: m.created_at,      method: "POST",

        created_at: m.created_at,      headers: { "Content-Type": "application/json" },

        created_at: m.created_at,      body: JSON.stringify({ userId: user.id, ...opts }),

        created_at: m.created_at,    }).catch(() => {});

        created_at: m.created_at,  };

        created_at: m.created_at,

        created_at: m.created_at,  const answerCall = async () => {

        created_at: m.created_at,    if (!incomingCall) return;

        created_at: m.created_at,    // Request mic permission explicitly before accepting

        created_at: m.created_at,    try {

        created_at: m.created_at,      const stream = await navigator.mediaDevices.getUserMedia({

        created_at: m.created_at,        audio: {

        created_at: m.created_at,          echoCancellation: true,

        created_at: m.created_at,          noiseSuppression: true,

        created_at: m.created_at,          autoGainControl: true,

        created_at: m.created_at,        }

        created_at: m.created_at,      });

        created_at: m.created_at,      stream.getTracks().forEach(t => t.stop());

        created_at: m.created_at,    } catch {

        created_at: m.created_at,      alert("Microphone access is required to answer calls. Please allow microphone access in your browser/device settings.");

        created_at: m.created_at,      incomingCall.call.reject();

        created_at: m.created_at,      setIncomingCall(null);

        created_at: m.created_at,      setMicBlocked(true);

        created_at: m.created_at,      return;

        created_at: m.created_at,    }

        created_at: m.created_at,    const { call, callerName, callerNumber } = incomingCall;

        created_at: m.created_at,    call.accept();

        created_at: m.created_at,    setActiveCall({ call, callerName, callerNumber, direction: "inbound", startTime: Date.now() });

        created_at: m.created_at,    setIncomingCall(null);

        created_at: m.created_at,    call.on("disconnect", () => { setActiveCall(null); setCallMuted(false); });

        created_at: m.created_at,    call.on("error", () => { setActiveCall(null); setCallMuted(false); });

        created_at: m.created_at,  };

        created_at: m.created_at,

        created_at: m.created_at,  const declineCall = () => {

        created_at: m.created_at,    if (!incomingCall) return;

        created_at: m.created_at,    incomingCall.call.reject();

        created_at: m.created_at,    setIncomingCall(null);

        created_at: m.created_at,  };

        created_at: m.created_at,

        created_at: m.created_at,  const makeCall = async (phoneNumber, customerName) => {

        created_at: m.created_at,    if (!twilioDevice) { alert("Call tracking is not active. Enable it in Settings."); return; }

        created_at: m.created_at,    try {

        created_at: m.created_at,      let num = phoneNumber.replace(/\s/g, "");

        created_at: m.created_at,      if (num.startsWith("07")) num = "+44" + num.slice(1);

        created_at: m.created_at,      else if (num.startsWith("0")) num = "+44" + num.slice(1);

        created_at: m.created_at,      const call = await twilioDevice.connect({ params: { To: num, userId: user.id, customerName: customerName || "Unknown" } });

        created_at: m.created_at,      setActiveCall({ call, callerName: customerName || phoneNumber, callerNumber: num, direction: "outbound", startTime: Date.now() });

        created_at: m.created_at,      call.on("disconnect", () => { setActiveCall(null); setCallMuted(false); });

        created_at: m.created_at,      call.on("error", () => { setActiveCall(null); setCallMuted(false); });

        created_at: m.created_at,    } catch (err) {

        created_at: m.created_at,      console.error("makeCall error:", err.message);

        created_at: m.created_at,      alert("Could not connect the call. Please try again.");

        created_at: m.created_at,    }

        created_at: m.created_at,  };

        created_at: m.created_at,

        created_at: m.created_at,  const hangUp = () => {

        created_at: m.created_at,    if (activeCall?.call) activeCall.call.disconnect();

        created_at: m.created_at,    setActiveCall(null);

        created_at: m.created_at,    setCallMuted(false);

        created_at: m.created_at,    setCallSpeaker(true);

        created_at: m.created_at,  };

        created_at: m.created_at,

        created_at: m.created_at,  const toggleMute = () => {

        created_at: m.created_at,    if (!activeCall?.call) return;

        created_at: m.created_at,    const next = !callMuted;

        created_at: m.created_at,    activeCall.call.mute(next);

        created_at: m.created_at,    setCallMuted(next);

        created_at: m.created_at,  };

        created_at: m.created_at,

        created_at: m.created_at,  const toggleSpeaker = async () => {

        created_at: m.created_at,    const next = !callSpeaker;

        created_at: m.created_at,    setCallSpeaker(next);

        created_at: m.created_at,    // Use setSinkId if available (Chrome/Android) to switch output device

        created_at: m.created_at,    try {

        created_at: m.created_at,      const audioElements = document.querySelectorAll("audio");

        created_at: m.created_at,      if (next) {

        created_at: m.created_at,        // Switch to speaker — use default output

        created_at: m.created_at,        audioElements.forEach(el => { if (el.setSinkId) el.setSinkId(""); });

        created_at: m.created_at,      } else {

        created_at: m.created_at,        // Switch to earpiece — attempt to use communications device

        created_at: m.created_at,        const devices = await navigator.mediaDevices.enumerateDevices();

        created_at: m.created_at,        const earpiece = devices.find(d => d.kind === "audiooutput" && (d.label.toLowerCase().includes("earpiece") || d.label.toLowerCase().includes("receiver")));

        created_at: m.created_at,        if (earpiece) {

        created_at: m.created_at,          audioElements.forEach(el => { if (el.setSinkId) el.setSinkId(earpiece.deviceId); });

        created_at: m.created_at,        }

        created_at: m.created_at,      }

        created_at: m.created_at,    } catch {}

        created_at: m.created_at,  };

        created_at: m.created_at,

        created_at: m.created_at,  // PDF overlay event listener (iOS PWA fallback)

        created_at: m.created_at,  useEffect(() => {

        created_at: m.created_at,    // Fix safe area insets for iPhone notch/dynamic island

        created_at: m.created_at,    const viewport = document.querySelector('meta[name="viewport"]');

        created_at: m.created_at,    if (viewport && !viewport.content.includes('viewport-fit')) {

        created_at: m.created_at,      viewport.content = viewport.content + ', viewport-fit=cover';

        created_at: m.created_at,    }

        created_at: m.created_at,    // Prevent iOS Safari from zooming in when focusing inputs with font-size < 16px

        created_at: m.created_at,    if (viewport && !viewport.content.includes('maximum-scale')) {

        created_at: m.created_at,      viewport.content = viewport.content + ', maximum-scale=1';

        created_at: m.created_at,    }

        created_at: m.created_at,    // Detect iOS and standalone mode

        created_at: m.created_at,    const ua2 = navigator.userAgent.toLowerCase(); const ios = ua2.indexOf("iphone") !== -1 || ua2.indexOf("ipad") !== -1 || ua2.indexOf("ipod") !== -1;

        created_at: m.created_at,    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

        created_at: m.created_at,    setIsIos(ios);

        created_at: m.created_at,    setIsStandalone(standalone);

        created_at: m.created_at,    if (!standalone) setTimeout(() => setShowPwaBanner(true), 4000);

        created_at: m.created_at,    // Android — capture install prompt event

        created_at: m.created_at,    const promptHandler = (e) => { e.preventDefault(); setPwaPrompt(e); };

        created_at: m.created_at,    window.addEventListener('beforeinstallprompt', promptHandler);

        created_at: m.created_at,    return () => window.removeEventListener('beforeinstallprompt', promptHandler);

        created_at: m.created_at,  }, []);

        created_at: m.created_at,

        created_at: m.created_at,  // Register service worker and push notifications

        created_at: m.created_at,  useEffect(() => {

        created_at: m.created_at,    if (!user?.id) return;

        created_at: m.created_at,    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

        created_at: m.created_at,

        created_at: m.created_at,    const registerPush = async () => {

        created_at: m.created_at,      try {

        created_at: m.created_at,        const reg = await navigator.serviceWorker.register("/sw.js");

        created_at: m.created_at,        await navigator.serviceWorker.ready;

        created_at: m.created_at,

        created_at: m.created_at,        // Check existing permission

        created_at: m.created_at,        if (Notification.permission === "denied") return;

        created_at: m.created_at,

        created_at: m.created_at,        // Subscribe to push

        created_at: m.created_at,        const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

        created_at: m.created_at,        if (!vapidPublicKey) return;

        created_at: m.created_at,

        created_at: m.created_at,        const existing = await reg.pushManager.getSubscription();

        created_at: m.created_at,        const sub = existing || await reg.pushManager.subscribe({

        created_at: m.created_at,          userVisibleOnly: true,

        created_at: m.created_at,          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),

        created_at: m.created_at,        });

        created_at: m.created_at,

        created_at: m.created_at,        // Save subscription to server

        created_at: m.created_at,        await fetch("/api/push/subscribe", {

        created_at: m.created_at,          method: "POST",

        created_at: m.created_at,          headers: { "Content-Type": "application/json" },

        created_at: m.created_at,          body: JSON.stringify({ userId: user.id, subscription: sub.toJSON() }),

        created_at: m.created_at,        });

        created_at: m.created_at,

        created_at: m.created_at,        // Listen for notification clicks from service worker

        created_at: m.created_at,        navigator.serviceWorker.addEventListener("message", e => {

        created_at: m.created_at,          if (e.data?.type === "NOTIFICATION_CLICK") {

        created_at: m.created_at,            if (e.data.notifType === "ai_action") setView("Inbox");

        created_at: m.created_at,            else if (e.data.notifType === "enquiry") setView("Enquiries");

        created_at: m.created_at,            else if (e.data.notifType === "invoice_paid") setView("Payments");

        created_at: m.created_at,            else if (e.data.notifType === "call") setView("Customers");

        created_at: m.created_at,          }

        created_at: m.created_at,        });

        created_at: m.created_at,      } catch (err) {

        created_at: m.created_at,        console.log("Push registration:", err.message);

        created_at: m.created_at,      }

        created_at: m.created_at,    };

        created_at: m.created_at,

        created_at: m.created_at,    registerPush();

        created_at: m.created_at,  }, [user?.id]);

        created_at: m.created_at,

        created_at: m.created_at,  // Twilio Voice SDK — register device if user has call tracking active

        created_at: m.created_at,  useEffect(() => {

        created_at: m.created_at,    if (!user?.id) return;

        created_at: m.created_at,

        created_at: m.created_at,    // Destroy any existing device before creating a new one

        created_at: m.created_at,    if (twilioDeviceRef.current) {

        created_at: m.created_at,      twilioDeviceRef.current.destroy();

        created_at: m.created_at,      twilioDeviceRef.current = null;

        created_at: m.created_at,      setTwilioDevice(null);

        created_at: m.created_at,    }

        created_at: m.created_at,

        created_at: m.created_at,    const initDevice = async () => {

        created_at: m.created_at,      try {

        created_at: m.created_at,        const { data: ct } = await db.from("call_tracking").select("twilio_number").eq("user_id", user.id).limit(1).maybeSingle();

        created_at: m.created_at,        if (!ct?.twilio_number) return;

        created_at: m.created_at,

        created_at: m.created_at,        // Check mic permission

        created_at: m.created_at,        try {

        created_at: m.created_at,          const perm = await navigator.permissions.query({ name: "microphone" });

        created_at: m.created_at,          if (perm.state === "denied") { setMicBlocked(true); return; }

        created_at: m.created_at,          setMicBlocked(false);

        created_at: m.created_at,          perm.onchange = () => { if (perm.state === "denied") setMicBlocked(true); else setMicBlocked(false); };

        created_at: m.created_at,        } catch {}

        created_at: m.created_at,

        created_at: m.created_at,        // Request mic with echo cancellation, noise suppression and auto gain

        created_at: m.created_at,        try {

        created_at: m.created_at,          const stream = await navigator.mediaDevices.getUserMedia({

        created_at: m.created_at,            audio: {

        created_at: m.created_at,              echoCancellation: true,

        created_at: m.created_at,              noiseSuppression: true,

        created_at: m.created_at,              autoGainControl: true,

        created_at: m.created_at,            }

        created_at: m.created_at,          });

        created_at: m.created_at,          stream.getTracks().forEach(t => t.stop());

        created_at: m.created_at,          setMicBlocked(false);

        created_at: m.created_at,        } catch {

        created_at: m.created_at,          setMicBlocked(true);

        created_at: m.created_at,          return;

        created_at: m.created_at,        }

        created_at: m.created_at,

        created_at: m.created_at,        const tokenRes = await fetch("/api/calls/token", { method: "POST", headers: await authHeaders() });

        created_at: m.created_at,        const { token } = await tokenRes.json();

        created_at: m.created_at,        if (!token) return;

        created_at: m.created_at,

        created_at: m.created_at,        const d = new Device(token, {

        created_at: m.created_at,          logLevel: 1,

        created_at: m.created_at,          codecPreferences: ["opus", "pcmu"],

        created_at: m.created_at,          edge: "dublin",

        created_at: m.created_at,        });

        created_at: m.created_at,

        created_at: m.created_at,        d.on("incoming", call => {

        created_at: m.created_at,          console.log("📞 INCOMING CALL FIRED", call.parameters);

        created_at: m.created_at,          const callerName = call.customParameters?.get("callerName") || "Unknown caller";

        created_at: m.created_at,          const callerNumber = call.customParameters?.get("callerNumber") || "";

        created_at: m.created_at,          setIncomingCall({ call, callerName, callerNumber });

        created_at: m.created_at,          call.on("cancel", () => { console.log("📞 Cancelled"); setIncomingCall(null); });

        created_at: m.created_at,          call.on("reject", () => { console.log("📞 Rejected"); setIncomingCall(null); });

        created_at: m.created_at,        });

        created_at: m.created_at,

        created_at: m.created_at,        d.on("tokenWillExpire", async () => {

        created_at: m.created_at,          try {

        created_at: m.created_at,            const r = await fetch("/api/calls/token", { method: "POST", headers: await authHeaders() });

        created_at: m.created_at,            const rd = await r.json();

        created_at: m.created_at,            if (rd.token) d.updateToken(rd.token);

        created_at: m.created_at,          } catch {}

        created_at: m.created_at,        });

        created_at: m.created_at,

        created_at: m.created_at,        d.on("error", err => console.log("Twilio Device error:", err.message));

        created_at: m.created_at,

        created_at: m.created_at,        await d.register();

        created_at: m.created_at,        twilioDeviceRef.current = d;

        created_at: m.created_at,        setTwilioDevice(d);

        created_at: m.created_at,        console.log("✓ Twilio Device registered");

        created_at: m.created_at,      } catch (err) {

        created_at: m.created_at,        console.log("Twilio Device init:", err.message);

        created_at: m.created_at,      }

        created_at: m.created_at,    };

        created_at: m.created_at,

        created_at: m.created_at,    initDevice();

        created_at: m.created_at,

        created_at: m.created_at,    return () => {

        created_at: m.created_at,      if (twilioDeviceRef.current) {

        created_at: m.created_at,        twilioDeviceRef.current.destroy();

        created_at: m.created_at,        twilioDeviceRef.current = null;

        created_at: m.created_at,        setTwilioDevice(null);

        created_at: m.created_at,        setIncomingCall(null);

        created_at: m.created_at,        setActiveCall(null);

        created_at: m.created_at,        setCallMuted(false);

        created_at: m.created_at,        setCallSpeaker(true);

        created_at: m.created_at,      }

        created_at: m.created_at,    };

        created_at: m.created_at,  }, [user?.id]);

        created_at: m.created_at,

        created_at: m.created_at,  useEffect(() => {

        created_at: m.created_at,    const handler = (e) => setPdfHtml(e.detail);

        created_at: m.created_at,    window.addEventListener("trade-pa-show-pdf", handler);

        created_at: m.created_at,    return () => window.removeEventListener("trade-pa-show-pdf", handler);

        created_at: m.created_at,  }, []);

        created_at: m.created_at,

        created_at: m.created_at,  // Check existing session on load

        created_at: m.created_at,  useEffect(() => {

        created_at: m.created_at,    db.auth.getSession().then(({ data: { session } }) => {

        created_at: m.created_at,      setUser(session?.user ?? null);

        created_at: m.created_at,      setAuthLoading(false);

        created_at: m.created_at,      // Tag Sentry errors with the current user so we can see who hit what

        created_at: m.created_at,      try {

        created_at: m.created_at,        if (session?.user) {

        created_at: m.created_at,          Sentry.setUser({ id: session.user.id, email: session.user.email });

        created_at: m.created_at,          setOwnerCookie(session.user.id);

        created_at: m.created_at,        } else {

        created_at: m.created_at,          Sentry.setUser(null);

        created_at: m.created_at,        }

        created_at: m.created_at,      } catch {}

        created_at: m.created_at,    });

        created_at: m.created_at,    const { data: { subscription } } = db.auth.onAuthStateChange((_event, session) => {

        created_at: m.created_at,      setUser(session?.user ?? null);

        created_at: m.created_at,      try {

        created_at: m.created_at,        if (session?.user) {

        created_at: m.created_at,          Sentry.setUser({ id: session.user.id, email: session.user.email });

        created_at: m.created_at,          setOwnerCookie(session.user.id);

        created_at: m.created_at,        } else {

        created_at: m.created_at,          Sentry.setUser(null);

        created_at: m.created_at,        }

        created_at: m.created_at,      } catch {}

        created_at: m.created_at,    });

        created_at: m.created_at,    return () => subscription.unsubscribe();

        created_at: m.created_at,  }, []);

        created_at: m.created_at,

        created_at: m.created_at,  // Check subscription status whenever user changes

        created_at: m.created_at,  useEffect(() => {

        created_at: m.created_at,    if (!user) { setSubscriptionStatus(null); return; }

        created_at: m.created_at,

        created_at: m.created_at,    // Exempt accounts skip subscription check entirely — treated as Business tier

        created_at: m.created_at,    // so the caps are generous and all features are unlocked.

        created_at: m.created_at,    const EXEMPT = ["thetradepa@gmail.com", "connor@tradespa.co.uk", "connor_mckay777@hotmail.com", "connor_mckay777@hotmail.co.uk", "landbheating@outlook.com", "shannonandrewsimpson@gmail.com"];

        created_at: m.created_at,    if (EXEMPT.includes(user.email?.toLowerCase())) {

        created_at: m.created_at,      setSubscriptionStatus("active");

        created_at: m.created_at,      setPlanTier("business");

        created_at: m.created_at,      setUserLimit(getTierConfig("business").userLimit);

        created_at: m.created_at,      return;

        created_at: m.created_at,    }

        created_at: m.created_at,

        created_at: m.created_at,    async function checkSubscription() {

        created_at: m.created_at,      const { data } = await db.from("subscriptions").select("status, current_period_end, stripe_price_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1);

        created_at: m.created_at,      if (!data?.length) { setSubscriptionStatus("none"); return; }

        created_at: m.created_at,      const sub = data[0];

        created_at: m.created_at,

        created_at: m.created_at,      // Determine plan tier from DB's plan column (set by create-subscription.js).

        created_at: m.created_at,      // normalizeTier handles legacy "pro" → "business" rename.

        created_at: m.created_at,      const rawPlan = sub.plan || "solo";

        created_at: m.created_at,      const detectedPlan = normalizeTier(rawPlan);

        created_at: m.created_at,      setPlanTier(detectedPlan);

        created_at: m.created_at,      setUserLimit(getTierConfig(detectedPlan).userLimit);

        created_at: m.created_at,

        created_at: m.created_at,      if (sub.current_period_end && new Date(sub.current_period_end) < new Date() && sub.status === "active") {

        created_at: m.created_at,        setSubscriptionStatus("past_due");

        created_at: m.created_at,      } else {

        created_at: m.created_at,        setSubscriptionStatus(sub.status);

        created_at: m.created_at,      }

        created_at: m.created_at,    }

        created_at: m.created_at,    checkSubscription();

        created_at: m.created_at,  }, [user]);

        created_at: m.created_at,

        created_at: m.created_at,  // Load brand settings — localStorage for instant load, Supabase syncs in background

        created_at: m.created_at,  const brandSaveCount = useRef(0);

        created_at: m.created_at,  const brandSaveTimer = useRef(null);

        created_at: m.created_at,

        created_at: m.created_at,  useEffect(() => {

        created_at: m.created_at,    if (!user) return;

        created_at: m.created_at,    brandSaveCount.current = 0;

        created_at: m.created_at,

        created_at: m.created_at,    // Load from localStorage immediately — fast and synchronous

        created_at: m.created_at,    try {

        created_at: m.created_at,      const saved = localStorage.getItem(`trade-pa-brand-${user.id}`);

        created_at: m.created_at,      if (saved) {

        created_at: m.created_at,        const loaded = JSON.parse(saved);

        created_at: m.created_at,        if (isExemptAccount(user.email)) loaded._exemptBypass = true;

        created_at: m.created_at,        setBrand({ ...DEFAULT_BRAND, ...loaded });

        created_at: m.created_at,      } else {

        created_at: m.created_at,        const name = user.user_metadata?.full_name;

        created_at: m.created_at,        setBrand(b => ({

        created_at: m.created_at,          ...b,

        created_at: m.created_at,          ...(name ? { tradingName: `${name}'s Trades` } : {}),

        created_at: m.created_at,          _exemptBypass: isExemptAccount(user.email),

        created_at: m.created_at,        }));

        created_at: m.created_at,      }

        created_at: m.created_at,    } catch {

        created_at: m.created_at,      setBrand(b => ({ ...b, _exemptBypass: isExemptAccount(user.email) }));

        created_at: m.created_at,    }

        created_at: m.created_at,

        created_at: m.created_at,    // Then check Supabase in background — if newer data exists, update silently

        created_at: m.created_at,    db.from("user_settings")

        created_at: m.created_at,      .select("brand_data, updated_at")

        created_at: m.created_at,      .eq("user_id", user.id)

        created_at: m.created_at,      .maybeSingle()

        created_at: m.created_at,      .then(({ data, error }) => {

        created_at: m.created_at,        if (error || !data?.brand_data) return;

        created_at: m.created_at,        if (Object.keys(data.brand_data).length === 0) return;

        created_at: m.created_at,        // Merge Supabase data with local logos

        created_at: m.created_at,        try {

        created_at: m.created_at,          const local = JSON.parse(localStorage.getItem(`trade-pa-brand-${user.id}`) || "{}");

        created_at: m.created_at,          const merged = {

        created_at: m.created_at,            ...DEFAULT_BRAND,

        created_at: m.created_at,            ...data.brand_data,

        created_at: m.created_at,            logo: local.logo || null,

        created_at: m.created_at,            gasSafeLogo: local.gasSafeLogo || null,

        created_at: m.created_at,            _exemptBypass: isExemptAccount(user.email),

        created_at: m.created_at,          };

        created_at: m.created_at,          setBrand(merged);

        created_at: m.created_at,          // Update localStorage with merged data

        created_at: m.created_at,          localStorage.setItem(`trade-pa-brand-${user.id}`, JSON.stringify(merged));

        created_at: m.created_at,        } catch {}

        created_at: m.created_at,      })

        created_at: m.created_at,      .catch(() => {}); // silently ignore if table doesn't exist

        created_at: m.created_at,

        created_at: m.created_at,  }, [user?.id]);

        created_at: m.created_at,

        created_at: m.created_at,  useEffect(() => {

        created_at: m.created_at,    if (!user) return;

        created_at: m.created_at,    brandSaveCount.current++;

        created_at: m.created_at,    if (brandSaveCount.current <= 1) return;

        created_at: m.created_at,

        created_at: m.created_at,    // SAFETY GUARD (added 30 Apr 2026): refuse to save brand if it has no real

        created_at: m.created_at,    // business data populated. Prevents fresh-device init or state races from

        created_at: m.created_at,    // overwriting real Supabase data with empty defaults — root cause of the

        created_at: m.created_at,    // brand_data wipe at 06:51 UTC on 30 Apr.

        created_at: m.created_at,    const hasRealData = !!(brand.email || brand.phone || brand.address || brand.vatNumber || brand.utrNumber || brand.bankName);

        created_at: m.created_at,    if (!hasRealData) {

        created_at: m.created_at,      console.warn("[brand-save] Refusing to save: no real business data present (likely fresh-device init or state race).");

        created_at: m.created_at,      return;

        created_at: m.created_at,    }

        created_at: m.created_at,

        created_at: m.created_at,    // Always save to localStorage immediately (includes logos)

        created_at: m.created_at,    try {

        created_at: m.created_at,      localStorage.setItem(`trade-pa-brand-${user.id}`, JSON.stringify(brand));

        created_at: m.created_at,    } catch {

        created_at: m.created_at,      try {

        created_at: m.created_at,        const { logo, gasSafeLogo, ...brandWithoutImages } = brand;

        created_at: m.created_at,        localStorage.setItem(`trade-pa-brand-${user.id}`, JSON.stringify(brandWithoutImages));

        created_at: m.created_at,      } catch {}

        created_at: m.created_at,    }

        created_at: m.created_at,

        created_at: m.created_at,    // Debounce Supabase save by 2s to avoid hammering on every keystroke

        created_at: m.created_at,    // Logos excluded — too large and not needed cross-device in the DB

        created_at: m.created_at,    if (brandSaveTimer.current) clearTimeout(brandSaveTimer.current);

        created_at: m.created_at,    brandSaveTimer.current = setTimeout(async () => {

        created_at: m.created_at,      try {

        created_at: m.created_at,        const { logo, gasSafeLogo, _exemptBypass, ...syncData } = brand;

        created_at: m.created_at,        await db.from("user_settings").upsert({

        created_at: m.created_at,          user_id: user.id,

        created_at: m.created_at,          brand_data: syncData,

        created_at: m.created_at,          updated_at: new Date().toISOString(),

        created_at: m.created_at,        });

        created_at: m.created_at,      } catch (err) {

        created_at: m.created_at,        console.warn("Brand sync to Supabase failed:", err.message);

        created_at: m.created_at,      }

        created_at: m.created_at,    }, 2000);

        created_at: m.created_at,  }, [brand, user?.id]);

        created_at: m.created_at,

        created_at: m.created_at,  const handleLogout = async () => {

        created_at: m.created_at,    await db.auth.signOut();

        created_at: m.created_at,    setJobsRaw([]); setInvoicesRaw([]); setEnquiriesRaw([]);

        created_at: m.created_at,    setMaterialsRaw([]); setCustomersRaw([]);

        created_at: m.created_at,    setCompanyId(null); setCompanyName(""); setMembers([]);

        created_at: m.created_at,    setUser(null); setView("AI Assistant");

        created_at: m.created_at,  };

        created_at: m.created_at,

        created_at: m.created_at,  // ── State declarations ────────────────────────────────────────────────────

        created_at: m.created_at,  const [jobs, setJobsRaw] = useState([]);

        created_at: m.created_at,  const [invoices, setInvoicesRaw] = useState([]);

        created_at: m.created_at,  const [enquiries, setEnquiriesRaw] = useState([]);

        created_at: m.created_at,  const [materials, setMaterialsRaw] = useState([]);

        created_at: m.created_at,  const [customers, setCustomersRaw] = useState([]);

        created_at: m.created_at,  const [customerContacts, setCustomerContactsRaw] = useState([]);

        created_at: m.created_at,  const [dbLoading, setDbLoading] = useState(false);

        created_at: m.created_at,  const [jobsRefreshKey, setJobsRefreshKey] = useState(0);

        created_at: m.created_at,  const [companyId, setCompanyId] = useState(null);

        created_at: m.created_at,  const [companyName, setCompanyName] = useState("");

        created_at: m.created_at,  const [userRole, setUserRole] = useState("owner");

        created_at: m.created_at,  const [members, setMembers] = useState([]);

        created_at: m.created_at,  const [pendingInvite, setPendingInvite] = useState(null);

        created_at: m.created_at,

        created_at: m.created_at,  // ── In-app notifications (bell icon feed) ─────────────────────────────────

        created_at: m.created_at,  // Backed by in_app_notifications table. Populated server-side by portal.js

        created_at: m.created_at,  // (customer views) and can be extended to webhook events, etc. We fetch

        created_at: m.created_at,  // on load and poll every 60s so the bell badge stays fresh without

        created_at: m.created_at,  // overwhelming the DB.

        created_at: m.created_at,  const [inAppNotifs, setInAppNotifs] = useState([]);

        created_at: m.created_at,  const loadInAppNotifs = async () => {

        created_at: m.created_at,    if (!user?.id) return;

        created_at: m.created_at,    try {

        created_at: m.created_at,      const { data } = await db

        created_at: m.created_at,        .from("in_app_notifications")

        created_at: m.created_at,        .select("*")

        created_at: m.created_at,        .eq("user_id", user.id)

        created_at: m.created_at,        .order("created_at", { ascending: false })

        created_at: m.created_at,        .limit(50);

        created_at: m.created_at,      if (data) setInAppNotifs(data);

        created_at: m.created_at,    } catch {

        created_at: m.created_at,      // Silently ignore — a transient network blip shouldn't break the UI.

        created_at: m.created_at,    }

        created_at: m.created_at,  };

        created_at: m.created_at,  useEffect(() => {

        created_at: m.created_at,    if (!user?.id) return;

        created_at: m.created_at,    loadInAppNotifs();

        created_at: m.created_at,    const poll = setInterval(loadInAppNotifs, 60000);

        created_at: m.created_at,    return () => clearInterval(poll);

        created_at: m.created_at,  }, [user?.id]);

        created_at: m.created_at,

        created_at: m.created_at,  // Mark a single notification as read. Optimistic update + DB write.

        created_at: m.created_at,  const markNotifRead = async (id) => {

        created_at: m.created_at,    setInAppNotifs(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));

        created_at: m.created_at,    try {

        created_at: m.created_at,      await db.from("in_app_notifications").update({ read_at: new Date().toISOString() }).eq("id", id);

        created_at: m.created_at,    } catch {}

        created_at: m.created_at,  };

        created_at: m.created_at,  const markAllNotifsRead = async () => {

        created_at: m.created_at,    const nowIso = new Date().toISOString();

        created_at: m.created_at,    setInAppNotifs(prev => prev.map(n => n.read_at ? n : { ...n, read_at: nowIso }));

        created_at: m.created_at,    try {

        created_at: m.created_at,      await db.from("in_app_notifications")

        created_at: m.created_at,        .update({ read_at: nowIso })

        created_at: m.created_at,        .eq("user_id", user.id)

        created_at: m.created_at,        .is("read_at", null);

        created_at: m.created_at,    } catch {}

        created_at: m.created_at,  };

        created_at: m.created_at,  const dismissNotif = async (id) => {

        created_at: m.created_at,    setInAppNotifs(prev => prev.filter(n => n.id !== id));

        created_at: m.created_at,    try { await db.from("in_app_notifications").delete().eq("id", id); } catch {}

        created_at: m.created_at,  };

        created_at: m.created_at,  const openNotif = (n) => {

        created_at: m.created_at,    markNotifRead(n.id);

        created_at: m.created_at,    if (n.url && n.url !== "/") {

        created_at: m.created_at,      // Strip leading slash to get the view name (e.g. "/Quotes" -> "Quotes")

        created_at: m.created_at,      const view = n.url.startsWith("/") ? n.url.slice(1) : n.url;

        created_at: m.created_at,      if (view) setView(view);

        created_at: m.created_at,    }

        created_at: m.created_at,  };

        created_at: m.created_at,

        created_at: m.created_at,  const unreadNotifCount = inAppNotifs.filter(n => !n.read_at).length;

        created_at: m.created_at,

        created_at: m.created_at,  // Bound trackEvent helper — captures current user + companyId so callers

        created_at: m.created_at,  // don't have to pass them on every call. Stable reference via useRef so

        created_at: m.created_at,  // child components don't re-render when companyId/user arrive.

        created_at: m.created_at,  const trackEventRef = useRef(null);

        created_at: m.created_at,  trackEventRef.current = (eventType, eventName, metadata) => {

        created_at: m.created_at,    trackEvent(db, user?.id, companyId, eventType, eventName, metadata);

        created_at: m.created_at,  };

        created_at: m.created_at,  const track = (eventType, eventName, metadata) => {

        created_at: m.created_at,    trackEventRef.current?.(eventType, eventName, metadata);

        created_at: m.created_at,  };

        created_at: m.created_at,

        created_at: m.created_at,  // ── Get or create company for user ───────────────────────────────────────

        created_at: m.created_at,  const getOrCreateCompany = async (uid) => {

        created_at: m.created_at,    // Check if user already belongs to a company

        created_at: m.created_at,    const { data: membership } = await db

        created_at: m.created_at,      .from("company_members")

        created_at: m.created_at,      .select("company_id, role, companies(name)")

        created_at: m.created_at,      .eq("user_id", uid)

        created_at: m.created_at,      .single();

        created_at: m.created_at,

        created_at: m.created_at,    if (membership) {

        created_at: m.created_at,      setCompanyId(membership.company_id);

        created_at: m.created_at,        window._companyId = membership.company_id;

        created_at: m.created_at,      setCompanyName(membership.companies?.name || "");

        created_at: m.created_at,      setUserRole(membership.role);

        created_at: m.created_at,      return membership.company_id;

        created_at: m.created_at,    }

        created_at: m.created_at,

        created_at: m.created_at,    // Check for pending invite using user's email

        created_at: m.created_at,    const { data: invite } = await db

        created_at: m.created_at,      .from("invites")

        created_at: m.created_at,      .select("*")

        created_at: m.created_at,      .eq("email", user.email)

        created_at: m.created_at,      .eq("accepted", false)

        created_at: m.created_at,      .single();

        created_at: m.created_at,

        created_at: m.created_at,    if (invite) {

        created_at: m.created_at,      // Accept the invite — join the existing company with permissions from invite

        created_at: m.created_at,      await db.from("company_members").insert({

        created_at: m.created_at,        company_id: invite.company_id,

        created_at: m.created_at,        user_id: uid,

        created_at: m.created_at,        role: invite.role || "member",

        created_at: m.created_at,        invited_email: user.email,

        created_at: m.created_at,        permissions: invite.permissions || null,

        created_at: m.created_at,      });

        created_at: m.created_at,      await db.from("invites").update({ accepted: true }).eq("id", invite.id);

        created_at: m.created_at,      const { data: co } = await db.from("companies").select("name").eq("id", invite.company_id).single();

        created_at: m.created_at,      setCompanyId(invite.company_id);

        created_at: m.created_at,      setCompanyName(co?.name || "");

        created_at: m.created_at,      setUserRole(invite.role || "member");

        created_at: m.created_at,      setPendingInvite(null);

        created_at: m.created_at,      return invite.company_id;

        created_at: m.created_at,    }

        created_at: m.created_at,

        created_at: m.created_at,    // No company yet — create a new one

        created_at: m.created_at,    const compName = brand.tradingName || `${user.user_metadata?.full_name || "My"}'s Business`;

        created_at: m.created_at,    const { data: newCompany } = await db

        created_at: m.created_at,      .from("companies")

        created_at: m.created_at,      .insert({ name: compName })

        created_at: m.created_at,      .select()

        created_at: m.created_at,      .single();

        created_at: m.created_at,

        created_at: m.created_at,    if (newCompany) {

        created_at: m.created_at,      await db.from("company_members").insert({

        created_at: m.created_at,        company_id: newCompany.id,

        created_at: m.created_at,        user_id: uid,

        created_at: m.created_at,        role: "owner",

        created_at: m.created_at,      });

        created_at: m.created_at,      setCompanyId(newCompany.id);

        created_at: m.created_at,      setCompanyName(newCompany.name);

        created_at: m.created_at,      setUserRole("owner");

        created_at: m.created_at,      return newCompany.id;

        created_at: m.created_at,    }

        created_at: m.created_at,    return null;

        created_at: m.created_at,  };

        created_at: m.created_at,

        created_at: m.created_at,  // ── Load all data from Supabase on login ──────────────────────────────────

        created_at: m.created_at,  // fetchAll is hoisted out of the mount useEffect so the manual refresh

        created_at: m.created_at,  // button (header) and any other consumer can re-run it. Same data, same

        created_at: m.created_at,  // setters — just a function we can call again on demand.

        created_at: m.created_at,  const fetchAll = async () => {

        created_at: m.created_at,    if (!user) return;

        created_at: m.created_at,    setDbLoading(true);

        created_at: m.created_at,    try {

        created_at: m.created_at,      const cid = await getOrCreateCompany(user.id);

        created_at: m.created_at,      if (!cid) { setDbLoading(false); return; }

        created_at: m.created_at,

        created_at: m.created_at,      // Load members for team management via the get_company_members

        created_at: m.created_at,      // RPC — a SECURITY DEFINER function that safely exposes

        created_at: m.created_at,      // auth.users.email for members of the caller's own company.

        created_at: m.created_at,      // Returns rows with a user_email column alongside the normal

        created_at: m.created_at,      // company_members fields.

        created_at: m.created_at,      const { data: mem } = await db.rpc("get_company_members", { p_company_id: cid });

        created_at: m.created_at,      if (mem) setMembers(mem);

        created_at: m.created_at,

        created_at: m.created_at,      const [j, inv, enq, mat, cust, contacts] = await Promise.all([

        created_at: m.created_at,        db.from("jobs").select("*").eq("company_id", cid).order("date_obj", { ascending: true }),

        created_at: m.created_at,        db.from("invoices").select("*").eq("company_id", cid).order("created_at", { ascending: false }),

        created_at: m.created_at,        db.from("enquiries").select("*").eq("company_id", cid).order("created_at", { ascending: false }),

        created_at: m.created_at,        db.from("materials").select("*").eq("company_id", cid).order("created_at", { ascending: true }),

        created_at: m.created_at,        db.from("customers").select("*").eq("company_id", cid).order("name", { ascending: true }),

        created_at: m.created_at,        db.from("customer_contacts").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),

        created_at: m.created_at,      ]);

        created_at: m.created_at,      if (j.data) setJobsRaw(j.data.map(r => ({ ...r, dateObj: r.date_obj })));

        created_at: m.created_at,      if (inv.data) setInvoicesRaw(inv.data.map(r => ({

        created_at: m.created_at,        ...r,

        created_at: m.created_at,        vatEnabled: r.vat_enabled, vatRate: parseFloat(r.vat_rate) || 20,

        created_at: m.created_at,        vatType: r.vat_type || "", vatZeroRated: r.vat_zero_rated || false,

        created_at: m.created_at,        isQuote: r.is_quote, paymentMethod: r.payment_method,

        created_at: m.created_at,        amount: parseFloat(r.amount) || 0,

        created_at: m.created_at,        grossAmount: parseFloat(r.gross_amount || r.amount) || 0,

        created_at: m.created_at,        jobRef: r.job_ref || "", address: r.address || "", email: r.email || "",

        created_at: m.created_at,        lineItems: Array.isArray(r.line_items) ? r.line_items : (r.line_items ? JSON.parse(r.line_items) : []),

        created_at: m.created_at,        materialItems: Array.isArray(r.material_items) ? r.material_items : (r.material_items ? JSON.parse(r.material_items) : []),

        created_at: m.created_at,        cisEnabled: r.cis_enabled || false, cisRate: parseFloat(r.cis_rate) || 20,

        created_at: m.created_at,        cisLabour: parseFloat(r.cis_labour) || 0,

        created_at: m.created_at,        cisMaterials: parseFloat(r.cis_materials) || 0,

        created_at: m.created_at,        cisDeduction: parseFloat(r.cis_deduction) || 0,

        created_at: m.created_at,        cisNetPayable: parseFloat(r.cis_net_payable) || 0,

        created_at: m.created_at,        // Chase tracking — DB uses snake_case, in-memory uses camelCase.

        created_at: m.created_at,        // Mirror both so everywhere that reads either form works correctly.

        created_at: m.created_at,        // See chase_invoice tool handler for the write side.

        created_at: m.created_at,        chaseCount: r.chase_count || 0,

        created_at: m.created_at,        lastChased: r.last_chased_at || null,

        created_at: m.created_at,      })));

        created_at: m.created_at,      if (enq.data) setEnquiriesRaw(enq.data);

        created_at: m.created_at,      if (mat.data) setMaterialsRaw(mat.data.map(m => ({

        created_at: m.created_at,        id: m.id,

        created_at: m.created_at,        item: m.item || "",

        created_at: m.created_at,        qty: m.qty || 1,

        created_at: m.created_at,        unitPrice: m.unit_price || 0,

        created_at: m.created_at,        supplier: m.supplier || "",

        created_at: m.created_at,        job: m.job || "",

        created_at: m.created_at,        status: m.status || "to_order",

        created_at: m.created_at,        receiptId: m.receipt_id || "",

        created_at: m.created_at,        receiptSource: m.receipt_source || "",

        created_at: m.created_at,        receiptFilename: m.receipt_filename || "",

        created_at: m.created_at,        receiptStoragePath: m.receipt_storage_path || "", // Supabase Storage path (preferred)

        created_at: m.created_at,        receiptImage: m.receipt_image || "", // legacy base64 column — only one row in prod

        created_at: m.created_at,      })));

        created_at: m.created_at,      if (cust.data) setCustomersRaw(cust.data);

        created_at: m.created_at,      if (contacts.data) setCustomerContactsRaw(contacts.data.map(c => ({

        created_at: m.created_at,        id: c.id,

        created_at: m.created_at,        customerId: c.customer_id,

        created_at: m.created_at,        name: c.name || "",

        created_at: m.created_at,        role: c.role || "",

        created_at: m.created_at,        phone: c.phone || "",

        created_at: m.created_at,        email: c.email || "",

        created_at: m.created_at,        notes: c.notes || "",

        created_at: m.created_at,        isPrimary: !!c.is_primary,

        created_at: m.created_at,        isBilling: !!c.is_billing,

        created_at: m.created_at,      })));

        created_at: m.created_at,    } catch (e) { console.error("DB load error:", e); }

        created_at: m.created_at,    setDbLoading(false);

        created_at: m.created_at,  };

        created_at: m.created_at,

        created_at: m.created_at,  useEffect(() => {

        created_at: m.created_at,    if (!user) return;

        created_at: m.created_at,    fetchAll();

        created_at: m.created_at,  }, [user?.id]);

        created_at: m.created_at,

        created_at: m.created_at,  // Manual refresh — bound to the header refresh button and exposed via

        created_at: m.created_at,  // window._tradePaRefresh so anywhere else (e.g. a future pull-to-refresh

        created_at: m.created_at,  // gesture, or an AI tool case) can trigger it without prop-drilling.

        created_at: m.created_at,  // Also re-fetches in-app notifications so the bell badge stays in sync.

        created_at: m.created_at,  // Bumping jobsRefreshKey forces JobsTab to re-mount which re-runs its

        created_at: m.created_at,  // own per-tab loaders.

        created_at: m.created_at,  const refreshAllData = async () => {

        created_at: m.created_at,    if (dbLoading) return; // prevent rapid double-taps

        created_at: m.created_at,    await Promise.all([

        created_at: m.created_at,      fetchAll(),

        created_at: m.created_at,      loadInAppNotifs(),

        created_at: m.created_at,    ]);

        created_at: m.created_at,    setJobsRefreshKey(k => k + 1);

        created_at: m.created_at,  };

        created_at: m.created_at,  useEffect(() => {

        created_at: m.created_at,    window._tradePaRefresh = refreshAllData;

        created_at: m.created_at,    return () => { delete window._tradePaRefresh; };

        created_at: m.created_at,  }, [dbLoading]);

        created_at: m.created_at,

        created_at: m.created_at,  // ── Company-aware Supabase setters ────────────────────────────────────────

        created_at: m.created_at,  const setJobs = (updater) => {

        created_at: m.created_at,    setJobsRaw(prev => {

        created_at: m.created_at,      const next = typeof updater === "function" ? updater(prev) : updater;

        created_at: m.created_at,      if (!companyId) return next;

        created_at: m.created_at,      (async () => {

        created_at: m.created_at,        try {

        created_at: m.created_at,          const prevIds = new Set(prev.map(j => String(j.id)));

        created_at: m.created_at,          const nextIds = new Set(next.map(j => String(j.id)));

        created_at: m.created_at,          for (const id of prevIds) {

        created_at: m.created_at,            if (!nextIds.has(id)) await db.from("jobs").delete().eq("id", id).eq("company_id", companyId);

        created_at: m.created_at,          }

        created_at: m.created_at,          for (const job of next) {

        created_at: m.created_at,            if (!prevIds.has(String(job.id))) {

        created_at: m.created_at,              await db.from("jobs").upsert({

        created_at: m.created_at,                id: String(job.id), company_id: companyId, user_id: user.id,

        created_at: m.created_at,                customer: job.customer, address: job.address, type: job.type,

        created_at: m.created_at,                date: job.date, date_obj: job.dateObj || job.date_obj,

        created_at: m.created_at,                status: job.status, value: job.value || 0, notes: job.notes || "",

        created_at: m.created_at,              });

        created_at: m.created_at,            } else {

        created_at: m.created_at,              const old = prev.find(j => String(j.id) === String(job.id));

        created_at: m.created_at,              if (JSON.stringify(old) !== JSON.stringify(job)) {

        created_at: m.created_at,                await db.from("jobs").update({

        created_at: m.created_at,                  customer: job.customer, address: job.address, type: job.type,

        created_at: m.created_at,                  date: job.date, date_obj: job.dateObj || job.date_obj,

        created_at: m.created_at,                  status: job.status, value: job.value || 0, notes: job.notes || "",

        created_at: m.created_at,                }).eq("id", String(job.id)).eq("company_id", companyId);

        created_at: m.created_at,              }

        created_at: m.created_at,            }

        created_at: m.created_at,          }

        created_at: m.created_at,        } catch (e) { console.error("Jobs sync:", e); }

        created_at: m.created_at,      })();

        created_at: m.created_at,      return next;

        created_at: m.created_at,    });

        created_at: m.created_at,  };

        created_at: m.created_at,

        created_at: m.created_at,  const setInvoices = (updater) => {

        created_at: m.created_at,    setInvoicesRaw(prev => {

        created_at: m.created_at,      const next = typeof updater === "function" ? updater(prev) : updater;

        created_at: m.created_at,      if (!companyId) return next;

        created_at: m.created_at,      (async () => {

        created_at: m.created_at,        try {

        created_at: m.created_at,          const prevIds = new Set(prev.map(i => i.id));

        created_at: m.created_at,          const nextIds = new Set(next.map(i => i.id));

        created_at: m.created_at,          for (const id of prevIds) {

        created_at: m.created_at,            if (!nextIds.has(id)) await db.from("invoices").delete().eq("id", id).eq("company_id", companyId);

        created_at: m.created_at,          }

        created_at: m.created_at,          for (const inv of next) {

        created_at: m.created_at,            const invRow = {

        created_at: m.created_at,              id: inv.id, company_id: companyId, user_id: user.id,

        created_at: m.created_at,              customer: inv.customer || "", amount: inv.amount || 0,

        created_at: m.created_at,              gross_amount: inv.grossAmount || inv.amount || 0,

        created_at: m.created_at,              due: inv.due, status: inv.status,

        created_at: m.created_at,              description: inv.description || "",

        created_at: m.created_at,              address: inv.address || "", email: inv.email || "",

        created_at: m.created_at,              vat_enabled: inv.vatEnabled || false, vat_rate: inv.vatRate || 20,

        created_at: m.created_at,              vat_type: inv.vatType || "", vat_zero_rated: inv.vatZeroRated || false,

        created_at: m.created_at,              payment_method: inv.paymentMethod || "both",

        created_at: m.created_at,              is_quote: inv.isQuote || false,

        created_at: m.created_at,              job_ref: inv.jobRef || "",

        created_at: m.created_at,              cis_enabled: inv.cisEnabled || false, cis_rate: inv.cisRate || 20,

        created_at: m.created_at,              cis_labour: inv.cisLabour || 0, cis_materials: inv.cisMaterials || 0,

        created_at: m.created_at,              cis_deduction: inv.cisDeduction || 0, cis_net_payable: inv.cisNetPayable || 0,

        created_at: m.created_at,              line_items: JSON.stringify(inv.lineItems || []),

        created_at: m.created_at,              material_items: JSON.stringify(inv.materialItems || []),

        created_at: m.created_at,            };

        created_at: m.created_at,            if (!prevIds.has(inv.id)) {

        created_at: m.created_at,              await db.from("invoices").upsert(invRow);

        created_at: m.created_at,            } else {

        created_at: m.created_at,              const old = prev.find(i => i.id === inv.id);

        created_at: m.created_at,              if (JSON.stringify(old) !== JSON.stringify(inv)) {

        created_at: m.created_at,                const { id, company_id, user_id, ...updateFields } = invRow;

        created_at: m.created_at,                await db.from("invoices").update(updateFields).eq("id", inv.id).eq("company_id", companyId);

        created_at: m.created_at,              }

        created_at: m.created_at,            }

        created_at: m.created_at,          }

        created_at: m.created_at,        } catch (e) {

        created_at: m.created_at,          console.error("Invoices sync:", e);

        created_at: m.created_at,          // Retry once after 3s — catches brief network blips on mobile

        created_at: m.created_at,          setTimeout(async () => {

        created_at: m.created_at,            try {

        created_at: m.created_at,              for (const inv of next) {

        created_at: m.created_at,                const invRow = { id: inv.id, company_id: companyId, user_id: user.id, customer: inv.customer || "", amount: inv.amount || 0, gross_amount: inv.grossAmount || inv.amount || 0, due: inv.due, status: inv.status, description: inv.description || "", is_quote: inv.isQuote || false, job_ref: inv.jobRef || "", line_items: JSON.stringify(inv.lineItems || []), vat_enabled: inv.vatEnabled || false, vat_rate: inv.vatRate || 20, payment_method: inv.paymentMethod || "both", cis_enabled: inv.cisEnabled || false, cis_rate: inv.cisRate || 20, cis_deduction: inv.cisDeduction || 0, cis_net_payable: inv.cisNetPayable || 0 };

        created_at: m.created_at,                await db.from("invoices").upsert(invRow);

        created_at: m.created_at,              }

        created_at: m.created_at,            } catch(e2) { console.error("Invoices sync retry failed:", e2); }

        created_at: m.created_at,          }, 3000);

        created_at: m.created_at,        }

        created_at: m.created_at,      })();

        created_at: m.created_at,      return next;

        created_at: m.created_at,    });

        created_at: m.created_at,  };

        created_at: m.created_at,

        created_at: m.created_at,  // ─── Enquiries sync wrapper ──────────────────────────────────────────────

        created_at: m.created_at,  // Per-row upsert pattern. Previously this used wipe-and-reinsert on every

        created_at: m.created_at,  // mutation which caused IDs to mutate on every write, silently breaking any

        created_at: m.created_at,  // feature relying on stable enquiry references (reminders linked by

        created_at: m.created_at,  // related_id, push notification deep links, etc).

        created_at: m.created_at,  //

        created_at: m.created_at,  // Assumes every enquiry now carries a real UUID in `id` — guaranteed by

        created_at: m.created_at,  // the three creation paths that use newEnquiryId(): voice create_enquiry

        created_at: m.created_at,  // tool, manual Add Enquiry form, and inbox email-to-enquiry conversion.

        created_at: m.created_at,  const setEnquiries = (updater) => {

        created_at: m.created_at,    setEnquiriesRaw(prev => {

        created_at: m.created_at,      const next = typeof updater === "function" ? updater(prev) : updater;

        created_at: m.created_at,      if (!companyId) return next;

        created_at: m.created_at,      (async () => {

        created_at: m.created_at,        try {

        created_at: m.created_at,          const prevIds = new Set(prev.map(e => e.id).filter(Boolean));

        created_at: m.created_at,          const nextIds = new Set(next.map(e => e.id).filter(Boolean));

        created_at: m.created_at,          // Delete rows that disappeared from the next state

        created_at: m.created_at,          for (const id of prevIds) {

        created_at: m.created_at,            if (!nextIds.has(id)) {

        created_at: m.created_at,              await db.from("enquiries").delete().eq("id", id).eq("company_id", companyId);

        created_at: m.created_at,            }

        created_at: m.created_at,          }

        created_at: m.created_at,          // Insert new rows + update changed rows

        created_at: m.created_at,          for (const e of next) {

        created_at: m.created_at,            const row = {

        created_at: m.created_at,              company_id: companyId, user_id: user.id,

        created_at: m.created_at,              name: e.name, source: e.source, msg: e.msg, time: e.time,

        created_at: m.created_at,              urgent: e.urgent || false, status: e.status || "new",

        created_at: m.created_at,              phone: e.phone || "", email: e.email || "", address: e.address || "",

        created_at: m.created_at,            };

        created_at: m.created_at,            if (!e.id || !prevIds.has(e.id)) {

        created_at: m.created_at,              // New row. If e.id is already a uuid string, pass it through so

        created_at: m.created_at,              // the client's reference matches the DB row. If e.id is missing

        created_at: m.created_at,              // (shouldn't happen after the creation-path fixes, but defensive),

        created_at: m.created_at,              // let Postgres generate one.

        created_at: m.created_at,              if (e.id) row.id = e.id;

        created_at: m.created_at,              await db.from("enquiries").insert(row);

        created_at: m.created_at,            } else {

        created_at: m.created_at,              const old = prev.find(x => x.id === e.id);

        created_at: m.created_at,              if (JSON.stringify(old) !== JSON.stringify(e)) {

        created_at: m.created_at,                await db.from("enquiries").update(row).eq("id", e.id).eq("company_id", companyId);

        created_at: m.created_at,              }

        created_at: m.created_at,            }

        created_at: m.created_at,          }

        created_at: m.created_at,        } catch (err) { console.error("Enquiries sync:", err); }

        created_at: m.created_at,      })();

        created_at: m.created_at,      return next;

        created_at: m.created_at,    });

        created_at: m.created_at,  };

        created_at: m.created_at,

        created_at: m.created_at,  const setMaterials = (updater) => {

        created_at: m.created_at,    // Use setMaterialsRaw directly — individual tools handle their own Supabase writes

        created_at: m.created_at,    // The old delete+reinsert pattern was causing duplicates to re-appear after cleanup

        created_at: m.created_at,    setMaterialsRaw(updater);

        created_at: m.created_at,  };

        created_at: m.created_at,

        created_at: m.created_at,  const setCustomers = (updater) => {

        created_at: m.created_at,    setCustomersRaw(prev => {

        created_at: m.created_at,      const next = typeof updater === "function" ? updater(prev) : updater;

        created_at: m.created_at,      if (!companyId) return next;

        created_at: m.created_at,      (async () => {

        created_at: m.created_at,        try {

        created_at: m.created_at,          const prevIds = new Set(prev.map(c => c.id));

        created_at: m.created_at,          const nextIds = new Set(next.map(c => c.id));

        created_at: m.created_at,          for (const id of prevIds) {

        created_at: m.created_at,            if (!nextIds.has(id)) await db.from("customers").delete().eq("id", id).eq("company_id", companyId);

        created_at: m.created_at,          }

        created_at: m.created_at,          for (const c of next) {

        created_at: m.created_at,            if (!prevIds.has(c.id)) {

        created_at: m.created_at,              // Skip rows already inserted directly via db.from('customers').insert(...)

        created_at: m.created_at,              // — those carry a created_at from the server or offline handler.

        created_at: m.created_at,              // Without this, the Add Customer flow (which now pre-inserts to get

        created_at: m.created_at,              // a real id before building contacts) would cause a duplicate insert.

        created_at: m.created_at,              if (c.created_at) continue;

        created_at: m.created_at,              await db.from("customers").insert({

        created_at: m.created_at,                company_id: companyId, user_id: user.id,

        created_at: m.created_at,                name: c.name, phone: c.phone || "", email: c.email || "",

        created_at: m.created_at,                address: c.address || "", notes: c.notes || "",

        created_at: m.created_at,                is_company: !!c.is_company,

        created_at: m.created_at,              });

        created_at: m.created_at,            } else {

        created_at: m.created_at,              const old = prev.find(x => x.id === c.id);

        created_at: m.created_at,              if (JSON.stringify(old) !== JSON.stringify(c)) {

        created_at: m.created_at,                await db.from("customers").update({

        created_at: m.created_at,                  name: c.name, phone: c.phone || "", email: c.email || "",

        created_at: m.created_at,                  address: c.address || "", notes: c.notes || "",

        created_at: m.created_at,                  is_company: !!c.is_company,

        created_at: m.created_at,                }).eq("id", c.id).eq("company_id", companyId);

        created_at: m.created_at,              }

        created_at: m.created_at,            }

        created_at: m.created_at,          }

        created_at: m.created_at,        } catch (e) { console.error("Customers sync:", e); }

        created_at: m.created_at,      })();

        created_at: m.created_at,      return next;

        created_at: m.created_at,    });

        created_at: m.created_at,  };

        created_at: m.created_at,

        created_at: m.created_at,  // ─── Customer contacts sync wrapper ──────────────────────────────────────

        created_at: m.created_at,  // Same diff-and-sync pattern as setCustomers. Each contact belongs to exactly

        created_at: m.created_at,  // one customer via customerId. Rows use UUID primary keys so client-side ID

        created_at: m.created_at,  // is generated server-side on insert (we rely on Supabase gen_random_uuid).

        created_at: m.created_at,  const setCustomerContacts = (updater) => {

        created_at: m.created_at,    setCustomerContactsRaw(prev => {

        created_at: m.created_at,      const next = typeof updater === "function" ? updater(prev) : updater;

        created_at: m.created_at,      if (!user?.id) return next;

        created_at: m.created_at,      (async () => {

        created_at: m.created_at,        try {

        created_at: m.created_at,          const prevIds = new Set(prev.map(c => c.id).filter(Boolean));

        created_at: m.created_at,          const nextIds = new Set(next.map(c => c.id).filter(Boolean));

        created_at: m.created_at,          for (const id of prevIds) {

        created_at: m.created_at,            if (!nextIds.has(id)) {

        created_at: m.created_at,              await db.from("customer_contacts").delete().eq("id", id).eq("user_id", user.id);

        created_at: m.created_at,            }

        created_at: m.created_at,          }

        created_at: m.created_at,          for (let idx = 0; idx < next.length; idx++) {

        created_at: m.created_at,            const c = next[idx];

        created_at: m.created_at,            if (!c.id || !prevIds.has(c.id)) {

        created_at: m.created_at,              // New contact — insert and capture the server-assigned UUID back into state

        created_at: m.created_at,              const { data: inserted } = await db.from("customer_contacts").insert({

        created_at: m.created_at,                customer_id: c.customerId,

        created_at: m.created_at,                user_id: user.id,

        created_at: m.created_at,                company_id: companyId,

        created_at: m.created_at,                name: c.name || "",

        created_at: m.created_at,                role: c.role || "",

        created_at: m.created_at,                phone: c.phone || "",

        created_at: m.created_at,                email: c.email || "",

        created_at: m.created_at,                notes: c.notes || "",

        created_at: m.created_at,                is_primary: !!c.isPrimary,

        created_at: m.created_at,                is_billing: !!c.isBilling,

        created_at: m.created_at,              }).select().single();

        created_at: m.created_at,              if (inserted) {

        created_at: m.created_at,                setCustomerContactsRaw(curr => curr.map((x, i) => (i === idx && !x.id) ? { ...x, id: inserted.id } : x));

        created_at: m.created_at,              }

        created_at: m.created_at,            } else {

        created_at: m.created_at,              const old = prev.find(x => x.id === c.id);

        created_at: m.created_at,              if (JSON.stringify(old) !== JSON.stringify(c)) {

        created_at: m.created_at,                await db.from("customer_contacts").update({

        created_at: m.created_at,                  name: c.name || "",

        created_at: m.created_at,                  role: c.role || "",

        created_at: m.created_at,                  phone: c.phone || "",

        created_at: m.created_at,                  email: c.email || "",

        created_at: m.created_at,                  notes: c.notes || "",

        created_at: m.created_at,                  is_primary: !!c.isPrimary,

        created_at: m.created_at,                  is_billing: !!c.isBilling,

        created_at: m.created_at,                }).eq("id", c.id).eq("user_id", user.id);

        created_at: m.created_at,              }

        created_at: m.created_at,            }

        created_at: m.created_at,          }

        created_at: m.created_at,        } catch (e) { console.error("Customer contacts sync:", e); }

        created_at: m.created_at,      })();

        created_at: m.created_at,      return next;

        created_at: m.created_at,    });

        created_at: m.created_at,  };

        created_at: m.created_at,

        created_at: m.created_at,  // Watch for reminders that just became due

        created_at: m.created_at,  // Show the in-app alert + flash the bell, but don't auto-dismiss —

        created_at: m.created_at,  // the user must explicitly tap "Done ✓" so they don't lose track of

        created_at: m.created_at,  // things they haven't actually followed through on yet.

        created_at: m.created_at,  useEffect(() => {

        created_at: m.created_at,    const t = setInterval(() => {

        created_at: m.created_at,      const due = reminders.filter(r => !r.done && !r._due && r.time <= Date.now() && r.time > Date.now() - 60000);

        created_at: m.created_at,      if (due.length > 0) {

        created_at: m.created_at,        setDueNow(d => [...d, ...due.filter(r => !d.find(x => x.id === r.id))]);

        created_at: m.created_at,        setBellFlash(true);

        created_at: m.created_at,        setTimeout(() => setBellFlash(false), 3000);

        created_at: m.created_at,        // Mark as 'fired' so we don't keep alerting on the same reminder,

        created_at: m.created_at,        // but leave 'done' false so it stays visible in Upcoming as Overdue.

        created_at: m.created_at,        due.forEach(r => markFired(r.id));

        created_at: m.created_at,      }

        created_at: m.created_at,    }, 5000);

        created_at: m.created_at,    return () => clearInterval(t);

        created_at: m.created_at,  }, [reminders]);

        created_at: m.created_at,

        created_at: m.created_at,  const upcomingCount = reminders.filter(r => !r.done && !r._due && r.time > now).length;

        created_at: m.created_at,  const overdueCount = reminders.filter(r => !r.done && !r._due && r.time <= now).length;

        created_at: m.created_at,  const alertCount = dueNow.length + overdueCount;

        created_at: m.created_at,

        created_at: m.created_at,  // Auth gate

        created_at: m.created_at,

        created_at: m.created_at,  const handleScanReceipt = async (file) => {

        created_at: m.created_at,    if (!file) return null;

        created_at: m.created_at,    const { fileContent } = await fileToContentBlock(file);

        created_at: m.created_at,    const resp = await fetch("/api/claude", {

        created_at: m.created_at,      method: "POST",

        created_at: m.created_at,      headers: await authHeaders(),

        created_at: m.created_at,      body: JSON.stringify({

        created_at: m.created_at,        model: "claude-sonnet-4-6",

        created_at: m.created_at,        max_tokens: 1000,

        created_at: m.created_at,        messages: [{ role: "user", content: [fileContent, { type: "text", text: "You are reading a UK supplier receipt. Return ONLY valid JSON with keys: supplier, date, total, vatAmount, vatRate, pricesIncVat, items (array of item, qty, unitPrice, unitPriceExVat)" }] }],

        created_at: m.created_at,      }),

        created_at: m.created_at,    });

        created_at: m.created_at,    const data = await resp.json();

        created_at: m.created_at,    const raw = (data.content && data.content[0] && data.content[0].text) || "";

        created_at: m.created_at,    const start = raw.indexOf("{");

        created_at: m.created_at,    const end = raw.lastIndexOf("}");

        created_at: m.created_at,    if (start === -1 || end === -1) throw new Error("Could not parse receipt");

        created_at: m.created_at,    const parsed = JSON.parse(raw.slice(start, end + 1));

        created_at: m.created_at,    const receiptId = "rcpt_" + Date.now();

        created_at: m.created_at,    try { localStorage.setItem("trade-pa-receipt-" + receiptId, dataUrl); } catch (e2) {}

        created_at: m.created_at,    const newMats = (parsed.items || []).map(function(item) {

        created_at: m.created_at,      var vr = parseInt(parsed.vatRate || 0);

        created_at: m.created_at,      var ve = vr > 0;

        created_at: m.created_at,      var exVat = item.unitPriceExVat || (parsed.pricesIncVat && ve ? parseFloat((item.unitPrice / (1 + vr / 100)).toFixed(4)) : item.unitPrice) || 0;

        created_at: m.created_at,      return { item: item.item, qty: item.qty || 1, unitPrice: parseFloat(exVat.toFixed(2)), supplier: parsed.supplier || "", status: "ordered", vatEnabled: ve, vatRate: ve ? vr : null, dueDate: parsed.date || "", receiptId: receiptId, receiptImage: dataUrl };

        created_at: m.created_at,    });

        created_at: m.created_at,    setMaterials(function(prev) { return [...(prev || []), ...newMats]; });

        created_at: m.created_at,    return Object.assign({}, parsed, { receiptId: receiptId, receiptImage: dataUrl });

        created_at: m.created_at,  };

        created_at: m.created_at,

        created_at: m.created_at,  if (authLoading) return (

        created_at: m.created_at,    <div style={{ minHeight: "100vh", background: "#0f0f0f", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono',monospace", color: "#6b7280", fontSize: 13 }}>

        created_at: m.created_at,      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;700&display=swap');`}</style>

        created_at: m.created_at,      Loading Trade PA...

        created_at: m.created_at,    </div>

        created_at: m.created_at,  );

        created_at: m.created_at,

        created_at: m.created_at,  if (!user) return <LandingPage onLogin={() => {}} onAuth={setUser} />;

        created_at: m.created_at,

        created_at: m.created_at,  // Accounts that bypass the subscription check (owner/test accounts)

        created_at: m.created_at,  const isExempt = isExemptAccount(user?.email);

        created_at: m.created_at,

        created_at: m.created_at,  // Subscription paywall — blocks access if payment has lapsed

        created_at: m.created_at,  if (!isExempt && (subscriptionStatus === "past_due" || subscriptionStatus === "cancelled" || subscriptionStatus === "none")) {

        created_at: m.created_at,    return (

        created_at: m.created_at,      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'DM Mono',monospace" }}>

        created_at: m.created_at,        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;700&family=Syne:wght@700;800&display=swap');`}</style>

        created_at: m.created_at,        <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>

        created_at: m.created_at,          <div style={{ width: 56, height: 56, background: "#f59e0b", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: "#000", margin: "0 auto 24px", letterSpacing: "-0.02em" }}>TP</div>

        created_at: m.created_at,          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 800, color: "#f0f0f0", marginBottom: 12 }}>

        created_at: m.created_at,            {subscriptionStatus === "past_due" ? "Payment Required" : subscriptionStatus === "none" ? "No Active Subscription" : "Subscription Ended"}

        created_at: m.created_at,          </div>

        created_at: m.created_at,          <div style={{ fontSize: 14, color: "#888", lineHeight: 1.7, marginBottom: 32 }}>

        created_at: m.created_at,            {subscriptionStatus === "past_due"

        created_at: m.created_at,              ? "Your last payment didn't go through. Please update your payment details to restore access."

        created_at: m.created_at,              : subscriptionStatus === "none"

        created_at: m.created_at,              ? "You don't have an active subscription. Subscribe to get full access to Trade PA."

        created_at: m.created_at,              : "Your subscription has ended. Resubscribe to continue using Trade PA."}

        created_at: m.created_at,          </div>

        created_at: m.created_at,          <a href="https://www.tradespa.co.uk/signup.html" style={{ display: "block", background: "#f59e0b", color: "#000", padding: "16px 32px", borderRadius: 10, fontWeight: 700, fontSize: 15, textDecoration: "none", marginBottom: 12 }}>

        created_at: m.created_at,            {subscriptionStatus === "past_due" ? "Update Payment Details →" : "Subscribe Now →"}

        created_at: m.created_at,          </a>

        created_at: m.created_at,          <button onClick={async () => { await db.auth.signOut(); setUser(null); }} style={{ background: "transparent", border: "none", color: "#555", fontSize: 13, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>

        created_at: m.created_at,            Sign out

        created_at: m.created_at,          </button>

        created_at: m.created_at,        </div>

        created_at: m.created_at,      </div>

        created_at: m.created_at,    );

        created_at: m.created_at,  }

        created_at: m.created_at,

        created_at: m.created_at,  if (dbLoading) return (

        created_at: m.created_at,    <div style={{ minHeight: "100vh", background: "#0f0f0f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono',monospace", color: "#6b7280", fontSize: 13, gap: 12 }}>

        created_at: m.created_at,      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;700&display=swap');`}</style>

        created_at: m.created_at,      <div style={{ fontSize: 28 }}>⚡</div>

        created_at: m.created_at,      <div style={{ color: "#f59e0b", fontWeight: 700 }}>TRADE PA</div>

        created_at: m.created_at,      <div>Loading your data...</div>

        created_at: m.created_at,    </div>

        created_at: m.created_at,  );

        created_at: m.created_at,

        created_at: m.created_at,  // ── ONBOARDING: Step 0 — detecting if onboarding needed ─────────────

        created_at: m.created_at,  if (onboardingStep === 0) return (

        created_at: m.created_at,    <div style={{ minHeight: "100vh", background: "#0f0f0f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono',monospace", color: "#6b7280", fontSize: 13, gap: 12 }}>

        created_at: m.created_at,      <div style={{ width: 48, height: 48, borderRadius: 12, background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: "#000" }}>TP</div>

        created_at: m.created_at,    </div>

        created_at: m.created_at,  );

        created_at: m.created_at,

        created_at: m.created_at,  // ── ONBOARDING: Step 1 — Welcome screen ────────────────────────────

        created_at: m.created_at,  if (onboardingStep === 1) return (

        created_at: m.created_at,    <div style={{ minHeight: "100dvh", background: "#0a0a0a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'DM Sans', sans-serif", color: "#f0f0f0" }}>

        created_at: m.created_at,      <div style={{ maxWidth: 340, width: "100%", textAlign: "center" }}>

        created_at: m.created_at,        <div style={{ width: 72, height: 72, borderRadius: 18, background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 900, color: "#000", margin: "0 auto 28px", fontFamily: "'DM Mono',monospace" }}>TP</div>

        created_at: m.created_at,        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8 }}>Welcome to Trade PA</div>

        created_at: m.created_at,        <div style={{ fontSize: 14, color: "#888", lineHeight: 1.7, marginBottom: 32 }}>Your AI-powered business assistant.<br/>Let's get you set up — takes about 2 minutes.</div>

        created_at: m.created_at,        <div style={{ display: "flex", flexDirection: "column", gap: 10, textAlign: "left", marginBottom: 32 }}>

        created_at: m.created_at,          {[

        created_at: m.created_at,            { icon: "M19 11a7 7 0 01-14 0M12 18v4M8 22h8M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3z", label: "Tell me about your business" },

        created_at: m.created_at,            { icon: "M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2", label: "Name your assistant" },

        created_at: m.created_at,            { icon: "M13 10V3L4 14h7v7l9-11h-7z", label: "Try your first voice command" },

        created_at: m.created_at,          ].map((item, i) => (

        created_at: m.created_at,            <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, background: "#1a1a1a", border: "1px solid #333", borderRadius: 12, padding: "12px 16px" }}>

        created_at: m.created_at,              <div style={{ width: 32, height: 32, borderRadius: 10, background: i === 0 ? "#f59e0b22" : "#1a1a1a", border: `1px solid ${i === 0 ? "#f59e0b44" : "#333"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>

        created_at: m.created_at,                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={i === 0 ? "#f59e0b" : "#888"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon}/></svg>

        created_at: m.created_at,              </div>

        created_at: m.created_at,              <span style={{ fontSize: 13, color: i === 0 ? "#f0f0f0" : "#888" }}>{item.label}</span>

        created_at: m.created_at,            </div>

        created_at: m.created_at,          ))}

        created_at: m.created_at,        </div>

        created_at: m.created_at,        <button

        created_at: m.created_at,          onClick={() => { advanceOnboarding(2); setView("AI Assistant"); }}

        created_at: m.created_at,          style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: "#f59e0b", color: "#000", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}

        created_at: m.created_at,        >Let's go</button>

        created_at: m.created_at,      </div>

        created_at: m.created_at,    </div>

        created_at: m.created_at,  );

        created_at: m.created_at,

        created_at: m.created_at,  return (

        created_at: m.created_at,    <div style={S.app}>

        created_at: m.created_at,      <OfflineBanner onOpenSettings={() => setOfflineSettingsOpen(true)} />

        created_at: m.created_at,      <UpdateBanner />

        created_at: m.created_at,      <OfflineSettings open={offlineSettingsOpen} onClose={() => setOfflineSettingsOpen(false)} />

        created_at: m.created_at,      <ChangelogModal open={changelogOpen} onClose={() => setChangelogOpen(false)} />

        created_at: m.created_at,

        created_at: m.created_at,      {/* ── ONBOARDING OVERLAYS ──────────────────────────────────────── */}

        created_at: m.created_at,

        created_at: m.created_at,      {/* Step 4: Install prompt — skip on desktop */}

        created_at: m.created_at,      {onboardingStep === 4 && isDesktopBrowser && (() => { advanceOnboarding(5); return null; })()}

        created_at: m.created_at,      {onboardingStep === 4 && !isDesktopBrowser && (

        created_at: m.created_at,        <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: "#0a0a0a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'DM Sans',sans-serif" }}>

        created_at: m.created_at,          <div style={{ maxWidth: 340, width: "100%", textAlign: "center" }}>

        created_at: m.created_at,            <div style={{ width: 64, height: 64, borderRadius: 16, background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>

        created_at: m.created_at,              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>

        created_at: m.created_at,            </div>

        created_at: m.created_at,            <div style={{ fontSize: 22, fontWeight: 700, color: "#f0f0f0", marginBottom: 8 }}>Add to your home screen</div>

        created_at: m.created_at,            <div style={{ fontSize: 13, color: "#888", lineHeight: 1.7, marginBottom: 28 }}>Trade PA works best as a home screen app. No app store needed — it installs in seconds.</div>

        created_at: m.created_at,            {isIos ? (

        created_at: m.created_at,              <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 14, padding: "16px 18px", textAlign: "left", marginBottom: 24 }}>

        created_at: m.created_at,                {[

        created_at: m.created_at,                  { n: "1", text: <>Tap the <strong style={{ color: "#f59e0b" }}>Share</strong> button in Safari</> },

        created_at: m.created_at,                  { n: "2", text: <>Scroll down and tap <strong style={{ color: "#f59e0b" }}>Show More</strong></> },

        created_at: m.created_at,                  { n: "3", text: <>Tap <strong style={{ color: "#f59e0b" }}>Add to Home Screen</strong></> },

        created_at: m.created_at,                ].map(({ n, text }) => (

        created_at: m.created_at,                  <div key={n} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: n !== "3" ? "1px solid #333" : "none" }}>

        created_at: m.created_at,                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#000", flexShrink: 0 }}>{n}</div>

        created_at: m.created_at,                    <span style={{ fontSize: 13, color: "#ccc" }}>{text}</span>

        created_at: m.created_at,                  </div>

        created_at: m.created_at,                ))}

        created_at: m.created_at,              </div>

        created_at: m.created_at,            ) : pwaPrompt ? (

        created_at: m.created_at,              <button onClick={async () => { pwaPrompt.prompt(); const { outcome } = await pwaPrompt.userChoice; if (outcome === "accepted") advanceOnboarding(5); }} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: "#f59e0b", color: "#000", fontSize: 15, fontWeight: 600, cursor: "pointer", marginBottom: 24 }}>Install app</button>

        created_at: m.created_at,            ) : (

        created_at: m.created_at,              <div style={{ fontSize: 12, color: "#666", marginBottom: 24 }}>Open in Chrome or Safari for the best install experience.</div>

        created_at: m.created_at,            )}

        created_at: m.created_at,            <div style={{ display: "flex", gap: 10 }}>

        created_at: m.created_at,              <button onClick={() => advanceOnboarding(5)} style={{ flex: 1, padding: 12, borderRadius: 12, border: "1px solid #333", background: "transparent", color: "#888", fontSize: 13, cursor: "pointer" }}>I'll do it later</button>

        created_at: m.created_at,              <button onClick={() => advanceOnboarding(5)} style={{ flex: 1, padding: 12, borderRadius: 12, border: "none", background: "#f59e0b", color: "#000", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Done — next</button>

        created_at: m.created_at,            </div>

        created_at: m.created_at,          </div>

        created_at: m.created_at,        </div>

        created_at: m.created_at,      )}

        created_at: m.created_at,

        created_at: m.created_at,      {/* Step 5: Try your first voice command */}

        created_at: m.created_at,      {onboardingStep === 5 && (

        created_at: m.created_at,        <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: "#0a0a0a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'DM Sans',sans-serif" }}>

        created_at: m.created_at,          <div style={{ maxWidth: 340, width: "100%", textAlign: "center" }}>

        created_at: m.created_at,            <div style={{ fontSize: 10, color: "#888", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Last step</div>

        created_at: m.created_at,            <div style={{ fontSize: 22, fontWeight: 700, color: "#f0f0f0", marginBottom: 8 }}>Try your first command</div>

        created_at: m.created_at,            <div style={{ fontSize: 13, color: "#888", lineHeight: 1.7, marginBottom: 28 }}>{isDesktopBrowser ? "Type this in the chat box..." : "Tap the mic and say..."}</div>

        created_at: m.created_at,            <div style={{ background: "#f59e0b0a", border: "1px solid #f59e0b33", borderRadius: 14, padding: "18px 22px", marginBottom: 28 }}>

        created_at: m.created_at,              <div style={{ fontSize: 16, color: "#f59e0b", fontFamily: "'DM Mono',monospace", lineHeight: 1.6 }}>"Add a customer called John Smith, 07700 900456"</div>

        created_at: m.created_at,            </div>

        created_at: m.created_at,            <button

        created_at: m.created_at,              onClick={() => {

        created_at: m.created_at,                advanceOnboarding(6);

        created_at: m.created_at,                setView("AI Assistant");

        created_at: m.created_at,                // Send the command in background — AI processes while nav tour plays

        created_at: m.created_at,                setTimeout(() => voiceHandle.current?.sendText?.("Add a customer called John Smith, phone 07700 900456"), 400);

        created_at: m.created_at,              }}

        created_at: m.created_at,              style={{ width: 110, height: 110, borderRadius: "50%", background: "#f59e0b", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}

        created_at: m.created_at,            >

        created_at: m.created_at,              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>

        created_at: m.created_at,            </button>

        created_at: m.created_at,            <div style={{ fontSize: 12, color: "#666", marginBottom: 20 }}>Or type it — whatever's easier right now</div>

        created_at: m.created_at,            <button onClick={() => advanceOnboarding(6)} style={{ padding: "8px 18px", borderRadius: 10, border: "1px solid #333", background: "transparent", color: "#666", fontSize: 12, cursor: "pointer" }}>Skip — show me around first</button>

        created_at: m.created_at,          </div>

        created_at: m.created_at,        </div>

        created_at: m.created_at,      )}

        created_at: m.created_at,

        created_at: m.created_at,      {/* Step 6: Navigation tour overlay — device-aware */}

        created_at: m.created_at,      {onboardingStep === 6 && (() => {

        created_at: m.created_at,        const MOBILE_TOUR = [

        created_at: m.created_at,          { label: "This is home", desc: "Your PA lives here. Tap the mic to get started.", tabIndex: 0 },

        created_at: m.created_at,          { label: "Your jobs", desc: "Job cards, materials, labour, photos, certs, and daywork.", tabIndex: 1 },

        created_at: m.created_at,          { label: "Your diary", desc: "Your schedule. Book jobs by voice or tap to add.", tabIndex: 2 },

        created_at: m.created_at,          { label: "Accounts", desc: "Invoices, quotes, expenses, mileage, CIS — all your money stuff.", tabIndex: 3 },

        created_at: m.created_at,          { label: "People", desc: "Customers, subcontractors, and your team.", tabIndex: 4 },

        created_at: m.created_at,          { label: "Settings", desc: "Tap your avatar to open Settings. Bank details, logo, trade registrations.", tabIndex: -1 },

        created_at: m.created_at,          { label: "Speak from anywhere", desc: "This mic button follows you to every screen. Tap it — hands-free, no touching your phone.", tabIndex: -2 },

        created_at: m.created_at,        ];

        created_at: m.created_at,        const DESKTOP_TOUR = [

        created_at: m.created_at,          { label: "Home", desc: "Your PA lives here. Type commands or use the mic.", group: "home", itemIndex: 0 },

        created_at: m.created_at,          { label: "Jobs", desc: "Enquiries, job cards, materials, stock, RAMS, and documents.", group: "work", itemIndex: -1 },

        created_at: m.created_at,          { label: "Diary", desc: "Your schedule and reminders. Book jobs by voice or click to add.", group: "diary", itemIndex: -1 },

        created_at: m.created_at,          { label: "Accounts", desc: "Invoices, quotes, expenses, mileage, payments, CIS, and reports.", group: "money", itemIndex: -1 },

        created_at: m.created_at,          { label: "People", desc: "Customers, subcontractors, and your team.", group: "people", itemIndex: -1 },

        created_at: m.created_at,          { label: "Settings", desc: "Click your avatar in the top right. Bank details, logo, trade registrations.", group: "admin", itemIndex: -1 },

        created_at: m.created_at,        ];

        created_at: m.created_at,        const TOUR = isDesktopBrowser ? DESKTOP_TOUR : MOBILE_TOUR;

        created_at: m.created_at,        const current = TOUR[navTourStep];

        created_at: m.created_at,        if (!current) return null;

        created_at: m.created_at,        const advance = () => { if (navTourStep < TOUR.length - 1) setNavTourStep(s => s + 1); else completeOnboarding(); };

        created_at: m.created_at,        const dotRow = (

        created_at: m.created_at,          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>

        created_at: m.created_at,            <div style={{ display: "flex", gap: 5 }}>

        created_at: m.created_at,              {TOUR.map((_, i) => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i === navTourStep ? "#f59e0b" : "#444" }} />)}

        created_at: m.created_at,            </div>

        created_at: m.created_at,            <span style={{ fontSize: 12, color: navTourStep < TOUR.length - 1 ? "#f59e0b" : "#4ade80", fontWeight: 600 }}>

        created_at: m.created_at,              {navTourStep < TOUR.length - 1 ? (isDesktopBrowser ? "Click to continue" : "Tap to continue") : "Done — let's go!"}

        created_at: m.created_at,            </span>

        created_at: m.created_at,          </div>

        created_at: m.created_at,        );

        created_at: m.created_at,        const tooltip = (

        created_at: m.created_at,          <div style={{ background: "#1a1a1a", border: "1.5px solid #f59e0b", borderRadius: 14, padding: "14px 18px", maxWidth: 280, cursor: "pointer" }} onClick={advance}>

        created_at: m.created_at,            <div style={{ fontSize: 15, fontWeight: 700, color: "#f0f0f0", marginBottom: 4 }}>{current.label}</div>

        created_at: m.created_at,            <div style={{ fontSize: 12, color: "#aaa", lineHeight: 1.6, marginBottom: 10 }}>{current.desc}</div>

        created_at: m.created_at,            {dotRow}

        created_at: m.created_at,          </div>

        created_at: m.created_at,        );

        created_at: m.created_at,

        created_at: m.created_at,        if (isDesktopBrowser) {

        created_at: m.created_at,          // Desktop: highlight sidebar groups

        created_at: m.created_at,          const sidebarGroups = ["home", "work", "diary", "money", "people", "admin"];

        created_at: m.created_at,          const highlightIndex = sidebarGroups.indexOf(current.group);

        created_at: m.created_at,          return (

        created_at: m.created_at,            <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: "#000c", display: "flex" }} onClick={advance}>

        created_at: m.created_at,              {/* Fake sidebar with highlighted group */}

        created_at: m.created_at,              <div style={{ width: 220, flexShrink: 0, padding: "16px 8px", background: "#111", borderRight: "1px solid #333" }}>

        created_at: m.created_at,                {sidebarGroups.map((gId, gi) => {

        created_at: m.created_at,                  const isActive = gi === highlightIndex;

        created_at: m.created_at,                  const labels = { home: "Home", work: "Jobs", diary: "Diary", money: "Accounts", people: "People", admin: "Admin" };

        created_at: m.created_at,                  return (

        created_at: m.created_at,                    <div key={gId} style={{ marginBottom: 14, opacity: isActive ? 1 : 0.15 }}>

        created_at: m.created_at,                      <div style={{ fontSize: 9, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em", padding: "4px 12px 6px", fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{labels[gId]}</div>

        created_at: m.created_at,                      {isActive && (

        created_at: m.created_at,                        <div style={{ padding: "7px 12px", borderRadius: 10, background: "#f59e0b", color: "#000", fontSize: 12, fontWeight: 700, fontFamily: "'DM Mono',monospace", boxShadow: "0 0 0 2px #f59e0b66" }}>

        created_at: m.created_at,                          {labels[gId] === "Home" ? "Home" : labels[gId]}

        created_at: m.created_at,                        </div>

        created_at: m.created_at,                      )}

        created_at: m.created_at,                    </div>

        created_at: m.created_at,                  );

        created_at: m.created_at,                })}

        created_at: m.created_at,              </div>

        created_at: m.created_at,              {/* Tooltip positioned next to sidebar */}

        created_at: m.created_at,              <div style={{ flex: 1, display: "flex", alignItems: highlightIndex <= 2 ? "flex-start" : "center", justifyContent: "flex-start", padding: "80px 40px" }} onClick={e => e.stopPropagation()}>

        created_at: m.created_at,                {tooltip}

        created_at: m.created_at,              </div>

        created_at: m.created_at,            </div>

        created_at: m.created_at,          );

        created_at: m.created_at,        }

        created_at: m.created_at,

        created_at: m.created_at,        // Mobile: highlight bottom tabs

        created_at: m.created_at,        return (

        created_at: m.created_at,          <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: "#000c", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}

        created_at: m.created_at,            onClick={advance}>

        created_at: m.created_at,            {/* Tooltip */}

        created_at: m.created_at,            <div style={{ position: "absolute", bottom: current.tabIndex === -2 ? 90 : current.tabIndex === -1 ? "auto" : 66, top: current.tabIndex === -1 ? 56 : "auto", left: 16, right: 16, display: "flex", justifyContent: current.tabIndex === -1 ? "flex-end" : current.tabIndex === -2 ? "flex-end" : "center" }} onClick={e => e.stopPropagation()}>

        created_at: m.created_at,              {tooltip}

        created_at: m.created_at,            </div>

        created_at: m.created_at,            {/* Highlighted nav bar */}

        created_at: m.created_at,            {current.tabIndex >= 0 && (

        created_at: m.created_at,              <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", padding: "10px 12px 20px", background: "#111" }}>

        created_at: m.created_at,                {["Home", "Jobs", "Diary", "Accounts", "People"].map((t, i) => (

        created_at: m.created_at,                  <div key={t} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 8px", borderRadius: 10, opacity: i === current.tabIndex ? 1 : 0.2, background: i === current.tabIndex ? "#f59e0b11" : "transparent", boxShadow: i === current.tabIndex ? "0 0 0 2px #f59e0b66" : "none" }}>

        created_at: m.created_at,                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={i === current.tabIndex ? "#f59e0b" : "#888"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">

        created_at: m.created_at,                      {i === 0 && <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>}

        created_at: m.created_at,                      {i === 1 && <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>}

        created_at: m.created_at,                      {i === 2 && <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>}

        created_at: m.created_at,                      {i === 3 && <><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></>}

        created_at: m.created_at,                      {i === 4 && <><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/></>}

        created_at: m.created_at,                    </svg>

        created_at: m.created_at,                    <span style={{ fontSize: 10, color: i === current.tabIndex ? "#f59e0b" : "#888" }}>{t}</span>

        created_at: m.created_at,                  </div>

        created_at: m.created_at,                ))}

        created_at: m.created_at,              </div>

        created_at: m.created_at,            )}

        created_at: m.created_at,            {/* Settings highlight */}

        created_at: m.created_at,            {current.tabIndex === -1 && (

        created_at: m.created_at,              <div style={{ position: "absolute", top: 10, right: 14, padding: 4, borderRadius: "50%", boxShadow: "0 0 0 3px #f59e0b66", background: "#f59e0b11" }}>

        created_at: m.created_at,                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#000" }}>{brand.ownerName?.[0] || "U"}</div>

        created_at: m.created_at,              </div>

        created_at: m.created_at,            )}

        created_at: m.created_at,            {/* Mic highlight */}

        created_at: m.created_at,            {current.tabIndex === -2 && (

        created_at: m.created_at,              <div style={{ position: "absolute", right: 16, bottom: 24, width: 56, height: 56, borderRadius: "50%", background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 4px #f59e0b66" }}>

        created_at: m.created_at,                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/></svg>

        created_at: m.created_at,              </div>

        created_at: m.created_at,            )}

        created_at: m.created_at,          </div>

        created_at: m.created_at,        );

        created_at: m.created_at,      })()}

        created_at: m.created_at,      {pdfHtml && <PDFOverlay html={pdfHtml} onClose={() => setPdfHtml(null)} />}

        created_at: m.created_at,      {incomingCall?.call && <IncomingCallScreen callerName={incomingCall.callerName} callerNumber={incomingCall.callerNumber} onAnswer={answerCall} onDecline={declineCall} />}

        created_at: m.created_at,      {activeCall?.call && <ActiveCallScreen callerName={activeCall.callerName} callerNumber={activeCall.callerNumber} direction={activeCall.direction} startTime={activeCall.startTime} muted={callMuted} onMute={toggleMute} onHangUp={hangUp} speaker={callSpeaker} onSpeaker={toggleSpeaker} />}

        created_at: m.created_at,      {micBlocked && (

        created_at: m.created_at,        <div style={{ position: "fixed", top: "max(52px, env(safe-area-inset-top, 52px))", left: 0, right: 0, zIndex: 200, background: "#ef4444", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>

        created_at: m.created_at,          <span style={{ fontSize: 16 }}>🎙️</span>

        created_at: m.created_at,          <div style={{ flex: 1, fontSize: 12, color: "#fff", lineHeight: 1.5 }}>

        created_at: m.created_at,            <strong>Microphone blocked</strong> — calls can't ring in the app. Go to your browser/device settings and allow microphone access for Trade PA.

        created_at: m.created_at,          </div>

        created_at: m.created_at,          <button onClick={() => setMicBlocked(false)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: "0 4px" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>

        created_at: m.created_at,        </div>

        created_at: m.created_at,      )}

        created_at: m.created_at,

        created_at: m.created_at,      {/* PWA Install Banner */}

        created_at: m.created_at,      {showPwaBanner && !isStandalone && isWeb() && (

        created_at: m.created_at,        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 500, padding: "12px 16px", paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))", background: "#1a1a1a", borderTop: "1px solid #2a2a2a", display: "flex", alignItems: "center", gap: 12 }}>

        created_at: m.created_at,          <div style={{ width: 36, height: 36, background: "#f59e0b", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, color: "#000", flexShrink: 0 }}>TP</div>

        created_at: m.created_at,          <div style={{ flex: 1, minWidth: 0 }}>

        created_at: m.created_at,            <div style={{ fontSize: 13, fontWeight: 700, color: "#f0f0f0" }}>Install Trade PA</div>

        created_at: m.created_at,            {isIos

        created_at: m.created_at,              ? <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>Tap <strong style={{ color: "#f59e0b" }}>Share</strong> → <strong style={{ color: "#f59e0b" }}>Show More</strong> → <strong style={{ color: "#f59e0b" }}>Add to Home Screen</strong></div>

        created_at: m.created_at,              : <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>Add to your home screen for the best experience</div>

        created_at: m.created_at,            }

        created_at: m.created_at,          </div>

        created_at: m.created_at,          {pwaPrompt && !isIos && (

        created_at: m.created_at,            <button onClick={async () => { pwaPrompt.prompt(); const { outcome } = await pwaPrompt.userChoice; if (outcome === "accepted") setShowPwaBanner(false); }} style={{ background: "#f59e0b", color: "#000", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono',monospace", flexShrink: 0 }}>Install →</button>

        created_at: m.created_at,          )}

        created_at: m.created_at,          <button aria-label="Close" onClick={() => setShowPwaBanner(false)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", flexShrink: 0, padding: "0 4px" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>

        created_at: m.created_at,        </div>

        created_at: m.created_at,      )}

        created_at: m.created_at,      <style>{`

        created_at: m.created_at,        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500;700&display=swap');

        created_at: m.created_at,        *{box-sizing:border-box;margin:0;padding:0;}

        created_at: m.created_at,        html,body{width:100%;overflow-x:hidden;}

        created_at: m.created_at,        ::-webkit-scrollbar{width:5px;}

        created_at: m.created_at,        ::-webkit-scrollbar-track{background:var(--c-surface);}

        created_at: m.created_at,        ::-webkit-scrollbar-thumb{background:var(--c-border);border-radius:3px;}

        created_at: m.created_at,        .nav-scroll::-webkit-scrollbar{display:none;}

        created_at: m.created_at,        button:hover:not(:disabled){opacity:0.82;}

        created_at: m.created_at,        input:focus,textarea:focus{border-color:#f59e0b !important;outline:none;}

        created_at: m.created_at,        @keyframes bellPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.3)}}

        created_at: m.created_at,        img{max-width:100%;}

        created_at: m.created_at,        /* iOS Safari zooms into any input/textarea/select with computed

        created_at: m.created_at,           font-size < 16px when tapped, and never zooms back out. The fix

        created_at: m.created_at,           is to enforce a 16px minimum globally — the !important wins

        created_at: m.created_at,           against inline styles like fontSize: 11/12/13 scattered throughout

        created_at: m.created_at,           the codebase. Slightly chunkier inputs are an acceptable trade for

        created_at: m.created_at,           "phone form-filling that doesn't make you want to throw it out

        created_at: m.created_at,           the window." Date / time / number inputs are included because

        created_at: m.created_at,           they trigger the same zoom behaviour. */

        created_at: m.created_at,        input,textarea,select{font-size:16px !important;}

        created_at: m.created_at,      `}</style>

        created_at: m.created_at,      <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 100, width: "100%" }}>

        created_at: m.created_at,        {/* New simplified header — Session C + mockup-faithful: brand + bell + avatar only */}

        created_at: m.created_at,        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", paddingTop: "max(12px, env(safe-area-inset-top, 12px))", height: "calc(54px + env(safe-area-inset-top, 0px))", boxSizing: "border-box", position: "relative" }}>

        created_at: m.created_at,          {/* Brand — tap returns to Home (Dashboard) */}

        created_at: m.created_at,          <div style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }} onClick={() => setView("AI Assistant")}>

        created_at: m.created_at,            <div style={{

        created_at: m.created_at,              width: 30, height: 30,

        created_at: m.created_at,              background: C.amber,

        created_at: m.created_at,              color: "#000",

        created_at: m.created_at,              borderRadius: 8,

        created_at: m.created_at,              display: "grid", placeItems: "center",

        created_at: m.created_at,              fontFamily: "'DM Mono', monospace",

        created_at: m.created_at,              fontSize: 12, fontWeight: 900,

        created_at: m.created_at,            }}>TP</div>

        created_at: m.created_at,            <div style={{

        created_at: m.created_at,              fontFamily: "'DM Mono', monospace",

        created_at: m.created_at,              fontSize: 12, fontWeight: 700,

        created_at: m.created_at,              letterSpacing: "0.14em",

        created_at: m.created_at,              color: C.text,

        created_at: m.created_at,            }}>TRADE PA</div>

        created_at: m.created_at,          </div>

        created_at: m.created_at,          {/* Right: bell + avatar */}

        created_at: m.created_at,          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>

        created_at: m.created_at,            {/* Manual refresh — re-fetches jobs/invoices/enquiries/materials/

        created_at: m.created_at,                customers/notifications from Supabase. Tradies on flaky 4G

        created_at: m.created_at,                often have stale state (especially after voice-driven changes

        created_at: m.created_at,                from another device); this button is the explicit "give me

        created_at: m.created_at,                the latest" without losing app state, modals, or AI context. */}

        created_at: m.created_at,            <button

        created_at: m.created_at,              onClick={() => { if (typeof window._tradePaRefresh === "function") window._tradePaRefresh(); }}

        created_at: m.created_at,              disabled={dbLoading}

        created_at: m.created_at,              aria-label="Refresh data"

        created_at: m.created_at,              title="Refresh"

        created_at: m.created_at,              style={{

        created_at: m.created_at,                width: 36, height: 36,

        created_at: m.created_at,                background: "transparent",

        created_at: m.created_at,                border: "none",

        created_at: m.created_at,                borderRadius: 10,

        created_at: m.created_at,                color: dbLoading ? C.amber : C.textDim,

        created_at: m.created_at,                cursor: dbLoading ? "wait" : "pointer",

        created_at: m.created_at,                display: "grid", placeItems: "center",

        created_at: m.created_at,              }}

        created_at: m.created_at,            >

        created_at: m.created_at,              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: dbLoading ? "spin 0.9s linear infinite" : "none", transformOrigin: "center" }}>

        created_at: m.created_at,                <polyline points="23 4 23 10 17 10" />

        created_at: m.created_at,                <polyline points="1 20 1 14 7 14" />

        created_at: m.created_at,                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />

        created_at: m.created_at,              </svg>

        created_at: m.created_at,            </button>

        created_at: m.created_at,            {/* Notification bell with count.

        created_at: m.created_at,                The badge surfaces two signals in priority order:

        created_at: m.created_at,                  1. alertCount (overdue/due-now reminders) — red, most urgent

        created_at: m.created_at,                  2. unreadNotifCount (in-app notifs — customer viewed, etc) — amber

        created_at: m.created_at,                Future reminders are NOT badged here — they're surfaced via the

        created_at: m.created_at,                Reminders bottom-nav badge instead. Otherwise the bell would

        created_at: m.created_at,                claim "you have things to look at" when tapping it leads to a

        created_at: m.created_at,                panel that doesn't show reminders.

        created_at: m.created_at,                Tap routing: red badge → Reminders (the actionable surface for

        created_at: m.created_at,                overdue items). Amber badge → Notifications. Both → Notifications

        created_at: m.created_at,                (it has links into Reminders inside it). */}

        created_at: m.created_at,            <button

        created_at: m.created_at,              onClick={() => {

        created_at: m.created_at,                if (alertCount > 0 && unreadNotifCount === 0) setView("Reminders");

        created_at: m.created_at,                else setView("Notifications");

        created_at: m.created_at,              }}

        created_at: m.created_at,              aria-label="Notifications"

        created_at: m.created_at,              style={{

        created_at: m.created_at,                position: "relative",

        created_at: m.created_at,                width: 36, height: 36,

        created_at: m.created_at,                background: "transparent",

        created_at: m.created_at,                border: "none",

        created_at: m.created_at,                borderRadius: 10,

        created_at: m.created_at,                color: C.textDim,

        created_at: m.created_at,                cursor: "pointer",

        created_at: m.created_at,                display: "grid", placeItems: "center",

        created_at: m.created_at,              }}

        created_at: m.created_at,            >

        created_at: m.created_at,              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: bellFlash ? "bellPulse 0.4s ease 3" : "none" }}>

        created_at: m.created_at,                <path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />

        created_at: m.created_at,              </svg>

        created_at: m.created_at,              {(alertCount > 0 || unreadNotifCount > 0) && (

        created_at: m.created_at,                <div style={{

        created_at: m.created_at,                  position: "absolute",

        created_at: m.created_at,                  top: 2, right: 2,

        created_at: m.created_at,                  minWidth: 18, height: 18,

        created_at: m.created_at,                  padding: "0 5px",

        created_at: m.created_at,                  background: alertCount > 0 ? C.red : C.amber,

        created_at: m.created_at,                  color: alertCount > 0 ? "#fff" : "#000",

        created_at: m.created_at,                  borderRadius: 9,

        created_at: m.created_at,                  fontFamily: "'DM Mono', monospace",

        created_at: m.created_at,                  fontSize: 10, fontWeight: 700,

        created_at: m.created_at,                  display: "grid", placeItems: "center",

        created_at: m.created_at,                  border: `2px solid ${C.surface}`,

        created_at: m.created_at,                }}>{alertCount > 0 ? alertCount : unreadNotifCount}</div>

        created_at: m.created_at,              )}

        created_at: m.created_at,            </button>

        created_at: m.created_at,            {/* Avatar button — opens dropdown menu */}

        created_at: m.created_at,            <button

        created_at: m.created_at,              onClick={() => setAvatarMenuOpen(v => !v)}

        created_at: m.created_at,              aria-label="Account menu"

        created_at: m.created_at,              aria-expanded={avatarMenuOpen}

        created_at: m.created_at,              style={{

        created_at: m.created_at,                position: "relative",

        created_at: m.created_at,                width: 34, height: 34,

        created_at: m.created_at,                borderRadius: "50%",

        created_at: m.created_at,                background: `linear-gradient(135deg, ${C.amber}, #B45309)`,

        created_at: m.created_at,                color: "#000",

        created_at: m.created_at,                border: "none",

        created_at: m.created_at,                display: "grid", placeItems: "center",

        created_at: m.created_at,                fontFamily: "'DM Sans', sans-serif",

        created_at: m.created_at,                fontSize: 13, fontWeight: 700,

        created_at: m.created_at,                cursor: "pointer",

        created_at: m.created_at,                padding: 0,

        created_at: m.created_at,              }}

        created_at: m.created_at,            >

        created_at: m.created_at,              {(brand?.email || user?.email || "?")[0].toUpperCase()}

        created_at: m.created_at,              <span style={{

        created_at: m.created_at,                position: "absolute",

        created_at: m.created_at,                bottom: -2, right: -2,

        created_at: m.created_at,                width: 10, height: 10,

        created_at: m.created_at,                background: C.green,

        created_at: m.created_at,                borderRadius: "50%",

        created_at: m.created_at,                border: `2px solid ${C.surface}`,

        created_at: m.created_at,              }} />

        created_at: m.created_at,            </button>

        created_at: m.created_at,          </div>

        created_at: m.created_at,

        created_at: m.created_at,          {/* Avatar dropdown menu — overlay, click-outside dismisses */}

        created_at: m.created_at,          {avatarMenuOpen && (

        created_at: m.created_at,            <>

        created_at: m.created_at,              {/* Transparent click-catcher to dismiss on outside-click */}

        created_at: m.created_at,              <div

        created_at: m.created_at,                onClick={() => setAvatarMenuOpen(false)}

        created_at: m.created_at,                style={{

        created_at: m.created_at,                  position: "fixed",

        created_at: m.created_at,                  inset: 0,

        created_at: m.created_at,                  zIndex: 199,

        created_at: m.created_at,                  background: "transparent",

        created_at: m.created_at,                }}

        created_at: m.created_at,              />

        created_at: m.created_at,              <div

        created_at: m.created_at,                style={{

        created_at: m.created_at,                  position: "absolute",

        created_at: m.created_at,                  top: "calc(100% - 4px)",

        created_at: m.created_at,                  right: 14,

        created_at: m.created_at,                  width: 240,

        created_at: m.created_at,                  background: C.surface,

        created_at: m.created_at,                  border: `1px solid ${C.border}`,

        created_at: m.created_at,                  borderRadius: 12,

        created_at: m.created_at,                  boxShadow: "0 20px 50px -10px rgba(0,0,0,0.7), 0 0 40px -10px rgba(245,158,11,0.12)",

        created_at: m.created_at,                  padding: 6,

        created_at: m.created_at,                  zIndex: 200,

        created_at: m.created_at,                }}

        created_at: m.created_at,                role="menu"

        created_at: m.created_at,              >

        created_at: m.created_at,                {/* User header */}

        created_at: m.created_at,                <div style={{ padding: "10px 10px 10px", borderBottom: `1px solid ${C.border}`, marginBottom: 4 }}>

        created_at: m.created_at,                  <div style={{

        created_at: m.created_at,                    fontFamily: "'DM Sans', sans-serif",

        created_at: m.created_at,                    fontSize: 13, fontWeight: 700,

        created_at: m.created_at,                    color: C.text,

        created_at: m.created_at,                    letterSpacing: "-0.01em",

        created_at: m.created_at,                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",

        created_at: m.created_at,                  }}>{brand?.tradingName || companyName || "Account"}</div>

        created_at: m.created_at,                  <div style={{

        created_at: m.created_at,                    fontSize: 11,

        created_at: m.created_at,                    color: C.textDim,

        created_at: m.created_at,                    marginTop: 2,

        created_at: m.created_at,                    fontFamily: "'DM Mono', monospace",

        created_at: m.created_at,                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",

        created_at: m.created_at,                  }}>{brand?.email || user?.email || ""}</div>

        created_at: m.created_at,                </div>

        created_at: m.created_at,

        created_at: m.created_at,                {/* Settings */}

        created_at: m.created_at,                <button

        created_at: m.created_at,                  onClick={() => { setAvatarMenuOpen(false); setView("Settings"); }}

        created_at: m.created_at,                  role="menuitem"

        created_at: m.created_at,                  style={{

        created_at: m.created_at,                    display: "grid",

        created_at: m.created_at,                    gridTemplateColumns: "18px 1fr 12px",

        created_at: m.created_at,                    gap: 10,

        created_at: m.created_at,                    alignItems: "center",

        created_at: m.created_at,                    width: "100%",

        created_at: m.created_at,                    padding: 10,

        created_at: m.created_at,                    borderRadius: 8,

        created_at: m.created_at,                    background: "transparent",

        created_at: m.created_at,                    border: "none",

        created_at: m.created_at,                    color: C.text,

        created_at: m.created_at,                    fontSize: 13, fontWeight: 500,

        created_at: m.created_at,                    fontFamily: "'DM Sans', sans-serif",

        created_at: m.created_at,                    textAlign: "left",

        created_at: m.created_at,                    cursor: "pointer",

        created_at: m.created_at,                  }}

        created_at: m.created_at,                >

        created_at: m.created_at,                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" style={{ color: C.textDim }}>

        created_at: m.created_at,                    <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />

        created_at: m.created_at,                    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />

        created_at: m.created_at,                  </svg>

        created_at: m.created_at,                  <span>Settings</span>

        created_at: m.created_at,                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12" style={{ color: C.textFaint || C.muted }}>

        created_at: m.created_at,                    <path d="M9 5l7 7-7 7" />

        created_at: m.created_at,                  </svg>

        created_at: m.created_at,                </button>

        created_at: m.created_at,

        created_at: m.created_at,                {/* AI Assistant config */}

        created_at: m.created_at,                <button

        created_at: m.created_at,                  onClick={() => { setAvatarMenuOpen(false); setAssistantSetupOpen(true); }}

        created_at: m.created_at,                  role="menuitem"

        created_at: m.created_at,                  style={{

        created_at: m.created_at,                    display: "grid",

        created_at: m.created_at,                    gridTemplateColumns: "18px 1fr 12px",

        created_at: m.created_at,                    gap: 10,

        created_at: m.created_at,                    alignItems: "center",

        created_at: m.created_at,                    width: "100%",

        created_at: m.created_at,                    padding: 10,

        created_at: m.created_at,                    borderRadius: 8,

        created_at: m.created_at,                    background: "transparent",

        created_at: m.created_at,                    border: "none",

        created_at: m.created_at,                    color: C.text,

        created_at: m.created_at,                    fontSize: 13, fontWeight: 500,

        created_at: m.created_at,                    fontFamily: "'DM Sans', sans-serif",

        created_at: m.created_at,                    textAlign: "left",

        created_at: m.created_at,                    cursor: "pointer",

        created_at: m.created_at,                  }}

        created_at: m.created_at,                >

        created_at: m.created_at,                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" style={{ color: C.textDim }}>

        created_at: m.created_at,                    <path d="M19 11a7 7 0 01-14 0M12 18v4M8 22h8M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3z" />

        created_at: m.created_at,                  </svg>

        created_at: m.created_at,                  <span>AI Assistant config</span>

        created_at: m.created_at,                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12" style={{ color: C.textFaint || C.muted }}>

        created_at: m.created_at,                    <path d="M9 5l7 7-7 7" />

        created_at: m.created_at,                  </svg>

        created_at: m.created_at,                </button>

        created_at: m.created_at,

        created_at: m.created_at,                {/* Help & feedback */}

        created_at: m.created_at,                <button

        created_at: m.created_at,                  onClick={() => { setAvatarMenuOpen(false); setHelpSlug(null); setHelpOpen(true); }}

        created_at: m.created_at,                  role="menuitem"

        created_at: m.created_at,                  style={{

        created_at: m.created_at,                    display: "grid",

        created_at: m.created_at,                    gridTemplateColumns: "18px 1fr 12px",

        created_at: m.created_at,                    gap: 10,

        created_at: m.created_at,                    alignItems: "center",

        created_at: m.created_at,                    width: "100%",

        created_at: m.created_at,                    padding: 10,

        created_at: m.created_at,                    borderRadius: 8,

        created_at: m.created_at,                    background: "transparent",

        created_at: m.created_at,                    border: "none",

        created_at: m.created_at,                    color: C.text,

        created_at: m.created_at,                    fontSize: 13, fontWeight: 500,

        created_at: m.created_at,                    fontFamily: "'DM Sans', sans-serif",

        created_at: m.created_at,                    textAlign: "left",

        created_at: m.created_at,                    cursor: "pointer",

        created_at: m.created_at,                  }}

        created_at: m.created_at,                >

        created_at: m.created_at,                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" style={{ color: C.textDim }}>

        created_at: m.created_at,                    <circle cx="12" cy="12" r="9" />

        created_at: m.created_at,                    <path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01" />

        created_at: m.created_at,                  </svg>

        created_at: m.created_at,                  <span>Help & feedback</span>

        created_at: m.created_at,                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12" style={{ color: C.textFaint || C.muted }}>

        created_at: m.created_at,                    <path d="M9 5l7 7-7 7" />

        created_at: m.created_at,                  </svg>

        created_at: m.created_at,                </button>

        created_at: m.created_at,

        created_at: m.created_at,                {/* Divider */}

        created_at: m.created_at,                <div style={{ height: 1, background: C.border, margin: "4px 6px" }} />

        created_at: m.created_at,

        created_at: m.created_at,                {/* Sign out */}

        created_at: m.created_at,                <button

        created_at: m.created_at,                  onClick={() => { setAvatarMenuOpen(false); handleLogout(); }}

        created_at: m.created_at,                  role="menuitem"

        created_at: m.created_at,                  style={{

        created_at: m.created_at,                    display: "grid",

        created_at: m.created_at,                    gridTemplateColumns: "18px 1fr",

        created_at: m.created_at,                    gap: 10,

        created_at: m.created_at,                    alignItems: "center",

        created_at: m.created_at,                    width: "100%",

        created_at: m.created_at,                    padding: 10,

        created_at: m.created_at,                    borderRadius: 8,

        created_at: m.created_at,                    background: "transparent",

        created_at: m.created_at,                    border: "none",

        created_at: m.created_at,                    color: C.red,

        created_at: m.created_at,                    fontSize: 13, fontWeight: 500,

        created_at: m.created_at,                    fontFamily: "'DM Sans', sans-serif",

        created_at: m.created_at,                    textAlign: "left",

        created_at: m.created_at,                    cursor: "pointer",

        created_at: m.created_at,                  }}

        created_at: m.created_at,                >

        created_at: m.created_at,                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">

        created_at: m.created_at,                    <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />

        created_at: m.created_at,                  </svg>

        created_at: m.created_at,                  <span>Sign out</span>

        created_at: m.created_at,                </button>

        created_at: m.created_at,              </div>

        created_at: m.created_at,            </>

        created_at: m.created_at,          )}

        created_at: m.created_at,        </div>

        created_at: m.created_at,        {/* Top tab bar (category pills + sub-tabs) — KILLED on mobile.

        created_at: m.created_at,            Desktop browser still uses its side-nav below (unchanged). */}

        created_at: m.created_at,      </header>

        created_at: m.created_at,      <div style={(isTablet || isDesktopBrowser) ? { display: "flex", alignItems: "flex-start", width: "100%" } : {}}>

        created_at: m.created_at,        {isTablet && (() => {

        created_at: m.created_at,          const TABLET_ICONS = {

        created_at: m.created_at,            "AI Assistant": "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z",

        created_at: m.created_at,            "Enquiries": "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z",

        created_at: m.created_at,            "Jobs": "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 3h6v4H9V3z",

        created_at: m.created_at,            "Materials": "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",

        created_at: m.created_at,            "Stock": "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z",

        created_at: m.created_at,            "RAMS": "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",

        created_at: m.created_at,            "Documents": "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6M16 13H8M16 17H8M10 9H8",

        created_at: m.created_at,            "Schedule": "M3 5a2 2 0 012-2h14a2 2 0 012 2v16a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM16 2v4M8 2v4M3 10h18",

        created_at: m.created_at,            "Reminders": "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0",

        created_at: m.created_at,            "Invoices": "M2 6a2 2 0 012-2h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM12 8v8M8 12h8",

        created_at: m.created_at,            "Quotes": "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",

        created_at: m.created_at,            "Expenses": "M18 7c0-5.333-8-5.333-8 0M10 7v14M6 21h12M6 13h10",

        created_at: m.created_at,            "Mileage": "M12 22s-8-4.5-8-11.8A8 8 0 0112 2a8 8 0 018 8.2c0 7.3-8 11.8-8 11.8zM12 7v5l3 2",

        created_at: m.created_at,            "Payments": "M2 6a2 2 0 012-2h16a2 2 0 012 2v4H2V6zM2 14h20v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z",

        created_at: m.created_at,            "CIS": "M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2zM9 7h6M9 11h6M9 15h4",

        created_at: m.created_at,            "Reports": "M18 20V10M12 20V4M6 20v-6",

        created_at: m.created_at,            "Customers": "M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M8.5 3a4 4 0 110 8 4 4 0 010-8zM20 8v6M23 11h-6",

        created_at: m.created_at,            "Workers": "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 110 8 4 4 0 010-8z",

        created_at: m.created_at,            "Subcontractors": "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 3a4 4 0 110 8 4 4 0 010-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",

        created_at: m.created_at,            "Reviews": "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",

        created_at: m.created_at,            "Inbox": "M3 7l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",

        created_at: m.created_at,            "Settings": "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",

        created_at: m.created_at,          };

        created_at: m.created_at,          // Sidebar badge counts. Only computed for views where App.jsx state

        created_at: m.created_at,          // matches the underlying view's data source — anything else risks

        created_at: m.created_at,          // showing a number that disagrees with the view itself.

        created_at: m.created_at,          //

        created_at: m.created_at,          // Jobs badge: SKIPPED. Jobs UI loads from the `job_cards` table but

        created_at: m.created_at,          // App.jsx state's `jobs` is the older `jobs` table (now used for

        created_at: m.created_at,          // schedule/diary). Adding job_cards loading to App.jsx would be a

        created_at: m.created_at,          // separate refactor — for now, no badge beats a wrong badge.

        created_at: m.created_at,          //

        created_at: m.created_at,          // Invoices badge: overdue invoices, matching the Invoices view's

        created_at: m.created_at,          // own filter logic. Uses in-memory `invoices` state which IS the

        created_at: m.created_at,          // right data source.

        created_at: m.created_at,          const overdueInvoicesCount = (invoices || []).filter(i => !i.deleted_at && typeof i.status === "string" && i.status.toLowerCase() === "overdue").length;

        created_at: m.created_at,          const initial = (user?.email?.[0] || brand?.name?.[0] || "T").toUpperCase();

        created_at: m.created_at,          return (

        created_at: m.created_at,            <nav style={{

        created_at: m.created_at,              width: 260, flexShrink: 0,

        created_at: m.created_at,              padding: "12px 10px",

        created_at: m.created_at,              borderRight: `1px solid ${C.border}`,

        created_at: m.created_at,              position: "sticky",

        created_at: m.created_at,              top: "calc(48px + env(safe-area-inset-top, 0px))",

        created_at: m.created_at,              height: "calc(100vh - 48px - env(safe-area-inset-top, 0px))",

        created_at: m.created_at,              boxSizing: "border-box",

        created_at: m.created_at,              display: "flex", flexDirection: "column",

        created_at: m.created_at,              background: C.surface,

        created_at: m.created_at,            }}>

        created_at: m.created_at,              <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>

        created_at: m.created_at,                {NAV_GROUPS.map(g => {

        created_at: m.created_at,                  const allowed = g.views.filter(v => {

        created_at: m.created_at,                    if (userRole !== "owner" && v === "Settings") return false;

        created_at: m.created_at,                    const myMember = members.find(m => m.user_id === user?.id);

        created_at: m.created_at,                    const perms = myMember?.permissions;

        created_at: m.created_at,                    return !perms || perms[v] !== false;

        created_at: m.created_at,                  });

        created_at: m.created_at,                  if (!allowed.length) return null;

        created_at: m.created_at,                  return (

        created_at: m.created_at,                    <div key={g.id} style={{ marginBottom: 12 }}>

        created_at: m.created_at,                      <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", padding: "6px 14px", fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{g.label}</div>

        created_at: m.created_at,                      {allowed.map(v => {

        created_at: m.created_at,                        const active = view === v;

        created_at: m.created_at,                        const label = v === "AI Assistant" ? "Home" : v;

        created_at: m.created_at,                        let badge = null;

        created_at: m.created_at,                        if (v === "Invoices" && overdueInvoicesCount > 0) badge = overdueInvoicesCount;

        created_at: m.created_at,                        return (

        created_at: m.created_at,                          <button

        created_at: m.created_at,                            key={v}

        created_at: m.created_at,                            onClick={() => { setActiveCategory(g.id); setView(v); }}

        created_at: m.created_at,                            style={{

        created_at: m.created_at,                              display: "flex", alignItems: "center", gap: 12,

        created_at: m.created_at,                              width: "100%", padding: "10px 14px", marginBottom: 2,

        created_at: m.created_at,                              minHeight: 44,

        created_at: m.created_at,                              border: "none", borderRadius: 10,

        created_at: m.created_at,                              background: active ? C.amber : "transparent",

        created_at: m.created_at,                              color: active ? "#000" : C.text,

        created_at: m.created_at,                              fontSize: 14, fontWeight: active ? 700 : 500,

        created_at: m.created_at,                              fontFamily: "'DM Mono',monospace",

        created_at: m.created_at,                              cursor: "pointer", textAlign: "left",

        created_at: m.created_at,                              transition: "background 0.12s",

        created_at: m.created_at,                            }}

        created_at: m.created_at,                          >

        created_at: m.created_at,                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#000" : C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d={TABLET_ICONS[v] || "M4 6h16M4 12h16M4 18h16"}/></svg>

        created_at: m.created_at,                            <span style={{ flex: 1 }}>{label}</span>

        created_at: m.created_at,                            {badge && (

        created_at: m.created_at,                              <span style={{

        created_at: m.created_at,                                background: active ? "rgba(0,0,0,0.18)" : (v === "Invoices" ? "#ef444422" : "#f59e0b22"),

        created_at: m.created_at,                                color: active ? "#000" : (v === "Invoices" ? C.red : "#b8740a"),

        created_at: m.created_at,                                padding: "2px 8px",

        created_at: m.created_at,                                borderRadius: 4,

        created_at: m.created_at,                                fontSize: 11,

        created_at: m.created_at,                                fontWeight: 700,

        created_at: m.created_at,                                fontFamily: "'DM Mono',monospace",

        created_at: m.created_at,                                flexShrink: 0,

        created_at: m.created_at,                              }}>{badge}</span>

        created_at: m.created_at,                            )}

        created_at: m.created_at,                          </button>

        created_at: m.created_at,                        );

        created_at: m.created_at,                      })}

        created_at: m.created_at,                    </div>

        created_at: m.created_at,                  );

        created_at: m.created_at,                })}

        created_at: m.created_at,              </div>

        created_at: m.created_at,              <button

        created_at: m.created_at,                onClick={() => setView("Settings")}

        created_at: m.created_at,                style={{

        created_at: m.created_at,                  display: "flex", alignItems: "center", gap: 10,

        created_at: m.created_at,                  borderTop: `1px solid ${C.border}`,

        created_at: m.created_at,                  padding: "10px 14px",

        created_at: m.created_at,                  background: "transparent", border: "none",

        created_at: m.created_at,                  cursor: "pointer", textAlign: "left",

        created_at: m.created_at,                  fontFamily: "'DM Mono',monospace",

        created_at: m.created_at,                  flexShrink: 0,

        created_at: m.created_at,                }}

        created_at: m.created_at,              >

        created_at: m.created_at,                <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.amber, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#000", flexShrink: 0 }}>

        created_at: m.created_at,                  {initial}

        created_at: m.created_at,                </div>

        created_at: m.created_at,                <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>

        created_at: m.created_at,                  <div style={{ fontSize: 12, color: C.text, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{brand?.name || "Trade PA"}</div>

        created_at: m.created_at,                  <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Settings ›</div>

        created_at: m.created_at,                </div>

        created_at: m.created_at,              </button>

        created_at: m.created_at,            </nav>

        created_at: m.created_at,          );

        created_at: m.created_at,        })()}

        created_at: m.created_at,        {!isTablet && isDesktopBrowser && (

        created_at: m.created_at,          <nav style={{ width: 220, flexShrink: 0, padding: "16px 8px", borderRight: `1px solid ${C.border}`, position: "sticky", top: "calc(48px + env(safe-area-inset-top, 0px))", maxHeight: "calc(100vh - 48px)", overflowY: "auto", boxSizing: "border-box" }}>

        created_at: m.created_at,            {NAV_GROUPS.map(g => {

        created_at: m.created_at,              const allowed = g.views.filter(v => {

        created_at: m.created_at,                if (userRole !== "owner" && v === "Settings") return false;

        created_at: m.created_at,                const myMember = members.find(m => m.user_id === user?.id);

        created_at: m.created_at,                const perms = myMember?.permissions;

        created_at: m.created_at,                return !perms || perms[v] !== false;

        created_at: m.created_at,              });

        created_at: m.created_at,              if (!allowed.length) return null;

        created_at: m.created_at,              const SIDEBAR_ICONS = {

        created_at: m.created_at,                "AI Assistant": "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z",

        created_at: m.created_at,                "Enquiries": "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z",

        created_at: m.created_at,                "Jobs": "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 3h6v4H9V3z",

        created_at: m.created_at,                "Materials": "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",

        created_at: m.created_at,                "Stock": "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z",

        created_at: m.created_at,                "RAMS": "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",

        created_at: m.created_at,                "Documents": "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6M16 13H8M16 17H8M10 9H8",

        created_at: m.created_at,                "Schedule": "M3 5a2 2 0 012-2h14a2 2 0 012 2v16a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM16 2v4M8 2v4M3 10h18",

        created_at: m.created_at,                "Reminders": "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0",

        created_at: m.created_at,                "Invoices": "M2 6a2 2 0 012-2h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM12 8v8M8 12h8",

        created_at: m.created_at,                "Quotes": "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",

        created_at: m.created_at,                "Expenses": "M18 7c0-5.333-8-5.333-8 0M10 7v14M6 21h12M6 13h10",

        created_at: m.created_at,                "Mileage": "M12 22s-8-4.5-8-11.8A8 8 0 0112 2a8 8 0 018 8.2c0 7.3-8 11.8-8 11.8zM12 7v5l3 2",

        created_at: m.created_at,                "Payments": "M2 6a2 2 0 012-2h16a2 2 0 012 2v4H2V6zM2 14h20v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z",

        created_at: m.created_at,                "CIS": "M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2zM9 7h6M9 11h6M9 15h4",

        created_at: m.created_at,                "Reports": "M18 20V10M12 20V4M6 20v-6",

        created_at: m.created_at,                "Customers": "M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M8.5 3a4 4 0 110 8 4 4 0 010-8zM20 8v6M23 11h-6",

        created_at: m.created_at,                "Workers": "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 110 8 4 4 0 010-8z",

        created_at: m.created_at,                "Subcontractors": "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 3a4 4 0 110 8 4 4 0 010-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",

        created_at: m.created_at,                "Reviews": "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",

        created_at: m.created_at,                "Inbox": "M3 7l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",

        created_at: m.created_at,                "Settings": "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",

        created_at: m.created_at,              };

        created_at: m.created_at,              return (

        created_at: m.created_at,                <div key={g.id} style={{ marginBottom: 14 }}>

        created_at: m.created_at,                  <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", padding: "4px 12px 6px", fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{g.label}</div>

        created_at: m.created_at,                  {allowed.map(v => {

        created_at: m.created_at,                    const active = view === v;

        created_at: m.created_at,                    const label = v === "AI Assistant" ? "Home" : v;

        created_at: m.created_at,                    return (

        created_at: m.created_at,                      <button

        created_at: m.created_at,                        key={v}

        created_at: m.created_at,                        onClick={() => { setActiveCategory(g.id); setView(v); }}

        created_at: m.created_at,                        style={{

        created_at: m.created_at,                          display: "flex", alignItems: "center", gap: 10,

        created_at: m.created_at,                          width: "100%", padding: "7px 12px", marginBottom: 1,

        created_at: m.created_at,                          border: "none", borderRadius: 10,

        created_at: m.created_at,                          background: active ? C.amber : "transparent",

        created_at: m.created_at,                          color: active ? "#000" : C.text,

        created_at: m.created_at,                          fontSize: 12, fontWeight: active ? 700 : 500,

        created_at: m.created_at,                          fontFamily: "'DM Mono',monospace",

        created_at: m.created_at,                          cursor: "pointer", textAlign: "left",

        created_at: m.created_at,                          transition: "background 0.12s",

        created_at: m.created_at,                        }}

        created_at: m.created_at,                        onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.surfaceHigh; }}

        created_at: m.created_at,                        onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}

        created_at: m.created_at,                      >

        created_at: m.created_at,                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={active ? "#000" : C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d={SIDEBAR_ICONS[v] || "M4 6h16M4 12h16M4 18h16"}/></svg>

        created_at: m.created_at,                        <span>{label}</span>

        created_at: m.created_at,                      </button>

        created_at: m.created_at,                    );

        created_at: m.created_at,                  })}

        created_at: m.created_at,                </div>

        created_at: m.created_at,              );

        created_at: m.created_at,            })}

        created_at: m.created_at,          </nav>

        created_at: m.created_at,        )}

        created_at: m.created_at,      <main style={{ ...S.main, paddingTop: view === "AI Assistant" || view === "Reminders" || view === "Notifications" ? 16 : 24, paddingBottom: (isTablet || isDesktopBrowser) ? undefined : "60px", ...((isTablet || isDesktopBrowser) ? { flex: 1, maxWidth: "none", padding: "24px 32px", boxSizing: "border-box" } : {}) }}>

        created_at: m.created_at,        <div style={isDesktopBrowser ? { maxWidth: 720, margin: "0 auto", width: "100%" } : { display: "contents" }}>

        created_at: m.created_at,        {(() => {

        created_at: m.created_at,          // Guard — redirect member to Dashboard if they're on a tab they can't access

        created_at: m.created_at,          if (userRole !== "owner" && view !== "Dashboard") {

        created_at: m.created_at,            const myMember = members.find(m => m.user_id === user?.id);

        created_at: m.created_at,            const perms = myMember?.permissions;

        created_at: m.created_at,            if (perms && perms[view] === false) {

        created_at: m.created_at,              return <div style={{ ...S.card, textAlign: "center", padding: 40 }}>

        created_at: m.created_at,                <div style={{ fontSize: 28, marginBottom: 12 }}>🔒</div>

        created_at: m.created_at,                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Access Restricted</div>

        created_at: m.created_at,                <div style={{ fontSize: 12, color: C.muted }}>You don't have permission to view this section. Contact your account owner.</div>

        created_at: m.created_at,              </div>;

        created_at: m.created_at,            }

        created_at: m.created_at,          }

        created_at: m.created_at,          return null;

        created_at: m.created_at,        })()}

        created_at: m.created_at,        {view === "Dashboard" && (() => { setView("AI Assistant"); return null; })()}

        created_at: m.created_at,        {view === "JobsHub" && <JobsHub setView={setView} jobs={jobs} enquiries={enquiries} materials={materials} />}

        created_at: m.created_at,        {view === "DiaryHub" && <DiaryHub setView={setView} jobs={jobs} reminders={reminders} />}

        created_at: m.created_at,        {view === "AccountsHub" && <AccountsHub setView={setView} invoices={invoices} />}

        created_at: m.created_at,        {view === "PeopleHub" && <PeopleHub setView={setView} customers={customers} enquiries={enquiries} />}

        created_at: m.created_at,        {view === "Schedule" && <Schedule jobs={jobs} setJobs={setJobs} customers={customers} setContextHint={setContextHint} />}

        created_at: m.created_at,        {view === "Enquiries" && <EnquiriesTab enquiries={enquiries} setEnquiries={setEnquiries} customers={customers} setCustomers={setCustomers} invoices={invoices} setInvoices={setInvoices} brand={brand} user={user} setView={setView} setContextHint={setContextHint} />}

        created_at: m.created_at,        {view === "Jobs" && <JobsTab key={jobsRefreshKey} user={user} brand={brand} customers={customers} invoices={invoices} setInvoices={setInvoices} setView={setView} setContextHint={setContextHint} />}

        created_at: m.created_at,        {view === "Customers" && <Customers customers={customers} setCustomers={setCustomers} customerContacts={customerContacts} setCustomerContacts={setCustomerContacts} jobs={jobs} invoices={invoices} setView={setView} user={user} makeCall={makeCall} hasTwilio={!!twilioDevice} setContextHint={setContextHint} companyId={companyId} />}

        created_at: m.created_at,        {view === "Invoices" && <InvoicesView brand={brand} invoices={invoices} setInvoices={setInvoices} user={user} customers={customers} customerContacts={customerContacts} setContextHint={setContextHint} />}

        created_at: m.created_at,        {view === "Quotes" && <QuotesView brand={brand} invoices={invoices} setInvoices={setInvoices} setView={setView} user={user} customers={customers} customerContacts={customerContacts} setContextHint={setContextHint} />}

        created_at: m.created_at,        {view === "Materials" && <Materials materials={materials} setMaterials={setMaterials} jobs={jobs} user={user} companyId={companyId} setContextHint={setContextHint} />}

        created_at: m.created_at,        {view === "Expenses" && <ExpensesTab user={user} setContextHint={setContextHint} />}

        created_at: m.created_at,        {view === "CIS" && <CISStatementsTab user={user} setContextHint={setContextHint} />}

        created_at: m.created_at,        <div style={{ height: "100%", transform: "translateZ(0)" }}><AIAssistant isTablet={isTablet} isVisible={view === "AI Assistant" || !!aiOverlay} brand={brand} setBrand={setBrand} jobs={jobs} setJobs={setJobs} invoices={invoices} setInvoices={setInvoices} enquiries={enquiries} setEnquiries={setEnquiries} materials={materials} setMaterials={setMaterials} setMaterialsRaw={setMaterialsRaw} companyId={companyId} customers={customers} setCustomers={setCustomers} onAddReminder={add} setView={setView} user={user} onShowPdf={(inv) => downloadInvoicePDF(brand, inv)} onScanReceipt={handleScanReceipt} sendPush={sendPush} assistantName={assistantName} assistantWakeWords={assistantWakeWords} assistantPersona={assistantPersona} assistantSignoff={assistantSignoff} assistantVoice={assistantVoice} userCommands={userCommands} usageData={usageData} setUsageData={setUsageData} usageCaps={usageCaps} currentMonth={currentMonth} voiceHandle={voiceHandle} onHandsFreeChange={setAiHandsFree} overlayContext={view === "AI Assistant" ? null : aiOverlay?.context || null} onCloseOverlay={() => setAiOverlay(null)} onboardingStep={onboardingStep} advanceOnboarding={advanceOnboarding} pendingInboxCount={pendingInboxCount} /></div>

        created_at: m.created_at,        {view === "Reminders" && <Reminders reminders={reminders} onAdd={add} onDismiss={dismiss} onRemove={remove} dueNow={dueNow} onClearDue={() => setDueNow([])} />}

        created_at: m.created_at,        {view === "Notifications" && (

        created_at: m.created_at,          <Notifications

        created_at: m.created_at,            notifications={inAppNotifs}

        created_at: m.created_at,            onMarkRead={markNotifRead}

        created_at: m.created_at,            onMarkAllRead={markAllNotifsRead}

        created_at: m.created_at,            onDismiss={dismissNotif}

        created_at: m.created_at,            onOpen={openNotif}

        created_at: m.created_at,          />

        created_at: m.created_at,        )}

        created_at: m.created_at,        {view === "Payments" && <Payments brand={brand} invoices={invoices} setInvoices={setInvoices} customers={customers} user={user} sendPush={sendPush} setContextHint={setContextHint} />}

        created_at: m.created_at,        {view === "Inbox" && <InboxView user={user} brand={brand} jobs={jobs} setJobs={setJobs} invoices={invoices} setInvoices={setInvoices} enquiries={enquiries} setEnquiries={setEnquiries} materials={materials} setMaterials={setMaterials} customers={customers} setCustomers={setCustomers} setLastAction={() => {}} setContextHint={setContextHint} sendPush={sendPush} />}

        created_at: m.created_at,        {view === "Reports" && <ReportsTab invoices={invoices} jobs={jobs} materials={materials} customers={customers} enquiries={enquiries} brand={brand} user={user} setContextHint={setContextHint} />}

        created_at: m.created_at,        {view === "Mileage" && <MileageTab user={user} setContextHint={setContextHint} />}

        created_at: m.created_at,        {view === "Subcontractors" && <SubcontractorsTab user={user} brand={brand} setContextHint={setContextHint} />}

        created_at: m.created_at,        {view === "Workers" && <SubcontractorsTab user={user} brand={brand} setContextHint={setContextHint} mode="workers" />}

        created_at: m.created_at,        {view === "Documents" && <DocumentsTab user={user} customers={customers} setContextHint={setContextHint} />}

        created_at: m.created_at,        {view === "Reviews" && <ReviewsTab user={user} brand={brand} customers={customers} setContextHint={setContextHint} />}

        created_at: m.created_at,        {view === "Stock" && <StockTab user={user} setContextHint={setContextHint} />}

        created_at: m.created_at,        {view === "RAMS" && <RAMSTab user={user} brand={brand} setContextHint={setContextHint} />}

        created_at: m.created_at,        {view === "Settings" && <ErrorBoundary><Settings brand={brand} setBrand={setBrand} companyId={companyId} companyName={companyName} userRole={userRole} members={members} user={user} planTier={planTier} userLimit={userLimit} openAssistantSetup={() => setAssistantSetupOpen(true)} openFeedback={() => setFeedbackOpen(true)} assistantName={assistantName} assistantWakeWords={assistantWakeWords} userCommandsCount={userCommands.length} usageData={usageData} usageCaps={usageCaps} /></ErrorBoundary>}

        created_at: m.created_at,        </div>

        created_at: m.created_at,      </main>

        created_at: m.created_at,      </div>

        created_at: m.created_at,      {(onboardingStep === 99 || onboardingStep === 0) && !isTablet ? <BottomTabBar view={view} setView={setView} isDesktopBrowser={isDesktopBrowser} /> : null}

        created_at: m.created_at,

        created_at: m.created_at,      {/* ── Keyboard shortcuts cheat sheet (Cmd/Ctrl + / toggles) ──────── */}

        created_at: m.created_at,      {showShortcutsHelp && (() => {

        created_at: m.created_at,        const isMac = typeof navigator !== "undefined" && /Mac|iPad|iPhone|iPod/.test(navigator.platform || navigator.userAgent);

        created_at: m.created_at,        const mod = isMac ? "⌘" : "Ctrl";

        created_at: m.created_at,        const shortcuts = [

        created_at: m.created_at,          { keys: [mod, "1"], label: "Go to Home" },

        created_at: m.created_at,          { keys: [mod, "2"], label: "Go to Enquiries" },

        created_at: m.created_at,          { keys: [mod, "3"], label: "Go to Jobs" },

        created_at: m.created_at,          { keys: [mod, "4"], label: "Go to Schedule" },

        created_at: m.created_at,          { keys: [mod, "5"], label: "Go to Reminders" },

        created_at: m.created_at,          { keys: [mod, "6"], label: "Go to Invoices" },

        created_at: m.created_at,          { keys: [mod, "7"], label: "Go to Customers" },

        created_at: m.created_at,          { keys: [mod, ","], label: "Go to Settings" },

        created_at: m.created_at,          { keys: [mod, "K"], label: "Focus the AI input" },

        created_at: m.created_at,          { keys: [mod, "/"], label: "Show / hide this cheat sheet" },

        created_at: m.created_at,          { keys: ["Esc"], label: "Close any open dialog" },

        created_at: m.created_at,        ];

        created_at: m.created_at,        return (

        created_at: m.created_at,          <div

        created_at: m.created_at,            onClick={() => setShowShortcutsHelp(false)}

        created_at: m.created_at,            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 10001, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}

        created_at: m.created_at,          >

        created_at: m.created_at,            <div

        created_at: m.created_at,              onClick={(e) => e.stopPropagation()}

        created_at: m.created_at,              style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, width: "100%", maxWidth: 460, maxHeight: "85vh", overflowY: "auto" }}

        created_at: m.created_at,            >

        created_at: m.created_at,              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>

        created_at: m.created_at,                <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: "'DM Sans', sans-serif" }}>Keyboard shortcuts</div>

        created_at: m.created_at,                <button

        created_at: m.created_at,                  onClick={() => setShowShortcutsHelp(false)}

        created_at: m.created_at,                  aria-label="Close"

        created_at: m.created_at,                  style={{ background: "transparent", border: "none", color: C.muted, fontSize: 18, cursor: "pointer", padding: 4, lineHeight: 1 }}

        created_at: m.created_at,                >×</button>

        created_at: m.created_at,              </div>

        created_at: m.created_at,              <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, fontFamily: "'DM Sans', sans-serif" }}>Works on iPad with a keyboard, and in any browser.</div>

        created_at: m.created_at,              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>

        created_at: m.created_at,                {shortcuts.map((s, i) => (

        created_at: m.created_at,                  <div key={i} style={{ display: "flex", alignItems: "center", padding: "8px 4px", borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}>

        created_at: m.created_at,                    <span style={{ flex: 1, fontSize: 13, color: C.text, fontFamily: "'DM Sans', sans-serif" }}>{s.label}</span>

        created_at: m.created_at,                    <span style={{ display: "flex", gap: 4 }}>

        created_at: m.created_at,                      {s.keys.map((k, j) => (

        created_at: m.created_at,                        <kbd key={j} style={{

        created_at: m.created_at,                          background: C.surfaceHigh,

        created_at: m.created_at,                          border: `1px solid ${C.border}`,

        created_at: m.created_at,                          borderRadius: 5,

        created_at: m.created_at,                          padding: "2px 8px",

        created_at: m.created_at,                          fontSize: 11,

        created_at: m.created_at,                          fontFamily: "'DM Mono', monospace",

        created_at: m.created_at,                          color: C.text,

        created_at: m.created_at,                          minWidth: 22,

        created_at: m.created_at,                          textAlign: "center",

        created_at: m.created_at,                        }}>{k}</kbd>

        created_at: m.created_at,                      ))}

        created_at: m.created_at,                    </span>

        created_at: m.created_at,                  </div>

        created_at: m.created_at,                ))}

        created_at: m.created_at,              </div>

        created_at: m.created_at,              {/* Link to the longer Help Centre article — for users who want

        created_at: m.created_at,                  more context on what each shortcut does and when to use it. */}

        created_at: m.created_at,              <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "center" }}>

        created_at: m.created_at,                <button

        created_at: m.created_at,                  onClick={() => { setShowShortcutsHelp(false); setHelpSlug("keyboard-shortcuts"); setHelpOpen(true); }}

        created_at: m.created_at,                  style={{

        created_at: m.created_at,                    background: "transparent",

        created_at: m.created_at,                    border: "none",

        created_at: m.created_at,                    color: C.amber,

        created_at: m.created_at,                    fontSize: 12,

        created_at: m.created_at,                    fontWeight: 600,

        created_at: m.created_at,                    fontFamily: "'DM Sans', sans-serif",

        created_at: m.created_at,                    cursor: "pointer",

        created_at: m.created_at,                    padding: "4px 8px",

        created_at: m.created_at,                  }}

        created_at: m.created_at,                >View full guide in Help Centre →</button>

        created_at: m.created_at,              </div>

        created_at: m.created_at,            </div>

        created_at: m.created_at,          </div>

        created_at: m.created_at,        );

        created_at: m.created_at,      })()}

        created_at: m.created_at,      {(onboardingStep >= 99 || onboardingStep === 0) && <FloatingMicButton

        created_at: m.created_at,        visible={view !== "AI Assistant" && !aiOverlay}

        created_at: m.created_at,        handsFree={aiHandsFree}

        created_at: m.created_at,        onTap={() => setAiOverlay({ context: contextHint || `Viewing: ${view}` })}

        created_at: m.created_at,      />}

        created_at: m.created_at,      <HelpCentre open={helpOpen} openSlug={helpSlug} onClose={() => { setHelpOpen(false); setHelpSlug(null); }} />

        created_at: m.created_at,      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} user={user} brand={brand} currentView={view} />

        created_at: m.created_at,      <AssistantSetup

        created_at: m.created_at,        open={assistantSetupOpen || onboardingStep === 3}

        created_at: m.created_at,        onClose={() => { setAssistantSetupOpen(false); if (onboardingStepRef.current === 3) advanceOnboarding(4); }}

        created_at: m.created_at,        db={db}

        created_at: m.created_at,        user={user}

        created_at: m.created_at,        tools={null}

        created_at: m.created_at,        mode={onboardingStep === 3 ? "onboard" : "edit"}

        created_at: m.created_at,        onSaved={(s) => {

        created_at: m.created_at,          setAssistantName(s.assistant_name);

        created_at: m.created_at,          setAssistantWakeWords(s.assistant_wake_words);

        created_at: m.created_at,          setAssistantPersona(s.assistant_persona);

        created_at: m.created_at,          setAssistantSignoff(s.assistant_signoff || "");

        created_at: m.created_at,          // Update voice live so the next speak() uses the new choice

        created_at: m.created_at,          // without needing a page reload.

        created_at: m.created_at,          if (s.assistant_voice) setAssistantVoice(s.assistant_voice);

        created_at: m.created_at,          db.from("user_commands")

        created_at: m.created_at,            .select("*").eq("user_id", user.id).eq("enabled", true)

        created_at: m.created_at,            .order("created_at", { ascending: true })

        created_at: m.created_at,            .then(({ data }) => { if (data) setUserCommands(data); });

        created_at: m.created_at,        }}

        created_at: m.created_at,      />

        created_at: m.created_at,    </div>

        created_at: m.created_at,  );

        created_at: m.created_at,}

        created_at: m.created_at,

        created_at: m.created_at,export default function App() {

        created_at: m.created_at,  return (

        created_at: m.created_at,    <ThemeProvider>

        created_at: m.created_at,      <AppInner />

        created_at: m.created_at,    </ThemeProvider>

        created_at: m.created_at,  );

        created_at: m.created_at,}
