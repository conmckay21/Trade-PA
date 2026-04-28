import React, { useState } from "react";
import { db } from "../lib/db.js";

export function AuthScreen({ onAuth, initialMode = "login", onBack }) {
  const [mode, setMode] = useState(initialMode); // login | signup | reset
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
    error: { background: "#ef444422", border: "1px solid #ef444444", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#ef4444", marginBottom: 16, lineHeight: 1.5 },
    success: { background: "#10b98122", border: "1px solid #10b98144", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#10b981", marginBottom: 16, lineHeight: 1.5 },
    divider: { display: "flex", alignItems: "center", gap: 12, margin: "20px 0" },
    dividerLine: { flex: 1, height: 1, background: "#2a2a2a" },
    dividerText: { fontSize: 11, color: "#6b7280" },
  };

  const handleLogin = async () => {
    if (!form.email || !form.password) { setError("Please enter your email and password."); return; }
    setLoading(true); setError("");
    const { data, error } = await db.auth.signInWithPassword({ email: form.email, password: form.password });
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
    const { data, error } = await db.auth.signUp({
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
    const { error } = await db.auth.resetPasswordForEmail(form.email, {
      redirectTo: window.location.origin,
    });
    if (error) setError(error.message);
    else setResetSent(true);
    setLoading(false);
  };

  const handleKey = (e, action) => { if (e.key === "Enter") action(); };

  return (
    <div style={authStyles.wrap}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;700&display=swap'); *{box-sizing:border-box;margin:0;padding:0;} input:focus{border-color:#f59e0b !important;outline:none;} input,textarea,select{font-size:16px !important;}`}</style>
      <div style={authStyles.box}>
        {onBack && (
          <button onClick={onBack} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 12, fontFamily: "'DM Mono',monospace", marginBottom: 20, display: "flex", alignItems: "center", gap: 6, padding: 0 }}>← Back to home</button>
        )}
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
