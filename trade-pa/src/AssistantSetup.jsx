// ============================================================================
// AssistantSetup.jsx — Name your AI, set wake words, teach it your commands
// ----------------------------------------------------------------------------
// Self-contained. Matches Trade PA's dark/amber theme. Inline styles, DM Mono.
//
// Three-step wizard:
//   1. Name + persona (what should it call itself? what tone?)
//   2. Wake words (what do you shout to summon it?)
//   3. Custom commands (teach it 2–3 of your own phrases)
//
// Also reusable from Settings — pass `mode="edit"` to skip intros.
//
// Props:
//   open          — boolean, show/hide
//   onClose       — callback
//   supabase      — your supabase client
//   user          — current user object (needs .id)
//   tools         — optional: array of your TOOLS (from App.jsx). If passed, the
//                   fast-mode command picker shows a menu of available actions.
//                   If omitted, falls back to a curated preset list.
//   onSaved       — callback(settings) fired after save, gives you the new
//                   settings object so App.jsx can update its in-memory copy.
//   mode          — "onboard" (default, three-step) | "edit" (skip to chosen tab)
//   initialTab    — when mode="edit": "name" | "wake" | "commands"
// ============================================================================

import React, { useEffect, useState } from "react";

const T = {
  bg: "#0f0f0f", surface: "#1a1a1a", surfaceHigh: "#242424",
  border: "#2a2a2a", amber: "#f59e0b", amberDim: "#92400e",
  green: "#10b981", red: "#ef4444", blue: "#3b82f6",
  muted: "#6b7280", text: "#e5e5e5", textDim: "#9ca3af",
  font: "'DM Mono','Courier New',monospace",
};

const VOICE_OPTIONS = [
  { id: "british_female", label: "British, female" },
  { id: "british_male",   label: "British, male" },
  { id: "american_female",label: "American, female" },
  { id: "american_male",  label: "American, male" },
];

// Preset commands — shown if no `tools` prop is provided, or as quick-adds.
// action_tool names should match your existing TOOLS in App.jsx.
const PRESET_COMMANDS = [
  { phrase: "book a new job",    tool_name: "create_job_card", mode: "fast",  intent: "Create a new job card." },
  { phrase: "log my mileage",    tool_name: "log_mileage",     mode: "fast",  intent: "Log a mileage entry for today." },
  { phrase: "show my money",     tool_name: "list_invoices",   mode: "fast",  intent: "Show invoices that aren't paid yet." },
  { phrase: "what do I owe",     tool_name: null,              mode: "smart", intent: "Show all unpaid subcontractor payments and unpaid materials." },
  { phrase: "quote time",        tool_name: "create_quote",    mode: "fast",  intent: "Start a new quote." },
  { phrase: "sort my inbox",     tool_name: null,              mode: "smart", intent: "Go through new enquiries and suggest what to do with each." },
];

const PERSONA_PRESETS = [
  { id: "friendly",     label: "Friendly",     description: "Warm and chatty, a mate who gets things done." },
  { id: "professional", label: "Professional", description: "Courteous and efficient, no messing about." },
  { id: "dry",          label: "Dry",          description: "Deadpan and quick. Says what needs saying." },
  { id: "custom",       label: "Custom",       description: "Write your own — tell the AI how to behave." },
];

export default function AssistantSetup({
  open = false, onClose = () => {},
  supabase, user,
  tools = null,
  onSaved = () => {},
  mode = "onboard",
  initialTab = "name",
}) {
  const [step, setStep] = useState(mode === "edit" ? initialTab : "name");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Persona state
  const [name, setName] = useState("Trade PA");
  const [wakeWords, setWakeWords] = useState(["hey trade pa", "trade pa"]);
  const [newWake, setNewWake] = useState("");
  const [personaType, setPersonaType] = useState("friendly");
  const [customPersona, setCustomPersona] = useState("");
  const [voice, setVoice] = useState("british_female");
  const [signoff, setSignoff] = useState("");

  // Commands state
  const [commands, setCommands] = useState([]); // loaded from DB when editing
  const [editingIdx, setEditingIdx] = useState(null);
  const [draft, setDraft] = useState(newDraft());

  // Load existing settings when opening
  useEffect(() => {
    if (!open || !supabase || !user?.id) return;
    (async () => {
      const { data: settings } = await supabase
        .from("user_settings")
        .select("assistant_name, assistant_wake_words, assistant_persona, assistant_voice, assistant_signoff")
        .eq("user_id", user.id)
        .maybeSingle();
      if (settings) {
        if (settings.assistant_name) setName(settings.assistant_name);
        if (settings.assistant_wake_words?.length) setWakeWords(settings.assistant_wake_words);
        if (settings.assistant_voice) setVoice(settings.assistant_voice);
        if (settings.assistant_signoff) setSignoff(settings.assistant_signoff);
        if (settings.assistant_persona) {
          const matchPreset = PERSONA_PRESETS.find(p => p.id !== "custom" && settings.assistant_persona.startsWith(p.label));
          if (matchPreset) setPersonaType(matchPreset.id);
          else { setPersonaType("custom"); setCustomPersona(settings.assistant_persona); }
        }
      }
      const { data: cmds } = await supabase
        .from("user_commands")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (cmds) setCommands(cmds);
    })();
  }, [open, supabase, user?.id]);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  function newDraft() {
    return { phrase: "", mode: "fast", tool_name: "", intent: "", default_params_text: "{}" };
  }

  const resolveWakeWords = () => {
    const lowered = wakeWords.map(w => w.trim().toLowerCase()).filter(Boolean);
    // Always include a "hey <name>" fallback if name isn't default and user didn't add one
    const heyName = `hey ${name.trim().toLowerCase()}`;
    if (name.trim() && name.trim().toLowerCase() !== "trade pa" && !lowered.includes(heyName)) {
      lowered.push(heyName);
    }
    return Array.from(new Set(lowered));
  };

  const personaString = () => {
    if (personaType === "custom") return customPersona.trim() || "Friendly and efficient.";
    const preset = PERSONA_PRESETS.find(p => p.id === personaType);
    return `${preset.label}. ${preset.description}`;
  };

  // ── Save all ─────────────────────────────────────────────────────────────
  const saveAll = async () => {
    setError(""); setSaving(true);
    try {
      const finalWakes = resolveWakeWords();
      const { error: upErr } = await supabase
        .from("user_settings")
        .upsert({
          user_id: user.id,
          assistant_name: name.trim() || "Trade PA",
          assistant_wake_words: finalWakes,
          assistant_persona: personaString(),
          assistant_voice: voice,
          assistant_signoff: signoff.trim() || null,
        }, { onConflict: "user_id" });
      if (upErr) throw upErr;

      onSaved({
        assistant_name: name.trim() || "Trade PA",
        assistant_wake_words: finalWakes,
        assistant_persona: personaString(),
        assistant_voice: voice,
        assistant_signoff: signoff.trim() || null,
      });
      onClose();
    } catch (e) {
      setError(e.message || "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Command CRUD ─────────────────────────────────────────────────────────
  const addCommand = async () => {
    setError("");
    if (!draft.phrase.trim()) return setError("Give the command a phrase.");
    if (draft.mode === "fast" && !draft.tool_name) return setError("Pick an action for this command.");
    if (draft.mode === "smart" && !draft.intent.trim()) return setError("Describe what the AI should do.");
    let parsedParams = {};
    if (draft.mode === "fast" && draft.default_params_text.trim()) {
      try { parsedParams = JSON.parse(draft.default_params_text); }
      catch { return setError("Default values must be valid JSON (or leave empty)."); }
    }
    const payload = {
      user_id: user.id,
      phrase: draft.phrase.trim(),
      mode: draft.mode,
      tool_name: draft.mode === "fast" ? draft.tool_name : null,
      default_params: parsedParams,
      intent: draft.intent.trim() || null,
      enabled: true,
    };
    if (editingIdx !== null) {
      const existing = commands[editingIdx];
      const { data, error: err } = await supabase
        .from("user_commands").update(payload).eq("id", existing.id).select().single();
      if (err) return setError(err.message);
      setCommands(cs => cs.map((c, i) => i === editingIdx ? data : c));
    } else {
      const { data, error: err } = await supabase
        .from("user_commands").insert(payload).select().single();
      if (err) return setError(err.message);
      setCommands(cs => [...cs, data]);
    }
    setDraft(newDraft());
    setEditingIdx(null);
  };

  const deleteCommand = async (idx) => {
    const c = commands[idx];
    if (!confirm(`Delete "${c.phrase}"?`)) return;
    await supabase.from("user_commands").delete().eq("id", c.id);
    setCommands(cs => cs.filter((_, i) => i !== idx));
  };

  const toggleCommand = async (idx) => {
    const c = commands[idx];
    const next = !c.enabled;
    await supabase.from("user_commands").update({ enabled: next }).eq("id", c.id);
    setCommands(cs => cs.map((x, i) => i === idx ? { ...x, enabled: next } : x));
  };

  const loadPreset = (preset) => {
    setDraft({
      phrase: preset.phrase,
      mode: preset.mode,
      tool_name: preset.tool_name || "",
      intent: preset.intent || "",
      default_params_text: "{}",
    });
    setEditingIdx(null);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const availableTools = tools || [];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "#000d",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        zIndex: 450, padding: 16,
        paddingTop: "max(52px, env(safe-area-inset-top, 52px))",
        overflowY: "auto", fontFamily: T.font,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 12, width: "100%", maxWidth: 560,
          maxHeight: "calc(100vh - 80px)",
          display: "flex", flexDirection: "column",
          color: T.text, overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", borderBottom: `1px solid ${T.border}`,
          background: T.surfaceHigh, flexShrink: 0,
        }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: T.amber,
            letterSpacing: "0.08em", textTransform: "uppercase",
          }}>
            {mode === "edit" ? "Edit your assistant" : "Meet your assistant"}
          </div>
          <button onClick={onClose} aria-label="Close" style={{
            background: "transparent", border: "none", color: T.muted,
            cursor: "pointer", fontSize: 22, lineHeight: 1, padding: "0 4px",
          }}>×</button>
        </div>

        {/* Step tabs */}
        <div style={{
          display: "flex", gap: 2, padding: "8px 12px",
          borderBottom: `1px solid ${T.border}`, background: T.surface,
        }}>
          {[
            ["name", "1. Name"],
            ["wake", "2. Wake words"],
            ["commands", "3. Commands"],
          ].map(([id, label]) => (
            <button key={id} onClick={() => setStep(id)} style={{
              flex: 1, padding: "6px 8px", borderRadius: 6,
              border: "none", cursor: "pointer",
              background: step === id ? T.amber : "transparent",
              color: step === id ? "#000" : T.textDim,
              fontSize: 10, fontFamily: T.font,
              fontWeight: step === id ? 700 : 500,
              letterSpacing: "0.04em",
            }}>{label}</button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          {step === "name" && (
            <NameStep
              name={name} setName={setName}
              personaType={personaType} setPersonaType={setPersonaType}
              customPersona={customPersona} setCustomPersona={setCustomPersona}
              voice={voice} setVoice={setVoice}
              signoff={signoff} setSignoff={setSignoff}
            />
          )}
          {step === "wake" && (
            <WakeStep
              name={name}
              wakeWords={wakeWords} setWakeWords={setWakeWords}
              newWake={newWake} setNewWake={setNewWake}
            />
          )}
          {step === "commands" && (
            <CommandsStep
              commands={commands}
              draft={draft} setDraft={setDraft}
              editingIdx={editingIdx} setEditingIdx={setEditingIdx}
              addCommand={addCommand} deleteCommand={deleteCommand}
              toggleCommand={toggleCommand}
              loadPreset={loadPreset}
              availableTools={availableTools}
              newDraft={newDraft}
            />
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: "8px 16px", background: T.red + "18",
            borderTop: `1px solid ${T.red}44`, color: T.red,
            fontSize: 11, flexShrink: 0,
          }}>{error}</div>
        )}

        {/* Footer */}
        <div style={{
          padding: "12px 16px", borderTop: `1px solid ${T.border}`,
          background: T.surfaceHigh, display: "flex", justifyContent: "space-between",
          gap: 8, flexShrink: 0,
        }}>
          {mode === "onboard" && step !== "commands" ? (
            <>
              <button onClick={onClose} style={ghostBtn}>Skip for now</button>
              <button
                onClick={() => setStep(step === "name" ? "wake" : "commands")}
                style={primaryBtn}
              >Next →</button>
            </>
          ) : (
            <>
              <button onClick={onClose} style={ghostBtn}>Cancel</button>
              <button onClick={saveAll} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>
                {saving ? "Saving..." : "Save & close"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Step 1: Name + persona ─────────────────────────────────────────────────
function NameStep({ name, setName, personaType, setPersonaType, customPersona, setCustomPersona, voice, setVoice, signoff, setSignoff }) {
  return (
    <div style={{ padding: 18 }}>
      <SectionTitle>WHAT SHOULD IT CALL ITSELF?</SectionTitle>
      <p style={blurb}>Pick any name. "Hey [name]" becomes your wake phrase. It'll also refer to itself by this name in replies.</p>
      <input
        value={name} onChange={e => setName(e.target.value)}
        placeholder="e.g. Dave, PA, Sidekick"
        maxLength={30}
        style={inputStyle}
      />

      <SectionTitle style={{ marginTop: 22 }}>HOW SHOULD IT BEHAVE?</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
        {PERSONA_PRESETS.map(p => (
          <button
            key={p.id} onClick={() => setPersonaType(p.id)}
            style={{
              textAlign: "left", padding: 10,
              background: personaType === p.id ? T.amber + "18" : T.surfaceHigh,
              border: `1px solid ${personaType === p.id ? T.amber : T.border}`,
              borderRadius: 8, cursor: "pointer",
              color: T.text, fontFamily: T.font,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: personaType === p.id ? T.amber : T.text, marginBottom: 2 }}>{p.label}</div>
            <div style={{ fontSize: 10, color: T.textDim, lineHeight: 1.4 }}>{p.description}</div>
          </button>
        ))}
      </div>
      {personaType === "custom" && (
        <textarea
          value={customPersona} onChange={e => setCustomPersona(e.target.value)}
          placeholder="e.g. Talk like a dry Yorkshire foreman. Short answers. Call me boss."
          rows={3}
          style={{ ...inputStyle, marginTop: 10, resize: "vertical" }}
        />
      )}

      <SectionTitle style={{ marginTop: 22 }}>VOICE</SectionTitle>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {VOICE_OPTIONS.map(v => (
          <button key={v.id} onClick={() => setVoice(v.id)} style={pill(voice === v.id)}>
            {v.label}
          </button>
        ))}
      </div>

      <SectionTitle style={{ marginTop: 22 }}>SIGN-OFF (OPTIONAL)</SectionTitle>
      <p style={blurb}>A phrase it uses when ending hands-free mode. Blank for none.</p>
      <input
        value={signoff} onChange={e => setSignoff(e.target.value)}
        placeholder="e.g. Catch you later boss"
        maxLength={80}
        style={inputStyle}
      />
    </div>
  );
}

// ─── Step 2: Wake words ─────────────────────────────────────────────────────
function WakeStep({ name, wakeWords, setWakeWords, newWake, setNewWake }) {
  const heyName = `hey ${name.trim().toLowerCase()}`;
  const suggested = [`hey ${name.trim().toLowerCase()}`, name.trim().toLowerCase(), "oi", "you there"].filter(Boolean);

  const addWake = (w) => {
    const v = w.trim().toLowerCase();
    if (!v) return;
    if (wakeWords.map(x => x.toLowerCase()).includes(v)) return;
    setWakeWords(ws => [...ws, v]);
    setNewWake("");
  };
  const removeWake = (i) => setWakeWords(ws => ws.filter((_, j) => j !== i));

  return (
    <div style={{ padding: 18 }}>
      <SectionTitle>HOW DO YOU CALL IT?</SectionTitle>
      <p style={blurb}>
        In hands-free mode, these phrases wake the mic. "Hey {name}" is always available.
        Add anything else you might naturally say.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {wakeWords.map((w, i) => (
          <span key={i} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 10px", background: T.amber + "18",
            border: `1px solid ${T.amber}44`, borderRadius: 16,
            fontSize: 11, color: T.amber,
          }}>
            "{w}"
            <button onClick={() => removeWake(i)} style={{
              background: "transparent", border: "none", color: T.amber,
              cursor: "pointer", padding: 0, fontSize: 14, lineHeight: 1,
            }}>×</button>
          </span>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={newWake} onChange={e => setNewWake(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addWake(newWake); } }}
          placeholder="Type a wake word, hit enter"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button onClick={() => addWake(newWake)} style={primaryBtn}>+ Add</button>
      </div>

      <SectionTitle style={{ marginTop: 22 }}>QUICK ADDS</SectionTitle>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {suggested.map((s, i) => (
          <button key={i} onClick={() => addWake(s)} style={pill(false)}>+ "{s}"</button>
        ))}
      </div>
    </div>
  );
}

// ─── Step 3: Custom commands ────────────────────────────────────────────────
function CommandsStep({ commands, draft, setDraft, editingIdx, setEditingIdx, addCommand, deleteCommand, toggleCommand, loadPreset, availableTools, newDraft }) {
  return (
    <div style={{ padding: 18 }}>
      <SectionTitle>YOUR COMMANDS</SectionTitle>
      <p style={blurb}>
        Teach your assistant your own phrases. "Fast" runs a specific action instantly.
        "Smart" lets the AI figure it out from your description.
      </p>

      {/* Existing commands */}
      {commands.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          {commands.map((c, i) => (
            <div key={c.id} style={{
              background: T.surfaceHigh, border: `1px solid ${T.border}`,
              borderRadius: 8, padding: 10,
              opacity: c.enabled ? 1 : 0.5,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 2 }}>"{c.phrase}"</div>
                  <div style={{ fontSize: 10, color: T.textDim, lineHeight: 1.4 }}>
                    <span style={{ color: c.mode === "fast" ? T.green : T.blue, fontWeight: 700 }}>
                      {c.mode === "fast" ? "FAST" : "SMART"}
                    </span>
                    {" · "}
                    {c.mode === "fast" ? (c.tool_name || "(no tool)") : (c.intent || "(no description)")}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button onClick={() => toggleCommand(i)} style={miniBtn(c.enabled ? T.green : T.muted)}>
                    {c.enabled ? "ON" : "OFF"}
                  </button>
                  <button
                    onClick={() => {
                      setDraft({
                        phrase: c.phrase, mode: c.mode,
                        tool_name: c.tool_name || "",
                        intent: c.intent || "",
                        default_params_text: JSON.stringify(c.default_params || {}, null, 2),
                      });
                      setEditingIdx(i);
                    }}
                    style={miniBtn(T.amber)}
                  >EDIT</button>
                  <button onClick={() => deleteCommand(i)} style={miniBtn(T.red)}>×</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Draft form */}
      <div style={{
        background: T.surfaceHigh, border: `1px solid ${T.border}`,
        borderRadius: 8, padding: 12, marginBottom: 12,
      }}>
        <SectionTitle>{editingIdx !== null ? "EDIT COMMAND" : "ADD A COMMAND"}</SectionTitle>

        <label style={labelStyle}>THE PHRASE YOU'LL SAY</label>
        <input
          value={draft.phrase}
          onChange={e => setDraft(d => ({ ...d, phrase: e.target.value }))}
          placeholder="e.g. book Dave in, sort my day"
          style={inputStyle}
        />

        <label style={{ ...labelStyle, marginTop: 10 }}>MODE</label>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <button onClick={() => setDraft(d => ({ ...d, mode: "fast" }))} style={pill(draft.mode === "fast")}>
            ⚡ Fast
          </button>
          <button onClick={() => setDraft(d => ({ ...d, mode: "smart" }))} style={pill(draft.mode === "smart")}>
            🧠 Smart
          </button>
        </div>

        {draft.mode === "fast" ? (
          <>
            <label style={labelStyle}>ACTION</label>
            <select
              value={draft.tool_name}
              onChange={e => setDraft(d => ({ ...d, tool_name: e.target.value }))}
              style={inputStyle}
            >
              <option value="">— Pick an action —</option>
              {availableTools.length > 0 ? (
                availableTools.map(t => (
                  <option key={t.name} value={t.name}>
                    {t.name} — {(t.description || "").slice(0, 60)}
                  </option>
                ))
              ) : (
                [
                  "create_job_card", "create_job", "create_quote",
                  "add_material", "log_mileage", "log_labour",
                  "list_invoices", "list_jobs", "list_customers",
                  "add_customer", "add_note", "raise_po",
                ].map(t => <option key={t} value={t}>{t}</option>)
              )}
            </select>

            <label style={{ ...labelStyle, marginTop: 10 }}>DEFAULT VALUES (OPTIONAL, JSON)</label>
            <textarea
              value={draft.default_params_text}
              onChange={e => setDraft(d => ({ ...d, default_params_text: e.target.value }))}
              placeholder='{"customer": "Dave"}'
              rows={2}
              style={{ ...inputStyle, resize: "vertical", fontSize: 11 }}
            />
            <div style={{ fontSize: 10, color: T.textDim, marginTop: 4, lineHeight: 1.4 }}>
              Pre-filled values passed to the action. e.g. {`{"customer":"Dave"}`} so "book Dave in" always books Dave.
            </div>
          </>
        ) : (
          <>
            <label style={labelStyle}>WHAT SHOULD IT DO?</label>
            <textarea
              value={draft.intent}
              onChange={e => setDraft(d => ({ ...d, intent: e.target.value }))}
              placeholder="e.g. Show me everything unpaid — subs and materials. Total up what I owe."
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <div style={{ fontSize: 10, color: T.textDim, marginTop: 4, lineHeight: 1.4 }}>
              The AI reads your phrase + this description and works out what to do. Slower than Fast, but more flexible.
            </div>
          </>
        )}

        <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
          <button onClick={addCommand} style={{ ...primaryBtn, flex: 1 }}>
            {editingIdx !== null ? "Save changes" : "+ Add command"}
          </button>
          {editingIdx !== null && (
            <button onClick={() => { setDraft(newDraft()); setEditingIdx(null); }} style={ghostBtn}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Presets */}
      <SectionTitle>QUICK-ADD IDEAS</SectionTitle>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {PRESET_COMMANDS.map((p, i) => (
          <button key={i} onClick={() => loadPreset(p)} style={pill(false)}>
            + "{p.phrase}"
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Shared bits ────────────────────────────────────────────────────────────
const SectionTitle = ({ children, style = {} }) => (
  <div style={{
    fontSize: 10, color: T.muted, fontWeight: 700,
    letterSpacing: "0.1em", marginBottom: 8, ...style,
  }}>{children}</div>
);

const blurb = { fontSize: 12, color: T.textDim, lineHeight: 1.5, marginBottom: 10 };
const inputStyle = {
  width: "100%", boxSizing: "border-box",
  background: T.bg, border: `1px solid ${T.border}`,
  borderRadius: 6, padding: "10px 12px",
  color: T.text, fontSize: 13, fontFamily: T.font, outline: "none",
};
const labelStyle = {
  fontSize: 10, color: T.muted, letterSpacing: "0.06em",
  textTransform: "uppercase", marginBottom: 4, display: "block",
};
const primaryBtn = {
  padding: "8px 14px", borderRadius: 6, border: "none",
  background: T.amber, color: "#000",
  fontSize: 11, fontFamily: T.font, fontWeight: 700,
  letterSpacing: "0.04em", cursor: "pointer",
};
const ghostBtn = {
  padding: "8px 14px", borderRadius: 6,
  border: `1px solid ${T.border}`, background: T.surfaceHigh,
  color: T.text, fontSize: 11, fontFamily: T.font, fontWeight: 600,
  letterSpacing: "0.04em", cursor: "pointer",
};
const pill = (active) => ({
  flexShrink: 0, padding: "4px 10px", borderRadius: 16,
  border: `1px solid ${active ? T.amber : T.border}`,
  background: active ? T.amber : "transparent",
  color: active ? "#000" : T.muted,
  fontSize: 10, fontFamily: T.font,
  fontWeight: active ? 700 : 500,
  cursor: "pointer", letterSpacing: "0.04em",
});
const miniBtn = (color) => ({
  padding: "3px 8px", borderRadius: 4,
  border: `1px solid ${color}44`, background: color + "18",
  color, fontSize: 10, fontFamily: T.font, fontWeight: 700,
  cursor: "pointer", letterSpacing: "0.04em",
});
