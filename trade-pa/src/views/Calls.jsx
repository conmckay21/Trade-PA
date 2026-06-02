// ─── Calls — call log (People tab) ──────────────────────────────────────
// Self-loading view (like Suppliers): lists every inbound/outbound call from
// public.call_logs for the signed-in user, newest first. Unknown callers (no
// customer_id) are flagged and can be turned into an enquiry or saved as a
// customer in one tap. Recording playback reuses the /api/calls/audio proxy.
import React, { useState, useEffect } from "react";
import { db } from "../lib/db.js";
import { C } from "../theme/colors.js";
import { S } from "../theme/styles.js";
import { newEnquiryId } from "../lib/ids.js";

const UNKNOWN = "Unknown caller";

function fmtWhen(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return `Today ${time}`;
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return `Yesterday ${time}`;
  return `${d.toLocaleDateString([], { day: "numeric", month: "short" })} ${time}`;
}

function fmtDur(secs) {
  if (!secs || secs < 1) return "";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function ArrowIn() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 7L7 17M7 7v10h10" />
    </svg>
  );
}
function ArrowOut() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17L17 7M17 17V7H7" />
    </svg>
  );
}

export function Calls({ user, customers, setCustomers, enquiries, setEnquiries, setView, makeCall, hasTwilio, setContextHint, companyId }) {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const [done, setDone] = useState({});
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    if (setContextHint) setContextHint("Looking at the call log");
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await db
          .from("call_logs")
          .select("*")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(200);
        if (!cancelled) {
          if (!error && Array.isArray(data)) setCalls(data);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const isUnknown = (c) => !c.customer_id;

  const counts = {
    all: calls.length,
    unknown: calls.filter(isUnknown).length,
    inbound: calls.filter((c) => c.direction === "inbound").length,
    outbound: calls.filter((c) => c.direction === "outbound").length,
  };

  const shown = calls.filter((c) => {
    if (filter === "unknown") return isUnknown(c);
    if (filter === "inbound") return c.direction === "inbound";
    if (filter === "outbound") return c.direction === "outbound";
    return true;
  });

  async function saveAsCustomer(c) {
    if (busy) return;
    setBusy(c.id);
    try {
      const name = c.customer_name && c.customer_name !== UNKNOWN ? c.customer_name : c.caller_number || "New customer";
      const { data: inserted, error } = await db
        .from("customers")
        .insert({
          company_id: companyId,
          user_id: user.id,
          name,
          phone: c.caller_number || "",
          email: "",
          address: "",
          notes: "Added from a phone call",
          is_company: false,
        })
        .select()
        .single();
      if (error || !inserted) {
        alert(`Couldn't save customer: ${error?.message || "unknown error"}`);
        setBusy(null);
        return;
      }
      setCustomers((prev) => [...(prev || []), inserted]);
      try {
        await db
          .from("call_logs")
          .update({ customer_id: inserted.id, customer_name: inserted.name })
          .eq("user_id", user.id)
          .eq("caller_number", c.caller_number);
      } catch (e) {}
      setCalls((prev) => prev.map((x) => (x.caller_number === c.caller_number ? { ...x, customer_id: inserted.id, customer_name: inserted.name } : x)));
      setDone((prev) => ({ ...prev, [c.id]: "customer" }));
    } catch (e) {
      alert(`Couldn't save customer: ${e.message}`);
    }
    setBusy(null);
  }

  function logEnquiry(c) {
    const enq = {
      id: newEnquiryId(),
      name: c.customer_name && c.customer_name !== UNKNOWN ? c.customer_name : "",
      phone: c.caller_number || "",
      email: "",
      address: "",
      source: "Phone",
      msg: c.summary || c.transcript || "",
      time: "Just now",
      status: "new",
      urgent: !!c.action_needed,
    };
    setEnquiries((prev) => [enq, ...(prev || [])]);
    setDone((prev) => ({ ...prev, [c.id]: "enquiry" }));
  }

  return (
    <div>
      <div
        onClick={() => setView("PeopleHub")}
        style={{ display: "flex", alignItems: "center", gap: 4, color: C.muted, fontSize: 12, cursor: "pointer", marginBottom: 12 }}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        People
      </div>

      <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 2 }}>Calls</div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Every call in and out. Unknown numbers are often new enquiries.</div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {[["all", "All"], ["unknown", "Unknown"], ["inbound", "Inbound"], ["outbound", "Outbound"]].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} style={S.pill(C.amber, filter === v)}>
            {l}
            {counts[v] ? ` ${counts[v]}` : ""}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: C.muted, fontSize: 13, padding: "24px 0", textAlign: "center" }}>Loading calls…</div>
      ) : shown.length === 0 ? (
        <div style={{ ...S.card, textAlign: "center", color: C.muted, fontSize: 13, padding: 28 }}>
          {filter === "all" ? "No calls yet. When someone rings your Trade PA number it'll show up here." : "No calls match this filter."}
        </div>
      ) : (
        shown.map((c) => {
          const unknown = isUnknown(c);
          const inbound = c.direction === "inbound";
          const accent = unknown ? C.amber : inbound ? C.blue : C.green;
          const open = expanded === c.id;
          const wasDone = done[c.id];
          const hasName = c.customer_name && c.customer_name !== UNKNOWN;
          const title = hasName ? c.customer_name : c.caller_number || UNKNOWN;
          return (
            <div
              key={c.id}
              style={{ ...S.card, borderLeft: `3px solid ${accent}`, marginBottom: 10, cursor: "pointer" }}
              onClick={() => setExpanded(open ? null : c.id)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: accent, display: "flex" }}>{inbound ? <ArrowIn /> : <ArrowOut />}</span>
                <span style={{ fontWeight: 700, color: C.text, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
                <span style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>{fmtWhen(c.created_at)}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                {unknown && <span style={S.badge(C.amber)}>Unknown</span>}
                {hasName && c.caller_number ? <span style={{ fontSize: 12, color: C.muted }}>{c.caller_number}</span> : null}
                <span style={{ fontSize: 12, color: C.muted }}>
                  {inbound ? "Inbound" : "Outbound"}
                  {fmtDur(c.duration_seconds) ? ` · ${fmtDur(c.duration_seconds)}` : ""}
                </span>
              </div>
              {c.summary && <div style={{ fontSize: 13, color: C.textDim, marginTop: 8, lineHeight: 1.5 }}>{c.summary}</div>}

              {open && (
                <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 12, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                  {c.action_needed && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={S.label}>Action needed</div>
                      <div style={{ fontSize: 13, color: C.text }}>{c.action_needed}</div>
                    </div>
                  )}
                  {c.key_details && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={S.label}>Key details</div>
                      <div style={{ fontSize: 13, color: C.text, whiteSpace: "pre-wrap" }}>{c.key_details}</div>
                    </div>
                  )}
                  {c.transcript && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={S.label}>Transcript</div>
                      <div style={{ fontSize: 12, color: C.textDim, whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto", background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10 }}>
                        {c.transcript}
                      </div>
                    </div>
                  )}
                  {c.recording_url && (
                    <audio controls style={{ width: "100%", marginTop: 4, height: 36 }} src={`${typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.() ? "https://www.tradespa.co.uk" : ""}/api/calls/audio?url=${encodeURIComponent(c.recording_url)}`} />
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    {hasTwilio && makeCall && c.caller_number && (
                      <button onClick={() => makeCall(c.caller_number)} style={S.btn("ghost")}>
                        Call back
                      </button>
                    )}
                    {unknown && wasDone === "enquiry" && <span style={S.badge(C.green)}>Logged as enquiry</span>}
                    {unknown && wasDone !== "enquiry" && (
                      <button onClick={() => logEnquiry(c)} style={S.btn("primary")}>
                        Log as enquiry
                      </button>
                    )}
                    {unknown && wasDone !== "customer" && (
                      <button onClick={() => saveAsCustomer(c)} disabled={busy === c.id} style={S.btn("ghost", busy === c.id)}>
                        Save as customer
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
