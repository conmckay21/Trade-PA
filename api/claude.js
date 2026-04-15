// api/claude.js
// Server-side proxy for all Claude API calls
// Keeps ANTHROPIC_API_KEY off the client — never in browser bundle
// All AI features in Trade PA route through here
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI service not configured' });
  try {
    const { model, max_tokens, messages, system, tools, mcp_servers } = req.body;

    const body = {
      model: model || 'claude-sonnet-4-6',
      max_tokens: max_tokens || 1000,
      messages,
    };

    // Prompt caching — supports two shapes for `system`:
    //
    //   (a) Legacy / simple: a plain string. We wrap the whole thing in one
    //       cache block. Only useful if the full string is stable call-to-call.
    //
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
        // Shape (a): plain string. Single cache block, as before.
        body.system = [
          { type: 'text', text: system, cache_control: { type: 'ephemeral' } },
        ];
      } else if (Array.isArray(system)) {
        // Shape (b): structured array. Keep block order. Stamp cache_control
        // only on blocks the client flagged with `cache: true`. Strip the
        // `cache` helper flag before forwarding — Anthropic won't accept it.
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

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Claude API error:', data);
      return res.status(response.status).json({ error: data.error?.message || 'AI request failed' });
    }
    return res.status(200).json(data);
  } catch (err) {
    console.error('Claude proxy error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
