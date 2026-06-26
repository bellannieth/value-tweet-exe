export default async function handler(req, res) {
  const category = (req.query.category || 'politics').toLowerCase();

  const tagMap = {
    politics: ['politics', 'us-politics', 'elections', 'election', 'government', 'congress', 'trump', 'biden'],
    sports:   ['sports', 'nba', 'nfl', 'soccer', 'football', 'baseball', 'mlb', 'nhl', 'cricket', 'tennis', 'ufc', 'boxing'],
  };
  const tags = tagMap[category] || tagMap.politics;

  try {
    const url = 'https://gamma-api.polymarket.com/markets?limit=40&active=true&closed=false&order=volumeNum&ascending=false';
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) throw new Error('gamma api ' + r.status);

    const items = await r.json();
    const list = Array.isArray(items) ? items : (items.data || items.markets || []);

    const matches = list.filter((m) => {
      if (m.closed || m.active === false) return false;
      const t = (m.tags || []).map((x) => (typeof x === 'string' ? x : (x.label || x.slug || '')).toLowerCase());
      const title = (m.question || m.title || '').toLowerCase();
      return tags.some((tag) => t.includes(tag) || title.includes(tag));
    });

    const pool = matches.length ? matches : list;
    const top = pool
      .sort((a, b) => (parseFloat(b.volumeNum) || 0) - (parseFloat(a.volumeNum) || 0))
      .slice(0, 6)
      .map((m) => ({
        id: m.id,
        title: m.question || m.title,
        slug: m.slug,
        url: m.slug ? `https://polymarket.com/event/${m.slug}` : 'https://polymarket.com',
        liquidity: m.liquidityNum || m.liquidity || null,
        volume: m.volumeNum || m.volume || null,
      }));

    return res.status(200).json({ markets: top, category });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
