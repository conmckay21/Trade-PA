Trade PA Component Library
Reusable UI components for the Trade PA app. Built to match the existing
conventions in App.jsx:

Inline styles, no CSS files, no Tailwind
No new dependencies — uses only React + your existing CSS variables
Theme-aware — every component reads from --c-bg, --c-surface, etc.
via the same CSS variables your applyPalette() function sets. Theme
switching just works, no prop drilling needed.
Self-contained — each component file owns its own keyframes and styles
DM Mono / DM Sans — the same fonts your app already uses

Files
FileWhat it istokens.jsPalette helpers, common keyframe injector, status colour mapStatusPill.jsxOne pill component for every status across the appDataCard.jsxProfit-card style data display (header, stats, rows, actions)ReceiptCard.jsxGreen-bordered "we did it" action confirmationsConfirmationCard.jsxAmber-bordered "confirm before sending" cardsErrorCard.jsxRed-bordered errors with plain-language + technical detailStateStrip.jsxListening / Thinking / Speaking / Auto-listening stripFieldMic.jsxPer-field voice input (3 states: idle / listening / populated)CTAMic.jsxRecord-level voice button with ring animationBottomSheet.jsxGeneric bottom sheet with drag handle + backdropVoicePanel.jsxContextual mini-conversation in a bottom sheet
How to use
Drop the components/ folder into your project. Import what you need:
jsximport StatusPill from "./components/StatusPill.jsx";
import DataCard from "./components/DataCard.jsx";

<StatusPill status="overdue" />
<DataCard
  eyebrow="MATERIALS"
  title="Lisa Kinsman"
  subtitle="Single Storey Extension · 40 Blakemere"
  stats={[
    { label: "ITEMS", value: "4" },
    { label: "TO ORDER", value: "1", color: "red" },
    { label: "SPEND", value: "£2,140", color: "amber" },
  ]}
  rows={[...]}
  actions={[...]}
/>
Design principles
These components encode the visual decisions from the audit:

Status pills are colour-coded by meaning, not by brand. Amber is for
primary actions; status uses green/red/blue/purple/grey.
Cards have structure: eyebrow → title → subtitle → stats → rows → actions.
Same shape for Materials, Jobs, Invoices, Profit, etc.
Receipt cards stay in scroll history. They're inline records of what the
AI did, not transient toasts.
Confirmation cards trigger only for risky actions — external sends,
fuzzy-matched entities, idempotency violations.
Error cards never speak technical detail. Plain English up top, stack
trace behind a tap.
Voice affordances scale with scope: hero (Dashboard) > CTA (every
screen) > field (every input).

What these components don't do

They don't touch App.jsx. Add them, then redesign one screen at a time.
They don't impose state management. They take props and call callbacks.
They don't fetch data. The screen calling them does that.
They don't animate beyond what's needed for the affordance.

When you're ready to integrate
Pick a small screen first (Customer Form is a good candidate — ~100 lines).
Replace the existing rendering with these components one at a time. Verify
in staging. Ship.
