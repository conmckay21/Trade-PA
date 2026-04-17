#!/usr/bin/env node
/**
 * Post-build prerender step.
 *
 * After `vite build` produces an empty-shell index.html (typical SPA output),
 * this script spins up a local server against dist/, visits / with headless
 * Chromium, waits for React to render, grabs the final HTML, and writes
 * it back to dist/index.html.
 *
 * Result: crawlers, link previews and AI search get the full landing page
 * as real HTML. Regular users still hydrate the React SPA on top.
 *
 * Runs automatically via `npm run build` (see package.json scripts).
 * Adds ~10–15s to the build.
 */
import { existsSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { createServer } from 'http';
import handler from 'serve-handler';
import puppeteer from 'puppeteer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = resolve(__dirname, '..', 'dist');
const PORT = 4199;
const URL = `http://localhost:${PORT}/`;

if (!existsSync(DIST_DIR)) {
  console.error('[prerender] dist/ not found — did vite build run first?');
  process.exit(1);
}

// Tiny static server against dist/ with SPA fallback
const server = createServer((req, res) =>
  handler(req, res, {
    public: DIST_DIR,
    rewrites: [{ source: '**', destination: '/index.html' }],
  })
);

await new Promise((r) => server.listen(PORT, r));
console.log(`[prerender] serving ${DIST_DIR} at ${URL}`);

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // Swallow console noise from the app during snapshot
  page.on('pageerror', (err) => console.warn('[prerender] page error:', err.message));

  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });

  // Give React a beat to finish any deferred rendering
  await new Promise((r) => setTimeout(r, 1500));

  // Wait until something landing-page-ish is actually in the DOM
  await page.waitForFunction(
    () => document.body.innerText.includes('Trade PA'),
    { timeout: 10000 }
  );

  const html = await page.content();

  // Basic sanity checks — catch the common failure mode of rendering an empty shell
  if (html.length < 10000) {
    throw new Error(`Prerender output suspiciously small: ${html.length} chars`);
  }
  if (!html.includes('when you can')) {
    throw new Error('Prerender output missing expected hero copy');
  }

  const outputPath = resolve(DIST_DIR, 'index.html');
  writeFileSync(outputPath, html);
  console.log(`[prerender] ✓ wrote ${html.length} chars to ${outputPath}`);
} catch (err) {
  console.error('[prerender] failed:', err);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
