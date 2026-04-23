// server.js — Memecoin Scanner Proxy
// Deploy auf Render.com (kostenlos)

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // erlaubt Anfragen von überall (Claude Artifact)
app.use(express.json());

// ── Pump.fun: neue Coins ──────────────────────────────────────────────────────
app.get("/api/new-coins", async (req, res) => {
  try {
    const response = await fetch(
      "https://frontend-api.pump.fun/coins?limit=20&sort=created_timestamp&order=DESC&includeNsfw=false",
      { headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" } }
    );
    const coins = await response.json();

    const mapped = coins.map(c => ({
      name: c.name || "Unknown",
      symbol: c.symbol || "?",
      address: c.mint || "",
      marketCap: c.usd_market_cap || 0,
      liquidity: c.virtual_sol_reserves ? c.virtual_sol_reserves * 0.00000001 * 150 : 0,
      volume24h: c.volume_24h || 0,
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
    }));

    res.json({ success: true, coins: mapped });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Pump.fun: trending Coins ──────────────────────────────────────────────────
app.get("/api/trending", async (req, res) => {
  try {
    const response = await fetch(
      "https://frontend-api.pump.fun/coins?limit=20&sort=last_trade_timestamp&order=DESC&includeNsfw=false",
      { headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" } }
    );
    const coins = await response.json();

    const mapped = coins.map(c => ({
      name: c.name || "Unknown",
      symbol: c.symbol || "?",
      address: c.mint || "",
      marketCap: c.usd_market_cap || 0,
      liquidity: c.virtual_sol_reserves ? c.virtual_sol_reserves * 0.00000001 * 150 : 0,
      volume24h: c.volume_24h || 0,
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
    }));

    res.json({ success: true, coins: mapped });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── DEXScreener: Coin by address ──────────────────────────────────────────────
app.get("/api/coin/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`,
      { headers: { "Accept": "application/json" } }
    );
    const data = await response.json();
    const pairs = (data.pairs || []).filter(p => p.chainId === "solana");

    if (!pairs.length) {
      // fallback: try pump.fun
      const pfRes = await fetch(
        `https://frontend-api.pump.fun/coins/${address}`,
        { headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" } }
      );
      const c = await pfRes.json();
      if (c && c.mint) {
        return res.json({ success: true, coins: [{
          name: c.name, symbol: c.symbol, address: c.mint,
          marketCap: c.usd_market_cap || 0,
          liquidity: 0, volume24h: c.volume_24h || 0,
          buys24h: c.buys || 0, sells24h: c.sells || 0,
          priceChange1h: 0, priceChange24h: c.price_change_24h || 0,
          price: 0, rugRisk: c.complete ? "low" : "high",
          liquidityLocked: !!c.complete,
          imageUrl: c.image_uri || null,
          twitter: c.twitter || null, telegram: c.telegram || null,
          source: "pumpfun", dexUrl: `https://pump.fun/${c.mint}`,
        }]});
      }
      return res.status(404).json({ success: false, error: "Coin nicht gefunden" });
    }

    const p = pairs[0];
    const coin = {
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
    };
    res.json({ success: true, coins: [coin] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Memecoin Scanner API läuft!" });
});

app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));
