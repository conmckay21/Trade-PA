// ─── File handling helpers ──────────────────────────────────────────────────
// Pure utility functions for FileReader → Claude content block, opening
// HTML in print-friendly preview, and base64 → Uint8Array for VAPID push.
// No dependencies.

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
  const isIOSPWA = window.navigator.standalone === true;
  if (!isIOSPWA) {
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
