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
- all lowercase, always
- no emojis, no hashtags in body copy
- cold, declarative prose. no hype, no "this is wild" energy
- negative hooks perform best for her: "most people don't know...", "nobody talks about...", "the thing they don't tell you...", "you're reading this wrong"
- she writes from lived experience trading prediction markets (primarily Polymarket), tracking whale wallets, and building market analysis tools
- she references real mechanics: YES/NO spreads, liquidity depth, resolution criteria edge, both-sides whale strategy, implied probability, calibration
- short sentences. hard stops. no softening language

Tweet structure:
- line 1 = HOOK. must make someone stop scrolling. use her negative-hook patterns
- body = 2-5 lines of actual value. specific, not vague. the kind of thing you'd only know if you'd traded real money
- optional closer = a short, cold observation that lands like a period at the end of a paragraph
- NO "follow for more", NO "save this", NO "thread below"

Output format: return ONLY the tweet text. nothing else. no quotes, no commentary, no explanation. just the tweet.`;

function buildPrompt(angle, tone, context, market) {
  const angleMap = {
    myth: "Expose a common misconception prediction market traders have. The hook should make experienced traders question something they assumed was true.",
    edge: "Share a hidden signal or pattern in prediction markets that gives an edge. Something specific — about liquidity, timing, resolution criteria, or whale behavior.",
    mistake: "Call out a costly mistake beginners make on Polymarket or prediction markets in general. Be specific about what they do wrong and why it bleeds money.",
    framework: "Give a mental model for reading prediction market odds. Something reusable — how to spot mispricing, how to interpret volume, how to think about probability.",
    number: "Lead with a specific number, stat, or data point about prediction markets that reframes how someone should think about trading them.",
    contrast: "Contrast what prediction markets look like from the outside vs what they actually are for someone who trades them seriously.",
  };
  const toneMap = {
    cold: "Voice: cold, flat, declarative. State facts. No color.",
    contrarian: "Voice: contrarian. Take the position most people won't say out loud. Make the consensus look naive.",
    tactical: "Voice: tactical and direct. Give concrete, actionable knowledge. No theory, only what you'd actually do.",
  };
  const contextLine = context.trim()
    ? `\n\nExtra context from the user (incorporate this naturally, don't quote it directly): "${context.trim()}"`
    : "";
  const marketLine = market && market.url
    ? `\n\nThis tweet is about a specific live Polymarket market:\nTitle: ${market.title}\nURL: ${market.url}${market.volume ? `\nVolume: ${market.volume}` : ''}\n\nGround the tweet in this specific market. Reference what it's really asking. Include the polymarket link exactly as-is on its own line at the very end of the tweet.`
    : "";
  return `Angle: ${angleMap[angle]}\n${toneMap[tone]}${contextLine}${marketLine}\n\nWrite the tweet now.`;
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
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildPrompt(angle, tone, context, market) }],
        }),
      });
      const data = await res.json();
      const text = data.content?.find((b) => b.type === "text")?.text?.trim() ?? "";
      let final = text;
      if (market && market.url && !final.includes(market.url)) final = `${final}\n\n${market.url}`;
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

          {/* CATEGORY → auto-loads markets */}
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
                    <div style={{ fontSize: "12px", color: market && market.id === m.id ? "#E8EDF2" : "#8B9BAD", lineHeight: "1.4", marginBottom: "3px" }}>{m.title}</div>
                    {m.volume && <div style={{ fontFamily: mono, fontSize: "9px", color: "#4A5566" }}>vol ${Number(m.volume).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ANGLE */}
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

          {/* TONE */}
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

          {/* CONTEXT */}
          <div>
            <div style={{ fontFamily: mono, fontSize: "9px", color: "#4A8099", letterSpacing: "2.5px", textTransform: "uppercase", marginBottom: "12px" }}>// context (optional)</div>
            <textarea value={context} onChange={(e) => setContext(e.target.value)} placeholder="any specific insight, trade, data point, or angle you want to work in…" rows={4} style={{ width: "100%", background: "#0F0F18", border: "1px solid #1E2535", borderRadius: "8px", color: "#E8EDF2", fontFamily: "'Inter', sans-serif", fontSize: "12px", lineHeight: "1.6", padding: "12px 14px", resize: "vertical", outline: "none", boxSizing: "border-box" }} />
          </div>

          <button onClick={generate} disabled={loading} style={{ padding: "14px", background: loading ? "#1E2535" : "#7CB9CC", border: "none", borderRadius: "8px", color: loading ? "#4A5566" : "#05080A", fontFamily: mono, fontSize: "12px", fontWeight: "600", letterSpacing: "1px", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            {loading ? (<><span style={{ display: "inline-block", width: "10px", height: "10px", border: "2px solid #4A5566", borderTopColor: "#7CB9CC", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />generating...</>) : "generate tweet →"}
          </button>
        </div>

        {/* RIGHT */}
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
                <div style={{ fontFamily: mono, fontSize: "11px", color: "#2A3545", paddingTop: "8px", lineHeight: "1.7" }}>pick a category to load a trending market<br />then generate →</div>
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
