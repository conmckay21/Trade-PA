// ─── RAMS (Risk Assessments & Method Statements) ────────────────────────
// Extracted verbatim from App.jsx during P7 sub-batch B (28 Apr 2026).
//
// Bundles HAZARD_LIBRARY, METHOD_LIBRARY, COSHH_SUBSTANCES alongside
// RAMSTab. The first two are also consumed by AIAssistant (still in
// App.jsx) — exported so App.jsx can import them back. COSHH_SUBSTANCES
// is RAMS-only but exported for symmetry and future-proofing.
import React, { useState, useEffect } from "react";
import { db } from "../lib/db.js";
import { C } from "../theme/colors.js";
import { S } from "../theme/styles.js";
import { authHeaders } from "../lib/auth.js";
import { portalCtaBlock } from "../lib/portal-extras.js";
import { tmReadWorkers, tmReadSubs } from "../lib/team-members.js";
import { VoiceFillButton } from "../components/VoiceFillButton.jsx";
import { DetailPage } from "../components/DetailPage.jsx";
import { AssignToJobModal } from "../modals/AssignToJobModal.jsx";

export const HAZARD_LIBRARY = {
  "Working at Height": [
    { id: "wah1", hazard: "Falls from ladders", risk: "High", control: "Use correct ladder for the task, maintain 3-point contact, ensure ladder is on firm level ground and secured at the top. Do not overreach. Never use the top 3 rungs.", ppe: "Hard hat, safety boots, hi-vis" },
    { id: "wah2", hazard: "Falls from scaffold or elevated platform", risk: "High", control: "Ensure scaffold is erected and inspected by a competent person. Guardrails and toe boards in place. Never remove any scaffold components. Report any damage immediately.", ppe: "Hard hat, safety boots, hi-vis" },
    { id: "wah3", hazard: "Falls through fragile roofs or surfaces", risk: "Critical", control: "Never walk on fragile surfaces. Use crawl boards across rafters. Ensure roof lights and openings are covered and clearly marked.", ppe: "Hard hat, harness and lanyard, safety boots" },
    { id: "wah4", hazard: "Falling objects striking persons below", risk: "High", control: "Exclusion zone below work area. Toe boards on all elevated platforms. Use tool lanyards. Never throw materials from height.", ppe: "Hard hat mandatory for all in area, hi-vis" },
    { id: "wah5", hazard: "Use of MEWP / cherry picker", risk: "High", control: "Trained and authorised operators only. Daily pre-use inspection. Ground must be firm and level. Outriggers deployed. Never exceed SWL.", ppe: "Hard hat, harness clipped to anchor point, safety boots" },
  ],
  "Electricity": [
    { id: "elec1", hazard: "Contact with live electrical conductors", risk: "Critical", control: "Isolate supply using approved isolation procedure. Use approved voltage indicator to confirm dead. Lock off and apply personal safety locks. Display caution notices at distribution board.", ppe: "Insulated tools, rubber matting if required, safety glasses" },
    { id: "elec2", hazard: "Electric shock from faulty equipment", risk: "High", control: "All portable electrical equipment to be PAT tested. RCD protection on all 230V supplies. Inspect leads and plugs before use. Remove any damaged equipment from use.", ppe: "Insulated tools, safety footwear" },
    { id: "elec3", hazard: "Arc flash during electrical work", risk: "Critical", control: "Only trained and competent electricians to work on electrical installations. Confirm dead before working. Maintain safe distances from live parts.", ppe: "Arc flash PPE where required, safety glasses, insulated gloves" },
    { id: "elec4", hazard: "Overhead power lines", risk: "Critical", control: "Identify all overhead lines before work commences. Maintain safe clearance distances. Use goal post barriers if working near lines. Contact DNO before any work near overhead lines.", ppe: "Hi-vis, hard hat" },
  ],
  "Gas & Combustion": [
    { id: "gas1", hazard: "Gas leak causing fire or explosion", risk: "Critical", control: "Use calibrated gas detector throughout works. Ensure adequate ventilation. Isolate gas supply before work. Never use open flames near gas pipework. Emergency action: evacuate and call 0800 111 999.", ppe: "Gas detector, safety boots" },
    { id: "gas2", hazard: "Carbon monoxide (CO) poisoning", risk: "Critical", control: "CO detector in use at all times during commissioning and testing. Ensure adequate ventilation. Test for combustion spillage. Never leave appliances running in confined spaces unventilated.", ppe: "CO detector alarm, adequate ventilation maintained" },
    { id: "gas3", hazard: "Burns from hot surfaces or hot water", risk: "Medium", control: "Allow appliances and pipework to cool before working. Warn others of hot surfaces. Use heat-resistant gloves when handling hot components.", ppe: "Heat-resistant gloves, eye protection" },
    { id: "gas4", hazard: "Fire from use of gas torch / hot works", risk: "High", control: "Fire extinguisher on site during all hot works. Use fire-resistant mat. Check area for flammable materials. 60-minute fire watch after completion.", ppe: "Heat-resistant gloves, eye protection, fire extinguisher available" },
    { id: "gas5", hazard: "Pressurised system failure", risk: "High", control: "Depressurise system before work. Check system pressure before recommissioning. Never exceed maximum working pressure.", ppe: "Eye protection, gloves" },
  ],
  "Plumbing & Water": [
    { id: "plumb1", hazard: "Scalding from hot water systems", risk: "Medium", control: "Drain down and allow to cool before working on hot water systems. Turn off immersion/boiler. Check temperature before opening system. Use appropriate PPE.", ppe: "Heat-resistant gloves, eye protection" },
    { id: "plumb2", hazard: "Flooding causing slip hazards or damage", risk: "High", control: "Isolate water supply before any work on pipework. Have mop, bucket and towels available. Warn building occupants. Protect floors and contents with dust sheets.", ppe: "Waterproof footwear if required, gloves" },
    { id: "plumb3", hazard: "Legionella from stagnant water systems", risk: "Medium", control: "Do not disturb or stagnate water systems unnecessarily. Flush dead legs. Report any discoloured or smelling water to client. Do not spray or atomise water from unknown sources.", ppe: "Gloves, wash hands thoroughly after work" },
    { id: "plumb4", hazard: "Hitting concealed services when drilling", risk: "High", control: "Use cable and pipe detector before drilling or cutting. Refer to building drawings where available. Mark up services. Proceed with caution.", ppe: "Safety glasses, insulated tools, gloves" },
  ],
  "Manual Handling": [
    { id: "mh1", hazard: "Musculoskeletal injury from lifting heavy loads", risk: "Medium", control: "Assess load weight before lifting. Use mechanical aids (sack truck, pallet truck) where possible. Team lift for loads over 20kg. Use correct manual handling technique — bend knees, keep back straight.", ppe: "Gloves, safety boots" },
    { id: "mh2", hazard: "Injury from carrying awkward or bulky items", risk: "Medium", control: "Plan the route before carrying. Remove obstacles. Use carrying aids. Get assistance for large items. Take short rest breaks on long carries.", ppe: "Gloves, safety boots" },
    { id: "mh3", hazard: "Back injury from working in awkward postures", risk: "Medium", control: "Use kneeling pads. Adjust work height where possible. Take regular breaks and stretch. Rotate tasks with colleagues.", ppe: "Kneeling pads, gloves" },
  ],
  "Power Tools & Equipment": [
    { id: "pt1", hazard: "Injury from angle grinder disc failure or kickback", risk: "High", control: "Check disc is correct grade and undamaged before use. Guards must always be in place. Maximum RPM on disc must exceed tool RPM. Clamp workpiece. Never use side of disc unless disc is designed for it.", ppe: "Full face visor, cut-resistant gloves, hearing protection, safety boots" },
    { id: "pt2", hazard: "Cuts from circular saw or reciprocating saw", risk: "High", control: "Ensure blade is sharp and correct for material. Guards in place and functioning. Clamp or secure workpiece. Never reach under material being cut.", ppe: "Safety gloves, safety glasses, hearing protection, safety boots" },
    { id: "pt3", hazard: "Eye injury from flying debris", risk: "Medium", control: "Safety glasses or goggles to be worn at all times when using power tools. Erect screens to protect others in the area.", ppe: "Safety glasses or full face visor" },
    { id: "pt4", hazard: "Hearing damage from prolonged tool use", risk: "Medium", control: "Limit continuous exposure to high noise tools. Use quieter tools where available. Provide hearing protection to all in area. Rotate operators where possible.", ppe: "Ear defenders or ear plugs (minimum SNR 25dB)" },
    { id: "pt5", hazard: "Hand-arm vibration (HAVs) from power tools", risk: "Medium", control: "Use low vibration tools where available. Limit daily exposure — monitor trigger time. Use anti-vibration gloves. Rotate operators. Report tingling or numbness immediately.", ppe: "Anti-vibration gloves" },
  ],
  "Dust & Air Quality": [
    { id: "dust1", hazard: "Inhalation of silica dust from cutting masonry", risk: "High", control: "Wet cutting methods where possible. Local exhaust ventilation (LEV). RPE to be worn — minimum FFP2/P2. Keep others clear of dust cloud. H-class vacuum for cleaning.", ppe: "FFP2 or FFP3 dust mask, safety glasses" },
    { id: "dust2", hazard: "Inhalation of wood dust", risk: "Medium", control: "LEV at source. Dust extraction bag on tools. RPE where dust cannot be controlled at source. Good ventilation.", ppe: "FFP2 dust mask, safety glasses" },
    { id: "dust3", hazard: "Asbestos exposure from drilling/cutting in older buildings", risk: "Critical", control: "Presume asbestos is present in buildings built before 2000. Do not drill, cut or disturb any suspect material. Check asbestos register / survey before work. Stop work immediately if ACMs suspected — contact asbestos removal specialist.", ppe: "Do not proceed — specialist required for asbestos removal" },
    { id: "dust4", hazard: "Fumes from solvents, adhesives or paints", risk: "Medium", control: "Ensure adequate ventilation. Open windows and doors. Use LEV / forced ventilation. Check COSHH data sheet. Take breaks in fresh air.", ppe: "Appropriate respirator per COSHH assessment, gloves, eye protection" },
  ],
  "Slips, Trips & Falls": [
    { id: "stf1", hazard: "Slipping on wet floors", risk: "Medium", control: "Display wet floor signs. Clean up spillages immediately. Use absorbent matting. Wear appropriate footwear.", ppe: "Non-slip safety footwear" },
    { id: "stf2", hazard: "Tripping over cables, tools and debris", risk: "Medium", control: "Keep work area tidy at all times. Secure cables with cable protectors or tape. Remove waste regularly. Ensure adequate lighting.", ppe: "Safety footwear" },
    { id: "stf3", hazard: "Slipping or falling on stairs or in roof voids", risk: "High", control: "Use torch or head torch in dark areas. Never rush in confined or low-lit areas. Keep both hands free when climbing. Clear debris from stairs.", ppe: "Head torch, safety footwear, hard hat where required" },
  ],
  "Fire & Hot Works": [
    { id: "fire1", hazard: "Fire from hot works (welding, grinding, torch)", risk: "High", control: "Hot works permit required. Remove all flammable materials from 3m radius. Use fire-resistant blanket. Fire extinguisher on site. 60-minute fire watch on completion. Check building alarm not disabled.", ppe: "Fire-resistant overalls, face shield, heat-resistant gloves, fire extinguisher" },
    { id: "fire2", hazard: "Fire from flammable gases or liquids", risk: "High", control: "Store flammable materials in designated areas away from ignition sources. No smoking in area. Maintain minimum stock on site. Ensure good ventilation.", ppe: "Appropriate RPE, fire extinguisher available" },
  ],
  "Confined Spaces": [
    { id: "cs1", hazard: "Asphyxiation or toxic atmosphere in confined space", risk: "Critical", control: "Classified confined space entry procedure required. Atmospheric testing before and during entry. Buddy system — never enter alone. Emergency rescue plan in place. Do not enter without authorisation.", ppe: "Gas detector, harness, lifeline, communication device" },
    { id: "cs2", hazard: "Working in loft voids or ceiling spaces", risk: "Medium", control: "Check for asbestos, live services, insulation. Adequate lighting. Crawl boards across joists. Ensure means of escape is clear. Work with another person nearby.", ppe: "Hard hat, dust mask FFP2, gloves, head torch, knee pads" },
  ],
  "Site & Environment": [
    { id: "site1", hazard: "Unauthorised access by public or children", risk: "High", control: "Secure site with hoarding, barriers or fencing. Lock gates when unattended. Display warning signs. Secure ladders so they cannot be used by others.", ppe: "Hi-vis when near public" },
    { id: "site2", hazard: "Working in adverse weather conditions", risk: "Medium", control: "Monitor weather forecasts. Stop work in high winds if working at height. Extra caution in wet conditions. Provide appropriate welfare facilities.", ppe: "Waterproof clothing, hi-vis, safety footwear" },
    { id: "site3", hazard: "Excavation and ground instability", risk: "High", control: "Locate all underground services before excavation. Support excavations over 1.2m deep. Inspect excavations daily. No undermining of structures. Safe access and egress.", ppe: "Hard hat, safety boots, hi-vis" },
    { id: "site4", hazard: "Working near traffic or on public highway", risk: "High", control: "Traffic management plan required. Chapter 8 signing, lighting and guarding. Lookout person if required. Hi-vis must be worn at all times.", ppe: "Hi-vis (minimum Class 2), hard hat, safety boots" },
  ],
};

export const METHOD_LIBRARY = {
  "Site Setup": [
    "Carry out a site visit / survey before works commence",
    "Attend site induction and sign in",
    "Identify location of first aid kit and fire exits",
    "Brief all operatives on this RAMS before work commences",
    "Erect appropriate barriers, signs and exclusion zones",
    "Obtain all required permits to work before starting",
    "Confirm all services (gas, electric, water) have been isolated and locked off",
    "Protect existing fixtures, fittings and surfaces with dust sheets",
  ],
  "Electrical Works": [
    "Isolate supply using approved isolation procedure and confirm dead with approved voltage indicator",
    "Apply personal safety lock and display caution notice at distribution board",
    "Carry out all installation work to BS 7671 18th Edition (or current edition)",
    "Inspect completed installation before energising",
    "Carry out required tests to BS 7671 Appendix 6",
    "Restore supply gradually and commission installation",
    "Confirm correct operation of all protective devices",
    "Issue Electrical Installation Certificate / EICR to client",
    "Clean up and remove all waste from site",
  ],
  "Gas Works": [
    "Isolate gas supply at meter and check with detector for residual gas",
    "Carry out all work to Gas Safe requirements and relevant Gas Industry Unsafe Situations Procedure (GIUSP)",
    "Purge and test all gas pipework with approved equipment",
    "Test all joints with approved leak detection fluid — check all joints are gas-tight",
    "Commission appliance(s) to manufacturer's specification",
    "Check for combustion spillage / CO production",
    "Set and check gas rate and operating pressure",
    "Carry out tightness test to BS 6891",
    "Complete all Gas Safe documentation and leave copy with client",
  ],
  "Plumbing Works": [
    "Isolate and drain down existing system before commencing work",
    "Carry out all work to Water Regulations 1999 and current British Standards",
    "Ensure all joints and connections are mechanically sound before pressure testing",
    "Pressure test pipework to 1.5x working pressure for minimum 1 hour — document results",
    "Refill and vent system ensuring all air locks are cleared",
    "Check all controls and thermostats operate correctly",
    "Commission boiler / heat source to manufacturer's specification",
    "Complete benchmark checklist and leave copy with client",
    "Advise client on correct operation and maintenance requirements",
  ],
  "General Building": [
    "Set out work area and confirm dimensions with client",
    "Carry out all structural work in accordance with approved Building Regulations drawings",
    "Ensure temporary support (acro props, needles) are in place before removing structural elements",
    "Use correct mix ratios for all mortars, screeds and concrete",
    "Allow adequate curing time before loading structural elements",
    "Carry out work to appropriate British Standards and NHBC guidance",
    "Arrange Building Control inspections at required stages",
    "Clean up all debris and waste progressively throughout works",
    "Carry out snagging inspection with client before completion",
  ],
  "Completion & Handover": [
    "Carry out final inspection of all works",
    "Test all systems and confirm correct operation",
    "Remove all tools, equipment and waste from site",
    "Make good any minor damage caused during works",
    "Clean work area thoroughly",
    "Issue all completion certificates, warranties and documentation to client",
    "Walk through completed works with client and address any queries",
    "Obtain client sign-off on completed works",
  ],
};

export const COSHH_SUBSTANCES = [
  { name: "LPG / Natural Gas", hazard: "Flammable, asphyxiant", exposure: "Ventilation, gas detector", ppe: "Gas detector" },
  { name: "Flux / Solder", hazard: "Fumes — respiratory irritant", exposure: "Adequate ventilation, LEV", ppe: "FFP2 mask" },
  { name: "PTFE / Thread tape — low risk", hazard: "Low risk, skin irritant", exposure: "Handwashing", ppe: "Gloves" },
  { name: "Silicone sealant", hazard: "Skin and eye irritant, acetic acid fumes", exposure: "Ventilation", ppe: "Gloves, safety glasses" },
  { name: "Solvent cement (push-fit pipes)", hazard: "Flammable, VOCs — respiratory irritant", exposure: "Ventilation, short exposures only", ppe: "Gloves, FFP2 mask, safety glasses" },
  { name: "Expanding foam", hazard: "Skin and eye irritant, isocyanates", exposure: "Ventilation, short exposure", ppe: "Gloves, safety glasses, FFP2 if large amounts" },
  { name: "Mortar / Cement", hazard: "Alkaline — skin burns, dust hazard", exposure: "Gloves, knee pads, avoid dust", ppe: "Gloves, FFP2 dust mask, safety glasses, knee pads" },
  { name: "Wood preservative / stain", hazard: "Skin and eye irritant, solvent fumes", exposure: "Ventilation, gloves", ppe: "Chemical-resistant gloves, safety glasses, FFP2 if spraying" },
  { name: "Adhesive (contact/solvent)", hazard: "Flammable, VOCs, narcotic in concentration", exposure: "Ventilation, short bursts", ppe: "Gloves, FFP2 organic vapour, safety glasses" },
  { name: "Bitumen / roofing compound", hazard: "Hot material burns, PAH compounds in fumes", exposure: "Ventilation, cool before applying where possible", ppe: "Heat-resistant gloves, FFP2 mask, safety glasses" },
];

export function RAMSTab({ user, brand, setContextHint }) {
  const [rams, setRams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState("list");
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  // List controls (Phase 3)
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all | cdm | linked
  const [sortMode, setSortMode] = useState("recent"); // recent | title | hazards

  const blankForm = () => ({
    title: "", job_ref: "", site_address: "", client_name: "", start_date: "", end_date: "",
    prepared_by: brand?.tradingName || "", reviewed_by: "", scope: "",
    cdm_notifiable: false, cdm_coordinator: "", cdm_principal_contractor: "",
    selected_hazards: [], // array of hazard ids
    custom_hazards: [], // [{hazard,risk,control,ppe}]
    selected_method_cats: [], // categories selected
    selected_method_steps: [], // array of step strings
    custom_method_steps: [],
    coshh_substances: [], // array of substance names from library or custom
    custom_coshh: [], // [{name,hazard,exposure,ppe}]
    first_aider: "", nearest_ae: "", muster_point: "", emergency_procedure: "",
    welfare_location: "", nearest_toilet: "",
  });

  const [form, setForm] = useState(blankForm());

  useEffect(() => { if (user?.id) load(); }, [user?.id]);

  // Phase 5b: rich context hint for the floating mic. Different payload per
  // screen so the AI knows what the user is actually doing.
  useEffect(() => {
    if (!setContextHint) return;
    const STEP_NAMES = ["Project Details", "Hazards", "Method Statement", "COSHH", "Welfare & Emergency"];
    if (screen === "wizard") {
      const bits = [`RAMS wizard: ${form.title || "New RAMS"}`];
      bits.push(`step ${step} of 5 — ${STEP_NAMES[step - 1] || ""}`);
      const hz = (form.selected_hazards?.length || 0) + (form.custom_hazards?.length || 0);
      const ms = (form.selected_method_steps?.length || 0) + (form.custom_method_steps?.length || 0);
      const co = (form.coshh_substances?.length || 0) + (form.custom_coshh?.length || 0);
      if (hz) bits.push(`${hz} hazards selected`);
      if (ms) bits.push(`${ms} method steps`);
      if (co) bits.push(`${co} COSHH substances`);
      if (form.scope) bits.push(`scope: ${form.scope.slice(0, 100)}`);
      setContextHint(bits.join(" · "));
    } else {
      setContextHint(`RAMS Builder: ${rams.length} document${rams.length === 1 ? "" : "s"}`);
    }
    return () => { if (setContextHint) setContextHint(null); };
  }, [screen, step, form.title, form.selected_hazards, form.custom_hazards, form.selected_method_steps, form.custom_method_steps, form.coshh_substances, form.custom_coshh, form.scope, rams.length, setContextHint]);

  const load = async () => {
    setLoading(true);
    const { data } = await db.from("rams_documents").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setRams(data || []);
    setLoading(false);
  };

  const duplicateRAMS = (r) => {
    const d = typeof r.form_data === "string" ? JSON.parse(r.form_data) : r.form_data;
    setForm({ ...d, title: `${d.title} (Copy)`, start_date: "", end_date: "" });
    setStep(1);
    setScreen("wizard");
  };

  const saveRAMS = async () => {
    if (!form.title) return;
    const payload = {
      title: form.title, job_ref: form.job_ref, site_address: form.site_address,
      prepared_by: form.prepared_by, date: form.start_date || new Date().toISOString().split("T")[0],
      scope: form.scope, cdm_notifiable: form.cdm_notifiable, form_data: JSON.stringify(form),
    };
    if (editingId) {
      const { data, error } = await db.from("rams_documents").update(payload).eq("id", editingId).eq("user_id", user.id).select().single();
      if (!error && data) { setRams(p => p.map(r => r.id === editingId ? data : r)); }
    } else {
      const { data, error } = await db.from("rams_documents").insert({ user_id: user.id, ...payload, created_at: new Date().toISOString() }).select().single();
      if (!error && data) { setRams(p => [data, ...p]); }
    }
    setScreen("list"); setForm(blankForm()); setStep(1); setEditingId(null);
  };

  // Get all selected hazards as full objects
  const getSelectedHazards = () => {
    const all = Object.values(HAZARD_LIBRARY).flat();
    return [
      ...all.filter(h => form.selected_hazards.includes(h.id)),
      ...form.custom_hazards,
    ];
  };

  const getSelectedSteps = () => [
    ...form.selected_method_steps,
    ...form.custom_method_steps,
  ];

  const getSelectedCOSHH = () => [
    ...COSHH_SUBSTANCES.filter(s => form.coshh_substances.includes(s.name)),
    ...form.custom_coshh,
  ];

  const aiGenerate = async () => {
    if (!form.scope) { alert("Add a scope of work first."); return; }
    setGenerating(true);
    try {
      const response = await fetch("/api/claude", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001", max_tokens: 800,
          messages: [{ role: "user", content: `For this UK trade work: "${form.scope}", return ONLY JSON: {"hazard_ids": ["list of relevant hazard ids from: wah1,wah2,wah3,wah4,wah5,elec1,elec2,elec3,elec4,gas1,gas2,gas3,gas4,gas5,plumb1,plumb2,plumb3,plumb4,mh1,mh2,mh3,pt1,pt2,pt3,pt4,pt5,dust1,dust2,dust3,dust4,stf1,stf2,stf3,fire1,fire2,cs1,cs2,site1,site2,site3,site4"], "method_steps": ["up to 8 specific work steps"]}` }],
        }),
      });
      const data = await response.json();
      const text = data.content?.[0]?.text || "";
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        setForm(f => ({
          ...f,
          selected_hazards: [...new Set([...f.selected_hazards, ...(parsed.hazard_ids || [])])],
          custom_method_steps: [...f.custom_method_steps, ...(parsed.method_steps || [])],
        }));
      }
    } catch (e) { console.error(e); }
    setGenerating(false);
  };

  const [assigningRams, setAssigningRams] = useState(null);

  const assignRamsToJob = async (ramsId, jobId, jobTitle) => {
    await db.from("rams_documents").update({ job_id: jobId, job_ref: jobTitle || "" }).eq("id", ramsId).eq("user_id", user.id);
    setRams(p => p.map(r => r.id === ramsId ? { ...r, job_id: jobId, job_ref: jobTitle || "" } : r));
    setAssigningRams(null);
  };

  const startEdit = (r) => {
    const d = typeof r.form_data === "string" ? JSON.parse(r.form_data || "{}") : (r.form_data || {});
    setForm({ ...blankForm(), ...d, title: r.title, job_ref: r.job_ref || "", site_address: r.site_address || "", prepared_by: r.prepared_by || "" });
    setEditingId(r.id);
    setStep(1);
    setScreen("wizard");
  };


  const generatePDF = (r) => {
    const d = typeof r.form_data === "string" ? JSON.parse(r.form_data || "{}") : (r.form_data || {});
    const hazards = getSelectedHazardsFromData(d);
    const steps = [...(d.selected_method_steps || []), ...(d.custom_method_steps || [])];
    const coshh = [...COSHH_SUBSTANCES.filter(s => (d.coshh_substances || []).includes(s.name)), ...(d.custom_coshh || [])];
    const riskColor = { Low: "#10b981", Medium: "#f59e0b", High: "#ef4444", Critical: "#7c3aed" };

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>RAMS — ${r.title}</title>
<style>
  body{font-family:Arial,sans-serif;padding:32px;font-size:12px;color:#111;line-height:1.4}
  @page{margin:20mm}
  h1{font-size:20px;font-weight:700;margin:0 0 4px}
  h2{font-size:13px;font-weight:700;margin:20px 0 8px;padding:6px 10px;background:#f3f4f6;border-left:4px solid #f59e0b}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:3px solid #f59e0b}
  .meta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px}
  .meta-box{background:#f9fafb;border-radius:4px;padding:8px 10px}
  .meta-label{font-size:9px;text-transform:uppercase;color:#6b7280;letter-spacing:0.06em;margin-bottom:3px}
  .meta-value{font-size:11px;font-weight:600}
  table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px}
  th{background:#f3f4f6;padding:7px 8px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid #e5e7eb}
  td{padding:7px 8px;border-bottom:1px solid #f3f4f6;vertical-align:top}
  .risk{display:inline-block;padding:2px 6px;border-radius:3px;font-size:9px;font-weight:700;color:#fff}
  .steps{counter-reset:step;margin:0;padding:0;list-style:none}
  .steps li{counter-increment:step;padding:6px 0 6px 28px;border-bottom:1px solid #f3f4f6;position:relative}
  .steps li::before{content:counter(step);position:absolute;left:0;top:6px;width:18px;height:18px;background:#f59e0b;color:#000;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;line-height:18px;text-align:center}
  .sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}
  .sig-box{border:1px solid #e5e7eb;border-radius:6px;padding:14px;min-height:70px}
  .sig-label{font-size:9px;text-transform:uppercase;color:#6b7280;letter-spacing:0.06em;margin-bottom:4px}
  .cdm-badge{display:inline-block;background:#ef4444;color:#fff;padding:2px 8px;border-radius:3px;font-size:9px;font-weight:700}
  .warning{background:#fef3c7;border:1px solid #f59e0b;border-radius:4px;padding:8px 10px;font-size:10px;color:#92400e;margin-bottom:12px}
  .footer{margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:9px;color:#9ca3af;display:flex;justify-content:space-between}
</style></head><body>

<div class="header">
  <div>
    ${brand?.logo ? `<img src="${brand.logo}" style="height:48px;margin-bottom:8px;display:block">` : ""}
    <h1>${brand?.tradingName || "Trade PA"}</h1>
    <div style="font-size:11px;color:#666">${brand?.address || ""}${brand?.phone ? ` · ${brand.phone}` : ""}</div>
  </div>
  <div style="text-align:right">
    <div style="font-weight:700;font-size:14px">Risk Assessment &amp; Method Statement</div>
    <div style="font-size:11px;color:#666;margin-top:4px">${r.title}</div>
    ${d.cdm_notifiable ? '<div style="margin-top:6px"><span class="cdm-badge">CDM NOTIFIABLE PROJECT</span></div>' : ""}
  </div>
</div>

<div class="meta-grid">
  ${d.site_address ? `<div class="meta-box"><div class="meta-label">Site Address</div><div class="meta-value">${d.site_address}</div></div>` : ""}
  ${d.client_name ? `<div class="meta-box"><div class="meta-label">Client</div><div class="meta-value">${d.client_name}</div></div>` : ""}
  ${d.job_ref ? `<div class="meta-box"><div class="meta-label">Job Reference</div><div class="meta-value">${d.job_ref}</div></div>` : ""}
  ${d.start_date ? `<div class="meta-box"><div class="meta-label">Start Date</div><div class="meta-value">${new Date(d.start_date).toLocaleDateString("en-GB")}</div></div>` : ""}
  ${d.end_date ? `<div class="meta-box"><div class="meta-label">End Date</div><div class="meta-value">${new Date(d.end_date).toLocaleDateString("en-GB")}</div></div>` : ""}
  ${d.prepared_by ? `<div class="meta-box"><div class="meta-label">Prepared By</div><div class="meta-value">${d.prepared_by}</div></div>` : ""}
</div>

${d.scope ? `<h2>Scope of Work</h2><p style="margin:0 0 8px">${d.scope}</p>` : ""}

<h2>Risk Assessment</h2>
${hazards.length === 0 ? "<p style='color:#9ca3af;font-size:11px'>No hazards recorded</p>" : `
<table>
  <thead><tr><th>Hazard</th><th style="width:80px">Risk Level</th><th>Control Measures</th><th>PPE Required</th></tr></thead>
  <tbody>${hazards.map(h => `<tr>
    <td>${h.hazard}</td>
    <td><span class="risk" style="background:${riskColor[h.risk] || "#666"}">${h.risk}</span></td>
    <td>${h.control}</td>
    <td>${h.ppe}</td>
  </tr>`).join("")}</tbody>
</table>`}

${steps.length > 0 ? `
<h2>Method Statement</h2>
<ol class="steps">${steps.map(s => `<li>${s}</li>`).join("")}</ol>` : ""}

${coshh.length > 0 ? `
<h2>COSHH Substances</h2>
<table>
  <thead><tr><th>Substance</th><th>Hazard</th><th>Control Measure</th><th>PPE</th></tr></thead>
  <tbody>${coshh.map(s => `<tr><td>${s.name}</td><td>${s.hazard}</td><td>${s.exposure}</td><td>${s.ppe}</td></tr>`).join("")}</tbody>
</table>` : ""}

${(d.first_aider || d.nearest_ae || d.emergency_procedure) ? `
<h2>Emergency Arrangements</h2>
<div class="meta-grid">
  ${d.first_aider ? `<div class="meta-box"><div class="meta-label">First Aider</div><div class="meta-value">${d.first_aider}</div></div>` : ""}
  ${d.nearest_ae ? `<div class="meta-box"><div class="meta-label">Nearest A&amp;E</div><div class="meta-value">${d.nearest_ae}</div></div>` : ""}
  ${d.muster_point ? `<div class="meta-box"><div class="meta-label">Muster Point</div><div class="meta-value">${d.muster_point}</div></div>` : ""}
</div>
${d.emergency_procedure ? `<p style="margin:8px 0;font-size:11px">${d.emergency_procedure}</p>` : ""}` : ""}

<h2>Operative Acknowledgement</h2>
<div class="warning">All operatives must read and sign this document before commencing work. By signing, you confirm that you have read, understood and will comply with all control measures and procedures described in this document.</div>
<div class="sig-grid">
  <div class="sig-box"><div class="sig-label">Operative Name</div><div style="margin-top:8px;height:30px;border-bottom:1px solid #e5e7eb"></div><div style="margin-top:8px;font-size:9px;color:#9ca3af">Signature &amp; Date</div></div>
  <div class="sig-box"><div class="sig-label">Operative Name</div><div style="margin-top:8px;height:30px;border-bottom:1px solid #e5e7eb"></div><div style="margin-top:8px;font-size:9px;color:#9ca3af">Signature &amp; Date</div></div>
  <div class="sig-box"><div class="sig-label">Operative Name</div><div style="margin-top:8px;height:30px;border-bottom:1px solid #e5e7eb"></div><div style="margin-top:8px;font-size:9px;color:#9ca3af">Signature &amp; Date</div></div>
  <div class="sig-box"><div class="sig-label">Client / Site Manager</div><div style="margin-top:8px;height:30px;border-bottom:1px solid #e5e7eb"></div><div style="margin-top:8px;font-size:9px;color:#9ca3af">Signature &amp; Date</div></div>
</div>

<div class="footer">
  <span>${brand?.tradingName || "Trade PA"} · Generated by Trade PA</span>
  <span>Document Date: ${new Date(r.created_at).toLocaleDateString("en-GB")}</span>
</div>
</body></html>`;

    window.dispatchEvent(new CustomEvent("trade-pa-show-pdf", { detail: html }));
  };

  const getSelectedHazardsFromData = (d) => {
    const all = Object.values(HAZARD_LIBRARY).flat();
    return [
      ...all.filter(h => (d.selected_hazards || []).includes(h.id)),
      ...(d.custom_hazards || []),
    ];
  };

  const del = async (id) => {
    if (!confirm("Delete this RAMS document?")) return;
    await db.from("rams_documents").delete().eq("id", id).eq("user_id", user.id);
    setRams(p => p.filter(r => r.id !== id));
  };

  const STEPS = ["Project Details", "Hazards", "Method Statement", "COSHH", "Welfare & Emergency"];

  // ── WIZARD ────────────────────────────────────────────────────────────────
  if (screen === "wizard") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 0, paddingBottom: 100 }}>
        {/* Header — chevron + eyebrow "STEP X OF 5" + title (matches DetailPage pattern from Phase 4) */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <button
            onClick={() => { setScreen("list"); setForm(blankForm()); setStep(1); setEditingId(null); }}
            aria-label="Back to RAMS list"
            style={{ background: "none", border: "none", color: C.text, cursor: "pointer", padding: 4, display: "grid", placeItems: "center", flexShrink: 0 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: C.muted, letterSpacing: "0.08em", fontWeight: 700 }}>STEP {step} OF {STEPS.length}</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{form.title || "New RAMS"}</div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
          {STEPS.map((s, i) => (
            <div key={i} onClick={() => { if (i < step) setStep(i + 1); }}
              style={{ flex: 1, height: 4, borderRadius: 2, background: i < step ? C.amber : C.border, cursor: i < step ? "pointer" : "default", transition: "background 0.2s" }} />
          ))}
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: C.muted, letterSpacing: "0.08em", fontWeight: 700, textTransform: "uppercase", marginBottom: 16 }}>{STEPS[step - 1]}</div>

        {/* Step 1: Project Details */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Project Details</div>
                <VoiceFillButton form={form} setForm={setForm} fieldDescriptions="title (RAMS document title e.g. Boiler replacement 12 High Street), scope (describe the work), site_address (full site address), client_name (client or contractor name), start_date (YYYY-MM-DD), end_date (YYYY-MM-DD), prepared_by (your name), reviewed_by (supervisor name), job_ref (job reference)" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div><label style={S.label}>RAMS Title *</label><input style={S.input} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Gas boiler replacement — 12 High Street" /></div>
                <div><label style={S.label}>Scope of Work</label><textarea style={{ ...S.input, minHeight: 80 }} value={form.scope} onChange={e => setForm(f => ({ ...f, scope: e.target.value }))} placeholder="Describe the work to be carried out..." /></div>
                <div style={S.grid2}>
                  <div><label style={S.label}>Site Address</label><input style={S.input} value={form.site_address} onChange={e => setForm(f => ({ ...f, site_address: e.target.value }))} placeholder="Full site address" /></div>
                  <div><label style={S.label}>Client Name</label><input style={S.input} value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} placeholder="Client or contractor name" /></div>
                </div>
                <div style={S.grid2}>
                  <div><label style={S.label}>Start Date</label><input style={S.input} type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
                  <div><label style={S.label}>End Date</label><input style={S.input} type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></div>
                </div>
                <div style={S.grid2}>
                  <div><label style={S.label}>Prepared By</label><input style={S.input} value={form.prepared_by} onChange={e => setForm(f => ({ ...f, prepared_by: e.target.value }))} placeholder="Your name" /></div>
                  <div><label style={S.label}>Reviewed By</label><input style={S.input} value={form.reviewed_by} onChange={e => setForm(f => ({ ...f, reviewed_by: e.target.value }))} placeholder="Supervisor / manager" /></div>
                </div>
                <div><label style={S.label}>Job Reference</label><input style={S.input} value={form.job_ref} onChange={e => setForm(f => ({ ...f, job_ref: e.target.value }))} placeholder="Optional job reference" /></div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: C.red + "11", border: `1px solid ${C.red}33`, borderRadius: 8 }}>
                  <input type="checkbox" id="cdm" checked={form.cdm_notifiable} onChange={e => setForm(f => ({ ...f, cdm_notifiable: e.target.checked }))} style={{ width: 16, height: 16 }} />
                  <label htmlFor="cdm" style={{ fontSize: 12, cursor: "pointer" }}>This is a CDM Notifiable Project (notify HSE via F10 — project over 30 days with 20+ workers, or over 500 person-days)</label>
                </div>
                {form.cdm_notifiable && (
                  <div style={S.grid2}>
                    <div><label style={S.label}>CDM Coordinator</label><input style={S.input} value={form.cdm_coordinator} onChange={e => setForm(f => ({ ...f, cdm_coordinator: e.target.value }))} /></div>
                    <div><label style={S.label}>Principal Contractor</label><input style={S.input} value={form.cdm_principal_contractor} onChange={e => setForm(f => ({ ...f, cdm_principal_contractor: e.target.value }))} /></div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Hazards */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 12, color: C.muted }}>{form.selected_hazards.length} hazards selected</div>
              <button onClick={aiGenerate} disabled={generating} style={{ ...S.btn("ghost"), fontSize: 11, padding: "5px 12px" }}>
                {generating ? "⏳ Suggesting..." : "🤖 AI Suggest from Scope"}
              </button>
            </div>
            {Object.entries(HAZARD_LIBRARY).map(([category, hazards]) => (
              <div key={category} style={S.card}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: C.amber }}>{category}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {hazards.map(h => {
                    const selected = form.selected_hazards.includes(h.id);
                    const riskColors = { Low: C.green, Medium: C.amber, High: C.red, Critical: "#7c3aed" };
                    return (
                      <div key={h.id} onClick={() => setForm(f => ({ ...f, selected_hazards: selected ? f.selected_hazards.filter(x => x !== h.id) : [...f.selected_hazards, h.id] }))}
                        style={{
                          display: "flex",
                          alignItems: selected ? "flex-start" : "center",
                          gap: 10,
                          padding: selected ? "10px 12px" : "7px 10px",
                          borderRadius: 8,
                          border: `${selected ? 2 : 1}px solid ${selected ? riskColors[h.risk] : C.border}`,
                          background: selected ? riskColors[h.risk] + "0f" : C.surfaceHigh,
                          cursor: "pointer",
                          transition: "padding 0.15s, border-width 0.15s",
                        }}>
                        <div style={{ width: selected ? 20 : 16, height: selected ? 20 : 16, borderRadius: 4, border: `2px solid ${selected ? riskColors[h.risk] : C.border}`, background: selected ? riskColors[h.risk] : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: selected ? 11 : 9, color: "#fff", flexShrink: 0, marginTop: selected ? 1 : 0 }}>
                          {selected ? "✓" : ""}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: selected ? 3 : 0 }}>
                            <div style={{ fontSize: 12, fontWeight: selected ? 600 : 500, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: selected ? "normal" : "nowrap" }}>{h.hazard}</div>
                            <div style={{ fontSize: 9, fontWeight: 700, color: "#fff", background: riskColors[h.risk], padding: "1px 6px", borderRadius: 3, flexShrink: 0 }}>{h.risk}</div>
                          </div>
                          {selected && <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.4 }}>{h.control}</div>}
                          {selected && <div style={{ fontSize: 11, color: C.amber, marginTop: 3 }}>PPE: {h.ppe}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {/* Custom hazards */}
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>Custom Hazards</div>
                <button onClick={() => setForm(f => ({ ...f, custom_hazards: [...f.custom_hazards, { hazard: "", risk: "Medium", control: "", ppe: "" }] }))} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px" }}>+ Add</button>
              </div>
              {form.custom_hazards.map((h, i) => (
                <div key={i} style={{ background: C.surfaceHigh, borderRadius: 8, padding: "10px 12px", marginBottom: 8, border: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <input style={{ ...S.input, flex: 2, fontSize: 12 }} value={h.hazard} onChange={e => setForm(f => ({ ...f, custom_hazards: f.custom_hazards.map((x,j) => j===i ? {...x,hazard:e.target.value} : x) }))} placeholder="Hazard description" />
                    <select style={{ ...S.input, flex: 1, fontSize: 11 }} value={h.risk} onChange={e => setForm(f => ({ ...f, custom_hazards: f.custom_hazards.map((x,j) => j===i ? {...x,risk:e.target.value} : x) }))}>
                      {["Low","Medium","High","Critical"].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <button onClick={() => setForm(f => ({ ...f, custom_hazards: f.custom_hazards.filter((_,j) => j!==i) }))} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
                  </div>
                  <input style={{ ...S.input, fontSize: 12, marginBottom: 6 }} value={h.control} onChange={e => setForm(f => ({ ...f, custom_hazards: f.custom_hazards.map((x,j) => j===i ? {...x,control:e.target.value} : x) }))} placeholder="Control measures" />
                  <input style={{ ...S.input, fontSize: 12 }} value={h.ppe} onChange={e => setForm(f => ({ ...f, custom_hazards: f.custom_hazards.map((x,j) => j===i ? {...x,ppe:e.target.value} : x) }))} placeholder="PPE required" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Method Statement */}
        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 12, color: C.muted }}>{getSelectedSteps().length} steps in method statement</div>
            {Object.entries(METHOD_LIBRARY).map(([category, steps]) => (
              <div key={category} style={S.card}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: C.amber }}>{category}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {steps.map((step, si) => {
                    const sel = form.selected_method_steps.includes(step);
                    return (
                      <div key={si} onClick={() => setForm(f => ({ ...f, selected_method_steps: sel ? f.selected_method_steps.filter(x => x !== step) : [...f.selected_method_steps, step] }))}
                        style={{ display: "flex", gap: 10, padding: "8px 10px", borderRadius: 10, border: `1px solid ${sel ? C.amber + "88" : C.border}`, background: sel ? C.amber + "0a" : "transparent", cursor: "pointer" }}>
                        <div style={{ width: 18, height: 18, borderRadius: 3, border: `2px solid ${sel ? C.amber : C.border}`, background: sel ? C.amber : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#000", flexShrink: 0, marginTop: 1 }}>
                          {sel ? "✓" : ""}
                        </div>
                        <div style={{ fontSize: 12, lineHeight: 1.4 }}>{step}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {/* Custom steps */}
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>Custom Steps</div>
                <button onClick={() => setForm(f => ({ ...f, custom_method_steps: [...f.custom_method_steps, ""] }))} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px" }}>+ Add Step</button>
              </div>
              {form.custom_method_steps.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  <input style={{ ...S.input, flex: 1, fontSize: 12 }} value={s} onChange={e => setForm(f => ({ ...f, custom_method_steps: f.custom_method_steps.map((x,j) => j===i ? e.target.value : x) }))} placeholder="Custom step..." />
                  <button onClick={() => setForm(f => ({ ...f, custom_method_steps: f.custom_method_steps.filter((_,j) => j!==i) }))} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: COSHH */}
        {step === 4 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 12, color: C.muted }}>Select any hazardous substances being used on this job</div>
            <div style={S.card}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Substance Library</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {COSHH_SUBSTANCES.map((s, i) => {
                  const sel = form.coshh_substances.includes(s.name);
                  return (
                    <div key={i} onClick={() => setForm(f => ({ ...f, coshh_substances: sel ? f.coshh_substances.filter(x => x !== s.name) : [...f.coshh_substances, s.name] }))}
                      style={{ display: "flex", gap: 10, padding: "8px 10px", borderRadius: 10, border: `1px solid ${sel ? C.amber + "88" : C.border}`, background: sel ? C.amber + "0a" : "transparent", cursor: "pointer" }}>
                      <div style={{ width: 18, height: 18, borderRadius: 3, border: `2px solid ${sel ? C.amber : C.border}`, background: sel ? C.amber : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#000", flexShrink: 0 }}>
                        {sel ? "✓" : ""}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{s.name}</div>
                        {sel && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{s.hazard} · PPE: {s.ppe}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Custom substances */}
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>Custom Substances</div>
                <button onClick={() => setForm(f => ({ ...f, custom_coshh: [...f.custom_coshh, { name: "", hazard: "", exposure: "", ppe: "" }] }))} style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px" }}>+ Add</button>
              </div>
              {form.custom_coshh.map((s, i) => (
                <div key={i} style={{ background: C.surfaceHigh, borderRadius: 8, padding: "10px 12px", marginBottom: 8, border: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                    <input style={{ ...S.input, flex: 1, fontSize: 12 }} value={s.name} onChange={e => setForm(f => ({ ...f, custom_coshh: f.custom_coshh.map((x,j) => j===i ? {...x,name:e.target.value} : x) }))} placeholder="Substance name" />
                    <button onClick={() => setForm(f => ({ ...f, custom_coshh: f.custom_coshh.filter((_,j) => j!==i) }))} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
                  </div>
                  <input style={{ ...S.input, fontSize: 12, marginBottom: 6 }} value={s.hazard} onChange={e => setForm(f => ({ ...f, custom_coshh: f.custom_coshh.map((x,j) => j===i ? {...x,hazard:e.target.value} : x) }))} placeholder="Hazard" />
                  <input style={{ ...S.input, fontSize: 12, marginBottom: 6 }} value={s.exposure} onChange={e => setForm(f => ({ ...f, custom_coshh: f.custom_coshh.map((x,j) => j===i ? {...x,exposure:e.target.value} : x) }))} placeholder="Control measure / exposure limit" />
                  <input style={{ ...S.input, fontSize: 12 }} value={s.ppe} onChange={e => setForm(f => ({ ...f, custom_coshh: f.custom_coshh.map((x,j) => j===i ? {...x,ppe:e.target.value} : x) }))} placeholder="PPE required" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Welfare & Emergency */}
        {step === 5 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Emergency Arrangements</div>
                <VoiceFillButton form={form} setForm={setForm} fieldDescriptions="first_aider (first aider name and phone), nearest_ae (nearest A&E hospital name and address), muster_point (emergency assembly point), welfare_location (toilet and welfare facilities location), emergency_procedure (what to do in an emergency)" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={S.grid2}>
                  <div><label style={S.label}>First Aider on Site</label><input style={S.input} value={form.first_aider} onChange={e => setForm(f => ({ ...f, first_aider: e.target.value }))} placeholder="Name & phone" /></div>
                  <div><label style={S.label}>Nearest A&E Hospital</label><input style={S.input} value={form.nearest_ae} onChange={e => setForm(f => ({ ...f, nearest_ae: e.target.value }))} placeholder="Hospital name & address" /></div>
                </div>
                <div style={S.grid2}>
                  <div><label style={S.label}>Muster / Assembly Point</label><input style={S.input} value={form.muster_point} onChange={e => setForm(f => ({ ...f, muster_point: e.target.value }))} placeholder="Where to go in emergency" /></div>
                  <div><label style={S.label}>Welfare Facilities</label><input style={S.input} value={form.welfare_location} onChange={e => setForm(f => ({ ...f, welfare_location: e.target.value }))} placeholder="Location of toilets / welfare" /></div>
                </div>
                <div><label style={S.label}>Emergency Procedure</label><textarea style={{ ...S.input, minHeight: 80 }} value={form.emergency_procedure} onChange={e => setForm(f => ({ ...f, emergency_procedure: e.target.value }))} placeholder="What to do in the event of an emergency, fire, accident or gas leak..." /></div>
              </div>
            </div>
            <div style={{ background: C.amber + "11", border: `1px solid ${C.amber}33`, borderRadius: 8, padding: "10px 12px", fontSize: 11, color: C.amber }}>
              Emergency services: 999 · Gas emergency: 0800 111 999 · HSE incident line: 0345 300 9923
            </div>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: "flex", gap: 8, marginTop: 20, position: "sticky", bottom: 80, background: C.bg, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
          {step > 1 && <button onClick={() => setStep(s => s - 1)} style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center" }}>← Back</button>}
          {step < STEPS.length
            ? <button onClick={() => setStep(s => s + 1)} disabled={step === 1 && !form.title} style={{ ...S.btn("primary"), flex: 2, justifyContent: "center" }}>Next → {STEPS[step]}</button>
            : <button onClick={saveRAMS} disabled={!form.title} style={{ ...S.btn("primary"), flex: 2, justifyContent: "center" }}>💾 Save RAMS</button>
          }
        </div>
      </div>
    );
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────────
  // Derived list for render
  const sLower = search.trim().toLowerCase();
  const listItems = rams.filter(r => {
    if (filter === "cdm" && !r.cdm_notifiable) return false;
    if (filter === "linked" && !r.job_id) return false;
    if (!sLower) return true;
    return (r.title || "").toLowerCase().includes(sLower)
        || (r.site_address || "").toLowerCase().includes(sLower)
        || (r.job_ref || "").toLowerCase().includes(sLower);
  }).map(r => {
    const d = typeof r.form_data === "string" ? JSON.parse(r.form_data || "{}") : (r.form_data || {});
    const hazardCount = (d.selected_hazards || []).length + (d.custom_hazards || []).length;
    const stepCount = (d.selected_method_steps || []).length + (d.custom_method_steps || []).length;
    return { ...r, _d: d, _hazardCount: hazardCount, _stepCount: stepCount };
  }).sort((a, b) => {
    if (sortMode === "title") return (a.title || "").localeCompare(b.title || "");
    if (sortMode === "hazards") return b._hazardCount - a._hazardCount;
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });
  const cdmCount = rams.filter(r => r.cdm_notifiable).length;
  const linkedCount = rams.filter(r => r.job_id).length;
  const chipStyle = (active, tint) => ({
    padding: "6px 12px", borderRadius: 16, fontSize: 12, fontWeight: 600,
    background: active ? (tint || C.text) : "transparent",
    color: active ? (tint === C.text || !tint ? C.bg : "#fff") : C.textDim,
    border: `1px solid ${active ? (tint || C.text) : C.border}`,
    cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
  });
  const nextSort = () => setSortMode(m => m === "recent" ? "title" : m === "title" ? "hazards" : "recent");
  const sortLabel = sortMode === "recent" ? "Recent" : sortMode === "title" ? "Title" : "Hazards";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 80 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>RAMS Builder</div>
        <button onClick={() => { setForm(blankForm()); setStep(1); setEditingId(null); setScreen("wizard"); }} style={S.btn("primary")}>+ New RAMS</button>
      </div>

      <div style={{ fontSize: 11, color: C.muted, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", lineHeight: 1.6 }}>
        Create Risk Assessment & Method Statements for any job. Choose from a library of pre-written hazards and method statement steps, or add your own. Generate a professional branded PDF for client sign-off.
      </div>

      {rams.length > 0 && (
        <>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search title, site, job ref…"
            style={{ ...S.input, fontSize: 13 }}
          />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={() => setFilter("all")} style={chipStyle(filter === "all")}>All {rams.length}</button>
            <button onClick={() => setFilter("cdm")} style={chipStyle(filter === "cdm", C.red)}>CDM {cdmCount}</button>
            <button onClick={() => setFilter("linked")} style={chipStyle(filter === "linked", C.green)}>Linked {linkedCount}</button>
            <button onClick={nextSort} style={{
              marginLeft: "auto", padding: "6px 12px", borderRadius: 16,
              fontSize: 12, fontWeight: 600, background: "transparent",
              color: C.muted, border: `1px solid ${C.border}`, cursor: "pointer",
              whiteSpace: "nowrap",
            }}>↕ {sortLabel}</button>
          </div>
        </>
      )}

      {loading ? <div style={{ fontSize: 12, color: C.muted, padding: 16 }}>Loading...</div> :
        rams.length === 0 ? (
          <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic", textAlign: "center", padding: 40 }}>No RAMS documents yet — tap + New RAMS to get started</div>
        ) : listItems.length === 0 ? (
          <div style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: 24 }}>
            {search ? `No RAMS match "${search}".` : filter === "cdm" ? "No CDM notifiable projects." : "No RAMS linked to a job yet."}
          </div>
        ) : listItems.map(r => {
          return (
            <div key={r.id} style={{ background: C.surfaceHigh, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{r.title}</div>
                    {r.cdm_notifiable && <div style={{ fontSize: 9, fontWeight: 700, color: "#fff", background: C.red, padding: "1px 6px", borderRadius: 3 }}>CDM</div>}
                  </div>
                  {r.site_address && <div style={{ fontSize: 11, color: C.muted }}>📍 {r.site_address}</div>}
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    {new Date(r.created_at).toLocaleDateString("en-GB")}
                    {r.job_ref && ` · ${r.job_ref}`}
                    {r._hazardCount > 0 && ` · ${r._hazardCount} hazards`}
                    {r._stepCount > 0 && ` · ${r._stepCount} steps`}
                  </div>
                  {r.job_id && <div style={{ fontSize: 11, color: C.green, marginTop: 2 }}>🔗 Linked to: {r.job_ref || "Job"}</div>}
                </div>
              </div>
              <div style={{ borderTop: `1px solid ${C.border}`, display: "flex", gap: 1 }}>
                <button onClick={() => generatePDF(r)} style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", fontSize: 12, borderRadius: 0, border: "none", borderRight: `1px solid ${C.border}` }}>⬇ PDF</button>
                <button onClick={() => startEdit(r)} style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", fontSize: 12, borderRadius: 0, border: "none", borderRight: `1px solid ${C.border}` }}>✏ Edit</button>
                <button onClick={() => duplicateRAMS(r)} style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", fontSize: 12, borderRadius: 0, border: "none", borderRight: `1px solid ${C.border}` }}>📋 Copy</button>
                <button onClick={() => setAssigningRams(r)} style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", fontSize: 12, borderRadius: 0, border: "none", borderRight: `1px solid ${C.border}`, color: r.job_id ? C.green : C.muted }}>🔗 {r.job_id ? "Linked" : "Job"}</button>
                <button onClick={() => del(r.id)} aria-label="Delete" style={{ ...S.btn("ghost"), flex: 1, justifyContent: "center", fontSize: 16, borderRadius: 0, border: "none", color: C.red, padding: "6px 0" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
              </div>
            </div>
          );
        })
      }

      {/* Assign to job modal */}
      {assigningRams && (
        <AssignToJobModal
          user={user}
          currentJobId={assigningRams.job_id}
          onAssign={(jobId, jobTitle) => assignRamsToJob(assigningRams.id, jobId, jobTitle)}
          onClose={() => setAssigningRams(null)}
        />
      )}
    </div>
  );
}



// ─── Workers/subs unification reads ─────────────────────────────────────────
// Sessions 1-4 of the workers+subcontractors unification (2026-04-24/25)
// merged the legacy `workers` and `subcontractors` tables into a single
// `team_members` table. The dual-write mirror helpers used during the
// migration window have been removed (Session 4). Reads come via the
// helpers below; writes go directly to team_members in the call sites.

// ─── Session 2: reads migration ─────────────────────────────────────────────
// Reads now come from team_members instead of the legacy workers/subcontractors
// tables. Each helper is a drop-in replacement for the legacy query pattern —
// returns { data, error } in the same shape as a Supabase .from().select() call,
// with each row translated to match the legacy table's column names so existing
// call-sites don't need to change their field references.
//
// The `source_table` filter preserves legacy table-scope semantics exactly:
//   - workers read → only rows mirrored from `workers`
// Reads return team_members.id as `id` post-Session-3 cutover (was source_id
// pre-cutover so legacy table writes still worked). Now all writes target
// team_members directly, so id and source_id are unified — return tm.id.
//
// The `source_table` filter preserves legacy table-scope semantics: workers
// reads return rows added via "Add Worker", subs reads return rows added via
// "Add Subcontractor". One human, one row, in the tab they were added to.

// (tmReadWorkers, tmReadSubs moved to ./lib/team-members.js — P7 prelude)
// (portalCtaBlock moved to ./lib/portal-extras.js — P7 prelude)

// (generateICS moved to ./views/Schedule.jsx — P7-7A)





// ─── JobsHub — Jobs bottom-tab landing ──────────────────────────────────────
