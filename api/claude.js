// api/claude.js
// Server-side proxy for all Claude API calls.
// Keeps ANTHROPIC_API_KEY off the client — never in browser bundle.
// All AI features in Trade PA route through here.
//
// ENFORCEMENT LAYER:
// - Requires Authorization: Bearer <Supabase access token>
// - Rate-limits every call via check_rate_limit RPC (30/min, 300/hr, 1000/day)
// - Checks monthly allowance via check_usage_allowance RPC (unless background:true)
// - background:true skips the conversation allowance check (for Haiku memory extraction)
//   but still requires auth and hits rate limits.
// - Does NOT increment usage counters — the client already does that via increment_usage RPC.
//   Adding server-side increment here would cause double-counting.
//
// STREAMING (added 20 Apr 2026 — Phase 2 Stage 1):
// - Request body { stream: true } → response is text/event-stream (SSE) forwarding
//   Anthropic's native streaming format verbatim. Events: message_start,
//   content_block_start, content_block_delta, content_block_stop, message_delta,
//   message_stop, plus a custom 'error' event on mid-stream failure.
// - Request body WITHOUT stream flag → response is JSON (legacy behaviour unchanged).
//   Background Haiku extraction and other non-voice callers keep working as-is.
// - Enforcement (auth/rate/allowance) runs BEFORE streaming begins. Rejections are
//   always a normal JSON error response with the right status — never half-streamed.

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function getUserIdFromRequest(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch { return null; }
}

// Exempt accounts — match the list in App.jsx so your own testing isn't blocked
const EXEMPT_EMAILS = new Set([
  'thetradepa@gmail.com',
  'connor_mckay777@hotmail.com',
  'connor_mckay777@hotmail.co.uk',
  'landbheating@outlook.com',
  'shannonandrewsimpson@gmail.com',
]);

async function isExemptUser(userId) {
  if (!userId) return false;
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = data?.user?.email?.toLowerCase();
    return email ? EXEMPT_EMAILS.has(email) : false;
  } catch { return false; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI service not configured' });

  // ─── ENFORCEMENT ────────────────────────────────────────────────────────
  // Runs BEFORE any streaming begins. If we reject here, it's always a clean
  // JSON error response — we never half-open an SSE stream and then fail.
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ error: 'unauthorised', message: 'Valid auth token required.' });
  }

  const isBackground = req.body?.background === true;
  const isStreaming = req.body?.stream === true;
  const exempt = await isExemptUser(userId);

  if (!exempt) {
    // 1. Rate limit (applies to everyone — catches script abuse even on background calls)
    try {
      const { data: rate, error: rateErr } = await supabaseAdmin.rpc('check_rate_limit', {
        user_uuid: userId,
        metric_name: 'conversations'
      });
      if (rateErr) {
        console.error('[claude] rate check failed:', rateErr);
        // Fail-open on rate-check infra errors — don't block real users because of a DB blip
      } else if (rate && !rate.allowed) {
        if (rate.retry_after_seconds) {
          res.setHeader('Retry-After', String(rate.retry_after_seconds));
        }
        const statusCode = rate.reason === 'account_locked' ? 403
                        : rate.reason === 'no_subscription' ? 402
                        : 429;
        return res.status(statusCode).json({
          error: rate.reason,
          message: rate.reason === 'rate_limit_minute' ? 'Too many requests. Slow down.'
                 : rate.reason === 'rate_limit_hour' ? 'Hourly rate limit reached. Try again shortly.'
                 : rate.reason === 'rate_limit_day' ? 'Daily rate limit reached. Resets tomorrow.'
                 : rate.reason === 'account_locked' ? 'Account access suspended. Contact support.'
                 : 'No active subscription.',
          ...rate
        });
      }
    } catch (e) {
      console.error('[claude] rate check threw:', e);
      // Fail-open
    }

    // 2. Monthly allowance (skip for background calls)
    if (!isBackground) {
      try {
        const { data: allow, error: allowErr } = await supabaseAdmin.rpc('check_usage_allowance', {
          user_uuid: userId,
          metric_name: 'conversations'
        });
        if (allowErr) {
          console.error('[claude] allowance check failed:', allowErr);
          // Fail-open on infra errors
        } else if (allow && !allow.allowed) {
          const statusCode = allow.error === 'account_locked' ? 403
                          : allow.error === 'no_subscription' ? 402
                          : 402;
          return res.status(statusCode).json({
            error: allow.error || 'limit_reached',
            message: allow.error === 'account_locked' ? 'Account access suspended. Contact support.'
                   : allow.error === 'no_subscription' ? 'No active subscription.'
                   : 'You have reached your monthly limit.',
            ...allow
          });
        }
      } catch (e) {
        console.error('[claude] allowance check threw:', e);
        // Fail-open
      }
    }
  }
  // ────────────────────────────────────────────────────────────────────────

  try {
    const { model, max_tokens, messages, system, tools, mcp_servers } = req.body;

    // Build the Anthropic API body — identical for streaming and non-streaming
    const body = {
      model: model || 'claude-sonnet-4-6',
      max_tokens: max_tokens || 1000,
      messages,
    };

    // Prompt caching — supports two shapes for `system`:
    //   (a) Legacy / simple: a plain string. We wrap the whole thing in one
    //       cache block. Only useful if the full string is stable call-to-call.
    //   (b) Recommended: an array of text blocks sent straight from the client,
    //       with the client deciding which blocks are stable (cacheable) and
    //       which are volatile (per-call data). We pass it through verbatim
    //       after stamping cache_control on any block the client marked cached.
    //
    // For (b) the client sends objects of shape:
    //   { type: 'text', text: '...', cache: true }   ← we convert `cache:true`
    //                                                   to cache_control:ephemeral
    //   { type: 'text', text: '...' }                ← volatile, not cached
    if (system) {
      if (typeof system === 'string') {
        body.system = [
          { type: 'text', text: system, cache_control: { type: 'ephemeral' } },
        ];
      } else if (Array.isArray(system)) {
        body.system = system
          .filter((b) => b && (typeof b.text === 'string') && b.text.length > 0)
          .map((b) => {
            const out = { type: 'text', text: b.text };
            if (b.cache === true || b.cache_control) {
              out.cache_control = b.cache_control || { type: 'ephemeral' };
            }
            return out;
          });
      }
    }

    if (tools) {
      // Mark the last tool as the cache boundary — everything up to and
      // including it gets cached. Tools never change between requests so
      // this cache will almost always hit.
      const cachedTools = tools.map((tool, idx) =>
        idx === tools.length - 1
          ? { ...tool, cache_control: { type: 'ephemeral' } }
          : tool
      );
      body.tools = cachedTools;
    }

    if (mcp_servers) body.mcp_servers = mcp_servers;

    // Tell Anthropic we want streaming when the client asked for it
    if (isStreaming) body.stream = true;

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify(body),
    });

    // ─── NON-STREAMING PATH (unchanged) ──────────────────────────────────
    if (!isStreaming) {
      const data = await upstream.json();
      if (!upstream.ok) {
        console.error('Claude API error:', data);
        return res.status(upstream.status).json({ error: data.error?.message || 'AI request failed' });
      }
      return res.status(200).json(data);
    }

    // ─── STREAMING PATH (new) ────────────────────────────────────────────
    // If Anthropic itself errored before streaming started, we get a JSON
    // error body here (not an SSE stream). Surface it cleanly to the client.
    if (!upstream.ok) {
      let errPayload = null;
      try { errPayload = await upstream.json(); } catch {}
      console.error('Claude streaming init error:', upstream.status, errPayload);
      return res.status(upstream.status).json({
        error: errPayload?.error?.message || 'AI request failed',
        status: upstream.status,
      });
    }

    // Set up SSE response headers. Once we write even a single byte below,
    // status and headers are committed — so all error-check paths above this
    // line must have already run successfully.
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    // Disable Vercel's response buffering for true streaming
    res.setHeader('X-Accel-Buffering', 'no');
    // Flush headers immediately so the client can start receiving
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    // Pipe Anthropic's raw SSE body straight through to our client.
    // Their body is already formatted as Server-Sent Events — we just forward
    // bytes. No parse/re-serialise needed, which keeps us forwards-compatible
    // with any new event types Anthropic adds.
    try {
      const reader = upstream.body.getReader();
      // Client aborts (e.g. user interrupts a reply mid-stream) should stop us
      // reading from Anthropic so we don't keep burning their quota.
      let clientAborted = false;
      req.on('close', () => {
        clientAborted = true;
        try { reader.cancel(); } catch {}
      });

      while (!clientAborted) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && value.length) {
          // Write raw bytes — Node res.write handles Uint8Array natively.
          // If a previous write failed (client disconnected), res.write returns false
          // but doesn't throw; the 'close' handler above will break us out shortly.
          res.write(Buffer.from(value));
        }
      }
      res.end();
    } catch (streamErr) {
      // Mid-stream error — we can't set headers anymore, so emit a custom
      // SSE 'error' event and close the connection cleanly. The client should
      // listen for 'error' events and handle gracefully (e.g. fallback to
      // retrying as a non-streaming call, or show "connection lost").
      console.error('[claude] streaming pipe error:', streamErr);
      try {
        const errEvent = `event: error\ndata: ${JSON.stringify({ message: streamErr.message || 'stream interrupted' })}\n\n`;
        res.write(errEvent);
      } catch {}
      try { res.end(); } catch {}
    }
  } catch (err) {
    console.error('Claude proxy error:', err.message);
    // If headers haven't been sent yet we can still return a clean JSON error.
    // If they have (mid-stream), the streaming-path catch above handles it.
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message });
    }
  }
}
