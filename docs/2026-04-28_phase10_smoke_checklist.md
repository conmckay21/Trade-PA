# Phase 10 Smoke Test Checklist — AIAssistant Extraction
**Created:** 28 April 2026 (during P0 setup)
**Used by:** end of Phase 10, before commit + push
**Time budget:** ~25-30 minutes — accept the cost; this phase is the highest-risk in the refactor

---

## Why this exists

The plan's one-line P10 smoke ("voice-in → AI replies → tool fires → widget renders → hands-free toggles") is too thin for a 7,852-line component with 30+ closure-captured props, 23 tool execution paths, streaming SSE, two STT providers, three TTS providers, and a multi-state hands-free machine. Drafted now in P0 so it's not designed under fatigue at hour 11.

**Rule:** if any item below fails or feels different, **do not commit P10**. Revert and investigate.

---

## Pre-checks (do these first — 2 min)

- [ ] Confirm `pa_error_log` is still at 0 hits since P0 baseline (or note any new entries from real users — those aren't refactor-caused if timestamped before the P10 deploy)
- [ ] Confirm `usage_events` shows continued activity through P9 (no silent breakage upstream)
- [ ] Open browser devtools → Network + Console panes open. Keep them open through every test below.
- [ ] Hard refresh (Cmd+Shift+R) so you're on the freshly-deployed bundle

---

## A. Initial mount + state preservation (3 min)

- [ ] Open AI Assistant → render is identical to baseline (header, suggestions, input box, mic button)
- [ ] Type a non-tool message: "hello" → response streams in, completes cleanly
- [ ] Switch to Jobs tab → switch back to Assistant → **previous conversation still visible** (always-mounted preservation working)
- [ ] No console warnings about missing props, undefined refs, or React key collisions

---

## B. Streaming SSE (4 min)

- [ ] Send a message that requires a multi-sentence reply: "give me a summary of what you can help me with" → text **streams** in (not all at once at the end)
- [ ] Streaming placeholder appears in chat **before** content arrives
- [ ] Send a message that triggers a tool call: "show me my schedule for this week" → tool fires, widget renders, **no duplicate "..." placeholder left behind**
- [ ] **`end_turn` empty content path:** send a one-word "ok" — should not error, should silently complete the turn (no "An error occurred" toast)

---

## C. STT cascade (3 min)

- [ ] Tap mic → speak: "what's my next job" → transcribed accurately
- [ ] Open Network tab → confirm request hit `/api/transcribe` and response JSON includes `"provider"` field
- [ ] Note which provider answered — should be Grok by default. If Deepgram or Whisper, that's still fine (cascade working) but note it
- [ ] **UK number formatting:** speak "log mileage of one thousand two hundred and forty pounds" → Grok ITN should produce "£1,240" or "1240" — not "one thousand two hundred and forty"

---

## D. TTS cascade + audio reset (5 min)

- [ ] Send any message that gets a TTS reply → **audio plays from first message** (no silent first-message bug — the historical `audio.volume=1.0` reset path)
- [ ] Confirm voice = Eve (Grok) for first attempt — has a distinct quality vs Aura/WebSpeech
- [ ] Mid-reply, switch to Jobs tab → reply continues playing (always-mounted)
- [ ] Switch back to Assistant → controls still responsive
- [ ] **Force fallback test:** in DevTools Network, block `api.x.ai` requests → send a message → should fall back to Deepgram Aura (still British-sounding) without error
- [ ] Unblock x.ai → next message returns to Eve

---

## E. Tool execution paths (4 min)

Pick **3 of these 5** to actually execute, the rest just verify they appear in the tool list:

- [ ] `create_invoice` — "create an invoice for John Smith for £450 for the kitchen rewire" → invoice modal opens with fields populated, save persists to DB, invoice appears in list
- [ ] `create_job_card` — "add a job card for tomorrow at the Brown's house, electrical fault" → job_card row created, `jobsRefreshKey` increments, jobs view shows it
- [ ] `log_mileage` — "log 47 miles to the merchants today" → mileage_logs row created
- [ ] `set_reminder` — "remind me to chase John on Friday morning" → reminders row created with proper related_type/related_id population
- [ ] `convert_quote_to_invoice` — needs an existing quote — pick an existing one and try

For each one executed: confirm Supabase row exists with correct user_id, then auto-navigate fired to the relevant tab.

---

## F. Hands-free state machine (5 min)

The historically finicky path — give this the most time.

- [ ] Tap mic → say "hey trade pa" — wake word triggers (or just tap-to-start if wake disabled)
- [ ] Hands-free indicator transitions through: idle → listening → transcribing → thinking → speaking → back to listening
- [ ] **Silence detection:** stop speaking mid-thought → 2.5s after last word, mic auto-stops, transcription submits (1.5s grace inside that window)
- [ ] **Closing phrase:** say "that's everything thanks" → mic loop ends, but **wake word listener stays active** (verify by saying "hey trade pa" again — it picks up)
- [ ] **Tab switch during hands-free:** switch tabs mid-session → return → state machine still coherent (not stuck on "listening" from before)
- [ ] **Quick action button** while in hands-free → still triggers correctly without breaking loop
- [ ] End hands-free explicitly → `voice_session.handsfree_ended` event lands in `usage_events`

---

## G. Widget rendering + spoken summary (3 min)

- [ ] "Show me my unpaid invoices" → widget renders with rows, **`buildSpokenSummary` reads count + total aloud** (not the widget JSON)
- [ ] "What's on this week's schedule" → schedule widget renders, spoken summary makes sense
- [ ] Try one more widget type from this list: materials, expenses, purchase orders, reminders, stock
- [ ] **TTS prefers Claude text over widget summary when reply >30 chars** — verify by sending "summarise my open jobs in two sentences" — it should speak Claude's text, not the widget shorthand

---

## H. Sonnet vs Haiku routing (2 min)

- [ ] Simple query: "what time is it" → routes to Haiku (check `usage_events.event_type='model_route'` row inserted with `event_name='simple'`)
- [ ] Complex query: "given my last three invoices and current schedule, suggest who I should chase first" → routes to Sonnet (`event_name='complex'`)
- [ ] No errors, both reply correctly

---

## I. RAMS multi-step (3 min) — known finicky

- [ ] Trigger RAMS flow: "create a RAMS for tomorrow's roofing job" → starts multi-turn collection
- [ ] Provide hazards turn-by-turn — state persists between AI turns
- [ ] Mid-flow, switch tabs → return → flow state intact
- [ ] Complete the RAMS → document persists in `rams_documents` table

---

## J. Final integrity check (1 min)

- [ ] Sentry frontend dashboard: no new error events in the last 30 min
- [ ] Supabase: `SELECT COUNT(*) FROM pa_error_log WHERE occurred_at > [P10 deploy time]` = 0
- [ ] Bundle size for this deploy: within ±5% of P0 baseline (1,927 kB / 491 kB gzip)
- [ ] Hot reload still works in dev (run `npm run dev`, edit `ai/AIAssistant.jsx`, save → HMR fires)

---

## Failure modes to watch for specifically

These are the patterns most likely to surface in P10 — recognise them fast:

| Symptom | Likely cause | Fix direction |
|---|---|---|
| Audio plays only after first user reply gap | `audio.volume=1.0` reset path lost during extraction | Re-thread the volume reset call, check it runs before every `speak()` |
| TTS audio silent entirely | speak()/speakWebSpeech import broken or hook order changed | Check imports, verify `useWhisper` declared before any audio function |
| Tool fires but no DB row | Supabase client closure-captured incorrectly during extraction | Confirm `supabase` import resolves to the same instance (not a re-init) |
| Hands-free stuck on "listening" | State machine refs lost across re-render | Check refs declared at component top, verify cleanup in useEffect |
| `end_turn` empty content shows error | Streaming completion path lost the silent-success branch | Re-add the empty content guard |
| Wake word stops listening after closing phrase | Wake word listener and mic loop coupled in extracted version | They should be independent — wake listener stays running |
| Widget renders but spoken summary is JSON | `buildSpokenSummary` not imported or wired to TTS path | Confirm the helper is called between tool result and TTS request |
| Conversation state lost on tab switch | Always-mounted lost during extraction (back to conditional render) | Verify the `display: none` pattern is preserved at the parent |

---

## If any item fails

1. **Do NOT commit Phase 10.**
2. `git diff main` → review what changed
3. `git restore .` to discard, OR `git stash` to keep for inspection
4. Note the symptom in the session log
5. Decision point: 5-min fix (try once) → re-test the failing item only. If still failing, defer P10 and ship P11 alone, then revisit P10 fresh.

---

*This checklist is intentionally long. P10 is the most expensive single thing we've ever shipped. 25 minutes of methodical testing here is cheaper than a regression-induced rollback the next morning.*
