#!/usr/bin/env python3
"""
fix_schedule_bugs_all.py — fix Schedule.jsx three bugs in one shot.

Bug A: Edit modal has no Time input (and saveEdit ignored time/dateObj anyway).
Bug B: Neither saveJob nor saveEdit persisted to Supabase — every change
       was lost on refresh.
Bug C: No way to link a manual schedule entry to an existing job_card.

What this script changes
========================
src/views/Schedule.jsx
  1. Adds `import { db } from "../lib/db.js"` (verify path — see notes below).
  2. Adds `user` to the function signature.
  3. Adds `jobCards` state + fetch effect (for the "Link to job" dropdown).
  4. Adds `linkedJobCardId` to the form state in openAdd().
  5. Adds time + linkedJobCardId to the form state in the Edit click handler
     (also drops a redundant no-op `.replace(":", ":")`).
  6. Rewrites `saveJob` async — Supabase insert into jobs (manual) OR update
     job_cards.start_at if linked (sync trigger handles the jobs row).
  7. Rewrites `saveEdit` async + source-aware:
       - source_type='manual'    → UPDATE jobs directly
       - source_type='job_card'  → UPDATE job_cards (trigger syncs jobs)
       - source_type='enquiry'   → UPDATE enquiries (trigger syncs jobs)
     ...and now properly applies the new time to dateObj.
  8. Adds the missing Time input to the Edit modal.
  9. Adds the Link-to-job <select> to the Add modal.

src/App.jsx
  10. Passes `user={user}` to <Schedule /> so the component can authenticate
      its own Supabase queries.

Run from project root:
    python3 fix_schedule_bugs_all.py

If the db import path is wrong, the esbuild compile-check will fail.
Check what App.jsx uses with:
    grep -n "import.*db.*from" src/App.jsx | head -3
...and adjust line 1 of Schedule.jsx accordingly.
"""

from pathlib import Path
import sys

SCHEDULE_PATH = Path("src/views/Schedule.jsx")
APP_PATH = Path("src/App.jsx")

if not SCHEDULE_PATH.exists():
    sys.exit(f"ERROR: {SCHEDULE_PATH} not found. Run from project root.")
if not APP_PATH.exists():
    sys.exit(f"ERROR: {APP_PATH} not found.")

s = SCHEDULE_PATH.read_text()
a = APP_PATH.read_text()

# Backup originals
SCHEDULE_PATH.with_suffix(".jsx.before_bug_fix").write_text(s)
APP_PATH.with_suffix(".jsx.before_bug_fix").write_text(a)


def patch(label, src, old, new):
    """Apply a single replacement, asserting old appears exactly once."""
    count = src.count(old)
    if count != 1:
        sys.exit(f"FATAL: {label}: expected exactly 1 match, got {count}.\n"
                 f"---OLD---\n{old[:300]}\n---")
    return src.replace(old, new, 1)


# ============================================================
# Schedule.jsx — Edit 1: add db import
# ============================================================
old1 = 'import { VoiceFillButton } from "../components/VoiceFillButton.jsx";'
new1 = (
    'import { VoiceFillButton } from "../components/VoiceFillButton.jsx";\n'
    'import { db } from "../lib/db.js";'
)
s = patch("Edit 1 (db import)", s, old1, new1)


# ============================================================
# Schedule.jsx — Edit 2: signature accepts `user`
# ============================================================
old2 = 'export function Schedule({ jobs, setJobs, customers, setContextHint }) {'
new2 = 'export function Schedule({ jobs, setJobs, customers, setContextHint, user }) {'
s = patch("Edit 2 (signature)", s, old2, new2)


# ============================================================
# Schedule.jsx — Edit 3: jobCards state + fetch (right after signature)
# ============================================================
state_block = '''
  // Job cards available for the "Link to existing job" dropdown
  const [jobCards, setJobCards] = useState([]);
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    db.from("job_cards")
      .select("id, customer, scope_of_work, start_date, status")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("start_date", { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[Schedule] job_cards fetch failed:", error);
          return;
        }
        setJobCards(data || []);
      });
    return () => { cancelled = true; };
  }, [user?.id]);
'''
s = patch("Edit 3 (jobCards state)", s, new2, new2 + state_block)


# ============================================================
# Schedule.jsx — Edit 4: openAdd form init (add linkedJobCardId)
# ============================================================
old4 = 'setForm({ customer: "", address: "", type: "", time: "09:00", value: "", status: "confirmed", notes: "" });'
new4 = 'setForm({ customer: "", address: "", type: "", time: "09:00", value: "", status: "confirmed", notes: "", linkedJobCardId: "" });'
s = patch("Edit 4 (openAdd form)", s, old4, new4)


# ============================================================
# Schedule.jsx — Edit 5: Edit click handler (add linkedJobCardId,
# drop redundant .replace(":", ":"))
# ============================================================
old5 = 'setForm({ customer: selectedJob.customer, address: selectedJob.address || "", type: selectedJob.type, time: selectedJob.dateObj ? new Date(selectedJob.dateObj).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }).replace(":", ":") : "09:00", value: selectedJob.value || "", status: selectedJob.status, notes: selectedJob.notes || "" });'
new5 = 'setForm({ customer: selectedJob.customer, address: selectedJob.address || "", type: selectedJob.type, time: selectedJob.dateObj ? new Date(selectedJob.dateObj).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "09:00", value: selectedJob.value || "", status: selectedJob.status, notes: selectedJob.notes || "", linkedJobCardId: selectedJob.source_type === "job_card" ? (selectedJob.source_ref || selectedJob.id || "") : "" });'
s = patch("Edit 5 (Edit-click form)", s, old5, new5)


# ============================================================
# Schedule.jsx — Edit 6: rewrite saveJob (async + Supabase persist)
# ============================================================
old6 = '''  const saveJob = () => {
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
  };'''

new6 = '''  const saveJob = async () => {
    if (!form.customer || !form.type) return;
    if (!user?.id) {
      console.error("[Schedule] saveJob: no user");
      alert("Couldn't save: not signed in");
      return;
    }
    const dateObj = new Date(addJobDate);
    const [h, m] = form.time.split(":");
    dateObj.setHours(parseInt(h), parseInt(m), 0, 0);

    // Linked to existing job_card → update its start_at; the trigger syncs jobs row
    if (form.linkedJobCardId) {
      const { error } = await db
        .from("job_cards")
        .update({ start_at: dateObj.toISOString(), status: form.status })
        .eq("id", form.linkedJobCardId)
        .eq("user_id", user.id);
      if (error) {
        console.error("[Schedule] saveJob (linked) failed:", error);
        alert("Couldn't save: " + (error.message || "unknown error"));
        return;
      }
      setJobs(prev => {
        const others = prev.filter(j => j.id !== form.linkedJobCardId);
        return [...others, {
          id: form.linkedJobCardId,
          customer: form.customer,
          address: form.address,
          type: form.type,
          date: `${formatDayLabel(addJobDate)} ${form.time}`,
          dateObj: dateObj.toISOString(),
          status: form.status,
          value: parseInt(form.value) || 0,
          notes: form.notes,
          source_type: "job_card",
          source_ref: form.linkedJobCardId,
        }];
      });
      setShowAddJob(false);
      return;
    }

    // Otherwise create a manual jobs row
    const newId = `manual-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const { error } = await db.from("jobs").insert({
      id: newId,
      user_id: user.id,
      customer: form.customer,
      address: form.address,
      type: form.type,
      date: `${formatDayLabel(addJobDate)} ${form.time}`,
      date_obj: dateObj.toISOString(),
      status: form.status,
      value: parseInt(form.value) || 0,
      notes: form.notes,
      source_type: "manual",
      source_ref: null,
    });
    if (error) {
      console.error("[Schedule] saveJob (manual) failed:", error);
      alert("Couldn't save: " + (error.message || "unknown error"));
      return;
    }
    setJobs(prev => [...prev, {
      id: newId,
      customer: form.customer,
      address: form.address,
      type: form.type,
      date: `${formatDayLabel(addJobDate)} ${form.time}`,
      dateObj: dateObj.toISOString(),
      status: form.status,
      value: parseInt(form.value) || 0,
      notes: form.notes,
      source_type: "manual",
      source_ref: null,
    }]);
    setShowAddJob(false);
  };'''

s = patch("Edit 6 (saveJob)", s, old6, new6)


# ============================================================
# Schedule.jsx — Edit 7: rewrite saveEdit (async + source-aware persist + time)
# ============================================================
old7 = '''  const saveEdit = () => {
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
  };'''

new7 = '''  const saveEdit = async () => {
    if (!form.customer || !form.type || !editingJob) return;
    if (!user?.id) {
      console.error("[Schedule] saveEdit: no user");
      alert("Couldn't save: not signed in");
      return;
    }

    // Apply the new time to the existing date
    const existing = editingJob.dateObj && !isNaN(new Date(editingJob.dateObj))
      ? new Date(editingJob.dateObj)
      : new Date();
    const [h, m] = (form.time || "09:00").split(":");
    const newDateObj = new Date(existing);
    newDateObj.setHours(parseInt(h), parseInt(m), 0, 0);
    const newDateLabel = `${formatDayLabel(newDateObj)} ${form.time || "09:00"}`;

    const sourceType = editingJob.source_type || "manual";
    const sourceRef = editingJob.source_ref;

    if (sourceType === "job_card") {
      // job-card-derived → write to job_cards; trigger syncs jobs
      const { error } = await db
        .from("job_cards")
        .update({
          start_at: newDateObj.toISOString(),
          customer: form.customer,
          scope_of_work: form.type,
          status: form.status,
        })
        .eq("id", editingJob.id)
        .eq("user_id", user.id);
      if (error) {
        console.error("[Schedule] saveEdit (job_card) failed:", error);
        alert("Couldn't save: " + (error.message || "unknown error"));
        return;
      }
    } else if (sourceType === "enquiry" && sourceRef) {
      // enquiry-derived → write to enquiries; trigger syncs jobs
      const { error } = await db
        .from("enquiries")
        .update({
          scheduled_visit_at: newDateObj.toISOString(),
          name: form.customer,
        })
        .eq("id", parseInt(sourceRef, 10))
        .eq("user_id", user.id);
      if (error) {
        console.error("[Schedule] saveEdit (enquiry) failed:", error);
        alert("Couldn't save: " + (error.message || "unknown error"));
        return;
      }
    } else {
      // Manual entry → update jobs row directly
      const { error } = await db
        .from("jobs")
        .update({
          customer: form.customer,
          address: form.address,
          type: form.type,
          status: form.status,
          value: parseInt(form.value) || 0,
          notes: form.notes,
          date_obj: newDateObj.toISOString(),
          date: newDateLabel,
        })
        .eq("id", editingJob.id)
        .eq("user_id", user.id);
      if (error) {
        console.error("[Schedule] saveEdit (manual) failed:", error);
        alert("Couldn't save: " + (error.message || "unknown error"));
        return;
      }
    }

    // Optimistic React state update
    setJobs(prev => prev.map(j => j.id === editingJob.id ? {
      ...j,
      customer: form.customer,
      address: form.address,
      type: form.type,
      status: form.status,
      value: parseInt(form.value) || 0,
      notes: form.notes,
      dateObj: newDateObj.toISOString(),
      date: newDateLabel,
    } : j));
    setEditingJob(null);
    setSelectedJob(null);
  };'''

s = patch("Edit 7 (saveEdit)", s, old7, new7)


# ============================================================
# Schedule.jsx — Edit 8: add Time input to Edit modal
# Anchor: Edit modal's Notes textarea has minHeight: 80 (Add modal's is 72)
# ============================================================
old8 = '''              <div>
                <label style={S.label}>Notes</label>
                <textarea style={{ ...S.input, resize: "vertical", minHeight: 80 }} placeholder="Any notes about this job..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>'''

new8 = '''              <div>
                <label style={S.label}>Time</label>
                <input type="time" style={S.input} value={form.time || "09:00"} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Notes</label>
                <textarea style={{ ...S.input, resize: "vertical", minHeight: 80 }} placeholder="Any notes about this job..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>'''

s = patch("Edit 8 (Edit modal Time input)", s, old8, new8)


# ============================================================
# Schedule.jsx — Edit 9: add "Link to job" select to Add modal
# Anchor: Add modal's Notes (minHeight: 72) immediately followed by Status block
# ============================================================
old9 = '''              <div>
                <label style={S.label}>Notes</label>
                <textarea style={{ ...S.input, resize: "vertical", minHeight: 72 }} placeholder="Any notes about this job..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Status</label>'''

new9 = '''              <div>
                <label style={S.label}>Notes</label>
                <textarea style={{ ...S.input, resize: "vertical", minHeight: 72 }} placeholder="Any notes about this job..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Link to existing job (optional)</label>
                <select
                  style={S.input}
                  value={form.linkedJobCardId || ""}
                  onChange={e => setForm(f => ({ ...f, linkedJobCardId: e.target.value }))}
                >
                  <option value="">— Manual appointment (no link) —</option>
                  {jobCards.map(jc => (
                    <option key={jc.id} value={jc.id}>
                      {(jc.customer || "(no customer)") + " — " + ((jc.scope_of_work || "").slice(0, 50) || "(no description)")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={S.label}>Status</label>'''

s = patch("Edit 9 (Add modal Link select)", s, old9, new9)


# ============================================================
# App.jsx — pass user prop to <Schedule />
# ============================================================
old_app = '<Schedule jobs={jobs} setJobs={setJobs} customers={customers} setContextHint={setContextHint} />'
new_app = '<Schedule jobs={jobs} setJobs={setJobs} customers={customers} setContextHint={setContextHint} user={user} />'
a = patch("App edit (Schedule invocation)", a, old_app, new_app)


# ============================================================
# Write output
# ============================================================
SCHEDULE_PATH.write_text(s)
APP_PATH.write_text(a)

print("OK — Schedule.jsx + App.jsx patched.")
print()
print("Backups:")
print(f"  src/views/Schedule.jsx.before_bug_fix")
print(f"  src/App.jsx.before_bug_fix")
print()
print("Now run:")
print("  npx esbuild src/views/Schedule.jsx --bundle=false --log-level=error --loader:.jsx=jsx > /dev/null && echo Schedule OK")
print("  npx esbuild src/App.jsx --bundle=false --log-level=error --loader:.jsx=jsx > /dev/null && echo App OK")
print()
print("If db import path is wrong (line 14 of Schedule.jsx), check:")
print("  grep -n \"import.*db.*from\" src/App.jsx | head -3")
print("...and update Schedule.jsx line 14 to match.")
