// api/transcribe.js
// Server-side transcription endpoint — keeps API keys off the client
// Accepts audio as base64 or multipart, calls Anthropic for transcription
// Replace OpenAI Whisper — uses Deepgram which is cheaper, faster, no leaked key risk

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { audio, mimeType = 'audio/webm' } = req.body;
    if (!audio) return res.status(400).json({ error: 'No audio provided' });

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audio, 'base64');

    // Use Deepgram for transcription — fast, accurate, cheap (~$0.0043/min)
    // Key stored server-side only — never exposed to browser
    const deepgramKey = process.env.DEEPGRAM_API_KEY;

    if (!deepgramKey) {
      // Fallback to OpenAI Whisper if Deepgram not configured
      return await transcribeWithWhisper(audioBuffer, mimeType, res);
    }

    const dgRes = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&language=en-GB&smart_format=true&punctuate=true', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${deepgramKey}`,
        'Content-Type': mimeType,
      },
      body: audioBuffer,
    });

    if (!dgRes.ok) {
      const errText = await dgRes.text();
      console.error('Deepgram error:', errText);
      // Fall back to Whisper if Deepgram fails
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
  const openAiKey = process.env.OPENAI_API_KEY; // server-side only, no VITE_ prefix
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
