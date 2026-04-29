// ─── File handling helpers ──────────────────────────────────────────────────
// Pure utility functions for FileReader → Claude content block, opening
// HTML in print-friendly preview, and base64 → Uint8Array for VAPID push.
// No dependencies.
import { isNative } from "./platform.js";

// ─── File → Claude vision content block (shared helper) ────────────────────
// Used by every receipt/invoice scan flow (supplier receipts, subcontractor
// invoices, AI receipt scan from chat). Centralises the FileReader → base64
// dance and the PDF-vs-image content-block shape.
//
// Returns { fileContent, dataUrl, base64 } so callers that need the dataUrl
// for previews or the raw base64 for storage still have both.
//
// This used to be inlined in 4 different call sites with subtle variations —
// some used `reader`, some `r`, some captured `dataUrl` and some didn't.
// Refactored 26 Apr 2026 to one source of truth.
export async function fileToContentBlock(file) {
  const isPdf = file.type === "application/pdf" || file.name?.toLowerCase().endsWith(".pdf");
  const { base64, dataUrl } = await new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = e => {
      const full = e.target.result;
      res({ base64: full.split(",")[1], dataUrl: full });
    };
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
  const fileContent = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : { type: "image",    source: { type: "base64", media_type: file.type || "image/jpeg", data: base64 } };
  return { fileContent, dataUrl, base64, isPdf };
}

// Shared helper: open arbitrary HTML in a print-friendly preview that ALSO
// works on iOS standalone PWAs. window.open is silently blocked or strands
// the user (no chrome, no back button) inside the standalone wrapper, which
// is the #1 "I'm trapped" complaint we've had during testing. Cascade:
//   1. Non-PWA browsers → window.open new tab (works fine)
//   2. PWA / popup-blocked / window.open returns null →
//      dispatch trade-pa-show-pdf event, App-level PDFOverlay renders an
//      in-app fullscreen iframe with a clear ✕ Close button.
export function openHtmlPreview(html) {
  // Three "non-browser-tab" runtimes that cannot use window.open safely:
  //   - Capacitor wrapper (iOS / Android native build) — window.open punts
  //     the URL to the system browser, stranding the user in Chrome with a
  //     "Back to Trade PA" link that doesn't come back. (28 Apr 2026)
  //   - iOS standalone PWA (added to home screen via Safari Share sheet) —
  //     window.open is silently blocked.
  //   - Android / desktop standalone PWA — same trap pattern as iOS.
  // For all three, dispatch the event and let App's PDFOverlay render an
  // in-app fullscreen iframe with a working ✕ Close button.
  const native = typeof isNative === "function" ? isNative() : false;
  const iOSPWA = window.navigator.standalone === true;
  const standalonePWA = window.matchMedia
    && window.matchMedia("(display-mode: standalone)").matches;
  if (!native && !iOSPWA && !standalonePWA) {
    try {
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(html);
        win.document.close();
        return;
      }
    } catch (e) {}
  }
  window.dispatchEvent(new CustomEvent("trade-pa-show-pdf", { detail: html }));
}

// Helper: convert VAPID public key for push subscription
export function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}


// Shared helper: open a PDF URL in a runtime-appropriate viewer.
//
// The problem this solves: Android Chromium WebView (used by Capacitor on
// Android) refuses to render PDFs inside <iframe> for security/size reasons
// — no PDFium ships with WebView. Same iframe works fine on iOS Safari /
// WKWebView, desktop browsers, and Android Chrome the browser. So a naive
// "<iframe src={pdfUrl}>" goes blank on Android native specifically.
//
// Strategy:
//   - Capacitor (Android or iOS) → fetch the URL into a Blob, mint a blob:
//     URL, then load our LOCAL pdf.js viewer at /pdfjs/web/viewer.html with
//     ?file=<blob-url>. The viewer is same-origin with the app, so blob
//     URLs are accessible. Works for data URLs, Supabase signed URLs, any
//     source — and we don't depend on Mozilla's GitHub Pages CDN, which
//     502s on long URLs and is a SPOF.
//   - Web (browser, iOS PWA, desktop) → simple iframe with the URL.
//     iOS Safari/WKWebView render PDFs natively; desktop browsers do too.
//
// Routes through openHtmlPreview so we inherit overlay-vs-popup detection.
// (29 Apr 2026)
export async function openPdfPreview(url) {
  const native = typeof isNative === "function" ? isNative() : false;

  if (native) {
    try {
      // Fetch the URL into a Blob, regardless of whether it's a data URL,
      // a Supabase signed URL, or anything else. fetch() handles all three.
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Load our local viewer with the blob URL as ?file=. The viewer is
      // a static asset in public/pdfjs/web/viewer.html — same origin as
      // the Capacitor app, so blob URLs are readable.
      const viewer = "/pdfjs/web/viewer.html?file="
        + encodeURIComponent(blobUrl);
      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>PDF Preview</title>
<style>html,body,iframe{margin:0;padding:0;width:100%;height:100%;border:0;background:#525659;}</style>
</head><body><iframe src="${viewer}" allow="fullscreen"></iframe></body></html>`;
      openHtmlPreview(html);
      return;
    } catch (err) {
      // Fallback to plain iframe if fetch/blob path fails for any reason.
      // Better to try the iframe and let the user see a blank than crash.
      console.error("openPdfPreview: blob path failed, falling back", err);
    }
  }

  // Web / fallback path: simple iframe with the URL.
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>PDF Preview</title>
<style>html,body,iframe{margin:0;padding:0;width:100%;height:100%;border:0;background:#525659;}</style>
</head><body><iframe src="${url}"></iframe></body></html>`;
  openHtmlPreview(html);
}
