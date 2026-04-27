// ─── middleware.js ─────────────────────────────────────────────────────
//
// Two responsibilities, branched by request path:
//
// 1. /api/*  — IP-based rate limiting (defense in depth on top of per-user
//              rate limits in individual route handlers).
// 2. Other   — Prerender.io proxy for SEO (bots get pre-rendered HTML).
//
// Vercel only allows ONE middleware.js file per project, hence the
// branching. Each path runs its own logic; the other is skipped.
//
// ─── IP rate limiting notes ────────────────────────────────────────────
// Implemented with an in-memory Map (no external store). This is a
// deliberate trade-off:
//   + Zero infra dependencies, no extra cost
//   + Catches the common bot-probing case (single IP, high RPS)
//   - Per-edge-node only. Vercel runs hundreds of edge nodes globally
//     and cold-starts them frequently, so a determined attacker hitting
//     different edge nodes evades the limit
//   - Doesn't help with distributed attacks (those need Cloudflare/WAF)
//
// Upgrade path when scale demands it: replace the Map with Upstash Redis
// or @vercel/kv. The check function signature stays the same.
//
// Limit is 100 req/min per IP across all /api/* routes — generous for
// real users (a heavy-use voice session does ~20-30 req/min), tight
// enough to cap bot probing at ~6000/hour per IP.

const PRERENDER_TOKEN = process.env.PRERENDER_TOKEN;

// ─── IP rate-limit state ───────────────────────────────────────────────
const ipBuckets = new Map();
const IP_LIMIT_MAX = 100;
const IP_LIMIT_WINDOW_MS = 60_000;

function getClientIp(request) {
  // Vercel sets x-forwarded-for, x-real-ip. Take the first (original client).
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

function checkIpRateLimit(ip) {
  const now = Date.now();
  const entry = ipBuckets.get(ip) || { resetAt: now + IP_LIMIT_WINDOW_MS, count: 0 };
  if (now > entry.resetAt) {
    entry.resetAt = now + IP_LIMIT_WINDOW_MS;
    entry.count = 0;
  }
  entry.count += 1;
  ipBuckets.set(ip, entry);
  // Lazy GC — every ~1% of requests, drop expired buckets if Map is large.
  if (ipBuckets.size > 5000 && Math.random() < 0.01) {
    for (const [k, v] of ipBuckets.entries()) {
      if (v.resetAt < now) ipBuckets.delete(k);
    }
  }
  return {
    allowed: entry.count <= IP_LIMIT_MAX,
    remaining: Math.max(0, IP_LIMIT_MAX - entry.count),
    resetAt: entry.resetAt,
  };
}

// ─── Prerender.io configuration ────────────────────────────────────────
// User agents that should be served pre-rendered HTML.
const BOT_USER_AGENTS = [
  "googlebot",
  "yahoo! slurp",
  "bingbot",
  "yandex",
  "baiduspider",
  "facebookexternalhit",
  "twitterbot",
  "rogerbot",
  "linkedinbot",
  "embedly",
  "quora link preview",
  "showyoubot",
  "outbrain",
  "pinterest/0.",
  "developers.google.com/+/web/snippet",
  "slackbot",
  "vkshare",
  "w3c_validator",
  "redditbot",
  "applebot",
  "whatsapp",
  "flipboard",
  "tumblr",
  "bitlybot",
  "skypeuripreview",
  "nuzzel",
  "discordbot",
  "google page speed",
  "qwantify",
  "pinterestbot",
  "bitrix link preview",
  "xing-contenttabreceiver",
  "chrome-lighthouse",
  "telegrambot",
  "google-inspectiontool",
];

// File extensions that should never be prerendered — they're assets, not pages.
const IGNORE_EXTENSIONS = [
  ".js", ".css", ".xml", ".less", ".png", ".jpg", ".jpeg",
  ".gif", ".pdf", ".doc", ".txt", ".ico", ".rss", ".zip",
  ".mp3", ".rar", ".exe", ".wmv", ".avi", ".ppt",
  ".mpg", ".mpeg", ".tif", ".wav", ".mov", ".psd", ".ai",
  ".xls", ".mp4", ".m4a", ".swf", ".dat", ".dmg", ".iso",
  ".flv", ".m4v", ".torrent", ".woff", ".woff2", ".ttf",
  ".svg", ".webmanifest", ".webp", ".json", ".map",
];

// Paths to never prerender — API, build assets, static files.
const IGNORE_PATH_PREFIXES = [
  "/api/",
  "/assets/",
  "/static/",
];

function shouldPrerender(request) {
  if (!PRERENDER_TOKEN) return false;

  const url = new URL(request.url);
  const pathname = url.pathname.toLowerCase();

  // Skip API and static paths
  for (const prefix of IGNORE_PATH_PREFIXES) {
    if (pathname.startsWith(prefix)) return false;
  }

  // Skip file extensions
  for (const ext of IGNORE_EXTENSIONS) {
    if (pathname.endsWith(ext)) return false;
  }

  // Only prerender HTML requests
  const accept = request.headers.get("accept") || "";
  if (accept && !accept.includes("text/html") && !accept.includes("*/*")) {
    return false;
  }

  // Check for bot UA or the legacy _escaped_fragment_ query param
  const ua = (request.headers.get("user-agent") || "").toLowerCase();
  if (url.searchParams.has("_escaped_fragment_")) return true;
  return BOT_USER_AGENTS.some((bot) => ua.includes(bot));
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Branch 1: /api/* → IP rate limit check
  if (pathname.startsWith("/api/")) {
    const ip = getClientIp(request);
    const rl = checkIpRateLimit(ip);
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({
          error: "Too many requests from this IP — please slow down.",
          resetAt: new Date(rl.resetAt).toISOString(),
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
            "X-RateLimit-Limit": String(IP_LIMIT_MAX),
            "X-RateLimit-Remaining": String(rl.remaining),
          },
        }
      );
    }
    // Pass through — let the route handler do its thing
    return;
  }

  // Branch 2: non-API → Prerender.io for SEO bots
  if (!shouldPrerender(request)) {
    // Returning undefined lets Vercel serve the normal response.
    return;
  }

  const origUrl = new URL(request.url);
  // Prerender expects the full URL (protocol, host, path, query).
  const fullUrl = `${origUrl.protocol}//${origUrl.host}${origUrl.pathname}${origUrl.search}`;
  const prerenderUrl = `https://service.prerender.io/${fullUrl}`;

  try {
    const resp = await fetch(prerenderUrl, {
      headers: {
        "X-Prerender-Token": PRERENDER_TOKEN,
        "User-Agent": request.headers.get("user-agent") || "",
      },
      redirect: "manual",
    });
    const body = await resp.text();
    return new Response(body, {
      status: resp.status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // Confirms to bots this was pre-rendered
        "X-Prerender": "1",
      },
    });
  } catch (err) {
    // If Prerender fails for any reason, fall through to the normal app.
    // Better that bots see the empty shell than a 500.
    console.error("[prerender] proxy failed, falling through:", err);
    return;
  }
}

export const config = {
  // Match /api/* (for rate limit) AND all non-asset paths (for Prerender).
  // The previous matcher excluded /api entirely; expanding it so the rate
  // limit branch can fire on API routes.
  matcher: "/((?!_next|assets|favicon.ico).*)",
};
