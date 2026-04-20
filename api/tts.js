// api/tts.js
// Server-side Text-to-Speech proxy.
//
// Cascade order: Grok TTS (Eve voice) → Deepgram Aura (fallback).
// Returns audio/mpeg bytes — same contract as before, so client code unchanged.
//
// Grok TTS is ~86% cheaper than Deepgram Aura and supports expressive speech
// tags ([pause], [laugh], <whisper>, etc) that let us add personality later.
//
// No auth gate on TTS (same as previous version) — text arrives from the
// client but the client only speaks Claude's output, so it's server-generated.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });

  const trimmed = String(text).trim();
  if (!trimmed) return res.status(400).json({ error: 'Empty text' });

  // ─── GROK TTS (PRIMARY) ────────────────────────────────────────────────
  const grokAudio = await tryGrokTTS(trimmed);
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
// Voice choice: "eve" — energetic/upbeat female, xAI's default.
//
// Text limit: 15,000 chars per REST request. AI assistant responses rarely
// exceed 500 chars, so this is not a concern for Trade PA's use case.
async function tryGrokTTS(text) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    console.log('[tts] XAI_API_KEY not set — skipping Grok');
    return null;
  }

  // Grok's 15k char limit — truncate defensively. Normal replies are way below.
  const safeText = text.length > 14500 ? text.slice(0, 14500) + '...' : text;

  try {
    const res = await fetch('https://api.x.ai/v1/tts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: safeText,
        voice_id: 'eve',
        language: 'en',
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '<no body>');
      console.warn(`[tts] Grok HTTP ${res.status}: ${errText.slice(0, 300)}`);
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
