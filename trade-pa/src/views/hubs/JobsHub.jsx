// ─── JobsHub — Jobs bottom-tab landing ──────────────────────────────────
// Extracted verbatim from App.jsx during P8 (28 Apr 2026).
import { HubPage } from "../../components/HubPage.jsx";

export function JobsHub({ setView, jobs, enquiries, materials }) {
  const newEnquiries = (enquiries || []).filter(e => !e.status || e.status === "new");
  const activeJobs = (jobs || []).filter(j => j.status !== "complete" && j.status !== "completed");
  return (
    <HubPage
      title="Jobs"
      sub="Work in progress and the paperwork behind it"
      rows={[
        {
          name: "Jobs",
          meta: activeJobs.length > 0 ? `${activeJobs.length} active job${activeJobs.length === 1 ? "" : "s"}` : "No active jobs",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /></svg>,
          onClick: () => setView("Jobs"),
        },
        {
          name: "Enquiries",
          meta: newEnquiries.length > 0 ? `${newEnquiries.length} new enquir${newEnquiries.length === 1 ? "y" : "ies"}` : "No new enquiries",
          tint: newEnquiries.length > 0 ? "warn" : null,
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
          onClick: () => setView("Enquiries"),
        },
        {
          name: "Materials",
          meta: (materials || []).length > 0 ? `${materials.length} item${materials.length === 1 ? "" : "s"} logged` : "No materials logged",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
          onClick: () => setView("Materials"),
        },
        {
          name: "Stock",
          meta: "Van and site inventory",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>,
          onClick: () => setView("Stock"),
        },
        {
          name: "RAMS",
          meta: "Risk assessment and method statements",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
          onClick: () => setView("RAMS"),
        },
        {
          name: "Documents",
          meta: "Certificates, reports, shared files",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
          onClick: () => setView("Documents"),
        },
      ]}
    />
  );
}

// ─── DiaryHub — Diary bottom-tab landing ────────────────────────────────────
