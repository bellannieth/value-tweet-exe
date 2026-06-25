

exports.handler = async function(event, context) {
  try {
    const proxyKey = process.env.PROXY_KEY;
    if (proxyKey) {
      const provided = (event.headers && (event.headers['x-proxy-key'] || event.headers['x-proxykey']));
      if (!provided || provided !== proxyKey) return { statusCode: 401, body: JSON.stringify({ error: 'missing or invalid proxy key' }) };
    }
    // Polymarket's public Gamma API. Order by liquidity (desc) and exclude
    // closed markets; fall back to a plain active-markets query.
    const endpoints = [
      'https://gamma-api.polymarket.com/markets?active=true&closed=false&order=liquidity&ascending=false&limit=20',
      'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=20',
    ];
    for (const url of endpoints) {
      try {
        const r = await fetch(url);
        if (!r.ok) continue;
        const j = await r.json();
        const items = Array.isArray(j) ? j : j.markets || j.data || j.results || [];
        const candidate = items.find((m) => m && !m.resolved && (m.liquidity || m.totalLiquidity || m.volume));
        if (candidate) {
          return { statusCode: 200, body: JSON.stringify({ markets: items }) };
        }
      } catch (e) {}
    }
    return { statusCode: 502, body: JSON.stringify({ error: 'no market data from upstream' }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: String(e) }) };
  }
};
