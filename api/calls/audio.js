// api/calls/audio.js
// Proxy endpoint for Twilio recording playback
// Fetches the recording with API key auth and streams it to the browser
// This is needed because Twilio recordings require authentication
// and browsers can't pass auth headers to <audio src="...">

import { withSentry } from "../lib/sentry.js";

async function handler(req, res) {
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

    // Forward the browser's Range header. iOS Safari / WKWebView require byte-range
    // support (a 206 response) to play <audio>; without it the recording won't play.
    const rangeHeader = req.headers.range;
    const fetchHeaders = {
      // Account SID + Auth Token are account-wide and authenticate against any
      // Twilio region. API keys are region-scoped, so a US1 key 401s on recordings
      // stored in another region (e.g. older ie1/Dublin recordings).
      Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
    };
    if (rangeHeader) fetchHeaders.Range = rangeHeader;

    const response = await fetch(mp3Url, { headers: fetchHeaders });

    if (!response.ok && response.status !== 206) {
      console.error(`Audio proxy: Failed to fetch recording — status ${response.status}`);
      return res.status(response.status).json({ error: "Failed to fetch recording" });
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, max-age=3600");

    const buffer = Buffer.from(await response.arrayBuffer());

    // Twilio already returned a partial response — relay it as-is.
    if (response.status === 206 && response.headers.get("content-range")) {
      res.setHeader("Content-Range", response.headers.get("content-range"));
      res.setHeader("Content-Length", String(buffer.length));
      return res.status(206).send(buffer);
    }

    // We have the full file. If the client asked for a range, satisfy it ourselves
    // so iOS gets its 206 even when Twilio ignored the Range header.
    if (rangeHeader) {
      const m = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
      if (m) {
        const total = buffer.length;
        let start = m[1] ? parseInt(m[1], 10) : 0;
        let end = m[2] ? parseInt(m[2], 10) : total - 1;
        if (isNaN(start) || start < 0) start = 0;
        if (isNaN(end) || end >= total) end = total - 1;
        if (start > end || start >= total) {
          res.setHeader("Content-Range", `bytes */${total}`);
          return res.status(416).end();
        }
        const chunk = buffer.subarray(start, end + 1);
        res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
        res.setHeader("Content-Length", String(chunk.length));
        return res.status(206).send(chunk);
      }
    }

    res.setHeader("Content-Length", String(buffer.length));
    return res.status(200).send(buffer);

  } catch (err) {
    console.error("Audio proxy error:", err.message);
    return res.status(500).json({ error: "Internal error" });
  }
}

export default withSentry(handler, { routeName: "calls/audio" });
