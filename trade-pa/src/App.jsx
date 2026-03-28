import { useState, useRef, useEffect } from "react";
import { supabase } from "./supabase.js";

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
// Works on ALL browsers including iPhone Safari.
// Hold to record, release to transcribe via OpenAI Whisper.
function useWhisper(onTranscript) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size < 1000) return; // too short, ignore
        setTranscribing(true);
        try {
          const formData = new FormData();
          const ext = mimeType.includes("webm") ? "webm" : "mp4";
          formData.append("file", blob, `audio.${ext}`);
          formData.append("model", "whisper-1");
          formData.append("language", "en");
          const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${import.meta.env.VITE_OPENAI_KEY}` },
            body: formData,
          });
          const data = await res.json();
          if (data.text) onTranscript(data.text.trim());
          else onTranscript(""); 
        } catch { onTranscript(""); }
        setTranscribing(false);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch (err) {
      alert("Microphone access denied. Please allow microphone permission in your browser settings and try again.");
    }
  };

  const stop = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  return { recording, transcribing, start, stop };
}

const C = {
  bg: "#0f0f0f", surface: "#1a1a1a", surfaceHigh: "#242424",
  border: "#2a2a2a", amber: "#f59e0b", amberDim: "#92400e",
  green: "#10b981", red: "#ef4444", blue: "#3b82f6", purple: "#8b5cf6",
  muted: "#6b7280", text: "#e5e5e5", textDim: "#9ca3af",
};

const S = {
  app: { fontFamily: "'DM Mono','Courier New',monospace", background: C.bg, minHeight: "100vh", color: C.text },
  header: { background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56, position: "sticky", top: 0, zIndex: 100 },
  logo: { display: "flex", alignItems: "center", gap: 10, fontWeight: 700, fontSize: 16, letterSpacing: "0.05em", color: C.amber },
  logoIcon: { width: 32, height: 28, background: C.amber, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: "#000", fontSize: 11, fontWeight: 900, letterSpacing: "-0.02em" },
  nav: { display: "flex", gap: 4 },
  navBtn: (a) => ({ padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontFamily: "'DM Mono',monospace", fontWeight: a ? 700 : 400, letterSpacing: "0.04em", background: a ? C.amber : "transparent", color: a ? "#000" : C.textDim, transition: "all 0.15s" }),
  main: { flex: 1, padding: 24, maxWidth: 1200, width: "100%", margin: "0 auto" },
  card: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 },
  grid4: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 },
  sectionTitle: { fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginBottom: 16 },
  badge: (color) => ({ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", background: color + "22", color, border: `1px solid ${color}44` }),
  pill: (color, active) => ({ padding: "6px 14px", borderRadius: 6, border: `1px solid ${active ? color : C.border}`, background: active ? color + "22" : C.surfaceHigh, color: active ? color : C.textDim, cursor: "pointer", fontSize: 11, fontFamily: "'DM Mono',monospace", fontWeight: 600 }),
  btn: (v = "primary", dis = false) => ({ padding: "8px 16px", borderRadius: 6, border: v === "ghost" ? `1px solid ${C.border}` : "none", cursor: dis ? "not-allowed" : "pointer", fontSize: 12, fontFamily: "'DM Mono',monospace", fontWeight: 600, letterSpacing: "0.04em", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6, background: dis ? C.surfaceHigh : v === "primary" ? C.amber : v === "stripe" ? "#635bff" : v === "danger" ? C.red : v === "green" ? C.green : C.surfaceHigh, color: dis ? C.muted : v === "primary" ? "#000" : v === "green" ? "#000" : C.text, opacity: dis ? 0.6 : 1, transition: "all 0.15s" }),
  input: { width: "100%", background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 13, fontFamily: "'DM Mono',monospace", outline: "none", boxSizing: "border-box" },
  label: { fontSize: 11, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6, display: "block" },
  row: { display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${C.border}` },
  statCard: (accent) => ({ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${accent}`, borderRadius: 10, padding: 20 }),
  aiMsg: (r) => ({ display: "flex", gap: 10, marginBottom: 16, flexDirection: r === "user" ? "row-reverse" : "row" }),
  aiBubble: (r) => ({ maxWidth: "80%", padding: "10px 14px", borderRadius: r === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px", background: r === "user" ? C.amberDim : C.surfaceHigh, border: `1px solid ${r === "user" ? C.amber + "44" : C.border}`, fontSize: 13, lineHeight: 1.6, color: C.text, whiteSpace: "pre-wrap" }),
  avatar: (r) => ({ width: 30, height: 30, borderRadius: "50%", background: r === "user" ? C.amber : C.surface, border: `1px solid ${r === "user" ? C.amber : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: r === "user" ? "#000" : C.amber, flexShrink: 0 }),
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
  paymentTerms: "30",
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
function Settings({ brand, setBrand }) {
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState(false);
  const logoRef = useRef();
  const set = (k) => (e) => setBrand(b => ({ ...b, [k]: e.target.value }));

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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
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
            <textarea style={{ ...S.input, resize: "vertical", minHeight: 72 }} value={brand.address} onChange={set("address")} />
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
            <div style={{ display: "flex", gap: 8 }}>
              {["7", "14", "30"].map(d => (
                <button key={d} onClick={() => setBrand(b => ({ ...b, paymentTerms: d }))} style={S.pill(brand.accentColor, brand.paymentTerms === d)}>{d} days</button>
              ))}
            </div>
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
      <div style={S.card}>
        <div style={S.sectionTitle}>Certifications & Compliance</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          {[
            { label: "Gas Safe Registered", icon: "🔥", enabled: true },
            { label: "OFTEC Registered", icon: "🛢", enabled: false },
            { label: "NICEIC Approved", icon: "⚡", enabled: false },
            { label: "Which? Trusted Trader", icon: "✓", enabled: true },
          ].map((cert, i) => {
            const [on, setOn] = useState(cert.enabled);
            return (
              <div key={i} onClick={() => setOn(o => !o)} style={{ padding: "14px", background: on ? brand.accentColor + "11" : C.surfaceHigh, border: `1px solid ${on ? brand.accentColor + "44" : C.border}`, borderRadius: 8, cursor: "pointer", textAlign: "center", transition: "all 0.2s" }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>{cert.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: on ? C.text : C.muted }}>{cert.label}</div>
                <div style={{ fontSize: 10, color: on ? brand.accentColor : C.muted, marginTop: 4 }}>{on ? "Shown on invoice" : "Click to enable"}</div>
              </div>
            );
          })}
        </div>
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
function Dashboard({ setView, jobs, invoices, enquiries }) {
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
        {invoices.length === 0
          ? <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No invoices yet — create one in Payments or via the AI Assistant.</div>
          : invoices.slice(0, 5).map(inv => (
            <div key={inv.id} style={S.row}>
              <div style={{ fontSize: 12, color: C.muted, width: 70 }}>{inv.id}</div>
              <div style={{ flex: 1 }}><span style={{ fontSize: 13, fontWeight: 600 }}>{inv.customer}</span></div>
              <div style={{ fontSize: 13, fontWeight: 700, marginRight: 16 }}>£{inv.amount}</div>
              <div style={{ width: 130, textAlign: "right" }}>
                <div style={S.badge(statusColor[inv.status] || C.muted)}>{statusLabel[inv.status] || inv.status}</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{inv.due}</div>
              </div>
            </div>
          ))
        }
      </div>

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
  const [form, setForm] = useState({ customer: "", address: "", type: "", time: "09:00", value: "", status: "confirmed" });

  const weekStart = new Date(getWeekStart(new Date()));
  weekStart.setDate(weekStart.getDate() + weekOffset * 7);

  const weekDays = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isThisWeek = weekOffset === 0;

  const jobsForDay = (day) => jobs.filter(j => j.dateObj && isSameDay(new Date(j.dateObj), day));

  const weekLabel = () => {
    const end = new Date(weekStart); end.setDate(end.getDate() + 4);
    return `${weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
  };

  const openAdd = (day) => {
    setAddJobDate(day);
    setForm({ customer: "", address: "", type: "", time: "09:00", value: "", status: "confirmed" });
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
    };
    setJobs(prev => [...prev, newJob]);
    setShowAddJob(false);
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

      {/* Calendar grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
        {weekDays.map((day, i) => {
          const dayJobs = jobsForDay(day);
          const isToday = isSameDay(day, today);
          return (
            <div key={i} style={{ ...S.card, padding: 14, borderColor: isToday ? C.amber + "66" : C.border, background: isToday ? C.amber + "08" : C.surface }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: isToday ? C.amber : C.muted, textTransform: "uppercase" }}>
                  {day.toLocaleDateString("en-GB", { weekday: "short" })} {day.getDate()}
                </div>
                <button onClick={() => openAdd(day)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 2px" }} title="Add job">+</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {dayJobs.length === 0 && <div style={{ fontSize: 10, color: C.border, fontStyle: "italic" }}>Free</div>}
                {dayJobs.map(job => (
                  <div key={job.id} style={{ padding: "7px 9px", background: C.surfaceHigh, borderRadius: 6, borderLeft: `2px solid ${statusColor[job.status] || C.muted}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 1 }}>{job.customer.split(" ")[0]}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>{job.type}</div>
                    {job.value > 0 && <div style={{ fontSize: 10, color: C.amber, marginTop: 3 }}>£{job.value}</div>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Jobs list this week */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Jobs This Week ({allWeekJobs.length})</div>
        {allWeekJobs.length === 0 && <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No jobs scheduled this week. Hit + to add one.</div>}
        {allWeekJobs.map(job => (
          <div key={job.id} style={S.row}>
            <div style={{ width: 4, height: 40, borderRadius: 2, background: statusColor[job.status] || C.muted, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{job.customer}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{job.address}</div>
            </div>
            <div style={{ fontSize: 12, color: C.textDim, marginRight: 12 }}>{job.type}</div>
            <div style={{ fontSize: 12, color: C.textDim, marginRight: 12 }}>{job.date}</div>
            <div style={S.badge(statusColor[job.status] || C.muted)}>{statusLabel[job.status] || job.status}</div>
            {job.value > 0 && <div style={{ fontSize: 13, fontWeight: 700, color: C.amber, marginLeft: 16 }}>£{job.value}</div>}
          </div>
        ))}
      </div>

      {/* Add Job Modal */}
      {showAddJob && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}>
          <div style={{ ...S.card, maxWidth: 440, width: "90%", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Add Job — {addJobDate?.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</div>
              <button onClick={() => setShowAddJob(false)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22 }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
                <label style={S.label}>Status</label>
                <div style={{ display: "flex", gap: 8 }}>
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
function Materials() {
  const [materials, setMaterials] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ item: "", qty: 1, supplier: "", job: "", status: "to_order" });

  const save = () => {
    if (!form.item) return;
    setMaterials(prev => [...prev, { ...form, qty: parseInt(form.qty) || 1 }]);
    setForm({ item: "", qty: 1, supplier: "", job: "", status: "to_order" });
    setShowAdd(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Materials & Orders</div>
        <button style={S.btn("primary")} onClick={() => setShowAdd(true)}>+ Add Material</button>
      </div>
      <div style={S.card}>
        <div style={S.sectionTitle}>Material List</div>
        {materials.length === 0
          ? <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No materials yet — add one above or via the AI Assistant.</div>
          : materials.map((m, i) => (
            <div key={i} style={S.row}>
              <div style={{ width: 4, height: 40, borderRadius: 2, background: statusColor[m.status] || C.muted, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{m.item}</div>
                {m.job && <div style={{ fontSize: 11, color: C.muted }}>For: {m.job}</div>}
              </div>
              <div style={{ fontSize: 12, color: C.textDim, marginRight: 16 }}>Qty: {m.qty}</div>
              {m.supplier && <div style={{ fontSize: 12, color: C.textDim, marginRight: 16 }}>{m.supplier}</div>}
              <div style={S.badge(statusColor[m.status] || C.muted)}>{statusLabel[m.status] || m.status}</div>
              <button onClick={() => setMaterials(prev => prev.map((x, j) => j === i ? { ...x, status: x.status === "to_order" ? "ordered" : x.status === "ordered" ? "collected" : "to_order" } : x))}
                style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px", marginLeft: 8 }}>
                {m.status === "to_order" ? "Mark Ordered" : m.status === "ordered" ? "Mark Collected" : "Reset"}
              </button>
            </div>
          ))
        }
      </div>

      <div style={S.card}>
        <div style={S.sectionTitle}>Supplier Quick Dial</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {["City Plumbing", "Screwfix", "Wolseley", "Toolstation", "BSS", "Plumb Center"].map(sup => (
            <div key={sup} style={{ padding: "12px 14px", background: C.surfaceHigh, borderRadius: 8, border: `1px solid ${C.border}`, cursor: "pointer" }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{sup}</div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>Tap to call / order</div>
            </div>
          ))}
        </div>
      </div>

      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}>
          <div style={{ ...S.card, maxWidth: 420, width: "90%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Add Material</div>
              <button onClick={() => setShowAdd(false)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22 }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[{ k: "item", l: "Item", p: "e.g. Copper pipe 22mm x 3m" }, { k: "qty", l: "Quantity", p: "1" }, { k: "supplier", l: "Supplier", p: "e.g. Screwfix" }, { k: "job", l: "For Job (optional)", p: "e.g. Boiler service — Smith" }].map(({ k, l, p }) => (
                <div key={k}>
                  <label style={S.label}>{l}</label>
                  <input style={S.input} placeholder={p} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
                </div>
              ))}
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
    </div>
  );
}

function AIAssistant({ brand, jobs, setJobs, invoices, setInvoices, enquiries, setEnquiries, onAddReminder, setView }) {
  const [messages, setMessages] = useState([{ role: "assistant", content: `Hi! I'm your Trade PA assistant for ${brand.tradingName || "your business"}.\n\nI can create and delete data across the whole app. Try:\n• "Book in John Smith, boiler service, Friday 10am, £120"\n• "Invoice Sarah Chen £85 for leak repair"\n• "Delete the job for John Smith"\n• "Remove the invoice for Sarah Chen"\n• "Log enquiry from Kevin Nash, WhatsApp, wants boiler fixed"\n• "Remind me to call Emma at 3pm"\n\nOr hold 🎙 and speak naturally.` }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastAction, setLastAction] = useState(null);
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const { recording, transcribing, start, stop } = useWhisper((text) => {
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
      description: "Create a new invoice. Use when the user mentions invoicing a customer, charging for completed work, or sending a bill.",
      input_schema: {
        type: "object",
        properties: {
          customer: { type: "string", description: "Customer full name" },
          amount: { type: "number", description: "Invoice amount in pounds" },
          description: { type: "string", description: "What the work was" },
          due_days: { type: "number", description: "Days until payment due, default 30" },
        },
        required: ["customer", "amount", "description"],
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
  ];

  // ── Execute tool calls ────────────────────────────────────────────────────
  const executeTool = (name, input) => {
    switch (name) {
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
        setJobs(prev => [...prev, job]);
        setLastAction({ type: "job", label: `${input.type} — ${input.customer}`, view: "Schedule" });
        return `Job created: ${input.type} for ${input.customer} on ${dateObj.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} at ${input.time}.`;
      }
      case "create_invoice": {
        const id = `INV-${String(Math.floor(Math.random() * 900) + 100)}`;
        const inv = {
          id,
          customer: input.customer,
          amount: input.amount,
          due: `Due in ${input.due_days || 30} days`,
          status: "sent",
          description: input.description,
        };
        setInvoices(prev => [inv, ...prev]);
        setLastAction({ type: "invoice", label: `${id} — £${input.amount} — ${input.customer}`, view: "Payments" });
        return `Invoice ${id} created for ${input.customer} — £${input.amount} for ${input.description}.`;
      }
      case "log_enquiry": {
        const enq = {
          name: input.name,
          source: input.source,
          msg: input.message,
          time: "Just now",
          urgent: input.urgent || false,
        };
        setEnquiries(prev => [enq, ...prev]);
        setLastAction({ type: "enquiry", label: `${input.name} via ${input.source}`, view: "Dashboard" });
        return `Enquiry logged from ${input.name} via ${input.source}.`;
      }
      case "set_reminder": {
        const reminder = {
          id: `r${Date.now()}`,
          text: input.text,
          time: Date.now() + (input.minutes_from_now * 60000),
          timeLabel: input.time_label || "",
          done: false,
        };
        onAddReminder(reminder);
        setLastAction({ type: "reminder", label: input.text, view: "Reminders" });
        return `Reminder set: "${input.text}" — ${input.time_label || `in ${input.minutes_from_now} minutes`}.`;
      }
      case "create_material": {
        setLastAction({ type: "material", label: `${input.item} x${input.qty}`, view: "Materials" });
        return `Material added: ${input.item} x${input.qty}${input.supplier ? ` from ${input.supplier}` : ""}.`;
      }
      case "delete_job": {
        const match = jobs.find(j =>
          j.customer.toLowerCase().includes(input.customer.toLowerCase()) &&
          (!input.job_type || j.type.toLowerCase().includes(input.job_type.toLowerCase()))
        );
        if (!match) return `Couldn't find a job for "${input.customer}". Check the Schedule tab for exact details.`;
        setJobs(prev => prev.filter(j => j.id !== match.id));
        setLastAction({ type: "job", label: `Deleted: ${match.type} — ${match.customer}`, view: "Schedule" });
        return `Job deleted: ${match.type} for ${match.customer}.`;
      }
      case "delete_invoice": {
        const match = invoices.find(i =>
          (input.invoice_id && i.id.toLowerCase() === input.invoice_id.toLowerCase()) ||
          (input.customer && i.customer.toLowerCase().includes(input.customer.toLowerCase()))
        );
        if (!match) return `Couldn't find that invoice. Check the Payments tab for exact details.`;
        setInvoices(prev => prev.filter(i => i.id !== match.id));
        setLastAction({ type: "invoice", label: `Deleted: ${match.id} — ${match.customer}`, view: "Payments" });
        return `Invoice ${match.id} for ${match.customer} (£${match.amount}) deleted.`;
      }
      case "delete_enquiry": {
        const match = enquiries.find(e =>
          e.name.toLowerCase().includes(input.name.toLowerCase())
        );
        if (!match) return `Couldn't find an enquiry from "${input.name}". Check the Dashboard for exact details.`;
        setEnquiries(prev => prev.filter(e => e !== match));
        setLastAction({ type: "enquiry", label: `Deleted: ${match.name}`, view: "Dashboard" });
        return `Enquiry from ${match.name} deleted.`;
      }
      default:
        return "Action completed.";
    }
  };

  const SYSTEM = `You are a smart admin assistant for ${brand.tradingName}, a UK sole trader trades business. Today is ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.

Current data you can act on:
- Jobs: ${jobs.length === 0 ? "none" : jobs.map(j => `${j.customer} (${j.type})`).join(", ")}
- Invoices: ${invoices.length === 0 ? "none" : invoices.map(i => `${i.id} ${i.customer} £${i.amount}`).join(", ")}
- Enquiries: ${enquiries.length === 0 ? "none" : enquiries.map(e => e.name).join(", ")}

When the user asks you to do something actionable — book a job, create an invoice, log an enquiry, set a reminder, add materials, OR delete/remove/cancel any of these — USE THE APPROPRIATE TOOL.

For jobs: if no year is specified assume ${new Date().getFullYear()}. If they say "Friday" calculate the actual date.
For reminders: calculate minutes from now based on the time they mention.
For deletions: match by name or ID, confirm what was deleted. If no match found, say so clearly.
For everything: extract details confidently from natural language.

After using a tool, confirm what you did in 1-2 sentences. Be concise. Use £ not $.`;

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
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM,
          tools: TOOLS,
          messages: apiMessages,
        }),
      });

      const data = await res.json();
      let replyText = "";
      const toolResults = [];

      // Process response — may contain text and/or tool use blocks
      for (const block of (data.content || [])) {
        if (block.type === "text") {
          replyText += block.text;
        } else if (block.type === "tool_use") {
          const result = executeTool(block.name, block.input);
          toolResults.push(result);
        }
      }

      // If tool was used but no text, use tool result as reply
      const finalReply = replyText || toolResults.join("\n") || "Done.";
      setMessages(prev => [...prev, { role: "assistant", content: finalReply }]);

    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "Connection error — please try again." }]);
    }
    setLoading(false);
  };

  const micLabel = transcribing ? "⏳" : recording ? "⏹" : "🎙";
  const micStyle = transcribing ? "ghost" : recording ? "danger" : "ghost";

  const quick = [
    "Book in John Smith, 14 Park Road Guildford, boiler service, Friday 10am, £120",
    "Invoice Sarah Chen £85 for leak repair",
    "Delete the job for John Smith",
    "Remove invoice for Sarah Chen",
  ];

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

      {transcribing && <div style={{ textAlign: "center", fontSize: 12, color: C.amber }}>Transcribing...</div>}

      <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        <textarea
          style={{ ...S.input, flex: 1, minHeight: 44, maxHeight: 120, resize: "none" }}
          placeholder="Type or hold 🎙 — book a job, send an invoice, log an enquiry..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          rows={2}
        />
        <button onMouseDown={start} onMouseUp={stop} onTouchStart={start} onTouchEnd={stop} style={{ ...S.btn(micStyle), padding: "10px 14px", fontSize: 18, userSelect: "none" }} disabled={transcribing}>{micLabel}</button>
        <button onClick={() => send(input)} style={{ ...S.btn("primary"), padding: "10px 16px" }} disabled={loading || !input.trim()}>Send</button>
      </div>
    </div>
  );
}

// ─── Payments ─────────────────────────────────────────────────────────────────
function Payments({ brand }) {
  const [connected, setConnected] = useState(false);
  const [stage, setStage] = useState(0);
  const [invoices, setInvoices] = useState(INVOICES_INIT);
  const [showModal, setShowModal] = useState(false);
  const [bankVerified, setBankVerified] = useState(false);
  const [verifyStep, setVerifyStep] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [payout, setPayout] = useState("Daily");
  const [bizType, setBizType] = useState("sole_trader");

  if (!connected) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {stage > 0 && (
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
          {["Authorise", "Business", "Bank", "Verify", "Connected"].map((label, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", flex: i < 4 ? 1 : 0 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: stage > i + 1 ? C.green : stage === i + 1 ? brand.accentColor : C.surfaceHigh, border: `2px solid ${stage > i + 1 ? C.green : stage === i + 1 ? brand.accentColor : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: stage >= i + 1 ? "#000" : C.muted, transition: "all 0.3s" }}>{stage > i + 1 ? "✓" : i + 1}</div>
                <div style={{ fontSize: 10, color: stage >= i + 1 ? C.text : C.muted, whiteSpace: "nowrap" }}>{label}</div>
              </div>
              {i < 4 && <div style={{ flex: 1, height: 2, background: stage > i + 1 ? C.green : C.border, margin: "0 6px", marginBottom: 18, transition: "all 0.3s" }} />}
            </div>
          ))}
        </div>
      )}

      {stage === 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ ...S.card, borderColor: C.purple + "44", background: "linear-gradient(135deg,#1a1a2e 0%,#1a1a1a 100%)" }}>
            <div style={{ display: "flex", gap: 20 }}>
              <div style={{ fontSize: 44 }}>💳</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Connect Stripe to get paid</div>
                <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.7, marginBottom: 20 }}>Customers pay invoices online. Money goes straight to your bank — TradeBase never touches it.</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button style={S.btn("stripe")} onClick={() => setStage(1)}><span style={{ fontWeight: 900 }}>S</span> Connect with Stripe</button>
                </div>
              </div>
            </div>
          </div>
          <div style={S.grid3}>
            {[{ icon: "🔒", t: "Your money, your bank", d: "Funds go directly to your Stripe account. TradeBase has zero access." }, { icon: "⚡", t: "Instant payment links", d: "Every invoice gets a pay link. Customers pay by card in seconds." }, { icon: "📊", t: "Auto reconciliation", d: "Invoice marks paid automatically when customer pays." }].map((f, i) => (
              <div key={i} style={S.card}><div style={{ fontSize: 28, marginBottom: 10 }}>{f.icon}</div><div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{f.t}</div><div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>{f.d}</div></div>
            ))}
          </div>
        </div>
      )}

      {stage === 1 && (
        <div style={{ ...S.card, textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 16, fontWeight: 900, color: "#635bff" }}>S</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Redirecting to Stripe</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 24 }}>In production, you'd be sent to Stripe's secure OAuth page. For this demo we simulate the authorisation.</div>
          <button style={S.btn("stripe")} onClick={() => setStage(2)}>Simulate Stripe Authorisation ✓</button>
        </div>
      )}

      {stage === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Business Details</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[{ l: "Trading Name", v: brand.tradingName }, { l: "Legal Name", v: "David Hughes" }, { l: "Mobile", v: brand.phone }, { l: "Email", v: brand.email }, { l: "VAT Number", v: brand.vatNumber || "" }, { l: "Address", v: brand.address }].map(({ l, v }) => (
              <div key={l}><label style={S.label}>{l}</label><input style={S.input} defaultValue={v} /></div>
            ))}
          </div>
          <div><label style={S.label}>Business Type</label>
            <div style={{ display: "flex", gap: 10 }}>
              {[["sole_trader", "Sole Trader"], ["limited_company", "Ltd Company"], ["partnership", "Partnership"]].map(([k, label]) => (
                <button key={k} onClick={() => setBizType(k)} style={S.pill(brand.accentColor, bizType === k)}>{label}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}><button style={S.btn("primary")} onClick={() => setStage(3)}>Continue →</button></div>
        </div>
      )}

      {stage === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Bank Account for Payouts</div>
          <div style={{ ...S.card, background: C.surfaceHigh }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              {[{ l: "Sort Code", v: brand.sortCode }, { l: "Account Number", v: brand.accountNumber }, { l: "Account Name", v: brand.accountName }].map(({ l, v }) => (
                <div key={l}><label style={S.label}>{l}</label><input style={S.input} defaultValue={v} /></div>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              {!bankVerified ? <button style={S.btn("ghost")} onClick={() => setTimeout(() => setBankVerified(true), 1000)}>Verify Bank Account</button>
                : <div style={S.badge(C.green)}>✓ Bank verified</div>}
            </div>
          </div>
          <div style={S.card}>
            <label style={S.label}>Payout Schedule</label>
            <div style={{ display: "flex", gap: 10 }}>
              {["Daily", "Weekly", "Monthly"].map(p => <button key={p} onClick={() => setPayout(p)} style={S.pill(brand.accentColor, payout === p)}>{p}</button>)}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}><button style={S.btn("primary", !bankVerified)} disabled={!bankVerified} onClick={() => setStage(4)}>Continue →</button></div>
        </div>
      )}

      {stage === 4 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Identity Verification</div>
          {[{ t: "Photo ID", d: "Passport, driving licence, or national ID", icon: "🪪" }, { t: "Selfie with ID", d: "A photo of you holding your ID", icon: "🤳" }, { t: "Proof of Address", d: "Bank statement or utility bill (last 3 months)", icon: "📄" }].map((item, i) => (
            <div key={i} style={{ ...S.card, display: "flex", alignItems: "center", gap: 16, borderColor: verifyStep > i ? C.green + "44" : C.border, background: verifyStep > i ? C.green + "08" : C.surface }}>
              <div style={{ fontSize: 28 }}>{item.icon}</div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700 }}>{item.t}</div><div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{item.d}</div></div>
              {verifyStep > i ? <div style={S.badge(C.green)}>✓ Uploaded</div>
                : verifyStep === i ? <button style={S.btn(uploading ? "ghost" : "primary")} onClick={() => { setUploading(true); setTimeout(() => { setUploading(false); setVerifyStep(s => s + 1); }, 1400); }} disabled={uploading}>{uploading ? "Uploading..." : "Upload →"}</button>
                : <div style={{ fontSize: 11, color: C.muted }}>Waiting</div>}
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button style={S.btn("primary", verifyStep < 3)} disabled={verifyStep < 3} onClick={() => setConnected(true)}>Submit & Connect →</button>
          </div>
        </div>
      )}
    </div>
  );

  // Connected
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ ...S.card, borderColor: C.green + "44", background: "linear-gradient(135deg,#0d2018 0%,#1a1a1a 100%)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 32 }}>✅</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.green, marginBottom: 4 }}>Stripe Connected</div>
            <div style={{ fontSize: 12, color: C.textDim }}>{brand.tradingName} · Sort {brand.sortCode} · Daily payouts</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: C.muted }}>ACCOUNT ID</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.green }}>acct_1Ox8dR...</div>
          </div>
        </div>
      </div>
      <div style={S.grid4}>
        {[{ l: "Available", v: "£834", c: C.green }, { l: "Pending", v: "£120", c: C.amber }, { l: "This Month", v: "£3,240", c: C.text }, { l: "Outstanding", v: "£1,250", c: C.red }].map((st, i) => (
          <div key={i} style={{ ...S.card, textAlign: "center" }}>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>{st.l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: st.c }}>{st.v}</div>
          </div>
        ))}
      </div>
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={S.sectionTitle}>Invoices</div>
          <button style={S.btn("primary")} onClick={() => setShowModal(true)}>+ Send Invoice</button>
        </div>
        {invoices.map(inv => (
          <div key={inv.id} style={S.row}>
            <div style={{ fontSize: 12, color: C.muted, width: 70 }}>{inv.id}</div>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{inv.customer}</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginRight: 14 }}>£{inv.amount}</div>
            <div style={{ ...S.badge(statusColor[inv.status]), marginRight: 10 }}>{statusLabel[inv.status]}</div>
            <div style={{ fontSize: 10, color: C.muted, marginRight: 12, width: 110 }}>{inv.due}</div>
            {inv.status !== "paid" && <button style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px" }}>Copy Link</button>}
            {inv.status === "overdue" && <button style={{ ...S.btn("danger"), fontSize: 11, padding: "4px 10px", marginLeft: 6 }} onClick={() => setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: "sent", due: "Chaser sent" } : i))}>Chase</button>}
            {inv.status === "paid" && <div style={{ fontSize: 11, color: C.green, marginLeft: 10 }}>✓</div>}
          </div>
        ))}
      </div>
      {showModal && <InvoiceModal brand={brand} onClose={() => setShowModal(false)} onSent={(inv) => { setInvoices(prev => [inv, ...prev]); setShowModal(false); }} />}
    </div>
  );
}

// ─── Invoice Modal ────────────────────────────────────────────────────────────
function InvoiceModal({ brand, onClose, onSent }) {
  const [form, setForm] = useState({ customer: "", email: "", address: "", amount: "", desc: "", due: brand.paymentTerms || "30", paymentMethod: brand.defaultPaymentMethod || "both", vatEnabled: false, vatRate: 20 });
  const [tab, setTab] = useState("form");
  const [sent, setSent] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const valid = form.customer && form.email && form.amount;
  const isVatRegistered = !!brand.vatNumber;

  const grossAmount = parseFloat(form.amount) || 0;
  const netAmount = form.vatEnabled ? parseFloat((grossAmount / (1 + form.vatRate / 100)).toFixed(2)) : grossAmount;
  const vatAmount = form.vatEnabled ? parseFloat((grossAmount - netAmount).toFixed(2)) : 0;

  const previewRef = buildRef(brand, { id: "INV-043", customer: form.customer || "Customer Name" });

  const send = () => {
    setSent(true);
    setTimeout(() => {
      onSent({ id: `INV-0${43 + Math.floor(Math.random() * 10)}`, customer: form.customer, amount: grossAmount, due: `Due in ${form.due} days`, status: "sent", vatEnabled: form.vatEnabled, vatRate: form.vatRate });
    }, 1500);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16 }}>
      <div style={{ ...S.card, maxWidth: 880, width: "100%", maxHeight: "92vh", overflowY: "auto" }}>
        {sent ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.green, marginBottom: 8 }}>Invoice Sent!</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
              {(form.paymentMethod === "card" || form.paymentMethod === "both") ? `Payment link sent to ${form.email}` : `BACS details sent to ${form.email}`}
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
              <div style={{ fontSize: 15, fontWeight: 700 }}>New Invoice</div>
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
                    { k: "address", l: "Customer Address", p: "5 High Street\nGuildford GU1 3AA" },
                    { k: "amount", l: form.vatEnabled ? `Amount inc. VAT @ ${form.vatRate}% (£)` : "Amount (£)", p: "e.g. 480" },
                  ].map(({ k, l, p }) => (
                    <div key={k}><label style={S.label}>{l}</label>
                      {k === "address" ? <textarea style={{ ...S.input, resize: "none", height: 60 }} placeholder={p} value={form[k]} onChange={set(k)} />
                        : <input style={S.input} placeholder={p} value={form[k]} onChange={set(k)} />}
                    </div>
                  ))}
                </div>

                <div><label style={S.label}>Description (one line per item)</label>
                  <textarea style={{ ...S.input, resize: "vertical", minHeight: 80 }} placeholder={"Annual boiler service\nFlue check and clean\nPressure test"} value={form.desc} onChange={set("desc")} />
                </div>

                {/* VAT toggle */}
                {isVatRegistered ? (
                  <div style={{ padding: "14px 16px", background: C.surfaceHigh, borderRadius: 8, border: `1px solid ${form.vatEnabled ? C.amber + "66" : C.border}`, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 3 }}>VAT Invoice</div>
                      {form.vatEnabled && grossAmount > 0
                        ? <div style={{ fontSize: 11, color: C.muted }}>Net: £{netAmount.toFixed(2)} + VAT £{vatAmount.toFixed(2)} = Gross £{grossAmount.toFixed(2)}</div>
                        : <div style={{ fontSize: 11, color: C.muted }}>VAT No: {brand.vatNumber} — toggle to show VAT breakdown</div>
                      }
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                      {form.vatEnabled && (
                        <div style={{ display: "flex", gap: 6 }}>
                          {[20, 5, 0].map(r => (
                            <button key={r} onClick={() => setForm(f => ({ ...f, vatRate: r }))} style={{ ...S.pill(C.amber, form.vatRate === r), fontSize: 11, padding: "4px 10px" }}>{r}%</button>
                          ))}
                        </div>
                      )}
                      <button onClick={() => setForm(f => ({ ...f, vatEnabled: !f.vatEnabled }))} style={{ padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontFamily: "'DM Mono',monospace", fontWeight: 700, background: form.vatEnabled ? C.amber : C.border, color: form.vatEnabled ? "#000" : C.muted, transition: "all 0.2s" }}>
                        {form.vatEnabled ? "VAT On ✓" : "Add VAT"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 11, color: C.muted }}>
                    VAT registered? Add your VAT number in Settings to enable VAT invoices.
                  </div>
                )}

                <div style={S.grid2}>
                  <div>
                    <label style={S.label}>Payment Due</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {["7", "14", "30"].map(d => <button key={d} onClick={() => setForm(f => ({ ...f, due: d }))} style={S.pill(brand.accentColor, form.due === d)}>{d} days</button>)}
                    </div>
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
                    ? <button style={S.btn("stripe", !valid)} disabled={!valid} onClick={send}><span style={{ fontWeight: 900 }}>S</span> Send via Stripe →</button>
                    : <button style={S.btn("primary", !valid)} disabled={!valid} onClick={send}>Send Invoice →</button>
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

// ─── Reminders ────────────────────────────────────────────────────────────────
function useReminders() {
  const [reminders, setReminders] = useState([]);

  const add = (reminder) => setReminders(prev => [reminder, ...prev]);
  const dismiss = (id) => setReminders(prev => prev.map(r => r.id === id ? { ...r, done: true } : r));
  const remove = (id) => setReminders(prev => prev.filter(r => r.id !== id));

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
          model: "claude-sonnet-4-20250514",
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

  const { recording: recRecording, transcribing: recTranscribing, start: recStart, stop: recStop } = useWhisper((text) => {
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
            onMouseDown={recStart} onMouseUp={recStop} onTouchStart={recStart} onTouchEnd={recStop}
            title={recRecording ? "Release to transcribe" : "Hold to record"}
            style={{ ...S.btn(recTranscribing ? "ghost" : recRecording ? "danger" : "ghost"), padding: "10px 14px", fontSize: 18, userSelect: "none" }}
            disabled={recTranscribing}
          >{recTranscribing ? "⏳" : recRecording ? "⏹" : "🎙"}</button>
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
const VIEWS = ["Dashboard", "Schedule", "Materials", "AI Assistant", "Reminders", "Payments", "Settings"];

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState("Dashboard");
  const [brand, setBrand] = useState(DEFAULT_BRAND);
  const { reminders, add, dismiss, remove } = useReminders();
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

  // Load brand settings from localStorage keyed to user
  useEffect(() => {
    if (!user) return;
    const saved = localStorage.getItem(`trade-pa-brand-${user.id}`);
    if (saved) setBrand(JSON.parse(saved));
    else {
      // Pre-fill name from their signup
      const name = user.user_metadata?.full_name;
      if (name) setBrand(b => ({ ...b, tradingName: `${name}'s Trades` }));
    }
  }, [user]);

  // Save brand settings whenever they change
  useEffect(() => {
    if (!user) return;
    localStorage.setItem(`trade-pa-brand-${user.id}`, JSON.stringify(brand));
  }, [brand, user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setView("Dashboard");
  };

  // Jobs with real dates
  const [jobs, setJobs] = useState(() => JOBS.map(j => {
    const today = new Date(); today.setHours(0,0,0,0);
    const map = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4 };
    const dayKey = j.date.split(" ")[0];
    const timeStr = j.date.split(" ")[1] || "09:00";
    const offset = map[dayKey] ?? 0;
    const weekStart = getWeekStart(today);
    const d = new Date(weekStart);
    d.setDate(d.getDate() + offset);
    const [h, m] = timeStr.split(":");
    d.setHours(parseInt(h) || 9, parseInt(m) || 0);
    return { ...j, dateObj: d.toISOString() };
  }));

  // Invoices and enquiries lifted to root so AI can write to them
  const [invoices, setInvoices] = useState(INVOICES_INIT);
  const [enquiries, setEnquiries] = useState(ENQUIRIES);

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

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:5px;}
        ::-webkit-scrollbar-track{background:#1a1a1a;}
        ::-webkit-scrollbar-thumb{background:#333;border-radius:3px;}
        button:hover:not(:disabled){opacity:0.82;}
        input:focus,textarea:focus{border-color:#f59e0b !important;outline:none;}
        @keyframes bellPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.3)} }
      `}</style>
      <header style={S.header}>
        <div style={S.logo}>
          <div style={S.logoIcon}>TP</div>
          TRADE PA
        </div>
        <nav style={S.nav}>
          {VIEWS.map(v => <button key={v} style={S.navBtn(view === v)} onClick={() => setView(v)}>{v}</button>)}
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div onClick={() => setView("Reminders")} style={{ position: "relative", cursor: "pointer", padding: "4px 6px" }}>
            <span style={{ fontSize: 18, display: "block", animation: bellFlash ? "bellPulse 0.4s ease 3" : "none" }}>🔔</span>
            {alertCount > 0 && (
              <div style={{ position: "absolute", top: 0, right: 0, width: 16, height: 16, background: C.red, borderRadius: "50%", fontSize: 9, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.bg}` }}>{alertCount}</div>
            )}
            {alertCount === 0 && upcomingCount > 0 && (
              <div style={{ position: "absolute", top: 0, right: 0, width: 16, height: 16, background: C.amber, borderRadius: "50%", fontSize: 9, fontWeight: 700, color: "#000", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.bg}` }}>{upcomingCount}</div>
            )}
          </div>
          {brand.logo
            ? <img src={brand.logo} alt="logo" style={{ height: 28, objectFit: "contain", borderRadius: 4 }} />
            : <div style={{ fontSize: 12, color: C.muted }}>{brand.tradingName}</div>}
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.green }} />
          <button onClick={handleLogout} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px", color: C.muted }}>Sign out</button>
        </div>
      </header>
      <main style={{ ...S.main, paddingTop: view === "AI Assistant" || view === "Reminders" ? 16 : 24 }}>
        {view === "Dashboard" && <Dashboard setView={setView} jobs={jobs} invoices={invoices} enquiries={enquiries} />}
        {view === "Schedule" && <Schedule jobs={jobs} setJobs={setJobs} />}
        {view === "Materials" && <Materials />}
        {view === "AI Assistant" && <AIAssistant brand={brand} jobs={jobs} setJobs={setJobs} invoices={invoices} setInvoices={setInvoices} enquiries={enquiries} setEnquiries={setEnquiries} onAddReminder={add} setView={setView} />}
        {view === "Reminders" && <Reminders reminders={reminders} onAdd={add} onDismiss={dismiss} onRemove={remove} dueNow={dueNow} onClearDue={() => setDueNow([])} />}
        {view === "Payments" && <Payments brand={brand} invoices={invoices} setInvoices={setInvoices} />}
        {view === "Settings" && <Settings brand={brand} setBrand={setBrand} />}
      </main>
    </div>
  );
}
