// api/transcribe.js
// Server-side transcription endpoint — keeps API keys off the client
// Accepts audio as base64, calls Deepgram with Whisper fallback.
// Deepgram preferred for UK/Irish/regional accent accuracy.
//
// ENFORCEMENT LAYER (added April 2026):
// - Requires Authorization: Bearer <Supabase access token>
// - NO rate limiting or allowance check: tap-to-talk is "never capped" per pricing.
// - Handsfree time tracking happens elsewhere (client-side session timer,
//   and eventually a handsfree-heartbeat endpoint).

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
  // ────────────────────────────────────────────────────────────────────────

  try {
    const { audio, mimeType = 'audio/webm' } = req.body;
    if (!audio) return res.status(400).json({ error: 'No audio provided' });

    const audioBuffer = Buffer.from(audio, 'base64');
    const deepgramKey = process.env.DEEPGRAM_API_KEY;

    if (!deepgramKey) {
      return await transcribeWithWhisper(audioBuffer, mimeType, res);
    }

    const dgRes = await fetch(
      'https://api.deepgram.com/v1/listen?model=nova-2&language=en-GB&smart_format=true&punctuate=true',
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${deepgramKey}`,
          'Content-Type': mimeType,
        },
        body: audioBuffer,
      }
    );

    if (!dgRes.ok) {
      const errText = await dgRes.text();
      console.error('Deepgram error:', errText);
      return await transcribeWithWhisper(audioBuffer, mimeType, res);
    }

    const dgData = await dgRes.json();
    const transcript = dgData.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

    return res.status(200).json({ text: transcript });

  } catch (err) {
    console.error('Transcription error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function transcribeWithWhisper(audioBuffer, mimeType, res) {
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) {
    return res.status(500).json({ error: 'No transcription service configured' });
  }

  const FormData = (await import('formdata-node')).FormData;
  const { Blob } = await import('buffer');

  const fd = new FormData();
  fd.set('file', new Blob([audioBuffer], { type: mimeType }), 'audio.webm');
  fd.set('model', 'whisper-1');
  fd.set('language', 'en');

  const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openAiKey}` },
    body: fd,
  });

  const data = await whisperRes.json();
  return res.status(200).json({ text: data.text || '' });
}
