import { useState, useCallback } from "react";

const CATEGORIES = [
  { id: "all", label: "all" },
  { id: "politics", label: "politics" },
  { id: "sports", label: "sports" },
  { id: "crypto", label: "crypto" },
  { id: "tech", label: "tech" },
  { id: "culture", label: "culture" },
  { id: "economy", label: "economy" },
];

const SYSTEM_PROMPT = `You write ready-to-post prediction-market tweets for Bellannie (@Bellannieth) on X.

Hard format rules — never break these:
- all lowercase, ALWAYS. no capital letters anywhere, including proper nouns. "france" not "France". "openai" not "OpenAI".
- no hashtags, no emojis, no em dashes (—). hyphens in scores like 3-1 are fine.
- no hype, no spin, no opinion words. flat, factual, declarative.

Output format — exactly this, nothing else:
line 1: a 1-2 sentence factual summary of the specific breaking news event behind the market. concrete. no filler.
line 2: "[X]% chance [what the market is predicting]" then the polymarket url.

Return ONLY the draft. no intro, no explanation, no quotes, no commentary. real news, real odds, real url. nothing else.`;

function buildDraftPrompt(market, context) {
  const oddsLine = market.probability != null
    ? (market.binary
        ? `current live odds: ${market.probability}% (yes)`
        : `current live odds: ${market.leader} leading at ${market.probability}%`)
    : `current live odds: check the market page`;
  const ctx = context.trim()
    ? `\n\noptional steer from bellannie (use only if it fits the real news, never invent): "${context.trim()}"`
    : "";
  return `here is a real, open polymarket market trending right now:

market: ${market.title}
${oddsLine}
url: ${market.url}

step 1: use the web_search tool to find the biggest specific breaking news story behind this market right now (last few days). get real event, real names, real numbers.

step 2: output ONLY a ready-to-post draft in this exact format:
line 1: 1-2 sentence factual news summary of that event. no spin, no hashtags, no emojis, no em dashes.
line 2: ${market.probability != null ? `${market.probability}%` : "[X]%"} chance [what the market is predicting], then the url: ${market.url}

use the real odds above (${market.probability != null ? market.probability + "%" : "find them"}). all lowercase. real news. real url. real odds. nothing else.${ctx}`;
}

export default function App() {
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("trending");
  const [search, setSearch] = useState("");
  const [context, setContext] = useState("");
  const [tweet, setTweet] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState([]);
  const [market, setMarket] = useState(null);
  const [markets, setMarkets] = useState([]);
  const [loadingMarkets, setLoadingMarkets] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [hasMore, setHasMore] = useState(false);

  const generate = useCallback(async (mkt) => {
    const target = mkt || market;
    if (!target || !target.url) return;
    setLoading(true);
    setCopied(false);
    setTweet("");
    try {
      const body = {
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildDraftPrompt(target, context) }],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      };
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      const textBlocks = (data.content || []).filter((b) => b.type === "text");
      let final = textBlocks.length ? textBlocks[textBlocks.length - 1].text.trim() : "";
      if (!final && data.error) final = "generation failed: " + (data.error.message || data.error);
      if (target.url && final && !final.includes(target.url)) final = `${final}\n${target.url}`;
      setTweet(final);
      if (final) setHistory((h) => [{ text: final, title: target.title }, ...h].slice(0, 8));
    } catch (e) {
      setTweet("generation failed. check your connection and try again.");
    }
    setLoading(false);
  }, [market, context]);

  const loadMarkets = useCallback(async (opts = {}) => {
    const cat = opts.category ?? category;
    const srt = opts.sort ?? sort;
    const q = opts.search ?? search;
    const offset = opts.offset ?? 0;
    const append = opts.append ?? false;

    if (append) setLoadingMarkets(true);
    else { setLoadingMarkets(true); setFetchError(""); setMarkets([]); setMarket(null); setTweet(""); }

    try {
      const params = new URLSearchParams({ category: cat, sort: srt, offset: String(offset), count: "12" });
      if (q.trim()) params.set("q", q.trim());
      const r = await fetch(`/api/fetch-markets?${params.toString()}`);
      if (!r.ok) { setFetchError("could not load markets. try again."); setLoadingMarkets(false); return; }
      const j = await r.json();
      const items = j.markets || [];
      if (!append && !items.length) setFetchError(q.trim() ? `no open markets matching "${q.trim()}".` : "no trending markets found right now.");
      setMarkets((prev) => append ? [...prev, ...items] : items);
      setHasMore(!!j.hasMore);
    } catch (e) {
      setFetchError("could not load markets. try again.");
    }
    setLoadingMarkets(false);
  }, [category, sort, search]);

  const pickCategory = useCallback((cat) => { setCategory(cat); loadMarkets({ category: cat, offset: 0 }); }, [loadMarkets]);
  const pickSort = useCallback((srt) => { setSort(srt); if (markets.length || search.trim()) loadMarkets({ sort: srt, offset: 0 }); }, [loadMarkets, markets.length, search]);

  const selectMarket = useCallback((m) => { setMarket(m); generate(m); }, [generate]);

  const copy = () => {
    if (!tweet) return;
    navigator.clipboard.writeText(tweet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const charCount = tweet.length;
  const overLimit = charCount > 280;
  const mono = "'JetBrains Mono', 'Courier New', monospace";
  const probLabel = (m) => m.probability == null ? null : (m.binary ? `now ${m.probability}%` : `${m.leader} ${m.probability}%`);

  const tabBtn = (active) => ({ padding: "6px 12px", background: active ? "rgba(124,185,204,0.1)" : "transparent", border: `1px solid ${active ? "#4A8099" : "#1E2535"}`, borderRadius: "6px", color: active ? "#E8EDF2" : "#6B7B8D", fontFamily: mono, fontSize: "10px", cursor: "pointer", whiteSpace: "nowrap" });

  return (
    <div style={{ minHeight: "100vh", background: "#08080E", color: "#E8EDF2", fontFamily: "'Inter', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <header style={{ borderBottom: "1px solid #1E2535", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(8,8,14,0.95)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ fontFamily: mono, fontSize: "13px", color: "#7CB9CC", letterSpacing: "1px" }}>value_tweet.exe</div>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#3DBE7A", boxShadow: "0 0 6px #3DBE7A" }} />
        </div>
        <div style={{ fontFamily: mono, fontSize: "10px", color: "#4A5566", letterSpacing: "1.5px" }}>breaking news → live market → draft</div>
      </header>

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "380px 1fr", maxWidth: "1100px", width: "100%", margin: "0 auto", padding: "28px 24px", gap: "32px", boxSizing: "border-box" }}>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* CATEGORY */}
          <div>
            <div style={{ fontFamily: mono, fontSize: "9px", color: "#4A8099", letterSpacing: "2.5px", textTransform: "uppercase", marginBottom: "10px" }}>// category</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {CATEGORIES.map((c) => (
                <button key={c.id} onClick={() => pickCategory(c.id)} style={{ padding: "8px 12px", background: category === c.id ? "rgba(124,185,204,0.1)" : "#0F0F18", border: `1px solid ${category === c.id ? "#4A8099" : "#1E2535"}`, borderRadius: "7px", color: category === c.id ? "#E8EDF2" : "#6B7B8D", fontSize: "12px", cursor: "pointer" }}>{c.label}</button>
              ))}
            </div>
          </div>

          {/* SEARCH + SORT + REFRESH */}
          <div>
            <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
              <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") loadMarkets({ offset: 0 }); }} placeholder="search any topic… (e.g. powell, mamdani, bitcoin)" style={{ flex: 1, background: "#0F0F18", border: "1px solid #1E2535", borderRadius: "7px", color: "#E8EDF2", fontFamily: "'Inter', sans-serif", fontSize: "12px", padding: "9px 12px", outline: "none" }} />
              <button onClick={() => loadMarkets({ offset: 0 })} style={{ padding: "0 14px", background: "#7CB9CC", border: "none", borderRadius: "7px", color: "#05080A", fontFamily: mono, fontSize: "11px", fontWeight: "600", cursor: "pointer" }}>go</button>
            </div>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <button onClick={() => pickSort("trending")} style={tabBtn(sort === "trending")}>trending now</button>
              <button onClick={() => pickSort("newest")} style={tabBtn(sort === "newest")}>newest</button>
              <button onClick={() => pickSort("volume")} style={tabBtn(sort === "volume")}>biggest</button>
              <button onClick={() => loadMarkets({ offset: 0 })} title="refresh" style={{ marginLeft: "auto", padding: "6px 10px", background: "transparent", border: "1px solid #1E2535", borderRadius: "6px", color: "#7CB9CC", fontFamily: mono, fontSize: "11px", cursor: "pointer" }}>↻ refresh</button>
            </div>
          </div>

          {/* MARKETS */}
          <div>
            {!markets.length && !loadingMarkets && !fetchError && (
              <div style={{ fontFamily: mono, fontSize: "11px", color: "#2A3545", lineHeight: "1.7", padding: "4px 0" }}>pick a category or search a topic<br />to load live markets</div>
            )}
            {loadingMarkets && !markets.length && <div style={{ fontFamily: mono, fontSize: "11px", color: "#4A8099", padding: "8px 0" }}>loading live markets...</div>}
            {fetchError && <div style={{ color: "#E05555", fontSize: "12px", padding: "4px 0" }}>{fetchError}</div>}

            {markets.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "46vh", overflowY: "auto", paddingRight: "4px" }}>
                {markets.map((m) => (
                  <button key={m.id} onClick={() => selectMarket(m)} disabled={loading} style={{ textAlign: "left", padding: "11px 12px", background: market && market.id === m.id ? "rgba(124,185,204,0.1)" : "#0F0F18", border: `1px solid ${market && market.id === m.id ? "#4A8099" : "#1E2535"}`, borderRadius: "8px", cursor: loading ? "wait" : "pointer", transition: "all 0.15s" }}>
                    <div style={{ fontSize: "12px", color: market && market.id === m.id ? "#E8EDF2" : "#8B9BAD", lineHeight: "1.4", marginBottom: "5px" }}>{m.title}</div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      {probLabel(m) && <span style={{ fontFamily: mono, fontSize: "10px", color: "#3DBE7A" }}>{probLabel(m)}</span>}
                      {m.volume && <span style={{ fontFamily: mono, fontSize: "9px", color: "#4A5566" }}>24h ${Number(m.volume).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>}
                    </div>
                  </button>
                ))}
                {hasMore && (
                  <button onClick={() => loadMarkets({ offset: markets.length, append: true })} disabled={loadingMarkets} style={{ padding: "10px", background: "transparent", border: "1px dashed #2A3F4A", borderRadius: "8px", color: "#7CB9CC", fontFamily: mono, fontSize: "11px", cursor: "pointer", marginTop: "2px" }}>{loadingMarkets ? "loading..." : "load more markets +"}</button>
                )}
              </div>
            )}
          </div>

          {/* OPTIONAL STEER */}
          <div>
            <div style={{ fontFamily: mono, fontSize: "9px", color: "#4A8099", letterSpacing: "2.5px", textTransform: "uppercase", marginBottom: "8px" }}>// optional steer</div>
            <textarea value={context} onChange={(e) => setContext(e.target.value)} placeholder="leave blank for pure news. or add an angle…" rows={2} style={{ width: "100%", background: "#0F0F18", border: "1px solid #1E2535", borderRadius: "8px", color: "#E8EDF2", fontFamily: "'Inter', sans-serif", fontSize: "12px", lineHeight: "1.6", padding: "10px 12px", resize: "vertical", outline: "none", boxSizing: "border-box" }} />
          </div>
        </div>

        {/* OUTPUT */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ background: "#0F0F18", border: `1px solid ${overLimit ? "#E05555" : "#1E2535"}`, borderRadius: "12px", overflow: "hidden", minHeight: "200px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px 20px", borderBottom: "1px solid #1E2535" }}>
              <div style={{ width: "36px", height: "36px", background: "rgba(124,185,204,0.1)", border: "1px solid #2A3F4A", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mono, fontSize: "11px", color: "#7CB9CC", flexShrink: 0 }}>B</div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: "600", color: "#E8EDF2" }}>Bellannie</div>
                <div style={{ fontSize: "11px", color: "#4A5566", fontFamily: mono }}>@Bellannieth</div>
              </div>
              <div style={{ marginLeft: "auto", fontFamily: mono, fontSize: "10px", color: overLimit ? "#E05555" : tweet ? "#4A8099" : "#2A3545" }}>{charCount} / 280</div>
            </div>
            <div style={{ padding: "20px", minHeight: "120px" }}>
              {tweet ? (
                <div style={{ fontSize: "15px", lineHeight: "1.65", color: "#E8EDF2", whiteSpace: "pre-wrap" }}>{tweet}</div>
              ) : loading ? (
                <div>
                  <div style={{ fontFamily: mono, fontSize: "10px", color: "#4A8099", marginBottom: "14px" }}>searching breaking news + writing draft...</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {[100, 80, 55].map((w, i) => (<div key={i} style={{ height: "13px", width: `${w}%`, background: "#1E2535", borderRadius: "3px", animation: `pulse 1.4s ease-in-out ${i * 0.12}s infinite` }} />))}
                  </div>
                </div>
              ) : (
                <div style={{ fontFamily: mono, fontSize: "11px", color: "#2A3545", paddingTop: "6px", lineHeight: "1.7" }}>your draft appears here.<br />tap any market to generate one.</div>
              )}
            </div>
            {tweet && !loading && (
              <div style={{ padding: "12px 20px", borderTop: "1px solid #1E2535", display: "flex", gap: "8px" }}>
                <button onClick={copy} style={{ padding: "8px 16px", background: copied ? "rgba(61,190,122,0.1)" : "rgba(124,185,204,0.08)", border: `1px solid ${copied ? "rgba(61,190,122,0.3)" : "#2A3F4A"}`, borderRadius: "6px", color: copied ? "#3DBE7A" : "#7CB9CC", fontFamily: mono, fontSize: "11px", cursor: "pointer" }}>{copied ? "✓ copied" : "copy"}</button>
                <button onClick={() => generate()} style={{ padding: "8px 16px", background: "transparent", border: "1px solid #1E2535", borderRadius: "6px", color: "#4A5566", fontFamily: mono, fontSize: "11px", cursor: "pointer" }}>regenerate</button>
                {overLimit && <div style={{ marginLeft: "auto", fontFamily: mono, fontSize: "10px", color: "#E05555", display: "flex", alignItems: "center" }}>{charCount - 280} over limit</div>}
              </div>
            )}
          </div>

          {history.length > 0 && (
            <div style={{ background: "#0F0F18", border: "1px solid #1E2535", borderRadius: "10px", padding: "16px 20px" }}>
              <div style={{ fontFamily: mono, fontSize: "9px", color: "#4A8099", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "12px" }}>// this session</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {history.map((item, i) => (
                  <div key={i} onClick={() => setTweet(item.text)} style={{ padding: "10px 12px", background: "#13131F", border: "1px solid #1A1F2E", borderRadius: "6px", cursor: "pointer" }}>
                    <div style={{ fontSize: "11px", color: "#6B7B8D", lineHeight: "1.5", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>{item.text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');
        @keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.6; } }
        * { box-sizing: border-box; }
        textarea::placeholder, input::placeholder { color: #2A3545; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #1E2535; border-radius: 3px; }
        @media (max-width: 720px) {
          div[style*="grid-template-columns: 380px"] { grid-template-columns: 1fr !important; }
        }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
      `}</style>
    </div>
  );
}
