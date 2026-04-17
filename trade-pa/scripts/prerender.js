#!/usr/bin/env node
/**
 * Post-build prerender step.
 *
 * After `vite build` produces an empty-shell index.html, this script spins
 * up a local server against dist/, visits / with headless Chromium, waits
 * for React to render, grabs the final HTML, and writes it back to
 * dist/index.html so crawlers see real content.
 *
 * Uses @sparticuz/chromium + puppeteer-core because Vercel's build image
 * is missing the system libraries that standard Puppeteer's bundled Chrome
 * needs (libnss3, libgobject, etc.).
 *
 * Auto-skips on local builds so it doesn't break developer machines.
 * To run locally anyway, set FORCE_PRERENDER=true.
 */
import { existsSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { createServer } from 'http';
import handler from 'serve-handler';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = resolve(__dirname, '..', 'dist');
const PORT = 4199;
const URL = `http://localhost:${PORT}/`;

// Auto-skip on local machines — the serverless Chromium binary is Linux-only.
// Vercel sets VERCEL=1 in its build environment.
const shouldRun =
  !!process.env.VERCEL ||
  !!process.env.CI ||
  !!process.env.FORCE_PRERENDER;

if (!shouldRun) {
  console.log('[prerender] skipped (local build — set FORCE_PRERENDER=true to run anyway)');
  process.exit(0);
}

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
  args: chromium.args,
  executablePath: await chromium.executablePath(),
  headless: chromium.headless,
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on('pageerror', (err) => console.warn('[prerender] page error:', err.message));

  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });

  // Give React a beat to finish any deferred rendering
  await new Promise((r) => setTimeout(r, 1500));

  // Wait until the landing page copy is actually in the DOM
  await page.waitForFunction(
    () => document.body.innerText.includes('Trade PA'),
    { timeout: 10000 }
  );

  const html = await page.content();

  // Sanity checks — catch empty-shell failure
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
