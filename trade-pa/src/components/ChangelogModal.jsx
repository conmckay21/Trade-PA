// trade-pa/src/components/ChangelogModal.jsx
//
// Renders the changelog from /changelog.md as a scrollable, styled modal.
// Tracks which entries the user has already seen via localStorage so the
// "What's new" link can show an indicator dot when there are unread entries.
//
// The changelog source is a markdown file in /public/changelog.md. We do
// minimal parsing here (no full markdown library) — enough to handle the
// ## YYYY-MM-DD and ### Entry title structure seeded in the file. Keeping
// the parser small avoids dragging in a markdown dependency for one feature.
//
// localStorage key:  tp_changelog_lastread  (stores the most recent
//                    YYYY-MM-DD date the user has seen)

import { useEffect, useState } from "react";

const LAST_READ_KEY = "tp_changelog_lastread";

// Parse the markdown changelog into a structured list of releases.
// Expected format (see public/changelog.md):
//
//   ## 2026-04-21
//
//   ### Get paid by card 💳
//   Body paragraph (can span multiple lines, joined by spaces).
//
//   ### Another entry title
//   Another body paragraph.
//
//   ---
//
// Returns: [{ date, entries: [{ title, body }, ...] }, ...]
// (newest first — same order as the file)
function parseChangelog(md) {
  const releases = [];
  let current = null;
  let currentEntry = null;
  const lines = md.split("\n");

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Top-level "# What's new" title — ignore
    if (line.startsWith("# ") && !line.startsWith("## ")) continue;

    // Horizontal rule — ignore
    if (line === "---") continue;

    // Release date header
    if (line.startsWith("## ")) {
      current = { date: line.slice(3).trim(), entries: [] };
      releases.push(current);
      currentEntry = null;
      continue;
    }

    // Entry title
    if (line.startsWith("### ") && current) {
      currentEntry = { title: line.slice(4).trim(), body: "" };
      current.entries.push(currentEntry);
      continue;
    }

    // Body line — append to current entry with a space separator
    if (currentEntry && line.trim()) {
      currentEntry.body = currentEntry.body
        ? `${currentEntry.body} ${line.trim()}`
        : line.trim();
    }
  }

  return releases;
}

// Check whether there are unread entries. Exposed as a standalone helper
// so UpdateBanner can show a dot without having to open the modal.
export async function hasUnreadChangelog() {
  try {
    const lastRead = localStorage.getItem(LAST_READ_KEY) || "";
    // Cache-buster so the SW can't serve a stale precached copy
    const res = await fetch(`/changelog.md?v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return false;
    const md = await res.text();
    const releases = parseChangelog(md);
    if (releases.length === 0) return false;
    const newest = releases[0].date;
    return newest > lastRead;
  } catch {
    return false;
  }
}

export default function ChangelogModal({ open, onClose }) {
  const [releases, setReleases] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;

    // Fetch every time the modal opens — changelog.md is tiny and cache:
    // 'no-store' keeps it current after a deploy.
    setReleases(null);
    setError(null);

    fetch(`/changelog.md?v=${Date.now()}`, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`Couldn't load changelog (${r.status})`);
        return r.text();
      })
      .then((md) => {
        const parsed = parseChangelog(md);
        setReleases(parsed);
        // Mark the newest release as read so the indicator dot clears.
        if (parsed.length > 0) {
          try {
            localStorage.setItem(LAST_READ_KEY, parsed[0].date);
          } catch {}
        }
      })
      .catch((err) => setError(err.message || "Couldn't load changelog"));
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="What's new"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        animation: "tpChangelogFade 180ms ease-out",
      }}
    >
      <style>{`
        @keyframes tpChangelogFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes tpChangelogSlide {
          from { transform: translateY(16px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#111",
          border: "1px solid #262626",
          borderRadius: 16,
          width: "100%",
          maxWidth: 520,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
          animation: "tpChangelogSlide 220ms ease-out",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 18px",
            borderBottom: "1px solid #262626",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "'DM Mono', ui-monospace, monospace",
                fontSize: 11,
                color: "#737373",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Trade PA
            </div>
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 18,
                fontWeight: 700,
                color: "#fafafa",
                marginTop: 2,
              }}
            >
              What's new ✨
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              color: "#a3a3a3",
              border: "none",
              fontSize: 22,
              lineHeight: 1,
              cursor: "pointer",
              padding: 6,
              borderRadius: 8,
            }}
          >
            ×
          </button>
        </div>

        {/* Scroll area */}
        <div
          style={{
            overflowY: "auto",
            padding: "12px 18px 22px",
            flex: 1,
            minHeight: 0,
          }}
        >
          {error && (
            <div
              style={{
                fontFamily: "'DM Mono', ui-monospace, monospace",
                fontSize: 12,
                color: "#ef4444",
                padding: "12px 0",
              }}
            >
              {error}
            </div>
          )}
          {releases === null && !error && (
            <div
              style={{
                fontFamily: "'DM Mono', ui-monospace, monospace",
                fontSize: 12,
                color: "#737373",
                padding: "12px 0",
              }}
            >
              Loading…
            </div>
          )}
          {releases && releases.length === 0 && !error && (
            <div
              style={{
                fontFamily: "'DM Mono', ui-monospace, monospace",
                fontSize: 12,
                color: "#737373",
                padding: "12px 0",
              }}
            >
              No entries yet.
            </div>
          )}
          {releases &&
            releases.map((rel, i) => (
              <div key={rel.date} style={{ marginTop: i === 0 ? 6 : 22 }}>
                <div
                  style={{
                    fontFamily: "'DM Mono', ui-monospace, monospace",
                    fontSize: 11,
                    color: "#a3a3a3",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    marginBottom: 10,
                  }}
                >
                  {formatDate(rel.date)}
                </div>
                {rel.entries.map((entry, j) => (
                  <div
                    key={j}
                    style={{
                      background: "#171717",
                      border: "1px solid #262626",
                      borderRadius: 12,
                      padding: "12px 14px",
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#fafafa",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {entry.title}
                    </div>
                    {entry.body && (
                      <div
                        style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: 12.5,
                          color: "#a3a3a3",
                          marginTop: 4,
                          lineHeight: 1.5,
                        }}
                      >
                        {entry.body}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// Turn "2026-04-21" into "21 Apr 2026" for display.
function formatDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  try {
    const d = new Date(`${iso}T00:00:00Z`);
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
