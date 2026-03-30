import { useState, useRef, useEffect } from "react";
import { supabase } from "./supabase.js";

// ─── Sync invoice to accounting software ─────────────────────────────────────
async function syncInvoiceToAccounting(userId, invoice) {
  if (!userId || !invoice) return;
  try {
    if (invoice.status === "paid") {
      // Mark as paid in Xero
      fetch("/api/xero/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, invoiceId: invoice.id }),
      }).catch(() => {});
    } else {
      // Create invoice in both systems
      fetch("/api/xero/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, invoice }),
      }).catch(() => {});

      fetch("/api/quickbooks/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, invoice }),
      }).catch(() => {});
    }
  } catch (e) {
    console.log("Accounting sync skipped:", e.message);
  }
}

// ─── Auth Screen ──────────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login"); // login | signup | reset
  const [form, setForm] = useState({ email: "", password: "", name: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const authStyles = {
    wrap: { minHeight: "100vh", background: "#0f0f0f", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono','Courier New',monospace", padding: 16 },
    box: { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 14, padding: 40, width: "100%", maxWidth: 400 },
    logo: { display: "flex", alignItems: "center", gap: 10, marginBottom: 32, justifyContent: "center" },
    logoIcon: { width: 36, height: 36, background: "#f59e0b", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: "#000", letterSpacing: "-0.02em" },
    logoText: { fontSize: 20, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.05em" },
    title: { fontSize: 16, fontWeight: 700, color: "#e5e5e5", marginBottom: 6, textAlign: "center" },
    sub: { fontSize: 12, color: "#6b7280", marginBottom: 28, textAlign: "center", lineHeight: 1.6 },
    label: { fontSize: 11, color: "#6b7280", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6, display: "block" },
    input: { width: "100%", background: "#242424", border: "1px solid #2a2a2a", borderRadius: 8, padding: "10px 14px", color: "#e5e5e5", fontSize: 13, fontFamily: "'DM Mono',monospace", outline: "none", boxSizing: "border-box", marginBottom: 16 },
    btn: { width: "100%", padding: "11px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontFamily: "'DM Mono',monospace", fontWeight: 700, letterSpacing: "0.04em", background: "#f59e0b", color: "#000", marginTop: 4 },
    ghost: { background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 12, fontFamily: "'DM Mono',monospace", textDecoration: "underline", padding: 0 },
    error: { background: "#ef444422", border: "1px solid #ef444444", borderRadius: 6, padding: "10px 14px", fontSize: 12, color: "#ef4444", marginBottom: 16, lineHeight: 1.5 },
    success: { background: "#10b98122", border: "1px solid #10b98144", borderRadius: 6, padding: "10px 14px", fontSize: 12, color: "#10b981", marginBottom: 16, lineHeight: 1.5 },
    divider: { display: "flex", alignItems: "center", gap: 12, margin: "20px 0" },
    dividerLine: { flex: 1, height: 1, background: "#2a2a2a" },
    dividerText: { fontSize: 11, color: "#6b7280" },
  };

  const handleLogin = async () => {
    if (!form.email || !form.password) { setError("Please enter your email and password."); return; }
    setLoading(true); setError("");
    const { data, error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
    if (error) setError(error.message);
    else onAuth(data.user);
    setLoading(false);
  };

  const handleSignup = async () => {
    if (!form.name) { setError("Please enter your name."); return; }
    if (!form.email) { setError("Please enter your email."); return; }
    if (form.password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (form.password !== form.confirm) { setError("Passwords don't match."); return; }
    setLoading(true); setError("");
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.name } }
    });
    if (error) setError(error.message);
    else if (data.user && !data.session) setError("Check your email to confirm your account, then log in.");
    else if (data.user) onAuth(data.user);
    setLoading(false);
  };

  const handleReset = async () => {
    if (!form.email) { setError("Please enter your email address."); return; }
    setLoading(true); setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
      redirectTo: window.location.origin,
    });
    if (error) setError(error.message);
    else setResetSent(true);
    setLoading(false);
  };

  const handleKey = (e, action) => { if (e.key === "Enter") action(); };

  return (
    <div style={authStyles.wrap}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;700&display=swap'); *{box-sizing:border-box;margin:0;padding:0;} input:focus{border-color:#f59e0b !important;outline:none;}`}</style>
      <div style={authStyles.box}>
        <div style={authStyles.logo}>
          <div style={authStyles.logoIcon}>TP</div>
          <div style={authStyles.logoText}>TRADE PA</div>
        </div>

        {mode === "login" && (
          <>
            <div style={authStyles.title}>Welcome back</div>
            <div style={authStyles.sub}>Sign in to your Trade PA account</div>
            {error && <div style={authStyles.error}>{error}</div>}
            <label style={authStyles.label}>Email</label>
            <input style={authStyles.input} type="email" placeholder="dave@davesplumbing.co.uk" value={form.email} onChange={set("email")} onKeyDown={e => handleKey(e, handleLogin)} autoComplete="email" />
            <label style={authStyles.label}>Password</label>
            <input style={authStyles.input} type="password" placeholder="••••••••" value={form.password} onChange={set("password")} onKeyDown={e => handleKey(e, handleLogin)} autoComplete="current-password" />
            <div style={{ textAlign: "right", marginTop: -10, marginBottom: 20 }}>
              <button style={authStyles.ghost} onClick={() => { setMode("reset"); setError(""); }}>Forgot password?</button>
            </div>
            <button style={{ ...authStyles.btn, opacity: loading ? 0.7 : 1 }} onClick={handleLogin} disabled={loading}>{loading ? "Signing in..." : "Sign In →"}</button>
            <div style={authStyles.divider}><div style={authStyles.dividerLine} /><div style={authStyles.dividerText}>or</div><div style={authStyles.dividerLine} /></div>
            <div style={{ textAlign: "center", fontSize: 12, color: "#6b7280" }}>
              New to Trade PA?{" "}
              <button style={{ ...authStyles.ghost, color: "#f59e0b" }} onClick={() => { setMode("signup"); setError(""); }}>Create an account</button>
            </div>
          </>
        )}

        {mode === "signup" && (
          <>
            <div style={authStyles.title}>Create your account</div>
            <div style={authStyles.sub}>Get Trade PA set up for your business in 30 seconds</div>
            {error && <div style={error.includes("Check your email") ? authStyles.success : authStyles.error}>{error}</div>}
            <label style={authStyles.label}>Your Name</label>
            <input style={authStyles.input} placeholder="Dave Hughes" value={form.name} onChange={set("name")} autoComplete="name" />
            <label style={authStyles.label}>Email Address</label>
            <input style={authStyles.input} type="email" placeholder="dave@davesplumbing.co.uk" value={form.email} onChange={set("email")} autoComplete="email" />
            <label style={authStyles.label}>Password</label>
            <input style={authStyles.input} type="password" placeholder="Min. 6 characters" value={form.password} onChange={set("password")} autoComplete="new-password" />
            <label style={authStyles.label}>Confirm Password</label>
            <input style={authStyles.input} type="password" placeholder="Repeat password" value={form.confirm} onChange={set("confirm")} onKeyDown={e => handleKey(e, handleSignup)} autoComplete="new-password" />
            <button style={{ ...authStyles.btn, opacity: loading ? 0.7 : 1 }} onClick={handleSignup} disabled={loading}>{loading ? "Creating account..." : "Create Account →"}</button>
            <div style={{ ...authStyles.divider }}><div style={authStyles.dividerLine} /><div style={authStyles.dividerText}>or</div><div style={authStyles.dividerLine} /></div>
            <div style={{ textAlign: "center", fontSize: 12, color: "#6b7280" }}>
              Already have an account?{" "}
              <button style={{ ...authStyles.ghost, color: "#f59e0b" }} onClick={() => { setMode("login"); setError(""); }}>Sign in</button>
            </div>
          </>
        )}

        {mode === "reset" && (
          <>
            <div style={authStyles.title}>Reset password</div>
            <div style={authStyles.sub}>Enter your email and we'll send a reset link</div>
            {error && <div style={authStyles.error}>{error}</div>}
            {resetSent
              ? <div style={authStyles.success}>✓ Reset link sent — check your email inbox.</div>
              : <>
                  <label style={authStyles.label}>Email Address</label>
                  <input style={authStyles.input} type="email" placeholder="dave@davesplumbing.co.uk" value={form.email} onChange={set("email")} onKeyDown={e => handleKey(e, handleReset)} />
                  <button style={{ ...authStyles.btn, opacity: loading ? 0.7 : 1 }} onClick={handleReset} disabled={loading}>{loading ? "Sending..." : "Send Reset Link →"}</button>
                </>
            }
            <div style={{ ...authStyles.divider }}><div style={authStyles.dividerLine} /><div style={authStyles.dividerText}>or</div><div style={authStyles.dividerLine} /></div>
            <div style={{ textAlign: "center", fontSize: 12, color: "#6b7280" }}>
              <button style={{ ...authStyles.ghost, color: "#f59e0b" }} onClick={() => { setMode("login"); setError(""); setResetSent(false); }}>Back to sign in</button>
            </div>
          </>
        )}

        <div style={{ marginTop: 28, padding: "14px 16px", background: "#242424", borderRadius: 8, fontSize: 11, color: "#4b5563", lineHeight: 1.6 }}>
          🔒 Your data is private and only visible to you. Each account is completely separate.
        </div>
      </div>
    </div>
  );
}
// ─── Whisper Voice Recording Hook ─────────────────────────────────────────────
function useWhisper(onTranscript) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const startRecording = async () => {
    try {
      // Must be called directly from user gesture — no await before getUserMedia
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // iOS Safari only supports mp4, Chrome/Firefox support webm
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size < 500) { setTranscribing(false); return; }
        setTranscribing(true);
        try {
          const ext = mimeType.includes("webm") ? "webm" : "mp4";
          const fd = new FormData();
          fd.append("file", blob, `rec.${ext}`);
          fd.append("model", "whisper-1");
          fd.append("language", "en");
          const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${import.meta.env.VITE_OPENAI_KEY}` },
            body: fd,
          });
          const data = await res.json();
          if (data.text) onTranscript(data.text.trim());
        } catch (e) { console.error("Whisper:", e); }
        setTranscribing(false);
      };

      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch (err) {
      console.error("Mic:", err);
      if (err.name === "NotAllowedError") {
        alert("Microphone blocked.\n\nOn iPhone: Settings → Safari → Microphone → Allow your site.\n\nThen reload and try again.");
      } else {
        alert(`Mic error: ${err.message}`);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  // Tap toggle — tap once to start, tap again to stop and transcribe
  const toggle = () => {
    if (recording) stopRecording();
    else startRecording();
  };

  return { recording, transcribing, toggle };
}

const C = {
  bg: "#0f0f0f", surface: "#1a1a1a", surfaceHigh: "#242424",
  border: "#2a2a2a", amber: "#f59e0b", amberDim: "#92400e",
  green: "#10b981", red: "#ef4444", blue: "#3b82f6", purple: "#8b5cf6",
  muted: "#6b7280", text: "#e5e5e5", textDim: "#9ca3af",
};

const S = {
  app: { fontFamily: "'DM Mono','Courier New',monospace", background: C.bg, minHeight: "-webkit-fill-available", color: C.text, width: "100%", overflowX: "hidden" },
  header: { background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 12px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56, position: "sticky", top: 0, zIndex: 100, width: "100%", boxSizing: "border-box" },
  logo: { display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", color: C.amber },
  logoIcon: { width: 28, height: 28, background: C.amber, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: "#000", fontSize: 10, fontWeight: 900, letterSpacing: "-0.02em", flexShrink: 0 },
  nav: { display: "flex", gap: 2, overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", flexShrink: 0 },
  navBtn: (a) => ({ padding: "6px 8px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 10, fontFamily: "'DM Mono',monospace", fontWeight: a ? 700 : 400, letterSpacing: "0.04em", background: a ? C.amber : "transparent", color: a ? "#000" : C.textDim, transition: "all 0.15s", whiteSpace: "nowrap", flexShrink: 0 }),
  main: { flex: 1, padding: "12px", maxWidth: 600, width: "100%", margin: "0 auto", boxSizing: "border-box", overflowX: "hidden" },
  card: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, minWidth: 0, boxSizing: "border-box" },
  grid2: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 },
  grid3: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 },
  grid4: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 },
  sectionTitle: { fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginBottom: 14 },
  badge: (color) => ({ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", background: color + "22", color, border: `1px solid ${color}44`, whiteSpace: "nowrap" }),
  pill: (color, active) => ({ padding: "6px 12px", borderRadius: 6, border: `1px solid ${active ? color : C.border}`, background: active ? color + "22" : C.surfaceHigh, color: active ? color : C.textDim, cursor: "pointer", fontSize: 11, fontFamily: "'DM Mono',monospace", fontWeight: 600 }),
  btn: (v = "primary", dis = false) => ({ padding: "8px 14px", borderRadius: 6, border: v === "ghost" ? `1px solid ${C.border}` : "none", cursor: dis ? "not-allowed" : "pointer", fontSize: 11, fontFamily: "'DM Mono',monospace", fontWeight: 600, letterSpacing: "0.04em", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6, background: dis ? C.surfaceHigh : v === "primary" ? C.amber : v === "stripe" ? "#635bff" : v === "danger" ? C.red : v === "green" ? C.green : C.surfaceHigh, color: dis ? C.muted : v === "primary" ? "#000" : v === "green" ? "#000" : C.text, opacity: dis ? 0.6 : 1, transition: "all 0.15s", flexShrink: 0 }),
  input: { width: "100%", background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", color: C.text, fontSize: 13, fontFamily: "'DM Mono',monospace", outline: "none", boxSizing: "border-box" },
  label: { fontSize: 11, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6, display: "block" },
  row: { display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderBottom: `1px solid ${C.border}`, minWidth: 0, overflow: "hidden" },
  statCard: (accent) => ({ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${accent}`, borderRadius: 10, padding: 16 }),
  aiMsg: (r) => ({ display: "flex", gap: 10, marginBottom: 16, flexDirection: r === "user" ? "row-reverse" : "row" }),
  aiBubble: (r) => ({ maxWidth: "85%", padding: "10px 14px", borderRadius: r === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px", background: r === "user" ? C.amberDim : C.surfaceHigh, border: `1px solid ${r === "user" ? C.amber + "44" : C.border}`, fontSize: 13, lineHeight: 1.6, color: C.text, whiteSpace: "pre-wrap" }),
  avatar: (r) => ({ width: 28, height: 28, borderRadius: "50%", background: r === "user" ? C.amber : C.surface, border: `1px solid ${r === "user" ? C.amber : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: r === "user" ? "#000" : C.amber, flexShrink: 0 }),
};

const JOBS = [];
const INVOICES_INIT = [];
const ENQUIRIES = [];
const MATERIALS = [];
const statusColor = { confirmed: C.green, pending: C.amber, quote_sent: C.blue, overdue: C.red, due: C.amber, paid: C.green, to_order: C.red, ordered: C.amber, collected: C.green, sent: C.amber, draft: C.muted };
const statusLabel = { confirmed: "Confirmed", pending: "Pending", quote_sent: "Quote Sent", overdue: "Overdue", due: "Due Today", paid: "Paid", to_order: "To Order", ordered: "Ordered", collected: "Collected", sent: "Sent", draft: "Draft" };

const DEFAULT_BRAND = {
  logo: null,
  tradingName: "",
  tagline: "",
  phone: "",
  email: "",
  website: "",
  address: "",
  gasSafeNumber: "",
  vatNumber: "",
  bankName: "",
  sortCode: "",
  accountNumber: "",
  accountName: "",
  accentColor: "#f59e0b",
  paymentTerms: "14",
  invoiceNote: "Thank you for your business. Payment due within 30 days.",
  refFormat: "invoice_number",
  refPrefix: "",
  defaultPaymentMethod: "both",
};

// Helper: build the payment reference string for a given invoice
function buildRef(brand, inv) {
  const num = (inv.id || "INV-001").replace(/\D/g, "");
  const surname = (inv.customer || "").split(" ").pop().toUpperCase();
  switch (brand.refFormat) {
    case "surname_invoice": return `${surname}-${inv.id || "INV-001"}`;
    case "custom_prefix":   return `${brand.refPrefix || "REF"}-${num}`;
    case "number_only":     return num;
    default:                return inv.id || "INV-001";
  }
}

// ─── PDF Generator ────────────────────────────────────────────────────────────
function downloadInvoicePDF(brand, inv) {
  const accent = brand.accentColor || "#f59e0b";
  const ref = buildRef(brand, inv);
  const payMethod = inv.paymentMethod || brand.defaultPaymentMethod || "both";
  const showBacs = payMethod === "bacs" || payMethod === "both";
  const showCard = payMethod === "card" || payMethod === "both";
  const vatEnabled = inv.vatEnabled && brand.vatNumber;
  const vatRate = inv.vatZeroRated ? 0 : (inv.vatRate || 20);
  const grossAmount = parseFloat(inv.grossAmount || inv.amount) || 0;
  const netAmount = (vatEnabled && !inv.vatZeroRated) ? parseFloat((grossAmount / (1 + vatRate / 100)).toFixed(2)) : grossAmount;
  const vatAmount = (vatEnabled && !inv.vatZeroRated) ? parseFloat((grossAmount - netAmount).toFixed(2)) : 0;
  const date = inv.date || new Date().toLocaleDateString("en-GB");
  const isQuote = inv.isQuote;
  const cisEnabled = inv.cisEnabled;
  const cisLabour = parseFloat(inv.cisLabour) || 0;
  const cisMaterials = parseFloat(inv.cisMaterials) || 0;
  const cisDeduction = parseFloat(inv.cisDeduction) || 0;
  const cisNetPayable = parseFloat(inv.cisNetPayable) || 0;
  const cisRate = inv.cisRate || 20;

  const rawDesc = inv.desc || inv.description || "Service";

  // Parse line items — support stored lineItems array, or pipe-separated "desc|amount" format, or plain text
  let lineItems;
  if (inv.lineItems && inv.lineItems.length > 0) {
    lineItems = inv.lineItems;
  } else {
    lineItems = rawDesc
      .split(/\n|;\s*/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => {
        // Check for pipe-separated "description|amount" format
        const pipeIdx = s.lastIndexOf("|");
        if (pipeIdx > 0) {
          const desc = s.slice(0, pipeIdx).trim();
          const amt = parseFloat(s.slice(pipeIdx + 1));
          if (!isNaN(amt)) return { description: desc, amount: amt };
        }
        return { description: s, amount: null };
      });
  }

  // If only one item with no price, use the total
  if (lineItems.length === 1 && lineItems[0].amount === null) {
    lineItems[0].amount = grossAmount;
  }

  const hasIndividualPrices = lineItems.some(l => l.amount !== null && lineItems.length > 1);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${isQuote ? "Quote" : "Invoice"} ${inv.id} — ${inv.customer}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:Arial,sans-serif;color:#1a1a1a;background:#fff;padding:0;}
  .page{max-width:800px;margin:0 auto;padding:0;}
  .header{background:${accent};padding:28px 36px;display:flex;justify-content:space-between;align-items:flex-start;}
  .header-left .biz-name{font-size:22px;font-weight:700;color:#fff;margin-bottom:4px;}
  .header-left .tagline{font-size:12px;color:rgba(255,255,255,0.8);}
  .header-right{text-align:right;}
  .header-right .doc-type{font-size:24px;font-weight:700;color:#fff;letter-spacing:0.05em;}
  .header-right .doc-id{font-size:14px;color:rgba(255,255,255,0.8);margin-top:4px;}
  .logo{max-height:60px;max-width:180px;object-fit:contain;margin-bottom:6px;display:block;}
  .infobar{background:#f8f8f8;padding:12px 36px;display:flex;justify-content:space-between;border-bottom:1px solid #eee;font-size:12px;}
  .infobar span{color:#999;margin-right:4px;}
  .addresses{padding:24px 36px;display:grid;grid-template-columns:1fr 1fr;gap:28px;border-bottom:1px solid #eee;}
  .addr-label{font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px;}
  .addr-name{font-size:14px;font-weight:700;margin-bottom:4px;}
  .addr-detail{font-size:12px;color:#555;line-height:1.7;}
  .addr-accent{color:${accent};}
  .items{padding:0 36px;}
  table{width:100%;border-collapse:collapse;}
  th{text-align:left;padding:12px 0 8px;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#999;font-weight:400;border-bottom:2px solid ${accent};}
  th.right,td.right{text-align:right;}
  td{padding:11px 0;font-size:13px;border-bottom:1px solid #f0f0f0;}
  td.muted{color:#999;}
  .totals{padding:12px 36px 0;display:flex;flex-direction:column;align-items:flex-end;gap:5px;border-top:2px solid ${accent};margin:0 36px;}
  .total-row{display:flex;gap:40px;font-size:13px;color:#888;}
  .total-row.grand{font-size:20px;font-weight:700;color:${accent};border-top:1px solid #eee;padding-top:8px;margin-top:4px;}
  .payment{margin:16px 36px 0;display:flex;flex-direction:column;gap:10px;}
  .pay-block{background:#f8f8f8;border-radius:6px;padding:14px 16px;border:1px solid #eee;}
  .pay-block.stripe{background:rgba(99,91,255,0.06);border-color:rgba(99,91,255,0.2);}
  .pay-title{font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#888;margin-bottom:10px;}
  .pay-title.stripe-title{color:#635bff;}
  .pay-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px 20px;font-size:12px;color:#555;}
  .pay-grid strong{color:#1a1a1a;}
  .ref-box{margin-top:10px;padding:8px 12px;background:${accent}18;border-radius:4px;border:1px solid ${accent}44;font-size:12px;}
  .ref-box span{color:#999;}
  .ref-box strong{letter-spacing:0.04em;}
  .ref-box small{color:#bbb;margin-left:8px;}
  .stripe-btn{display:inline-block;padding:8px 20px;background:#635bff;border-radius:5px;font-size:12px;font-weight:700;color:#fff;margin-top:10px;}
  .stripe-url{font-size:10px;color:#bbb;margin-top:6px;}
  .note{font-size:11px;color:#999;margin-top:4px;}
  .footer{background:${accent}18;padding:10px 36px;display:flex;justify-content:space-between;border-top:1px solid ${accent}44;font-size:11px;color:#888;margin-top:20px;}
  .validity{background:#fff8e8;border:1px solid ${accent}44;border-radius:6px;padding:10px 16px;margin:0 36px;font-size:12px;color:#888;}
  @media print{
    .back-bar{display:none !important;}
    body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  }
  .back-bar{background:#1a1a1a;padding:10px 36px;display:flex;gap:16px;align-items:center;position:sticky;top:0;z-index:10;}
  .back-bar a{color:#f59e0b;font-size:13px;text-decoration:none;font-weight:600;cursor:pointer;}
</style>
</head>
<body>
<div class="back-bar">
  <a onclick="if(window.opener||window.history.length<=1){window.close();}else{window.history.back();}">← Back to Trade PA</a>
  <a onclick="window.print()" style="color:#aaa;">🖨 Print / Save PDF</a>
</div>
<div class="page">
  <div class="header">
    <div class="header-left">
      ${brand.logo ? `<img src="${brand.logo}" class="logo" alt="logo"/>` : `<div class="biz-name">${brand.tradingName}</div>`}
      ${brand.tagline ? `<div class="tagline">${brand.tagline}</div>` : ""}
    </div>
    <div class="header-right">
      <div class="doc-type">${isQuote ? "QUOTE" : "INVOICE"}</div>
      <div class="doc-id">${inv.id}</div>
    </div>
  </div>

  <div class="infobar">
    <div><span>Date:</span>${date}</div>
    <div><span>${isQuote ? "Valid for:" : "Payment due:"}</span>${isQuote ? "30 days" : `${brand.paymentTerms || 30} days`}</div>
    ${brand.vatNumber ? `<div><span>VAT No:</span>${brand.vatNumber}</div>` : ""}
    <div><span>Ref:</span>${ref}</div>
    ${inv.jobRef ? `<div><span>Job Ref:</span>${inv.jobRef}</div>` : ""}
  </div>

  <div class="addresses">
    <div>
      <div class="addr-label">From</div>
      <div class="addr-name">${brand.tradingName}</div>
      <div class="addr-detail" style="white-space:pre-line">${brand.address || ""}</div>
      ${brand.phone ? `<div class="addr-detail">${brand.phone}</div>` : ""}
      ${brand.email ? `<div class="addr-detail addr-accent">${brand.email}</div>` : ""}
      ${brand.gasSafeNumber ? `<div class="addr-detail" style="font-size:11px;color:#999;margin-top:6px">Gas Safe: ${brand.gasSafeNumber}</div>` : ""}
    </div>
    <div>
      <div class="addr-label">To</div>
      <div class="addr-name">${inv.customer}</div>
      <div class="addr-detail" style="white-space:pre-line">${inv.address || ""}</div>
    </div>
  </div>

  <div class="items">
    <table>
      <thead>
        <tr>
          <th>Description</th>
          ${vatEnabled ? `<th class="right">Net</th><th class="right">VAT ${vatRate}%</th>` : ""}
          <th class="right">${vatEnabled ? "Gross" : "Amount"}</th>
        </tr>
      </thead>
      <tbody>
        ${lineItems.map((line, i) => {
          const isLast = i === lineItems.length - 1;
          const lineAmt = line.amount !== null ? line.amount : (isLast ? grossAmount : null);
          const lineNet = vatEnabled && lineAmt !== null ? parseFloat((lineAmt / (1 + vatRate / 100)).toFixed(2)) : null;
          const lineVat = vatEnabled && lineAmt !== null ? parseFloat((lineAmt - lineNet).toFixed(2)) : null;
          return `
        <tr>
          <td>${line.description || line}</td>
          ${vatEnabled ? `
            <td class="right">${lineNet !== null ? "£" + lineNet.toFixed(2) : ""}</td>
            <td class="right">${lineVat !== null ? "£" + lineVat.toFixed(2) : ""}</td>
          ` : ""}
          <td class="right">${lineAmt !== null ? "£" + lineAmt.toFixed(2) : ""}</td>
        </tr>`;
        }).join("")}
      </tbody>
    </table>
  </div>

  <div class="totals">
    ${cisEnabled ? `
    <div class="total-row"><span>Labour</span><span>£${cisLabour.toFixed(2)}</span></div>
    <div class="total-row"><span>Materials (no CIS deduction)</span><span>£${cisMaterials.toFixed(2)}</span></div>
    <div class="total-row"><span>Gross Amount</span><span>£${(cisLabour + cisMaterials).toFixed(2)}</span></div>
    <div class="total-row" style="color:#c0392b"><span>CIS Deduction @ ${cisRate}% (labour only)</span><span>-£${cisDeduction.toFixed(2)}</span></div>
    <div class="total-row grand"><span>Net Amount Payable</span><span>£${cisNetPayable.toFixed(2)}</span></div>
    ` : vatEnabled ? `
    <div class="total-row"><span>Net amount</span><span>£${netAmount.toFixed(2)}</span></div>
    <div class="total-row"><span>VAT @ ${vatRate}%${inv.vatZeroRated ? " (Zero-rated — new build)" : ""}</span><span>£${vatAmount.toFixed(2)}</span></div>
    <div class="total-row grand"><span>${isQuote ? "Quote Total (inc. VAT)" : "Total Due (inc. VAT)"}</span><span>£${grossAmount.toFixed(2)}</span></div>
    ` : `
    <div class="total-row grand"><span>${isQuote ? "Quote Total" : "Total Due"}</span><span>£${grossAmount.toFixed(2)}</span></div>
    `}
    ${cisEnabled ? `<div style="font-size:10px;color:#888;margin-top:8px;padding-top:8px;border-top:1px solid #eee">CIS tax deducted by contractor under the Construction Industry Scheme. This statement will be provided by the contractor.</div>` : ""}
    ${inv.vatZeroRated ? `<div style="font-size:10px;color:#888;margin-top:8px">Zero-rated VAT — new residential construction (VATA 1994, Group 5)</div>` : ""}
  </div>

  ${isQuote ? `
  <div class="validity">
    This quote is valid for 30 days from the date above. Prices may be subject to change after this period. Please contact us to proceed or if you have any questions.
  </div>` : ""}

  <div class="payment">
    ${!isQuote && showBacs && brand.bankName ? `
    <div class="pay-block">
      <div class="pay-title">${showCard ? "Option 1 — Pay by Bank Transfer (BACS)" : "Pay by Bank Transfer (BACS)"}</div>
      <div class="pay-grid">
        <div><span style="color:#999">Bank: </span><strong>${brand.bankName}</strong></div>
        <div><span style="color:#999">Account name: </span><strong>${brand.accountName}</strong></div>
        <div><span style="color:#999">Sort code: </span><strong>${brand.sortCode}</strong></div>
        <div><span style="color:#999">Account no: </span><strong>${brand.accountNumber}</strong></div>
      </div>
      <div class="ref-box">
        <span>Payment reference: </span><strong>${ref}</strong><small>(please use exactly as shown)</small>
      </div>
    </div>` : ""}

    ${!isQuote && showCard ? `
    <div class="pay-block stripe">
      <div class="pay-title stripe-title">${showBacs ? "Option 2 — Pay by Card (Stripe)" : "Pay by Card (Stripe)"}</div>
      <div style="font-size:12px;color:#555;margin-bottom:10px">Pay securely online by debit or credit card. Takes 30 seconds.</div>
      <div class="stripe-btn">Pay £${grossAmount.toFixed(2)} online</div>
      <div class="stripe-url">Payment link sent separately by email</div>
    </div>` : ""}

    <div class="note">${brand.invoiceNote || ""}</div>
  </div>

  <div class="footer">
    ${brand.website ? `<span>${brand.website}</span>` : "<span></span>"}
    ${brand.phone ? `<span>${brand.phone}</span>` : "<span></span>"}
    ${brand.email ? `<span>${brand.email}</span>` : "<span></span>"}
  </div>

  <!-- Back to app button — hidden when printing -->
  <div class="no-print" style="text-align:center;padding:20px;margin-top:10px;">
    <button onclick="if(window.opener||window.history.length<=1){window.close();}else{window.history.back();}" style="padding:10px 24px;background:#f59e0b;color:#000;border:none;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;margin-right:10px;">← Back to Trade PA</button>
    <button onclick="window.print()" style="padding:10px 24px;background:#1a1a1a;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;">🖨 Print / Save PDF</button>
  </div>
</div>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  } else {
    alert("Please allow pop-ups for this site to download invoices.");
  }
}

// ─── Invoice Preview ──────────────────────────────────────────────────────────
function InvoicePreview({ brand, invoice }) {
  const inv = invoice || { id: "INV-042", customer: "John Smith", address: "5 High Street\nGuildford GU1 3AA", desc: "Annual boiler service\nFlue check and clean\nPressure test", amount: 120, date: new Date().toLocaleDateString("en-GB"), due: "30 days", paymentMethod: brand.defaultPaymentMethod || "both", vatEnabled: false };
  const accent = brand.accentColor || "#f59e0b";
  const ref = buildRef(brand, inv);
  const payMethod = inv.paymentMethod || brand.defaultPaymentMethod || "both";
  const showBacs = payMethod === "bacs" || payMethod === "both";
  const showCard = payMethod === "card" || payMethod === "both";

  // VAT calculations — only if VAT number is set AND invoice has VAT enabled
  const vatEnabled = inv.vatEnabled && brand.vatNumber;
  const vatRate = inv.vatRate || 20;
  const netAmount = vatEnabled ? parseFloat((inv.amount / (1 + vatRate / 100)).toFixed(2)) : inv.amount;
  const vatAmount = vatEnabled ? parseFloat((inv.amount - netAmount).toFixed(2)) : 0;
  const grossAmount = inv.amount;

  return (
    <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden", fontFamily: "Georgia, serif", color: "#1a1a1a", boxShadow: "0 4px 24px #0008", maxWidth: 560, width: "100%" }}>
      {/* Header */}
      <div style={{ background: accent, padding: "24px 28px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          {brand.logo
            ? <img src={brand.logo} alt="logo" style={{ maxHeight: 56, maxWidth: 160, objectFit: "contain", marginBottom: 6, display: "block" }} />
            : <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em", marginBottom: 4 }}>{brand.tradingName}</div>}
          {brand.tagline && <div style={{ fontSize: 11, color: "#ffffffcc", fontFamily: "Arial,sans-serif" }}>{brand.tagline}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "0.05em" }}>INVOICE</div>
          <div style={{ fontSize: 13, color: "#ffffffcc", fontFamily: "Arial,sans-serif", marginTop: 4 }}>{inv.id}</div>
        </div>
      </div>

      {/* Info bar */}
      <div style={{ background: "#f8f8f8", padding: "14px 28px", display: "flex", justifyContent: "space-between", borderBottom: "1px solid #eee" }}>
        <div style={{ fontFamily: "Arial,sans-serif", fontSize: 12 }}>
          <span style={{ color: "#888", marginRight: 6 }}>Date:</span>{inv.date}
        </div>
        <div style={{ fontFamily: "Arial,sans-serif", fontSize: 12 }}>
          <span style={{ color: "#888", marginRight: 6 }}>Payment due:</span>{brand.paymentTerms || "30"} days
        </div>
        {brand.vatNumber && (
          <div style={{ fontFamily: "Arial,sans-serif", fontSize: 12 }}>
            <span style={{ color: "#888", marginRight: 6 }}>VAT No:</span>{brand.vatNumber}
          </div>
        )}
      </div>

      {/* Addresses */}
      <div style={{ padding: "20px 28px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, borderBottom: "1px solid #eee" }}>
        <div>
          <div style={{ fontSize: 10, fontFamily: "Arial,sans-serif", textTransform: "uppercase", letterSpacing: "0.08em", color: "#888", marginBottom: 8 }}>From</div>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "Arial,sans-serif", marginBottom: 4 }}>{brand.tradingName}</div>
          <div style={{ fontSize: 12, fontFamily: "Arial,sans-serif", color: "#444", lineHeight: 1.7, whiteSpace: "pre-line" }}>{brand.address}</div>
          {brand.phone && <div style={{ fontSize: 12, fontFamily: "Arial,sans-serif", color: "#444", marginTop: 4 }}>{brand.phone}</div>}
          {brand.email && <div style={{ fontSize: 12, fontFamily: "Arial,sans-serif", color: accent }}>{brand.email}</div>}
          {brand.gasSafeNumber && <div style={{ fontSize: 11, fontFamily: "Arial,sans-serif", color: "#888", marginTop: 6 }}>Gas Safe: {brand.gasSafeNumber}</div>}
        </div>
        <div>
          <div style={{ fontSize: 10, fontFamily: "Arial,sans-serif", textTransform: "uppercase", letterSpacing: "0.08em", color: "#888", marginBottom: 8 }}>To</div>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "Arial,sans-serif", marginBottom: 4 }}>{inv.customer}</div>
          <div style={{ fontSize: 12, fontFamily: "Arial,sans-serif", color: "#444", lineHeight: 1.7, whiteSpace: "pre-line" }}>{inv.address}</div>
        </div>
      </div>

      {/* Line items */}
      <div style={{ padding: "0 28px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Arial,sans-serif" }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${accent}` }}>
              <th style={{ textAlign: "left", padding: "12px 0 8px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "#888" }}>Description</th>
              {vatEnabled && <th style={{ textAlign: "right", padding: "12px 0 8px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "#888" }}>Net</th>}
              {vatEnabled && <th style={{ textAlign: "right", padding: "12px 0 8px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "#888" }}>VAT {vatRate}%</th>}
              <th style={{ textAlign: "right", padding: "12px 0 8px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "#888" }}>{vatEnabled ? "Gross" : "Amount"}</th>
            </tr>
          </thead>
          <tbody>
            {(inv.desc || "").split("\n").filter(Boolean).map((line, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "10px 0", fontSize: 13 }}>{line}</td>
                {vatEnabled && <td style={{ padding: "10px 0", fontSize: 13, textAlign: "right", color: i === 0 ? "#1a1a1a" : "#888" }}>{i === 0 ? `£${netAmount.toFixed(2)}` : "—"}</td>}
                {vatEnabled && <td style={{ padding: "10px 0", fontSize: 13, textAlign: "right", color: i === 0 ? "#1a1a1a" : "#888" }}>{i === 0 ? `£${vatAmount.toFixed(2)}` : "—"}</td>}
                <td style={{ padding: "10px 0", fontSize: 13, textAlign: "right", color: i === 0 ? "#1a1a1a" : "#888" }}>{i === 0 ? `£${parseFloat(grossAmount).toFixed(2)}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div style={{ margin: "0 28px", borderTop: `2px solid ${accent}`, padding: "14px 0" }}>
        {vatEnabled ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, fontFamily: "Arial,sans-serif" }}>
            <div style={{ display: "flex", gap: 32, fontSize: 12, color: "#888" }}>
              <span>Net amount</span>
              <span style={{ minWidth: 80, textAlign: "right" }}>£{netAmount.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", gap: 32, fontSize: 12, color: "#888" }}>
              <span>VAT @ {vatRate}%</span>
              <span style={{ minWidth: 80, textAlign: "right" }}>£{vatAmount.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", gap: 32, fontSize: 16, fontWeight: 700, color: accent, borderTop: `1px solid #eee`, paddingTop: 8, marginTop: 4 }}>
              <span>Total due (inc. VAT)</span>
              <span style={{ minWidth: 80, textAlign: "right" }}>£{parseFloat(grossAmount).toFixed(2)}</span>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 20 }}>
            <div style={{ fontFamily: "Arial,sans-serif", fontSize: 13, color: "#888" }}>Total Due</div>
            <div style={{ fontFamily: "Arial,sans-serif", fontSize: 22, fontWeight: 900, color: accent }}>£{parseFloat(grossAmount).toFixed(2)}</div>
          </div>
        )}
      </div>

      {/* Payment section */}
      <div style={{ margin: "0 28px 20px", display: "flex", flexDirection: "column", gap: 10 }}>

        {/* BACS block */}
        {showBacs && (
          <div style={{ background: "#f8f8f8", borderRadius: 6, padding: "14px 16px", border: "1px solid #eee" }}>
            <div style={{ fontSize: 10, fontFamily: "Arial,sans-serif", textTransform: "uppercase", letterSpacing: "0.08em", color: "#888", marginBottom: 10 }}>
              {showCard ? "Option 1 — Pay by Bank Transfer (BACS)" : "Pay by Bank Transfer (BACS)"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px", fontFamily: "Arial,sans-serif", fontSize: 12 }}>
              <div><span style={{ color: "#888" }}>Bank: </span><strong>{brand.bankName}</strong></div>
              <div><span style={{ color: "#888" }}>Account name: </span><strong>{brand.accountName}</strong></div>
              <div><span style={{ color: "#888" }}>Sort code: </span><strong>{brand.sortCode}</strong></div>
              <div><span style={{ color: "#888" }}>Account no: </span><strong>{brand.accountNumber}</strong></div>
            </div>
            <div style={{ marginTop: 10, padding: "8px 12px", background: accent + "18", borderRadius: 4, border: `1px solid ${accent}44`, fontFamily: "Arial,sans-serif", fontSize: 12 }}>
              <span style={{ color: "#888" }}>⚠ Payment reference: </span>
              <strong style={{ color: "#1a1a1a", letterSpacing: "0.04em" }}>{ref}</strong>
              <span style={{ color: "#888", fontSize: 11, marginLeft: 8 }}>(please use exactly as shown)</span>
            </div>
          </div>
        )}

        {/* Card / Stripe block */}
        {showCard && (
          <div style={{ background: "#635bff11", borderRadius: 6, padding: "14px 16px", border: "1px solid #635bff33" }}>
            <div style={{ fontSize: 10, fontFamily: "Arial,sans-serif", textTransform: "uppercase", letterSpacing: "0.08em", color: "#635bff", marginBottom: 8 }}>
              {showBacs ? "Option 2 — Pay by Card (Stripe)" : "Pay by Card (Stripe)"}
            </div>
            <div style={{ fontFamily: "Arial,sans-serif", fontSize: 12, color: "#444", marginBottom: 10 }}>
              Pay securely online by debit or credit card. Takes 30 seconds.
            </div>
            <div style={{ display: "inline-block", padding: "8px 18px", background: "#635bff", borderRadius: 5, fontFamily: "Arial,sans-serif", fontSize: 12, fontWeight: 700, color: "#fff", letterSpacing: "0.04em" }}>
              Pay £{inv.amount} online →
            </div>
            <div style={{ fontFamily: "Arial,sans-serif", fontSize: 10, color: "#888", marginTop: 8 }}>
              https://pay.stripe.com/i/acct_1Ox8.../inv_sample
            </div>
          </div>
        )}

        <div style={{ fontFamily: "Arial,sans-serif", fontSize: 11, color: "#888" }}>{brand.invoiceNote}</div>
      </div>

      {/* Footer */}
      <div style={{ background: accent + "22", padding: "10px 28px", display: "flex", justifyContent: "space-between", fontFamily: "Arial,sans-serif", fontSize: 11, color: "#666", borderTop: `1px solid ${accent}44` }}>
        {brand.website && <span>{brand.website}</span>}
        {brand.phone && <span>{brand.phone}</span>}
        {brand.email && <span>{brand.email}</span>}
      </div>
    </div>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────
// ─── Team Invite ──────────────────────────────────────────────────────────────
function TeamInvite({ companyId }) {
  const ALL_SECTIONS = ["Dashboard", "Schedule", "Customers", "Invoices", "Quotes", "Materials", "AI Assistant", "Reminders", "Payments"];
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [permissions, setPermissions] = useState(() => {
    const p = {};
    ALL_SECTIONS.forEach(s => p[s] = true);
    return p;
  });

  const togglePerm = (section) => setPermissions(p => ({ ...p, [section]: !p[section] }));

  const sendInvite = async () => {
    if (!email || !companyId) return;
    setSending(true); setError("");
    try {
      const { data: existing } = await supabase
        .from("invites")
        .select("id")
        .eq("company_id", companyId)
        .eq("email", email.toLowerCase())
        .eq("accepted", false);

      if (existing && existing.length > 0) {
        setError("An invite has already been sent to this email.");
        setSending(false);
        return;
      }

      await supabase.from("invites").insert({
        company_id: companyId,
        invited_by: (await supabase.auth.getUser()).data.user.id,
        email: email.toLowerCase(),
        role,
        permissions: role === "owner" ? null : permissions,
        accepted: false,
      });

      setSent(true);
      setEmail("");
      setTimeout(() => { setSent(false); setShowForm(false); }, 3000);
    } catch (e) {
      setError("Failed to send invite. Please try again.");
    }
    setSending(false);
  };

  if (!showForm) return (
    <button style={S.btn("primary")} onClick={() => setShowForm(true)}>+ Invite Team Member</button>
  );

  return (
    <div style={{ ...S.card, background: C.surfaceHigh, padding: 16 }}>
      {sent ? (
        <div style={{ fontSize: 12, color: C.green }}>✓ Invite sent — they'll join when they sign up with this email.</div>
      ) : (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Invite a team member</div>
          {error && <div style={{ fontSize: 11, color: C.red, marginBottom: 8 }}>{error}</div>}

          <label style={S.label}>Email address</label>
          <input
            style={{ ...S.input, marginBottom: 14 }}
            type="email"
            placeholder="colleague@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />

          <label style={S.label}>Role</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {[["member", "Member"], ["owner", "Owner"]].map(([v, l]) => (
              <button key={v} onClick={() => setRole(v)} style={S.pill(C.amber, role === v)}>{l}</button>
            ))}
          </div>

          {role === "member" && (
            <>
              <label style={S.label}>Section Access</label>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>
                Choose which sections this member can see. Toggle off to restrict access.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                {ALL_SECTIONS.map(section => {
                  const allowed = permissions[section] !== false;
                  return (
                    <button
                      key={section}
                      onClick={() => togglePerm(section)}
                      style={{
                        padding: "5px 12px", borderRadius: 12, fontSize: 11,
                        fontFamily: "'DM Mono',monospace", fontWeight: 600, cursor: "pointer",
                        border: `1px solid ${allowed ? C.green + "66" : C.border}`,
                        background: allowed ? C.green + "18" : C.surface,
                        color: allowed ? C.green : C.muted,
                      }}
                    >
                      {allowed ? "✓" : "✗"} {section}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>
                {Object.values(permissions).filter(Boolean).length} of {ALL_SECTIONS.length} sections enabled
              </div>
            </>
          )}

          {role === "owner" && (
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>
              Owners have full access to all sections including Settings.
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button style={S.btn("primary", !email || sending)} disabled={!email || sending} onClick={sendInvite}>
              {sending ? "Sending..." : "Send Invite →"}
            </button>
            <button style={S.btn("ghost")} onClick={() => { setShowForm(false); setError(""); }}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}

function Settings({ brand, setBrand, companyId, companyName, userRole, members, user }) {
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState(false);
  const [xeroConnected, setXeroConnected] = useState(false);
  const [qbConnected, setQbConnected] = useState(false);
  const logoRef = useRef();
  const set = (k) => (e) => setBrand(b => ({ ...b, [k]: e.target.value }));

  // Check connection status on load and from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('xero') === 'connected') { setXeroConnected(true); }
    if (params.get('qb') === 'connected') { setQbConnected(true); }
    if (params.get('xero') === 'error') { alert(`Xero connection failed: ${params.get('msg') || 'unknown error'}`); }
    if (params.get('qb') === 'error') { alert(`QuickBooks connection failed: ${params.get('msg') || 'unknown error'}`); }
    // Clean URL
    if (params.has('xero') || params.has('qb')) window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const handleLogo = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setBrand(b => ({ ...b, logo: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const ACCENT_PRESETS = ["#f59e0b", "#3b82f6", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#0ea5e9", "#1a1a1a"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Branding & Settings</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>These details appear on every invoice and customer communication.</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={S.btn("ghost")} onClick={() => setPreview(true)}>Preview Invoice →</button>
          <button style={S.btn(saved ? "green" : "primary")} onClick={save}>{saved ? "✓ Saved" : "Save Changes"}</button>
        </div>
      </div>

      <div style={S.grid2}>
        {/* Logo upload */}
        <div style={S.card}>
          <div style={S.sectionTitle}>Logo</div>
          <div
            onClick={() => logoRef.current.click()}
            style={{ border: `2px dashed ${brand.logo ? C.green : C.border}`, borderRadius: 10, padding: 24, textAlign: "center", cursor: "pointer", transition: "all 0.2s", background: brand.logo ? C.green + "08" : "transparent" }}
          >
            {brand.logo
              ? <img src={brand.logo} alt="logo" style={{ maxHeight: 80, maxWidth: 200, objectFit: "contain", margin: "0 auto 10px", display: "block" }} />
              : <div style={{ fontSize: 32, marginBottom: 8 }}>🖼</div>}
            <div style={{ fontSize: 12, color: brand.logo ? C.green : C.muted }}>{brand.logo ? "Click to change logo" : "Click to upload logo"}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>PNG or JPG, max 2MB. Transparent PNG works best.</div>
            <input ref={logoRef} type="file" accept="image/*" onChange={handleLogo} style={{ display: "none" }} />
          </div>
          {brand.logo && (
            <button style={{ ...S.btn("ghost"), marginTop: 10, fontSize: 11 }} onClick={() => setBrand(b => ({ ...b, logo: null }))}>Remove logo</button>
          )}
        </div>

        {/* Accent colour */}
        <div style={S.card}>
          <div style={S.sectionTitle}>Brand Colour</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            {ACCENT_PRESETS.map(col => (
              <div key={col} onClick={() => setBrand(b => ({ ...b, accentColor: col }))} style={{ width: 36, height: 36, borderRadius: 8, background: col, cursor: "pointer", border: `3px solid ${brand.accentColor === col ? "#fff" : "transparent"}`, transition: "all 0.15s", boxShadow: brand.accentColor === col ? `0 0 0 1px ${col}` : "none" }} />
            ))}
          </div>
          <label style={S.label}>Custom Colour</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="color" value={brand.accentColor} onChange={e => setBrand(b => ({ ...b, accentColor: e.target.value }))} style={{ width: 44, height: 36, borderRadius: 8, border: `1px solid ${C.border}`, background: "none", cursor: "pointer", padding: 2 }} />
            <input style={{ ...S.input, flex: 1 }} value={brand.accentColor} onChange={set("accentColor")} placeholder="#f59e0b" />
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={S.sectionTitle}>Preview</div>
            <div style={{ height: 6, borderRadius: 3, background: brand.accentColor, marginBottom: 8 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ padding: "6px 14px", borderRadius: 6, background: brand.accentColor, color: "#fff", fontSize: 12, fontWeight: 700 }}>Button</div>
              <div style={{ padding: "6px 14px", borderRadius: 6, background: brand.accentColor + "22", border: `1px solid ${brand.accentColor}`, color: brand.accentColor, fontSize: 12, fontWeight: 700 }}>Badge</div>
            </div>
          </div>
        </div>
      </div>

      {/* Business Info */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Business Information</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { k: "tradingName", l: "Trading Name" },
            { k: "tagline", l: "Tagline (shown on invoice)" },
            { k: "phone", l: "Phone Number" },
            { k: "email", l: "Email Address" },
            { k: "website", l: "Website" },
            { k: "gasSafeNumber", l: "Gas Safe Number" },
            { k: "vatNumber", l: "VAT Number (if registered)" },
          ].map(({ k, l }) => (
            <div key={k}>
              <label style={S.label}>{l}</label>
              <input style={S.input} value={brand[k]} onChange={set(k)} />
            </div>
          ))}
          <div>
            <label style={S.label}>Business Address</label>
            <textarea style={{ ...S.input, resize: "vertical", minHeight: 80 }} value={brand.address} onChange={set("address")} />
          </div>
        </div>
      </div>

      {/* Payment + Invoice Settings */}
      <div style={S.grid2}>
        <div style={S.card}>
          <div style={S.sectionTitle}>Bank Details (shown on invoice)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { k: "bankName", l: "Bank Name" },
              { k: "sortCode", l: "Sort Code" },
              { k: "accountNumber", l: "Account Number" },
              { k: "accountName", l: "Account Name" },
            ].map(({ k, l }) => (
              <div key={k}>
                <label style={S.label}>{l}</label>
                <input style={S.input} value={brand[k]} onChange={set(k)} />
              </div>
            ))}
          </div>
        </div>

        <div style={S.card}>
          <div style={S.sectionTitle}>Invoice Defaults</div>

          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Default Payment Terms</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["0", "7", "14"].map(d => (
                <button key={d} onClick={() => setBrand(b => ({ ...b, paymentTerms: d }))} style={S.pill(brand.accentColor, brand.paymentTerms === d)}>{d} days</button>
              ))}
              <button onClick={() => setBrand(b => ({ ...b, paymentTerms: "custom" }))} style={S.pill(brand.accentColor, !["0","7","14"].includes(brand.paymentTerms))}>Custom</button>
            </div>
            {!["0","7","14"].includes(brand.paymentTerms) && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <input
                  style={{ ...S.input, width: 80 }}
                  type="number"
                  min="1"
                  placeholder="e.g. 60"
                  value={["0","7","14","custom"].includes(brand.paymentTerms) ? "" : brand.paymentTerms}
                  onChange={e => setBrand(b => ({ ...b, paymentTerms: e.target.value }))}
                />
                <span style={{ fontSize: 12, color: C.muted }}>days</span>
              </div>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Payment Method on Invoices</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { v: "bacs", label: "🏦 BACS only" },
                { v: "card", label: "💳 Card only" },
                { v: "both", label: "🏦💳 Both options" },
              ].map(({ v, label }) => (
                <button key={v} onClick={() => setBrand(b => ({ ...b, defaultPaymentMethod: v }))} style={S.pill(brand.accentColor, brand.defaultPaymentMethod === v)}>{label}</button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
              {brand.defaultPaymentMethod === "bacs" && "Invoice shows bank details only. Good for customers who prefer traditional bank transfer."}
              {brand.defaultPaymentMethod === "card" && "Invoice shows a Stripe payment link only. Fastest way to get paid."}
              {brand.defaultPaymentMethod === "both" && "Invoice shows both options. Customer chooses. Recommended for mixed customer base."}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Payment Reference Format</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { v: "invoice_number", label: "Invoice number", example: "INV-041" },
                { v: "surname_invoice", label: "Surname + invoice", example: "OLIVER-INV-041" },
                { v: "custom_prefix", label: "Custom prefix + number", example: `${brand.refPrefix || "DPH"}-041` },
                { v: "number_only", label: "Number only", example: "041" },
              ].map(({ v, label, example }) => (
                <div key={v} onClick={() => setBrand(b => ({ ...b, refFormat: v }))} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 8, border: `1px solid ${brand.refFormat === v ? brand.accentColor : C.border}`, background: brand.refFormat === v ? brand.accentColor + "11" : C.surfaceHigh, cursor: "pointer", transition: "all 0.15s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${brand.refFormat === v ? brand.accentColor : C.muted}`, background: brand.refFormat === v ? brand.accentColor : "transparent", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: brand.refFormat === v ? C.text : C.textDim }}>{label}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: brand.refFormat === v ? brand.accentColor : C.muted, letterSpacing: "0.04em" }}>{example}</span>
                </div>
              ))}
            </div>
            {brand.refFormat === "custom_prefix" && (
              <div style={{ marginTop: 10 }}>
                <label style={S.label}>Your Custom Prefix</label>
                <input style={S.input} value={brand.refPrefix || ""} onChange={e => setBrand(b => ({ ...b, refPrefix: e.target.value.toUpperCase() }))} placeholder="e.g. DPH, DAVE, PLB" maxLength={8} />
              </div>
            )}
            <div style={{ marginTop: 10, padding: "8px 12px", background: C.surfaceHigh, borderRadius: 6, border: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 11, color: C.muted }}>Preview: </span>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", color: C.text }}>{buildRef(brand, { id: "INV-041", customer: "James Oliver" })}</span>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Invoice Footer Note</label>
            <textarea style={{ ...S.input, resize: "vertical", minHeight: 70 }} value={brand.invoiceNote} onChange={set("invoiceNote")} />
          </div>
          <div>
            <label style={S.label}>Next Invoice Number</label>
            <input style={S.input} defaultValue="INV-043" />
          </div>
        </div>
      </div>

      {/* Certifications */}
      {(() => {
        const [expanded, setExpanded] = useState(false);
        const ALL_CERTS = [
          { label: "Gas Safe Registered", icon: "🔥", key: "cert_gassafe" },
          { label: "OFTEC Registered", icon: "🛢", key: "cert_oftec" },
          { label: "NICEIC Approved", icon: "⚡", key: "cert_niceic" },
          { label: "NAPIT Registered", icon: "🔌", key: "cert_napit" },
          { label: "Which? Trusted Trader", icon: "✓", key: "cert_which" },
          { label: "Federation of Master Builders", icon: "🏗", key: "cert_fmb" },
          { label: "TrustMark Registered", icon: "🛡", key: "cert_trustmark" },
          { label: "CORGI Registered", icon: "🔧", key: "cert_corgi" },
          { label: "CHAS Accredited", icon: "📋", key: "cert_chas" },
          { label: "SAFEcontractor Approved", icon: "🦺", key: "cert_safecontractor" },
          { label: "Checkatrade Member", icon: "🏠", key: "cert_checkatrade" },
          { label: "F-Gas Certified", icon: "❄", key: "cert_fgas" },
        ];
        const enabledCerts = ALL_CERTS.filter(c => brand[c.key]);
        const visibleCerts = expanded ? ALL_CERTS : (enabledCerts.length > 0 ? enabledCerts : ALL_CERTS.slice(0, 4));
        return (
          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <div style={S.sectionTitle}>Certifications & Compliance</div>
              <button onClick={() => setExpanded(e => !e)} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px" }}>
                {expanded ? "Show less ↑" : `Show all (${ALL_CERTS.length}) ↓`}
              </button>
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>
              {enabledCerts.length > 0 ? `${enabledCerts.length} shown on invoices & quotes` : "Tap to enable certifications shown on your invoices."}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {visibleCerts.map((cert) => {
                const on = brand[cert.key] || false;
                return (
                  <div key={cert.key}
                    style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 14px", background: on ? brand.accentColor + "11" : C.surfaceHigh, border: `1px solid ${on ? brand.accentColor + "44" : C.border}`, borderRadius: 8, cursor: "pointer", transition: "all 0.15s" }}
                    onClick={() => setBrand(b => ({ ...b, [cert.key]: !on }))}>
                    <div style={{ fontSize: 18, flexShrink: 0, width: 24, textAlign: "center" }}>{cert.icon}</div>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: on ? 600 : 400, color: on ? C.text : C.textDim }}>{cert.label}</div>
                    <div style={{ width: 36, height: 20, borderRadius: 10, background: on ? brand.accentColor : C.border, position: "relative", flexShrink: 0, transition: "all 0.2s" }}>
                      <div style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "all 0.2s" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Accounting Integrations */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Accounting Integrations</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
          Connect your accounting software. Invoices created in Trade PA will automatically sync across.
        </div>

        {/* Xero */}
        <div style={{ padding: "14px 16px", background: C.surfaceHigh, borderRadius: 8, marginBottom: 10, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: "#13B5EA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ color: "#fff", fontWeight: 900, fontSize: 14 }}>X</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Xero</div>
            <div style={{ fontSize: 11, color: C.muted }}>
              {xeroConnected ? "Connected — invoices will sync automatically" : "Not connected"}
            </div>
          </div>
          {xeroConnected
            ? <div style={S.badge(C.green)}>✓ Connected</div>
            : <a
                href={`/api/auth/xero/connect?userId=${user?.id}`}
                style={{ ...S.btn("primary"), textDecoration: "none", background: "#13B5EA", fontSize: 12 }}
              >Connect Xero</a>
          }
        </div>

        {/* QuickBooks */}
        <div style={{ padding: "14px 16px", background: C.surfaceHigh, borderRadius: 8, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: "#2CA01C", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ color: "#fff", fontWeight: 900, fontSize: 11 }}>QB</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>QuickBooks</div>
            <div style={{ fontSize: 11, color: C.muted }}>
              {qbConnected ? "Connected — invoices will sync automatically" : "Not connected"}
            </div>
          </div>
          {qbConnected
            ? <div style={S.badge(C.green)}>✓ Connected</div>
            : <a
                href={`/api/auth/quickbooks/connect?userId=${user?.id}`}
                style={{ ...S.btn("primary"), textDecoration: "none", background: "#2CA01C", fontSize: 12 }}
              >Connect QuickBooks</a>
          }
        </div>
      </div>

      {/* Team Management */}
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={S.sectionTitle}>Team Access</div>
          {userRole === "owner" && <TeamInvite companyId={companyId} />}
        </div>

        <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8, marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>Company Workspace</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{companyName || "Your Business"}</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>All team members share the same data. Owners can control which sections each member can access.</div>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>Team Members</div>
        {members.map((m, i) => {
          const isMe = m.user_id === user?.id;
          const isOwner = m.role === "owner";
          const email = m.invited_email || m.users?.email || "Team member";
          const initials = email[0].toUpperCase();
          const perms = m.permissions || {};
          const ALL_SECTIONS = ["Dashboard", "Schedule", "Customers", "Invoices", "Quotes", "Materials", "AI Assistant", "Reminders", "Payments"];

          return (
            <div key={i} style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 14, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: isOwner || isMe ? 0 : 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: isMe ? C.amber + "22" : C.surfaceHigh, border: `1px solid ${isMe ? C.amber + "44" : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: isMe ? C.amber : C.muted, flexShrink: 0 }}>
                  {initials}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13 }}>{email}{isMe ? " (You)" : ""}</div>
                </div>
                <div style={S.badge(isOwner ? C.amber : C.blue)}>{m.role}</div>
              </div>

              {/* Permission toggles — only shown for non-owners, only editable by the account owner */}
              {!isOwner && (
                <div style={{ marginTop: 12, paddingLeft: 44 }}>
                  <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Section Access</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {ALL_SECTIONS.map(section => {
                      const allowed = perms[section] !== false;
                      const canEdit = userRole === "owner" && !isMe;
                      return (
                        <button
                          key={section}
                          disabled={!canEdit}
                          onClick={async () => {
                            if (!canEdit) return;
                            const newPerms = { ...perms, [section]: !allowed };
                            const updated = members.map((mem, j) => j === i ? { ...mem, permissions: newPerms } : mem);
                            // Update in Supabase
                            try {
                              await supabase.from("company_members")
                                .update({ permissions: newPerms })
                                .eq("company_id", companyId)
                                .eq("user_id", m.user_id);
                            } catch (e) { console.error("Permission update failed:", e); }
                          }}
                          style={{
                            padding: "3px 10px", borderRadius: 12, fontSize: 10, fontFamily: "'DM Mono',monospace", fontWeight: 600,
                            border: `1px solid ${allowed ? C.green + "66" : C.border}`,
                            background: allowed ? C.green + "18" : C.surfaceHigh,
                            color: allowed ? C.green : C.muted,
                            cursor: canEdit ? "pointer" : "default",
                            opacity: canEdit ? 1 : 0.7,
                          }}
                        >
                          {allowed ? "✓" : "✗"} {section}
                        </button>
                      );
                    })}
                  </div>
                  {!userRole === "owner" && <div style={{ fontSize: 10, color: C.muted, marginTop: 6 }}>Only the owner can change permissions.</div>}
                </div>
              )}
              {isOwner && !isMe && (
                <div style={{ paddingLeft: 44, marginTop: 6, fontSize: 11, color: C.muted }}>Owners always have full access to all sections.</div>
              )}
            </div>
          );
        })}

        {userRole !== "owner" && (
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Contact the account owner to change your access permissions.</div>
        )}
      </div>

      {/* Preview Modal */}
      {preview && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 24 }} onClick={() => setPreview(false)}>
          <div onClick={e => e.stopPropagation()} style={{ maxHeight: "90vh", overflowY: "auto", borderRadius: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: C.muted, fontFamily: "'DM Mono',monospace" }}>INVOICE PREVIEW</div>
              <button onClick={() => setPreview(false)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22 }}>×</button>
            </div>
            <InvoicePreview brand={brand} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ setView, jobs, invoices, enquiries, brand }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const todayJobs = jobs.filter(j => j.dateObj && isSameDay(new Date(j.dateObj), today));
  const weekRevenue = jobs.reduce((sum, j) => sum + (j.value || 0), 0);
  const outstanding = invoices.filter(i => i.status !== "paid").reduce((sum, i) => sum + (i.amount || 0), 0);
  const overdueInvoices = invoices.filter(i => i.status === "overdue" || i.status === "due");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={S.grid3}>
        {[
          { label: "This Week Revenue", value: `£${weekRevenue.toLocaleString()}`, sub: `${jobs.length} job${jobs.length !== 1 ? "s" : ""} scheduled`, color: C.amber },
          { label: "Outstanding Invoices", value: `£${outstanding.toLocaleString()}`, sub: `${overdueInvoices.length} overdue`, color: C.red },
          { label: "New Enquiries", value: enquiries.length, sub: `${enquiries.filter(e => e.urgent).length} urgent`, color: C.green },
        ].map((stat, i) => (
          <div key={i} style={S.statCard(stat.color)}>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>{stat.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{stat.sub}</div>
          </div>
        ))}
      </div>
      <div style={S.grid2}>
        <div style={S.card}>
          <div style={S.sectionTitle}>Today's Jobs</div>
          {todayJobs.length === 0
            ? <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic", padding: "8px 0" }}>No jobs today — add one in Schedule or via the AI Assistant.</div>
            : todayJobs.map(job => (
              <div key={job.id} style={S.row}>
                <div style={{ width: 4, height: 36, borderRadius: 2, background: statusColor[job.status] || C.muted, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{job.customer}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{job.type} · {new Date(job.dateObj).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
                {job.value > 0 && <div style={{ fontSize: 13, fontWeight: 700, color: C.amber }}>£{job.value}</div>}
              </div>
            ))
          }
          <div style={{ marginTop: 12 }}><button style={S.btn("ghost")} onClick={() => setView("Schedule")}>View Schedule →</button></div>
        </div>
        <div style={S.card}>
          <div style={S.sectionTitle}>New Enquiries</div>
          {enquiries.length === 0
            ? <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic", padding: "8px 0" }}>No enquiries yet — log one via the AI Assistant.</div>
            : enquiries.slice(0, 3).map((e, i) => (
              <div key={i} style={{ ...S.row, alignItems: "flex-start" }}>
                <div style={{ width: 4, height: 36, borderRadius: 2, background: e.urgent ? C.red : C.blue, flexShrink: 0, marginTop: 4 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{e.name}</span>
                    <span style={S.badge(C.muted)}>{e.source}</span>
                    {e.urgent && <span style={S.badge(C.red)}>Urgent</span>}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.msg}</div>
                </div>
                <div style={{ fontSize: 10, color: C.muted, flexShrink: 0 }}>{e.time}</div>
              </div>
            ))
          }
          <div style={{ marginTop: 12 }}><button style={S.btn("ghost")} onClick={() => setView("AI Assistant")}>Reply with AI →</button></div>
        </div>
      </div>
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={S.sectionTitle}>Invoice Pipeline</div>
          <button style={S.btn("ghost")} onClick={() => setView("Payments")}>Manage →</button>
        </div>
        {invoices.filter(i => !i.isQuote).length === 0
          ? <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No invoices yet — create one in Payments or via the AI Assistant.</div>
          : invoices.filter(i => !i.isQuote).slice(0, 4).map(inv => (
            <div key={inv.id} style={S.row}>
              <div style={{ fontSize: 12, color: C.muted, width: 70, flexShrink: 0 }}>{inv.id}</div>
              <div style={{ flex: 1, minWidth: 0 }}><span style={{ fontSize: 13, fontWeight: 600 }}>{inv.customer}</span></div>
              <div style={{ fontSize: 13, fontWeight: 700, marginRight: 12, flexShrink: 0 }}>£{inv.amount}</div>
              <div style={{ flexShrink: 0, textAlign: "right", marginRight: 10 }}>
                <div style={S.badge(statusColor[inv.status] || C.muted)}>{statusLabel[inv.status] || inv.status}</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{inv.due}</div>
              </div>
              <button style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px", flexShrink: 0 }} onClick={() => downloadInvoicePDF(brand, inv)}>⬇ PDF</button>
            </div>
          ))
        }
      </div>

      {invoices.filter(i => i.isQuote).length > 0 && (
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={S.sectionTitle}>Quotes ({invoices.filter(i => i.isQuote).length})</div>
            <button style={S.btn("ghost")} onClick={() => setView("Payments")}>Manage →</button>
          </div>
          {invoices.filter(i => i.isQuote).slice(0, 4).map(q => (
            <div key={q.id} style={S.row}>
              <div style={{ fontSize: 12, color: C.blue, width: 70, flexShrink: 0 }}>{q.id}</div>
              <div style={{ flex: 1, minWidth: 0 }}><span style={{ fontSize: 13, fontWeight: 600 }}>{q.customer}</span></div>
              <div style={{ fontSize: 13, fontWeight: 700, marginRight: 12, flexShrink: 0 }}>£{q.amount}</div>
              <div style={{ flexShrink: 0, textAlign: "right", marginRight: 10 }}>
                <div style={S.badge(C.blue)}>Quote</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{q.due}</div>
              </div>
              <button style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px", flexShrink: 0 }} onClick={() => downloadInvoicePDF(brand, q)}>⬇ PDF</button>
            </div>
          ))}
        </div>
      )}

      {/* Empty state call to action */}
      {jobs.length === 0 && invoices.length === 0 && enquiries.length === 0 && (
        <div style={{ ...S.card, textAlign: "center", padding: 40, borderColor: C.amber + "44", background: C.amber + "08" }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>⚡</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Welcome to Trade PA</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 24, lineHeight: 1.7 }}>
            Get started by heading to <strong style={{ color: C.text }}>Settings</strong> to add your business details,<br />
            then try the <strong style={{ color: C.text }}>AI Assistant</strong> to book your first job.
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button style={S.btn("primary")} onClick={() => setView("Settings")}>Set up my business →</button>
            <button style={S.btn("ghost")} onClick={() => setView("AI Assistant")}>Try AI Assistant</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Schedule ─────────────────────────────────────────────────────────────────
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDayLabel(date) {
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function Schedule({ jobs, setJobs }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [showAddJob, setShowAddJob] = useState(false);
  const [addJobDate, setAddJobDate] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [editingJob, setEditingJob] = useState(null);
  const [form, setForm] = useState({ customer: "", address: "", type: "", time: "09:00", value: "", status: "confirmed", notes: "" });

  const weekStart = new Date(getWeekStart(new Date()));
  weekStart.setDate(weekStart.getDate() + weekOffset * 7);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const jobsForDay = (day) => jobs.filter(j => j.dateObj && isSameDay(new Date(j.dateObj), day));

  const weekLabel = () => {
    const end = new Date(weekStart); end.setDate(end.getDate() + 6);
    return `${weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
  };

  const openAdd = (day) => {
    setAddJobDate(day);
    setForm({ customer: "", address: "", type: "", time: "09:00", value: "", status: "confirmed", notes: "" });
    setShowAddJob(true);
  };

  const saveJob = () => {
    if (!form.customer || !form.type) return;
    const dateObj = new Date(addJobDate);
    const [h, m] = form.time.split(":");
    dateObj.setHours(parseInt(h), parseInt(m));
    const newJob = {
      id: Date.now(),
      customer: form.customer,
      address: form.address,
      type: form.type,
      date: `${formatDayLabel(addJobDate)} ${form.time}`,
      dateObj: dateObj.toISOString(),
      status: form.status,
      value: parseInt(form.value) || 0,
      notes: form.notes,
    };
    setJobs(prev => [...prev, newJob]);
    setShowAddJob(false);
  };

  const saveEdit = () => {
    setJobs(prev => prev.map(j => j.id === editingJob.id ? {
      ...j,
      customer: form.customer,
      address: form.address,
      type: form.type,
      status: form.status,
      value: parseInt(form.value) || 0,
      notes: form.notes,
    } : j));
    setEditingJob(null);
    setSelectedJob(null);
  };

  const deleteJob = (id) => {
    setJobs(prev => prev.filter(j => j.id !== id));
    setSelectedJob(null);
  };

  const allWeekJobs = jobs.filter(j => {
    if (!j.dateObj) return false;
    const d = new Date(j.dateObj); d.setHours(0,0,0,0);
    return weekDays.some(wd => isSameDay(wd, d));
  }).sort((a, b) => new Date(a.dateObj) - new Date(b.dateObj));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Week nav */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setWeekOffset(o => o - 1)} style={{ ...S.btn("ghost"), padding: "6px 12px" }}>← Prev</button>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{weekLabel()}</div>
          <button onClick={() => setWeekOffset(o => o + 1)} style={{ ...S.btn("ghost"), padding: "6px 12px" }}>Next →</button>
          {weekOffset !== 0 && <button onClick={() => setWeekOffset(0)} style={{ ...S.btn("ghost"), padding: "6px 10px", fontSize: 11 }}>Today</button>}
        </div>
        <button style={S.btn("primary")} onClick={() => openAdd(weekDays[0])}>+ Add Job</button>
      </div>

      {/* Calendar grid — 7 days, jobs show name + time only, tap to see detail */}
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8, minWidth: 560 }}>
          {weekDays.map((day, i) => {
            const dayJobs = jobsForDay(day);
            const isToday = isSameDay(day, today);
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            return (
              <div key={i} style={{ ...S.card, padding: 10, borderColor: isToday ? C.amber + "66" : C.border, background: isToday ? C.amber + "08" : isWeekend ? C.surfaceHigh : C.surface }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: isToday ? C.amber : isWeekend ? C.blue : C.muted, textTransform: "uppercase" }}>
                    {day.toLocaleDateString("en-GB", { weekday: "short" })} {day.getDate()}
                  </div>
                  <button onClick={() => openAdd(day)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 15, lineHeight: 1, padding: "0 2px" }}>+</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {dayJobs.length === 0 && <div style={{ fontSize: 9, color: C.border, fontStyle: "italic" }}>Free</div>}
                  {dayJobs.map(job => (
                    <div
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      style={{ padding: "5px 7px", background: C.surfaceHigh, borderRadius: 5, borderLeft: `2px solid ${statusColor[job.status] || C.muted}`, cursor: "pointer", transition: "opacity 0.15s" }}
                      title="Tap for details"
                    >
                      {/* Calendar card — name and time ONLY */}
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {job.customer.split(" ")[0]} {job.customer.split(" ").slice(-1)[0]}
                      </div>
                      <div style={{ fontSize: 9, color: C.muted, marginTop: 1 }}>
                        {job.dateObj ? new Date(job.dateObj).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Jobs list this week — name and address, tap for detail */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Jobs This Week ({allWeekJobs.length})</div>
        {allWeekJobs.length === 0 && <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No jobs this week. Hit + to add one.</div>}
        {allWeekJobs.map(job => (
          <div key={job.id} onClick={() => setSelectedJob(job)} style={{ ...S.row, cursor: "pointer" }}>
            <div style={{ width: 4, height: 44, borderRadius: 2, background: statusColor[job.status] || C.muted, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{job.customer}</div>
              <div style={{ fontSize: 11, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{job.address || "No address"}</div>
            </div>
            <div style={{ fontSize: 11, color: C.textDim, marginRight: 12, flexShrink: 0 }}>
              {job.dateObj ? new Date(job.dateObj).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" }) : ""}<br />
              <span style={{ fontSize: 10 }}>{job.dateObj ? new Date(job.dateObj).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : ""}</span>
            </div>
            <div style={S.badge(statusColor[job.status] || C.muted)}>{statusLabel[job.status] || job.status}</div>
            <div style={{ fontSize: 11, color: C.muted, marginLeft: 12 }}>→</div>
          </div>
        ))}
      </div>

      {/* ── Job Detail Modal ── */}
      {selectedJob && !editingJob && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }} onClick={() => setSelectedJob(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.card, maxWidth: 480, width: "100%", marginBottom: 16 }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{selectedJob.customer}</div>
                <div style={S.badge(statusColor[selectedJob.status] || C.muted)}>{statusLabel[selectedJob.status] || selectedJob.status}</div>
              </div>
              <button onClick={() => setSelectedJob(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22, lineHeight: 1 }}>×</button>
            </div>

            {/* Details grid */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              {[
                { label: "Job Type", value: selectedJob.type },
                { label: "Date & Time", value: selectedJob.dateObj ? new Date(selectedJob.dateObj).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) + " at " + new Date(selectedJob.dateObj).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : selectedJob.date },
                { label: "Address", value: selectedJob.address || "Not set" },
                { label: "Value", value: selectedJob.value > 0 ? `£${selectedJob.value}` : "Not set" },
              ].map(({ label, value }) => (
                <div key={label} style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 13, color: C.text }}>{value}</div>
                </div>
              ))}

              {/* Notes */}
              <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>Notes</div>
                <div style={{ fontSize: 13, color: selectedJob.notes ? C.text : C.muted, fontStyle: selectedJob.notes ? "normal" : "italic" }}>
                  {selectedJob.notes || "No notes added"}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button style={S.btn("primary")} onClick={() => {
                setEditingJob(selectedJob);
                setForm({ customer: selectedJob.customer, address: selectedJob.address || "", type: selectedJob.type, time: selectedJob.dateObj ? new Date(selectedJob.dateObj).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }).replace(":", ":") : "09:00", value: selectedJob.value || "", status: selectedJob.status, notes: selectedJob.notes || "" });
              }}>Edit Job</button>
              {selectedJob.status !== "confirmed" && (
                <button style={S.btn("green")} onClick={() => { setJobs(prev => prev.map(j => j.id === selectedJob.id ? { ...j, status: "confirmed" } : j)); setSelectedJob(null); }}>Mark Confirmed</button>
              )}
              {selectedJob.address && (
                <a href={`https://maps.google.com/?q=${encodeURIComponent(selectedJob.address)}`} target="_blank" rel="noreferrer" style={{ ...S.btn("ghost"), textDecoration: "none" }}>📍 Directions</a>
              )}
              <button style={{ ...S.btn("ghost"), color: C.red, marginLeft: "auto" }} onClick={() => deleteJob(selectedJob.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Job Modal ── */}
      {editingJob && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 310, padding: 16 }}>
          <div style={{ ...S.card, maxWidth: 440, width: "100%", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Edit Job</div>
              <button onClick={() => setEditingJob(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22 }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { k: "customer", l: "Customer Name", p: "e.g. John Smith" },
                { k: "address", l: "Address", p: "e.g. 5 High Street, Guildford" },
                { k: "type", l: "Job Type", p: "e.g. Boiler Service" },
                { k: "value", l: "Value (£)", p: "e.g. 120" },
              ].map(({ k, l, p }) => (
                <div key={k}>
                  <label style={S.label}>{l}</label>
                  <input style={S.input} placeholder={p} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label style={S.label}>Notes</label>
                <textarea style={{ ...S.input, resize: "vertical", minHeight: 80 }} placeholder="Any notes about this job..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Status</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["confirmed", "pending", "quote_sent"].map(st => (
                    <button key={st} onClick={() => setForm(f => ({ ...f, status: st }))} style={S.pill(statusColor[st], form.status === st)}>{statusLabel[st]}</button>
                  ))}
                </div>
              </div>
              <button style={S.btn("primary", !form.customer || !form.type)} disabled={!form.customer || !form.type} onClick={saveEdit}>Save Changes →</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Job Modal ── */}
      {showAddJob && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }}>
          <div style={{ ...S.card, maxWidth: 440, width: "100%", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Add Job — {addJobDate?.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</div>
              <button onClick={() => setShowAddJob(false)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22 }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { k: "customer", l: "Customer Name", p: "e.g. John Smith" },
                { k: "address", l: "Address", p: "e.g. 5 High Street, Guildford" },
                { k: "type", l: "Job Type", p: "e.g. Boiler Service" },
                { k: "value", l: "Value (£)", p: "e.g. 120" },
              ].map(({ k, l, p }) => (
                <div key={k}>
                  <label style={S.label}>{l}</label>
                  <input style={S.input} placeholder={p} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label style={S.label}>Time</label>
                <input type="time" style={S.input} value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Notes</label>
                <textarea style={{ ...S.input, resize: "vertical", minHeight: 72 }} placeholder="Any notes about this job..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Status</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["confirmed", "pending", "quote_sent"].map(st => (
                    <button key={st} onClick={() => setForm(f => ({ ...f, status: st }))} style={S.pill(statusColor[st], form.status === st)}>{statusLabel[st]}</button>
                  ))}
                </div>
              </div>
              <button style={S.btn("primary", !form.customer || !form.type)} disabled={!form.customer || !form.type} onClick={saveJob}>Save Job →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Materials ────────────────────────────────────────────────────────────────
const DEFAULT_SUPPLIERS = [
  { name: "City Plumbing", phone: "01483 123456", email: "", notes: "Main plumbing supplies" },
  { name: "Screwfix", phone: "03330 112112", email: "", notes: "Tools and fixings" },
  { name: "Wolseley", phone: "01926 701600", email: "", notes: "Heating and plumbing" },
  { name: "Toolstation", phone: "0330 333 3303", email: "", notes: "Tools and building supplies" },
  { name: "BSS", phone: "0115 953 0500", email: "", notes: "Commercial heating" },
  { name: "Plumb Center", phone: "0330 123 1456", email: "", notes: "Plumbing wholesale" },
];

function Materials({ materials, setMaterials }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showSuppliers, setShowSuppliers] = useState(false);
  const [suppliers, setSuppliers] = useState(DEFAULT_SUPPLIERS);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [supplierForm, setSupplierForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const [form, setForm] = useState({ item: "", qty: 1, supplier: "", job: "", status: "to_order" });

  const save = () => {
    if (!form.item) return;
    setMaterials(prev => [...prev, { ...form, qty: parseInt(form.qty) || 1 }]);
    setForm({ item: "", qty: 1, supplier: "", job: "", status: "to_order" });
    setShowAdd(false);
  };

  const saveSupplier = () => {
    if (!supplierForm.name) return;
    if (editingSupplier !== null) {
      setSuppliers(prev => prev.map((s, i) => i === editingSupplier ? supplierForm : s));
    } else {
      setSuppliers(prev => [...prev, supplierForm]);
    }
    setEditingSupplier(null);
    setSupplierForm({ name: "", phone: "", email: "", notes: "" });
  };

  const deleteSupplier = (i) => setSuppliers(prev => prev.filter((_, j) => j !== i));

  const dial = (phone) => {
    if (!phone) return;
    window.location.href = `tel:${phone.replace(/\s/g, "")}`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Materials & Orders</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={S.btn("ghost")} onClick={() => setShowSuppliers(true)}>Manage Suppliers</button>
          <button style={S.btn("primary")} onClick={() => setShowAdd(true)}>+ Add Material</button>
        </div>
      </div>

      {/* Material list */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Material List</div>
        {materials.length === 0
          ? <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No materials yet — add one above or via the AI Assistant.</div>
          : materials.map((m, i) => (
            <div key={i} style={S.row}>
              <div style={{ width: 4, height: 40, borderRadius: 2, background: statusColor[m.status] || C.muted, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{m.item}</div>
                <div style={{ fontSize: 11, color: C.muted }}>
                  {[m.job && `For: ${m.job}`, m.supplier && `Via: ${m.supplier}`].filter(Boolean).join(" · ")}
                </div>
              </div>
              <div style={{ fontSize: 12, color: C.textDim, marginRight: 12, flexShrink: 0 }}>Qty: {m.qty}</div>
              <div style={S.badge(statusColor[m.status] || C.muted)}>{statusLabel[m.status] || m.status}</div>
              <button
                onClick={() => setMaterials(prev => prev.map((x, j) => j === i ? { ...x, status: x.status === "to_order" ? "ordered" : x.status === "ordered" ? "collected" : "to_order" } : x))}
                style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px", marginLeft: 8 }}
              >
                {m.status === "to_order" ? "Mark Ordered" : m.status === "ordered" ? "Mark Collected" : "Reset"}
              </button>
              <button onClick={() => setMaterials(prev => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16, marginLeft: 6 }}>✕</button>
            </div>
          ))
        }
      </div>

      {/* Supplier quick dial */}
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={S.sectionTitle}>Supplier Quick Dial</div>
          <button style={{ ...S.btn("ghost"), fontSize: 11 }} onClick={() => setShowSuppliers(true)}>+ Add Supplier</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          {suppliers.map((sup, i) => (
            <div key={i} style={{ padding: "12px 14px", background: C.surfaceHigh, borderRadius: 8, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{sup.name}</div>
              {sup.notes && <div style={{ fontSize: 10, color: C.muted, marginBottom: 8 }}>{sup.notes}</div>}
              {sup.phone ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <button onClick={() => dial(sup.phone)} style={{ ...S.btn("primary"), fontSize: 11, padding: "5px 12px" }}>📞 {sup.phone}</button>
                  {sup.email && <a href={`mailto:${sup.email}`} style={{ ...S.btn("ghost"), fontSize: 11, padding: "5px 12px", textDecoration: "none", textAlign: "center" }}>✉ Email</a>}
                </div>
              ) : (
                <button
                  onClick={() => { setEditingSupplier(i); setSupplierForm(sup); setShowSuppliers(true); }}
                  style={{ ...S.btn("ghost"), fontSize: 11, padding: "5px 10px", width: "100%" }}
                >Add number</button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Add Material Modal */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }}>
          <div style={{ ...S.card, maxWidth: 420, width: "100%", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Add Material</div>
              <button onClick={() => setShowAdd(false)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22 }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { k: "item", l: "Item", p: "e.g. Copper pipe 22mm x 3m" },
                { k: "qty", l: "Quantity", p: "1" },
                { k: "job", l: "For Job (optional)", p: "e.g. Boiler service — Smith" },
              ].map(({ k, l, p }) => (
                <div key={k}>
                  <label style={S.label}>{l}</label>
                  <input style={S.input} placeholder={p} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label style={S.label}>Supplier</label>
                <select style={{ ...S.input }} value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}>
                  <option value="">Select supplier...</option>
                  {suppliers.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                  <option value="other">Other</option>
                </select>
              </div>
              {form.supplier === "other" && (
                <div>
                  <label style={S.label}>Supplier Name</label>
                  <input style={S.input} placeholder="Enter supplier name" onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} />
                </div>
              )}
              <div>
                <label style={S.label}>Status</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {["to_order", "ordered", "collected"].map(st => (
                    <button key={st} onClick={() => setForm(f => ({ ...f, status: st }))} style={S.pill(statusColor[st], form.status === st)}>{statusLabel[st]}</button>
                  ))}
                </div>
              </div>
              <button style={S.btn("primary", !form.item)} disabled={!form.item} onClick={save}>Save →</button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Suppliers Modal */}
      {showSuppliers && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }}>
          <div style={{ ...S.card, maxWidth: 520, width: "100%", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Manage Suppliers</div>
              <button onClick={() => { setShowSuppliers(false); setEditingSupplier(null); setSupplierForm({ name: "", phone: "", notes: "" }); }} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22 }}>×</button>
            </div>

            {/* Existing suppliers */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {suppliers.map((sup, i) => (
                <div key={i} style={{ ...S.card, padding: "12px 14px", background: editingSupplier === i ? C.amber + "11" : C.surfaceHigh, borderColor: editingSupplier === i ? C.amber + "66" : C.border }}>
                  {editingSupplier === i ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {[
                        { k: "name", l: "Name", p: "e.g. City Plumbing" },
                        { k: "phone", l: "Phone Number", p: "e.g. 01483 123456" },
                        { k: "email", l: "Email Address", p: "e.g. orders@cityplumbing.co.uk" },
                        { k: "notes", l: "Notes", p: "e.g. Main plumbing supplies" },
                      ].map(({ k, l, p }) => (
                        <div key={k}>
                          <label style={S.label}>{l}</label>
                          <input style={S.input} placeholder={p} value={supplierForm[k] || ""} onChange={e => setSupplierForm(f => ({ ...f, [k]: e.target.value }))} />
                        </div>
                      ))}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button style={S.btn("primary", !supplierForm.name)} disabled={!supplierForm.name} onClick={saveSupplier}>Save</button>
                        <button style={S.btn("ghost")} onClick={() => { setEditingSupplier(null); setSupplierForm({ name: "", phone: "", notes: "" }); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{sup.name}</div>
                        <div style={{ fontSize: 11, color: sup.phone ? C.amber : C.muted }}>{sup.phone || "No phone number"}</div>
                        {sup.email && <div style={{ fontSize: 11, color: C.blue }}>{sup.email}</div>}
                        {sup.notes && <div style={{ fontSize: 11, color: C.muted }}>{sup.notes}</div>}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        {sup.phone && <button onClick={() => dial(sup.phone)} style={{ ...S.btn("primary"), fontSize: 11, padding: "5px 12px" }}>📞 Call</button>}
                        {sup.email && <a href={`mailto:${sup.email}`} style={{ ...S.btn("ghost"), fontSize: 11, padding: "5px 10px", textDecoration: "none" }}>✉</a>}
                      </div>
                      <button onClick={() => { setEditingSupplier(i); setSupplierForm(sup); }} style={{ ...S.btn("ghost"), fontSize: 11, padding: "5px 10px" }}>Edit</button>
                      <button onClick={() => deleteSupplier(i)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16 }}>✕</button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add new supplier */}
            {editingSupplier === null && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 12 }}>Add New Supplier</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { k: "name", l: "Name", p: "e.g. National Plumbing Supplies" },
                    { k: "phone", l: "Phone Number", p: "e.g. 01234 567890" },
                    { k: "email", l: "Email Address", p: "e.g. orders@supplier.co.uk" },
                    { k: "notes", l: "Notes (optional)", p: "e.g. Good for copper fittings" },
                  ].map(({ k, l, p }) => (
                    <div key={k}>
                      <label style={S.label}>{l}</label>
                      <input style={S.input} placeholder={p} value={supplierForm[k] || ""} onChange={e => setSupplierForm(f => ({ ...f, [k]: e.target.value }))} />
                    </div>
                  ))}
                  <button style={S.btn("primary", !supplierForm.name)} disabled={!supplierForm.name} onClick={saveSupplier}>Add Supplier →</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AIAssistant({ brand, jobs, setJobs, invoices, setInvoices, enquiries, setEnquiries, materials, setMaterials, customers, setCustomers, onAddReminder, setView, user }) {
  const [messages, setMessages] = useState([{ role: "assistant", content: `Hi! I'm your Trade PA assistant for ${brand.tradingName || "your business"}.\n\nI can handle everything in the app. Try:\n• "Book in John Smith, boiler service, Friday 10am, £120"\n• "Quote Sarah Chen £450 for new bathroom"\n• "Invoice Kevin Nash £85 for leak repair"\n• "Mark the invoice for Kevin as paid"\n• "Convert Sarah's quote to an invoice"\n• "Confirm the boiler service for John"\n• "Mark copper pipe as ordered"\n• "Delete the enquiry from Dave"\n• "Save Emma Taylor, 07700 900123, emma@email.com"\n\nOr tap 🎙 and speak naturally.` }]);

  const quick = [
    "Mark the invoice for John Smith as paid",
    "Convert Sarah Chen's quote to an invoice",
    "Mark copper pipe as ordered",
    "Confirm the boiler service for Dave",
  ];
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastAction, setLastAction] = useState(null);
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const { recording, transcribing, toggle } = useWhisper((text) => {
    if (text) setInput(text);
  });

  // ── Tool definitions ──────────────────────────────────────────────────────
  const TOOLS = [
    {
      name: "create_job",
      description: "Create a new job in the schedule. Use when the user mentions booking in a customer, scheduling work, or adding a job.",
      input_schema: {
        type: "object",
        properties: {
          customer: { type: "string", description: "Customer full name" },
          address: { type: "string", description: "Job address" },
          type: { type: "string", description: "Type of job e.g. Boiler Service, Leak Repair" },
          date_iso: { type: "string", description: "ISO date string for the job e.g. 2026-03-30" },
          time: { type: "string", description: "Time in HH:MM format e.g. 09:00" },
          value: { type: "number", description: "Job value in pounds" },
          status: { type: "string", enum: ["confirmed", "pending", "quote_sent"], description: "Job status" },
        },
        required: ["customer", "type", "date_iso", "time"],
      },
    },
    {
      name: "create_invoice",
      description: "Create a new invoice. Use when the user mentions invoicing a customer, charging for completed work, or sending a bill. Extract each individual item/service as a separate line item with its own price. Never combine everything into one line.",
      input_schema: {
        type: "object",
        properties: {
          customer: { type: "string", description: "Customer full name" },
          line_items: {
            type: "array",
            description: "Individual line items — one per service or product. Each has a description and price.",
            items: {
              type: "object",
              properties: {
                description: { type: "string", description: "What this line item is e.g. Boiler Service, Call Out Charge" },
                amount: { type: "number", description: "Price for this line item in pounds" },
              },
              required: ["description", "amount"],
            },
          },
          due_days: { type: "number", description: "Days until payment due, default 30" },
        },
        required: ["customer", "line_items"],
      },
    },
    {
      name: "create_quote",
      description: "Create a price quote for a customer. Use when the user mentions quoting, giving a price, or sending an estimate. Extract each individual item/service as a separate line item with its own price.",
      input_schema: {
        type: "object",
        properties: {
          customer: { type: "string", description: "Customer full name" },
          line_items: {
            type: "array",
            description: "Individual line items — one per service or product. Each has a description and price.",
            items: {
              type: "object",
              properties: {
                description: { type: "string", description: "What this line item is e.g. Supply and fit boiler, Labour" },
                amount: { type: "number", description: "Price for this line item in pounds" },
              },
              required: ["description", "amount"],
            },
          },
          valid_days: { type: "number", description: "Days quote is valid for, default 30" },
        },
        required: ["customer", "line_items"],
      },
    },
    {
      name: "log_enquiry",
      description: "Log a new customer enquiry. Use when someone has contacted the tradesperson asking about work.",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Customer name" },
          source: { type: "string", description: "How they got in touch e.g. WhatsApp, Phone, Email, Facebook" },
          message: { type: "string", description: "What they want" },
          urgent: { type: "boolean", description: "Whether this is urgent" },
        },
        required: ["name", "source", "message"],
      },
    },
    {
      name: "set_reminder",
      description: "Set a reminder. Use when the user asks to be reminded about something at a specific time.",
      input_schema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What to remind them about" },
          minutes_from_now: { type: "number", description: "How many minutes from now to fire the reminder" },
          time_label: { type: "string", description: "Human readable time e.g. 3:00 PM today" },
        },
        required: ["text", "minutes_from_now"],
      },
    },
    {
      name: "create_material",
      description: "Add a material or item to the materials list to order or track.",
      input_schema: {
        type: "object",
        properties: {
          item: { type: "string", description: "Material or item name" },
          qty: { type: "number", description: "Quantity needed" },
          supplier: { type: "string", description: "Preferred supplier" },
          job: { type: "string", description: "Which job this is for" },
        },
        required: ["item", "qty"],
      },
    },
    {
      name: "delete_job",
      description: "Delete or cancel a job. Use when the user says to remove, cancel, or delete a job. Match by customer name or job type.",
      input_schema: {
        type: "object",
        properties: {
          customer: { type: "string", description: "Customer name to match" },
          job_type: { type: "string", description: "Job type to help identify it" },
        },
        required: ["customer"],
      },
    },
    {
      name: "delete_invoice",
      description: "Delete an invoice. Use when the user says to remove or delete an invoice. Match by invoice ID or customer name.",
      input_schema: {
        type: "object",
        properties: {
          invoice_id: { type: "string", description: "Invoice ID e.g. INV-042" },
          customer: { type: "string", description: "Customer name if no ID given" },
        },
        required: [],
      },
    },
    {
      name: "delete_enquiry",
      description: "Delete or dismiss an enquiry. Use when the user says to remove, dismiss, or delete an enquiry.",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Customer name to match" },
        },
        required: ["name"],
      },
    },
    {
      name: "create_customer",
      description: "Save a customer's contact details. Use when the user provides a customer's phone number, email, or address to store.",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Customer full name" },
          phone: { type: "string", description: "Phone number" },
          email: { type: "string", description: "Email address" },
          address: { type: "string", description: "Address" },
          notes: { type: "string", description: "Any notes about this customer" },
        },
        required: ["name"],
      },
    },
    {
      name: "delete_customer",
      description: "Delete a customer record. Use when the user says to remove or delete a customer.",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Customer name to match" },
        },
        required: ["name"],
      },
    },
    {
      name: "delete_material",
      description: "Delete a material from the materials list. Use when the user says to remove or delete a material.",
      input_schema: {
        type: "object",
        properties: {
          item: { type: "string", description: "Material item name to match" },
        },
        required: ["item"],
      },
    },
    {
      name: "mark_invoice_paid",
      description: "Mark an invoice as paid. Use when the user says a customer has paid, money has arrived, or to mark something as paid.",
      input_schema: {
        type: "object",
        properties: {
          invoice_id: { type: "string", description: "Invoice ID e.g. INV-042" },
          customer: { type: "string", description: "Customer name if no ID given" },
        },
        required: [],
      },
    },
    {
      name: "update_job_status",
      description: "Update the status of a job. Use when the user wants to confirm, mark as pending, or update a job's status.",
      input_schema: {
        type: "object",
        properties: {
          customer: { type: "string", description: "Customer name to identify the job" },
          job_type: { type: "string", description: "Job type to help identify it" },
          status: { type: "string", enum: ["confirmed", "pending", "quote_sent"], description: "New status for the job" },
        },
        required: ["customer", "status"],
      },
    },
    {
      name: "convert_quote_to_invoice",
      description: "Convert a quote into an invoice. Use when the user says a customer has accepted a quote, or wants to raise an invoice from a quote.",
      input_schema: {
        type: "object",
        properties: {
          quote_id: { type: "string", description: "Quote ID e.g. QTE-042" },
          customer: { type: "string", description: "Customer name if no ID given" },
        },
        required: [],
      },
    },
    {
      name: "update_material_status",
      description: "Update the status of a material — mark as ordered or collected. Use when the user says materials have been ordered or collected/arrived.",
      input_schema: {
        type: "object",
        properties: {
          item: { type: "string", description: "Material item name to match" },
          status: { type: "string", enum: ["to_order", "ordered", "collected"], description: "New status" },
        },
        required: ["item", "status"],
      },
    },
  ];

  // ── Execute tool calls ────────────────────────────────────────────────────
  const executeTool = (name, input) => {
    try {
      switch (name) {
        case "create_customer": {
          const existing = (customers || []).find(c => c.name.toLowerCase() === input.name.toLowerCase());
          if (existing) {
            setCustomers(prev => (prev || []).map(c => c.id === existing.id ? { ...c, ...input } : c));
            setLastAction({ type: "enquiry", label: `Updated: ${input.name}`, view: "Customers" });
            return `Customer updated: ${input.name}${input.phone ? ` · ${input.phone}` : ""}${input.email ? ` · ${input.email}` : ""}.`;
          } else {
            const newCustomer = { name: input.name, phone: input.phone || "", email: input.email || "", address: input.address || "", notes: input.notes || "", id: Date.now() };
            setCustomers(prev => [...(prev || []), newCustomer]);
            setLastAction({ type: "enquiry", label: `Saved: ${input.name}`, view: "Customers" });
            return `Customer saved: ${input.name}${input.phone ? ` · ${input.phone}` : ""}${input.email ? ` · ${input.email}` : ""}.`;
          }
        }
        case "create_job": {
          const dateObj = new Date(`${input.date_iso}T${input.time || "09:00"}`);
          const job = {
            id: Date.now(),
            customer: input.customer,
            address: input.address || "",
            type: input.type,
            date: dateObj.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) + " " + input.time,
            dateObj: dateObj.toISOString(),
            status: input.status || "confirmed",
            value: input.value || 0,
          };
          setJobs(prev => [...(prev || []), job]);
          setLastAction({ type: "job", label: `${input.type} — ${input.customer}`, view: "Schedule" });
          return `Job created: ${input.type} for ${input.customer} on ${dateObj.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} at ${input.time}.`;
        }
        case "create_invoice": {
          const id = `INV-${String(Math.floor(Math.random() * 900) + 100)}`;
          const lineItems = input.line_items || [{ description: input.description || "Services", amount: input.amount || 0 }];
          const totalAmount = lineItems.reduce((s, l) => s + (l.amount || 0), 0);
          const inv = {
            id,
            customer: input.customer,
            amount: totalAmount,
            due: `Due in ${input.due_days || 30} days`,
            status: "sent",
            description: lineItems.map(l => `${l.description}|${l.amount}`).join("\n"),
            lineItems,
            isQuote: false,
          };
          setInvoices(prev => [inv, ...(prev || [])]);
          syncInvoiceToAccounting(user?.id, inv);
          setLastAction({ type: "invoice", label: `${id} — £${totalAmount} — ${input.customer}`, view: "Invoices" });
          return `Invoice ${id} created for ${input.customer} — £${totalAmount} total (${lineItems.length} line item${lineItems.length > 1 ? "s" : ""}).`;
        }
        case "create_quote": {
          const id = `QTE-${String(Math.floor(Math.random() * 900) + 100)}`;
          const lineItems = input.line_items || [{ description: input.description || "Services", amount: input.amount || 0 }];
          const totalAmount = lineItems.reduce((s, l) => s + (l.amount || 0), 0);
          const quote = {
            id,
            customer: input.customer,
            amount: totalAmount,
            due: `Valid for ${input.valid_days || 30} days`,
            status: "sent",
            description: lineItems.map(l => `${l.description}|${l.amount}`).join("\n"),
            lineItems,
            isQuote: true,
          };
          setInvoices(prev => [quote, ...(prev || [])]);
          setLastAction({ type: "invoice", label: `${id} — £${totalAmount} — ${input.customer}`, view: "Quotes" });
          return `Quote ${id} created for ${input.customer} — £${totalAmount} total (${lineItems.length} line item${lineItems.length > 1 ? "s" : ""}).`;
        }
        case "log_enquiry": {
          const enq = { name: input.name, source: input.source, msg: input.message, time: "Just now", urgent: input.urgent || false };
          setEnquiries(prev => [enq, ...(prev || [])]);
          setLastAction({ type: "enquiry", label: `${input.name} via ${input.source}`, view: "Dashboard" });
          return `Enquiry logged from ${input.name} via ${input.source}.`;
        }
        case "set_reminder": {
          const reminder = { id: `r${Date.now()}`, text: input.text, time: Date.now() + (input.minutes_from_now * 60000), timeLabel: input.time_label || "", done: false };
          onAddReminder(reminder);
          setLastAction({ type: "reminder", label: input.text, view: "Reminders" });
          return `Reminder set: "${input.text}" — ${input.time_label || `in ${input.minutes_from_now} minutes`}.`;
        }
        case "create_material": {
          const mat = { item: input.item, qty: input.qty || 1, supplier: input.supplier || "", job: input.job || "", status: "to_order" };
          setMaterials(prev => [...(prev || []), mat]);
          setLastAction({ type: "material", label: `${input.item} x${input.qty || 1}`, view: "Materials" });
          return `Material added: ${input.item} x${input.qty || 1}${input.supplier ? ` from ${input.supplier}` : ""}${input.job ? ` for ${input.job}` : ""}.`;
        }
        case "delete_job": {
          const match = (jobs || []).find(j => j.customer.toLowerCase().includes(input.customer.toLowerCase()) && (!input.job_type || j.type.toLowerCase().includes(input.job_type.toLowerCase())));
          if (!match) return `Couldn't find a job for "${input.customer}". Check the Schedule tab.`;
          setJobs(prev => (prev || []).filter(j => j.id !== match.id));
          setLastAction({ type: "job", label: `Deleted: ${match.type} — ${match.customer}`, view: "Schedule" });
          return `Job deleted: ${match.type} for ${match.customer}.`;
        }
        case "delete_invoice": {
          const match = (invoices || []).find(i =>
            (input.invoice_id && i.id.toLowerCase() === input.invoice_id.toLowerCase()) ||
            (input.customer && i.customer.toLowerCase().includes(input.customer.toLowerCase()))
          );
          if (!match) return `Couldn't find that invoice. Check the Invoices tab.`;
          setInvoices(prev => (prev || []).filter(i => i.id !== match.id));
          setLastAction({ type: "invoice", label: `Deleted: ${match.id} — ${match.customer}`, view: "Invoices" });
          return `Invoice ${match.id} for ${match.customer} (£${match.amount}) deleted.`;
        }
        case "delete_enquiry": {
          const match = (enquiries || []).find(e => e.name.toLowerCase().includes(input.name.toLowerCase()));
          if (!match) return `Couldn't find an enquiry from "${input.name}".`;
          setEnquiries(prev => (prev || []).filter(e => e !== match));
          setLastAction({ type: "enquiry", label: `Deleted: ${match.name}`, view: "Dashboard" });
          return `Enquiry from ${match.name} deleted.`;
        }
        case "delete_customer": {
          const match = (customers || []).find(c => c.name.toLowerCase().includes(input.name.toLowerCase()));
          if (!match) return `Couldn't find a customer named "${input.name}". Check the Customers tab.`;
          setCustomers(prev => (prev || []).filter(c => c.id !== match.id));
          setLastAction({ type: "enquiry", label: `Deleted: ${match.name}`, view: "Customers" });
          return `Customer ${match.name} deleted.`;
        }
        case "delete_material": {
          const match = (materials || []).find(m => m.item.toLowerCase().includes(input.item.toLowerCase()));
          if (!match) return `Couldn't find a material matching "${input.item}". Check the Materials tab.`;
          setMaterials(prev => (prev || []).filter(m => m !== match));
          setLastAction({ type: "material", label: `Deleted: ${match.item}`, view: "Materials" });
          return `Material "${match.item}" deleted.`;
        }
        case "mark_invoice_paid": {
          const match = (invoices || []).find(i =>
            !i.isQuote && (
              (input.invoice_id && i.id.toLowerCase() === input.invoice_id.toLowerCase()) ||
              (input.customer && i.customer.toLowerCase().includes(input.customer.toLowerCase()) && i.status !== "paid")
            )
          );
          if (!match) return `Couldn't find an unpaid invoice matching that. Check the Invoices tab.`;
          setInvoices(prev => (prev || []).map(i => i.id === match.id ? { ...i, status: "paid", due: "Paid" } : i));
          syncInvoiceToAccounting(user?.id, { ...match, status: "paid" });
          setLastAction({ type: "invoice", label: `Paid: ${match.id} — ${match.customer}`, view: "Invoices" });
          return `Invoice ${match.id} for ${match.customer} (£${match.amount}) marked as paid.`;
        }
        case "update_job_status": {
          const match = (jobs || []).find(j => j.customer.toLowerCase().includes(input.customer.toLowerCase()) && (!input.job_type || j.type.toLowerCase().includes(input.job_type.toLowerCase())));
          if (!match) return `Couldn't find a job for "${input.customer}". Check the Schedule tab.`;
          setJobs(prev => (prev || []).map(j => j.id === match.id ? { ...j, status: input.status } : j));
          setLastAction({ type: "job", label: `${input.status}: ${match.type} — ${match.customer}`, view: "Schedule" });
          return `Job "${match.type}" for ${match.customer} updated to ${input.status}.`;
        }
        case "convert_quote_to_invoice": {
          const match = (invoices || []).find(i =>
            i.isQuote && (
              (input.quote_id && i.id.toLowerCase() === input.quote_id.toLowerCase()) ||
              (input.customer && i.customer.toLowerCase().includes(input.customer.toLowerCase()))
            )
          );
          if (!match) return `Couldn't find a quote matching that. Check the Quotes tab.`;
          const newId = `INV-${String(Math.floor(Math.random() * 900) + 100)}`;
          const inv = { ...match, id: newId, isQuote: false, status: "sent", due: `Due in ${brand.paymentTerms || 30} days` };
          setInvoices(prev => [inv, ...(prev || []).filter(i => i.id !== match.id)]);
          setLastAction({ type: "invoice", label: `Converted: ${newId} — ${match.customer}`, view: "Invoices" });
          return `Quote ${match.id} converted to invoice ${newId} for ${match.customer} — £${match.amount}.`;
        }
        case "update_material_status": {
          const match = (materials || []).find(m => m.item.toLowerCase().includes(input.item.toLowerCase()));
          if (!match) return `Couldn't find a material matching "${input.item}". Check the Materials tab.`;
          setMaterials(prev => (prev || []).map(m => m === match ? { ...m, status: input.status } : m));
          setLastAction({ type: "material", label: `${input.status}: ${match.item}`, view: "Materials" });
          return `Material "${match.item}" marked as ${input.status}.`;
        }
        default:
          return `Unknown action: ${name}`;
      }
    } catch (err) {
      console.error("Tool execution error:", name, err);
      return `Error executing ${name}: ${err.message}`;
    }
  };

  const SYSTEM = `You are a smart admin assistant for ${brand.tradingName}, a UK sole trader trades business. Today is ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.

Current data you can act on:
- Jobs: ${jobs.length === 0 ? "none" : jobs.map(j => `${j.customer} (${j.type}, ${j.status})`).join(", ")}
- Invoices: ${invoices.filter(i => !i.isQuote).length === 0 ? "none" : invoices.filter(i => !i.isQuote).map(i => `${i.id} ${i.customer} £${i.amount} (${i.status})`).join(", ")}
- Quotes: ${invoices.filter(i => i.isQuote).length === 0 ? "none" : invoices.filter(i => i.isQuote).map(i => `${i.id} ${i.customer} £${i.amount} (${i.status})`).join(", ")}
- Enquiries: ${enquiries.length === 0 ? "none" : enquiries.map(e => e.name).join(", ")}
- Materials: ${materials.length === 0 ? "none" : materials.map(m => `${m.item} x${m.qty} (${m.status})`).join(", ")}
- Customers: ${customers.length === 0 ? "none" : customers.map(c => `${c.name}${c.phone ? ` (${c.phone})` : ""}${c.email ? ` <${c.email}>` : ""}`).join(", ")}

You can perform ALL of the following actions — always use a tool, never just describe what you'd do:

CREATE: create_job, create_invoice, create_quote, log_enquiry, set_reminder, create_material, create_customer
DELETE: delete_job, delete_invoice, delete_enquiry, delete_customer, delete_material
UPDATE: mark_invoice_paid, update_job_status, update_material_status, convert_quote_to_invoice

Rules:
- For jobs: if no year given assume ${new Date().getFullYear()}. Calculate actual dates from "Friday", "next Monday" etc.
- For reminders: calculate minutes_from_now from the time mentioned.
- For updates/deletes: match by name or ID. If no match, say so clearly.
- After every tool use: confirm in 1-2 sentences what you did. Use £ not $. Be concise.
- For invoices/quotes: ALWAYS use the line_items array — one object per item with description and amount. If someone says "invoice for labour £200 and materials £150" create TWO line items: [{description:"Labour",amount:200},{description:"Materials",amount:150}]. Never put multiple items in one description string. Total amount is calculated automatically from the line items.`;

  const send = async (text) => {
    if (!text.trim() || loading) return;
    const userMsg = { role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);
    setLastAction(null);

    try {
      const apiMessages = updated
        .filter(m => m.role === "user" || m.role === "assistant")
        .filter(m => typeof m.content === "string")
        .map(m => ({ role: m.role, content: m.content }));

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: SYSTEM,
          tools: TOOLS,
          messages: apiMessages,
        }),
      });

      const data = await res.json();

      // Surface API errors clearly
      if (data.error) {
        console.error("API error:", data.error);
        setMessages(prev => [...prev, { role: "assistant", content: `API Error: ${data.error.message || JSON.stringify(data.error)}` }]);
        setLoading(false);
        return;
      }

      if (!data.content || data.content.length === 0) {
        console.error("Empty response:", data);
        setMessages(prev => [...prev, { role: "assistant", content: `No response received. Stop reason: ${data.stop_reason || "unknown"}` }]);
        setLoading(false);
        return;
      }

      let replyText = "";
      const toolResults = [];

      for (const block of data.content) {
        if (block.type === "text") {
          replyText += block.text;
        } else if (block.type === "tool_use") {
          const result = executeTool(block.name, block.input);
          toolResults.push(result);
        }
      }

      const finalReply = replyText || toolResults.join("\n") || "Done.";
      setMessages(prev => [...prev, { role: "assistant", content: finalReply }]);

    } catch (e) {
      console.error("AI send error:", e);
      setMessages(prev => [...prev, { role: "assistant", content: `Connection error: ${e.message}. Check your internet connection and try again.` }]);
    }
    setLoading(false);
  };

  const micLabel = transcribing ? "⏳ Transcribing..." : recording ? "⏹ Tap to stop" : "🎙 Voice note";

  const actionIcons = { job: "📅", invoice: "💰", enquiry: "📩", reminder: "🔔", material: "🔧" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 140px)", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {quick.map((q, i) => (
          <button key={i} onClick={() => send(q)} style={{ padding: "5px 12px", background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 20, color: C.textDim, fontSize: 11, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>{q}</button>
        ))}
      </div>

      {/* Last action confirmation banner */}
      {lastAction && (
        <div style={{ background: C.green + "18", border: `1px solid ${C.green}44`, borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
          <span style={{ fontSize: 16 }}>{actionIcons[lastAction.type]}</span>
          <span style={{ color: C.green, fontWeight: 600 }}>{lastAction.label}</span>
          <span style={{ color: C.muted }}>saved successfully</span>
          <button onClick={() => setView(lastAction.view)} style={{ ...S.btn("ghost"), fontSize: 11, padding: "3px 10px", marginLeft: "auto" }}>View →</button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        {messages.map((m, i) => (
          <div key={i} style={S.aiMsg(m.role)}>
            <div style={S.avatar(m.role)}>{m.role === "user" ? brand.tradingName[0] : "⚡"}</div>
            <div style={S.aiBubble(m.role)}>{m.content}</div>
          </div>
        ))}
        {loading && (
          <div style={S.aiMsg("assistant")}>
            <div style={S.avatar("assistant")}>⚡</div>
            <div style={{ ...S.aiBubble("assistant"), color: C.muted }}>Working on it...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {recording && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: C.red + "18", border: `1px solid ${C.red}44`, borderRadius: 6, fontSize: 12, color: C.red }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.red, animation: "bellPulse 1s ease infinite" }} />
          Recording — tap Stop when done
        </div>
      )}
      {transcribing && (
        <div style={{ padding: "6px 12px", background: C.amber + "18", border: `1px solid ${C.amber}44`, borderRadius: 6, fontSize: 12, color: C.amber }}>
          ⏳ Transcribing your voice note...
        </div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea
          style={{ ...S.input, flex: 1, minHeight: 44, maxHeight: 120, resize: "none" }}
          placeholder="Type here, or tap 🎙 to speak..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          rows={2}
        />
        <button
          onClick={toggle}
          disabled={transcribing}
          style={{ padding: "8px 10px", borderRadius: 6, border: `1px solid ${recording ? C.red : C.border}`, background: recording ? C.red + "22" : C.surfaceHigh, color: recording ? C.red : C.muted, fontSize: 11, fontFamily: "'DM Mono',monospace", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
        >{transcribing ? "⏳" : recording ? "⏹ Stop" : "🎙"}</button>
        <button onClick={() => send(input)} style={{ ...S.btn("primary"), padding: "10px 16px" }} disabled={loading || !input.trim()}>Send</button>
      </div>
    </div>
  );
}

// ─── Payments ─────────────────────────────────────────────────────────────────
function Payments({ brand, invoices, setInvoices, customers, user }) {
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [docType, setDocType] = useState("invoices");
  const [selected, setSelected] = useState(null);

  const safeInvoices = invoices || [];
  const allInvoices = safeInvoices.filter(i => !i.isQuote);
  const allQuotes = safeInvoices.filter(i => i.isQuote);

  // Invoice breakdowns
  const paidInvoices = allInvoices.filter(i => i.status === "paid");
  const outstandingInvoices = allInvoices.filter(i => i.status !== "paid");
  const overdueInvoices = allInvoices.filter(i => i.status === "overdue");

  // Quote breakdowns
  const acceptedQuotes = allQuotes.filter(q => q.status === "accepted");
  const pendingQuotes = allQuotes.filter(q => q.status !== "accepted" && q.status !== "declined");
  const declinedQuotes = allQuotes.filter(q => q.status === "declined");

  const updateStatus = (id, status) => {
    const inv = (invoices || []).find(i => i.id === id);
    setInvoices(prev => (prev || []).map(i => i.id === id ? { ...i, status, due: status === "paid" ? "Paid" : i.due } : i));
    if (selected && selected.id === id) setSelected(s => ({ ...s, status, due: status === "paid" ? "Paid" : s.due }));
    if (status === "paid" && inv) syncInvoiceToAccounting(user?.id, { ...inv, status: "paid" });
  };

  const convertToInvoice = (quote) => {
    const newId = `INV-${String(Math.floor(Math.random() * 900) + 100)}`;
    const inv = { ...quote, isQuote: false, id: newId, status: "sent", due: `Due in ${brand.paymentTerms || 30} days` };
    setInvoices(prev => [inv, ...(prev || []).filter(i => i.id !== quote.id)]);
    setSelected(null);
    setDocType("invoices");
  };

  const deleteDoc = (id) => {
    setInvoices(prev => (prev || []).filter(i => i.id !== id));
    setSelected(null);
  };

  const accent = brand.accentColor || "#f59e0b";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Tab switcher */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => { setDocType("invoices"); setSelected(null); }} style={S.pill(accent, docType === "invoices")}>
            💰 Invoices ({allInvoices.length})
          </button>
          <button onClick={() => { setDocType("quotes"); setSelected(null); }} style={S.pill(accent, docType === "quotes")}>
            📋 Quotes ({allQuotes.length})
          </button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={S.btn("ghost")} onClick={() => setShowQuoteModal(true)}>+ Quote</button>
          <button style={S.btn("primary")} onClick={() => setShowInvoiceModal(true)}>+ Invoice</button>
        </div>
      </div>

      {/* ── INVOICES VIEW ── */}
      {docType === "invoices" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 10 }}>
            <div style={S.card}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Outstanding</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: outstandingInvoices.length > 0 ? C.amber : C.muted }}>{outstandingInvoices.length}</div>
              <div style={{ fontSize: 11, color: C.muted }}>£{outstandingInvoices.reduce((s, i) => s + (i.amount || 0), 0).toLocaleString()}</div>
            </div>
            <div style={S.card}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Overdue</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: overdueInvoices.length > 0 ? C.red : C.muted }}>{overdueInvoices.length}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{overdueInvoices.length > 0 ? "Needs chasing" : "None"}</div>
            </div>
            <div style={S.card}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Paid</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.green }}>{paidInvoices.length}</div>
              <div style={{ fontSize: 11, color: C.muted }}>£{paidInvoices.reduce((s, i) => s + (i.amount || 0), 0).toLocaleString()}</div>
            </div>
            <div style={S.card}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Total</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.text }}>{allInvoices.length}</div>
              <div style={{ fontSize: 11, color: C.muted }}>£{allInvoices.reduce((s, i) => s + (i.amount || 0), 0).toLocaleString()}</div>
            </div>
          </div>

          {/* Outstanding */}
          <div style={S.card}>
            <div style={S.sectionTitle}>Outstanding ({outstandingInvoices.length})</div>
            {outstandingInvoices.length === 0
              ? <div style={{ fontSize: 12, color: C.green, fontStyle: "italic" }}>All invoices paid!</div>
              : outstandingInvoices.map(inv => (
                <div key={inv.id} onClick={() => setSelected(inv)} style={{ ...S.row, cursor: "pointer" }}>
                  <div style={{ width: 4, height: 44, borderRadius: 2, background: inv.status === "overdue" ? C.red : C.amber, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{inv.customer}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>{inv.id} · {inv.due}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: inv.status === "overdue" ? C.red : C.text, marginRight: 8, flexShrink: 0 }}>£{inv.amount}</div>
                  <div style={{ ...S.badge(statusColor[inv.status] || C.muted), marginRight: 8, flexShrink: 0 }}>{statusLabel[inv.status] || inv.status}</div>
                  <button onClick={e => { e.stopPropagation(); updateStatus(inv.id, "paid"); }} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px", color: C.green, flexShrink: 0 }}>✓ Paid</button>
                  <div style={{ fontSize: 11, color: C.muted, marginLeft: 4 }}>→</div>
                </div>
              ))
            }
          </div>

          {/* Paid */}
          {paidInvoices.length > 0 && (
            <div style={S.card}>
              <div style={S.sectionTitle}>Paid ({paidInvoices.length})</div>
              {paidInvoices.map(inv => (
                <div key={inv.id} onClick={() => setSelected(inv)} style={{ ...S.row, cursor: "pointer" }}>
                  <div style={{ width: 4, height: 44, borderRadius: 2, background: C.green, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{inv.customer}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>{inv.id}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.green, marginRight: 8, flexShrink: 0 }}>£{inv.amount}</div>
                  <div style={S.badge(C.green)}>Paid</div>
                  <div style={{ fontSize: 11, color: C.muted, marginLeft: 8 }}>→</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── QUOTES VIEW ── */}
      {docType === "quotes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 10 }}>
            <div style={S.card}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Pending</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.blue }}>{pendingQuotes.length}</div>
              <div style={{ fontSize: 11, color: C.muted }}>£{pendingQuotes.reduce((s, q) => s + (q.amount || 0), 0).toLocaleString()}</div>
            </div>
            <div style={S.card}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Accepted</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.green }}>{acceptedQuotes.length}</div>
              <div style={{ fontSize: 11, color: C.muted }}>£{acceptedQuotes.reduce((s, q) => s + (q.amount || 0), 0).toLocaleString()}</div>
            </div>
            <div style={S.card}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Declined</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: declinedQuotes.length > 0 ? C.red : C.muted }}>{declinedQuotes.length}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{declinedQuotes.length > 0 ? "Not won" : "None"}</div>
            </div>
            <div style={S.card}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Pipeline</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.text }}>{allQuotes.length}</div>
              <div style={{ fontSize: 11, color: C.muted }}>£{allQuotes.reduce((s, q) => s + (q.amount || 0), 0).toLocaleString()}</div>
            </div>
          </div>

          {/* All quotes */}
          <div style={S.card}>
            <div style={S.sectionTitle}>All Quotes ({allQuotes.length})</div>
            {allQuotes.length === 0
              ? <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No quotes yet — tap + Quote above or ask the AI Assistant.</div>
              : allQuotes.map(q => (
                <div key={q.id} onClick={() => setSelected(q)} style={{ ...S.row, cursor: "pointer" }}>
                  <div style={{ width: 4, height: 44, borderRadius: 2, background: q.status === "accepted" ? C.green : q.status === "declined" ? C.red : C.blue, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{q.customer}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>{q.address || q.id} · {q.due}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginRight: 8, flexShrink: 0 }}>£{q.amount}</div>
                  <div style={{ ...S.badge(q.status === "accepted" ? C.green : q.status === "declined" ? C.red : C.blue), marginRight: 8, flexShrink: 0 }}>
                    {q.status === "accepted" ? "Accepted" : q.status === "declined" ? "Declined" : "Sent"}
                  </div>
                  <button onClick={e => { e.stopPropagation(); convertToInvoice(q); }} style={{ ...S.btn("primary"), fontSize: 11, padding: "4px 10px", flexShrink: 0 }}>→ Invoice</button>
                  <div style={{ fontSize: 11, color: C.muted, marginLeft: 4 }}>→</div>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }} onClick={() => setSelected(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.card, maxWidth: 480, width: "100%", marginBottom: 16 }}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                  {selected.isQuote ? "Quote" : "Invoice"} · {selected.id}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{selected.customer}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: selected.status === "paid" ? C.green : selected.isQuote ? C.blue : C.amber }}>£{selected.amount}</div>
                  <span style={S.badge(statusColor[selected.status] || C.muted)}>{statusLabel[selected.status] || selected.status}</span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 24 }}>×</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Line Items</div>
                {(selected.lineItems && selected.lineItems.length > 0)
                  ? selected.lineItems.map((l, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingTop: i > 0 ? 6 : 0, borderTop: i > 0 ? `1px solid ${C.border}` : "none", marginTop: i > 0 ? 6 : 0 }}>
                      <span>{l.description}</span>
                      <span style={{ fontWeight: 600, flexShrink: 0, marginLeft: 12 }}>£{(l.amount || 0).toFixed(2)}</span>
                    </div>
                  ))
                  : <div style={{ fontSize: 13, whiteSpace: "pre-line", lineHeight: 1.7 }}>{selected.description || selected.desc || "—"}</div>
                }
              </div>
              <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{selected.isQuote ? "Valid for" : "Payment due"}</div>
                <div style={{ fontSize: 13 }}>{selected.due}</div>
              </div>
            </div>

            {/* Mark Paid — full width green button for invoices */}
            {!selected.isQuote && selected.status !== "paid" && (
              <button style={{ ...S.btn("primary"), width: "100%", justifyContent: "center", padding: "14px", fontSize: 15, background: C.green, color: "#000", marginBottom: 10 }}
                onClick={() => updateStatus(selected.id, "paid")}>
                ✓ Mark as Paid
              </button>
            )}
            {!selected.isQuote && selected.status === "paid" && (
              <div style={{ background: C.green + "18", border: `1px solid ${C.green}44`, borderRadius: 8, padding: "12px 16px", textAlign: "center", color: C.green, fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
                ✓ Invoice Paid
              </div>
            )}

            {/* Convert to Invoice — for quotes */}
            {selected.isQuote && (
              <button style={{ ...S.btn("primary"), width: "100%", justifyContent: "center", padding: "14px", fontSize: 15, marginBottom: 10 }}
                onClick={() => convertToInvoice(selected)}>
                → Convert to Invoice
              </button>
            )}

            {/* Quote accept/decline */}
            {selected.isQuote && selected.status !== "accepted" && selected.status !== "declined" && (
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", color: C.green }} onClick={() => updateStatus(selected.id, "accepted")}>✓ Mark Accepted</button>
                <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", color: C.red }} onClick={() => updateStatus(selected.id, "declined")}>✗ Mark Declined</button>
              </div>
            )}

            {/* Secondary */}
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center" }} onClick={() => downloadInvoicePDF(brand, selected)}>⬇ PDF</button>
              {!selected.isQuote && selected.status === "overdue" && (
                <button style={{ ...S.btn("danger") }} onClick={() => updateStatus(selected.id, "sent")}>📨 Chase</button>
              )}
              <button style={{ ...S.btn("ghost"), color: C.red }} onClick={() => deleteDoc(selected.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {showInvoiceModal && <InvoiceModal brand={brand} onClose={() => setShowInvoiceModal(false)} onSent={(inv) => { setInvoices(prev => [inv, ...(prev || [])]); setShowInvoiceModal(false); syncInvoiceToAccounting(user?.id, inv); }} />}
      {showQuoteModal && <QuoteModal brand={brand} onClose={() => setShowQuoteModal(false)} onSent={(q) => { setInvoices(prev => [q, ...(prev || [])]); setShowQuoteModal(false); setDocType("quotes"); }} />}
    </div>
  );
}

// ─── Invoice Modal ────────────────────────────────────────────────────────────
function InvoiceModal({ brand, onClose, onSent, initialData }) {
  const [form, setForm] = useState(() => initialData ? {
    customer: initialData.customer || "",
    email: initialData.email || "",
    address: initialData.address || "",
    amount: initialData.amount ? String(initialData.amount) : "",
    labour: initialData.cisLabour ? String(initialData.cisLabour) : "",
    materials: initialData.cisMaterials ? String(initialData.cisMaterials) : "",
    desc: initialData.description || initialData.desc || "",
    due: initialData.due?.replace(/\D/g, "") || brand.paymentTerms || "14",
    paymentMethod: initialData.paymentMethod || brand.defaultPaymentMethod || "both",
    vatEnabled: initialData.vatEnabled || false,
    vatRate: initialData.vatRate || 20,
    vatZeroRated: initialData.vatZeroRated || false,
    jobRef: initialData?.jobRef || "",
  const isEditing = !!initialData;
  const [tab, setTab] = useState("form");
  const [sent, setSent] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const valid = form.customer && form.email && (form.cisEnabled ? (form.labour || form.materials) : form.amount);
  const isVatRegistered = !!brand.vatNumber;

  // CIS calculations
  const labourAmt = parseFloat(form.labour) || 0;
  const materialsAmt = parseFloat(form.materials) || 0;
  const cisDeduction = form.cisEnabled ? parseFloat(((labourAmt * form.cisRate) / 100).toFixed(2)) : 0;
  const cisGross = form.cisEnabled ? labourAmt + materialsAmt : 0;
  const cisNetPayable = form.cisEnabled ? parseFloat((cisGross - cisDeduction).toFixed(2)) : 0;

  // Standard amount
  const grossAmount = form.cisEnabled ? cisGross : (parseFloat(form.amount) || 0);
  const vatRate = form.vatZeroRated ? 0 : (form.vatRate || 20);
  const netAmount = (form.vatEnabled && !form.vatZeroRated) ? parseFloat((grossAmount / (1 + vatRate / 100)).toFixed(2)) : grossAmount;
  const vatAmount = (form.vatEnabled && !form.vatZeroRated) ? parseFloat((grossAmount - netAmount).toFixed(2)) : 0;

  const previewRef = buildRef(brand, { id: "INV-043", customer: form.customer || "Customer Name" });

  const send = () => {
    setSent(true);
    setTimeout(() => {
      onSent({
        id: initialData?.id || `INV-0${43 + Math.floor(Math.random() * 10)}`,
        customer: form.customer, email: form.email, address: form.address,
        amount: form.cisEnabled ? cisNetPayable : grossAmount,
        grossAmount: grossAmount,
        due: `Due in ${form.due} days`, status: initialData?.status || "sent",
        description: form.desc,
        vatEnabled: form.vatEnabled, vatRate: form.vatZeroRated ? 0 : vatRate,
        vatZeroRated: form.vatZeroRated,
        cisEnabled: form.cisEnabled, cisRate: form.cisRate,
        cisLabour: labourAmt, cisMaterials: materialsAmt, cisDeduction, cisNetPayable,
        jobRef: form.jobRef || "",
      });
    }, isEditing ? 0 : 1500);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }}>
      <div style={{ ...S.card, maxWidth: 880, width: "100%", marginBottom: 16 }}>
        {sent ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{isEditing ? "✅" : "✅"}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.green, marginBottom: 8 }}>{isEditing ? "Invoice Updated!" : "Invoice Sent!"}</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
              {isEditing ? "Changes saved successfully." : (form.paymentMethod === "card" || form.paymentMethod === "both") ? `Payment link sent to ${form.email}` : `BACS details sent to ${form.email}`}
            </div>
            {form.vatEnabled && (
              <div style={{ ...S.card, background: C.surfaceHigh, padding: 14, display: "inline-block", textAlign: "left", marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 8 }}>VAT BREAKDOWN</div>
                <div style={{ fontSize: 12, color: C.textDim }}>Net: £{netAmount.toFixed(2)} · VAT @ {form.vatRate}%: £{vatAmount.toFixed(2)} · Gross: £{grossAmount.toFixed(2)}</div>
              </div>
            )}
            <div style={{ ...S.card, background: C.surfaceHigh, textAlign: "left", marginBottom: 16, padding: 14, display: "inline-block" }}>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>PAYMENT REFERENCE</div>
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.06em", color: C.amber }}>{previewRef}</div>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{isEditing ? `Edit Invoice · ${initialData.id}` : "New Invoice"}</div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ display: "flex", gap: 4 }}>
                  {["form", "preview"].map(t => <button key={t} onClick={() => setTab(t)} style={S.pill(brand.accentColor, tab === t)}>{t === "form" ? "Details" : "Preview"}</button>)}
                </div>
                <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22 }}>×</button>
              </div>
            </div>

            {tab === "form" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={S.grid2}>
                  {[
                    { k: "customer", l: "Customer Name", p: "e.g. James Oliver" },
                    { k: "email", l: "Customer Email", p: "james@email.com" },
                    { k: "address", l: "Customer Address", p: "5 High Street, Guildford GU1 3AA" },
                  ].map(({ k, l, p }) => (
                    <div key={k}><label style={S.label}>{l}</label>
                      {k === "address" ? <textarea style={{ ...S.input, resize: "none", height: 60 }} placeholder={p} value={form[k]} onChange={set(k)} />
                        : <input style={S.input} placeholder={p} value={form[k]} onChange={set(k)} />}
                    </div>
                  ))}
                  {!form.cisEnabled && (
                    <div><label style={S.label}>{form.vatEnabled && !form.vatZeroRated ? `Amount inc. VAT @ ${vatRate}% (£)` : "Amount (£)"}</label>
                      <input style={S.input} placeholder="e.g. 480" value={form.amount} onChange={set("amount")} />
                    </div>
                  )}
                </div>

                {/* CIS toggle */}
                <div style={{ padding: "14px 16px", background: form.cisEnabled ? "#f59e0b11" : C.surfaceHigh, borderRadius: 8, border: `1px solid ${form.cisEnabled ? "#f59e0b66" : C.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: form.cisEnabled ? 14 : 0 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>CIS — Construction Industry Scheme</div>
                      <div style={{ fontSize: 11, color: C.muted }}>For subcontracting to contractors who deduct CIS tax from labour</div>
                    </div>
                    <button onClick={() => setForm(f => ({ ...f, cisEnabled: !f.cisEnabled }))} style={{ padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontFamily: "'DM Mono',monospace", fontWeight: 700, background: form.cisEnabled ? C.amber : C.border, color: form.cisEnabled ? "#000" : C.muted, transition: "all 0.2s", flexShrink: 0, marginLeft: 12 }}>
                      {form.cisEnabled ? "CIS On ✓" : "Enable CIS"}
                    </button>
                  </div>
                  {form.cisEnabled && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={S.grid2}>
                        <div>
                          <label style={S.label}>Labour (£)</label>
                          <input style={S.input} type="number" placeholder="e.g. 400" value={form.labour} onChange={set("labour")} />
                        </div>
                        <div>
                          <label style={S.label}>Materials (£) <span style={{ color: C.muted, fontWeight: 400 }}>(no CIS deduction)</span></label>
                          <input style={S.input} type="number" placeholder="e.g. 80" value={form.materials} onChange={set("materials")} />
                        </div>
                      </div>
                      <div>
                        <label style={S.label}>CIS Deduction Rate</label>
                        <div style={{ display: "flex", gap: 8 }}>
                          {[{ v: 20, l: "20% — Registered" }, { v: 30, l: "30% — Unregistered" }].map(({ v, l }) => (
                            <button key={v} onClick={() => setForm(f => ({ ...f, cisRate: v }))} style={{ ...S.pill(C.amber, form.cisRate === v), fontSize: 11 }}>{l}</button>
                          ))}
                        </div>
                      </div>
                      {(labourAmt > 0 || materialsAmt > 0) && (
                        <div style={{ background: C.surface, borderRadius: 8, padding: "12px 14px", border: `1px solid ${C.border}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span style={{ color: C.muted }}>Labour</span><span>£{labourAmt.toFixed(2)}</span></div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span style={{ color: C.muted }}>Materials</span><span>£{materialsAmt.toFixed(2)}</span></div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}><span style={{ color: C.muted }}>Gross Total</span><span>£{cisGross.toFixed(2)}</span></div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4, color: C.red }}><span>CIS Deduction ({form.cisRate}% of labour)</span><span>-£{cisDeduction.toFixed(2)}</span></div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, color: C.green }}><span>Net Payable to You</span><span>£{cisNetPayable.toFixed(2)}</span></div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div><label style={S.label}>Description (one line per item)</label>
                  <textarea style={{ ...S.input, resize: "vertical", minHeight: 80 }} placeholder={"Annual boiler service\nFlue check and clean\nPressure test"} value={form.desc} onChange={set("desc")} />
                </div>

                <div><label style={S.label}>Job Reference <span style={{ color: C.muted, fontWeight: 400 }}>(optional)</span></label>
                  <input style={S.input} placeholder="e.g. Kitchen refurb Phase 2, Job #1042" value={form.jobRef || ""} onChange={set("jobRef")} />
                </div>

                {/* VAT toggle */}
                {isVatRegistered ? (
                  <div style={{ padding: "14px 16px", background: C.surfaceHigh, borderRadius: 8, border: `1px solid ${(form.vatEnabled || form.vatZeroRated) ? C.amber + "66" : C.border}` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>VAT</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={() => setForm(f => ({ ...f, vatEnabled: false, vatZeroRated: false }))} style={{ ...S.pill(C.amber, !form.vatEnabled && !form.vatZeroRated), fontSize: 11 }}>No VAT</button>
                      <button onClick={() => setForm(f => ({ ...f, vatEnabled: true, vatZeroRated: false, vatRate: 20 }))} style={{ ...S.pill(C.amber, form.vatEnabled && form.vatRate === 20 && !form.vatZeroRated), fontSize: 11 }}>Standard 20%</button>
                      <button onClick={() => setForm(f => ({ ...f, vatEnabled: true, vatZeroRated: false, vatRate: 5 }))} style={{ ...S.pill(C.amber, form.vatEnabled && form.vatRate === 5 && !form.vatZeroRated), fontSize: 11 }}>Reduced 5%</button>
                      <button onClick={() => setForm(f => ({ ...f, vatEnabled: true, vatZeroRated: true, vatRate: 0 }))} style={{ ...S.pill(C.green, form.vatZeroRated), fontSize: 11 }}>0% New Build</button>
                    </div>
                    {form.vatZeroRated && (
                      <div style={{ fontSize: 11, color: C.green, marginTop: 8 }}>✓ Zero-rated — new residential build. VAT shown as £0.00 on invoice. Xero tax code: ZERORATEDOUTPUT</div>
                    )}
                    {form.vatEnabled && !form.vatZeroRated && grossAmount > 0 && (
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Net: £{netAmount.toFixed(2)} + VAT £{vatAmount.toFixed(2)} = Gross £{grossAmount.toFixed(2)}</div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 11, color: C.muted }}>
                    VAT registered? Add your VAT number in Settings to enable VAT invoices. Zero-rated new build option also available.
                  </div>
                )}

                <div style={S.grid2}>
                  <div>
                    <label style={S.label}>Payment Due</label>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {["0", "7", "14"].map(d => <button key={d} onClick={() => setForm(f => ({ ...f, due: d }))} style={S.pill(brand.accentColor, form.due === d)}>{d} days</button>)}
                      <button onClick={() => setForm(f => ({ ...f, due: "custom" }))} style={S.pill(brand.accentColor, !["0","7","14"].includes(form.due))}>Custom</button>
                    </div>
                    {!["0","7","14"].includes(form.due) && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                        <input
                          style={{ ...S.input, width: 80 }}
                          type="number"
                          min="1"
                          placeholder="e.g. 60"
                          value={form.due === "custom" ? "" : form.due}
                          onChange={e => setForm(f => ({ ...f, due: e.target.value }))}
                        />
                        <span style={{ fontSize: 12, color: C.muted }}>days</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={S.label}>Payment Method</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {[{ v: "bacs", label: "🏦 BACS" }, { v: "card", label: "💳 Card" }, { v: "both", label: "🏦💳 Both" }].map(({ v, label }) => (
                        <button key={v} onClick={() => setForm(f => ({ ...f, paymentMethod: v }))} style={S.pill(brand.accentColor, form.paymentMethod === v)}>{label}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8, border: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>PAYMENT REFERENCE CUSTOMER MUST USE</div>
                    <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.06em", color: brand.accentColor }}>{previewRef}</div>
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, textAlign: "right" }}>
                    Format: {brand.refFormat?.replace(/_/g, " ")}<br />
                    <span style={{ fontSize: 10 }}>Change in Settings</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button style={S.btn("ghost")} onClick={() => setTab("preview")} disabled={!valid}>Preview Invoice →</button>
                  {(form.paymentMethod === "card" || form.paymentMethod === "both")
                    ? <button style={S.btn("stripe", !valid)} disabled={!valid} onClick={send}><span style={{ fontWeight: 900 }}>S</span> {isEditing ? "Save Changes →" : "Send via Stripe →"}</button>
                    : <button style={S.btn("primary", !valid)} disabled={!valid} onClick={send}>{isEditing ? "Save Changes →" : "Send Invoice →"}</button>
                  }
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "center" }}>
                <InvoicePreview brand={brand} invoice={{ id: "INV-043", customer: form.customer || "Customer Name", address: form.address || "Customer Address", desc: form.desc || "Service description", amount: form.amount || "0", date: new Date().toLocaleDateString("en-GB"), due: form.due, paymentMethod: form.paymentMethod, vatEnabled: form.vatEnabled, vatRate: form.vatRate }} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Quote Modal ──────────────────────────────────────────────────────────────
function QuoteModal({ brand, onClose, onSent, initialData }) {
  const [form, setForm] = useState(() => initialData ? {
    customer: initialData.customer || "",
    email: initialData.email || "",
    address: initialData.address || "",
    amount: initialData.amount ? String(initialData.amount) : "",
    desc: initialData.description || initialData.desc || "",
    validDays: initialData.due?.replace(/\D/g, "") || "30",
    vatEnabled: initialData.vatEnabled || false,
    vatRate: initialData.vatRate || 20,
  } : { customer: "", email: "", address: "", amount: "", desc: "", validDays: "30", vatEnabled: false, vatRate: 20, jobRef: "" });
  const isEditing = !!initialData;
  const [tab, setTab] = useState("form");
  const [sent, setSent] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const valid = form.customer && form.amount;
  const isVatRegistered = !!brand.vatNumber;
  const grossAmount = parseFloat(form.amount) || 0;
  const netAmount = form.vatEnabled ? parseFloat((grossAmount / (1 + form.vatRate / 100)).toFixed(2)) : grossAmount;
  const vatAmount = form.vatEnabled ? parseFloat((grossAmount - netAmount).toFixed(2)) : 0;

  const send = () => {
    setSent(true);
    setTimeout(() => {
      const id = initialData?.id || `QTE-${String(Math.floor(Math.random() * 900) + 100)}`;
      onSent({
        id, customer: form.customer, email: form.email, address: form.address, amount: grossAmount,
        due: `Valid for ${form.validDays} days`, status: initialData?.status || "sent",
        description: form.desc, isQuote: true,
        vatEnabled: form.vatEnabled, vatRate: form.vatRate,
        jobRef: form.jobRef || "",
      });
    }, isEditing ? 0 : 1000);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }}>
      <div style={{ ...S.card, maxWidth: 880, width: "100%", marginBottom: 16 }}>
        {sent ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.blue, marginBottom: 8 }}>{isEditing ? "Quote Updated!" : "Quote Created!"}</div>
            <div style={{ fontSize: 12, color: C.muted }}>{isEditing ? "Changes saved successfully." : `Quote sent to ${form.email || form.customer}. Valid for ${form.validDays} days.`}</div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{isEditing ? `Edit Quote · ${initialData.id}` : "New Quote"}</div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ display: "flex", gap: 4 }}>
                  {["form", "preview"].map(t => <button key={t} onClick={() => setTab(t)} style={S.pill(C.blue, tab === t)}>{t === "form" ? "Details" : "Preview"}</button>)}
                </div>
                <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22 }}>×</button>
              </div>
            </div>

            {tab === "form" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={S.grid2}>
                  {[
                    { k: "customer", l: "Customer Name", p: "e.g. James Oliver" },
                    { k: "email", l: "Customer Email", p: "james@email.com" },
                    { k: "address", l: "Customer Address", p: "5 High Street, Guildford GU1 3AA" },
                    { k: "amount", l: form.vatEnabled ? `Total inc. VAT @ ${form.vatRate}% (£)` : "Quote Amount (£)", p: "e.g. 480" },
                  ].map(({ k, l, p }) => (
                    <div key={k}><label style={S.label}>{l}</label>
                      {k === "address" ? <textarea style={{ ...S.input, resize: "none", height: 60 }} placeholder={p} value={form[k]} onChange={set(k)} />
                        : <input style={S.input} placeholder={p} value={form[k]} onChange={set(k)} />}
                    </div>
                  ))}
                </div>

                <div><label style={S.label}>Description of work (one line per item)</label>
                  <textarea style={{ ...S.input, resize: "vertical", minHeight: 80 }} placeholder={"Supply and fit new boiler\nMagnetic filter installation\nFlue check and test"} value={form.desc} onChange={set("desc")} />
                </div>

                <div><label style={S.label}>Job Reference <span style={{ color: C.muted, fontWeight: 400 }}>(optional)</span></label>
                  <input style={S.input} placeholder="e.g. Kitchen refurb Phase 2, Job #1042" value={form.jobRef || ""} onChange={set("jobRef")} />
                </div>

                {/* VAT toggle */}
                {isVatRegistered && (
                  <div style={{ padding: "14px 16px", background: C.surfaceHigh, borderRadius: 8, border: `1px solid ${form.vatEnabled ? C.blue + "66" : C.border}`, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 3 }}>VAT Quote</div>
                      {form.vatEnabled && grossAmount > 0
                        ? <div style={{ fontSize: 11, color: C.muted }}>Net: £{netAmount.toFixed(2)} + VAT £{vatAmount.toFixed(2)} = Total £{grossAmount.toFixed(2)}</div>
                        : <div style={{ fontSize: 11, color: C.muted }}>VAT No: {brand.vatNumber} — toggle to show VAT breakdown</div>}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                      {form.vatEnabled && (
                        <div style={{ display: "flex", gap: 6 }}>
                          {[20, 5, 0].map(r => (
                            <button key={r} onClick={() => setForm(f => ({ ...f, vatRate: r }))} style={{ ...S.pill(C.blue, form.vatRate === r), fontSize: 11, padding: "4px 10px" }}>{r}%</button>
                          ))}
                        </div>
                      )}
                      <button onClick={() => setForm(f => ({ ...f, vatEnabled: !f.vatEnabled }))} style={{ padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontFamily: "'DM Mono',monospace", fontWeight: 700, background: form.vatEnabled ? C.blue : C.border, color: form.vatEnabled ? "#fff" : C.muted, transition: "all 0.2s" }}>
                        {form.vatEnabled ? "VAT On ✓" : "Add VAT"}
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label style={S.label}>Quote Valid For</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {["0", "7", "14"].map(d => <button key={d} onClick={() => setForm(f => ({ ...f, validDays: d }))} style={S.pill(C.blue, form.validDays === d)}>{d} days</button>)}
                      <button onClick={() => setForm(f => ({ ...f, validDays: "custom" }))} style={S.pill(C.blue, !["0","7","14"].includes(form.validDays))}>Custom</button>
                    </div>
                    {!["0","7","14"].includes(form.validDays) && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                        <input
                          style={{ ...S.input, width: 80 }}
                          type="number"
                          min="1"
                          placeholder="e.g. 90"
                          value={form.validDays === "custom" ? "" : form.validDays}
                          onChange={e => setForm(f => ({ ...f, validDays: e.target.value }))}
                        />
                        <span style={{ fontSize: 12, color: C.muted }}>days</span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button style={S.btn("ghost")} onClick={() => setTab("preview")} disabled={!valid}>Preview Quote →</button>
                  <button style={{ ...S.btn("primary", !valid), background: valid ? C.blue : undefined }} disabled={!valid} onClick={send}>{isEditing ? "Save Changes →" : "Send Quote →"}</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "center" }}>
                <InvoicePreview brand={brand} invoice={{ id: "QTE-001", customer: form.customer || "Customer Name", address: form.address || "Customer Address", desc: form.desc || "Description of work", amount: form.amount || "0", date: new Date().toLocaleDateString("en-GB"), due: `Valid for ${form.validDays} days`, isQuote: true, vatEnabled: form.vatEnabled, vatRate: form.vatRate }} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
function useReminders(userId) {
  const [reminders, setRemindersRaw] = useState([]);

  // Load from localStorage once userId is known
  useEffect(() => {
    if (!userId) return;
    try {
      const saved = localStorage.getItem(`trade-pa-reminders-${userId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Only restore reminders that haven't fired yet or are completed
        const valid = parsed.filter(r => r.done || r.time > Date.now() - 1000 * 60 * 60);
        setRemindersRaw(valid);
      }
    } catch {}
  }, [userId]);

  const persist = (next) => {
    if (userId) {
      try { localStorage.setItem(`trade-pa-reminders-${userId}`, JSON.stringify(next)); } catch {}
    }
  };

  const add = (reminder) => setRemindersRaw(prev => {
    const next = [reminder, ...prev];
    persist(next);
    return next;
  });
  const dismiss = (id) => setRemindersRaw(prev => {
    const next = prev.map(r => r.id === id ? { ...r, done: true } : r);
    persist(next);
    return next;
  });
  const remove = (id) => setRemindersRaw(prev => {
    const next = prev.filter(r => r.id !== id);
    persist(next);
    return next;
  });

  return { reminders, add, dismiss, remove };
}

function formatCountdown(ms) {
  if (ms <= 0) return "Now";
  const mins = Math.floor(ms / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `in ${days}d ${hrs % 24}h`;
  if (hrs > 0) return `in ${hrs}h ${mins % 60}m`;
  if (mins > 0) return `in ${mins}m`;
  return "in <1m";
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function formatDate(ts) {
  const d = new Date(ts);
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function Reminders({ reminders, onAdd, onDismiss, onRemove, dueNow, onClearDue }) {
  const [input, setInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [notifStatus, setNotifStatus] = useState("unknown");

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if ("Notification" in window) setNotifStatus(Notification.permission);
  }, []);

  const requestNotifPermission = async () => {
    try {
      const result = await Notification.requestPermission();
      setNotifStatus(result);
    } catch {
      setNotifStatus("denied");
    }
  };

  const SYSTEM_PROMPT = `You are a reminder parser. The user is a UK tradesperson. Extract a reminder from their natural language input.

Return ONLY valid JSON, no other text:
{
  "text": "short reminder title (max 60 chars)",
  "minutesFromNow": <integer — minutes from now until reminder should fire>,
  "timeLabel": "human readable time e.g. '3:00 PM today' or 'tomorrow 9 AM'"
}

Rules:
- "in 10 minutes" = 10
- "at 3pm" = minutes until 3pm today (if already past, assume tomorrow)
- "tomorrow morning" = assume 9:00 AM tomorrow
- "tomorrow at 2" = 2:00 PM tomorrow
- "end of day" = 5:00 PM today
- "in an hour" = 60
- If no time given, default to 30 minutes
- Current time is ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;

  const parseReminder = async (text) => {
    if (!text.trim()) return;
    setParsing(true);
    setParseError("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 200,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: text }],
        }),
      });
      const data = await res.json();
      const raw = data.content?.[0]?.text || "{}";
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);

      const fireAt = Date.now() + (parsed.minutesFromNow || 30) * 60000;
      const reminder = {
        id: `r${Date.now()}`,
        text: parsed.text || text,
        time: fireAt,
        timeLabel: parsed.timeLabel || "",
        done: false,
        raw: text,
      };

      onAdd(reminder);
      setInput("");

      // Schedule notification
      const delay = fireAt - Date.now();
      if (delay > 0) {
        setTimeout(() => {
          // Try browser notification
          if ("Notification" in window && Notification.permission === "granted") {
            try {
              new Notification("Trade PA Reminder 🔔", {
                body: reminder.text,
                icon: "/favicon.ico",
              });
            } catch {}
          }
          // Always trigger in-app
          onAdd({ ...reminder, _due: true });
        }, delay);
      }
    } catch (e) {
      setParseError("Couldn't parse that — try again or type more clearly, e.g. 'remind me to call Dave at 3pm'");
    }
    setParsing(false);
  };

  const { recording: recRecording, transcribing: recTranscribing, toggle: recToggle } = useWhisper((text) => {
    if (text) setInput(text);
  });

  const upcoming = reminders.filter(r => !r.done && !r._due).sort((a, b) => a.time - b.time);
  const overdue = reminders.filter(r => !r.done && !r._due && r.time < now);
  const done = reminders.filter(r => r.done);

  const examples = [
    "Remind me to chase James Oliver at 3pm",
    "Call Emma Taylor back in 2 hours",
    "Order copper pipe tomorrow morning",
    "Check boiler parts invoice end of day",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Due now alert */}
      {dueNow.length > 0 && (
        <div style={{ background: C.red + "18", border: `1px solid ${C.red}44`, borderRadius: 10, padding: 16, display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ fontSize: 28 }}>🔔</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.red, marginBottom: 6 }}>Reminder Due</div>
            {dueNow.map((r, i) => (
              <div key={i} style={{ fontSize: 13, color: C.text, marginBottom: 4 }}>— {r.text}</div>
            ))}
          </div>
          <button style={S.btn("ghost")} onClick={onClearDue}>Dismiss all</button>
        </div>
      )}

      {/* Notification permission banner */}
      {notifStatus === "default" && (
        <div style={{ ...S.card, borderColor: C.amber + "44", background: C.amber + "08", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 24 }}>🔔</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Enable push notifications</div>
            <div style={{ fontSize: 12, color: C.muted }}>Get a browser notification when a reminder fires — even if the app isn't open.</div>
          </div>
          <button style={S.btn("primary")} onClick={requestNotifPermission}>Enable →</button>
        </div>
      )}
      {notifStatus === "denied" && (
        <div style={{ ...S.card, borderColor: C.muted + "44", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 20 }}>⚠️</div>
          <div style={{ flex: 1, fontSize: 12, color: C.muted }}>Browser notifications are blocked. Reminders will show in-app only. Allow notifications in your browser settings to get push alerts.</div>
        </div>
      )}
      {notifStatus === "granted" && (
        <div style={{ ...S.card, borderColor: C.green + "44", background: C.green + "08", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 20 }}>✅</div>
          <div style={{ fontSize: 12, color: C.green }}>Push notifications enabled — you'll get alerted even when the app isn't in focus.</div>
        </div>
      )}

      {/* Input */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Set a Reminder</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
          Speak or type naturally — "remind me to call Kevin at 3pm" or "chase Paul Wright invoice in 2 hours"
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {examples.map((ex, i) => (
            <button key={i} onClick={() => setInput(ex)} style={{ padding: "5px 12px", background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 20, color: C.textDim, fontSize: 11, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>{ex}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <input
            style={{ ...S.input, flex: 1 }}
            placeholder="e.g. Remind me to call Kevin Nash at 3pm today..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") parseReminder(input); }}
          />
          <button
            onClick={recToggle}
            disabled={recTranscribing}
            style={{ ...S.btn("ghost"), padding: "10px 14px", fontSize: 14, background: recRecording ? C.red + "33" : C.surfaceHigh, border: `1px solid ${recRecording ? C.red : C.border}`, color: recRecording ? C.red : C.textDim, whiteSpace: "nowrap" }}
          >{recTranscribing ? "⏳" : recRecording ? "⏹ Stop" : "🎙 Record"}</button>
          <button onClick={() => parseReminder(input)} style={{ ...S.btn("primary"), padding: "10px 20px" }} disabled={parsing || !input.trim()}>
            {parsing ? "Parsing..." : "Set →"}
          </button>
        </div>
        {parseError && <div style={{ fontSize: 12, color: C.red, marginTop: 10 }}>{parseError}</div>}
      </div>

      {/* Upcoming reminders */}
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={S.sectionTitle}>Upcoming ({upcoming.length})</div>
        </div>
        {upcoming.length === 0 && <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No upcoming reminders. Set one above.</div>}
        {upcoming.map(r => {
          const ms = r.time - now;
          const isUrgent = ms < 1000 * 60 * 15;
          const isPast = ms <= 0;
          return (
            <div key={r.id} style={{ ...S.row, alignItems: "flex-start" }}>
              <div style={{ width: 4, height: 40, borderRadius: 2, background: isPast ? C.red : isUrgent ? C.amber : C.green, flexShrink: 0, marginTop: 4 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{r.text}</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: C.muted }}>{formatDate(r.time)} at {formatTime(r.time)}</span>
                  <span style={{ ...S.badge(isPast ? C.red : isUrgent ? C.amber : C.blue) }}>
                    {isPast ? "Overdue" : formatCountdown(ms)}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button onClick={() => onDismiss(r.id)} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px" }}>Done ✓</button>
                <button onClick={() => onRemove(r.id)} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px", color: C.muted }}>✕</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Completed */}
      {done.length > 0 && (
        <div style={{ ...S.card, opacity: 0.7 }}>
          <div style={S.sectionTitle}>Completed ({done.length})</div>
          {done.map(r => (
            <div key={r.id} style={{ ...S.row, alignItems: "center" }}>
              <div style={{ fontSize: 13, color: C.muted, textDecoration: "line-through", flex: 1 }}>{r.text}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{formatDate(r.time)} {formatTime(r.time)}</div>
              <button onClick={() => onRemove(r.id)} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px", marginLeft: 10, color: C.muted }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Sandbox note */}
      <div style={{ ...S.card, background: C.surfaceHigh, borderStyle: "dashed" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ fontSize: 20 }}>ℹ️</div>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
            <strong style={{ color: C.textDim }}>Voice notes:</strong> Hold the 🎙 button, speak, then release. Works on iPhone, Android, and all browsers. Transcription takes about 2 seconds via Whisper AI. Try it now — type "remind me in 1 minute" to test the reminder system.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
// ─── Customers ────────────────────────────────────────────────────────────────
function Customers({ customers, setCustomers, jobs, invoices, setView }) {
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", notes: "" });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const save = () => {
    if (!form.name) return;
    if (editing) {
      setCustomers(prev => prev.map(c => c.id === selected.id ? { ...c, ...form } : c));
      setSelected({ ...selected, ...form });
      setEditing(false);
    } else {
      const c = { ...form, id: Date.now() };
      setCustomers(prev => [...prev, c]);
      setShowAdd(false);
      setForm({ name: "", phone: "", email: "", address: "", notes: "" });
    }
  };

  const del = (id) => { setCustomers(prev => prev.filter(c => c.id !== id)); setSelected(null); };

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || "").includes(search)
  );

  const jobsForCustomer = (name) => jobs.filter(j => j.customer?.toLowerCase() === name?.toLowerCase());
  const invoicesForCustomer = (name) => invoices.filter(i => i.customer?.toLowerCase() === name?.toLowerCase());

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Customers</div>
        <button style={S.btn("primary")} onClick={() => { setForm({ name: "", phone: "", email: "", address: "", notes: "" }); setShowAdd(true); }}>+ Add Customer</button>
      </div>

      {/* Search */}
      <input
        style={S.input}
        placeholder="Search by name, email or phone..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Customer list */}
      <div style={S.card}>
        <div style={S.sectionTitle}>All Customers ({customers.length})</div>
        {customers.length === 0
          ? <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No customers yet. Add one above or they'll be added automatically when you book jobs via the AI Assistant.</div>
          : filtered.length === 0
          ? <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No customers match your search.</div>
          : filtered.map(c => {
            const cJobs = jobsForCustomer(c.name);
            const cInvoices = invoicesForCustomer(c.name);
            const totalSpend = cInvoices.reduce((s, i) => s + (i.amount || 0), 0);
            return (
              <div key={c.id} onClick={() => setSelected(c)} style={{ ...S.row, cursor: "pointer" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.amber + "22", border: `1px solid ${C.amber}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: C.amber, flexShrink: 0 }}>
                  {c.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>
                    {[c.phone, c.email].filter(Boolean).join(" · ") || "No contact details"}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: C.muted, textAlign: "right", flexShrink: 0 }}>
                  {cJobs.length > 0 && <div>{cJobs.length} job{cJobs.length !== 1 ? "s" : ""}</div>}
                  {totalSpend > 0 && <div style={{ color: C.amber }}>£{totalSpend.toLocaleString()}</div>}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginLeft: 10 }}>→</div>
              </div>
            );
          })
        }
      </div>

      {/* Customer Detail Modal */}
      {selected && !editing && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }} onClick={() => setSelected(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.card, maxWidth: 500, width: "100%", marginBottom: 16 }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: C.amber + "22", border: `1px solid ${C.amber}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: C.amber, flexShrink: 0 }}>
                  {selected.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>{selected.name}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{selected.address || "No address"}</div>
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22 }}>×</button>
            </div>

            {/* Contact details */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>Phone</div>
                {selected.phone
                  ? <a href={`tel:${selected.phone.replace(/\s/g, "")}`} style={{ fontSize: 13, color: C.amber, textDecoration: "none", fontFamily: "'DM Mono',monospace" }}>📞 {selected.phone}</a>
                  : <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>Not set</div>}
              </div>
              <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>Email</div>
                {selected.email
                  ? <a href={`mailto:${selected.email}`} style={{ fontSize: 12, color: C.blue, textDecoration: "none", wordBreak: "break-all" }}>✉ {selected.email}</a>
                  : <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>Not set</div>}
              </div>
            </div>

            {/* Notes */}
            {selected.notes && (
              <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8, marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>Notes</div>
                <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{selected.notes}</div>
              </div>
            )}

            {/* Job history */}
            {jobsForCustomer(selected.name).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>Job History</div>
                {jobsForCustomer(selected.name).map(j => (
                  <div key={j.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                    <span style={{ color: C.text }}>{j.type}</span>
                    <span style={{ color: C.muted }}>{j.dateObj ? new Date(j.dateObj).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : j.date}</span>
                    {j.value > 0 && <span style={{ color: C.amber }}>£{j.value}</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Invoice history */}
            {invoicesForCustomer(selected.name).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>Invoice History</div>
                {invoicesForCustomer(selected.name).map(i => (
                  <div key={i.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                    <span style={{ color: C.muted }}>{i.id}</span>
                    <span style={{ color: C.text }}>£{i.amount}</span>
                    <span style={S.badge(statusColor[i.status] || C.muted)}>{statusLabel[i.status] || i.status}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button style={S.btn("primary")} onClick={() => { setEditing(true); setForm({ name: selected.name, phone: selected.phone || "", email: selected.email || "", address: selected.address || "", notes: selected.notes || "" }); }}>Edit</button>
              {selected.phone && <a href={`tel:${selected.phone.replace(/\s/g, "")}`} style={{ ...S.btn("ghost"), textDecoration: "none" }}>📞 Call</a>}
              {selected.email && <a href={`mailto:${selected.email}`} style={{ ...S.btn("ghost"), textDecoration: "none" }}>✉ Email</a>}
              <button style={{ ...S.btn("ghost"), color: C.red, marginLeft: "auto" }} onClick={() => del(selected.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {selected && editing && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 310, padding: 16 }}>
          <div style={{ ...S.card, maxWidth: 440, width: "100%", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Edit Customer</div>
              <button onClick={() => setEditing(false)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22 }}>×</button>
            </div>
            <CustomerForm form={form} set={set} onSave={save} onCancel={() => setEditing(false)} />
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }}>
          <div style={{ ...S.card, maxWidth: 440, width: "100%", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Add Customer</div>
              <button onClick={() => setShowAdd(false)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22 }}>×</button>
            </div>
            <CustomerForm form={form} set={set} onSave={save} onCancel={() => setShowAdd(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerForm({ form, set, onSave, onCancel }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {[
        { k: "name", l: "Full Name", p: "e.g. John Smith", required: true },
        { k: "phone", l: "Phone Number", p: "e.g. 07700 900123" },
        { k: "email", l: "Email Address", p: "e.g. john@email.com" },
        { k: "address", l: "Address", p: "e.g. 5 High Street, Guildford, GU1 3AA" },
      ].map(({ k, l, p, required }) => (
        <div key={k}>
          <label style={S.label}>{l}{required && <span style={{ color: C.red }}> *</span>}</label>
          <input style={S.input} placeholder={p} value={form[k]} onChange={set(k)} />
        </div>
      ))}
      <div>
        <label style={S.label}>Notes</label>
        <textarea style={{ ...S.input, resize: "vertical", minHeight: 72 }} placeholder="e.g. Prefers morning appointments, gate code 1234..." value={form.notes} onChange={set("notes")} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={S.btn("primary", !form.name)} disabled={!form.name} onClick={onSave}>Save →</button>
        <button style={S.btn("ghost")} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Invoices View ────────────────────────────────────────────────────────────
function InvoicesView({ brand, invoices, setInvoices, user }) {
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);

  const allInvoices = (invoices || []).filter(i => !i.isQuote);
  const paid = allInvoices.filter(i => i.status === "paid");
  const outstanding = allInvoices.filter(i => i.status !== "paid");
  const overdue = allInvoices.filter(i => i.status === "overdue");

  const updateStatus = (id, status) => {
    const inv = (invoices || []).find(i => i.id === id);
    setInvoices(prev => (prev || []).map(i => i.id === id ? { ...i, status, due: status === "paid" ? "Paid" : i.due } : i));
    if (selected && selected.id === id) setSelected(s => ({ ...s, status, due: status === "paid" ? "Paid" : s.due }));
    // Sync paid status to accounting software
    if (status === "paid" && inv && user?.id) {
      syncInvoiceToAccounting(user.id, { ...inv, status: "paid" });
    }
  };

  const deleteInvoice = (id) => {
    setInvoices(prev => (prev || []).filter(i => i.id !== id));
    setSelected(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Invoices</div>
        <button style={S.btn("primary")} onClick={() => setShowModal(true)}>+ New Invoice</button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 10 }}>
        <div style={S.card}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Outstanding</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: outstanding.length > 0 ? C.amber : C.muted }}>{outstanding.length}</div>
          <div style={{ fontSize: 11, color: C.muted }}>£{outstanding.reduce((s, i) => s + (i.amount || 0), 0).toLocaleString()}</div>
        </div>
        <div style={S.card}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Overdue</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: overdue.length > 0 ? C.red : C.muted }}>{overdue.length}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{overdue.length > 0 ? "Needs chasing" : "All on time"}</div>
        </div>
        <div style={S.card}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Paid</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: C.green }}>{paid.length}</div>
          <div style={{ fontSize: 11, color: C.muted }}>£{paid.reduce((s, i) => s + (i.amount || 0), 0).toLocaleString()}</div>
        </div>
        <div style={S.card}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Total</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: C.text }}>{allInvoices.length}</div>
          <div style={{ fontSize: 11, color: C.muted }}>£{allInvoices.reduce((s, i) => s + (i.amount || 0), 0).toLocaleString()}</div>
        </div>
      </div>

      {/* Outstanding list */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Outstanding ({outstanding.length})</div>
        {outstanding.length === 0
          ? <div style={{ fontSize: 12, color: C.green, fontStyle: "italic" }}>All invoices paid — great work!</div>
          : outstanding.map(inv => (
            <div key={inv.id} onClick={() => setSelected(inv)} style={{ ...S.row, cursor: "pointer" }}>
              <div style={{ width: 4, height: 44, borderRadius: 2, background: inv.status === "overdue" ? C.red : C.amber, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{inv.customer}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{inv.address || inv.id} · {inv.due}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: inv.status === "overdue" ? C.red : C.text, marginRight: 8, flexShrink: 0 }}>£{inv.amount}</div>
              <div style={{ ...S.badge(statusColor[inv.status] || C.muted), marginRight: 8, flexShrink: 0 }}>{statusLabel[inv.status] || inv.status}</div>
              <button onClick={e => { e.stopPropagation(); updateStatus(inv.id, "paid"); }} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px", color: C.green, flexShrink: 0 }}>✓ Paid</button>
              <div style={{ fontSize: 11, color: C.muted, marginLeft: 4 }}>→</div>
            </div>
          ))
        }
      </div>

      {/* Paid list */}
      {paid.length > 0 && (
        <div style={S.card}>
          <div style={S.sectionTitle}>Paid ({paid.length})</div>
          {paid.map(inv => (
            <div key={inv.id} onClick={() => setSelected(inv)} style={{ ...S.row, cursor: "pointer" }}>
              <div style={{ width: 4, height: 44, borderRadius: 2, background: C.green, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{inv.customer}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{inv.address || inv.id}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.green, marginRight: 8, flexShrink: 0 }}>£{inv.amount}</div>
              <div style={S.badge(C.green)}>Paid</div>
              <div style={{ fontSize: 11, color: C.muted, marginLeft: 8 }}>→</div>
            </div>
          ))}
        </div>
      )}

      {allInvoices.length === 0 && (
        <div style={{ ...S.card, textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>💰</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>No invoices yet</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>Create your first invoice or ask the AI Assistant.</div>
          <button style={S.btn("primary")} onClick={() => setShowModal(true)}>+ Create Invoice</button>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }} onClick={() => setSelected(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.card, maxWidth: 480, width: "100%", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Invoice · {selected.id}</div>
                <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{selected.customer}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: selected.status === "paid" ? C.green : C.amber }}>£{selected.amount}</div>
                  <span style={S.badge(statusColor[selected.status] || C.muted)}>{statusLabel[selected.status] || selected.status}</span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 24 }}>×</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              {selected.address && (
                <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Address</div>
                  <div style={{ fontSize: 13 }}>{selected.address}</div>
                </div>
              )}
              <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Line Items</div>
                {(selected.lineItems && selected.lineItems.length > 0)
                  ? selected.lineItems.map((l, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingTop: i > 0 ? 6 : 0, borderTop: i > 0 ? `1px solid ${C.border}` : "none", marginTop: i > 0 ? 6 : 0 }}>
                      <span>{l.description}</span>
                      <span style={{ fontWeight: 600, flexShrink: 0, marginLeft: 12 }}>£{(l.amount || 0).toFixed(2)}</span>
                    </div>
                  ))
                  : <div style={{ fontSize: 13, whiteSpace: "pre-line", lineHeight: 1.7 }}>{selected.description || selected.desc || "—"}</div>
                }
              </div>
              <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Payment Due</div>
                <div style={{ fontSize: 13 }}>{selected.due}</div>
              </div>
              {selected.jobRef && (
                <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Job Reference</div>
                  <div style={{ fontSize: 13 }}>{selected.jobRef}</div>
                </div>
              )}
            </div>

            {selected.status !== "paid"
              ? <button style={{ ...S.btn("primary"), width: "100%", justifyContent: "center", padding: "14px", fontSize: 15, background: C.green, color: "#000", marginBottom: 10 }} onClick={() => updateStatus(selected.id, "paid")}>✓ Mark as Paid</button>
              : <div style={{ background: C.green + "18", border: `1px solid ${C.green}44`, borderRadius: 8, padding: "12px 16px", textAlign: "center", color: C.green, fontWeight: 700, marginBottom: 10 }}>✓ Invoice Paid</div>
            }

            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center" }} onClick={() => downloadInvoicePDF(brand, selected)}>⬇ PDF</button>
              <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center" }} onClick={() => setEditingInvoice(selected)}>✏ Edit</button>
              {selected.status === "overdue" && <button style={S.btn("danger")} onClick={() => updateStatus(selected.id, "sent")}>📨 Chase</button>}
              <button style={{ ...S.btn("ghost"), color: C.red }} onClick={() => deleteInvoice(selected.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {showModal && <InvoiceModal brand={brand} onClose={() => setShowModal(false)} onSent={inv => { setInvoices(prev => [inv, ...(prev || [])]); setShowModal(false); syncInvoiceToAccounting(user?.id, inv); }} />}
      {editingInvoice && <InvoiceModal brand={brand} initialData={editingInvoice} onClose={() => setEditingInvoice(null)} onSent={updated => { setInvoices(prev => (prev || []).map(i => i.id === editingInvoice.id ? { ...i, ...updated } : i)); setSelected(updated); setEditingInvoice(null); }} />}
    </div>
  );
}

// ─── Quotes View ──────────────────────────────────────────────────────────────
function QuotesView({ brand, invoices, setInvoices, setView }) {
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingQuote, setEditingQuote] = useState(null);

  const allQuotes = (invoices || []).filter(i => i.isQuote);
  const pending = allQuotes.filter(q => q.status !== "accepted" && q.status !== "declined");
  const accepted = allQuotes.filter(q => q.status === "accepted");
  const declined = allQuotes.filter(q => q.status === "declined");

  const updateStatus = (id, status) => {
    setInvoices(prev => (prev || []).map(i => i.id === id ? { ...i, status } : i));
    if (selected && selected.id === id) setSelected(s => ({ ...s, status }));
  };

  const convertToInvoice = (quote) => {
    const newId = `INV-${String(Math.floor(Math.random() * 900) + 100)}`;
    const inv = { ...quote, isQuote: false, id: newId, status: "sent", due: `Due in ${brand.paymentTerms || 30} days` };
    setInvoices(prev => [inv, ...(prev || []).filter(i => i.id !== quote.id)]);
    setSelected(null);
    setView("Invoices");
  };

  const deleteQuote = (id) => {
    setInvoices(prev => (prev || []).filter(i => i.id !== id));
    setSelected(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Quotes</div>
        <button style={{ ...S.btn("primary"), background: C.blue }} onClick={() => setShowModal(true)}>+ New Quote</button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 10 }}>
        <div style={S.card}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Pending</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: C.blue }}>{pending.length}</div>
          <div style={{ fontSize: 11, color: C.muted }}>£{pending.reduce((s, q) => s + (q.amount || 0), 0).toLocaleString()}</div>
        </div>
        <div style={S.card}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Accepted</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: C.green }}>{accepted.length}</div>
          <div style={{ fontSize: 11, color: C.muted }}>£{accepted.reduce((s, q) => s + (q.amount || 0), 0).toLocaleString()}</div>
        </div>
        <div style={S.card}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Declined</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: declined.length > 0 ? C.red : C.muted }}>{declined.length}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{declined.length > 0 ? "Not won" : "None lost"}</div>
        </div>
        <div style={S.card}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Pipeline</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: C.text }}>{allQuotes.length}</div>
          <div style={{ fontSize: 11, color: C.muted }}>£{allQuotes.reduce((s, q) => s + (q.amount || 0), 0).toLocaleString()}</div>
        </div>
      </div>

      {/* All quotes */}
      <div style={S.card}>
        <div style={S.sectionTitle}>All Quotes ({allQuotes.length})</div>
        {allQuotes.length === 0
          ? <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic", padding: "8px 0" }}>No quotes yet — tap + New Quote or ask the AI Assistant.</div>
          : allQuotes.map(q => (
            <div key={q.id} onClick={() => { setSelected(q); setEditing(false); }} style={{ ...S.row, cursor: "pointer" }}>
              <div style={{ width: 4, height: 44, borderRadius: 2, background: q.status === "accepted" ? C.green : q.status === "declined" ? C.red : C.blue, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{q.customer}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{q.address || q.id} · {q.due}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, marginRight: 8, flexShrink: 0 }}>£{q.amount}</div>
              <div style={{ ...S.badge(q.status === "accepted" ? C.green : q.status === "declined" ? C.red : C.blue), marginRight: 8, flexShrink: 0 }}>
                {q.status === "accepted" ? "Accepted" : q.status === "declined" ? "Declined" : "Sent"}
              </div>
              <button onClick={e => { e.stopPropagation(); convertToInvoice(q); }} style={{ ...S.btn("primary"), fontSize: 11, padding: "4px 10px", flexShrink: 0 }}>→ Invoice</button>
              <div style={{ fontSize: 11, color: C.muted, marginLeft: 4 }}>→</div>
            </div>
          ))
        }
      </div>

      {/* Detail modal */}
      {selected && !editing && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }} onClick={() => setSelected(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.card, maxWidth: 480, width: "100%", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: C.blue, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Quote · {selected.id}</div>
                <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{selected.customer}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: selected.status === "accepted" ? C.green : C.blue }}>£{selected.amount}</div>
                  <span style={S.badge(selected.status === "accepted" ? C.green : selected.status === "declined" ? C.red : C.blue)}>
                    {selected.status === "accepted" ? "Accepted" : selected.status === "declined" ? "Declined" : "Sent"}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 24 }}>×</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Line Items</div>
                {(selected.lineItems && selected.lineItems.length > 0)
                  ? selected.lineItems.map((l, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingTop: i > 0 ? 6 : 0, borderTop: i > 0 ? `1px solid ${C.border}` : "none", marginTop: i > 0 ? 6 : 0 }}>
                      <span>{l.description}</span>
                      <span style={{ fontWeight: 600, flexShrink: 0, marginLeft: 12 }}>£{(l.amount || 0).toFixed(2)}</span>
                    </div>
                  ))
                  : <div style={{ fontSize: 13, whiteSpace: "pre-line", lineHeight: 1.7 }}>{selected.description || selected.desc || "—"}</div>
                }
              </div>
              <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Valid For</div>
                <div style={{ fontSize: 13 }}>{selected.due}</div>
              </div>
              {selected.jobRef && (
                <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Job Reference</div>
                  <div style={{ fontSize: 13 }}>{selected.jobRef}</div>
                </div>
              )}
            </div>

            <button style={{ ...S.btn("primary"), width: "100%", justifyContent: "center", padding: "14px", fontSize: 15, marginBottom: 10 }}
              onClick={() => convertToInvoice(selected)}>→ Convert to Invoice</button>

            {selected.status !== "accepted" && selected.status !== "declined" && (
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", color: C.green }} onClick={() => updateStatus(selected.id, "accepted")}>✓ Mark Accepted</button>
                <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", color: C.red }} onClick={() => updateStatus(selected.id, "declined")}>✗ Mark Declined</button>
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center" }} onClick={() => setEditingQuote(selected)}>✏️ Edit</button>
              <button style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center" }} onClick={() => downloadInvoicePDF(brand, selected)}>⬇ PDF</button>
              <button style={{ ...S.btn("ghost"), color: C.red }} onClick={() => deleteQuote(selected.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {showModal && <QuoteModal brand={brand} onClose={() => setShowModal(false)} onSent={q => { setInvoices(prev => [q, ...(prev || [])]); setShowModal(false); }} />}
      {editingQuote && <QuoteModal brand={brand} initialData={editingQuote} onClose={() => setEditingQuote(null)} onSent={updated => { setInvoices(prev => (prev || []).map(i => i.id === editingQuote.id ? { ...i, ...updated } : i)); setSelected(updated); setEditingQuote(null); }} />}
    </div>
  );
}

// ─── Line Items Display ───────────────────────────────────────────────────────
function LineItemsDisplay({ inv }) {
  if (!inv) return null;
  const items = inv.lineItems && inv.lineItems.length > 0
    ? inv.lineItems
    : (inv.description || inv.desc || "").split(/\n|;\s*/).map(s => {
        const pipeIdx = s.lastIndexOf("|");
        if (pipeIdx > 0) return { description: s.slice(0, pipeIdx).trim(), amount: parseFloat(s.slice(pipeIdx + 1)) || null };
        return { description: s.trim(), amount: null };
      }).filter(i => i.description);

  if (items.length === 0) return <div style={{ fontSize: 13, color: "#888" }}>—</div>;

  if (items.length === 1) {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
        <span>{items[0].description}</span>
        {items[0].amount != null && <span style={{ fontWeight: 600 }}>£{items[0].amount.toFixed ? items[0].amount.toFixed(2) : items[0].amount}</span>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingBottom: 6, borderBottom: i < items.length - 1 ? `1px solid rgba(255,255,255,0.06)` : "none" }}>
          <span>{item.description}</span>
          {item.amount != null && <span style={{ fontWeight: 600, flexShrink: 0, marginLeft: 12 }}>£{Number(item.amount).toFixed(2)}</span>}
        </div>
      ))}
    </div>
  );
}

const VIEWS = ["Dashboard", "Schedule", "Customers", "Invoices", "Quotes", "Materials", "AI Assistant", "Reminders", "Payments", "Settings"];

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState(() => {
    // If redirected back from OAuth, go to Settings
    const params = new URLSearchParams(window.location.search);
    if (params.has('xero') || params.has('qb')) return "Settings";
    return "Dashboard";
  });
  const [brand, setBrand] = useState(DEFAULT_BRAND);
  const { reminders, add, dismiss, remove } = useReminders(user?.id);
  const [dueNow, setDueNow] = useState([]);
  const [bellFlash, setBellFlash] = useState(false);
  const now = Date.now();

  // Check existing session on load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load brand settings from localStorage (brand is small, localStorage is fine)
  useEffect(() => {
    if (!user) return;
    const saved = localStorage.getItem(`trade-pa-brand-${user.id}`);
    if (saved) setBrand(JSON.parse(saved));
    else {
      const name = user.user_metadata?.full_name;
      if (name) setBrand(b => ({ ...b, tradingName: `${name}'s Trades` }));
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    localStorage.setItem(`trade-pa-brand-${user.id}`, JSON.stringify(brand));
  }, [brand, user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setJobsRaw([]); setInvoicesRaw([]); setEnquiriesRaw([]);
    setMaterialsRaw([]); setCustomersRaw([]);
    setCompanyId(null); setCompanyName(""); setMembers([]);
    setUser(null); setView("Dashboard");
  };

  // ── State declarations ────────────────────────────────────────────────────
  const [jobs, setJobsRaw] = useState([]);
  const [invoices, setInvoicesRaw] = useState([]);
  const [enquiries, setEnquiriesRaw] = useState([]);
  const [materials, setMaterialsRaw] = useState([]);
  const [customers, setCustomersRaw] = useState([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [companyId, setCompanyId] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [userRole, setUserRole] = useState("owner");
  const [members, setMembers] = useState([]);
  const [pendingInvite, setPendingInvite] = useState(null);

  // ── Get or create company for user ───────────────────────────────────────
  const getOrCreateCompany = async (uid) => {
    // Check if user already belongs to a company
    const { data: membership } = await supabase
      .from("company_members")
      .select("company_id, role, companies(name)")
      .eq("user_id", uid)
      .single();

    if (membership) {
      setCompanyId(membership.company_id);
      setCompanyName(membership.companies?.name || "");
      setUserRole(membership.role);
      return membership.company_id;
    }

    // Check for pending invite using user's email
    const { data: invite } = await supabase
      .from("invites")
      .select("*")
      .eq("email", user.email)
      .eq("accepted", false)
      .single();

    if (invite) {
      // Accept the invite — join the existing company with permissions from invite
      await supabase.from("company_members").insert({
        company_id: invite.company_id,
        user_id: uid,
        role: invite.role || "member",
        invited_email: user.email,
        permissions: invite.permissions || null,
      });
      await supabase.from("invites").update({ accepted: true }).eq("id", invite.id);
      const { data: co } = await supabase.from("companies").select("name").eq("id", invite.company_id).single();
      setCompanyId(invite.company_id);
      setCompanyName(co?.name || "");
      setUserRole(invite.role || "member");
      setPendingInvite(null);
      return invite.company_id;
    }

    // No company yet — create a new one
    const compName = brand.tradingName || `${user.user_metadata?.full_name || "My"}'s Business`;
    const { data: newCompany } = await supabase
      .from("companies")
      .insert({ name: compName })
      .select()
      .single();

    if (newCompany) {
      await supabase.from("company_members").insert({
        company_id: newCompany.id,
        user_id: uid,
        role: "owner",
      });
      setCompanyId(newCompany.id);
      setCompanyName(newCompany.name);
      setUserRole("owner");
      return newCompany.id;
    }
    return null;
  };

  // ── Load all data from Supabase on login ──────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      setDbLoading(true);
      try {
        const cid = await getOrCreateCompany(user.id);
        if (!cid) { setDbLoading(false); return; }

        // Load members for team management
        const { data: mem } = await supabase
          .from("company_members")
          .select("*, users:user_id(email)")
          .eq("company_id", cid);
        if (mem) setMembers(mem);

        const [j, inv, enq, mat, cust] = await Promise.all([
          supabase.from("jobs").select("*").eq("company_id", cid).order("date_obj", { ascending: true }),
          supabase.from("invoices").select("*").eq("company_id", cid).order("created_at", { ascending: false }),
          supabase.from("enquiries").select("*").eq("company_id", cid).order("created_at", { ascending: false }),
          supabase.from("materials").select("*").eq("company_id", cid).order("created_at", { ascending: true }),
          supabase.from("customers").select("*").eq("company_id", cid).order("name", { ascending: true }),
        ]);
        if (j.data) setJobsRaw(j.data.map(r => ({ ...r, dateObj: r.date_obj })));
        if (inv.data) setInvoicesRaw(inv.data.map(r => ({ ...r, vatEnabled: r.vat_enabled, vatRate: r.vat_rate, isQuote: r.is_quote })));
        if (enq.data) setEnquiriesRaw(enq.data);
        if (mat.data) setMaterialsRaw(mat.data);
        if (cust.data) setCustomersRaw(cust.data);
      } catch (e) { console.error("DB load error:", e); }
      setDbLoading(false);
    };
    fetchAll();
  }, [user?.id]);

  // ── Company-aware Supabase setters ────────────────────────────────────────
  const setJobs = (updater) => {
    setJobsRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (!companyId) return next;
      (async () => {
        try {
          const prevIds = new Set(prev.map(j => String(j.id)));
          const nextIds = new Set(next.map(j => String(j.id)));
          for (const id of prevIds) {
            if (!nextIds.has(id)) await supabase.from("jobs").delete().eq("id", id).eq("company_id", companyId);
          }
          for (const job of next) {
            if (!prevIds.has(String(job.id))) {
              await supabase.from("jobs").upsert({
                id: String(job.id), company_id: companyId, user_id: user.id,
                customer: job.customer, address: job.address, type: job.type,
                date: job.date, date_obj: job.dateObj || job.date_obj,
                status: job.status, value: job.value || 0, notes: job.notes || "",
              });
            } else {
              const old = prev.find(j => String(j.id) === String(job.id));
              if (JSON.stringify(old) !== JSON.stringify(job)) {
                await supabase.from("jobs").update({
                  customer: job.customer, address: job.address, type: job.type,
                  date: job.date, date_obj: job.dateObj || job.date_obj,
                  status: job.status, value: job.value || 0, notes: job.notes || "",
                }).eq("id", String(job.id)).eq("company_id", companyId);
              }
            }
          }
        } catch (e) { console.error("Jobs sync:", e); }
      })();
      return next;
    });
  };

  const setInvoices = (updater) => {
    setInvoicesRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (!companyId) return next;
      (async () => {
        try {
          const prevIds = new Set(prev.map(i => i.id));
          const nextIds = new Set(next.map(i => i.id));
          for (const id of prevIds) {
            if (!nextIds.has(id)) await supabase.from("invoices").delete().eq("id", id).eq("company_id", companyId);
          }
          for (const inv of next) {
            if (!prevIds.has(inv.id)) {
              await supabase.from("invoices").upsert({
                id: inv.id, company_id: companyId, user_id: user.id,
                customer: inv.customer, amount: inv.amount || 0, due: inv.due,
                status: inv.status, description: inv.description || "",
                vat_enabled: inv.vatEnabled || false, vat_rate: inv.vatRate || 20,
                payment_method: inv.paymentMethod || "both",
                is_quote: inv.isQuote || false,
              });
            } else {
              const old = prev.find(i => i.id === inv.id);
              if (JSON.stringify(old) !== JSON.stringify(inv)) {
                await supabase.from("invoices").update({
                  status: inv.status, due: inv.due, amount: inv.amount,
                  is_quote: inv.isQuote || false,
                }).eq("id", inv.id).eq("company_id", companyId);
              }
            }
          }
        } catch (e) { console.error("Invoices sync:", e); }
      })();
      return next;
    });
  };

  const setEnquiries = (updater) => {
    setEnquiriesRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (!companyId) return next;
      (async () => {
        try {
          await supabase.from("enquiries").delete().eq("company_id", companyId);
          if (next.length > 0) {
            await supabase.from("enquiries").insert(
              next.map(e => ({ company_id: companyId, user_id: user.id, name: e.name, source: e.source, msg: e.msg, time: e.time, urgent: e.urgent || false }))
            );
          }
        } catch (e) { console.error("Enquiries sync:", e); }
      })();
      return next;
    });
  };

  const setMaterials = (updater) => {
    setMaterialsRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (!companyId) return next;
      (async () => {
        try {
          await supabase.from("materials").delete().eq("company_id", companyId);
          if (next.length > 0) {
            await supabase.from("materials").insert(
              next.map(m => ({ company_id: companyId, user_id: user.id, item: m.item, qty: m.qty || 1, supplier: m.supplier || "", job: m.job || "", status: m.status || "to_order" }))
            );
          }
        } catch (e) { console.error("Materials sync:", e); }
      })();
      return next;
    });
  };

  const setCustomers = (updater) => {
    setCustomersRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (!companyId) return next;
      (async () => {
        try {
          const prevIds = new Set(prev.map(c => c.id));
          const nextIds = new Set(next.map(c => c.id));
          for (const id of prevIds) {
            if (!nextIds.has(id)) await supabase.from("customers").delete().eq("id", id).eq("company_id", companyId);
          }
          for (const c of next) {
            if (!prevIds.has(c.id)) {
              await supabase.from("customers").insert({
                company_id: companyId, user_id: user.id,
                name: c.name, phone: c.phone || "", email: c.email || "",
                address: c.address || "", notes: c.notes || "",
              });
            } else {
              const old = prev.find(x => x.id === c.id);
              if (JSON.stringify(old) !== JSON.stringify(c)) {
                await supabase.from("customers").update({
                  name: c.name, phone: c.phone || "", email: c.email || "",
                  address: c.address || "", notes: c.notes || "",
                }).eq("id", c.id).eq("company_id", companyId);
              }
            }
          }
        } catch (e) { console.error("Customers sync:", e); }
      })();
      return next;
    });
  };

  // Watch for reminders that just became due
  useEffect(() => {
    const t = setInterval(() => {
      const due = reminders.filter(r => !r.done && !r._due && r.time <= Date.now() && r.time > Date.now() - 60000);
      if (due.length > 0) {
        setDueNow(d => [...d, ...due.filter(r => !d.find(x => x.id === r.id))]);
        setBellFlash(true);
        setTimeout(() => setBellFlash(false), 3000);
        due.forEach(r => dismiss(r.id));
      }
    }, 5000);
    return () => clearInterval(t);
  }, [reminders]);

  const upcomingCount = reminders.filter(r => !r.done && !r._due && r.time > now).length;
  const overdueCount = reminders.filter(r => !r.done && !r._due && r.time <= now).length;
  const alertCount = dueNow.length + overdueCount;

  // Auth gate
  if (authLoading) return (
    <div style={{ minHeight: "100vh", background: "#0f0f0f", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono',monospace", color: "#6b7280", fontSize: 13 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;700&display=swap');`}</style>
      Loading Trade PA...
    </div>
  );

  if (!user) return <AuthScreen onAuth={setUser} />;

  if (dbLoading) return (
    <div style={{ minHeight: "100vh", background: "#0f0f0f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono',monospace", color: "#6b7280", fontSize: 13, gap: 12 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;700&display=swap');`}</style>
      <div style={{ fontSize: 28 }}>⚡</div>
      <div style={{ color: "#f59e0b", fontWeight: 700 }}>TRADE PA</div>
      <div>Loading your data...</div>
    </div>
  );

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html,body{width:100%;overflow-x:hidden;background:#0f0f0f;}
        ::-webkit-scrollbar{width:5px;}
        ::-webkit-scrollbar-track{background:#1a1a1a;}
        ::-webkit-scrollbar-thumb{background:#333;border-radius:3px;}
        .nav-scroll::-webkit-scrollbar{display:none;}
        button:hover:not(:disabled){opacity:0.82;}
        input:focus,textarea:focus{border-color:#f59e0b !important;outline:none;}
        @keyframes bellPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.3)}}
        img{max-width:100%;}
      `}</style>
      <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 100, width: "100%" }}>
        {/* Top row — logo and right icons */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", height: 48 }}>
          <div style={S.logo}>
            <div style={S.logoIcon}>TP</div>
            TRADE PA
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div onClick={() => setView("Reminders")} style={{ position: "relative", cursor: "pointer", padding: "4px 6px" }}>
              <span style={{ fontSize: 18, display: "block", animation: bellFlash ? "bellPulse 0.4s ease 3" : "none" }}>🔔</span>
              {alertCount > 0 && <div style={{ position: "absolute", top: 0, right: 0, width: 16, height: 16, background: C.red, borderRadius: "50%", fontSize: 9, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.bg}` }}>{alertCount}</div>}
              {alertCount === 0 && upcomingCount > 0 && <div style={{ position: "absolute", top: 0, right: 0, width: 16, height: 16, background: C.amber, borderRadius: "50%", fontSize: 9, fontWeight: 700, color: "#000", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.bg}` }}>{upcomingCount}</div>}
            </div>
            {members.length > 1 && (
              <div onClick={() => setView("Settings")} style={{ fontSize: 10, color: C.muted, background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, padding: "2px 8px", cursor: "pointer" }}>
                👥 {members.length}
              </div>
            )}
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.green }} />
            <button onClick={handleLogout} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 8px", color: C.muted }}>Out</button>
          </div>
        </div>
        {/* Nav row — filtered by permissions for members */}
        <div className="nav-scroll" style={{ display: "flex", overflowX: "auto", WebkitOverflowScrolling: "touch", padding: "0 12px 8px", gap: 2, scrollbarWidth: "none" }}>
          {VIEWS.filter(v => {
            if (userRole === "owner") return true;
            if (v === "Settings") return false; // members never see Settings
            const myMember = members.find(m => m.user_id === user?.id);
            const perms = myMember?.permissions;
            if (!perms) return true; // no restrictions set yet
            return perms[v] !== false;
          }).map(v => (
            <button key={v} onClick={() => setView(v)} style={{ ...S.navBtn(view === v), flexShrink: 0 }}>{v}</button>
          ))}
        </div>
      </header>
      <main style={{ ...S.main, paddingTop: view === "AI Assistant" || view === "Reminders" ? 16 : 24 }}>
        {(() => {
          // Guard — redirect member to Dashboard if they're on a tab they can't access
          if (userRole !== "owner" && view !== "Dashboard") {
            const myMember = members.find(m => m.user_id === user?.id);
            const perms = myMember?.permissions;
            if (perms && perms[view] === false) {
              return <div style={{ ...S.card, textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>🔒</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Access Restricted</div>
                <div style={{ fontSize: 12, color: C.muted }}>You don't have permission to view this section. Contact your account owner.</div>
              </div>;
            }
          }
          return null;
        })()}
        {view === "Dashboard" && <Dashboard setView={setView} jobs={jobs} invoices={invoices} enquiries={enquiries} brand={brand} />}
        {view === "Schedule" && <Schedule jobs={jobs} setJobs={setJobs} customers={customers} />}
        {view === "Customers" && <Customers customers={customers} setCustomers={setCustomers} jobs={jobs} invoices={invoices} setView={setView} />}
        {view === "Invoices" && <InvoicesView brand={brand} invoices={invoices} setInvoices={setInvoices} user={user} />}
        {view === "Quotes" && <QuotesView brand={brand} invoices={invoices} setInvoices={setInvoices} setView={setView} user={user} />}
        {view === "Materials" && <Materials materials={materials} setMaterials={setMaterials} />}
        {view === "AI Assistant" && <AIAssistant brand={brand} jobs={jobs} setJobs={setJobs} invoices={invoices} setInvoices={setInvoices} enquiries={enquiries} setEnquiries={setEnquiries} materials={materials} setMaterials={setMaterials} customers={customers} setCustomers={setCustomers} onAddReminder={add} setView={setView} user={user} />}
        {view === "Reminders" && <Reminders reminders={reminders} onAdd={add} onDismiss={dismiss} onRemove={remove} dueNow={dueNow} onClearDue={() => setDueNow([])} />}
        {view === "Payments" && <Payments brand={brand} invoices={invoices} setInvoices={setInvoices} customers={customers} user={user} />}
        {view === "Settings" && <Settings brand={brand} setBrand={setBrand} companyId={companyId} companyName={companyName} userRole={userRole} members={members} user={user} />}
      </main>
    </div>
  );
}
