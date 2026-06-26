// pulls trending politics/sports events from Polymarket's Gamma API
// and extracts the live probability for each.

function eventSignal(e) {
  const markets = e.markets || [];
  const scored = markets.map((mk) => {
    let yes = null;
    try {
      let prices = mk.outcomePrices;
      if (typeof prices === 'string') prices = JSON.parse(prices);
      if (Array.isArray(prices) && prices.length) yes = parseFloat(prices[0]);
    } catch (_) {}
    if ((yes == null || isNaN(yes)) && mk.lastTradePrice != null) yes = parseFloat(mk.lastTradePrice);
    return { title: mk.groupItemTitle || mk.question, yes };
  }).filter((s) => s.yes != null && !isNaN(s.yes));

  if (!scored.length) return { probability: null, leader: null, binary: true };
  if (markets.length === 1) return { probability: Math.round(scored[0].yes * 100), leader: null, binary: true };
  scored.sort((a, b) => b.yes - a.yes);
  return { probability: Math.round(scored[0].yes * 100), leader: scored[0].title, binary: false };
}

export default async function handler(req, res) {
  const category = (req.query.category || 'politics').toLowerCase();
  const tagMap = {
    politics: ['politics', 'us-politics', 'elections', 'election', 'government', 'congress', 'trump', 'biden', 'geopolitics'],
    sports:   ['sports', 'nba', 'nfl', 'soccer', 'football', 'baseball', 'mlb', 'nhl', 'cricket', 'tennis', 'ufc', 'boxing', 'f1'],
  };
  const tags = tagMap[category] || tagMap.politics;

  try {
    const url = 'https://gamma-api.polymarket.com/events?limit=60&active=true&closed=false&order=volume&ascending=false';
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) throw new Error('gamma api ' + r.status);

    const events = await r.json();
    const list = Array.isArray(events) ? events : (events.data || []);

    const matches = list.filter((e) => {
      if (e.closed || e.active === false) return false;
      const t = (e.tags || []).map((x) => (typeof x === 'string' ? x : (x.label || x.slug || '')).toLowerCase());
      const title = (e.title || '').toLowerCase();
      return tags.some((tag) => t.includes(tag) || title.includes(tag));
    });

    const pool = matches.length ? matches : list;
    const top = pool
      .sort((a, b) => (parseFloat(b.volume24hr || b.volume) || 0) - (parseFloat(a.volume24hr || a.volume) || 0))
      .slice(0, 6)
      .map((e) => {
        const sig = eventSignal(e);
        return {
          id: e.id || e.slug,
          title: e.title,
          slug: e.slug,
          url: e.slug ? `https://polymarket.com/event/${e.slug}` : 'https://polymarket.com',
          volume: e.volume24hr || e.volume || null,
          probability: sig.probability,
          leader: sig.leader,
          binary: sig.binary,
        };
      });

    return res.status(200).json({ markets: top, category });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
