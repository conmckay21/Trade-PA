import { useRef, useEffect } from "react";
import { C } from "../theme/colors.js";

// ─── PDF Overlay (iOS PWA fallback) ──────────────────────────────────────────
export function PDFOverlay({ html, onClose }) {
  const iframeRef = useRef();
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) { doc.open(); doc.write(html); doc.close(); }
  }, [html]);
  useEffect(() => {
    const handler = (e) => { if (e.data === "close-pdf") onClose(); };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onClose]);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", flexDirection: "column", background: "#fff" }}>
      <div style={{ display: "flex", gap: 8, padding: "12px 16px", paddingTop: "max(12px, env(safe-area-inset-top, 12px))", background: "#1a1a1a", flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: C.amber, border: "none", padding: "10px 18px", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 14, color: "#000" }}>✕ Close</button>
        <button onClick={() => { try { iframeRef.current?.contentWindow?.print(); } catch(e) {} }} style={{ background: "#444", color: "#fff", border: "none", padding: "10px 18px", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>🖨 Print / Save</button>
      </div>
      <iframe ref={iframeRef} style={{ flex: 1, border: "none", width: "100%" }} />
    </div>
  );
}
