import React, { useState, useEffect, useRef } from "react";
import { C } from "../theme/colors.js";
import { S } from "../theme/styles.js";
import { authHeaders } from "../lib/auth.js";

// ─── Feedback Modal ───────────────────────────────────────────────────────────
// Lets users report bugs, suggest improvements, or share ideas — emailed
// to the Trade PA team via /api/feedback. Includes optional screenshot,
// auto-attaches device/browser/page context for easier debugging.
export function FeedbackModal({ open, onClose, user, brand, currentView }) {
  const [type, setType] = useState("bug");
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState(null); // { dataUrl, filename, size }
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef();

  // Reset when reopened
  useEffect(() => {
    if (open) { setType("bug"); setMessage(""); setScreenshot(null); setSent(false); setError(null); setSending(false); }
  }, [open]);

  const handleFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Screenshot too large — please keep under 5MB."); return; }
    setError(null);
    const reader = new FileReader();
    reader.onload = e => setScreenshot({ dataUrl: e.target.result, filename: file.name || "screenshot.png", size: file.size });
    reader.readAsDataURL(file);
  };

  // Allow paste-to-upload (Cmd/Ctrl+V) when modal is open
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      const items = e.clipboardData?.items || [];
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) handleFile(file);
          break;
        }
      }
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [open]);

  const submit = async () => {
    if (!message.trim()) { setError("Please describe what happened."); return; }
    setSending(true); setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          type,
          message: message.trim(),
          screenshot: screenshot ? { dataUrl: screenshot.dataUrl, filename: screenshot.filename } : null,
          context: {
            userId: user?.id || null,
            userEmail: brand?.email || user?.email || null,
            tradingName: brand?.tradingName || null,
            currentView: currentView || null,
            url: window.location.href,
            userAgent: navigator.userAgent,
            screenSize: `${window.innerWidth}×${window.innerHeight}`,
            timestamp: new Date().toISOString(),
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server returned ${res.status}`);
      }
      setSent(true);
      setTimeout(() => onClose(), 1800);
    } catch (e) {
      setError("Couldn't send: " + (e.message || "unknown error") + ". You can email support@tradespa.co.uk directly.");
    }
    setSending(false);
  };

  if (!open) return null;

  const types = [
    { k: "bug",         label: "Bug",         icon: "🐛", desc: "Something is broken" },
    { k: "improvement", label: "Improvement", icon: "💡", desc: "Could be better" },
    { k: "idea",        label: "Idea",        icon: "✨", desc: "New feature suggestion" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 400, padding: 16, paddingTop: "max(40px, env(safe-area-inset-top, 40px))", overflowY: "auto" }}>
      <div style={{ ...S.card, maxWidth: 560, width: "100%", borderRadius: 14, overflow: "hidden" }}>
        {sent ? (
          <div style={{ textAlign: "center", padding: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.green, marginBottom: 6 }}>Thanks for your feedback!</div>
            <div style={{ fontSize: 12, color: C.muted }}>We've received it and will take a look.</div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Send Feedback</div>
              <button aria-label="Close" onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
            </div>

            <div style={{ fontSize: 12, color: C.muted, marginBottom: 14, lineHeight: 1.5 }}>
              Help us make Trade PA better. Bugs, ideas and improvements all welcome.
            </div>

            {/* Type picker */}
            <label style={S.label}>What kind of feedback?</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {types.map(t => {
                const active = type === t.k;
                return (
                  <button
                    key={t.k}
                    onClick={() => setType(t.k)}
                    style={{
                      flex: 1, padding: "12px 8px", borderRadius: 10,
                      border: `2px solid ${active ? C.amber : C.border}`,
                      background: active ? "rgba(245,158,11,0.12)" : C.surfaceHigh,
                      color: active ? C.amber : C.text,
                      cursor: "pointer", fontFamily: "'DM Mono',monospace",
                      fontWeight: active ? 700 : 500, fontSize: 12,
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                      transition: "all 0.15s",
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{t.icon}</span>
                    <span>{t.label}</span>
                    <span style={{ fontSize: 10, color: C.muted, fontWeight: 400 }}>{t.desc}</span>
                  </button>
                );
              })}
            </div>

            {/* Message */}
            <label style={S.label}>
              {type === "bug" ? "What happened? What were you trying to do?"
               : type === "improvement" ? "What could be better?"
               : "Tell us your idea"}
            </label>
            <textarea
              style={{ ...S.input, resize: "vertical", minHeight: 110, marginBottom: 16 }}
              placeholder={
                type === "bug"   ? "e.g. Tapped 'Send invoice' but nothing happened. I was on the Glenn Mackay invoice."
                : type === "improvement" ? "e.g. The customer picker would be quicker if I could search by phone number too."
                : "e.g. It would be great if Trade PA could automatically chase overdue invoices via SMS."
              }
              value={message}
              onChange={e => setMessage(e.target.value)}
            />

            {/* Screenshot */}
            <label style={S.label}>Add a screenshot (optional)</label>
            <div style={{ marginBottom: 16 }}>
              {screenshot ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, background: C.surfaceHigh, borderRadius: 8, border: `1px solid ${C.border}` }}>
                  <img src={screenshot.dataUrl} alt="screenshot preview" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{screenshot.filename}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{(screenshot.size / 1024).toFixed(0)}KB</div>
                  </div>
                  <button onClick={() => setScreenshot(null)} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px" }}>Remove</button>
                </div>
              ) : (
                <div>
                  <button
                    onClick={() => fileRef.current?.click()}
                    style={{ ...S.btn("ghost"), width: "100%", justifyContent: "center", padding: "14px", fontSize: 12 }}
                  >
                    📎 Choose file or paste image (Ctrl+V)
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={e => handleFile(e.target.files?.[0])}
                  />
                </div>
              )}
            </div>

            {/* Auto-context note */}
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 14, padding: "8px 10px", background: C.surfaceHigh, borderRadius: 10, lineHeight: 1.5 }}>
              We'll automatically include: the page you're on, your device & browser, and your account email — so we don't have to ask.
            </div>

            {error && (
              <div style={{ fontSize: 12, color: C.red, marginBottom: 12, padding: "8px 12px", background: "rgba(239,68,68,0.1)", borderRadius: 10, border: `1px solid ${C.red}44` }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={onClose} style={S.btn("ghost")} disabled={sending}>Cancel</button>
              <button onClick={submit} style={S.btn("primary")} disabled={sending || !message.trim()}>
                {sending ? "Sending..." : "Send feedback →"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
