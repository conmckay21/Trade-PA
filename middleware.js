// ─── middleware.js ─────────────────────────────────────────────────────
//
// Prerender.io integration for SEO.
//
// Problem: Trade PA is a React SPA. When Googlebot / Bingbot / Facebook's
// social crawler / Twitter's card scraper hit tradespa.co.uk they see an
// empty <div id="root"></div> shell because React hasn't executed yet.
// That kills organic discoverability and shared-link previews.
//
// Fix: detect bot user agents and transparently proxy those requests
// through Prerender.io. Prerender.io renders the page in a headless
// browser, caches the result, and returns fully-rendered HTML to the bot.
// Real users go through untouched.
//
// Runs as Vercel Edge Middleware — fires on every request, negligible
// latency for non-bot requests (< 1ms).

const PRERENDER_TOKEN = process.env.PRERENDER_TOKEN;

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
  // Run on all routes except API and static assets.
  matcher: "/((?!api|assets|favicon.ico).*)",
};
