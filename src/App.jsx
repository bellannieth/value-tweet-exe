import { useState, useCallback } from "react";

const CATEGORIES = [
  { id: "politics", label: "politics", desc: "elections, congress, policy markets" },
  { id: "sports", label: "sports", desc: "nba, nfl, soccer, ufc markets" },
];

const ANGLES = [
  { id: "myth", label: "kill a myth", desc: "something everyone believes that's wrong" },
  { id: "edge", label: "hidden edge", desc: "a signal or pattern most people miss" },
  { id: "mistake", label: "costly mistake", desc: "what beginners always get wrong" },
  { id: "framework", label: "framework", desc: "a mental model for reading markets" },
  { id: "number", label: "the number", desc: "a stat or data point that changes how you think" },
  { id: "contrast", label: "vs reality", desc: "what it looks like vs what it actually is" },
];

const TONES = [
  { id: "cold", label: "cold & declarative", desc: "flat, direct, no hype" },
  { id: "contrarian", label: "contrarian", desc: "flips the consensus view" },
  { id: "tactical", label: "tactical", desc: "concrete steps, no fluff" },
];

const SYSTEM_PROMPT = `You are a ghost-writer for a prediction markets expert who goes by Bellannie (@Bellannieth) on X.

Her voice rules — non-negotiable:
- all lowercase, ALWAYS. never capitalize the first letter of a sentence or proper nouns. "openai" not "OpenAI". "trump" not "Trump".
- no emojis, no hashtags
- cold, declarative prose. no hype, no "this is wild" energy
- short sentences. hard stops. no softening language
- she trades real money on Polymarket and reads markets through implied probability, liquidity, and resolution criteria

When writing a tweet reacting to a live market, the format is:
- line 1: the news / what's driving the market right now, stated flat and factual
- line 2: the current probability stated plainly — "now a 29% chance" / "sitting at 29%" / "the market has it at 29%"
- then the polymarket link on its own line at the very end, exactly as given

Output format: return ONLY the tweet text. nothing else. no quotes, no commentary, no preamble. all lowercase. just the tweet.`;

function buildMarketPrompt(angle, tone, context, market) {
  const probLine = market.probability != null
    ? (market.binary
        ? `current probability: ${market.probability}% (yes)`
        : `leading outcome: ${market.leader} at ${market.probability}%`)
    : `current probability: unknown — find it if you can`;

  const toneMap = {
    cold: "voice: cold, flat, declarative. state facts. no color.",
    contrarian: "voice: contrarian. point out what the crowd is getting wrong about this market.",
    tactical: "voice: tactical. note the actual trading angle — is the market mispriced, is there edge.",
  };

  const ctx = context.trim()
    ? `\n\nextra context from bellannie (work in naturally, don't quote): "${context.trim()}"`
    : "";

  return `write a tweet reacting to this live polymarket market.

market: ${market.title}
${probLine}
link: ${market.url}

${toneMap[tone]}${ctx}

steps:
1. use the web_search tool to find the most recent news (last few days) explaining WHY this market is where it is or why the odds are moving. search the actual event, not generic terms.
2. write the tweet: open with what's driving it (grounded in the real news you found), state the ${market.probability != null ? `${market.probability}%` : "current"} probability plainly, then the link on its own line at the end.

all lowercase. cold. factual. 1-3 short lines before the link. return ONLY the tweet.`;
}

function buildEvergreenPrompt(angle, tone, context) {
  const angleMap = {
    myth: "expose a common misconception prediction market traders have.",
    edge: "share a hidden signal or pattern in prediction markets that gives an edge.",
    mistake: "call out a costly mistake beginners make on polymarket.",
    framework: "give a reusable mental model for reading prediction market odds.",
    number: "lead with a specific number or stat about prediction markets that reframes how to think.",
    contrast: "contrast what prediction markets look like from outside vs what they are for serious traders.",
  };
  const toneMap = {
    cold: "voice: cold, flat, declarative. state facts. no color.",
    contrarian: "voice: contrarian. make the consensus look naive.",
    tactical: "voice: tactical and direct. only what you'd actually do.",
  };
  const ctx = context.trim() ? `\n\nextra context (work in naturally): "${context.trim()}"` : "";
  return `angle: ${angleMap[angle]}\n${toneMap[tone]}${ctx}\n\nall lowercase. write the tweet now. return ONLY the tweet.`;
}

export default function App() {
  const [category, setCategory] = useState("politics");
  const [angle, setAngle] = useState("myth");
  const [tone, setTone] = useState("cold");
  const [context, setContext] = useState("");
  const [tweet, setTweet] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState([]);
  const [market, setMarket] = useState(null);
  const [markets, setMarkets] = useState([]);
  const [loadingMarkets, setLoadingMarkets] = useState(false);
  const [fetchError, setFetchError] = useState("");

  const fetchMarkets = useCallback(async (cat) => {
    setLoadingMarkets(true);
    setFetchError("");
    setMarkets([]);
    setMarket(null);
    try {
      const r = await fetch(`/api/fetch-markets?category=${cat}`);
      if (!r.ok) { setFetchError("could not load markets. try again."); setLoadingMarkets(false); return; }
      const j = await r.json();
      const items = j.markets || [];
      if (!items.length) { setFetchError("no trending markets found right now."); setLoadingMarkets(false); return; }
      setMarkets(items);
    } catch (e) {
      setFetchError("could not load markets. try again.");
    }
    setLoadingMarkets(false);
  }, []);

  const selectCategory = useCallback((cat) => {
    setCategory(cat);
    fetchMarkets(cat);
  }, [fetchMarkets]);

  const generate = useCallback(async () => {
    setLoading(true);
    setCopied(false);
    try {
      const useMarket = !!(market && market.url);
      const body = {
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content: useMarket
            ? buildMarketPrompt(angle, tone, context, market)
            : buildEvergreenPrompt(angle, tone, context),
        }],
      };
      // enable live web search only for market-reaction tweets (needs current news)
      if (useMarket) body.tools = [{ type: "web_search_20250305", name: "web_search" }];

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      // with web search there can be several content blocks; the final tweet is the last text block
      const textBlocks = (data.content || []).filter((b) => b.type === "text");
      let final = textBlocks.length ? textBlocks[textBlocks.length - 1].text.trim() : "";
      if (!final && data.error) final = "generation failed: " + (data.error.message || data.error);
      if (useMarket && market.url && final && !final.includes(market.url)) {
        final = `${final}\n\n${market.url}`;
      }
      setTweet(final);
      if (final) setHistory((h) => [{ text: final, angle, tone, market }, ...h].slice(0, 6));
    } catch (e) {
      setTweet("generation failed. check your connection and try again.");
    }
    setLoading(false);
  }, [angle, tone, context, market]);

  const copy = () => {
    if (!tweet) return;
    navigator.clipboard.writeText(tweet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const charCount = tweet.length;
  const overLimit = charCount > 280;
  const mono = "'JetBrains Mono', 'Courier New', monospace";

  const probLabel = (m) => {
    if (m.probability == null) return null;
    return m.binary ? `now ${m.probability}%` : `${m.leader} ${m.probability}%`;
  };

  return (
    <div style={{ minHeight: "100vh", background: "#08080E", color: "#E8EDF2", fontFamily: "'Inter', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <header style={{ borderBottom: "1px solid #1E2535", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(8,8,14,0.95)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ fontFamily: mono, fontSize: "13px", color: "#7CB9CC", letterSpacing: "1px" }}>value_tweet.exe</div>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#3DBE7A", boxShadow: "0 0 6px #3DBE7A" }} />
        </div>
        <div style={{ fontFamily: mono, fontSize: "10px", color: "#4A5566", letterSpacing: "1.5px" }}>prediction markets · @Bellannieth</div>
      </header>

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "340px 1fr", maxWidth: "1100px", width: "100%", margin: "0 auto", padding: "32px 24px", gap: "32px", boxSizing: "border-box" }}>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

          <div>
            <div style={{ fontFamily: mono, fontSize: "9px", color: "#4A8099", letterSpacing: "2.5px", textTransform: "uppercase", marginBottom: "12px" }}>// trending market</div>
            <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
              {CATEGORIES.map((c) => (
                <button key={c.id} onClick={() => selectCategory(c.id)} style={{ flex: 1, padding: "12px", background: category === c.id ? "rgba(124,185,204,0.08)" : "#0F0F18", border: `1px solid ${category === c.id ? "#4A8099" : "#1E2535"}`, borderRadius: "8px", cursor: "pointer", textAlign: "center", transition: "all 0.15s" }}>
                  <div style={{ fontSize: "13px", fontWeight: "500", color: category === c.id ? "#E8EDF2" : "#6B7B8D" }}>{c.label}</div>
                </button>
              ))}
            </div>

            {loadingMarkets && <div style={{ fontFamily: mono, fontSize: "11px", color: "#4A8099", padding: "8px 0" }}>loading trending markets...</div>}
            {fetchError && <div style={{ color: "#E05555", fontSize: "12px", padding: "4px 0" }}>{fetchError}</div>}

            {markets.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
                {markets.map((m) => (
                  <button key={m.id} onClick={() => setMarket(m)} style={{ textAlign: "left", padding: "10px 12px", background: market && market.id === m.id ? "rgba(124,185,204,0.08)" : "#0F0F18", border: `1px solid ${market && market.id === m.id ? "#4A8099" : "#1E2535"}`, borderRadius: "8px", cursor: "pointer", transition: "all 0.15s" }}>
                    <div style={{ fontSize: "12px", color: market && market.id === m.id ? "#E8EDF2" : "#8B9BAD", lineHeight: "1.4", marginBottom: "4px" }}>{m.title}</div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      {probLabel(m) && <span style={{ fontFamily: mono, fontSize: "10px", color: "#3DBE7A" }}>{probLabel(m)}</span>}
                      {m.volume && <span style={{ fontFamily: mono, fontSize: "9px", color: "#4A5566" }}>vol ${Number(m.volume).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontFamily: mono, fontSize: "9px", color: "#4A8099", letterSpacing: "2.5px", textTransform: "uppercase", marginBottom: "12px" }}>// angle</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {ANGLES.map((a) => (
                <button key={a.id} onClick={() => setAngle(a.id)} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "12px 14px", background: angle === a.id ? "rgba(124,185,204,0.08)" : "#0F0F18", border: `1px solid ${angle === a.id ? "#4A8099" : "#1E2535"}`, borderRadius: "8px", cursor: "pointer", textAlign: "left", transition: "all 0.15s", width: "100%" }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: angle === a.id ? "#7CB9CC" : "#1E2535", marginTop: "5px", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: "500", color: angle === a.id ? "#E8EDF2" : "#6B7B8D", marginBottom: "2px" }}>{a.label}</div>
                    <div style={{ fontSize: "11px", color: "#4A5566", lineHeight: "1.4" }}>{a.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontFamily: mono, fontSize: "9px", color: "#4A8099", letterSpacing: "2.5px", textTransform: "uppercase", marginBottom: "12px" }}>// tone</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {TONES.map((t) => (
                <button key={t.id} onClick={() => setTone(t.id)} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", background: tone === t.id ? "rgba(124,185,204,0.08)" : "#0F0F18", border: `1px solid ${tone === t.id ? "#4A8099" : "#1E2535"}`, borderRadius: "8px", cursor: "pointer", textAlign: "left", transition: "all 0.15s", width: "100%" }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: tone === t.id ? "#7CB9CC" : "#1E2535", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: "500", color: tone === t.id ? "#E8EDF2" : "#6B7B8D" }}>{t.label}</div>
                    <div style={{ fontSize: "11px", color: "#4A5566" }}>{t.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontFamily: mono, fontSize: "9px", color: "#4A8099", letterSpacing: "2.5px", textTransform: "uppercase", marginBottom: "12px" }}>// context (optional)</div>
            <textarea value={context} onChange={(e) => setContext(e.target.value)} placeholder="any specific insight, trade, data point, or angle you want to work in…" rows={4} style={{ width: "100%", background: "#0F0F18", border: "1px solid #1E2535", borderRadius: "8px", color: "#E8EDF2", fontFamily: "'Inter', sans-serif", fontSize: "12px", lineHeight: "1.6", padding: "12px 14px", resize: "vertical", outline: "none", boxSizing: "border-box" }} />
          </div>

          <button onClick={generate} disabled={loading} style={{ padding: "14px", background: loading ? "#1E2535" : "#7CB9CC", border: "none", borderRadius: "8px", color: loading ? "#4A5566" : "#05080A", fontFamily: mono, fontSize: "12px", fontWeight: "600", letterSpacing: "1px", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            {loading ? (<><span style={{ display: "inline-block", width: "10px", height: "10px", border: "2px solid #4A5566", borderTopColor: "#7CB9CC", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />generating...</>) : "generate tweet →"}
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ background: "#0F0F18", border: `1px solid ${overLimit ? "#E05555" : "#1E2535"}`, borderRadius: "12px", overflow: "hidden", minHeight: "220px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px 20px", borderBottom: "1px solid #1E2535" }}>
              <div style={{ width: "36px", height: "36px", background: "rgba(124,185,204,0.1)", border: "1px solid #2A3F4A", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mono, fontSize: "11px", color: "#7CB9CC", flexShrink: 0 }}>B</div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: "600", color: "#E8EDF2" }}>Bellannie</div>
                <div style={{ fontSize: "11px", color: "#4A5566", fontFamily: mono }}>@Bellannieth</div>
              </div>
              <div style={{ marginLeft: "auto", fontFamily: mono, fontSize: "10px", color: overLimit ? "#E05555" : tweet ? "#4A8099" : "#2A3545" }}>{charCount} / 280</div>
            </div>
            <div style={{ padding: "20px", minHeight: "140px" }}>
              {tweet ? (
                <div style={{ fontSize: "15px", lineHeight: "1.65", color: "#E8EDF2", whiteSpace: "pre-wrap" }}>{tweet}</div>
              ) : loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
                  {[100, 85, 92, 60].map((w, i) => (<div key={i} style={{ height: "14px", width: `${w}%`, background: "#1E2535", borderRadius: "3px", animation: `pulse 1.4s ease-in-out ${i * 0.1}s infinite` }} />))}
                </div>
              ) : (
                <div style={{ fontFamily: mono, fontSize: "11px", color: "#2A3545", paddingTop: "8px", lineHeight: "1.7" }}>pick a category, tap a trending market<br />then generate →</div>
              )}
            </div>
            {tweet && !loading && (
              <div style={{ padding: "12px 20px", borderTop: "1px solid #1E2535", display: "flex", gap: "8px" }}>
                <button onClick={copy} style={{ padding: "8px 16px", background: copied ? "rgba(61,190,122,0.1)" : "rgba(124,185,204,0.08)", border: `1px solid ${copied ? "rgba(61,190,122,0.3)" : "#2A3F4A"}`, borderRadius: "6px", color: copied ? "#3DBE7A" : "#7CB9CC", fontFamily: mono, fontSize: "11px", cursor: "pointer" }}>{copied ? "✓ copied" : "copy"}</button>
                <button onClick={generate} style={{ padding: "8px 16px", background: "transparent", border: "1px solid #1E2535", borderRadius: "6px", color: "#4A5566", fontFamily: mono, fontSize: "11px", cursor: "pointer" }}>regenerate</button>
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
                    <div style={{ display: "flex", gap: "8px", marginBottom: "5px" }}>
                      <span style={{ fontFamily: mono, fontSize: "9px", color: "#4A8099", background: "rgba(74,128,153,0.1)", padding: "1px 6px", borderRadius: "3px" }}>{item.angle}</span>
                      <span style={{ fontFamily: mono, fontSize: "9px", color: "#4A5566" }}>{item.tone}</span>
                    </div>
                    <div style={{ fontSize: "11px", color: "#6B7B8D", lineHeight: "1.5", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{item.text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.6; } }
        * { box-sizing: border-box; }
        textarea::placeholder { color: #2A3545; }
        @media (max-width: 720px) {
          div[style*="grid-template-columns: 340px"] { grid-template-columns: 1fr !important; }
        }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
      `}</style>
    </div>
  );
}
