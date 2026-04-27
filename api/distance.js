// api/distance.js — UK mileage calculator for Trade PA
// Uses postcodes.io (free, no API key, government-backed) for geocoding
// Handles voice-transcribed postcodes: "P 063 Sugar Golf" → "PO6 3SG"
//
// SECURITY (forensic audit Finding 2.5, fixed 27 Apr 2026):
// Previously unauthenticated. Free for use as a geocoding/routing proxy.
// Could burn through postcodes.io's IP rate limit (Vercel egress IP) and
// trip a temporary ban that affects legitimate users. Defense in depth:
// require JWT + rate limit per user. postcodes.io is ~3500 lookups/day per
// IP soft cap, so 60 lookups/hour/user across the user base is ~580 users
// at full saturation — comfortable headroom.

import { withSentry } from "./lib/sentry.js";
import { requireAuth, checkInMemoryRateLimit } from "./lib/auth.js";

const PHONETIC = {
  alpha:'A', bravo:'B', charlie:'C', delta:'D', echo:'E', foxtrot:'F',
  golf:'G', hotel:'H', india:'I', juliet:'J', kilo:'K', lima:'L',
  mike:'M', november:'N', oscar:'O', papa:'P', quebec:'Q', romeo:'R',
  sierra:'S', tango:'T', uniform:'U', victor:'V', whiskey:'W', yankee:'Y', zulu:'Z',
  sugar:'S',
};

function normalise(raw) {
  let s = (raw || '').trim();
  for (const [word, letter] of Object.entries(PHONETIC)) {
    s = s.replace(new RegExp(`\\b${word}\\b`, 'gi'), letter);
  }
  return s.trim();
}

// In UK postcodes, Deepgram often writes "0" (zero) for "O" (letter) in the outward code.
// e.g. "PO6" → "P06". Fix: replace leading zeros with O where letter is expected.
function fixZeroO(outward) {
  const arr = outward.split('');
  for (let i = 0; i < Math.min(2, arr.length); i++) {
    if (arr[i] === '0') arr[i] = 'O';
  }
  return arr.join('');
}

// Extract UK postcode from potentially mangled voice-transcribed text.
// UK format: outward (1-4 chars: letters + digits) + inward (1 digit + 2 letters)
function extractPostcode(text) {
  const s = normalise(text).toUpperCase();
  // Tokenise to alphanumeric chunks
  const tokens = s.replace(/[^A-Z0-9]/g, ' ').trim().split(/\s+/).filter(Boolean);

  for (let i = 0; i < tokens.length; i++) {
    for (let len = 1; len <= 4 && i + len <= tokens.length; len++) {
      const candidate = tokens.slice(i, i + len).join('');
      if (candidate.length >= 5 && candidate.length <= 7) {
        const inward  = candidate.slice(-3);
        const outward = fixZeroO(candidate.slice(0, -3));
        // Valid UK inward: digit + 2 letters. Valid outward: 1-2 letters + 1-2 digits + optional letter
        if (/^\d[A-Z]{2}$/.test(inward) && /^[A-Z]{1,2}\d{1,2}[A-Z]?$/.test(outward)) {
          return `${outward} ${inward}`;
        }
      }
    }
  }

  // Fallback: direct regex (catches already well-formatted postcodes)
  const m = s.match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s+(\d[A-Z]{2})\b/);
  if (m) return `${m[1]} ${m[2]}`;
  return null;
}

async function getCoords(address) {
  const postcode = extractPostcode(address);
  const normAddr = normalise(address);

  // Primary: postcodes.io — reliable for any valid UK postcode, no rate limits
  if (postcode) {
    try {
      const r = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
      if (r.ok) {
        const d = await r.json();
        if (d.result) {
          return {
            lat: d.result.latitude,
            lon: d.result.longitude,
            display: `${normAddr.split(',')[0].trim()} (${postcode})`,
          };
        }
      }
    } catch {}
  }

  // Fallback 1: Nominatim full address
  try {
    const r = await fetch(
      'https://nominatim.openstreetmap.org/search?' +
        new URLSearchParams({ q: normAddr || address, format: 'json', limit: '1', countrycodes: 'gb' }),
      { headers: { 'User-Agent': 'TradePa/1.0 (tradespa.co.uk)', Accept: 'application/json' } }
    );
    if (r.ok) {
      const data = await r.json();
      if (data?.length)
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), display: data[0].display_name };
    }
  } catch {}

  // Fallback 2: Nominatim postcode only
  if (postcode) {
    try {
      const r = await fetch(
        'https://nominatim.openstreetmap.org/search?' +
          new URLSearchParams({ q: postcode, format: 'json', limit: '1', countrycodes: 'gb' }),
        { headers: { 'User-Agent': 'TradePa/1.0 (tradespa.co.uk)' } }
      );
      if (r.ok) {
        const data = await r.json();
        if (data?.length)
          return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), display: postcode };
      }
    } catch {}
  }

  const hint = postcode
    ? `Postcode "${postcode}" not found — check it's correct.`
    : 'Include a UK postcode for best results.';
  throw new Error(`Could not locate "${address}". ${hint}`);
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await requireAuth(req, res);
  if (!userId) return;

  const rl = checkInMemoryRateLimit(userId, "distance", { maxRequests: 60, windowMs: 60 * 60_000 });
  if (!rl.allowed) {
    return res.status(429).json({
      error: "Rate limit exceeded — try again shortly.",
      resetAt: new Date(rl.resetAt).toISOString(),
    });
  }

  const { from, to } = req.body || {};
  if (!from || !to) return res.status(400).json({ error: 'from and to required' });

  try {
    const [fromGeo, toGeo] = await Promise.all([getCoords(from), getCoords(to)]);

    const osrmUrl =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${fromGeo.lon},${fromGeo.lat};${toGeo.lon},${toGeo.lat}?overview=false&steps=false`;

    const routeRes = await fetch(osrmUrl, { headers: { 'User-Agent': 'TradePa/1.0' } });
    if (!routeRes.ok)
      throw new Error(`Routing unavailable (${routeRes.status}) — enter miles manually.`);

    const routeData = await routeRes.json();
    if (routeData.code !== 'Ok' || !routeData.routes?.length)
      throw new Error('No driving route found — enter miles manually.');

    const miles  = Math.round(routeData.routes[0].distance * 0.000621371 * 10) / 10;
    const minutes = Math.round(routeData.routes[0].duration / 60);

    return res.json({
      miles, minutes,
      hmrcValue: parseFloat((miles * 0.45).toFixed(2)),
      from: fromGeo.display,
      to:   toGeo.display,
    });
  } catch (e) {
    return res.status(422).json({ error: e.message });
  }
}

export default withSentry(handler, { routeName: "distance" });
