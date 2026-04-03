// api/calls/audio.js
// Proxy endpoint for Twilio recording playback
// Fetches the recording with API key auth and streams it to the browser
// This is needed because Twilio recordings require authentication
// and browsers can't pass auth headers to <audio src="...">

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Missing url parameter" });
  }

  try {
    const recordingUrl = decodeURIComponent(url);

    // Validate it's a Twilio URL
    if (!recordingUrl.includes("twilio.com")) {
      return res.status(400).json({ error: "Invalid URL" });
    }

    // Add .mp3 if not already there
    const mp3Url = recordingUrl.endsWith(".mp3") ? recordingUrl : `${recordingUrl}.mp3`;

    // Fetch with API key credentials (IE1 regional endpoint)
    const response = await fetch(mp3Url, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_API_KEY}:${process.env.TWILIO_API_SECRET}`).toString("base64")}`,
      },
    });

    if (!response.ok) {
      console.error(`Audio proxy: Failed to fetch recording — status ${response.status}`);
      return res.status(response.status).json({ error: "Failed to fetch recording" });
    }

    // Stream the audio back with proper headers
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "private, max-age=3600");

    const buffer = await response.arrayBuffer();
    return res.send(Buffer.from(buffer));

  } catch (err) {
    console.error("Audio proxy error:", err.message);
    return res.status(500).json({ error: "Internal error" });
  }
}
