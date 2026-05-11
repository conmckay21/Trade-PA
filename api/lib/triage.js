// api/lib/triage.js
//
// Shared support-ticket triage worker. Called from two places:
//   • api/support/submit.js — automatically, fire-and-forget after creation
//   • api/admin/triage-ticket.js — manually, when admin clicks "Re-analyse"
//
// Reads the ticket + first message + lightweight user context from Supabase,
// builds the prompt, calls the Anthropic API with tool_use to force strict
// JSON output, then upserts into support_ticket_triage. Service-role only —
// never invoked from the browser.
//
// Style matches api/claude.js: raw fetch (no SDK), anthropic-version + beta
// headers. Anthropic SDK in package.json is unused and not required here.
//
// Env vars required:
//   ANTHROPIC_API_KEY
//   VITE_SUPABASE_URL  (falls back to SUPABASE_URL)
//   SUPABASE_SERVICE_KEY  (falls back to SUPABASE_SERVICE_ROLE_KEY)

import { createClient } from "@supabase/supabase-js";

const MODEL = "claude-sonnet-4-6";

let _adminDb = null;
function adminDb() {
  if (!_adminDb) {
    _adminDb = createClient(
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return _adminDb;
}


// ---------- Public entry point ----------

/**
 * Triage a single support ticket. Idempotent — re-running overwrites the row.
 * Throws on failure (caller catches and logs to Sentry).
 *
 * @param {string} ticketId
 * @returns {Promise<object>} the saved triage row
 */
export async function triageTicket(ticketId) {
  if (!ticketId) throw new Error("triageTicket: ticketId required");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");

  const db = adminDb();

  // 1. Fetch the ticket + first message
  const { data: ticketRows, error: tErr } = await db
    .from("support_tickets")
    .select("id, user_id, user_email, subject, category, status, priority, created_at")
    .eq("id", ticketId)
    .limit(1);
  if (tErr) throw new Error(`load ticket: ${tErr.message}`);
  if (!ticketRows || ticketRows.length === 0) throw new Error("ticket not found");
  const ticket = ticketRows[0];

  const { data: msgs, error: mErr } = await db
    .from("support_messages")
    .select("sender, sender_email, body, created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (mErr) throw new Error(`load messages: ${mErr.message}`);
  if (!msgs || msgs.length === 0) throw new Error("no messages on ticket");

  // 2. User context — best-effort
  const userContext = await loadUserContext(ticket.user_id);

  // 3. Cross-pattern context if this looks suggestion-shaped
  let suggestionContext = [];
  if (ticket.category === "feature_request" || hintsAtSuggestion(msgs[0].body)) {
    const { data: ctx } = await db.rpc("triage_get_suggestion_context", {
      p_exclude_ticket_id: ticketId,
    });
    suggestionContext = ctx || [];
  }

  // 4. Call Anthropic — raw fetch matching api/claude.js style
  const userMessage = buildUserMessage(ticket, msgs, userContext, suggestionContext);

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "prompt-caching-2024-07-31",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools: [{ ...TRIAGE_TOOL, cache_control: { type: "ephemeral" } }],
      tool_choice: { type: "tool", name: "save_triage" },
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!upstream.ok) {
    const errBody = await upstream.text().catch(() => "<no body>");
    throw new Error(`Anthropic ${upstream.status}: ${errBody.slice(0, 500)}`);
  }
  const response = await upstream.json();

  const toolUse = (response.content || []).find(b => b.type === "tool_use");
  if (!toolUse) throw new Error("model returned no tool_use block");

  const t = toolUse.input || {};
  validateTriage(t);

  // 5. Upsert
  const row = {
    ticket_id:                    ticketId,
    kind:                         t.kind,
    severity_suggested:           t.severity_suggested,
    category_suggested:           t.category_suggested,
    summary_one_line:             t.summary_one_line,
    draft_reply:                  t.draft_reply,
    bug_diagnosis:                t.bug_diagnosis || null,
    suggestion_feasibility_score: t.suggestion_feasibility_score ?? null,
    suggestion_strength_score:    t.suggestion_strength_score ?? null,
    suggestion_recommendation:    t.suggestion_recommendation || null,
    related_ticket_ids:           Array.isArray(t.related_ticket_ids) ? t.related_ticket_ids : [],
    model_used:                   MODEL,
    prompt_tokens:                response.usage?.input_tokens ?? null,
    completion_tokens:            response.usage?.output_tokens ?? null,
    generated_at:                 new Date().toISOString(),
  };

  const { error: upErr } = await db
    .from("support_ticket_triage")
    .upsert(row, { onConflict: "ticket_id" });
  if (upErr) throw new Error(`save triage: ${upErr.message}`);

  return row;
}


// ---------- Prompt + tool ----------

const SYSTEM_PROMPT = `You are the triage assistant for Trade PA, a voice-first AI admin app for UK tradespeople (electricians, builders, plumbers, decorators, heating engineers, landscapers). Solo trader and small-team focus. UK English throughout. Stack: Vite+React, Supabase, Stripe, Anthropic Claude, voice AI (Grok STT/TTS).

Your job: read a support ticket and produce a structured triage. Always call the save_triage tool — never reply with plain text.

Rules:
- Decide kind from the message CONTENT, not the user's chosen category. Users mis-categorise: a "bug" that's actually a billing question, a "feature request" that's an account issue.
- Severity: 'urgent' for revenue-blocking (can't pay, lost money, can't sign in). 'high' for can't-use-a-core-feature. 'normal' for friction or recoverable issues. 'low' for cosmetic or preference.
- Draft replies: UK English, warm but professional. Address by first name if their email gives a clear one (john.smith@... → "Hi John"; otherwise "Hi there"). Acknowledge the issue, set expectation, give a clear next step. Sign off as "— Trade PA Support".
- For bugs: also fill bug_diagnosis — plain-English description of likely root cause + which feature/screen is affected. No code. Two or three sentences.
- For suggestions: be honest. A weak idea from a free-trial user is a weak idea. A repeated request from paying users is strong. Score 1–10 on feasibility (1=trivial for a solo founder, 10=major undertaking) and strength (1=weak signal, 10=clear winning idea). Use the provided suggestion-context as your cross-pattern evidence. Recommend build/defer/decline.
- For billing/account/other: leave bug and suggestion fields out. Just produce the draft reply.
- If suggestion_context is empty, judge strength on the merits of this single suggestion alone — don't infer strength from absent evidence.`;

const TRIAGE_TOOL = {
  name: "save_triage",
  description: "Submit your triage assessment of the support ticket.",
  input_schema: {
    type: "object",
    required: ["kind", "severity_suggested", "category_suggested", "summary_one_line", "draft_reply"],
    properties: {
      kind: {
        type: "string",
        enum: ["bug", "suggestion", "billing", "account", "other"],
        description: "The TRUE kind of ticket (your judgement, not necessarily the user's category).",
      },
      severity_suggested: {
        type: "string",
        enum: ["low", "normal", "high", "urgent"],
      },
      category_suggested: {
        type: "string",
        enum: ["billing", "bug", "feature_request", "account", "other"],
        description: "Validated user category (correct if mis-tagged).",
      },
      summary_one_line: {
        type: "string",
        description: "One concise sentence describing the actual underlying issue (not a paraphrase of the user's words).",
      },
      draft_reply: {
        type: "string",
        description: "Reply the admin can send back. UK English, warm, professional, signed '— Trade PA Support'.",
      },
      bug_diagnosis: {
        type: "string",
        description: "REQUIRED when kind=bug. Plain-English likely root cause + affected feature/screen. No code. 2–3 sentences.",
      },
      suggestion_feasibility_score: {
        type: "integer",
        minimum: 1,
        maximum: 10,
        description: "REQUIRED when kind=suggestion. 1=trivial for a solo founder on Vite+React+Supabase, 10=major undertaking.",
      },
      suggestion_strength_score: {
        type: "integer",
        minimum: 1,
        maximum: 10,
        description: "REQUIRED when kind=suggestion. 1=weak signal, 10=clear winning idea. Factor in suggestion_context cross-matches, user plan tier, and alignment with sole-trader UK tradies.",
      },
      suggestion_recommendation: {
        type: "string",
        enum: ["build", "defer", "decline"],
        description: "REQUIRED when kind=suggestion.",
      },
      related_ticket_ids: {
        type: "array",
        items: { type: "string" },
        description: "UUIDs from suggestion_context that touch the same topic, if any.",
      },
    },
  },
};


// ---------- Helpers ----------

async function loadUserContext(userId) {
  if (!userId) return null;
  const db = adminDb();

  const { data: subs } = await db
    .from("subscriptions")
    .select("plan, status, is_in_trial, trial_ends_at, current_period_end, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);
  const sub = subs?.[0] || null;

  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { count: toolCalls30d } = await db
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_type", "tool_call")
    .gte("created_at", since);

  const { data: authUser } = await db.auth.admin.getUserById(userId);
  const signupDate = authUser?.user?.created_at || null;

  return {
    plan: sub?.plan || null,
    sub_status: sub?.status || null,
    is_in_trial: sub?.is_in_trial || false,
    trial_ends_at: sub?.trial_ends_at || null,
    signup_date: signupDate,
    tool_calls_30d: toolCalls30d ?? 0,
  };
}

function hintsAtSuggestion(body) {
  if (!body) return false;
  return /\b(could you (add|make|build)|feature request|i would like|it would be|please add|suggestion|wish (it|you|the app))/i.test(body);
}

function buildUserMessage(ticket, msgs, userContext, suggestionContext) {
  const lines = [];
  lines.push("# Ticket");
  lines.push(`ID: ${ticket.id}`);
  lines.push(`Subject: ${ticket.subject}`);
  lines.push(`User category (may be wrong): ${ticket.category}`);
  lines.push(`User priority: ${ticket.priority}`);
  lines.push(`User email: ${ticket.user_email}`);
  lines.push("");
  lines.push("## Messages");
  for (const m of msgs) {
    lines.push(`[${m.sender} · ${m.sender_email} · ${m.created_at}]`);
    lines.push(m.body);
    lines.push("");
  }

  if (userContext) {
    lines.push("# User context");
    lines.push(`Plan: ${userContext.plan || "(none)"}  ·  Status: ${userContext.sub_status || "—"}  ·  In trial: ${userContext.is_in_trial}`);
    if (userContext.trial_ends_at) lines.push(`Trial ends: ${userContext.trial_ends_at}`);
    if (userContext.signup_date)   lines.push(`Signed up: ${userContext.signup_date}`);
    lines.push(`Tool calls last 30 days: ${userContext.tool_calls_30d}`);
    lines.push("");
  }

  lines.push("# Suggestion context");
  if (suggestionContext.length === 0) {
    lines.push("(No other suggestion tickets in the system yet — judge strength on this suggestion's merits alone.)");
  } else {
    lines.push(`The following are the ${suggestionContext.length} most recent OTHER feature_request tickets. Use them as cross-pattern evidence when scoring strength and listing related_ticket_ids.`);
    lines.push("");
    for (const s of suggestionContext) {
      lines.push(`---`);
      lines.push(`id: ${s.id}`);
      lines.push(`subject: ${s.subject}`);
      lines.push(`status: ${s.status}  ·  created: ${s.created_at}`);
      lines.push(`preview: ${s.preview || ""}`);
    }
  }

  lines.push("");
  lines.push("Now call the save_triage tool.");
  return lines.join("\n");
}

function validateTriage(t) {
  const kinds = ["bug", "suggestion", "billing", "account", "other"];
  const sevs  = ["low", "normal", "high", "urgent"];
  const cats  = ["billing", "bug", "feature_request", "account", "other"];
  const recs  = ["build", "defer", "decline"];
  if (!kinds.includes(t.kind)) throw new Error(`bad kind: ${t.kind}`);
  if (!sevs.includes(t.severity_suggested)) throw new Error(`bad severity: ${t.severity_suggested}`);
  if (!cats.includes(t.category_suggested)) throw new Error(`bad category: ${t.category_suggested}`);
  if (!t.summary_one_line || typeof t.summary_one_line !== "string") throw new Error("missing summary");
  if (!t.draft_reply || typeof t.draft_reply !== "string") throw new Error("missing draft_reply");
  if (t.kind === "suggestion") {
    if (typeof t.suggestion_feasibility_score !== "number") throw new Error("missing feasibility");
    if (typeof t.suggestion_strength_score !== "number") throw new Error("missing strength");
    if (!recs.includes(t.suggestion_recommendation)) throw new Error(`bad recommendation: ${t.suggestion_recommendation}`);
  }
}
