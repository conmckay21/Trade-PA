// ─── DiaryHub — Diary bottom-tab landing ────────────────────────────────
// Extracted verbatim from App.jsx during P8 (28 Apr 2026).
import { HubPage } from "../../components/HubPage.jsx";
import { isSameDay } from "../../lib/date-helpers.js";

export function DiaryHub({ setView, jobs, reminders }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayJobs = (jobs || []).filter(j => j.dateObj && isSameDay(new Date(j.dateObj), today));
  const upcomingReminders = (reminders || []).filter(r => !r.done && !r.dismissed);
  return (
    <HubPage
      title="Diary"
      sub="Schedule, reminders, and what's coming up"
      rows={[
        {
          name: "Schedule",
          meta: todayJobs.length > 0 ? `${todayJobs.length} job${todayJobs.length === 1 ? "" : "s"} today` : "Nothing scheduled today",
          tint: todayJobs.length > 0 ? "warn" : null,
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 11h18" /></svg>,
          onClick: () => setView("Schedule"),
        },
        {
          name: "Reminders",
          meta: upcomingReminders.length > 0 ? `${upcomingReminders.length} pending` : "Nothing pending",
          tint: upcomingReminders.length > 0 ? "warn" : null,
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
          onClick: () => setView("Reminders"),
        },
      ]}
    />
  );
}

// ─── AccountsHub — Accounts bottom-tab landing ──────────────────────────────
