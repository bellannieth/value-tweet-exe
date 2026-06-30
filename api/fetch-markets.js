// pulls a large live batch of open Polymarket events, then filters/sorts them
// so the app can surface what's trending NOW across many categories, search any
// topic, and page through more results.

const TAGS = {
  politics: ['politics', 'us-politics', 'elections', 'election', 'government', 'congress', 'trump', 'biden', 'geopolitics', 'world', 'foreign-policy'],
  sports:   ['sports', 'nba', 'nfl', 'soccer', 'football', 'baseball', 'mlb', 'nhl', 'cricket', 'tennis', 'ufc', 'boxing', 'f1', 'world-cup', 'fifa-world-cup', 'golf'],
  crypto:   ['crypto', 'bitcoin', 'ethereum', 'btc', 'eth', 'solana', 'defi', 'coinbase', 'stablecoin'],
  tech:     ['tech', 'ai', 'technology', 'openai', 'science', 'space', 'nvidia', 'apple', 'tesla'],
  culture:  ['pop-culture', 'culture', 'entertainment', 'movies', 'music', 'awards', 'celebrity', 'tv', 'oscars'],
  economy:  ['economy', 'economics', 'fed', 'inflation', 'rates', 'recession', 'markets', 'jobs'],
};

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

async function gammaBatch(order) {
  const url = `https://gamma-api.polymarket.com/events?limit=120&active=true&closed=false&order=${order}&ascending=false`;
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('gamma ' + r.status);
  const j = await r.json();
  return Array.isArray(j) ? j : (j.data || []);
}

export default async function handler(req, res) {
  const category = (req.query.category || 'all').toLowerCase();
  const sort = (req.query.sort || 'trending').toLowerCase();
  const q = (req.query.q || '').trim().toLowerCase();
  const offset = Math.max(0, parseInt(req.query.offset || '0', 10) || 0);
  const count = Math.min(24, Math.max(1, parseInt(req.query.count || '12', 10) || 12));

  try {
    // primary fetch ordered by 24h volume; fall back to total volume if that field is rejected
    let list;
    try { list = await gammaBatch('volume24hr'); }
    catch (_) { list = await gammaBatch('volume'); }

    // category filter
    let filtered = list.filter((e) => !e.closed && e.active !== false);
    if (category !== 'all') {
      const tags = TAGS[category] || [];
      filtered = filtered.filter((e) => {
        const t = (e.tags || []).map((x) => (typeof x === 'string' ? x : (x.label || x.slug || '')).toLowerCase());
        const title = (e.title || '').toLowerCase();
        return tags.some((tag) => t.includes(tag) || title.includes(tag));
      });
    }

    // keyword search across title + tags
    if (q) {
      filtered = filtered.filter((e) => {
        const title = (e.title || '').toLowerCase();
        const t = (e.tags || []).map((x) => (typeof x === 'string' ? x : (x.label || x.slug || '')).toLowerCase()).join(' ');
        return title.includes(q) || t.includes(q);
      });
    }

    // sort
    const num = (v) => parseFloat(v) || 0;
    if (sort === 'newest') {
      filtered.sort((a, b) => new Date(b.createdAt || b.creationDate || b.startDate || 0) - new Date(a.createdAt || a.creationDate || a.startDate || 0));
    } else if (sort === 'volume') {
      filtered.sort((a, b) => num(b.volume) - num(a.volume));
    } else { // trending
      filtered.sort((a, b) => num(b.volume24hr || b.volume) - num(a.volume24hr || a.volume));
    }

    const page = filtered.slice(offset, offset + count).map((e) => {
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

    return res.status(200).json({
      markets: page,
      category, sort, q,
      offset,
      total: filtered.length,
      hasMore: filtered.length > offset + count,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
