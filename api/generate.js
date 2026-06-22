import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const key = process.env.ANTHROPIC_API_KEY;
  const proxyKey = process.env.PROXY_KEY;
  // optional proxy key check
  if (proxyKey) {
    const provided = req.headers['x-proxy-key'] || req.headers['x-proxykey'];
    if (!provided || provided !== proxyKey) return res.status(401).json({ error: 'missing or invalid proxy key' });
  }
  if (!key) return res.status(500).json({ error: 'server missing ANTHROPIC_API_KEY' });
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
      },
      body: JSON.stringify(req.body),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
