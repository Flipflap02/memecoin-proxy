const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, anthropic-dangerous-direct-browser-access");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});
app.use(express.json());

const mapCoin = (c) => ({
  name: c.name || "Unknown",
  symbol: c.symbol || "?",
  address: c.mint || "",
  marketCap: c.usd_market_cap || 0,
  liquidity: 0,
  volume24h: c.volume || 0,
  buys24h: c.buys || 0,
  sells24h: c.sells || 0,
  priceChange1h: 0,
  priceChange24h: c.price_change_24h || 0,
  price: c.usd_market_cap && c.total_supply ? c.usd_market_cap / c.total_supply : 0,
  rugRisk: c.complete ? "low" : "high",
  liquidityLocked: !!c.complete,
  imageUrl: c.image_uri || null,
  description: c.description || "",
  twitter: c.twitter || null,
  telegram: c.telegram || null,
  website: c.website || null,
  createdAt: c.created_timestamp || null,
  source: "pumpfun",
  dexUrl: `https://pump.fun/${c.mint}`,
});

const fetchPumpFun = async (sort) => {
  const url = `https://frontend-api.pump.fun/coins?limit=20&sort=${sort}&order=DESC&includeNsfw=false`;
  const response = await fetch(url, {
    headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" }
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch(e) { throw new Error("pump.fun API parse error: " + text.slice(0,100)); }
  
  // pump.fun can return array or object with coins property
  const arr = Array.isArray(data) ? data : (data.coins || data.data || []);
  if (!Array.isArray(arr)) throw new Error("Unerwartetes Format: " + JSON.stringify(data).slice(0,100));
  return arr.map(mapCoin);
};

app.get("/api/new-coins", async (req, res) => {
  try {
    const coins = await fetchPumpFun("created_timestamp");
    res.json({ success: true, coins });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get("/api/trending", async (req, res) => {
  try {
    const coins = await fetchPumpFun("last_trade_timestamp");
    res.json({ success: true, coins });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get("/api/coin/:address", async (req, res) => {
  try {
    const { address } = req.params;
    
    // try DEXScreener first
    const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
    const dexData = await dexRes.json();
    const pairs = (dexData.pairs || []).filter(p => p.chainId === "solana");
    
    if (pairs.length > 0) {
      const p = pairs[0];
      return res.json({ success: true, coins: [{
        name: p.baseToken?.name || "Unknown",
        symbol: p.baseToken?.symbol || "?",
        address: p.baseToken?.address || address,
        marketCap: p.marketCap || p.fdv || 0,
        liquidity: p.liquidity?.usd || 0,
        volume24h: p.volume?.h24 || 0,
        buys24h: p.txns?.h24?.buys || 0,
        sells24h: p.txns?.h24?.sells || 0,
        priceChange1h: p.priceChange?.h1 || 0,
        priceChange24h: p.priceChange?.h24 || 0,
        price: parseFloat(p.priceUsd || 0),
        rugRisk: "unknown",
        liquidityLocked: false,
        source: "dexscreener",
        dexUrl: p.url || `https://dexscreener.com/solana/${address}`,
      }]});
    }

    // fallback: pump.fun
    const pfRes = await fetch(`https://frontend-api.pump.fun/coins/${address}`, {
      headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" }
    });
    const c = await pfRes.json();
    if (c && c.mint) return res.json({ success: true, coins: [mapCoin(c)] });

    res.status(404).json({ success: false, error: "Coin nicht gefunden" });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get("/", (req, res) => res.json({ status: "ok", message: "Memecoin Scanner API läuft!" }));

app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));
