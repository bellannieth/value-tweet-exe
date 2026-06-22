import fetch from 'node-fetch';

export default async function handler(req, res) {
  const proxyKey = process.env.PROXY_KEY;
  if (proxyKey) {
    const provided = req.headers['x-proxy-key'] || req.headers['x-proxykey'];
    if (!provided || provided !== proxyKey) return res.status(401).json({ error: 'missing or invalid proxy key' });
  }
  try {
    // primary candidate
    const endpoints = [
      'https://polymarket.com/api/markets?limit=10&sort=liquidity_desc',
      'https://polymarket.com/api/markets?limit=10',
      'https://api.polymarket.com/markets?limit=10&sort=liquidity:desc',
    ];
    for (const url of endpoints) {
      try {
        const r = await fetch(url);
        if (!r.ok) continue;
        const j = await r.json();
        // normalize
        const items = Array.isArray(j) ? j : j.markets || j.data || j.results || [];
        const candidate = items.find((m) => m && !m.resolved && (m.liquidity || m.totalLiquidity || m.volume));
        if (candidate) {
          return res.status(200).json({ markets: items });
        }
      } catch (e) {
        // try next
      }
    }
    return res.status(502).json({ error: 'no market data from upstream' });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
