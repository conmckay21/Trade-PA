import { useState, useEffect } from "react";
import { db } from "../lib/db.js";

export function useReminders(userId) {
  const [reminders, setRemindersRaw] = useState([]);

  // Load from localStorage once userId is known.
  // Falls back to Supabase if local cache is empty (handles app reloads,
  // new devices, or fresh installs where AI-set reminders went straight
  // to the database but never made it into local cache).
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const saved = localStorage.getItem(`trade-pa-reminders-${userId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          // Keep ALL reminders — overdue items must stay visible until
          // the user explicitly marks them Done ✓ or deletes them.
          // Only drop very old completed ones (>30 days) to avoid bloat.
          const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
          const valid = parsed.filter(r => !r.done || r.time > cutoff);
          if (!cancelled) setRemindersRaw(valid);
          if (valid.length > 0) return; // local cache hit, skip Supabase hydration
        }
        // Local empty — hydrate from Supabase
        const { data } = await db
          .from("reminders")
          .select("*")
          .eq("user_id", userId)
          .order("fire_at", { ascending: false })
          .limit(200);
        if (cancelled) return;
        if (data && data.length > 0) {
          const hydrated = data.map(r => ({
            id: r.id ? `r${r.id}` : `r${Date.parse(r.created_at) || Date.now()}`,
            text: r.text,
            time: Date.parse(r.fire_at),
            timeLabel: new Date(r.fire_at).toLocaleString("en-GB"),
            done: !!r.done,
            fired: !!r.fired,
          })).filter(r => !isNaN(r.time));
          setRemindersRaw(hydrated);
          try { localStorage.setItem(`trade-pa-reminders-${userId}`, JSON.stringify(hydrated)); } catch {}
        }
      } catch (e) {
        console.warn("Reminders load:", e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const persist = (next) => {
    if (userId) {
      try { localStorage.setItem(`trade-pa-reminders-${userId}`, JSON.stringify(next)); } catch {}
    }
  };

  const add = (reminder) => setRemindersRaw(prev => {
    const next = [reminder, ...prev];
    persist(next);
    return next;
  });
  const dismiss = (id) => setRemindersRaw(prev => {
    const next = prev.map(r => r.id === id ? { ...r, done: true } : r);
    persist(next);
    return next;
  });
  // Mark as 'fired' (alert shown) without marking complete — reminder stays
  // in Upcoming as Overdue until user explicitly confirms with "Done ✓".
  const markFired = (id) => setRemindersRaw(prev => {
    const next = prev.map(r => r.id === id ? { ...r, fired: true } : r);
    persist(next);
    return next;
  });
  const remove = (id) => setRemindersRaw(prev => {
    const next = prev.filter(r => r.id !== id);
    persist(next);
    return next;
  });

  return { reminders, add, dismiss, markFired, remove };
}
