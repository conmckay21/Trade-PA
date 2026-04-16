// ─── tokens.js ─────────────────────────────────────────────────────────
// Shared palette references and utilities for the component library.
//
// IMPORTANT: This file mirrors the `C` palette object that already exists
// inside App.jsx. The CSS variables (--c-bg, --c-surface, etc.) are set
// by your applyPalette() function in ThemeProvider, so any component that
// reads from these variables gets light/dark theme switching automatically.
//
// If you ever extract the C palette from App.jsx into its own file, update
// the imports in each component to read from that file instead. For now,
// keeping this self-contained means the components have zero coupling to
// the rest of the codebase.

// Theme-aware tokens (resolve at render time via CSS variables)
export const C = {
  bg: "var(--c-bg)",
  surface: "var(--c-surface)",
  surfaceHigh: "var(--c-surfaceHigh)",
  border: "var(--c-border)",
  text: "var(--c-text)",
  textDim: "var(--c-textDim)",
  muted: "var(--c-muted)",

  // Accent colours — fixed across themes (match App.jsx C object exactly)
  amber: "#f59e0b",
  amberDim: "#92400e",
  green: "#10b981",
  red: "#ef4444",
  blue: "#3b82f6",
  purple: "#8b5cf6",
};

// Soft tints — used for backgrounds of pills/cards. Use rgba so the colour
// shows through onto whatever theme background is active.
export const TINT = {
  amber: "rgba(245, 158, 11, 0.10)",
  amberStrong: "rgba(245, 158, 11, 0.18)",
  green: "rgba(16, 185, 129, 0.12)",
  red: "rgba(239, 68, 68, 0.10)",
  blue: "rgba(59, 130, 246, 0.12)",
  purple: "rgba(139, 92, 246, 0.12)",
  muted: "rgba(255, 255, 255, 0.04)",
};

// Border colours — slightly stronger than tints, used on coloured pills/cards
export const BORDER_COLOR = {
  amber: "rgba(245, 158, 11, 0.30)",
  green: "rgba(16, 185, 129, 0.30)",
  red: "rgba(239, 68, 68, 0.25)",
  blue: "rgba(59, 130, 246, 0.30)",
  purple: "rgba(139, 92, 246, 0.30)",
};

// Standard fonts (match the @import in App.jsx LandingPage)
export const FONT = {
  mono: "'DM Mono', 'Courier New', monospace",
  sans: "'DM Sans', 'Helvetica Neue', sans-serif",
};

// Status → colour family mapping. Used by StatusPill so every status across
// the app uses the same palette. Add new statuses here, not inline.
//
// Semantic intent:
//   purple = pre-commitment (quoted, draft)
//   blue   = active commercial state (accepted, scheduled)
//   amber  = in-flight work or awaiting attention (in progress, invoiced/sent)
//   green  = positive terminal state (paid, delivered, signed)
//   red    = urgent / negative (overdue, failed, cancelled)
//   muted  = inactive terminal state (complete, archived)
export const STATUS_COLOR = {
  // Quote lifecycle
  draft:        "muted",
  quoted:       "purple",
  sent:         "blue",
  accepted:     "blue",
  declined:     "muted",

  // Job lifecycle
  scheduled:    "blue",
  in_progress:  "amber",
  "in progress":"amber",
  on_hold:      "muted",
  complete:     "muted",
  completed:    "muted",
  cancelled:    "muted",
  canceled:     "muted",

  // Invoice lifecycle
  invoiced:     "amber",   // sent, awaiting payment
  partial:      "amber",
  paid:         "green",
  overdue:      "red",
  failed:       "red",

  // Material lifecycle
  ordered:      "amber",
  delivered:    "green",
  to_order:     "red",
  "to order":   "red",

  // Compliance
  signed:       "green",
  unsigned:     "amber",
  expired:      "red",
};

// Look up the colour family for a status string. Defaults to "muted" so
// unknown statuses still render as a pill rather than throwing.
export function statusColor(status) {
  if (!status) return "muted";
  const key = String(status).toLowerCase().trim();
  return STATUS_COLOR[key] || "muted";
}

// ─── Keyframe injector ────────────────────────────────────────────────
// Each component that needs CSS animations injects its keyframes once
// into <head>. Tracks injected keys in a Set so re-mounts don't duplicate.
const _injectedKeyframes = new Set();

export function injectKeyframes(key, css) {
  if (typeof document === "undefined") return;
  if (_injectedKeyframes.has(key)) return;
  _injectedKeyframes.add(key);
  const style = document.createElement("style");
  style.setAttribute("data-tradepa-component", key);
  style.textContent = css;
  document.head.appendChild(style);
}

// ─── Display helpers ───────────────────────────────────────────────────
// Title-case for display only — never mutates underlying data. Use for
// rendering names that came from voice transcription or sloppy entry.
export function titleCase(s) {
  if (!s) return "";
  return String(s).replace(/\b\w/g, (c) => c.toUpperCase());
}

// Format relative time for receipt cards / row timestamps.
// Returns "just now", "2m ago", "3h ago", "5d ago", or absolute date.
export function relativeTime(timestamp) {
  if (!timestamp) return "";
  const now = Date.now();
  const then = typeof timestamp === "number" ? timestamp : new Date(timestamp).getTime();
  if (isNaN(then)) return "";
  const diffMs = now - then;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 30) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  // Older than 30 days — show absolute date
  const d = new Date(then);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
