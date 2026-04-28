import { C } from "../theme/colors.js";
import { authHeaders } from "../lib/auth.js";

// ─── Mic Button for Modals ────────────────────────────────────────────────────
// NOTE: This component currently returns null immediately — the inline mic
// button has been removed from modal forms in favour of the floating mic +
// voice-fill via context hints. The implementation below the early return
// is preserved verbatim from the original App.jsx as dead code; it does not
// execute. Refer to FieldMic / VoiceFillButton for the active path.
export function MicButton({ form, setForm, accentColor }) {
  // Voice-fill via floating mic — inline mic button removed
  return null;

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

          // Ask Claude to interpret the voice and return updated fields
          const res = await fetch("/api/claude", {
            method: "POST",
            headers: await authHeaders(),
            body: JSON.stringify({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 400,
              messages: [{
                role: "user",
                content: `You are helping fill in an invoice/quote form. Current form: ${JSON.stringify({ customer: form.customer, email: form.email, address: form.address, amount: form.amount, desc: form.desc, jobRef: form.jobRef, poNumber: form.poNumber || "", due: form.due })}.
Voice instruction: "${text}"
Return ONLY a JSON object with ONLY the fields to update (use exact same keys). Example: {"customer":"John Smith","amount":"450"}.
Do not include fields that aren't being changed.`,
              }],
            }),
          });
          const data = await res.json();
          const raw = data.content?.[0]?.text || "";
          const match = raw.match(/\{[\s\S]*\}/);
          if (match) {
            const updates = JSON.parse(match[0]);
            setForm(f => ({ ...f, ...updates }));
          }
        } catch (e) { console.error("Mic error:", e); }
        setProcessing(false);
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
    } catch (e) { console.error("Mic access denied"); }
  };

  const stop = () => { if (mediaRef.current?.state === "recording") mediaRef.current.stop(); };

  const label = processing ? "⏳" : recording ? "⏹" : "🎙";
  const color = recording ? C.red : processing ? C.amber : C.muted;

  return (
    <button
      onClick={recording ? stop : start}
      disabled={processing}
      title={recording ? "Tap to stop" : "Voice edit"}
      style={{ background: recording ? C.red + "22" : "none", border: `1px solid ${recording ? C.red + "66" : C.border}`, borderRadius: 10, color, cursor: processing ? "wait" : "pointer", fontSize: 15, padding: "4px 8px", transition: "all 0.2s", flexShrink: 0 }}
    >{label}</button>
  );
}
