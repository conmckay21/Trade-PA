// ─── useReminders.js ──────────────────────────────────────────────────────
//
// Reminders sync hook. Reads + writes flow through Supabase as the source
// of truth, with localStorage as a fast-paint cache.
//
// History:
// - Pre-28 Apr 2026: writes (add/dismiss/markFired/remove) only touched
//   localStorage + React state, never Supabase. The mount loader was
//   localStorage-first, skipping Supabase entirely whenever the cache had
//   any entries. Two consequences:
//     • Reminders set on device A never appeared on device B (BUG-004).
//     • Cron-fired reminders kept re-firing because dismissals never made
//       it to Supabase, where the cron job reads the `done` flag (BUG-007).
//   The AI tool path (`set_reminder`) wrote straight to the table but the
//   UI path silently bypassed it.
//
// Fix (28 Apr 2026 — BUG-004 + BUG-007):
// - Mount: localStorage paint → always Supabase hydrate (no more skip).
// - Migration: any local-only entries (id format `r${Date.now()}` rather
//   than `r${db_id}`) get inserted into Supabase the first time we hydrate
//   on a device that previously only had local writes. No data loss.
// - Mutations: every add/dismiss/markFired/remove writes to Supabase first
//   (or in parallel), then updates local state and persists localStorage.
// - Visibility: when the tab regains focus we re-hydrate from Supabase so
//   updates from other devices show up.
// - id format: locally-created reminders get `r${Date.now()}` until the
//   Supabase insert returns; afterwards we replace the temp id with
//   `r${db_id}` so subsequent dismiss/remove ops have a real db id.
//
// Schema assumptions (reminders table):
//   id, user_id, text, fire_at (timestamptz), done (bool), fired (bool),
//   related_type, related_id, created_at
// `related_type` / `related_id` are populated by the AI `set_reminder`
// tool; this hook preserves them on hydrate but doesn't write them from
// the UI path (no UI affordance for related_type yet).

import { useState, useEffect } from "react";
import { db } from "../lib/db.js";

// id helpers ──────────────────────────────────────────────────────────────
// Local ids look like `r${Date.now()}` (a 13-digit ms epoch).
// Supabase-backed ids look like `r${row.id}` where row.id is the real db
// primary key. We strip the leading "r" to get the db id; if the result
// is a 13-digit number it's almost certainly a local-only id and the row
// hasn't reached Supabase yet — callers handle that case by skipping the
// Supabase write.
const stripPrefix = (id) => String(id || "").replace(/^r/, "");
const isLocalOnlyId = (id) => /^r\d{13}$/.test(String(id || ""));

const REMINDER_CUTOFF_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function rowToReminder(r) {
  return {
    id: r.id != null ? `r${r.id}` : `r${Date.parse(r.created_at) || Date.now()}`,
    text: r.text,
    time: Date.parse(r.fire_at),
    timeLabel: new Date(r.fire_at).toLocaleString("en-GB"),
    done: !!r.done,
    fired: !!r.fired,
    related_type: r.related_type || null,
    related_id: r.related_id || null,
  };
}

export function useReminders(userId) {
  const [reminders, setRemindersRaw] = useState([]);

  const persist = (next) => {
    if (!userId) return;
    try { localStorage.setItem(`trade-pa-reminders-${userId}`, JSON.stringify(next)); } catch {}
  };

  // ── Hydrate from Supabase (with local-only migration) ──────────────────
  // Pulled out of the mount effect so it can be called from the visibility
  // listener too. `migrate=true` only on the first call per session — after
  // that, local-only entries that survived have already been pushed.
  const hydrateFromSupabase = async (uid, migrate = false) => {
    if (!uid) return;
    let { data, error } = await db
      .from("reminders")
      .select("*")
      .eq("user_id", uid)
      .order("fire_at", { ascending: false })
      .limit(200);
    if (error) { console.warn("Reminders hydrate:", error.message); return; }
    let hydrated = (data || []).map(rowToReminder).filter(r => !isNaN(r.time));

    // Migrate local-only entries (in localStorage but not in Supabase) on
    // first hydration. Spot them by id format: 13-digit local timestamp.
    if (migrate) {
      try {
        const saved = localStorage.getItem(`trade-pa-reminders-${uid}`);
        if (saved) {
          const local = JSON.parse(saved);
          const supabaseIds = new Set(hydrated.map(h => h.id));
          const orphaned = local.filter(r =>
            isLocalOnlyId(r.id) && !supabaseIds.has(r.id) && !r.done
          );
          if (orphaned.length > 0) {
            const rows = orphaned.map(r => ({
              user_id: uid,
              text: r.text,
              fire_at: new Date(r.time).toISOString(),
              done: !!r.done,
              fired: !!r.fired,
            }));
            const { data: inserted, error: insErr } = await db
              .from("reminders").insert(rows).select();
            if (insErr) {
              console.warn("Reminders migrate insert:", insErr.message);
            } else if (inserted) {
              hydrated = hydrated.concat(inserted.map(rowToReminder).filter(r => !isNaN(r.time)));
            }
          }
        }
      } catch (e) {
        console.warn("Reminders migrate:", e?.message || e);
      }
    }

    const cutoff = Date.now() - REMINDER_CUTOFF_MS;
    const final = hydrated.filter(r => !r.done || r.time > cutoff);
    setRemindersRaw(final);
    persist(final);
  };

  // ── Initial load: localStorage (fast paint) → Supabase (source of truth)
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      // 1) Fast paint from localStorage so the user sees something immediately
      try {
        const saved = localStorage.getItem(`trade-pa-reminders-${userId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          const cutoff = Date.now() - REMINDER_CUTOFF_MS;
          const valid = parsed.filter(r => !r.done || r.time > cutoff);
          if (!cancelled && valid.length > 0) setRemindersRaw(valid);
        }
      } catch (e) {
        console.warn("Reminders fast-paint:", e?.message || e);
      }
      // 2) Always reconcile with Supabase (with one-shot migration)
      if (!cancelled) await hydrateFromSupabase(userId, true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ── Re-hydrate on tab visibility regained (cross-device update pickup) ──
  useEffect(() => {
    if (!userId) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        hydrateFromSupabase(userId, false);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ── Mutations: write to Supabase, then update local state ──────────────
  // All four mutations apply optimistic local updates so the UI feels snappy
  // even on flaky connections; the Supabase write happens in parallel and a
  // failure logs a warning but doesn't roll back local state. The next mount
  // hydrate will reconcile any divergence.

  const add = async (reminder) => {
    // Optimistic local update first (instant UI feedback)
    setRemindersRaw(prev => {
      const next = [reminder, ...prev];
      persist(next);
      return next;
    });
    if (!userId) return;
    try {
      const { data, error } = await db.from("reminders").insert({
        user_id: userId,
        text: reminder.text,
        fire_at: new Date(reminder.time).toISOString(),
        done: !!reminder.done,
        fired: !!reminder.fired,
      }).select().single();
      if (error) { console.warn("Reminder add:", error.message); return; }
      // Replace the temp local id with the real db-backed one so future
      // dismiss/remove operations target the right row.
      const upgraded = rowToReminder(data);
      setRemindersRaw(prev => {
        const next = prev.map(r => r.id === reminder.id ? upgraded : r);
        persist(next);
        return next;
      });
    } catch (e) {
      console.warn("Reminder add:", e?.message || e);
    }
  };

  const dismiss = async (id) => {
    setRemindersRaw(prev => {
      const next = prev.map(r => r.id === id ? { ...r, done: true } : r);
      persist(next);
      return next;
    });
    if (!userId || isLocalOnlyId(id)) return; // never reached Supabase
    try {
      const dbId = stripPrefix(id);
      const { error } = await db.from("reminders")
        .update({ done: true }).eq("id", dbId).eq("user_id", userId);
      if (error) console.warn("Reminder dismiss:", error.message);
    } catch (e) {
      console.warn("Reminder dismiss:", e?.message || e);
    }
  };

  const markFired = async (id) => {
    setRemindersRaw(prev => {
      const next = prev.map(r => r.id === id ? { ...r, fired: true } : r);
      persist(next);
      return next;
    });
    if (!userId || isLocalOnlyId(id)) return;
    try {
      const dbId = stripPrefix(id);
      const { error } = await db.from("reminders")
        .update({ fired: true }).eq("id", dbId).eq("user_id", userId);
      if (error) console.warn("Reminder markFired:", error.message);
    } catch (e) {
      console.warn("Reminder markFired:", e?.message || e);
    }
  };

  const remove = async (id) => {
    setRemindersRaw(prev => {
      const next = prev.filter(r => r.id !== id);
      persist(next);
      return next;
    });
    if (!userId || isLocalOnlyId(id)) return;
    try {
      const dbId = stripPrefix(id);
      const { error } = await db.from("reminders")
        .delete().eq("id", dbId).eq("user_id", userId);
      if (error) console.warn("Reminder remove:", error.message);
    } catch (e) {
      console.warn("Reminder remove:", e?.message || e);
    }
  };

  return { reminders, add, dismiss, markFired, remove };
}
