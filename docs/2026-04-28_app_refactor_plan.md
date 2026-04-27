# App.jsx Refactor — Plan & Scoping
**Date:** 28 April 2026 (Tuesday morning)
**Author:** post-audit, pre-execution
**Source state:** App.jsx at 32,355 lines, 142 top-level entities, single file

---

## Why this is happening now (context)

Trade PA's `App.jsx` has grown to 32,355 lines in a single file. Last night's
audit confirmed it's not currently a *scaling* problem — esbuild handles it
fine, the bundle is healthy, the app works. It's a **maintainability** and
**risk** problem:

- **TDZ-error class:** ordering bugs surface as runtime errors. We've hit
  these multiple times in the past month.
- **Cognitive load:** finding code requires line-number muscle memory.
  New features risk breaking adjacent unrelated code.
- **Build-time hot-reload:** a change anywhere invalidates the whole
  module's HMR boundary.
- **Pre-native window:** before Capacitor wrap, structural changes are
  still cheap. After wrap, the same refactor would touch native build
  configs, app store binaries, and TestFlight builds.

Connor's framing ("better to do this before native wrap") is correct.
The native wrapper wraps the *built bundle*, so the source organisation
doesn't directly affect the wrap — but the bug fixes that surface DURING
the refactor are easier to ship through one channel (web) than two
(web + native binary updates).

---

## Goals & non-goals

### Goals
1. **No App.jsx file >2,000 lines.** Target: ~30-40 small files, each <800 lines.
2. **No behavioural changes.** This is purely structural. Same UX, same data flows, same bugs (we'll get those next).
3. **Compile-clean and smoke-test-passing after every phase.** No "fix the next phase to fix the last."
4. **Rollback-able at any phase boundary.** Each phase is one commit, one Vercel deploy.
5. **Logical module boundaries** that match the mental model: hub views, settings, money, scheduling, voice/AI.

### Non-goals (explicit)
1. **Not introducing TypeScript.** Stays JS. Migrating to TS during a refactor is the cardinal sin — two big changes at once = impossible to debug.
2. **Not refactoring AIAssistant internally.** It gets extracted as a unit but its 7,852 lines stay together for now. Internal split is a separate, post-native session.
3. **Not introducing new abstractions.** No "let's add a Context provider for X" — same prop-drilling pattern, just across files.
4. **Not adding new tests.** Existing manual smoke-test pattern continues.
5. **Not lazy-loading or code-splitting yet.** Webpack-style `React.lazy` adds complexity. Bundle stays single, just sourced from many files.
6. **Not bumping React/Vite/dep versions.** Refactor + dep bump = double risk.
7. **Not fixing bugs we find along the way.** Log them; fix in a separate session. Mixing structural and behavioural changes is how subtle regressions sneak in.

---

## Current topology (audit results)

**File: 32,355 lines, 142 top-level entities.**

### The big 5 (51% of the file)
| Component | Lines | Role |
|---|---|---|
| `AIAssistant` | 7,852 | Voice + chat + tool execution. Heart of the app. |
| `Settings` | 2,439 | All app configuration UI. Branding, integrations, account. |
| `AppInner` | 2,053 | Main app shell — routing, top-level state, view dispatch. |
| `JobsTab` | 1,647 | Jobs list view + filters + actions. |
| `Customers` | 1,510 | Customer directory + CRUD modals. |

### The next 10 (~6,000 lines)
SubcontractorsTab (1,091), Materials (948), ReportsTab (919), RAMSTab (647), InboxView (596), executeEmailAction (536), CallTrackingSettings (484), LandingPage (451), Dashboard (420), InvoicesView (414).

### The remaining 127 entities
Distributed across helpers, smaller tabs, modals, hooks, utilities. Average ~30 lines each. Many are tiny enough that a few belong together in shared files.

---

## Target architecture

```
trade-pa/src/
├── App.jsx                    [~400 lines, just the routing + top-level mount]
├── lib/                       [stateless utilities, no React]
│   ├── db.js                  [already exists]
│   ├── auth.js                [client-side helpers — authHeaders, etc]
│   ├── format.js              [fmtCurrency, fmtAmount, vatLabel, dates]
│   ├── time.js                [localDate, localMonth, localYear, weekBounds]
│   ├── plan.js                [TIER_CONFIG, normalizeTier, getTierConfig]
│   ├── invoice-html.js        [buildEmailHTML, buildInvoiceHTML, downloadInvoicePDF]
│   ├── receipts.js            [uploadReceiptToStorage, getReceiptViewUrl]
│   ├── files.js               [fileToContentBlock, openHtmlPreview]
│   ├── tool-routing.js        [TOOL_CLUSTERS, classifyToolClusters, buildToolSubset]
│   ├── tracking.js            [trackEvent, setOwnerCookie]
│   └── constants.js           [DEFAULT_BRAND, DEFAULT_SUPPLIERS, ALL_CERTS, etc]
├── theme/
│   ├── colors.js              [C, DARK_PALETTE, LIGHT_PALETTE, applyPalette]
│   ├── styles.js              [S]
│   └── ThemeProvider.jsx      [ThemeContext + Provider]
├── hooks/
│   ├── useWhisper.js          [voice transcription hook]
│   └── useReminders.js        [reminders sync hook]
├── components/
│   ├── DetailPage.jsx
│   ├── PDFOverlay.jsx
│   ├── FloatingMicButton.jsx
│   ├── MicButton.jsx
│   ├── VoiceFillButton.jsx
│   ├── LineItemsBuilder.jsx
│   ├── BottomTabBar.jsx
│   ├── PortalLinkPanel.jsx
│   └── HubPage.jsx
├── auth/
│   ├── LandingPage.jsx        [+ VoiceHeroCard, InboxDemoCard inlined]
│   └── AuthScreen.jsx
├── views/
│   ├── Dashboard.jsx
│   ├── Schedule.jsx
│   ├── Materials.jsx          [+ MaterialRow inline]
│   ├── Invoices.jsx           [InvoicesView + Payments + InvoicePreview]
│   ├── Jobs.jsx               [JobsTab]
│   ├── Customers.jsx
│   ├── Inbox.jsx              [InboxView + executeEmailAction]
│   ├── Expenses.jsx
│   ├── CIS.jsx                [CISStatementsTab]
│   ├── Mileage.jsx
│   ├── Subcontractors.jsx
│   ├── Documents.jsx
│   ├── Reviews.jsx
│   ├── Stock.jsx
│   ├── PurchaseOrders.jsx
│   ├── RAMS.jsx               [+ HAZARD_LIBRARY, METHOD_LIBRARY, COSHH_SUBSTANCES]
│   ├── Reports.jsx
│   ├── RecentlyDeleted.jsx
│   └── hubs/
│       ├── JobsHub.jsx
│       ├── DiaryHub.jsx
│       ├── AccountsHub.jsx
│       └── PeopleHub.jsx
├── modals/
│   ├── InvoiceModal.jsx
│   ├── QuoteModal.jsx
│   ├── FeedbackModal.jsx
│   └── AssignToJobModal.jsx
├── settings/
│   ├── Settings.jsx           [router/parent — routes to sub-files]
│   ├── BrandingSection.jsx
│   ├── IntegrationsSection.jsx
│   ├── TeamInvite.jsx
│   ├── CertificationsCard.jsx
│   └── CallTrackingSettings.jsx
├── notifications/
│   ├── Notifications.jsx
│   └── Reminders.jsx
├── calls/
│   ├── IncomingCallScreen.jsx
│   └── ActiveCallScreen.jsx
└── ai/
    └── AIAssistant.jsx        [stays as one big file for now — extracted but not internally split]
```

**Result:** ~50 files, none over ~2,000 lines. App.jsx becomes ~400 lines
of routing + state initialisation, fully readable in one screen.

---

## Phased plan

Each phase is **commit-able** and **deploy-able** independently. If
something breaks at the end of a phase, we revert that phase's commit
and stop. The earlier phases stay in place.

### Phase 0 — Setup & safety nets (30 min)
- Create the new folder structure (empty)
- Verify dev server runs cleanly with current state
- Take a hard snapshot: `git checkout -b refactor-snapshot && git checkout main`
- Note current bundle size + build time as baseline
- **Stop point:** if anything's weird, fix it before moving on.

### Phase 1 — Pure helpers & constants (~1.5 hours, LOW RISK)
**What moves:**
- `lib/format.js` ← fmtCurrency, fmtAmount, vatLabel, relTime
- `lib/time.js` ← localDate/Month/Year, weekBounds, groupByRecency
- `lib/plan.js` ← TIER_CONFIG, normalizeTier, getTierConfig
- `lib/auth.js` ← authHeaders, setOwnerCookie
- `lib/tracking.js` ← trackEvent
- `lib/constants.js` ← DEFAULT_BRAND, DEFAULT_SUPPLIERS, ALL_CERTS, EXEMPT_EMAILS, NAV_GROUPS, VIEWS, ACTION_TOOLS, MILEAGE_RATE
- `lib/files.js` ← fileToContentBlock, openHtmlPreview, urlBase64ToUint8Array
- `lib/receipts.js` ← uploadReceiptToStorage, getSignedReceiptUrl, getReceiptViewUrl
- `lib/tool-routing.js` ← ALWAYS_INCLUDE_TOOLS, TOOL_CLUSTERS, CLUSTER_PATTERNS, classifyToolClusters, buildToolSubset
- `lib/invoice-html.js` ← buildEmailHTML, buildRef, buildInvoiceHTML, downloadInvoicePDF
- `lib/ids.js` ← generatePortalToken, newEnquiryId, nextInvoiceId, nextQuoteId, isExemptAccount

**Why this is low-risk:** these are pure functions, no React state. Imports are static. If something breaks, it's an import path typo — easy fix.

**Verification:**
- esbuild compile clean
- App loads, login works
- Dashboard renders correctly with currency/dates
- Receipt scan + view works

**Smoke test (5 min):** open app → check fmtCurrency on dashboard → check date display → done.

### Phase 2 — Theme & hooks (~1 hour, LOW RISK)
**What moves:**
- `theme/colors.js` ← C, DARK_PALETTE, LIGHT_PALETTE, applyPalette
- `theme/styles.js` ← S
- `theme/ThemeProvider.jsx` ← ThemeContext, ThemeProvider
- `hooks/useWhisper.js`
- `hooks/useReminders.js`

**Why low-risk:** theme is referenced everywhere but the `import { C, S }` pattern is mechanical. Hooks are self-contained.

**Verification:** light/dark mode toggle, voice mic still works, reminders display.

### Phase 3 — Small UI primitives (~1 hour, LOW RISK)
**What moves:** components/* directory:
- DetailPage, PDFOverlay, FloatingMicButton, MicButton, VoiceFillButton, LineItemsBuilder, BottomTabBar, PortalLinkPanel, HubPage, IncomingCallScreen, ActiveCallScreen

**Why low-risk:** these are leaf components, no children, well-defined props.

### Phase 4 — Auth & landing (~30 min, LOW RISK)
**What moves:**
- `auth/LandingPage.jsx` (+ VoiceHeroCard, InboxDemoCard as private internal components)
- `auth/AuthScreen.jsx`

**Why low-risk:** rendered before app state exists, minimal coupling.

**Verification:** logged-out user sees landing → click "Sign up" → AuthScreen renders.

### Phase 5 — Notifications & reminders (~30 min, LOW RISK)
**What moves:**
- `notifications/Notifications.jsx`
- `notifications/Reminders.jsx`
- formatCountdown, formatTime, formatDate (helpers used only by these)

**Verification:** create a reminder → it appears → due reminder fires.

### Phase 6 — Modals (~1 hour, MEDIUM RISK)
**What moves:**
- `modals/InvoiceModal.jsx`
- `modals/QuoteModal.jsx`
- `modals/FeedbackModal.jsx`
- `modals/AssignToJobModal.jsx`

**Why medium-risk:** Invoice/Quote modals are 300+ lines each, lots of state, lots of validation logic. The modals also call `db` and `authHeaders`.

**Verification:**
- Create an invoice end-to-end (Add → fill → save → appears in list)
- Create a quote, accept it (convert to invoice)
- Submit feedback

### Phase 7 — Mid-sized views (~2-3 hours, MEDIUM RISK)
**What moves (in order, smallest to largest):**
- `views/Dashboard.jsx` (420)
- `views/Schedule.jsx` (~360 lines + helpers)
- `views/Mileage.jsx`
- `views/Stock.jsx`
- `views/Documents.jsx`
- `views/Reviews.jsx`
- `views/Expenses.jsx`
- `views/CIS.jsx`
- `views/PurchaseOrders.jsx`
- `views/Materials.jsx` (948 + MaterialRow inline)
- `views/Invoices.jsx` (Payments + InvoicesView + InvoicePreview combined)
- `views/Inbox.jsx` (with executeEmailAction)
- `views/RAMS.jsx` (with HAZARD_LIBRARY etc)
- `views/Subcontractors.jsx` (1,091)
- `views/Customers.jsx` (1,510)
- `views/Reports.jsx` (919)
- `views/Jobs.jsx` (1,647) — biggest, save for last
- `views/RecentlyDeleted.jsx`

**Per-view smoke test:** open view → render correctly → primary action (add/edit/delete) → confirm DB row reflects.

**Why medium-risk:** views consume LOTS of props (state setters, user, brand, etc). Any missed prop = subtle render bug. Also some views call AI tools or other views via prop callbacks.

### Phase 8 — Hubs (~30 min, LOW RISK)
**What moves:**
- `views/hubs/JobsHub.jsx`, `DiaryHub.jsx`, `AccountsHub.jsx`, `PeopleHub.jsx`

**Why low-risk:** thin router-like components. Render small, easy to test.

### Phase 9 — Settings split (~2 hours, HIGH RISK)
**What moves:**
- `settings/Settings.jsx` — top-level component, handles section navigation
- `settings/BrandingSection.jsx`
- `settings/IntegrationsSection.jsx`
- `settings/TeamInvite.jsx`
- `settings/CertificationsCard.jsx`
- `settings/CallTrackingSettings.jsx`

**Why HIGH risk:** Settings is 2,439 lines. It's a single component with internal section state, lots of forms, file-uploads (logo), and integrations (Stripe, Xero, QuickBooks, Slack, Twilio). The component-internal split is itself non-trivial.

**Verification (long):** every settings section opens correctly + at least one save action per section works.

**Decision point:** if Phase 9 starts running long, defer the internal split and just extract Settings as a single 2,400-line file. That's still a win.

### Phase 10 — AIAssistant extraction (~2 hours, HIGHEST RISK)
**What moves:**
- `ai/AIAssistant.jsx` — entire 7,852-line component

**Why HIGHEST risk:**
- 30+ props passed in (every state setter, user, brand, etc)
- Closure-captures logic spread across 8000 lines
- Tool execution paths reference helpers, db, view setters
- Voice/audio session lifecycle is finicky
- Streaming SSE handling is critical
- Hands-free mode state machine

**Strategy:**
1. Move the whole component verbatim to ai/AIAssistant.jsx
2. Add imports for everything it depends on (this is the long part — it consumes LOTS of helpers)
3. Verify import list is exhaustive: try to dev-server load → fix every import error
4. Smoke test: voice-in → AI replies → tool fires → widget renders → hands-free toggles
5. Test with both Haiku and Sonnet routing
6. Test RAMS flow (multi-step state)

**Internal AIAssistant split is OUT OF SCOPE for tomorrow.** Extracting it as a unit is plenty.

### Phase 11 — AppInner split (~1.5 hours, HIGH RISK)
**What stays in App.jsx:** the root mount, the auth gate, the ThemeProvider wrap.

**What moves to a new file:** AppInner becomes its own file (`AppInner.jsx`), stays mostly intact. Everything below the auth check is one big component.

**Decision point:** AppInner is 2,053 lines mainly because it owns top-level state (jobs, invoices, customers, etc.) and renders all views. Splitting state into a separate state-provider would be ideal but adds Context complexity. **Defer that to a future session** — for tomorrow, just extract AppInner to its own file.

### Phase 12 — Final cleanup (~30 min, LOW RISK)
- Audit `import` statements: any unused ones removed
- Confirm App.jsx is now <500 lines
- Verify bundle size hasn't bloated (esbuild should produce same-or-smaller output)
- Push final commit
- Update changelog (one entry — "internal restructure, no UX change")

---

## Total time estimate

| Phase | Effort | Risk |
|---|---|---|
| 0 — Setup | 30 min | NONE |
| 1 — Pure helpers | 1.5 hr | LOW |
| 2 — Theme & hooks | 1 hr | LOW |
| 3 — UI primitives | 1 hr | LOW |
| 4 — Auth & landing | 30 min | LOW |
| 5 — Notifications | 30 min | LOW |
| 6 — Modals | 1 hr | MEDIUM |
| 7 — Mid-sized views | 2-3 hr | MEDIUM |
| 8 — Hubs | 30 min | LOW |
| 9 — Settings split | 2 hr | HIGH |
| 10 — AIAssistant | 2 hr | HIGHEST |
| 11 — AppInner | 1.5 hr | HIGH |
| 12 — Cleanup | 30 min | LOW |
| **Total** | **~14 hours** | |

**Realistic with breaks/testing:** 1.5-2 working days. Tomorrow morning will get through Phases 0-7 (~7-8 hours of focused work). Phases 8-12 spill into Wednesday or get split.

---

## Verification protocol

**After EACH phase:**
1. esbuild compile clean (≤300ms)
2. Dev server starts without errors
3. App loads, login works
4. **Smoke test specific to that phase** (listed above)
5. Git commit with message format: `refactor(phase-N): <summary>`
6. Push → Vercel auto-deploys → verify production loads

**Between phases:**
- Take a 5-minute break minimum (avoid fatigue accumulation)
- Glance at Sentry for any new errors

**If anything breaks:**
- Revert the last commit (`git revert HEAD`)
- Note the issue, decide whether it's a 5-min fix or an end-of-day call

---

## Rollback plan

Every phase is a separate commit, so:
- **Pre-deploy break:** git revert before push
- **Post-deploy break:** Vercel one-click rollback to previous deploy
- **Post-deploy subtle bug discovered later:** revert via git, investigate offline, re-attempt the phase with the fix

We do NOT push if compile fails. We do NOT continue to the next phase if smoke test fails.

---

## Pre-flight decisions for Connor

Before starting tomorrow morning, **three decisions to make**:

### 1. JS or TS?
**Recommendation: JS** (status quo). Migrating to TypeScript during a refactor is two changes at once = bug magnet. Do TS later if we want it, as a separate dedicated migration.

### 2. Folder structure: feature or layer?
**Recommendation: layer-based** (the structure shown above: `lib/`, `views/`, `modals/`, `settings/`). Feature-based (`/jobs/{components,api,modals}/`) reads better for big teams but adds friction for a solo founder. Layer-based is what most React codebases use.

### 3. AppInner split now or later?
**Recommendation: extract as one file tomorrow, defer the state-into-Context split.** Doing both is too much for one session. The Context split is cleaner once the views are already in their own files (Phase 7 done).

---

## What success looks like at end of day

- App.jsx is <500 lines (was 32,355)
- 30+ logical files, each <800 lines except AIAssistant (~7,800 — staying intact for now)
- Same UX, same data flows, same features
- Sentry quiet (no new errors)
- Bundle size within ±5% of baseline
- Compile time within ±20% of baseline
- Hot-reload feels noticeably snappier (the win we promised ourselves)
- One single deploy at the end (or per-phase deploys, depending on confidence)

---

## What we're NOT solving tomorrow

These are deferred — listed so we know they're known, not forgotten:

1. **AIAssistant internal split.** 7,800 lines remain in one file. Worth tackling in a focused future session, ideally with a co-pilot.
2. **State-into-Context migration.** AppInner still owns lots of top-level state. Next iteration could move to a Zustand or Context-based state container.
3. **TypeScript migration.** Worth doing eventually but separately.
4. **Bundle splitting / lazy loading.** Once views are in their own files, `React.lazy(() => import('./views/Reports.jsx'))` becomes trivial. Easy win post-refactor.
5. **Test infrastructure.** No unit/integration tests today; manual smoke testing continues. Investing in tests is worth it but a separate decision.

---

## Final note

This is the riskiest single session in Trade PA's history (touching the most lines), but also one of the most valuable. The phased approach + per-phase commits + smoke tests is what makes it safe. **No skipping verification between phases**, even when it feels like it's going well — that's exactly when subtle issues sneak in.

If we get to lunchtime tomorrow and something feels wrong, **stop and assess.** The deferred phases are still better than a half-broken refactor.
