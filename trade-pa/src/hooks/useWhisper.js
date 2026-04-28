import { useState, useRef } from "react";
import { authHeaders } from "../lib/auth.js";

// ─── Whisper Voice Recording Hook ─────────────────────────────────────────────
export function useWhisper(onTranscript, onSilence) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const silenceCheckRef = useRef(null);
  const sessionIdRef = useRef(0); // incremented each recording — prevents stale onstop

  const clearSilenceDetection = () => {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (silenceCheckRef.current) { cancelAnimationFrame(silenceCheckRef.current); silenceCheckRef.current = null; }
    if (audioContextRef.current) { try { audioContextRef.current.close(); } catch(e) {} audioContextRef.current = null; }
  };

  const startSilenceDetection = (stream, onSilenceDetected, silenceDuration = 2500) => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      const source = ctx.createMediaStreamSource(stream);
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      let silenceStart = null;
      // RMS threshold — 50 handles real-world ambient noise (dog, TV, traffic, kitchen).
      // Lower values cause ambient noise to be mistaken for speech, preventing silence detection.
      const SILENCE_THRESHOLD = 70;
      const graceMs = silenceDuration >= 3000 ? 2000 : 1500;
      const check = () => {
        if (!analyserRef.current) return;
        analyser.getByteFrequencyData(data);
        const rms = Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length);
        if (rms < SILENCE_THRESHOLD) {
          if (!silenceStart) silenceStart = Date.now();
          else if (Date.now() - silenceStart > silenceDuration) {
            clearSilenceDetection();
            onSilenceDetected();
            return;
          }
        } else {
          silenceStart = null;
        }
        silenceCheckRef.current = requestAnimationFrame(check);
      };
      setTimeout(() => { silenceCheckRef.current = requestAnimationFrame(check); }, graceMs);
    } catch(e) { console.warn("Silence detection unavailable:", e.message); }
  };

  const startRecording = async (withSilenceDetect = false, silenceDuration = 2500) => {
    try {
      // Increment session ID first — any onstop from old recorder will see mismatched ID and bail
      const mySession = ++sessionIdRef.current;

      // Clean up old stream/recorder — stopping tracks may fire old onstop async,
      // but session ID mismatch means it will exit immediately without clearing anything
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        const old = mediaRecorderRef.current;
        mediaRecorderRef.current = null;
        try { old.stop(); } catch(e) {}
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // Prefer formats Grok STT officially supports (mp4/m4a/ogg) over webm.
      // Grok falls back to Deepgram if format is rejected, but picking a supported
      // format maximises Grok hit rate and transcription quality.
      const mimeType = MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4"
                     : MediaRecorder.isTypeSupported("audio/ogg") ? "audio/ogg"
                     : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
                     : "audio/mp4"; // last-resort default (matches prior Safari branch)
      const recorder = new MediaRecorder(stream, { mimeType });
      // Each session has its own chunk array — immune to cross-session contamination
      const sessionChunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) sessionChunks.push(e.data);
      };

      recorder.onstop = async () => {
        // If a newer session has started, ignore this onstop entirely
        if (mySession !== sessionIdRef.current) return;

        clearSilenceDetection();
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
        const blob = new Blob(sessionChunks, { type: mimeType });
        if (blob.size < 500) {
          setTranscribing(false);
          if (onSilence) onSilence();
          return;
        }
        setTranscribing(true);
        try {
          const audioBase64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(",")[1]);
            reader.readAsDataURL(blob);
          });
          const res = await fetch("/api/transcribe", {
            method: "POST",
            headers: await authHeaders(),
            body: JSON.stringify({ audio: audioBase64, mimeType }),
          });
          const data = await res.json();
          if (data.text?.trim()) {
            onTranscript(data.text.trim());
          } else {
            if (onSilence) onSilence();
          }
        } catch (e) {
          console.error("Whisper:", e);
          if (onSilence) onSilence();
        }
        setTranscribing(false);
      };

      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setRecording(true);

      if (withSilenceDetect) {
        startSilenceDetection(stream, () => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
          }
          setRecording(false);
        }, silenceDuration);
      }
    } catch (err) {
      console.error("Mic:", err);
      if (err.name === "NotAllowedError") {
        alert("Microphone blocked.\n\nOn iPhone: Settings → Safari → Microphone → Allow your site.\n\nThen reload and try again.");
      } else if (withSilenceDetect) {
        // In hands-free: audio session briefly locked after TTS — silently retry
        setTimeout(() => { if (onSilence) onSilence(); }, 1500);
      } else {
        alert(`Mic error: ${err.message}`);
      }
    }
  };

  const stopRecording = () => {
    clearSilenceDetection();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const toggle = (withSilenceDetect = true) => {
    if (recording) stopRecording();
    else startRecording(withSilenceDetect);
  };

  return { recording, transcribing, toggle, startRecording, stopRecording };
}
