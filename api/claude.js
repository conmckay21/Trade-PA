// api/claude.js
// Server-side proxy for all Claude API calls
// Keeps ANTHROPIC_API_KEY off the client — never in browser bundle
// All AI features in Trade PA route through here

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY; // NO VITE_ prefix — server only
  if (!apiKey) return res.status(500).json({ error: 'AI service not configured' });

  try {
    const { model, max_tokens, messages, system, tools, mcp_servers } = req.body;

    const body = {
      model: model || 'claude-sonnet-4-6',
      max_tokens: max_tokens || 1000,
      messages,
    };
    if (system) body.system = system;
    if (tools) body.tools = tools;
    if (mcp_servers) body.mcp_servers = mcp_servers;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
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
