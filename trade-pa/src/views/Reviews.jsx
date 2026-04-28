// ─── Customer Reviews Tab ───────────────────────────────────────────────
// Extracted verbatim from App.jsx during P7 sub-batch A (28 Apr 2026).
import React, { useState, useEffect } from "react";
import { db } from "../lib/db.js";
import { C } from "../theme/colors.js";
import { S } from "../theme/styles.js";

export function ReviewsTab({ user, brand, customers, setContextHint }) {
  const [requests, setRequests] = useState([]);
  const [completedJobs, setCompletedJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(null);
  const [showSendModal, setShowSendModal] = useState(null); // job object
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [search, setSearch] = useState("");

  // Context hint for floating mic
  useEffect(() => {
    if (!setContextHint) return;
    const sent = requests.length;
    const pending = completedJobs.filter(j => !j.reviewSent).length;
    const bits = [`Reviews: ${sent} sent`];
    if (pending) bits.push(`${pending} jobs awaiting review request`);
    setContextHint(bits.join(" · "));
    return () => { if (setContextHint) setContextHint(null); };
  }, [requests, completedJobs, setContextHint]);

  const PLATFORMS = [
    { id: "google", label: "Google", icon: "🔍", urlKey: "reviewUrlGoogle", color: "#4285F4" },
    { id: "checkatrade", label: "Checkatrade", icon: "✅", urlKey: "reviewUrlCheckatrade", color: "#00A651" },
    { id: "trustpilot", label: "Trustpilot", icon: "⭐", urlKey: "reviewUrlTrustpilot", color: "#00B67A" },
    { id: "facebook", label: "Facebook", icon: "👍", urlKey: "reviewUrlFacebook", color: "#1877F2" },
    { id: "which", label: "Which? Trusted Traders", icon: "🏆", urlKey: "reviewUrlWhich", color: "#E31B23" },
    { id: "mybuilder", label: "MyBuilder", icon: "🔨", urlKey: "reviewUrlMyBuilder", color: "#FF6B35" },
    { id: "ratedpeople", label: "Rated People", icon: "👷", urlKey: "reviewUrlRatedPeople", color: "#0052CC" },
  ];

  const activePlatforms = PLATFORMS.filter(p => brand?.[p.urlKey]);

  useEffect(() => { if (user?.id) load(); }, [user?.id]);

  const load = async () => {
    setLoading(true);
    const [{ data: reqs }, { data: jobData }] = await Promise.all([
      db.from("review_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      db.from("job_cards").select("*").eq("user_id", user.id).eq("status", "completed").order("completion_date", { ascending: false }),
    ]);
    setRequests(reqs || []);
    const sent = new Set((reqs || []).map(r => r.job_id));
    setCompletedJobs((jobData || []).map(j => ({ ...j, reviewSent: sent.has(j.id) })));
    setLoading(false);
  };

  const openSendModal = (job) => {
    setShowSendModal(job);
    setSelectedPlatforms(activePlatforms.map(p => p.id)); // default all active
  };

  const sendRequest = async () => {
    const job = showSendModal;
    const cust = (customers || []).find(c => c.name?.toLowerCase() === job.customer?.toLowerCase());
    const email = cust?.email || job.email;
    if (!email) { alert("No email address for this customer. Add one in the Customers tab first."); return; }
    if (selectedPlatforms.length === 0) { alert("Select at least one platform."); return; }

    setSending(job.id);
    const businessName = brand.tradingName || "us";
    const chosenPlatforms = PLATFORMS.filter(p => selectedPlatforms.includes(p.id) && brand?.[p.urlKey]);

    // Build review buttons for each chosen platform
    const buttons = chosenPlatforms.map(p =>
      `<a href="${brand[p.urlKey]}" style="display:inline-block;background:${p.color};color:#fff;padding:10px 20px;border-radius:8px;font-weight:700;text-decoration:none;margin:4px">${p.icon} ${p.label}</a>`
    ).join("\n");

    const body = `<p>Dear ${job.customer},</p>
<p>Thank you for choosing ${businessName} for your recent ${job.type || "work"} — we really appreciate your business and hope everything is to your satisfaction.</p>
<p>If you're happy with the service, we'd be very grateful if you could spare a minute to leave us a review. It makes a huge difference to our business.</p>
<p style="margin:20px 0">${buttons}</p>
<p>Even a quick rating helps — thank you so much for your support.</p>
<p>Kind regards,<br>${businessName}${brand.phone ? `<br>${brand.phone}` : ""}${brand.website ? `<br>${brand.website}` : ""}</p>`;

    try {
      const endpoint = import.meta.env.VITE_EMAIL_ENDPOINT || "/api/email";
      await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id, to: email, subject: `How did we do? — ${businessName}`, body }) });
      const { data } = await db.from("review_requests").insert({
        user_id: user.id, job_id: job.id, customer: job.customer, email,
        platforms: selectedPlatforms.join(","),
        sent_at: new Date().toISOString(), created_at: new Date().toISOString()
      }).select().single();
      if (data) setRequests(p => [data, ...p]);
      setCompletedJobs(prev => prev.map(j => j.id === job.id ? { ...j, reviewSent: true } : j));
      setShowSendModal(null);
      alert(`✓ Review request sent to ${email}`);
    } catch (e) { alert("Failed to send: " + e.message); }
    setSending(null);
  };

  const sentCount = requests.length;
  const sLower = search.trim().toLowerCase();
  const pendingJobs = completedJobs.filter(j => !j.reviewSent).filter(j => !sLower
    || (j.customer || "").toLowerCase().includes(sLower)
    || (j.type || "").toLowerCase().includes(sLower));
  const filteredRequests = requests.filter(r => !sLower
    || (r.customer || "").toLowerCase().includes(sLower)
    || (r.email || "").toLowerCase().includes(sLower));
  const hasAnyPlatform = activePlatforms.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 80 }}>
      <div style={{ fontSize: 18, fontWeight: 700 }}>Customer Reviews</div>

      {(completedJobs.length > 0 || requests.length > 0) && (
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search customer or email…"
          style={{ ...S.input, fontSize: 13 }}
        />
      )}

      {/* Platform setup status */}
      <div style={{ ...S.card }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Review Platforms</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {PLATFORMS.map(p => {
            const isSet = !!brand?.[p.urlKey];
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: C.surfaceHigh, borderRadius: 8, border: `1px solid ${isSet ? p.color + "44" : C.border}` }}>
                <div style={{ fontSize: 18, width: 28, textAlign: "center", flexShrink: 0 }}>{p.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{p.label}</div>
                  {isSet
                    ? <div style={{ fontSize: 11, color: C.green }}>✓ Linked</div>
                    : <div style={{ fontSize: 11, color: C.muted }}>Add link in Settings → Business Details</div>
                  }
                </div>
                <div style={{ ...S.badge(isSet ? C.green : C.muted), flexShrink: 0 }}>{isSet ? "Active" : "Not set"}</div>
              </div>
            );
          })}
        </div>
        {!hasAnyPlatform && (
          <div style={{ fontSize: 11, color: C.amber, marginTop: 10 }}>
            ⚙ Add at least one review platform link in Settings → Business Details to start sending requests.
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
        {[["Requests Sent", sentCount, C.green], ["Awaiting Request", pendingJobs.length, C.amber]].map(([l,v,col],i) => (
          <div key={i} style={{ background: C.surfaceHigh, borderRadius: 10, padding: "14px 16px", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: col, fontFamily: "'DM Mono',monospace" }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Completed jobs */}
      {pendingJobs.length > 0 && (
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Completed Jobs — Send Review Request</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pendingJobs.map(j => {
              const cust = (customers || []).find(c => c.name?.toLowerCase() === j.customer?.toLowerCase());
              const hasEmail = !!(cust?.email || j.email);
              return (
                <div key={j.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: C.surfaceHigh, borderRadius: 8, border: `1px solid ${C.border}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{j.customer}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      {j.type || "Job"}{j.completion_date ? ` · Completed ${new Date(j.completion_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}
                    </div>
                    {!hasEmail && <div style={{ fontSize: 11, color: C.red, marginTop: 2 }}>⚠ No email — add in Customers tab</div>}
                  </div>
                  <button
                    onClick={() => openSendModal(j)}
                    disabled={!hasEmail || !hasAnyPlatform}
                    style={{ ...S.btn(hasEmail && hasAnyPlatform ? "primary" : "ghost"), fontSize: 11, padding: "6px 12px", flexShrink: 0 }}>
                    ⭐ Request
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sent history */}
      {requests.length > 0 && (
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Sent History</div>
          {filteredRequests.length === 0 ? (
            <div style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: "12px 8px" }}>No history matches "{search}".</div>
          ) : filteredRequests.map(r => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{r.customer}</div>
                <div style={{ fontSize: 11, color: C.muted }}>
                  {r.email} · Sent {new Date(r.sent_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  {r.platforms && ` · ${r.platforms.split(",").join(", ")}`}
                </div>
              </div>
              <div style={{ ...S.badge(C.green), flexShrink: 0 }}>Sent ✓</div>
            </div>
          ))}
        </div>
      )}

      {completedJobs.length === 0 && !loading && (
        <div style={{ textAlign: "center", padding: "32px 16px" }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>⭐</div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>No completed jobs yet</div>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>Once you mark a job as completed, it'll appear here. From here you can send the customer a quick review request (Google, Trustpilot, etc.) — or just say "send a review request to Harrison".</div>
        </div>
      )}

      {/* Send modal — choose platforms */}
      {showSendModal && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, paddingTop: "max(52px,env(safe-area-inset-top,52px))", overflowY: "auto" }} onClick={() => setShowSendModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.card, maxWidth: 480, width: "100%", marginBottom: 16, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Send Review Request</div>
              <button aria-label="Close" onClick={() => setShowSendModal(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
              Sending to <strong style={{ color: C.text }}>{showSendModal.customer}</strong> — choose which platforms to include:
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {activePlatforms.map(p => (
                <div key={p.id}
                  onClick={() => setSelectedPlatforms(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, border: `2px solid ${selectedPlatforms.includes(p.id) ? p.color : C.border}`, background: selectedPlatforms.includes(p.id) ? p.color + "11" : C.surfaceHigh, cursor: "pointer" }}>
                  <div style={{ fontSize: 20, width: 28, textAlign: "center" }}>{p.icon}</div>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{p.label}</div>
                  <div style={{ width: 20, height: 20, borderRadius: 4, background: selectedPlatforms.includes(p.id) ? p.color : C.surface, border: `2px solid ${selectedPlatforms.includes(p.id) ? p.color : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#000" }}>
                    {selectedPlatforms.includes(p.id) ? "✓" : ""}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn("primary"), flex: 1, justifyContent: "center" }} onClick={sendRequest} disabled={sending || selectedPlatforms.length === 0}>
                {sending ? "Sending..." : `Send to ${showSendModal.customer}`}
              </button>
              <button style={S.btn("ghost")} onClick={() => setShowSendModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// ─── STOCK INVENTORY ─────────────────────────────────────────────────────────
