// ─── CustomerForm — domestic / single-contact customer form ────────────
// Extracted verbatim from App.jsx during P7 sub-batch C (28 Apr 2026).
import React, { useState, useEffect, useRef } from "react";
import { C } from "../../theme/colors.js";
import { authHeaders } from "../../lib/auth.js";
import FieldMic from "../../components/FieldMic.jsx";

export function CustomerForm({ form, set, onSave, onCancel }) {
  // Per-field mic state: { [fieldKey]: "idle" | "listening" | "populated" }
  const [micStates, setMicStates] = React.useState({});
  const recRef = React.useRef({});
  const chunksRef = React.useRef({});

  // Inject pulse keyframes once for the listening dot animation
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById("tradepa-pulse-kf")) return;
    const s = document.createElement("style");
    s.id = "tradepa-pulse-kf";
    s.textContent = `@keyframes tradepa-pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.4; transform:scale(1.4); } }`;
    document.head.appendChild(s);
  }, []);

  // Field-specific normalisation prompt for Claude
  const normalisePrompt = (fieldKey, rawTranscript) => {
    const instructions = {
      name: `Clean up a dictated customer name. Input: "${rawTranscript}". Return ONLY the name as title-case (e.g. "John Smith"), nothing else.`,
      phone: `Extract a UK phone number from dictation. Input: "${rawTranscript}". Return ONLY the number formatted like "07700 900123" or "01234 567890", nothing else. If no number, return an empty string.`,
      address: `Clean up a dictated UK address. Input: "${rawTranscript}". Return ONLY the address formatted with line breaks between parts (e.g. "5 High Street\\nGuildford\\nGU1 3AA"), nothing else.`,
      email: `Extract an email address from dictation. Input: "${rawTranscript}". Return ONLY the email (lowercase, no spaces), nothing else. If no email, return an empty string.`,
      notes: `Clean up dictated notes about a customer. Input: "${rawTranscript}". Return the notes in clear prose, preserving all details. Nothing else — no preamble.`,
    };
    return instructions[fieldKey] || `Clean up this dictation: "${rawTranscript}". Return only the cleaned text.`;
  };

  const stopAllMics = () => {
    Object.keys(recRef.current).forEach(k => {
      const mr = recRef.current[k];
      if (mr?.state === "recording") mr.stop();
    });
  };

  const startMic = async (fieldKey) => {
    stopAllMics();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Prefer formats Grok STT supports (mp4/m4a/ogg) over webm for best accuracy
      const recMimeType = MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4"
                        : MediaRecorder.isTypeSupported("audio/ogg") ? "audio/ogg"
                        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
                        : "audio/mp4";
      const mr = new MediaRecorder(stream, { mimeType: recMimeType });
      chunksRef.current[fieldKey] = [];
      mr.ondataavailable = (e) => chunksRef.current[fieldKey].push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        try {
          const blob = new Blob(chunksRef.current[fieldKey], { type: recMimeType });
          const audioBase64 = await new Promise(resolve => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(",")[1]);
            reader.readAsDataURL(blob);
          });
          const transcribeRes = await fetch("/api/transcribe", {
            method: "POST",
            headers: await authHeaders(),
            body: JSON.stringify({ audio: audioBase64, mimeType: recMimeType }),
          });
          const { text } = await transcribeRes.json();
          if (!text) {
            setMicStates(s => ({ ...s, [fieldKey]: "idle" }));
            return;
          }
          const claudeRes = await fetch("/api/claude", {
            method: "POST",
            headers: await authHeaders(),
            body: JSON.stringify({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 200,
              messages: [{ role: "user", content: normalisePrompt(fieldKey, text) }],
            }),
          });
          const data = await claudeRes.json();
          const normalised = (data.content?.[0]?.text || text).trim();
          set(fieldKey)({ target: { value: normalised } });
          setMicStates(s => ({ ...s, [fieldKey]: "populated" }));
          setTimeout(() => {
            setMicStates(s => ({ ...s, [fieldKey]: "idle" }));
          }, 2000);
        } catch (err) {
          console.error("Field mic error:", err);
          setMicStates(s => ({ ...s, [fieldKey]: "idle" }));
        }
      };
      mr.start();
      recRef.current[fieldKey] = mr;
      setMicStates(s => ({ ...s, [fieldKey]: "listening" }));
    } catch (err) {
      console.error("Microphone access denied:", err);
      setMicStates(s => ({ ...s, [fieldKey]: "idle" }));
    }
  };

  const handleMicTap = (fieldKey) => {
    const state = micStates[fieldKey] || "idle";
    if (state === "listening") {
      const mr = recRef.current[fieldKey];
      if (mr?.state === "recording") mr.stop();
    } else {
      startMic(fieldKey);
    }
  };

  const hasAnyValue = !!(form.name || form.phone || form.address || form.email || form.notes);
  const handleCancel = () => {
    if (hasAnyValue && !window.confirm("Discard customer details?")) return;
    onCancel();
  };

  // Reordered: Name → Phone → Address → Email → Notes
  const fields = [
    { k: "name",    l: "Full Name",     p: "e.g. John Smith",                       required: true },
    { k: "phone",   l: "Phone Number",  p: "e.g. 07700 900123",                     inputMode: "tel" },
    { k: "address", l: "Address",       p: "e.g. 5 High Street, Guildford, GU1 3AA" },
    { k: "email",   l: "Email Address", p: "e.g. john@email.com",                   inputMode: "email" },
  ];

  // ─── Mockup-aesthetic styles (theme-aware via C palette) ──────────────
  const labelRowStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 2px",
    marginBottom: 8,
    minHeight: 16,
  };
  const labelStyle = {
    fontFamily: "'DM Mono', monospace",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: C.textDim,
    fontWeight: 500,
  };
  const inputBase = {
    width: "100%",
    background: C.surfaceHigh,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    color: C.text,
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 16, // 16px minimum prevents iOS Safari auto-zoom on focus (under 16px triggers it)
    padding: "13px 14px",
    transition: "border-color 180ms ease, box-shadow 180ms ease",
    outline: "none",
    boxSizing: "border-box",
  };
  const inputStyleFor = (state) => {
    if (state === "listening") {
      return { ...inputBase, borderColor: C.amber, boxShadow: `0 0 0 3px ${C.amber}1a` };
    }
    if (state === "populated") {
      return { ...inputBase, borderColor: `${C.green}66` };
    }
    return inputBase;
  };
  const stateBadge = (state) => {
    if (state === "listening") {
      return (
        <span style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: "0.10em",
          fontWeight: 600,
          padding: "3px 7px",
          borderRadius: 4,
          color: C.amber,
          background: `${C.amber}1a`,
          border: `1px solid ${C.amber}4d`,
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          lineHeight: 1,
        }}>
          <span style={{
            display: "inline-block",
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: C.amber,
            animation: "tradepa-pulse 1.2s ease-in-out infinite",
          }} />
          listening
        </span>
      );
    }
    if (state === "populated") {
      return (
        <span style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: "0.10em",
          fontWeight: 600,
          padding: "3px 7px",
          borderRadius: 4,
          color: C.green,
          background: `${C.green}1f`,
          border: `1px solid ${C.green}4d`,
          lineHeight: 1,
        }}>
          ✓ filled
        </span>
      );
    }
    return null;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {fields.map(({ k, l, p, required, inputMode }) => {
        const state = micStates[k] || "idle";
        return (
          <div key={k} style={{ display: "flex", flexDirection: "column" }}>
            <div style={labelRowStyle}>
              <span style={labelStyle}>
                {l}
                {required && <span style={{ color: C.amber, marginLeft: 4 }}>*</span>}
              </span>
              {stateBadge(state)}
            </div>
            <div style={{ display: "flex", alignItems: "stretch", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <input
                  style={inputStyleFor(state)}
                  placeholder={p}
                  value={form[k] || ""}
                  onChange={set(k)}
                  inputMode={inputMode}
                />
              </div>
              <FieldMic
                state={state}
                onTap={() => handleMicTap(k)}
                ariaLabel={`Dictate ${l.toLowerCase()}`}
              />
            </div>
          </div>
        );
      })}

      {/* Notes — textarea, mic aligned to top */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={labelRowStyle}>
          <span style={labelStyle}>Notes</span>
          {stateBadge(micStates.notes || "idle")}
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <textarea
              style={{ ...inputStyleFor(micStates.notes || "idle"), resize: "vertical", minHeight: 80, fontFamily: "'DM Sans', sans-serif" }}
              placeholder="e.g. Prefers morning appointments, gate code 1234..."
              value={form.notes || ""}
              onChange={set("notes")}
            />
          </div>
          <FieldMic
            state={micStates.notes || "idle"}
            onTap={() => handleMicTap("notes")}
            ariaLabel="Dictate notes"
          />
        </div>
      </div>

      {/* Action row — anchored to modal bottom via negative margins */}
      {/* (parent modal body has padding: 20, so -20 negative margins extend the row edge-to-edge) */}
      <div style={{
        display: "flex",
        gap: 10,
        marginTop: 4,
        marginLeft: -20,
        marginRight: -20,
        marginBottom: -20,
        padding: "16px 20px 20px",
        borderTop: `1px solid ${C.border}66`,
        background: C.surface,
      }}>
        <button
          onClick={handleCancel}
          style={{
            flex: 1,
            height: 48,
            borderRadius: 10,
            background: "transparent",
            border: `1px solid ${C.border}`,
            color: C.textDim,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 150ms ease",
            outline: "none",
          }}
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={!form.name}
          style={{
            flex: 1,
            height: 48,
            borderRadius: 10,
            background: !form.name ? C.surfaceHigh : C.amber,
            border: "none",
            color: !form.name ? C.muted : "#000",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 15,
            fontWeight: 600,
            cursor: !form.name ? "not-allowed" : "pointer",
            opacity: !form.name ? 0.6 : 1,
            transition: "all 150ms ease",
            outline: "none",
          }}
        >
          Save customer →
        </button>
      </div>
    </div>
  );
}
