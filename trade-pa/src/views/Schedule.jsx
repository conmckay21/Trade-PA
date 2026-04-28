// ─── Schedule ───────────────────────────────────────────────────────────
// Extracted verbatim from App.jsx during P7 sub-batch A (28 Apr 2026).
//
// Includes private helpers `getWeekStart`, `formatDayLabel` (used only here)
// and `generateICS` (also only used here — the public ICS feed in /api/calendar
// re-implements the format server-side).
import React, { useState, useEffect } from "react";
import { C } from "../theme/colors.js";
import { S } from "../theme/styles.js";
import { fmtAmount } from "../lib/format.js";
import { isSameDay } from "../lib/date-helpers.js";
import { statusColor, statusLabel } from "../lib/status.js";
import { VoiceFillButton } from "../components/VoiceFillButton.jsx";

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDayLabel(date) {
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

// (isSameDay moved to ./lib/date-helpers.js — P7 prelude)

export function Schedule({ jobs, setJobs, customers, setContextHint }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDayIdx, setSelectedDayIdx] = useState(null); // null = auto-select today
  const [showAddJob, setShowAddJob] = useState(false);
  const [addJobDate, setAddJobDate] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [editingJob, setEditingJob] = useState(null);
  const [form, setForm] = useState({ customer: "", address: "", type: "", time: "09:00", value: "", status: "confirmed", notes: "" });

  const weekStart = new Date(getWeekStart(new Date()));
  weekStart.setDate(weekStart.getDate() + weekOffset * 7);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const jobsForDay = (day) => jobs.filter(j => j.dateObj && isSameDay(new Date(j.dateObj), day)).sort((a, b) => new Date(a.dateObj) - new Date(b.dateObj));

  // Auto-select today if this week, otherwise Monday
  const activeIdx = selectedDayIdx !== null ? selectedDayIdx : weekDays.findIndex(d => isSameDay(d, today));
  const activeDay = weekDays[activeIdx >= 0 ? activeIdx : 0];
  const dayJobs = jobsForDay(activeDay);

  // Context hint
  useEffect(() => {
    if (!setContextHint) return;
    const todayJobs = jobs.filter(j => j.dateObj && isSameDay(new Date(j.dateObj), today));
    const nextJob = todayJobs.sort((a, b) => new Date(a.dateObj) - new Date(b.dateObj))[0];
    const bits = [`Schedule: ${todayJobs.length} job${todayJobs.length === 1 ? "" : "s"} today`];
    if (nextJob) bits.push(`next: ${nextJob.customer} at ${new Date(nextJob.dateObj).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`);
    setContextHint(bits.join(" · "));
    return () => { if (setContextHint) setContextHint(null); };
  }, [jobs, setContextHint]);

  const weekLabel = () => {
    const end = new Date(weekStart); end.setDate(end.getDate() + 6);
    return `${weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
  };

  const openAdd = (day) => {
    setAddJobDate(day);
    setForm({ customer: "", address: "", type: "", time: "09:00", value: "", status: "confirmed", notes: "" });
    setShowAddJob(true);
  };

  const saveJob = () => {
    if (!form.customer || !form.type) return;
    const dateObj = new Date(addJobDate);
    const [h, m] = form.time.split(":");
    dateObj.setHours(parseInt(h), parseInt(m));
    const newJob = {
      id: Date.now(),
      customer: form.customer,
      address: form.address,
      type: form.type,
      date: `${formatDayLabel(addJobDate)} ${form.time}`,
      dateObj: dateObj.toISOString(),
      status: form.status,
      value: parseInt(form.value) || 0,
      notes: form.notes,
    };
    setJobs(prev => [...prev, newJob]);
    setShowAddJob(false);
  };

  const saveEdit = () => {
    setJobs(prev => prev.map(j => j.id === editingJob.id ? {
      ...j,
      customer: form.customer,
      address: form.address,
      type: form.type,
      status: form.status,
      value: parseInt(form.value) || 0,
      notes: form.notes,
    } : j));
    setEditingJob(null);
    setSelectedJob(null);
  };

  const deleteJob = (id) => {
    setJobs(prev => prev.filter(j => j.id !== id));
    setSelectedJob(null);
  };

  const dayLabel = (day) => {
    if (isSameDay(day, today)) return "Today";
    const tmrw = new Date(today); tmrw.setDate(tmrw.getDate() + 1);
    if (isSameDay(day, tmrw)) return "Tomorrow";
    return day.toLocaleDateString("en-GB", { weekday: "long" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Schedule</div>
        <button style={S.btn("primary")} onClick={() => openAdd(activeDay)}>+ Add Job</button>
      </div>

      {/* Week nav — compact strip */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={() => { setWeekOffset(o => o - 1); setSelectedDayIdx(null); }} aria-label="Previous week" style={{ background: "none", border: "none", color: C.text, cursor: "pointer", padding: 4, display: "grid", placeItems: "center" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>

        <div style={{ flex: 1, display: "flex", gap: 2, justifyContent: "space-between" }}>
          {weekDays.map((day, i) => {
            const isToday = isSameDay(day, today);
            const isActive = i === (activeIdx >= 0 ? activeIdx : 0);
            const hasJobs = jobsForDay(day).length > 0;
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            return (
              <div
                key={i}
                onClick={() => setSelectedDayIdx(i)}
                style={{
                  flex: 1, textAlign: "center", padding: "6px 2px", borderRadius: 10,
                  cursor: "pointer", transition: "all 0.15s",
                  background: isActive ? (isToday ? C.amber : C.surfaceHigh) : "transparent",
                  border: isActive ? `1px solid ${isToday ? C.amber : C.border}` : "1px solid transparent",
                  opacity: isWeekend && !isActive ? 0.5 : 1,
                }}
              >
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", color: isActive && isToday ? "#000" : C.muted }}>{day.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase()}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: isActive && isToday ? "#000" : C.text, marginTop: 1 }}>{day.getDate()}</div>
                {hasJobs && <div style={{ width: 5, height: 5, borderRadius: "50%", background: isActive && isToday ? "#000" : C.green, margin: "3px auto 0" }} />}
              </div>
            );
          })}
        </div>

        <button onClick={() => { setWeekOffset(o => o + 1); setSelectedDayIdx(null); }} aria-label="Next week" style={{ background: "none", border: "none", color: C.text, cursor: "pointer", padding: 4, display: "grid", placeItems: "center" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      {/* Week label + Today button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 11, color: C.muted, fontFamily: "'DM Mono',monospace" }}>{weekLabel()}</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => {
            // One-shot snapshot download. For live sync, see Settings → Notifications → Calendar Subscription.
            const ics = generateICS(jobs, "Trade PA");
            const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `trade-pa-schedule-${new Date().toISOString().split("T")[0]}.ics`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 100);
          }} style={{ ...S.btn("ghost"), fontSize: 10, padding: "4px 10px" }}>⬇ .ics</button>
          {weekOffset !== 0 && <button onClick={() => { setWeekOffset(0); setSelectedDayIdx(null); }} style={{ ...S.btn("ghost"), fontSize: 10, padding: "4px 10px" }}>Today</button>}
        </div>
      </div>

      {/* Selected day — header */}
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: C.muted, textTransform: "uppercase" }}>
        {dayLabel(activeDay)} — {activeDay.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
      </div>

      {/* Day jobs list */}
      {dayJobs.length === 0 ? (
        <div onClick={() => openAdd(activeDay)} style={{ background: C.surfaceHigh, border: `2px dashed ${C.border}`, borderRadius: 12, padding: "32px 20px", textAlign: "center", cursor: "pointer" }}>
          <div style={{ fontSize: 14, color: C.muted, marginBottom: 4 }}>No jobs {dayLabel(activeDay).toLowerCase()}</div>
          <div style={{ fontSize: 11, color: C.textDim }}>Tap to add one, or tap the mic to book by voice</div>
        </div>
      ) : dayJobs.map(job => (
        <div
          key={job.id}
          onClick={() => setSelectedJob(job)}
          style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 0,
            borderLeft: `3px solid ${statusColor[job.status] || C.muted}`,
            padding: "12px 14px", cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{job.customer}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                {job.type}{job.address ? ` · ${job.address}` : ""}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>
                {job.dateObj ? new Date(job.dateObj).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : ""}
              </div>
              <div style={S.badge(statusColor[job.status] || C.muted)}>{statusLabel[job.status] || job.status}</div>
            </div>
          </div>
          {job.value > 0 && <div style={{ fontSize: 11, color: C.green, fontFamily: "'DM Mono',monospace", marginTop: 4 }}>{fmtAmount(job.value)}</div>}
        </div>
      ))}

      {/* ── Job Detail Modal ── */}
      {selectedJob && !editingJob && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }} onClick={() => setSelectedJob(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.card, maxWidth: 480, width: "100%", marginBottom: 16, borderRadius: 14, padding: 0, overflow: "hidden" }}>
            {/* Modal header bar */}
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => setSelectedJob(null)} aria-label="Close" style={{ background: "none", border: "none", color: C.text, cursor: "pointer", padding: 4, display: "grid", placeItems: "center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: C.muted, letterSpacing: "0.06em" }}>{selectedJob.type || "JOB"}</div>
                <div style={{ fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedJob.customer}</div>
              </div>
              <div style={S.badge(statusColor[selectedJob.status] || C.muted)}>{statusLabel[selectedJob.status] || selectedJob.status}</div>
            </div>

            {/* Details */}
            <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div style={{ padding: "10px 12px", background: C.surfaceHigh, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>Date</div>
                  <div style={{ fontSize: 13 }}>{selectedJob.dateObj ? new Date(selectedJob.dateObj).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : selectedJob.date}</div>
                </div>
                <div style={{ padding: "10px 12px", background: C.surfaceHigh, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>Time</div>
                  <div style={{ fontSize: 13 }}>{selectedJob.dateObj ? new Date(selectedJob.dateObj).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : ""}</div>
                </div>
              </div>
              <div style={{ padding: "10px 12px", background: C.surfaceHigh, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>Address</div>
                <div style={{ fontSize: 13, color: selectedJob.address ? C.text : C.muted }}>{selectedJob.address || "Not set"}</div>
              </div>
              {selectedJob.value > 0 && (
                <div style={{ padding: "10px 12px", background: C.surfaceHigh, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>Value</div>
                  <div style={{ fontSize: 13 }}>{fmtAmount(selectedJob.value)}</div>
                </div>
              )}
              <div style={{ padding: "10px 12px", background: C.surfaceHigh, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>Notes</div>
                <div style={{ fontSize: 13, color: selectedJob.notes ? C.text : C.muted, fontStyle: selectedJob.notes ? "normal" : "italic" }}>
                  {selectedJob.notes || "No notes added"}
                </div>
              </div>
            </div>

            {/* Actions — in a footer bar */}
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button style={S.btn("primary")} onClick={() => {
                setEditingJob(selectedJob);
                setForm({ customer: selectedJob.customer, address: selectedJob.address || "", type: selectedJob.type, time: selectedJob.dateObj ? new Date(selectedJob.dateObj).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }).replace(":", ":") : "09:00", value: selectedJob.value || "", status: selectedJob.status, notes: selectedJob.notes || "" });
              }}>Edit</button>
              {selectedJob.status !== "confirmed" && (
                <button style={S.btn("green")} onClick={() => { setJobs(prev => prev.map(j => j.id === selectedJob.id ? { ...j, status: "confirmed" } : j)); setSelectedJob(null); }}>Confirm</button>
              )}
              {selectedJob.address && (
                <a href={`https://maps.google.com/?q=${encodeURIComponent(selectedJob.address)}`} target="_blank" rel="noreferrer" style={{ ...S.btn("ghost"), textDecoration: "none" }}>Directions</a>
              )}
              <button style={{ ...S.btn("ghost"), color: C.red, marginLeft: "auto" }} onClick={() => deleteJob(selectedJob.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Job Modal ── */}
      {editingJob && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 310, padding: 16 }}>
          <div style={{ ...S.card, maxWidth: 440, width: "100%", marginBottom: 16, borderRadius: 14, padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => setEditingJob(null)} aria-label="Close" style={{ background: "none", border: "none", color: C.text, cursor: "pointer", padding: 4, display: "grid", placeItems: "center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <div style={{ fontSize: 15, fontWeight: 700, flex: 1 }}>Edit Job</div>
              <VoiceFillButton form={form} setForm={setForm} fieldDescriptions="customer (full name), address (property address), type (job type e.g. Boiler Service), value (£ amount), notes (any details)" />
            </div>
            <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { k: "customer", l: "Customer Name", p: "e.g. John Smith" },
                { k: "address", l: "Address", p: "e.g. 5 High Street, Guildford" },
                { k: "type", l: "Job Type", p: "e.g. Boiler Service" },
                { k: "value", l: "Value (£)", p: "e.g. 120" },
              ].map(({ k, l, p }) => (
                <div key={k}>
                  <label style={S.label}>{l}</label>
                  <input style={S.input} placeholder={p} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label style={S.label}>Notes</label>
                <textarea style={{ ...S.input, resize: "vertical", minHeight: 80 }} placeholder="Any notes about this job..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Status</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["confirmed", "pending", "quote_sent"].map(st => (
                    <button key={st} onClick={() => setForm(f => ({ ...f, status: st }))} style={S.pill(statusColor[st], form.status === st)}>{statusLabel[st]}</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.border}` }}>
              <button style={{ ...S.btn("primary"), width: "100%", justifyContent: "center" }} disabled={!form.customer || !form.type} onClick={saveEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Job Modal ── */}
      {showAddJob && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }}>
          <div style={{ ...S.card, maxWidth: 440, width: "100%", marginBottom: 16, borderRadius: 14, padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => setShowAddJob(false)} aria-label="Close" style={{ background: "none", border: "none", color: C.text, cursor: "pointer", padding: 4, display: "grid", placeItems: "center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: C.muted, letterSpacing: "0.06em" }}>{addJobDate?.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Add Job</div>
              </div>
              <VoiceFillButton form={form} setForm={setForm} fieldDescriptions="customer (full name), address (property address), type (job type e.g. Boiler Service), value (£ amount), notes (any details)" />
            </div>
            <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { k: "customer", l: "Customer Name", p: "e.g. John Smith" },
                { k: "address", l: "Address", p: "e.g. 5 High Street, Guildford" },
                { k: "type", l: "Job Type", p: "e.g. Boiler Service" },
                { k: "value", l: "Value (£)", p: "e.g. 120" },
              ].map(({ k, l, p }) => (
                <div key={k}>
                  <label style={S.label}>{l}</label>
                  <input style={S.input} placeholder={p} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label style={S.label}>Time</label>
                <input type="time" style={S.input} value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Notes</label>
                <textarea style={{ ...S.input, resize: "vertical", minHeight: 72 }} placeholder="Any notes about this job..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Status</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["confirmed", "pending", "quote_sent"].map(st => (
                    <button key={st} onClick={() => setForm(f => ({ ...f, status: st }))} style={S.pill(statusColor[st], form.status === st)}>{statusLabel[st]}</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.border}` }}>
              <button style={{ ...S.btn("primary"), width: "100%", justifyContent: "center" }} disabled={!form.customer || !form.type} onClick={saveJob}>Save Job</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Materials ────────────────────────────────────────────────────────────────
// (DEFAULT_SUPPLIERS moved to ./lib/constants.js — P1)

// ─── iCalendar (.ics) generator ──────────────────────────────────────────────
// Builds an RFC 5545 VCALENDAR from a jobs array. Used by both the in-app
// "Download .ics" button (Schedule tab) and the public subscribable feed
// (/api/calendar/[token]).
//
// Times are emitted in UTC (Z suffix) — simplest, no VTIMEZONE block needed,
// and Google/Apple Calendar render them in the user's local time correctly.
// Each event UID is stable per job ID, so re-importing/refreshing doesn't
// duplicate entries.
function generateICS(jobs, brandName) {
  const esc = (s) => String(s || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
  // RFC 5545 line folding: any line longer than 75 octets gets folded with CRLF + space
  const fold = (line) => {
    if (line.length <= 75) return line;
    let out = "";
    let remaining = line;
    while (remaining.length > 75) {
      out += remaining.slice(0, 75) + "\r\n ";
      remaining = remaining.slice(75);
    }
    return out + remaining;
  };
  const dt = (d) => {
    const x = new Date(d);
    if (isNaN(x.getTime())) return "";
    return x.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  };

  const now = dt(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Trade PA//Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(brandName || "Trade PA")} — Jobs`,
    "X-WR-TIMEZONE:Europe/London",
  ];

  (jobs || []).forEach(job => {
    // Pick the best available date field; skip jobs with no schedulable date
    const dateSrc = job.dateObj || job.scheduled_date || job.date_obj || job.date;
    const startD = dateSrc ? new Date(dateSrc) : null;
    if (!startD || isNaN(startD.getTime())) return;
    // If a duration field exists treat as minutes; default 60
    const durationMin = parseInt(job.duration_minutes || job.duration || 60, 10) || 60;
    const endD = new Date(startD.getTime() + durationMin * 60 * 1000);
    const summary = `${job.type || job.title || "Job"} — ${job.customer || "Unknown"}`;
    const desc = [
      job.notes ? `Notes: ${job.notes}` : null,
      job.value ? `Value: £${parseFloat(job.value).toFixed(2)}` : null,
      job.status ? `Status: ${job.status}` : null,
    ].filter(Boolean).join("\n");

    lines.push("BEGIN:VEVENT");
    lines.push(fold(`UID:job-${job.id}@tradespa.co.uk`));
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART:${dt(startD)}`);
    lines.push(`DTEND:${dt(endD)}`);
    lines.push(fold(`SUMMARY:${esc(summary)}`));
    if (job.address) lines.push(fold(`LOCATION:${esc(job.address)}`));
    if (desc) lines.push(fold(`DESCRIPTION:${esc(desc)}`));
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
