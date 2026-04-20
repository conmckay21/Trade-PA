// api/transcribe.js
// Server-side transcription endpoint — keeps API keys off the client.
//
// Cascade order: Grok STT (primary) → Deepgram (fallback) → Whisper (tertiary).
// Returns the first successful transcript. If any provider errors or returns
// empty text, we try the next one — users never see partial failures.
//
// ENFORCEMENT LAYER (unchanged from previous version):
// - Requires Authorization: Bearer <Supabase access token>
// - NO rate limiting or allowance check: tap-to-talk is "never capped" per pricing.

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function getUserIdFromRequest(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ─── AUTH GATE ───────────────────────────────────────────────────────────
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ error: 'unauthorised', message: 'Valid auth token required.' });
  }

  try {
    const { audio, mimeType = 'audio/webm' } = req.body;
    if (!audio) return res.status(400).json({ error: 'No audio provided' });

    const audioBuffer = Buffer.from(audio, 'base64');

    // ─── PROVIDER CASCADE ──────────────────────────────────────────────────
    // Each attempt returns { text } on success or throws / returns null on failure.
    // We log which provider succeeded for production monitoring via Sentry.

    // 1. GROK STT (primary) — best entity recognition accuracy per xAI benchmarks
    const grokResult = await tryGrokSTT(audioBuffer, mimeType);
    if (grokResult !== null) {
      return res.status(200).json({ text: grokResult, provider: 'grok' });
    }

    // 2. DEEPGRAM (fallback) — proven format support + UK accent tuning
    const deepgramResult = await tryDeepgram(audioBuffer, mimeType);
    if (deepgramResult !== null) {
      return res.status(200).json({ text: deepgramResult, provider: 'deepgram' });
    }

    // 3. WHISPER (tertiary) — last resort
    const whisperResult = await tryWhisper(audioBuffer, mimeType);
    if (whisperResult !== null) {
      return res.status(200).json({ text: whisperResult, provider: 'whisper' });
    }

    // All three providers failed — return graceful empty transcript
    console.error('[transcribe] all providers failed');
    return res.status(200).json({ text: '', provider: 'none' });

  } catch (err) {
    console.error('[transcribe] fatal error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ─── GROK STT ─────────────────────────────────────────────────────────────
// xAI's Speech-to-Text endpoint (launched April 2026). Uses multipart/form-data.
// Docs: https://docs.x.ai/developers/model-capabilities/audio/speech-to-text
//
// Note: xAI officially supports WAV, MP3, OGG, Opus, FLAC, AAC, MP4, M4A, MKV.
// webm is NOT officially listed but is often accepted (webm is typically Opus-in-Matroska).
// If Grok rejects the format, we fall through to Deepgram which handles webm natively.
async function tryGrokSTT(audioBuffer, mimeType) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    console.log('[transcribe] XAI_API_KEY not set — skipping Grok');
    return null;
  }

  try {
    // Choose a reasonable filename extension from the incoming mimeType.
    // Container formats Grok auto-detects — the extension is mostly cosmetic
    // but using a recognised one helps edge cases.
    const ext = mimeTypeToExtension(mimeType);
    const filename = `recording.${ext}`;

    // Build multipart form body. Native FormData (available in Node 18+).
    const form = new FormData();
    form.append('language', 'en');              // enables Inverse Text Normalization
    form.append('format', 'true');              // "£1,240" instead of "one thousand two hundred forty pounds"
    // `file` must be LAST per xAI docs — critical
    form.append('file', new Blob([audioBuffer], { type: mimeType }), filename);

    const res = await fetch('https://api.x.ai/v1/stt', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        // Content-Type is set automatically by fetch for FormData (with correct boundary)
      },
      body: form,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '<no body>');
      console.warn(`[transcribe] Grok STT HTTP ${res.status}: ${errText.slice(0, 300)}`);
      return null;
    }

    const data = await res.json();
    const text = (data?.text || '').trim();
    if (!text) {
      console.log('[transcribe] Grok returned empty text — falling through');
      return null;
    }
    return text;
  } catch (err) {
    console.warn('[transcribe] Grok STT error:', err.message);
    return null;
  }
}

// ─── DEEPGRAM (FALLBACK) ──────────────────────────────────────────────────
// Unchanged from the prior primary implementation — nova-2 with en-GB hint.
// Kept as fallback because Grok may reject webm audio from some clients.
async function tryDeepgram(audioBuffer, mimeType) {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    console.log('[transcribe] DEEPGRAM_API_KEY not set — skipping Deepgram');
    return null;
  }

  try {
    const res = await fetch(
      'https://api.deepgram.com/v1/listen?model=nova-2&language=en-GB&smart_format=true&punctuate=true',
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': mimeType,
        },
        body: audioBuffer,
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => '<no body>');
      console.warn(`[transcribe] Deepgram HTTP ${res.status}: ${errText.slice(0, 300)}`);
      return null;
    }

    const data = await res.json();
    const text = (data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '').trim();
    if (!text) {
      console.log('[transcribe] Deepgram returned empty text — falling through');
      return null;
    }
    return text;
  } catch (err) {
    console.warn('[transcribe] Deepgram error:', err.message);
    return null;
  }
}

// ─── WHISPER (TERTIARY FALLBACK) ─────────────────────────────────────────
// OpenAI Whisper as last resort. Slower and less accurate on accents than
// Deepgram, but works when nothing else does.
async function tryWhisper(audioBuffer, mimeType) {
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) {
    console.log('[transcribe] OPENAI_API_KEY not set — skipping Whisper');
    return null;
  }

  try {
    const ext = mimeTypeToExtension(mimeType);
    const form = new FormData();
    form.append('model', 'whisper-1');
    form.append('language', 'en');
    form.append('file', new Blob([audioBuffer], { type: mimeType }), `audio.${ext}`);

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openAiKey}` },
      body: form,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '<no body>');
      console.warn(`[transcribe] Whisper HTTP ${res.status}: ${errText.slice(0, 300)}`);
      return null;
    }

    const data = await res.json();
    const text = (data?.text || '').trim();
    if (!text) return null;
    return text;
  } catch (err) {
    console.warn('[transcribe] Whisper error:', err.message);
    return null;
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────
function mimeTypeToExtension(mimeType) {
  const mt = String(mimeType || '').toLowerCase();
  if (mt.includes('mp4')) return 'mp4';
  if (mt.includes('m4a')) return 'm4a';
  if (mt.includes('ogg')) return 'ogg';
  if (mt.includes('webm')) return 'webm';
  if (mt.includes('wav')) return 'wav';
  if (mt.includes('mp3') || mt.includes('mpeg')) return 'mp3';
  if (mt.includes('flac')) return 'flac';
  if (mt.includes('aac')) return 'aac';
  return 'webm'; // sensible default — most browsers record this
}
