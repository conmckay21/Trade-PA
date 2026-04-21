import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

// ─── Build-time version.json generator ──────────────────────────────────────
// Writes /public/version.json with a fresh build hash on every build. The
// UpdateBanner client polls this file and shows the "new version available"
// banner when the hash differs from the one captured at app load time.
//
// We can't rely on service worker lifecycle events for update detection
// because the push-notification SW skips waiting on install — there's no
// "waiting" event for Workbox to hook into. A simple fetch-and-compare loop
// against a versioned JSON file is far more reliable across browsers.
//
// The hash is just the build timestamp — guaranteed unique per build, no
// crypto needed. The version file gets cache-busted via a query param
// in the client to force a fresh fetch every poll.
function versionJsonPlugin() {
  return {
    name: 'tradepa-version-json',
    apply: 'build',
    closeBundle() {
      const version = String(Date.now());
      const outDir = resolve(process.cwd(), 'public');
      try { mkdirSync(outDir, { recursive: true }); } catch {}
      writeFileSync(resolve(outDir, 'version.json'), JSON.stringify({ version }) + '\n');
      console.log(`[tradepa-version-json] wrote public/version.json with version ${version}`);
    },
  };
}

let pwaPlugin = null
try {
  const { VitePWA } = await import('vite-plugin-pwa')
  pwaPlugin = VitePWA({
    registerType: 'autoUpdate',
    manifest: {
      name: 'Trade PA',
      short_name: 'Trade PA',
      description: 'Your AI-powered trade business assistant',
      theme_color: '#f59e0b',
      background_color: '#0f0f0f',
      display: 'standalone',
      start_url: '/',
      icons: [
        { src: 'trade-pa-logo.png', sizes: '192x192', type: 'image/png' },
        { src: 'trade-pa-logo.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,png,svg}'],

      // ─── Don't intercept server-side routes ──────────────────────────
      // Without this, Workbox's default NavigationRoute handler serves the
      // precached index.html for ANY navigation request — including
      // <a href="/api/..."> links. That breaks OAuth-style flows like
      // Stripe Connect onboarding (the browser never reaches the server
      // because the SW answers with cached HTML).
      //
      // navigateFallbackDenylist tells the SW: "for these URL patterns,
      // don't do the navigation-fallback trick, let the request go to
      // the network as normal."
      //
      //   /api/*   → all serverless functions (Stripe, Xero, email, etc)
      //   /quote/* → customer portal pages (served by api/portal.js)
      //   /icons/*, /workbox-*, /sw.js → housekeeping URLs
      //   /version.json → must always hit network for update detection
      navigateFallbackDenylist: [
        /^\/api\//,
        /^\/quote\//,
        /^\/icons\//,
        /^\/workbox-/,
        /^\/sw\.js$/,
        /^\/changelog\.md$/,
        /^\/version\.json$/,
      ],

      // ─── Don't precache server-side routes ───────────────────────────
      // Defensive layer: ensures the /api/ and /quote/ paths never end up
      // in the precache manifest in the first place (they shouldn't, since
      // they're not emitted as static assets, but this makes the intent
      // explicit and guards against future build-config changes).
      globIgnores: ['**/api/**', '**/quote/**', '**/version.json'],

      // ─── Faster update cycle for installed PWAs ─────────────────────
      // skipWaiting on the new SW and clientsClaim so updates propagate
      // to open tabs within seconds of a deploy instead of waiting for
      // every tab to close. Pairs with registerType:'autoUpdate' above.
      skipWaiting: true,
      clientsClaim: true,

      // ─── Auto-cleanup old Workbox caches on upgrade ─────────────────
      // Ensures stale precaches from previous builds get deleted once
      // the new SW activates, preventing unbounded cache growth and
      // stale-asset weirdness.
      cleanupOutdatedCaches: true,
    },
  })
} catch (e) {
  console.log('vite-plugin-pwa not available, skipping PWA features')
}

export default defineConfig({
  plugins: [react(), versionJsonPlugin(), pwaPlugin].filter(Boolean),
})
