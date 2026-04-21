// api/tts.js
// Server-side Text-to-Speech proxy.
//
// Cascade order: Grok TTS → Deepgram Aura (fallback).
// Returns audio/mpeg bytes.
//
// Voice choice:
//   - Client passes { text, voice } where `voice` is one of ALLOWED_VOICES.
//   - Unknown or missing → defaults to "eve" (Grok's original default).
//   - Allowlist prevents arbitrary voice_id injection to xAI.
//
// Grok TTS is ~86% cheaper than Deepgram Aura and supports expressive speech
// tags ([pause], [laugh], <whisper>, etc) that let us add personality later.
//
// No auth gate on TTS — text arrives from the client but the client only
// speaks Claude's output, so content is effectively server-generated.

// Grok's 5 voices as of April 2026. If xAI adds more, extend this list.
// Deepgram Aura fallback uses its own fixed voice (aura-asteria-en) and
// doesn't honour the `voice` parameter — it's a fallback for outages, not
// voice-choice parity. Worth accepting that limitation given Deepgram
// almost never fires if Grok is up.
const ALLOWED_VOICES = new Set(['eve', 'ara', 'leo', 'rex', 'sal']);
const DEFAULT_VOICE = 'eve';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text, voice } = req.body || {};
  if (!text) return res.status(400).json({ error: 'No text provided' });

  const trimmed = String(text).trim();
  if (!trimmed) return res.status(400).json({ error: 'Empty text' });

  // Validate voice — allowlist + default fallback. Never pass raw user input
  // to xAI's voice_id field; an invalid ID would cause Grok to 400 and we'd
  // lose TTS entirely. Any unknown value silently falls back to the default.
  const voiceId = (typeof voice === 'string' && ALLOWED_VOICES.has(voice))
    ? voice
    : DEFAULT_VOICE;

  // ─── GROK TTS (PRIMARY) ────────────────────────────────────────────────
  const grokAudio = await tryGrokTTS(trimmed, voiceId);
  if (grokAudio) {
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', grokAudio.byteLength);
    return res.status(200).send(Buffer.from(grokAudio));
  }

  // ─── DEEPGRAM AURA (FALLBACK) ──────────────────────────────────────────
  const deepgramAudio = await tryDeepgramTTS(trimmed);
  if (deepgramAudio) {
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', deepgramAudio.byteLength);
    return res.status(200).send(Buffer.from(deepgramAudio));
  }

  // Both providers failed — let the client fall through to Web Speech API
  console.error('[tts] all providers failed');
  return res.status(500).json({ error: 'TTS unavailable' });
}

// ─── GROK TTS ─────────────────────────────────────────────────────────────
// xAI's Text-to-Speech endpoint. Returns raw audio bytes (MP3 by default).
// Voice choices: eve, ara, leo, rex, sal (validated by handler above).
//
// Text limit: 15,000 chars per REST request. AI assistant responses rarely
// exceed 500 chars, so this is not a concern for Trade PA's use case.
async function tryGrokTTS(text, voiceId) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    console.log('[tts] XAI_API_KEY not set — skipping Grok');
    return null;
  }

  // Grok's 15k char limit — truncate defensively. Normal replies are way below.
  const safeText = text.length > 14500 ? text.slice(0, 14500) + '...' : text;

  try {
    // Pin to EU-West-1 regional endpoint — same reasoning as in transcribe.js.
    // Keeps the Vercel Dublin function → xAI round trip inside Europe.
    const res = await fetch('https://eu-west-1.api.x.ai/v1/tts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: safeText,
        voice_id: voiceId,
        language: 'en',
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '<no body>');
      console.warn(`[tts] Grok HTTP ${res.status} (voice=${voiceId}): ${errText.slice(0, 300)}`);
      return null;
    }

    const audioBuffer = await res.arrayBuffer();
    if (!audioBuffer || audioBuffer.byteLength === 0) {
      console.warn('[tts] Grok returned empty audio');
      return null;
    }
    return audioBuffer;
  } catch (err) {
    console.warn('[tts] Grok error:', err.message);
    return null;
  }
}

// ─── DEEPGRAM AURA (FALLBACK) ─────────────────────────────────────────────
// Unchanged from previous implementation. aura-asteria-en voice, MP3 encoding.
// Note: this fallback doesn't honour the `voice` parameter — Grok provides all
// voice choice; Deepgram is strictly an outage safety net with a single voice.
async function tryDeepgramTTS(text) {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    console.log('[tts] DEEPGRAM_API_KEY not set — skipping Deepgram');
    return null;
  }

  try {
    const res = await fetch(
      'https://api.deepgram.com/v1/speak?model=aura-asteria-en&encoding=mp3',
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => '<no body>');
      console.warn(`[tts] Deepgram HTTP ${res.status}: ${errText.slice(0, 300)}`);
      return null;
    }

    const audioBuffer = await res.arrayBuffer();
    if (!audioBuffer || audioBuffer.byteLength === 0) {
      console.warn('[tts] Deepgram returned empty audio');
      return null;
    }
    return audioBuffer;
  } catch (err) {
    console.warn('[tts] Deepgram error:', err.message);
    return null;
  }
}
