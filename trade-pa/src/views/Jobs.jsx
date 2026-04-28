// ─── Jobs Tab ───────────────────────────────────────────────────────────
// Extracted verbatim from App.jsx during P7 sub-batch C (28 Apr 2026).
//
// Largest single component in the codebase aside from AIAssistant. Renders
// the jobs list + per-job detail view, with embedded sub-views for time
// logs, materials links, RAMS docs, certificates, and stage payments.
//
// CertificatesTab and the compliance/cert helpers it uses live in
// ./Certificates.jsx (split out per Phase 7 audit to keep this file under
// the 2k-line goal).
import React, { useState, useEffect, useRef } from "react";
import { db } from "../lib/db.js";
import { C } from "../theme/colors.js";
import { S } from "../theme/styles.js";
import { fmtCurrency, fmtAmount, relTime } from "../lib/format.js";
import { localDate, weekBounds, groupByRecency } from "../lib/time.js";
import { generatePortalToken, nextInvoiceId } from "../lib/ids.js";
import { statusColor } from "../lib/status.js";
import { DetailPage } from "../components/DetailPage.jsx";
import { VoiceFillButton } from "../components/VoiceFillButton.jsx";
import {
  CertificatesTab,
  SignaturePad,
  printComplianceDoc,
  emailComplianceDoc,
} from "./Certificates.jsx";

export function JobsTab({ user, brand, customers, invoices, setInvoices, setView, setContextHint }) {
  const db = window._supabase;
  const [jobs, setJobCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  // Phase 5b: publish a context hint when a job is selected so the floating
  // mic can pass a record-scoped context into the AI overlay.  Clears on
  // close + on component unmount (tab switch).
  useEffect(() => {
    if (!setContextHint) return;
    if (selected) {
      const bits = [];
      bits.push("Job: " + (selected.title || selected.type || "Untitled"));
      if (selected.customer) bits.push(selected.customer);
      if (selected.address) bits.push(selected.address);
      if (selected.status) bits.push(selected.status.replace("_", " "));
      if (selected.value > 0) bits.push("£" + selected.value);
      setContextHint(bits.join(" · "));
    } else {
      setContextHint(null);
    }
    return () => { if (setContextHint) setContextHint(null); };
  }, [selected, setContextHint]);
  const [tab, setTab] = useState("notes");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", customer: "", address: "", type: "", status: "enquiry", value: "", po_number: "", notes: "", scope_of_work: "", annual_service: false });
  const [drawings, setDrawings] = useState([]);
  const [notes, setNotes] = useState([]);
  const [linkedRams, setLinkedRams] = useState([]);
  const [linkedMaterials, setLinkedMaterials] = useState([]);
  const [linkedPOs, setLinkedPOs] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [timeLogs, setTimeLogs] = useState([]);
  const [vos, setVos] = useState([]);
  const [compDocs, setCompDocs] = useState([]);
  const [daysheets, setDaysheets] = useState([]);
  const [saving, setSaving] = useState(false);
  const [addNote, setAddNote] = useState("");
  const [addTime, setAddTime] = useState({ date: localDate(), labour_type: "hourly", hours: "", days: "", rate: "", total: "", worker: "", description: "" });
  const [addVO, setAddVO] = useState({ vo_number: "", description: "", amount: "" });
  const [addDoc, setAddDoc] = useState({ doc_type: "", doc_number: "", issued_date: "", expiry_date: "", notes: "" });
  const [addDaysheet, setAddDaysheet] = useState({ sheet_date: localDate(), worker_name: "", hours: "", rate: "", description: "", contractor_name: "" });
  const [emailConnection, setEmailConnection] = useState(null);
  const [showSignature, setShowSignature] = useState(false);
  const [editingJob, setEditingJob] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [showStagePayments, setShowStagePayments] = useState(false);
  const [stagePaymentStages, setStagePaymentStages] = useState([
    { label: "Deposit", type: "pct", value: "30" },
    { label: "First Fix", type: "pct", value: "40" },
    { label: "Completion", type: "pct", value: "30" },
  ]);
  const [jobCallLogs, setJobCallLogs] = useState([]);
  // Geofencing state
  const [geoState, setGeoState] = useState("idle"); // idle | requesting | travelling | arrived | finished
  const [geoJobId, setGeoJobId] = useState(null);   // which job is active
  const [arrivalTime, setArrivalTime] = useState(null);
  const [geoDistance, setGeoDistance] = useState(null); // metres from job
  const [jobCoords, setJobCoords] = useState(null);     // { lat, lng } of job address
  const geoWatchRef = useRef(null);
  const photoRef = useRef();
  const setF = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  // ── Geofencing helpers ────────────────────────────────────────────────────────
  function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  async function geocodeAddress(address) {
    const key = import.meta.env.VITE_GOOGLE_MAPS_KEY;
    if (!key) return null;
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address + ", UK")}&key=${key}`);
      const data = await res.json();
      if (data.status === "OK" && data.results?.[0]) {
        const loc = data.results[0].geometry.location;
        return { lat: loc.lat, lng: loc.lng };
      }
    } catch {}
    return null;
  }

  async function startGeoTracking(job) {
    if (!job.address) { alert("Add an address to this job before tracking."); return; }
    if (!navigator.geolocation) { alert("Location not supported on this device."); return; }
    setGeoState("requesting");
    setGeoJobId(job.id);
    setArrivalTime(null);
    setGeoDistance(null);
    const coords = await geocodeAddress(job.address);
    setJobCoords(coords);
    setGeoState("travelling");
    if (geoWatchRef.current) navigator.geolocation.clearWatch(geoWatchRef.current);
    geoWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (!coords) return;
        const dist = haversineDistance(pos.coords.latitude, pos.coords.longitude, coords.lat, coords.lng);
        setGeoDistance(Math.round(dist));
        setGeoState(prev => {
          if (prev === "travelling" && dist < 80) {
            setArrivalTime(new Date());
            return "arrived";
          }
          return prev;
        });
      },
      (err) => console.log("Geo:", err.message),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  }

  function stopGeoTracking() {
    if (geoWatchRef.current) { navigator.geolocation.clearWatch(geoWatchRef.current); geoWatchRef.current = null; }
    setGeoState("idle"); setGeoJobId(null); setArrivalTime(null); setGeoDistance(null); setJobCoords(null);
  }

  function markArrived(job) {
    setArrivalTime(new Date());
    setGeoState("arrived");
    // Update job to in_progress
    db.from("job_cards").update({ status: "in_progress" }).eq("id", job.id).then(() => {
      setJobCards(prev => prev.map(j => j.id === job.id ? { ...j, status: "in_progress" } : j));
      if (selected?.id === job.id) setSelected(s => ({ ...s, status: "in_progress" }));
    });
  }

  async function finishJob(job) {
    const departure = new Date();
    const arrival = arrivalTime || departure;
    const hours = parseFloat(Math.max((departure - arrival) / 3600000, 0.25).toFixed(2));
    const arrStr = arrival.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const depStr = departure.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    if (job?.id && user?.id) {
      const { data } = await db.from("time_logs").insert({
        job_id: job.id, user_id: user.id,
        log_date: arrival.toISOString().slice(0, 10),
        hours,
        rate: parseFloat(brand?.defaultHourlyRate || 0) || 0,
        description: `On site ${arrStr}–${depStr} · auto-tracked`,
      }).select().single();
      if (data) setTimeLogs(prev => [data, ...prev]);
    }
    stopGeoTracking();
    setGeoState("finished");
    setGeoJobId(job.id);
  }

  useEffect(() => { loadJobs(); loadEmailConn(); }, [user]);
  useEffect(() => () => { if (geoWatchRef.current) navigator.geolocation.clearWatch(geoWatchRef.current); }, []);
  useEffect(() => {
    if (selected) {
      loadJobDetails(selected.id);
      // Load call logs for this job
      if (user?.id) {
        db.from("call_logs")
          .select("*")
          .eq("user_id", user.id)
          .ilike("customer_name", selected.customer || "")
          .order("created_at", { ascending: false })
          .then(({ data }) => setJobCallLogs(data || []))
          .catch(() => setJobCallLogs([]));
      }
    }
  }, [selected?.id]);
  useEffect(() => {
    if (!jobs.length || loading) return;
    const today = new Date();
    jobs.forEach(j => {
      if (j.annual_service && j.next_service_date && !j.service_reminder_sent) {
        const due = new Date(j.next_service_date);
        const daysUntil = Math.ceil((due - today) / 86400000);
        if (daysUntil <= 14 && daysUntil >= 0) sendServiceReminder(j);
      }
    });
  }, [jobs, loading]);

  async function loadEmailConn() {
    if (!user) return;
    const { data } = await db.from("email_connections").select("provider, email").eq("user_id", user.id);
    if (data?.length) setEmailConnection(data[0]);
  }

  async function loadJobs() {
    if (!user) return;
    setLoading(true);
    const { data } = await db.from("job_cards").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setJobCards(data || []);
    setLoading(false);
  }

  async function loadJobDetails(jobId) {
    try {
      const [n, p, t, v, d, ds, dr, rams, mats, pos] = await Promise.all([
        db.from("job_notes").select("*").eq("job_id", jobId).order("created_at", { ascending: false }),
        db.from("job_photos").select("*").eq("job_id", jobId).order("created_at", { ascending: false }),
        db.from("time_logs").select("*").eq("job_id", jobId).order("log_date", { ascending: false }),
        db.from("variation_orders").select("*").eq("job_id", jobId).order("created_at", { ascending: false }),
        db.from("compliance_docs").select("*").eq("job_id", jobId).order("created_at", { ascending: false }),
        db.from("daywork_sheets").select("*").eq("job_id", jobId).order("sheet_date", { ascending: false }),
        db.from("job_drawings").select("*").eq("job_id", jobId).order("created_at", { ascending: false }),
        db.from("rams_documents").select("id,title,site_address,created_at").eq("job_id", jobId).eq("user_id", user.id),
        db.from("materials").select("*").eq("job_id", jobId).eq("user_id", user.id),
        db.from("purchase_orders").select("*, purchase_order_items(*)").eq("job_id", jobId).eq("user_id", user.id),
      ]);
      setNotes(n.data || []);
      setPhotos(p.data || []);
      setTimeLogs(t.data || []);
      setVos(v.data || []);
      setCompDocs(d.data || []);
      setDaysheets(ds.data || []);
      setDrawings(dr.data || []);
      setLinkedRams(rams.data || []);
      setLinkedMaterials(mats.data || []);
      setLinkedPOs(pos.data || []);
    } catch (err) {
      console.error("loadJobDetails error:", err.message);
      // Still load critical data even if drawings table missing
      const [n, p, t, v, d, ds] = await Promise.all([
        db.from("job_notes").select("*").eq("job_id", jobId).order("created_at", { ascending: false }),
        db.from("job_photos").select("*").eq("job_id", jobId).order("created_at", { ascending: false }),
        db.from("time_logs").select("*").eq("job_id", jobId).order("log_date", { ascending: false }),
        db.from("variation_orders").select("*").eq("job_id", jobId).order("created_at", { ascending: false }),
        db.from("compliance_docs").select("*").eq("job_id", jobId).order("created_at", { ascending: false }),
        db.from("daywork_sheets").select("*").eq("job_id", jobId).order("sheet_date", { ascending: false }),
      ]);
      setNotes(n.data || []);
      setPhotos(p.data || []);
      setTimeLogs(t.data || []);
      setVos(v.data || []);
      setCompDocs(d.data || []);
      setDaysheets(ds.data || []);
      setDrawings([]);
      setLinkedRams([]); setLinkedMaterials([]); setLinkedPOs([]);
    }
  }

  async function sendServiceReminder(job) {
    const cust = (customers || []).find(c => c.name?.toLowerCase() === job.customer?.toLowerCase());
    if (!cust?.email) return;
    await db.from("job_cards").update({ service_reminder_sent: true }).eq("id", job.id);
    setJobCards(prev => prev.map(j => j.id === job.id ? { ...j, service_reminder_sent: true } : j));
    const { data: conns } = await db.from("email_connections").select("provider").eq("user_id", user.id);
    if (!conns?.length) return;
    const provider = conns[0].provider;
    const endpoint = provider === "outlook" ? "/api/outlook/send" : "/api/gmail/send";
    const dueDate = new Date(job.next_service_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id, to: cust.email, subject: `Annual Service Reminder — ${job.title || job.type}`, body: `<p>Dear ${job.customer},</p><p>Your annual service for <strong>${job.title || job.type}</strong> at ${job.address || "your property"} is due on <strong>${dueDate}</strong>.</p><p>Please get in touch to arrange a convenient time.</p><p>Many thanks,<br>${brand.tradingName}${brand.phone ? `<br>${brand.phone}` : ""}</p>` }) });
  }

  async function saveJob() {
    if (!form.customer && !form.title) return;
    setSaving(true);
    const payload = { user_id: user.id, title: form.title, customer: form.customer, address: form.address, type: form.type, status: form.status, value: parseFloat(form.value) || 0, po_number: form.po_number, notes: form.notes, scope_of_work: form.scope_of_work || "", annual_service: form.annual_service, updated_at: new Date().toISOString() };
    const { data, error } = await db.from("job_cards").insert(payload).select().single();
    if (!error && data) { setJobCards(prev => [data, ...prev]); setShowAdd(false); setForm({ title: "", customer: "", address: "", type: "", status: "enquiry", value: "", po_number: "", notes: "", scope_of_work: "", annual_service: false }); }
    setSaving(false);
  }

  async function deleteJob(id) {
    if (!window.confirm("Delete this job card?")) return;
    await db.from("job_cards").delete().eq("id", id);
    setJobCards(prev => prev.filter(j => j.id !== id));
    setSelected(null);
  }

  async function addNoteToJob() {
    if (!addNote.trim() || !selected) return;
    const { data } = await db.from("job_notes").insert({ job_id: selected.id, user_id: user.id, note: addNote, created_at: new Date().toISOString() }).select().single();
    if (data) { setNotes(prev => [data, ...prev]); setAddNote(""); }
  }

  async function addTimeLog() {
    if (!selected) return;
    const type = addTime.labour_type || "hourly";
    let hours = 0, rate = 0, total = 0, days = null;
    if (type === "hourly") {
      if (!addTime.hours || !addTime.rate) return;
      hours = parseFloat(addTime.hours);
      rate = parseFloat(addTime.rate);
      total = parseFloat((hours * rate).toFixed(2));
    } else if (type === "day_rate") {
      if (!addTime.days || !addTime.rate) return;
      days = parseFloat(addTime.days);
      hours = days * 8;
      rate = parseFloat(addTime.rate);
      total = parseFloat((days * rate).toFixed(2));
    } else if (type === "price_work") {
      if (!addTime.total) return;
      total = parseFloat(addTime.total);
    }

    const payload = {
      job_id: selected.id,
      user_id: user.id,
      log_date: addTime.date,
      hours,
      rate,
      description: addTime.description || "",
    };

    // Add new columns conditionally — gracefully handles if columns don't exist yet
    try {
      payload.labour_type = type;
      payload.total = total;
      if (days) payload.days = days;
      if (addTime.worker) payload.worker = addTime.worker;
    } catch(e) {}

    const { data, error } = await db.from("time_logs").insert(payload).select().single();

    if (error) {
      // If new columns don't exist, retry with basic payload
      if (error.message?.includes("labour_type") || error.message?.includes("total") || error.message?.includes("worker") || error.message?.includes("days") || error.message?.includes("date")) {
        const basicPayload = { job_id: selected.id, user_id: user.id, hours, rate, description: `${addTime.description || ""}${type !== "hourly" ? ` [${type}: ${fmtCurrency(total)}]` : ""}` };
        const { data: d2, error: e2 } = await db.from("time_logs").insert(basicPayload).select().single();
        if (e2) { alert(`Failed to log labour: ${e2.message}\n\nPlease run the SQL migration in Supabase to add missing columns.`); return; }
        if (d2) { setTimeLogs(prev => [{ ...d2, labour_type: type, total, days, log_date: addTime.date }, ...prev]); setAddTime({ date: localDate(), labour_type: type, hours: "", days: "", rate: "", total: "", worker: "", description: "" }); }
      } else {
        alert(`Failed to log labour: ${error.message}`);
      }
      return;
    }

    if (data) {
      setTimeLogs(prev => [data, ...prev]);
      setAddTime({ date: localDate(), labour_type: type, hours: "", days: "", rate: "", total: "", worker: "", description: "" });
    }
  }

  async function addVariationOrder() {
    if (!addVO.description || !selected) return;
    const { data } = await db.from("variation_orders").insert({ job_id: selected.id, user_id: user.id, ...addVO, amount: parseFloat(addVO.amount) || 0, status: "pending" }).select().single();
    if (data) { setVos(prev => [data, ...prev]); setAddVO({ vo_number: "", description: "", amount: "" }); }
  }

  async function addComplianceDoc() {
    if (!addDoc.doc_type || !selected) return;
    const { data } = await db.from("compliance_docs").insert({ job_id: selected.id, user_id: user.id, ...addDoc }).select().single();
    if (data) { setCompDocs(prev => [data, ...prev]); setAddDoc({ doc_type: "", doc_number: "", issued_date: "", expiry_date: "", notes: "" }); }
  }

  async function addDayworkSheet() {
    if (!addDaysheet.hours || !addDaysheet.rate || !selected) return;
    const { data, error } = await db.from("daywork_sheets").insert({ job_id: selected.id, user_id: user.id, ...addDaysheet, hours: parseFloat(addDaysheet.hours), rate: parseFloat(addDaysheet.rate) }).select().single();
    if (error) { alert(`Couldn't save daywork sheet: ${error.message}`); return; }
    if (data) { setDaysheets(prev => [data, ...prev]); setAddDaysheet({ sheet_date: localDate(), worker_name: "", hours: "", rate: "", description: "", contractor_name: "" }); }
  }

  const COMPLIANCE_TYPES = ["Gas Safety Certificate","Boiler Commissioning Sheet","EICR","Electrical Installation Certificate","Minor Works Certificate","PAT Testing","Pressure Test Certificate","Part P Certificate","Oil Safety Certificate","Other"];

  const statusOptions = ["enquiry","quoted","accepted","in_progress","completed","on_hold"];
  const totalTime = timeLogs.reduce((s, t) => s + (t.labour_type === "day_rate" ? (t.days || 0) : t.labour_type === "price_work" ? 0 : (t.hours || 0)), 0);
  const totalDays = timeLogs.reduce((s, t) => s + (t.labour_type === "day_rate" ? (t.days || 0) : 0), 0);
  const totalLabour = timeLogs.reduce((s, t) => s + (parseFloat(t.total || 0) || (parseFloat(t.hours || 0) * parseFloat(t.rate || 0))), 0);
  const totalVO = vos.filter(v => v.status === "approved").reduce((s, v) => s + (v.amount || 0), 0);

  // Pre-compute profit tab values (used when tab === "profit")
  const profitRevenue = parseFloat(selected?.value || 0);
  const profitMatCost = linkedMaterials.reduce((s, m) => s + parseFloat(m.unit_price || 0) * parseFloat(m.qty || 1), 0);
  const profitLabourCost = totalLabour;
  const profitTotalCost = profitMatCost + profitLabourCost;
  const profitGross = profitRevenue - profitTotalCost;
  const profitMargin = profitRevenue > 0 ? (profitGross / profitRevenue) * 100 : 0;
  const profitFmt = n => "£" + Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const profitIsGood = profitMargin >= 30;
  const profitIsOk = profitMargin >= 15;
  const profitColor = profitIsGood ? C.green : profitIsOk ? C.amber : C.red;

  // ── Phase 3: list-level controls (search / filter / sort / grouping) ───────
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [sortMode, setSortMode] = useState("recent");

  // Canonical status pill map — amber deliberately reserved for primary
  // actions/warnings per usability audit; no amber pills used for status.
  const JOB_PILL = {
    enquiry:     { label: "Enquiry",     color: C.muted  },
    quoted:      { label: "Quoted",      color: C.blue   },
    accepted:    { label: "Accepted",    color: C.purple },
    in_progress: { label: "In Progress", color: C.blue   },
    completed:   { label: "Completed",   color: C.green  },
    on_hold:     { label: "On Hold",     color: C.muted  },
  };

  // Relative timestamp + week bounds — see module-scope utilities.
  const _bounds = weekBounds();
  const { weekStart: _weekStart, weekEnd: _weekEnd } = _bounds;

  // Per-job derivations — "needs invoice", "overdue", "this week"
  const invoiceFor     = (j) => (invoices || []).find(i => i.id === j.invoice_id);
  const isInvoiced     = (j) => !!j.invoice_id;
  const isOverdue      = (j) => { const inv = invoiceFor(j); return !!inv && typeof inv.status === "string" && inv.status.toLowerCase() === "overdue"; };
  const isNeedsInvoice = (j) => j.status === "completed" && !j.invoice_id;
  const isThisWeek     = (j) => { const d = j.scheduled_date || j.date || j.created_at; if (!d) return false; const t = new Date(d).getTime(); return t >= _weekStart && t < _weekEnd; };
  const jobTime        = (j) => new Date(j.updated_at || j.created_at || j.scheduled_date || j.date || 0).getTime();

  // Live filter-chip counts — unfiltered, so counts always reflect reality
  const counts = {
    all:           jobs.length,
    active:        jobs.filter(j => j.status === "accepted" || j.status === "in_progress").length,
    needs_invoice: jobs.filter(isNeedsInvoice).length,
    overdue:       jobs.filter(isOverdue).length,
    this_week:     jobs.filter(isThisWeek).length,
    quotes:        jobs.filter(j => j.status === "quoted").length,
    complete:      jobs.filter(j => j.status === "completed").length,
  };

  // Apply search + filter
  const _q = search.trim().toLowerCase();
  const filteredJobs = jobs.filter(j => {
    if (_q) {
      const hay = [j.title, j.customer, j.address, j.type, j.po_number, j.id].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(_q)) return false;
    }
    switch (activeFilter) {
      case "active":        return j.status === "accepted" || j.status === "in_progress";
      case "needs_invoice": return isNeedsInvoice(j);
      case "overdue":       return isOverdue(j);
      case "this_week":     return isThisWeek(j);
      case "quotes":        return j.status === "quoted";
      case "complete":      return j.status === "completed";
      default:              return true;
    }
  });

  // Sort
  const sortedJobs = [...filteredJobs].sort((a, b) => {
    switch (sortMode) {
      case "value":    return parseFloat(b.value || 0) - parseFloat(a.value || 0);
      case "customer": return (a.customer || "").localeCompare(b.customer || "");
      case "status":   return (a.status || "").localeCompare(b.status || "");
      default:         return jobTime(b) - jobTime(a);
    }
  });

  // Group by recency bucket — only when sorting by recency
  const groupedJobs = sortMode === "recent"
    ? groupByRecency(sortedJobs, jobTime, _bounds)
    : [{ key: "flat", label: null, items: sortedJobs }];

  // Chip config + sort cycle
  const CHIPS = [
    { id: "all",           label: "All",           urgent: false },
    { id: "active",        label: "Active",        urgent: false },
    { id: "needs_invoice", label: "Needs invoice", urgent: true  },
    { id: "overdue",       label: "Overdue",       urgent: true  },
    { id: "this_week",     label: "This week",     urgent: false },
    { id: "quotes",        label: "Quotes",        urgent: false },
    { id: "complete",      label: "Complete",      urgent: false },
  ];
  const SORT_LABELS = { recent: "Recent", value: "By value", customer: "By customer", status: "By status" };
  const SORT_ORDER = ["recent", "value", "customer", "status"];
  const nextSort = () => setSortMode(s => SORT_ORDER[(SORT_ORDER.indexOf(s) + 1) % SORT_ORDER.length]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header — job count + urgency snapshot + Add button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
          <div style={{ fontSize: 13, color: C.muted }}>{jobs.length} job{jobs.length !== 1 ? "s" : ""}</div>
          {counts.needs_invoice > 0 && (
            <div style={{ fontSize: 12, color: C.red, fontWeight: 600 }}>· {counts.needs_invoice} need{counts.needs_invoice === 1 ? "s" : ""} invoice</div>
          )}
          {counts.overdue > 0 && (
            <div style={{ fontSize: 12, color: C.red, fontWeight: 600 }}>· {counts.overdue} overdue</div>
          )}
        </div>
        <button style={S.btn("primary")} onClick={() => setShowAdd(true)}>+ Add Job</button>
      </div>

      {/* Phase 3: search + filter chips + sort — always visible, persistent */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search jobs — title, customer, address…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 13, minWidth: 0, fontFamily: "inherit" }}
          />
          {search && (
            <button onClick={() => setSearch("")} aria-label="Clear search" style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: 0, flexShrink: 0 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
          )}
        </div>

        {/* Filter chips */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
          {CHIPS.map(chip => {
            const n = counts[chip.id];
            const active = activeFilter === chip.id;
            const muted  = !active && chip.id !== "all" && n === 0;
            const urgentLive = chip.urgent && n > 0;
            const accent = urgentLive ? C.red : C.text;
            return (
              <button
                key={chip.id}
                onClick={() => setActiveFilter(chip.id)}
                disabled={muted}
                style={{
                  flexShrink: 0,
                  padding: "6px 11px",
                  borderRadius: 16,
                  border: `1px solid ${active ? accent : C.border}`,
                  background: active ? (urgentLive ? C.red + "22" : C.surfaceHigh) : "transparent",
                  color: active ? accent : (urgentLive ? C.red : C.muted),
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  fontFamily: "'DM Mono', monospace",
                  cursor: muted ? "default" : "pointer",
                  opacity: muted ? 0.4 : 1,
                  whiteSpace: "nowrap",
                  transition: "background 0.15s, border-color 0.15s, color 0.15s",
                }}
              >
                {chip.label}{n > 0 && <span style={{ marginLeft: 5, fontWeight: 700 }}>{n}</span>}
              </button>
            );
          })}
        </div>

        {/* Sort affordance */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={nextSort}
            aria-label="Change sort"
            style={{
              background: "none", border: "none",
              color: C.muted, fontSize: 11,
              fontFamily: "'DM Mono', monospace", letterSpacing: "0.04em",
              cursor: "pointer", padding: "2px 4px",
            }}
          >
            {SORT_LABELS[sortMode]} ↕
          </button>
        </div>
      </div>

      {/* Add Job form */}
      {showAdd && (
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={S.sectionTitle}>New Job Card</div>
            <VoiceFillButton form={form} setForm={setForm} fieldDescriptions="title (job title), customer (customer name), address (property address), type (job type e.g. boiler service), status (enquiry/quoted/accepted/in_progress/completed), value (job value in pounds), po_number (PO number if applicable), notes (any notes)" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div><label style={S.label}>Job Title</label><input style={S.input} placeholder="e.g. Boiler Service" value={form.title} onChange={setF("title")} /></div>
              <div><label style={S.label}>Customer</label><input style={S.input} placeholder="Customer name" value={form.customer} onChange={setF("customer")} /></div>
              <div style={{ gridColumn: "1/-1" }}><label style={S.label}>Address</label><input style={S.input} placeholder="Property address" value={form.address} onChange={setF("address")} /></div>
              <div><label style={S.label}>Job Type</label><input style={S.input} placeholder="e.g. Plumbing, Electrical" value={form.type} onChange={setF("type")} /></div>
              <div><label style={S.label}>Status</label><select style={S.input} value={form.status} onChange={setF("status")}>{statusOptions.map(s => <option key={s} value={s}>{s.replace("_"," ")}</option>)}</select></div>
              <div><label style={S.label}>Value (£)</label><input type="number" style={S.input} placeholder="0" value={form.value} onChange={setF("value")} /></div>
              <div><label style={S.label}>PO Number</label><input style={S.input} placeholder="Optional" value={form.po_number} onChange={setF("po_number")} /></div>
            </div>
            <div><label style={S.label}>Notes</label><textarea style={{ ...S.input, minHeight: 60, resize: "none" }} value={form.notes} onChange={setF("notes")} /></div>
            <div><label style={S.label}>Scope of Work</label><textarea style={{ ...S.input, minHeight: 80, resize: "none" }} placeholder="Detail the work to be carried out..." value={form.scope_of_work} onChange={setF("scope_of_work")} /></div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8, cursor: "pointer" }} onClick={() => setForm(f => ({ ...f, annual_service: !f.annual_service }))}>
              <div style={{ width: 36, height: 20, borderRadius: 10, background: form.annual_service ? C.amber : C.border, position: "relative", flexShrink: 0, transition: "all 0.2s" }}>
                <div style={{ position: "absolute", top: 2, left: form.annual_service ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "all 0.2s" }} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Annual Service Job <span style={{ color: C.muted, fontWeight: 400 }}>(auto-reminder at 50 weeks)</span></div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn("primary"), flex: 1 }} disabled={saving || (!form.customer && !form.title)} onClick={saveJob}>{saving ? "Saving..." : "Save Job →"}</button>
              <button style={S.btn("ghost")} onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Job list */}
      {loading && <div style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: 24 }}>Loading jobs...</div>}
      {!loading && jobs.length === 0 && !showAdd && (
        <div style={{ ...S.card, textAlign: "center", padding: 32 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🔧</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>No job cards yet — convert a quote, ask Trade PA, or create one manually.</div>
          <button style={S.btn("primary")} onClick={() => setShowAdd(true)}>+ Add First Job</button>
        </div>
      )}
      {!loading && jobs.length > 0 && sortedJobs.length === 0 && (
        <div style={{ ...S.card, textAlign: "center", padding: 22 }}>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>
            No jobs match {_q ? <>&ldquo;{search}&rdquo;</> : `"${CHIPS.find(c => c.id === activeFilter)?.label || activeFilter}"`}.
          </div>
          <button style={{ ...S.btn("ghost"), fontSize: 12 }} onClick={() => { setSearch(""); setActiveFilter("all"); }}>Clear filters</button>
        </div>
      )}
      {!loading && groupedJobs.map(group => (
        <React.Fragment key={group.key}>
          {group.label && (
            <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: C.muted, letterSpacing: "0.14em", fontWeight: 700, paddingLeft: 2, paddingTop: 4 }}>
              {group.label} · {group.items.length}
            </div>
          )}
          {group.items.map(j => {
            const pill = JOB_PILL[j.status] || { label: (j.status || "—").replace("_", " "), color: C.muted };
            const overdue      = isOverdue(j);
            const invoiced     = isInvoiced(j);
            const needsInvoice = isNeedsInvoice(j);
            // Left-edge stripe follows most-urgent derived state, else pill colour
            const stripe = overdue ? C.red : needsInvoice ? C.red : invoiced ? C.purple : pill.color;
            return (
              <div key={j.id} onClick={() => { setSelected(j); setTab("notes"); }} style={{ ...S.card, cursor: "pointer", borderLeft: `3px solid ${stripe}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.title || j.type || "Job"}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.customer || "—"}{j.address ? ` · ${j.address}` : ""}</div>
                    {/* Metadata row — pill, derived pills, time, icons */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                      <span style={{ ...S.badge(pill.color), fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.04em" }}>{pill.label}</span>
                      {overdue && <span style={{ ...S.badge(C.red), fontFamily: "'DM Mono', monospace", fontSize: 10 }}>Overdue</span>}
                      {invoiced && !overdue && <span style={{ ...S.badge(C.purple), fontFamily: "'DM Mono', monospace", fontSize: 10 }}>Invoiced</span>}
                      {needsInvoice && !invoiced && <span style={{ ...S.badge(C.red), fontFamily: "'DM Mono', monospace", fontSize: 10 }}>Needs invoice</span>}
                      {j.po_number && <span style={{ ...S.badge(C.blue), fontFamily: "'DM Mono', monospace", fontSize: 10 }}>PO: {j.po_number}</span>}
                      <span style={{ fontSize: 11, color: C.muted, fontFamily: "'DM Mono', monospace" }}>{relTime(j.updated_at || j.created_at)}</span>
                      {j.annual_service && <span style={{ color: C.green, fontSize: 11 }}>🔄 Annual</span>}
                      {j.customer_signature && <span style={{ color: C.green, fontSize: 11 }}>✓ Signed</span>}
                      {geoJobId === j.id && geoState === "travelling" && <span style={{ color: C.amber, fontSize: 11 }}>🚗 {geoDistance !== null ? (geoDistance < 1000 ? geoDistance + "m" : (geoDistance/1000).toFixed(1) + "km") : "Travelling"}</span>}
                      {geoJobId === j.id && geoState === "arrived" && <span style={{ color: C.green, fontSize: 11 }}>📍 On site</span>}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: "right" }}>
                    {j.value > 0 && <div style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: "-0.01em" }}>{fmtAmount(j.value)}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </React.Fragment>
      ))}

      {/* Detail page — Phase 4 */}
      {selected && (
        <DetailPage
          title={selected.title || selected.type || "Job"}
          subtitle="Job"
          onBack={() => setSelected(null)}
          maxWidth={520}
          rightHeader={
            <button style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px" }} onClick={() => { setEditForm({ title: selected.title || "", customer: selected.customer || "", address: selected.address || "", type: selected.type || "", status: selected.status || "enquiry", value: selected.value || "", po_number: selected.po_number || "", notes: selected.notes || "", annual_service: selected.annual_service || false }); setEditingJob(true); }}>Edit</button>
          }
        >
          {/* Customer + address + status/value/PO pills hero */}
          <div style={{ marginBottom: 14 }}>
            {(selected.customer || selected.address) && (
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>{selected.customer}{selected.address ? ` · ${selected.address}` : ""}</div>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={S.badge(statusColor[selected.status] || C.muted)}>{(selected.status || "").replace("_"," ")}</span>
              {selected.value > 0 && <span style={S.badge(C.amber)}>£{selected.value}</span>}
              {selected.po_number && <span style={S.badge(C.blue)}>PO: {selected.po_number}</span>}
              {selected.annual_service && <span style={{ color: C.green, fontSize: 11 }}>🔄 Annual</span>}
              {selected.customer_signature && <span style={{ color: C.green, fontSize: 11 }}>✓ Signed off</span>}
            </div>
          </div>

            {/* Geofence live status banner */}
            {geoJobId === selected.id && geoState !== "idle" && (
              <div style={{ padding: "10px 16px", background: geoState === "arrived" ? C.green + "18" : geoState === "finished" ? C.surfaceHigh : C.amber + "18", borderBottom: `1px solid ${geoState === "arrived" ? C.green + "44" : geoState === "finished" ? C.border : C.amber + "44"}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 18 }}>{geoState === "requesting" ? "⏳" : geoState === "travelling" ? "🚗" : geoState === "arrived" ? "📍" : "✅"}</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: geoState === "arrived" ? C.green : geoState === "finished" ? C.text : C.amber }}>
                      {geoState === "requesting" && "Getting your location..."}
                      {geoState === "travelling" && (geoDistance !== null ? `${geoDistance < 1000 ? geoDistance + "m" : (geoDistance/1000).toFixed(1) + "km"} from job` : "Travelling to job")}
                      {geoState === "arrived" && `Arrived · ${arrivalTime?.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`}
                      {geoState === "finished" && "Session saved to Time tab"}
                    </div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>
                      {geoState === "travelling" && jobCoords ? "Auto-arrival within 80m" : geoState === "travelling" ? "Tap 'I've Arrived' when on site" : ""}
                      {geoState === "arrived" && "Tap Finish Job when leaving"}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {geoState === "travelling" && !jobCoords && (
                    <button style={{ ...S.btn("primary"), fontSize: 11, padding: "5px 10px" }} onClick={() => markArrived(selected)}>I've Arrived</button>
                  )}
                  {geoState === "arrived" && (
                    <button style={{ ...S.btn("primary"), fontSize: 11, padding: "5px 10px", background: C.red, color: "#fff" }} onClick={() => finishJob(selected)}>Finish Job</button>
                  )}
                  {(geoState === "travelling" || geoState === "arrived") && (
                    <button style={{ ...S.btn("ghost"), fontSize: 11, padding: "5px 8px" }} onClick={stopGeoTracking}>✕</button>
                  )}
                  {geoState === "finished" && (
                    <button style={{ ...S.btn("ghost"), fontSize: 11, padding: "5px 10px" }} onClick={() => { setGeoState("idle"); setGeoJobId(null); }}>Dismiss</button>
                  )}
                </div>
              </div>
            )}

            {/* Sub-tabs */}
            <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}`, flexShrink: 0, overflowX: "auto" }}>
              {[["notes","Notes"],["photos","Photos"],["labour","Labour"],["vo","Variations"],["docs","Documents"],["certs","Certificates"],["daywork","Daywork"],["plans","📐 Plans"],["calls",`📞${jobCallLogs.length > 0 ? ` (${jobCallLogs.length})` : ""}`],["profit","💰 Profit"]].map(([v,l]) => (
                <button key={v} onClick={() => setTab(v)}
                  style={{ padding: "8px 12px", border: "none", borderBottom: tab === v ? `2px solid ${C.amber}` : "2px solid transparent", background: "transparent", color: tab === v ? C.amber : C.muted, fontSize: 11, fontWeight: tab === v ? 700 : 400, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'DM Mono',monospace" }}>
                  {l}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ padding: 16, overflowY: "auto", maxHeight: "55vh" }}>

              {/* NOTES */}
              {tab === "notes" && (
                <div>
                  {selected.scope_of_work && (
                    <div style={{ background: C.surfaceHigh, borderRadius: 8, padding: "10px 14px", marginBottom: 14, borderLeft: `3px solid ${C.amber}` }}>
                      <div style={{ fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Scope of Work</div>
                      <div style={{ fontSize: 12, color: C.text, lineHeight: 1.7, whiteSpace: "pre-line" }}>{selected.scope_of_work}</div>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                    <input style={{ ...S.input, flex: 1 }} placeholder="Add a note..." value={addNote} onChange={e => setAddNote(e.target.value)} onKeyDown={e => e.key === "Enter" && addNoteToJob()} />
                    <VoiceFillButton
                      form={{ note: addNote }}
                      setForm={f => setAddNote(f.note || "")}
                      fieldDescriptions="note (the note text to add about this job)"
                    />
                    <button style={S.btn("primary")} onClick={addNoteToJob}>Add</button>
                  </div>
                  {notes.length === 0 && <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No notes yet — type one above or say "add a note to this job".</div>}
                  {notes.map(n => (
                    <div key={n.id} style={{ background: C.surfaceHigh, borderRadius: 8, padding: "10px 14px", marginBottom: 8 }}>
                      <div style={{ fontSize: 13 }}>{n.note}</div>
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{new Date(n.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* PHOTOS */}
              {tab === "photos" && (
                <div>
                  <input type="file" accept="image/*" ref={photoRef} style={{ display: "none" }} onChange={async e => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = async ev => {
                      const { data } = await db.from("job_photos").insert({ job_id: selected.id, user_id: user.id, data: ev.target.result, caption: file.name, created_at: new Date().toISOString() }).select().single();
                      if (data) setPhotos(prev => [data, ...prev]);
                    };
                    reader.readAsDataURL(file);
                  }} />
                  <button style={{ ...S.btn("ghost"), marginBottom: 14 }} onClick={() => photoRef.current?.click()}>📷 Add Photo</button>
                  {photos.length === 0 && <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No photos yet — capture before/after shots or evidence using the upload button above.</div>}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {photos.map(p => (
                      <div key={p.id} style={{ borderRadius: 8, overflow: "hidden", background: C.surfaceHigh }}>
                        <img src={p.data} alt={p.caption} style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }} />
                        <div style={{ padding: "4px 8px", fontSize: 10, color: C.muted }}>{new Date(p.created_at).toLocaleDateString("en-GB")}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TIME */}
              {tab === "labour" && (
                <div>
                  <div style={{ background: C.surfaceHigh, borderRadius: 8, padding: 14, marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>Log Labour</div>
                      <VoiceFillButton form={addTime} setForm={setAddTime} fieldDescriptions="labour_type (hourly/day_rate/price_work), hours (number of hours if hourly), days (number of days if day rate), rate (£ per hour or per day), total (fixed £ amount if price work), description (work carried out), worker (who did the work)" />
                    </div>

                    {/* Labour type selector */}
                    <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                      {[["hourly","⏱ Hourly"],["day_rate","📅 Day Rate"],["price_work","💷 Price Work"]].map(([v,l]) => (
                        <button key={v} onClick={() => setAddTime(p => ({ ...p, labour_type: v }))}
                          style={{ flex: 1, padding: "7px 4px", borderRadius: 8, border: `2px solid ${addTime.labour_type === v ? C.amber : C.border}`, background: addTime.labour_type === v ? C.amber + "18" : C.surface, color: addTime.labour_type === v ? C.amber : C.muted, fontSize: 11, fontWeight: addTime.labour_type === v ? 700 : 400, cursor: "pointer" }}>
                          {l}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div><label style={S.label}>Date</label><input type="date" style={S.input} value={addTime.date} onChange={e => setAddTime(p => ({ ...p, date: e.target.value }))} /></div>
                      <div><label style={S.label}>Worker (optional)</label><input style={S.input} placeholder="e.g. John, Subbie" value={addTime.worker} onChange={e => setAddTime(p => ({ ...p, worker: e.target.value }))} /></div>

                      {/* Hourly fields */}
                      {addTime.labour_type === "hourly" && <>
                        <div><label style={S.label}>Hours</label><input type="number" step="0.5" min="0" style={S.input} placeholder="e.g. 6" value={addTime.hours} onChange={e => setAddTime(p => ({ ...p, hours: e.target.value }))} /></div>
                        <div><label style={S.label}>Rate (£/hr)</label><input type="number" step="0.50" min="0" style={S.input} placeholder="e.g. 55" value={addTime.rate} onChange={e => setAddTime(p => ({ ...p, rate: e.target.value }))} /></div>
                        {addTime.hours && addTime.rate && <div style={{ gridColumn: "1/-1", fontSize: 12, color: C.amber, background: C.amber + "11", borderRadius: 10, padding: "6px 10px" }}>
                          Labour cost: £{(parseFloat(addTime.hours || 0) * parseFloat(addTime.rate || 0)).toFixed(2)}
                        </div>}
                      </>}

                      {/* Day rate fields */}
                      {addTime.labour_type === "day_rate" && <>
                        <div><label style={S.label}>Number of Days</label><input type="number" step="0.5" min="0" style={S.input} placeholder="e.g. 2.5" value={addTime.days} onChange={e => setAddTime(p => ({ ...p, days: e.target.value }))} /></div>
                        <div><label style={S.label}>Day Rate (£/day)</label><input type="number" step="1" min="0" style={S.input} placeholder="e.g. 350" value={addTime.rate} onChange={e => setAddTime(p => ({ ...p, rate: e.target.value }))} /></div>
                        {addTime.days && addTime.rate && <div style={{ gridColumn: "1/-1", fontSize: 12, color: C.amber, background: C.amber + "11", borderRadius: 10, padding: "6px 10px" }}>
                          Labour cost: £{(parseFloat(addTime.days || 0) * parseFloat(addTime.rate || 0)).toFixed(2)}
                        </div>}
                      </>}

                      {/* Price work fields */}
                      {addTime.labour_type === "price_work" && <>
                        <div style={{ gridColumn: "1/-1" }}><label style={S.label}>Agreed Price (£)</label><input type="number" step="0.01" min="0" style={S.input} placeholder="e.g. 1200" value={addTime.total} onChange={e => setAddTime(p => ({ ...p, total: e.target.value }))} /></div>
                        <div style={{ gridColumn: "1/-1", fontSize: 11, color: C.muted, background: C.surfaceHigh, borderRadius: 10, padding: "6px 10px" }}>
                          Price work — fixed agreed amount for the job or task, no hourly or day rate tracking needed.
                        </div>
                      </>}

                      <div style={{ gridColumn: "1/-1" }}><label style={S.label}>Description</label><input style={S.input} placeholder={addTime.labour_type === "price_work" ? "e.g. First fix plumbing" : "Work carried out"} value={addTime.description} onChange={e => setAddTime(p => ({ ...p, description: e.target.value }))} /></div>
                    </div>

                    <button style={{ ...S.btn("primary"), marginTop: 10, width: "100%", justifyContent: "center" }}
                      disabled={addTime.labour_type === "hourly" ? (!addTime.hours || !addTime.rate) : addTime.labour_type === "day_rate" ? (!addTime.days || !addTime.rate) : !addTime.total}
                      onClick={addTimeLog}>
                      + Log Labour
                    </button>
                  </div>

                  {/* Summary */}
                  {timeLogs.length > 0 && (
                    <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                      {totalTime > 0 && <div style={{ fontSize: 11, color: C.muted, background: C.surfaceHigh, borderRadius: 10, padding: "4px 10px" }}>⏱ {totalTime.toFixed(1)} hrs</div>}
                      {totalDays > 0 && <div style={{ fontSize: 11, color: C.muted, background: C.surfaceHigh, borderRadius: 10, padding: "4px 10px" }}>📅 {totalDays} days</div>}
                      <div style={{ fontSize: 11, color: C.amber, background: C.amber + "11", borderRadius: 10, padding: "4px 10px", fontWeight: 700 }}>£{totalLabour.toFixed(2)} total labour</div>
                    </div>
                  )}

                  {/* Log list */}
                  {timeLogs.map(t => {
                    const type = t.labour_type || "hourly";
                    const cost = parseFloat(t.total || 0) || (parseFloat(t.hours || 0) * parseFloat(t.rate || 0));
                    const label = type === "day_rate"
                      ? `${t.days || (t.hours / 8)} day${(t.days || t.hours / 8) !== 1 ? "s" : ""} @ ${fmtAmount(t.rate)}/day`
                      : type === "price_work"
                      ? "Price work"
                      : `${t.hours}hrs @ ${fmtAmount(t.rate)}/hr`;
                    const icon = type === "day_rate" ? "📅" : type === "price_work" ? "💷" : "⏱";
                    return (
                      <div key={t.id} style={{ ...S.row, marginBottom: 8 }}>
                        <div style={{ fontSize: 18, flexShrink: 0 }}>{icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{label}{t.worker ? ` · ${t.worker}` : ""}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>{t.description}{t.description && " · "}{t.log_date}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.amber }}>£{cost.toFixed(2)}</div>
                          <button onClick={async () => {
                            await db.from("time_logs").delete().eq("id", t.id);
                            setTimeLogs(prev => prev.filter(x => x.id !== t.id));
                          }} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
                        </div>
                      </div>
                    );
                  })}

                  {timeLogs.length === 0 && <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic", textAlign: "center", padding: "16px 0" }}>No labour logged yet — tap + Log Time above, or say "log 4 hours on this job today".</div>}
                </div>
            )}

              {/* VARIATION ORDERS */}
              {tab === "vo" && (
                <div>
                  <div style={{ background: C.surfaceHigh, borderRadius: 8, padding: 14, marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>Add Variation</div>
                      <VoiceFillButton form={addVO} setForm={setAddVO} fieldDescriptions="vo_number (VO reference number e.g. VO-001), description (what the variation is e.g. additional radiator in hallway), amount (cost in pounds)" />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div><label style={S.label}>VO Number</label><input style={S.input} placeholder="e.g. VO-001" value={addVO.vo_number} onChange={e => setAddVO(p => ({ ...p, vo_number: e.target.value }))} /></div>
                      <div><label style={S.label}>Amount (£)</label><input type="number" style={S.input} value={addVO.amount} onChange={e => setAddVO(p => ({ ...p, amount: e.target.value }))} /></div>
                      <div style={{ gridColumn: "1/-1" }}><label style={S.label}>Description</label><input style={S.input} placeholder="Describe the variation" value={addVO.description} onChange={e => setAddVO(p => ({ ...p, description: e.target.value }))} /></div>
                    </div>
                    <button style={{ ...S.btn("primary"), marginTop: 8 }} disabled={!addVO.description} onClick={addVariationOrder}>Add VO →</button>
                  </div>
                  {totalVO > 0 && <div style={{ fontSize: 12, color: C.green, marginBottom: 10 }}>Approved VOs: £{totalVO.toFixed(2)}</div>}
                  {vos.map(v => (
                    <div key={v.id} style={{ background: C.surfaceHigh, borderRadius: 8, padding: "12px 14px", marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{v.vo_number || "VO"}</div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>£{v.amount || 0}</span>
                          <span style={S.badge(v.status === "approved" ? C.green : v.status === "rejected" ? C.red : C.amber)}>{v.status}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: C.muted }}>{v.description}</div>
                      {v.status === "pending" && (
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <button style={{ ...S.btn("green"), fontSize: 11, padding: "4px 10px" }} onClick={async () => {
                            // Mark VO approved
                            await db.from("variation_orders").update({ status: "approved" }).eq("id", v.id);
                            setVos(prev => prev.map(x => x.id === v.id ? { ...x, status: "approved" } : x));
                            // Create draft invoice for this variation
                            const invId = nextInvoiceId(invoices);
                            const newInv = {
                              id: invId,
                              customer: selected.customer,
                              address: selected.address || "",
                              amount: v.amount || 0,
                              desc: `Variation Order${v.vo_number ? ` ${v.vo_number}` : ""}: ${v.description}`,
                              description: `Variation Order${v.vo_number ? ` ${v.vo_number}` : ""}: ${v.description}`,
                              lineItems: [{ description: `VO${v.vo_number ? ` ${v.vo_number}` : ""}: ${v.description}`, amount: v.amount || 0 }],
                              due: `Due in ${brand?.paymentTerms || 14} days`,
                              status: "draft",
                              isQuote: false,
                              jobRef: selected.title || selected.type || "",
                              poNumber: selected.po_number || "",
                              created: new Date().toLocaleDateString("en-GB"),
                            };
                            setInvoices(prev => [newInv, ...(prev || [])]);
                            alert(`✓ VO approved — draft invoice ${invId} created for ${fmtAmount(v.amount)}. Review and send from the Invoices tab.`);
                          }}>Approve</button>
                          <button style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px", color: C.red }} onClick={async () => { await db.from("variation_orders").update({ status: "rejected" }).eq("id", v.id); setVos(prev => prev.map(x => x.id === v.id ? { ...x, status: "rejected" } : x)); }}>Reject</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* COMPLIANCE DOCUMENTS */}
              {tab === "docs" && (
                <div>
                  <div style={{ background: C.surfaceHigh, borderRadius: 8, padding: 14, marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>Add Document</div>
                      <VoiceFillButton form={addDoc} setForm={setAddDoc} fieldDescriptions="doc_type (certificate type e.g. Gas Safety Certificate, EICR, PAT Testing), doc_number (certificate number), issued_date (date issued YYYY-MM-DD), expiry_date (expiry date YYYY-MM-DD), notes (any notes)" />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div><label style={S.label}>Document Type</label>
                        <select style={S.input} value={addDoc.doc_type} onChange={e => setAddDoc(p => ({ ...p, doc_type: e.target.value }))}>
                          <option value="">Select type...</option>
                          {COMPLIANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div><label style={S.label}>Cert Number</label><input style={S.input} value={addDoc.doc_number} onChange={e => setAddDoc(p => ({ ...p, doc_number: e.target.value }))} /></div>
                        <div><label style={S.label}>Issued Date</label><input type="date" style={S.input} value={addDoc.issued_date} onChange={e => setAddDoc(p => ({ ...p, issued_date: e.target.value }))} /></div>
                        <div><label style={S.label}>Expiry Date</label><input type="date" style={S.input} value={addDoc.expiry_date} onChange={e => setAddDoc(p => ({ ...p, expiry_date: e.target.value }))} /></div>
                        <div><label style={S.label}>Notes</label><input style={S.input} value={addDoc.notes} onChange={e => setAddDoc(p => ({ ...p, notes: e.target.value }))} /></div>
                      </div>
                      <button style={S.btn("primary", !addDoc.doc_type)} disabled={!addDoc.doc_type} onClick={addComplianceDoc}>Add Document →</button>
                    </div>
                  </div>
                  {compDocs.map(d => (
                    <div key={d.id} style={{ background: C.surfaceHigh, borderRadius: 8, padding: "12px 14px", marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{d.doc_type}</div>
                        {d.expiry_date && <div style={{ fontSize: 11, color: new Date(d.expiry_date) < new Date() ? C.red : C.green }}>Exp: {new Date(d.expiry_date).toLocaleDateString("en-GB")}</div>}
                      </div>
                      {d.doc_number && <div style={{ fontSize: 11, color: C.muted }}>Cert: {d.doc_number}</div>}
                      {d.issued_date && <div style={{ fontSize: 11, color: C.muted }}>Issued: {new Date(d.issued_date).toLocaleDateString("en-GB")}</div>}
                      {d.notes && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{d.notes}</div>}
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px" }} onClick={() => emailComplianceDoc(d, selected, customers, user, emailConnection, brand)}>✉ Email</button>
                        <button style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px" }} onClick={() => printComplianceDoc(d, selected, brand)}>⬇ PDF</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* CERTIFICATES */}
              {tab === "certs" && (
                <CertificatesTab job={selected} brand={brand} customers={customers} user={user} connection={emailConnection} />
              )}

              {/* DAYWORK SHEETS */}
              {tab === "daywork" && (
                <div>
                  <div style={{ background: C.surfaceHigh, borderRadius: 8, padding: 14, marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>Add Daywork Sheet</div>
                      <VoiceFillButton form={addDaysheet} setForm={setAddDaysheet} fieldDescriptions="sheet_date (date in YYYY-MM-DD), worker_name (worker's full name), hours (number of hours e.g. 8), rate (hourly rate in pounds e.g. 45), contractor_name (main contractor name), description (work carried out)" />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div><label style={S.label}>Date</label><input type="date" style={S.input} value={addDaysheet.sheet_date} onChange={e => setAddDaysheet(p => ({ ...p, sheet_date: e.target.value }))} /></div>
                      <div><label style={S.label}>Worker Name</label><input style={S.input} placeholder="e.g. Dave Hughes" value={addDaysheet.worker_name} onChange={e => setAddDaysheet(p => ({ ...p, worker_name: e.target.value }))} /></div>
                      <div><label style={S.label}>Hours</label><input type="number" step="0.5" style={S.input} placeholder="e.g. 8" value={addDaysheet.hours} onChange={e => setAddDaysheet(p => ({ ...p, hours: e.target.value }))} /></div>
                      <div><label style={S.label}>Rate (£/hr)</label><input type="number" style={S.input} placeholder="e.g. 45" value={addDaysheet.rate} onChange={e => setAddDaysheet(p => ({ ...p, rate: e.target.value }))} /></div>
                      <div style={{ gridColumn: "1/-1" }}><label style={S.label}>Contractor</label><input style={S.input} placeholder="Main contractor name" value={addDaysheet.contractor_name} onChange={e => setAddDaysheet(p => ({ ...p, contractor_name: e.target.value }))} /></div>
                      <div style={{ gridColumn: "1/-1" }}><label style={S.label}>Work Description</label><input style={S.input} placeholder="Describe the work done" value={addDaysheet.description} onChange={e => setAddDaysheet(p => ({ ...p, description: e.target.value }))} /></div>
                    </div>
                    <button style={{ ...S.btn("primary"), marginTop: 8 }} disabled={!addDaysheet.hours || !addDaysheet.rate} onClick={addDayworkSheet}>Add Sheet →</button>
                  </div>
                  {daysheets.map(d => (
                    <div key={d.id} style={{ background: C.surfaceHigh, borderRadius: 8, padding: "12px 14px", marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{new Date(d.sheet_date).toLocaleDateString("en-GB")} · {d.worker_name || "Worker"}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.amber }}>£{(d.hours * d.rate).toFixed(2)}</div>
                      </div>
                      <div style={{ fontSize: 11, color: C.muted }}>{d.hours}hrs @ £{d.rate}/hr{d.contractor_name ? ` · ${d.contractor_name}` : ""}</div>
                      {d.description && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{d.description}</div>}
                    </div>
                  ))}
                </div>
              )}

              {/* CALLS */}
              {/* PLANS / DRAWINGS */}
              {tab === "plans" && (
                <div>
                  <div style={{ background: C.surfaceHigh, borderRadius: 8, padding: 14, marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Upload Drawing or Plan</div>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      style={{ display: "none" }}
                      id="drawingUpload"
                      onChange={async e => {
                        const file = e.target.files[0];
                        if (!file || !selected) return;
                        const reader = new FileReader();
                        reader.onload = async ev => {
                          const { data } = await db.from("job_drawings").insert({
                            job_id: selected.id,
                            user_id: user.id,
                            filename: file.name,
                            file_type: file.type,
                            file_data: ev.target.result,
                            created_at: new Date().toISOString(),
                          }).select().single();
                          if (data) setDrawings(prev => [data, ...prev]);
                        };
                        reader.readAsDataURL(file);
                        e.target.value = "";
                      }}
                    />
                    <button style={S.btn("primary")} onClick={() => document.getElementById("drawingUpload").click()}>📐 Upload Drawing / Plan</button>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Supports images and PDFs. Stored with the job for on-site reference.</div>
                  </div>
                  {drawings.length === 0
                    ? <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No drawings or plans uploaded yet.</div>
                    : drawings.map(d => (
                      <div key={d.id} style={{ background: C.surfaceHigh, borderRadius: 10, padding: 14, marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>📐 {d.filename}</div>
                            <div style={{ fontSize: 11, color: C.muted }}>{new Date(d.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button style={{ ...S.btn("primary"), fontSize: 11, padding: "5px 12px" }} onClick={() => {
                              const overlay = document.createElement("div");
                              overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:9999;display:flex;flex-direction:column;overflow-y:auto";
                              const bar = document.createElement("div");
                              bar.style.cssText = `padding:max(12px, env(safe-area-inset-top, 12px)) 16px 12px;background:#1a1a1a;border-bottom:1px solid #333;position:sticky;top:0;z-index:10;display:flex;align-items:center;gap:12px`;
                              const backBtn = document.createElement("button");
                              backBtn.textContent = "← Back";
                              backBtn.style.cssText = "background:#f59e0b;color:#000;border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;font-family:'DM Mono',monospace";
                              backBtn.onclick = () => document.body.removeChild(overlay);
                              const title = document.createElement("span");
                              title.textContent = d.filename;
                              title.style.cssText = "color:#888;font-size:13px;font-family:'DM Mono',monospace";
                              bar.appendChild(backBtn);
                              bar.appendChild(title);
                              overlay.appendChild(bar);
                              const content = document.createElement("div");
                              content.style.cssText = "flex:1;display:flex;justify-content:center;align-items:flex-start;padding:16px;background:#f5f5f5";
                              if (d.file_type === "application/pdf") {
                                const embed = document.createElement("embed");
                                embed.src = d.file_data;
                                embed.type = "application/pdf";
                                embed.style.cssText = "width:100%;height:80vh;border:none;border-radius:8px";
                                content.appendChild(embed);
                              } else {
                                const img = document.createElement("img");
                                img.src = d.file_data;
                                img.style.cssText = "max-width:100%;border-radius:8px";
                                content.appendChild(img);
                              }
                              overlay.appendChild(content);
                              document.body.appendChild(overlay);
                            }}>View</button>
                            <button style={{ ...S.btn("ghost"), fontSize: 11, padding: "5px 10px", color: C.red }} onClick={async () => {
                              await db.from("job_drawings").delete().eq("id", d.id);
                              setDrawings(prev => prev.filter(x => x.id !== d.id));
                            }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
                          </div>
                        </div>
                        {d.file_type !== "application/pdf" && d.file_data && (
                          <img src={d.file_data} alt={d.filename} style={{ width: "100%", maxHeight: 160, objectFit: "contain", borderRadius: 10, background: "#fff", cursor: "pointer" }}
                            onClick={() => document.getElementById(`view-drawing-${d.id}`) && document.getElementById(`view-drawing-${d.id}`).click()}
                          />
                        )}
                      </div>
                    ))
                  }
                </div>
              )}

              {tab === "calls" && (
                <div>
                  {jobCallLogs.length === 0 ? (
                    <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic", textAlign: "center", padding: "24px 0" }}>
                      No recorded calls for this job yet.<br/>
                      <span style={{ fontSize: 11 }}>Calls from known customers are automatically recorded when Call Tracking is active.</span>
                    </div>
                  ) : jobCallLogs.map(log => (
                    <div key={log.id} style={{ background: C.surfaceHigh, borderRadius: 10, padding: 14, marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 18 }}>📞</span>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700 }}>{new Date(log.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                            <div style={{ fontSize: 11, color: C.muted }}>{Math.floor((log.duration_seconds || 0) / 60)}m {(log.duration_seconds || 0) % 60}s · {log.caller_number}</div>
                          </div>
                        </div>
                        <span style={S.badge(log.category === "existing_job" ? C.green : log.category === "new_enquiry" ? C.blue : C.amber)}>{(log.category || "general").replace("_", " ")}</span>
                      </div>
                      <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6, marginBottom: 6 }}>{log.summary}</div>
                      {log.key_details && <div style={{ fontSize: 11, color: C.amber }}>📌 {log.key_details}</div>}
                      {log.recording_url && (
                        <audio controls style={{ width: "100%", marginTop: 8, height: 32 }}
                          src={`/api/calls/audio?url=${encodeURIComponent(log.recording_url)}`}>
                          Your browser does not support audio playback.
                        </audio>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* PROFIT */}
              {tab === "profit" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {/* Profit summary card */}
                    <div style={{ background: profitColor + "11", border: `2px solid ${profitColor}44`, borderRadius: 12, padding: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Gross Profit</div>
                          <div style={{ fontSize: 28, fontWeight: 700, color: profitColor, fontFamily: "'DM Mono',monospace" }}>
                            {profitGross < 0 ? "-" : ""}{profitFmt(profitGross)}
                          </div>
                          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{profitMargin.toFixed(1)}% margin</div>
                        </div>
                        <div style={{ fontSize: 32 }}>
                          {profitIsGood ? "✅" : profitIsOk ? "⚠️" : profitRevenue === 0 ? "❓" : "🔴"}
                        </div>
                      </div>
                      {profitRevenue === 0 && <div style={{ fontSize: 11, color: C.amber, marginTop: 8 }}>⚠ No job value set — add a value to the job to see profit</div>}
                    </div>

                    {/* Breakdown */}
                    <div style={{ background: C.surfaceHigh, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                      {[
                        { label: "Invoice Value", value: profitRevenue, color: C.green, icon: "💷" },
                        { label: `Materials (${linkedMaterials.length} items)`, value: profitMatCost, color: C.red, icon: "🔧", negative: true },
                        { label: "Labour (" + (totalDays > 0 ? totalDays + " days" : totalTime.toFixed(1) + "h") + ")", value: profitLabourCost, color: C.red, icon: "⏱", negative: true },
                      ].map(({ label, value, color, icon, negative }) => (
                        <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: 16, width: 24, textAlign: "center" }}>{icon}</div>
                          <div style={{ flex: 1, fontSize: 12 }}>{label}</div>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 600, color }}>
                            {negative ? "−" : "+"}{profitFmt(value)}
                          </div>
                        </div>
                      ))}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "rgba(60,60,68,0.27)" }}>
                        <div style={{ fontSize: 16, width: 24, textAlign: "center" }}>📊</div>
                        <div style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>Gross Profit</div>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700, color: profitColor }}>
                          {profitGross < 0 ? "−" : "+"}{profitFmt(profitGross)}
                        </div>
                      </div>
                    </div>

                    {/* Linked materials */}
                    {linkedMaterials.length > 0 && (
                      <div style={{ background: C.surfaceHigh, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                        <div style={{ padding: "8px 14px", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${C.border}` }}>Materials</div>
                        {linkedMaterials.map((m, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", padding: "8px 14px", borderBottom: i < linkedMaterials.length - 1 ? `1px solid ${C.border}` : "none", gap: 8 }}>
                            <div style={{ flex: 1, fontSize: 12 }}>{m.item} ×{m.qty}</div>
                            <div style={{ fontSize: 12, color: C.red, fontFamily: "'DM Mono',monospace" }}>£{(parseFloat(m.unit_price || 0) * parseFloat(m.qty || 1)).toFixed(2)}</div>
                          </div>
                        ))}
                        <div style={{ display: "flex", padding: "8px 14px", borderTop: `1px solid ${C.border}` }}>
                          <div style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>Total</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.red, fontFamily: "'DM Mono',monospace" }}>£{profitMatCost.toFixed(2)}</div>
                        </div>
                      </div>
                    )}

                    {/* Linked POs */}
                    {linkedPOs.length > 0 && (
                      <div style={{ background: C.surfaceHigh, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                        <div style={{ padding: "8px 14px", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${C.border}` }}>Purchase Orders</div>
                        {linkedPOs.map((po, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", padding: "8px 14px", borderBottom: i < linkedPOs.length - 1 ? `1px solid ${C.border}` : "none", gap: 8 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12 }}>{po.po_number} · {po.supplier}</div>
                              <div style={{ fontSize: 11, color: C.muted }}>{po.status}</div>
                            </div>
                            <div style={{ fontSize: 12, color: C.amber, fontFamily: "'DM Mono',monospace" }}>£{parseFloat(po.total || 0).toFixed(2)}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Stage Payments — only renders if stages were set up
                        for this job. Each row shows the live invoice status
                        (draft/sent/paid) so the user doesn't need to refresh
                        or jump to Invoices to see what's happened. */}
                    {(() => {
                      let parsedStages = [];
                      try {
                        if (selected?.stage_payments) {
                          parsedStages = typeof selected.stage_payments === "string"
                            ? JSON.parse(selected.stage_payments)
                            : selected.stage_payments;
                        }
                      } catch { parsedStages = []; }
                      if (!Array.isArray(parsedStages) || parsedStages.length === 0) return null;
                      const stagePill = (status) => {
                        if (status === "paid") return { bg: C.green + "22", color: C.green, label: "Paid" };
                        if (status === "sent" || status === "overdue") return { bg: C.amber + "22", color: C.amber, label: status === "overdue" ? "Overdue" : "Sent" };
                        return { bg: C.muted + "22", color: C.muted, label: "Draft" };
                      };
                      const paidCount = parsedStages.filter(st => {
                        const inv = (invoices || []).find(i => i.id === st.invoice_id);
                        return inv?.status === "paid";
                      }).length;
                      return (
                        <div style={{ background: C.surfaceHigh, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                          <div style={{ padding: "8px 14px", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span>💰 Stage Payments</span>
                            <span style={{ fontFamily: "'DM Mono',monospace", color: paidCount === parsedStages.length ? C.green : C.muted }}>
                              {paidCount}/{parsedStages.length} paid
                            </span>
                          </div>
                          {parsedStages.map((st, i) => {
                            const inv = (invoices || []).find(invc => invc.id === st.invoice_id);
                            const pill = stagePill(inv?.status);
                            return (
                              <div key={st.invoice_id || i}
                                onClick={() => { if (inv) setView("Invoices"); }}
                                style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderBottom: i < parsedStages.length - 1 ? `1px solid ${C.border}` : "none", gap: 10, cursor: inv ? "pointer" : "default" }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600 }}>{st.label || `Stage ${i + 1}`}</div>
                                  <div style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Mono',monospace", marginTop: 2 }}>
                                    {st.invoice_id || "—"}
                                    {st.type === "pct" && st.value ? ` · ${st.value}%` : ""}
                                  </div>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700, color: C.text }}>
                                    £{parseFloat(st.amount || 0).toFixed(2)}
                                  </div>
                                  <div style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 8, background: pill.bg, color: pill.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                    {pill.label}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Linked RAMS */}
                    {linkedRams.length > 0 && (
                      <div style={{ background: C.surfaceHigh, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                        <div style={{ padding: "8px 14px", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${C.border}` }}>RAMS Documents</div>
                        {linkedRams.map((r, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", padding: "8px 14px", borderBottom: i < linkedRams.length - 1 ? `1px solid ${C.border}` : "none", gap: 8 }}>
                            <div style={{ flex: 1, fontSize: 12 }}>⚠️ {r.title}</div>
                            <div style={{ fontSize: 11, color: C.muted }}>{new Date(r.created_at).toLocaleDateString("en-GB")}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {linkedMaterials.length === 0 && profitLabourCost === 0 && (
                      <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic", textAlign: "center", padding: "12px 0" }}>
                        Link materials and log labour to this job to see a full profit breakdown.
                      </div>
                    )}
                  </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.border}`, flexShrink: 0, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {selected.invoice_id && <button style={{ ...S.btn("ghost"), fontSize: 11 }} onClick={() => { setSelected(null); setView("Invoices"); }}>View Invoice</button>}
              {selected.quote_id && <button style={{ ...S.btn("ghost"), fontSize: 11 }} onClick={() => { setSelected(null); setView("Quotes"); }}>View Quote</button>}
              {selected.address && <a href={`https://maps.google.com/?q=${encodeURIComponent(selected.address)}`} target="_blank" rel="noreferrer" style={{ ...S.btn("ghost"), fontSize: 11, textDecoration: "none" }}>📍 Navigate</a>}
              {selected.address && geoJobId !== selected.id && (
                <button style={{ ...S.btn("ghost"), fontSize: 11, color: C.blue }} onClick={() => startGeoTracking(selected)}>🚗 Start Job</button>
              )}
              {geoJobId === selected.id && geoState === "travelling" && jobCoords && (
                <button style={{ ...S.btn("ghost"), fontSize: 11, color: C.green }} onClick={() => markArrived(selected)}>📍 I've Arrived</button>
              )}
              {geoJobId === selected.id && geoState === "arrived" && (
                <button style={{ ...S.btn("ghost"), fontSize: 11, color: C.red }} onClick={() => finishJob(selected)}>✅ Finish Job</button>
              )}
              {selected.customer_signature
                ? <button style={{ ...S.btn("ghost"), fontSize: 11, color: C.green }} onClick={() => {
                    const accent = brand?.accentColor || "#f59e0b";
                    const tradingName = brand?.tradingName || "Trade PA";
                    const phone = brand?.phone || "";
                    const email = brand?.email || "";
                    const address = brand?.address || "";
                    const completionDate = selected.completion_date
                      ? new Date(selected.completion_date).toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" })
                      : new Date().toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" });

                    const overlay = document.createElement("div");
                    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:9999;display:flex;flex-direction:column;overflow-y:auto";

                    overlay.innerHTML = `
                      <div style="padding:max(12px, env(safe-area-inset-top, 12px)) 16px 12px;background:#1a1a1a;border-bottom:1px solid #333;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:10">
                        <button onclick="document.body.removeChild(this.closest('[style*=fixed]'))" style="background:${accent};color:#000;border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;font-family:'DM Mono',monospace">← Back</button>
                        <span style="color:#888;font-size:13px;font-family:'DM Mono',monospace">Job Completion Certificate</span>
                        <button onclick="window.print()" style="background:transparent;color:#888;border:1px solid #333;border-radius:8px;padding:8px 14px;font-size:12px;cursor:pointer;font-family:'DM Mono',monospace;margin-left:auto">🖨 Print / Save PDF</button>
                      </div>
                      <div style="flex:1;background:#f5f5f5;padding:24px;display:flex;justify-content:center">
                        <div style="font-family:Arial,sans-serif;max-width:680px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.15)">
                          <div style="background:${accent};padding:28px 32px;display:flex;justify-content:space-between;align-items:flex-start">
                            <div style="display:flex;align-items:center;gap:14px">
                              ${brand?.logo ? `<img src="${brand.logo}" style="height:48px;width:48px;object-fit:contain;border-radius:8px;background:#fff;padding:4px">` : `<div style="width:44px;height:44px;background:rgba(0,0,0,0.2);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:#000">TP</div>`}
                              <div>
                                <div style="font-size:20px;font-weight:700;color:#000">${tradingName}</div>
                                <div style="color:rgba(0,0,0,0.6);font-size:11px;margin-top:2px">${[phone, email, address].filter(Boolean).join(" · ")}</div>
                              </div>
                            </div>
                            <div style="text-align:right">
                              <div style="font-size:15px;font-weight:700;color:#000">COMPLETION CERTIFICATE</div>
                              <div style="font-size:11px;color:rgba(0,0,0,0.6);margin-top:2px">${completionDate}</div>
                            </div>
                          </div>
                          <div style="padding:28px 32px">
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
                              <div style="background:#f9f9f9;padding:14px;border-radius:8px">
                                <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:6px">Customer</div>
                                <div style="font-weight:600;font-size:14px">${selected.customer || ""}</div>
                                ${selected.address ? `<div style="color:#666;font-size:12px;margin-top:4px">${selected.address}</div>` : ""}
                              </div>
                              <div style="background:#f9f9f9;padding:14px;border-radius:8px">
                                <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:6px">Job</div>
                                <div style="font-weight:600;font-size:14px">${selected.title || selected.type || ""}</div>
                                ${selected.value ? `<div style="color:#666;font-size:12px;margin-top:4px">Value: ${fmtAmount(selected.value)}</div>` : ""}
                                ${selected.po_number ? `<div style="color:#666;font-size:12px">PO: ${selected.po_number}</div>` : ""}
                              </div>
                            </div>
                            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:24px">
                              <p style="margin:0;font-size:14px;color:#166534;line-height:1.6">I confirm that the above works have been completed to my full satisfaction. I am happy with the quality of workmanship and all works have been carried out as agreed.</p>
                            </div>
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:24px;padding-top:20px;border-top:1px solid #eee">
                              <div>
                                <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px">Customer Signature</div>
                                <div style="height:64px;border-bottom:2px solid #333;margin-bottom:6px;display:flex;align-items:flex-end;padding-bottom:4px">
                                  <img src="${selected.customer_signature}" style="max-height:60px;max-width:100%">
                                </div>
                                <div style="font-size:11px;color:#666">${selected.customer} · ${completionDate}</div>
                              </div>
                              <div>
                                <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px">Engineer / Contractor</div>
                                <div style="height:64px;border-bottom:2px solid #333;margin-bottom:6px;display:flex;align-items:center;padding-bottom:4px">
                                  <span style="font-size:13px;color:#1a1a1a">${tradingName}</span>
                                </div>
                                <div style="font-size:11px;color:#666">${completionDate}</div>
                              </div>
                            </div>
                            <div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:10px;color:#999;text-align:center">${tradingName}${phone ? ` · ${phone}` : ""}${email ? ` · ${email}` : ""} · Generated by Trade PA</div>
                          </div>
                        </div>
                      </div>
                    `;
                    document.body.appendChild(overlay);
                  }}>📄 Completion Certificate</button>
                : <button style={{ ...S.btn("ghost"), fontSize: 11, color: C.green }} onClick={() => setShowSignature(true)}>✍ Get Signature</button>
              }
              {selected.value > 0 && (
                <button style={{ ...S.btn("ghost"), fontSize: 11, color: C.blue }} onClick={() => {
                  setStagePaymentStages([
                    { label: "Deposit", type: "pct", value: "30" },
                    { label: "First Fix", type: "pct", value: "40" },
                    { label: "Completion", type: "pct", value: "30" },
                  ]);
                  setShowStagePayments(true);
                }}>💰 Stage Payments</button>
              )}
              <button style={{ ...S.btn("ghost"), fontSize: 11, color: C.red, marginLeft: "auto" }} onClick={() => deleteJob(selected.id)}>Delete</button>
            </div>
        </DetailPage>
      )}

      {/* Edit job modal */}
      {editingJob && selected && (
        <div style={{ position: "fixed", inset: 0, background: "#000d", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: 16 }}>
          <div style={{ ...S.card, maxWidth: 460, width: "100%", maxHeight: "85vh", overflowY: "auto", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Edit Job</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <VoiceFillButton form={editForm} setForm={setEditForm} fieldDescriptions="title (job title), customer (customer name), address (property address), type (job type e.g. boiler service), status (enquiry/quoted/accepted/in_progress/completed), value (job value in pounds), po_number (PO number), notes (any notes)" />
                <button aria-label="Close" onClick={() => setEditingJob(false)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div><label style={S.label}>Job Title</label><input style={S.input} value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} /></div>
                <div><label style={S.label}>Customer</label><input style={S.input} value={editForm.customer} onChange={e => setEditForm(f => ({ ...f, customer: e.target.value }))} /></div>
                <div style={{ gridColumn: "1/-1" }}><label style={S.label}>Address</label><input style={S.input} value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} /></div>
                <div><label style={S.label}>Job Type</label><input style={S.input} value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))} /></div>
                <div><label style={S.label}>Value (£)</label><input type="number" style={S.input} value={editForm.value} onChange={e => setEditForm(f => ({ ...f, value: e.target.value }))} /></div>
                <div><label style={S.label}>PO Number</label><input style={S.input} value={editForm.po_number} onChange={e => setEditForm(f => ({ ...f, po_number: e.target.value }))} /></div>
                <div><label style={S.label}>Status</label>
                  <select style={S.input} value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                    {["enquiry","quoted","accepted","in_progress","completed","on_hold"].map(s => <option key={s} value={s}>{s.replace("_"," ")}</option>)}
                  </select>
                </div>
              </div>
              <div><label style={S.label}>Notes</label><textarea style={{ ...S.input, minHeight: 72, resize: "none" }} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} /></div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: C.surfaceHigh, borderRadius: 8, cursor: "pointer" }} onClick={() => setEditForm(f => ({ ...f, annual_service: !f.annual_service }))}>
                <div style={{ width: 36, height: 20, borderRadius: 10, background: editForm.annual_service ? C.amber : C.border, position: "relative", flexShrink: 0, transition: "all 0.2s" }}>
                  <div style={{ position: "absolute", top: 2, left: editForm.annual_service ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "all 0.2s" }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Annual Service Job</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...S.btn("primary"), flex: 1 }} onClick={async () => {
                  const updates = { ...editForm, value: parseFloat(editForm.value) || 0, updated_at: new Date().toISOString() };
                  await db.from("job_cards").update(updates).eq("id", selected.id);
                  setJobCards(prev => prev.map(j => j.id === selected.id ? { ...j, ...updates } : j));
                  setSelected(s => ({ ...s, ...updates }));
                  setEditingJob(false);
                }}>Save Changes →</button>
                <button style={S.btn("ghost")} onClick={() => setEditingJob(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stage Payments Modal */}
      {showStagePayments && selected && (
        <div style={{ position: "fixed", inset: 0, background: "#000d", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 500, padding: 16, paddingTop: "max(52px, env(safe-area-inset-top, 52px))", overflowY: "auto" }} onClick={() => setShowStagePayments(false)}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.card, maxWidth: 480, width: "100%", marginBottom: 16, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>💰 Stage Payments</div>
              <button aria-label="Close" onClick={() => setShowStagePayments(false)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
              Job value: <strong style={{ color: C.amber }}>£{selected.value}</strong> · Each stage creates a draft invoice
            </div>

            {/* Stages list */}
            {stagePaymentStages.map((stage, i) => {
              const stageAmt = stage.type === "pct"
                ? parseFloat(((selected.value * parseFloat(stage.value || 0)) / 100).toFixed(2))
                : parseFloat(stage.value || 0);
              return (
                <div key={i} style={{ background: C.surfaceHigh, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.amber }}>Stage {i + 1}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.green }}>£{stageAmt.toFixed(2)}</div>
                    {stagePaymentStages.length > 1 && (
                      <button onClick={() => setStagePaymentStages(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
                    )}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "center" }}>
                    <input
                      style={{ ...S.input, fontSize: 13 }}
                      placeholder="Stage name e.g. Deposit"
                      value={stage.label}
                      onChange={e => setStagePaymentStages(prev => prev.map((s, j) => j === i ? { ...s, label: e.target.value } : s))}
                    />
                    <select
                      style={{ ...S.input, width: 70, padding: "10px 6px", fontSize: 12 }}
                      value={stage.type}
                      onChange={e => setStagePaymentStages(prev => prev.map((s, j) => j === i ? { ...s, type: e.target.value, value: e.target.value === "pct" ? "30" : "" } : s))}
                    >
                      <option value="pct">%</option>
                      <option value="gbp">£</option>
                    </select>
                    <input
                      style={{ ...S.input, width: 80, fontSize: 13 }}
                      type="number"
                      min="0"
                      placeholder={stage.type === "pct" ? "%" : "£"}
                      value={stage.value}
                      onChange={e => setStagePaymentStages(prev => prev.map((s, j) => j === i ? { ...s, value: e.target.value } : s))}
                    />
                  </div>
                </div>
              );
            })}

            {/* Total check */}
            {(() => {
              const total = stagePaymentStages.reduce((sum, s) => {
                const amt = s.type === "pct"
                  ? parseFloat(((selected.value * parseFloat(s.value || 0)) / 100))
                  : parseFloat(s.value || 0);
                return sum + (isNaN(amt) ? 0 : amt);
              }, 0);
              const diff = Math.abs(total - selected.value);
              return (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: diff < 0.01 ? C.green + "18" : C.red + "18", borderRadius: 8, marginBottom: 14, border: `1px solid ${diff < 0.01 ? C.green + "44" : C.red + "44"}` }}>
                  <span style={{ fontSize: 12, color: diff < 0.01 ? C.green : C.red }}>
                    {diff < 0.01 ? "✓ Stages total correctly" : `⚠ Stages total ${fmtCurrency(total)} — job value is ${fmtAmount(selected.value)}`}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: diff < 0.01 ? C.green : C.red }}>£{total.toFixed(2)}</span>
                </div>
              );
            })()}

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button style={{ ...S.btn("ghost"), fontSize: 11 }} onClick={() => setStagePaymentStages(prev => [...prev, { label: "", type: "pct", value: "" }])}>
                + Add Stage
              </button>
            </div>

            <button
              style={{ ...S.btn("primary"), width: "100%", justifyContent: "center", padding: 14 }}
              onClick={async () => {
                // Auto-pull email/address/phone from the customer record so
                // the draft invoices carry contact details and the Pay Online
                // link works out of the box. Mirrors create_invoice tool.
                let custAddr = selected.address || "";
                let custEmail = "";
                let custPhone = "";
                if (selected.customer && (customers || []).length > 0) {
                  const needle = selected.customer.toLowerCase().trim();
                  const cust =
                    (customers || []).find(c => (c.name || "").toLowerCase().trim() === needle) ||
                    (customers || []).find(c => (c.name || "").toLowerCase().includes(needle));
                  if (cust) {
                    if (!custAddr && cust.address) custAddr = cust.address;
                    if (cust.email) custEmail = cust.email;
                    if (cust.phone) custPhone = cust.phone;
                  }
                }
                // Pre-filter to valid stages. Running-list pattern avoids the
                // stale-closure bug: nextInvoiceId(invoices) inside forEach
                // would close over the pre-loop invoices array and hand out
                // the same id to every stage.
                const validStages = stagePaymentStages
                  .map((s, i) => {
                    const stageAmt = parseFloat((s.type === "pct"
                      ? (selected.value * parseFloat(s.value || 0)) / 100
                      : parseFloat(s.value || 0)).toFixed(2));
                    return { s, i, stageAmt };
                  })
                  .filter(x => x.stageAmt > 0);
                let runningInvoices = invoices || [];
                const createdInvs = [];
                const stagesWithAmounts = [];
                for (const { s, i, stageAmt } of validStages) {
                  const invId = nextInvoiceId(runningInvoices);
                  const label = s.label || `Stage ${i + 1}`;
                  const portalToken = generatePortalToken();
                  const newInv = {
                    id: invId,
                    customer: selected.customer,
                    address: custAddr,
                    email: custEmail,
                    phone: custPhone,
                    amount: stageAmt,
                    desc: `${label} — ${selected.title || selected.type || ""}`,
                    description: `${label} — ${selected.title || selected.type || ""}`,
                    lineItems: [{ description: `${label} — ${selected.title || selected.type || ""}`, amount: stageAmt }],
                    due: `Due in ${brand?.paymentTerms || 14} days`,
                    status: "draft",
                    isQuote: false,
                    jobRef: selected.title || selected.type || "",
                    poNumber: selected.po_number || "",
                    created: new Date().toLocaleDateString("en-GB"),
                    portalToken,
                  };
                  runningInvoices = [newInv, ...runningInvoices];
                  createdInvs.push(newInv);
                  stagesWithAmounts.push({ label, type: s.type, value: s.value, amount: stageAmt, invoice_id: invId });
                  // Persist to Supabase — mirrors create_invoice tool's upsert shape.
                  if (user?.id) {
                    try {
                      await db.from("invoices").upsert({
                        id: invId, user_id: user.id,
                        customer: newInv.customer, address: newInv.address,
                        email: newInv.email, phone: newInv.phone,
                        amount: stageAmt, gross_amount: stageAmt,
                        status: "draft", is_quote: false,
                        due: newInv.due,
                        description: newInv.description,
                        line_items: JSON.stringify(newInv.lineItems),
                        job_ref: newInv.jobRef || "",
                        created_at: new Date().toISOString(),
                        portal_token: portalToken,
                      });
                    } catch (e) {
                      console.warn("Stage invoice Supabase write:", e.message);
                    }
                  }
                }
                setInvoices(prev => [...createdInvs, ...(prev || [])]);
                // Save stages metadata to the job card — matches existing
                // stage_payments JSON column pattern used elsewhere in App.jsx.
                if (user?.id && selected?.id) {
                  try {
                    await db.from("job_cards")
                      .update({ stage_payments: JSON.stringify(stagesWithAmounts) })
                      .eq("id", selected.id).eq("user_id", user.id);
                  } catch (e) {
                    console.warn("Stage payments metadata write:", e.message);
                  }
                }
                setShowStagePayments(false);
                alert(`✓ ${createdInvs.length} stage payment invoice${createdInvs.length !== 1 ? "s" : ""} created as drafts. Review and send from the Invoices tab.`);
              }}
            >
              Create {stagePaymentStages.length} Draft Invoice{stagePaymentStages.length !== 1 ? "s" : ""} →
            </button>
          </div>
        </div>
      )}

      {/* Signature modal */}
      {showSignature && selected && (
        <SignaturePad
          title={`Customer sign-off — ${selected.customer}`}
          onSave={async sigData => {
            await db.from("job_cards").update({ customer_signature: sigData, status: "completed", completion_date: new Date().toISOString() }).eq("id", selected.id);
            setJobCards(prev => prev.map(j => j.id === selected.id ? { ...j, customer_signature: sigData, status: "completed" } : j));
            setSelected(s => ({ ...s, customer_signature: sigData, status: "completed" }));
            setShowSignature(false);
            if (selected.annual_service) {
              const nextService = new Date();
              nextService.setDate(nextService.getDate() + 350);
              await db.from("job_cards").update({ next_service_date: nextService.toISOString().slice(0,10), service_reminder_sent: false }).eq("id", selected.id);
            }
          }}
          onCancel={() => setShowSignature(false)}
        />
      )}
    </div>
  );
}
