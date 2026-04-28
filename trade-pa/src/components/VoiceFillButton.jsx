import { C } from "../theme/colors.js";
import { authHeaders } from "../lib/auth.js";

// ─── Generic Voice Fill Button ────────────────────────────────────────────────
// Works with any form — pass fieldDescriptions like:
// "customer (full name), address, type (job type e.g. Boiler Service), value (£ amount), notes"
//
// NOTE: This component currently returns null immediately — voice-fill is now
// handled via the floating mic + context hints. The implementation below the
// early return is preserved verbatim from the original App.jsx as dead code;
// it does not execute. Kept for reference / potential future re-enable.
export function VoiceFillButton({ form, setForm, fieldDescriptions, color }) {
  // Voice-fill via floating mic + context hints now — Dictate button removed from all forms
  return null;
  const accentColor = color || C.amber;

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Prefer formats Grok STT supports (mp4/m4a/ogg) over webm for best accuracy
      const recMimeType = MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4"
                        : MediaRecorder.isTypeSupported("audio/ogg") ? "audio/ogg"
                        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
                        : "audio/mp4";
      const mr = new MediaRecorder(stream, { mimeType: recMimeType });
      chunksRef.current = [];
      mr.ondataavailable = e => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setRecording(false);
        setProcessing(true);
        try {
          const blob = new Blob(chunksRef.current, { type: recMimeType });
          const audioBase64 = await new Promise((resolve) => {
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
          if (!text) { setProcessing(false); return; }

          const res = await fetch("/api/claude", {
            method: "POST",
            headers: await authHeaders(),
            body: JSON.stringify({
              model: "claude-sonnet-4-6",
              max_tokens: 400,
              messages: [{
                role: "user",
                content: `Fill in a form from a voice instruction. 
Form fields: ${fieldDescriptions}
Current values: ${JSON.stringify(form)}
Voice instruction: "${text}"
Return ONLY a JSON object with ONLY the fields to update, using the exact same keys as the form. Example: {"customer":"John Smith","address":"5 High Street"}.
Do not include fields not being changed. Do not include any explanation.`,
              }],
            }),
          });
          const data = await res.json();
          const raw = data.content?.[0]?.text || "";
          const match = raw.match(/\{[\s\S]*\}/);
          if (match) {
            try {
              const updates = JSON.parse(match[0]);
              setForm(f => ({ ...f, ...updates }));
            } catch {}
          }
        } catch (e) { console.error("Voice fill error:", e); }
        setProcessing(false);
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
    } catch (e) { alert("Microphone access denied. Please allow mic access in your browser settings."); }
  };

  const stop = () => { if (mediaRef.current?.state === "recording") mediaRef.current.stop(); };
  const label = processing ? "⏳" : recording ? "⏹ Stop" : "🎙 Dictate";

  return (
    <button
      onClick={recording ? stop : start}
      disabled={processing}
      title={recording ? "Tap to stop recording" : "Fill form by voice"}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "6px 12px", borderRadius: 20, border: "none",
        cursor: processing ? "wait" : "pointer",
        fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 700,
        background: recording ? C.red : processing ? C.amber + "33" : accentColor + "22",
        color: recording ? "#fff" : processing ? C.amber : accentColor,
        transition: "all 0.2s", flexShrink: 0,
      }}
    >{label}</button>
  );
}
