// api/tts.js
// Server-side Text-to-Speech proxy — streaming version.
//
// Cascade order: Grok TTS (Eve voice) → Deepgram Aura (fallback).
// Returns audio/mpeg bytes streamed directly from the upstream provider.
//
// STREAMING REFACTOR (20 Apr 2026):
// Previously this buffered the entire upstream MP3 into memory via
// `await res.arrayBuffer()` before replying, adding 200-500ms of idle
// wall-time on every call while the Vercel → client link sat empty.
// Now we peek the first chunk to confirm the provider returned real audio,
// then pipe the remainder straight through to the client. First-byte
// latency drops from "upstream total time" to "upstream first-byte + one
// network hop".
//
// Client contract is unchanged: still audio/mpeg, still POST { text }.
// Content-Length is now absent (we don't know total length upfront when
// streaming) — Node auto-sets Transfer-Encoding: chunked which every
// modern client handles transparently.
//
// For iOS Safari PWA (no MediaSource, can't progressively play a loading
// blob) this doesn't change perceived first-sound — the client still does
// `await res.arrayBuffer()` on its side. But on Chrome Android (MediaSource)
// and native builds (AVPlayer/ExoPlayer consuming as a URL), the client
// CAN play progressively and streaming is unlocked end-to-end.
//
// X-Accel-Buffering: no tells any nginx-style proxy in front to forward
// bytes as they arrive rather than buffering the full response.
// X-TTS-Provider: grok|deepgram makes failure modes debuggable without logs.
//
// No auth gate on TTS (same as previous) — text arrives from the client
// but the client only speaks Claude's output, so it's server-generated.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });

  const trimmed = String(text).trim();
  if (!trimmed) return res.status(400).json({ error: 'Empty text' });

  // ─── GROK TTS (PRIMARY) ────────────────────────────────────────────────
  const grokStream = await tryGrokTTS(trimmed);
  if (grokStream) {
    setAudioHeaders(res, 'grok');
    return pipeAndClose(grokStream, res);
  }

  // ─── DEEPGRAM AURA (FALLBACK) ──────────────────────────────────────────
  const deepgramStream = await tryDeepgramTTS(trimmed);
  if (deepgramStream) {
    setAudioHeaders(res, 'deepgram');
    return pipeAndClose(deepgramStream, res);
  }

  // Both providers failed — client falls through to Web Speech API.
  console.error('[tts] all providers failed');
  return res.status(500).json({ error: 'TTS unavailable' });
}

// ─── HEADER SETUP ─────────────────────────────────────────────────────────
// Must be called BEFORE the first byte of body is written. Once we start
// streaming, status and headers are frozen.
function setAudioHeaders(res, provider) {
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('X-Accel-Buffering', 'no');    // nginx/proxy: forward bytes immediately
  res.setHeader('X-TTS-Provider', provider);    // debug: which provider answered
  res.setHeader('Cache-Control', 'no-store');   // speech is one-shot
  res.status(200);
}

// ─── PIPE HELPER ──────────────────────────────────────────────────────────
// Forwards { firstChunk, reader } into the Node response. First chunk has
// already been consumed upstream to verify non-empty audio; we write that,
// then drain the rest. If the upstream stream errors mid-flow, we end the
// response gracefully — the client gets a partial MP3 and its own error
// handling (Stage 5 abortSpeech path) cleans up.
async function pipeAndClose({ firstChunk, reader }, res) {
  try {
    if (firstChunk && firstChunk.byteLength > 0) res.write(Buffer.from(firstChunk));
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.byteLength > 0) res.write(Buffer.from(value));
    }
    res.end();
  } catch (err) {
    // Headers already sent — can't return an error status, just close cleanly.
    console.warn('[tts] pipe error after headers sent:', err.message);
    try { res.end(); } catch {}
  }
}

// ─── GROK TTS ─────────────────────────────────────────────────────────────
// xAI's Text-to-Speech endpoint. Returns raw MP3 bytes streamed.
// Voice: "eve" — energetic/upbeat female, xAI's default.
// Text limit: 15,000 chars per REST request.
//
// Returns { firstChunk, reader } on success, null on failure so the caller
// can fall through to Deepgram. We peek the first chunk before committing
// to streaming so that an empty-body 200 OK from xAI (rare but possible)
// falls through to the backup provider instead of silently sending zero
// bytes to the client.
async function tryGrokTTS(text) {
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
    const upstream = await fetch('https://eu-west-1.api.x.ai/v1/tts', {
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

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '<no body>');
      console.warn(`[tts] Grok HTTP ${upstream.status}: ${errText.slice(0, 300)}`);
      return null;
    }

    if (!upstream.body) {
      console.warn('[tts] Grok returned no response body');
      return null;
    }

    const reader = upstream.body.getReader();
    const first = await reader.read();
    if (first.done || !first.value || first.value.byteLength === 0) {
      console.warn('[tts] Grok returned empty audio stream');
      try { reader.cancel(); } catch {}
      return null;
    }
    return { firstChunk: first.value, reader };
  } catch (err) {
    console.warn('[tts] Grok error:', err.message);
    return null;
  }
}

// ─── DEEPGRAM AURA (FALLBACK) ─────────────────────────────────────────────
// aura-asteria-en voice, MP3 encoding. Same streaming + first-chunk-peek
// pattern as Grok so failure modes are symmetrical.
async function tryDeepgramTTS(text) {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    console.log('[tts] DEEPGRAM_API_KEY not set — skipping Deepgram');
    return null;
  }

  try {
    const upstream = await fetch(
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

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '<no body>');
      console.warn(`[tts] Deepgram HTTP ${upstream.status}: ${errText.slice(0, 300)}`);
      return null;
    }

    if (!upstream.body) {
      console.warn('[tts] Deepgram returned no response body');
      return null;
    }

    const reader = upstream.body.getReader();
    const first = await reader.read();
    if (first.done || !first.value || first.value.byteLength === 0) {
      console.warn('[tts] Deepgram returned empty audio stream');
      try { reader.cancel(); } catch {}
      return null;
    }
    return { firstChunk: first.value, reader };
  } catch (err) {
    console.warn('[tts] Deepgram error:', err.message);
    return null;
  }
}
