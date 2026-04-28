import React, { useState, useEffect } from "react";
import { applyPalette, LIGHT_PALETTE, DARK_PALETTE } from "./colors.js";

// ─── Theme context ──────────────────────────────────────────────────
export const ThemeContext = React.createContext({
  theme: "auto",       // "auto" | "light" | "dark"
  resolvedTheme: "dark", // "light" | "dark" — the actual theme being shown
  setTheme: () => {},
});

export function ThemeProvider({ children }) {
  // Load saved preference, default to "auto" (follow system)
  const [theme, setThemeRaw] = useState(() => {
    try {
      return localStorage.getItem("trade-pa-theme") || "auto";
    } catch { return "auto"; }
  });
  // Track system preference for "auto" mode
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => {
    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch { return true; }
  });

  // Resolved theme = actual theme to display
  const resolvedTheme = theme === "auto" ? (systemPrefersDark ? "dark" : "light") : theme;

  // Listen for system preference changes (user toggles OS dark mode)
  useEffect(() => {
    try {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e) => setSystemPrefersDark(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    } catch {}
  }, []);

  // Apply palette whenever resolved theme changes
  useEffect(() => {
    applyPalette(resolvedTheme === "light" ? LIGHT_PALETTE : DARK_PALETTE);
  }, [resolvedTheme]);

  const setTheme = (t) => {
    setThemeRaw(t);
    try { localStorage.setItem("trade-pa-theme", t); } catch {}
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => React.useContext(ThemeContext);
