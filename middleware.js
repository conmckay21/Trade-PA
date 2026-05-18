// Vercel Edge Middleware — handles CORS preflight for /api/* routes.
// Native Capacitor apps load from capacitor://localhost which means every
// /api/* fetch is cross-origin. The browser sends an OPTIONS preflight first;
// if the API doesn't return 2xx with CORS headers, the real request never fires.

export const config = {
  matcher: "/api/:path*",
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept",
  "Access-Control-Max-Age": "86400",
};

export default function middleware(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  // Non-preflight requests fall through to the API handler.
  // Vercel.json `headers` adds the CORS headers to the real response.
}
