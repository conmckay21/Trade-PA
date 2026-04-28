import React, { useState, useEffect } from "react";
import { useWhisper } from "../hooks/useWhisper.js";
import { authHeaders } from "../lib/auth.js";
import { C } from "../theme/colors.js";
import { S } from "../theme/styles.js";

// ─── Private helpers (used only by Reminders) ────────────────────────────
function formatCountdown(ms) {
  if (ms <= 0) return "Now";
  const mins = Math.floor(ms / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `in ${days}d ${hrs % 24}h`;
  if (hrs > 0) return `in ${hrs}h ${mins % 60}m`;
  if (mins > 0) return `in ${mins}m`;
  return "in <1m";
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function formatDate(ts) {
  const d = new Date(ts);
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function Reminders({ reminders, onAdd, onDismiss, onRemove, dueNow, onClearDue }) {
  const [input, setInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [notifStatus, setNotifStatus] = useState("unknown");

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if ("Notification" in window) setNotifStatus(Notification.permission);
  }, []);

  const requestNotifPermission = async () => {
    try {
      const result = await Notification.requestPermission();
      setNotifStatus(result);
    } catch {
      setNotifStatus("denied");
    }
  };

  const SYSTEM_PROMPT = `You are a reminder parser. The user is a UK tradesperson. Extract a reminder from their natural language input.

Return ONLY valid JSON, no other text:
{
  "text": "short reminder title (max 60 chars)",
  "minutesFromNow": <integer — minutes from now until reminder should fire>,
  "timeLabel": "human readable time e.g. '3:00 PM today' or 'tomorrow 9 AM'"
}

Rules:
- "in 10 minutes" = 10
- "at 3pm" = minutes until 3pm today (if already past, assume tomorrow)
- "tomorrow morning" = assume 9:00 AM tomorrow
- "tomorrow at 2" = 2:00 PM tomorrow
- "end of day" = 5:00 PM today
- "in an hour" = 60
- If no time given, default to 30 minutes
- Current time is ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;

  const parseReminder = async (text) => {
    if (!text.trim()) return;
    setParsing(true);
    setParseError("");
    try {
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 200,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: text }],
        }),
      });
      const data = await res.json();
      const raw = data.content?.[0]?.text || "{}";
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);

      const fireAt = Date.now() + (parsed.minutesFromNow || 30) * 60000;
      const reminder = {
        id: `r${Date.now()}`,
        text: parsed.text || text,
        time: fireAt,
        timeLabel: parsed.timeLabel || "",
        done: false,
        raw: text,
      };

      onAdd(reminder);
      setInput("");

      // Schedule notification
      const delay = fireAt - Date.now();
      if (delay > 0) {
        setTimeout(() => {
          // Try browser notification
          if ("Notification" in window && Notification.permission === "granted") {
            try {
              new Notification("Trade PA Reminder 🔔", {
                body: reminder.text,
                icon: "/favicon.ico",
              });
            } catch {}
          }
          // Always trigger in-app
          onAdd({ ...reminder, _due: true });
        }, delay);
      }
    } catch (e) {
      setParseError("Couldn't parse that — try again or type more clearly, e.g. 'remind me to call Dave at 3pm'");
    }
    setParsing(false);
  };

  const { recording: recRecording, transcribing: recTranscribing, toggle: recToggle } = useWhisper((text) => {
    if (text) setInput(text);
  });

  const upcoming = reminders.filter(r => !r.done && !r._due).sort((a, b) => a.time - b.time);
  const overdue = reminders.filter(r => !r.done && !r._due && r.time < now);
  const done = reminders.filter(r => r.done);

  const examples = [
    "Remind me to chase James Oliver at 3pm",
    "Call Emma Taylor back in 2 hours",
    "Order copper pipe tomorrow morning",
    "Check boiler parts invoice end of day",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Due now alert */}
      {dueNow.length > 0 && (
        <div style={{ background: C.red + "18", border: `1px solid ${C.red}44`, borderRadius: 10, padding: 16, display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ fontSize: 28 }}>🔔</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.red, marginBottom: 6 }}>Reminder Due</div>
            {dueNow.map((r, i) => (
              <div key={i} style={{ fontSize: 13, color: C.text, marginBottom: 4 }}>— {r.text}</div>
            ))}
          </div>
          <button style={S.btn("ghost")} onClick={onClearDue}>Dismiss all</button>
        </div>
      )}

      {/* Notification permission banner */}
      {notifStatus === "default" && (
        <div style={{ ...S.card, borderColor: C.amber + "44", background: C.amber + "08", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 24 }}>🔔</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Enable push notifications</div>
            <div style={{ fontSize: 12, color: C.muted }}>Get a browser notification when a reminder fires — even if the app isn't open.</div>
          </div>
          <button style={S.btn("primary")} onClick={requestNotifPermission}>Enable →</button>
        </div>
      )}
      {notifStatus === "denied" && (
        <div style={{ ...S.card, borderColor: "rgba(128,128,140,0.27)", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 20 }}>⚠️</div>
          <div style={{ flex: 1, fontSize: 12, color: C.muted }}>Browser notifications are blocked. Reminders will show in-app only. Allow notifications in your browser settings to get push alerts.</div>
        </div>
      )}
      {notifStatus === "granted" && (
        <div style={{ ...S.card, borderColor: C.green + "44", background: C.green + "08", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 20 }}>✅</div>
          <div style={{ fontSize: 12, color: C.green }}>Push notifications enabled — you'll get alerted even when the app isn't in focus.</div>
        </div>
      )}

      {/* Input */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Set a Reminder</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
          Speak or type naturally — "remind me to call Kevin at 3pm" or "chase Paul Wright invoice in 2 hours"
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {examples.map((ex, i) => (
            <button key={i} onClick={() => setInput(ex)} style={{ padding: "5px 12px", background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 20, color: C.textDim, fontSize: 11, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>{ex}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <input
            style={{ ...S.input, flex: 1 }}
            placeholder="e.g. Remind me to call Kevin Nash at 3pm today..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") parseReminder(input); }}
          />
          <button
            onClick={recToggle}
            disabled={recTranscribing}
            style={{ ...S.btn("ghost"), padding: "10px 14px", fontSize: 14, background: recRecording ? C.red + "33" : C.surfaceHigh, border: `1px solid ${recRecording ? C.red : C.border}`, color: recRecording ? C.red : C.textDim, whiteSpace: "nowrap" }}
          >{recTranscribing ? "⏳" : recRecording ? "⏹ Stop" : "🎙 Record"}</button>
          <button onClick={() => parseReminder(input)} style={{ ...S.btn("primary"), padding: "10px 20px" }} disabled={parsing || !input.trim()}>
            {parsing ? "Parsing..." : "Set →"}
          </button>
        </div>
        {parseError && <div style={{ fontSize: 12, color: C.red, marginTop: 10 }}>{parseError}</div>}
      </div>

      {/* Upcoming reminders */}
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
          <div style={S.sectionTitle}>Upcoming ({upcoming.length})</div>
        </div>
        {upcoming.length === 0 && <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No upcoming reminders. Set one above.</div>}
        {upcoming.map(r => {
          const ms = r.time - now;
          const isUrgent = ms < 1000 * 60 * 15;
          const isPast = ms <= 0;
          return (
            <div key={r.id} style={{ ...S.row, alignItems: "flex-start" }}>
              <div style={{ width: 4, height: 40, borderRadius: 2, background: isPast ? C.red : isUrgent ? C.amber : C.green, flexShrink: 0, marginTop: 4 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{r.text}</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: C.muted }}>{formatDate(r.time)} at {formatTime(r.time)}</span>
                  <span style={{ ...S.badge(isPast ? C.red : isUrgent ? C.amber : C.blue) }}>
                    {isPast ? "Overdue" : formatCountdown(ms)}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button onClick={() => onDismiss(r.id)} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px" }}>Done ✓</button>
                <button onClick={() => onRemove(r.id)} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px", color: C.muted }}>✕</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Completed */}
      {done.length > 0 && (
        <div style={{ ...S.card, opacity: 0.7 }}>
          <div style={S.sectionTitle}>Completed ({done.length})</div>
          {done.map(r => (
            <div key={r.id} style={{ ...S.row, alignItems: "center" }}>
              <div style={{ fontSize: 13, color: C.muted, textDecoration: "line-through", flex: 1 }}>{r.text}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{formatDate(r.time)} {formatTime(r.time)}</div>
              <button onClick={() => onRemove(r.id)} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px", marginLeft: 10, color: C.muted }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Sandbox note */}
      <div style={{ ...S.card, background: C.surfaceHigh, borderStyle: "dashed" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ fontSize: 20 }}>ℹ️</div>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
            <strong style={{ color: C.textDim }}>Voice notes:</strong> Hold the 🎙 button, speak, then release. Works on iPhone, Android, and all browsers. Transcription takes about 2 seconds via Whisper AI. Try it now — type "remind me in 1 minute" to test the reminder system.
          </div>
        </div>
      </div>
    </div>
  );
}
