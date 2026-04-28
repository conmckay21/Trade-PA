// ─── Theme-aware colour palette ─────────────────────────────────────
// Theme-aware tokens (bg/surface/text/border) use CSS variables that
// are updated when the theme changes — see ThemeProvider.
// Accent colours (amber/green/red/blue) stay as hex literals because
// they're brand colours and don't change between light/dark modes,
// and several places concat alpha suffixes (e.g. C.amber + "44") which
// would break with CSS variables.
export const C = {
  // Theme-aware (resolved at render time via CSS variables)
  bg: "var(--c-bg)",
  surface: "var(--c-surface)",
  surfaceHigh: "var(--c-surfaceHigh)",
  border: "var(--c-border)",
  text: "var(--c-text)",
  textDim: "var(--c-textDim)",
  muted: "var(--c-muted)",
  tabBarBg: "var(--c-tabBarBg)",
  // Accent colours — fixed across themes, support alpha-suffix concat
  amber: "#f59e0b",
  amberDim: "#92400e",
  green: "#10b981",
  red: "#ef4444",
  blue: "#3b82f6",
  purple: "#8b5cf6",
};

// Palette definitions — applied to CSS variables on theme change.
// DARK is the existing palette but with greys pushed lighter for
// outdoor sunlight readability (muted: 2.8:1 -> 8.2:1 contrast).
export const DARK_PALETTE = {
  bg: "#0f0f0f",
  surface: "#1a1a1a",
  surfaceHigh: "#242424",
  border: "#2a2a2a",
  text: "#f5f5f5",        // was #e5e5e5
  textDim: "#d1d5db",     // was #9ca3af
  muted: "#b8bcc4",       // was #6b7280 — much more readable
  // Tab bar uses translucent bg + backdrop blur for native iOS feel.
  // Slightly darker than surface so the bar reads as a distinct surface
  // even when content scrolls behind it.
  tabBarBg: "rgba(15, 15, 15, 0.85)",
};

// LIGHT palette designed for outdoor visibility, not just inverted.
// Off-white background reduces glare; deep greys for hierarchy.
export const LIGHT_PALETTE = {
  bg: "#fafafa",
  surface: "#ffffff",
  surfaceHigh: "#f3f4f6",
  border: "#d1d5db",
  text: "#0f0f0f",
  textDim: "#374151",     // dark grey - 11.2:1 contrast on light bg
  muted: "#4b5563",       // mid-dark grey - 7.5:1 contrast on light bg
  // Tab bar: translucent white with backdrop blur — mirrors how native iOS
  // tab bars render in apps like Mail, Settings, Messages. The transparency
  // lets a hint of scrolled content show through, reinforcing depth.
  tabBarBg: "rgba(255, 255, 255, 0.85)",
};

// Apply a palette to the document root via CSS variables.
// Called by ThemeProvider on mount + whenever theme changes.
export function applyPalette(palette) {
  const root = document.documentElement;
  Object.entries(palette).forEach(([key, value]) => {
    root.style.setProperty(`--c-${key}`, value);
  });
  // Set color-scheme so browser scrollbars / form controls match
  root.style.colorScheme = palette === LIGHT_PALETTE ? "light" : "dark";
  // Set background on <html> and <body> so the page (including overscroll
  // and any area outside the React root) follows the theme — without this,
  // the app card sits on a dark page background in light mode.
  root.style.background = palette.bg;
  if (document.body) {
    document.body.style.background = palette.bg;
    document.body.style.color = palette.text;
  }
}

// Apply dark palette immediately on module load so first paint is correct.
// (ThemeProvider will override based on user preference once mounted.)
if (typeof document !== "undefined") {
  applyPalette(DARK_PALETTE);
}
