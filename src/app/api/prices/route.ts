import { NextResponse } from "next/server";

const EW_BASE = process.env.EXTRAWALLET_API_URL || "https://api-staging.extrawallet.app";
const EW_KEY = process.env.EXTRAWALLET_API_KEY || "";

const CACHE_TTL = 60_000;
const COINGECKO_IDS = [
  "ethereum",
  "avalanche-2",
  "arbitrum",
  "tether",
  "solana",
  "usd-coin",
  "bitcoin",
  "binancecoin",
  "chainlink",
  "uniswap",
  "gmx",
  "joe",
  "benqi",
  "jupiter-exchange-solana",
  "pyth-network",
  "pancakeswap-token",
  "first-digital-usd",
  "dogecoin",
  "zcash",
];

const ID_TO_SYMBOL: Record<string, string> = {
  ethereum: "ETH",
  "avalanche-2": "AVAX",
  arbitrum: "ARB",
  tether: "USDT",
  solana: "SOL",
  "usd-coin": "USDC",
  bitcoin: "BTC",
  binancecoin: "BNB",
  chainlink: "LINK",
  uniswap: "UNI",
  gmx: "GMX",
  joe: "JOE",
  benqi: "QI",
  "jupiter-exchange-solana": "JUP",
  "pyth-network": "PYTH",
  "pancakeswap-token": "CAKE",
  "first-digital-usd": "FDUSD",
  dogecoin: "DOGE",
  zcash: "ZEC",
};

const defaultPrices: Record<string, number> = {
  ETH: 0, AVAX: 0, ARB: 0, SOL: 0, BTC: 0, BNB: 0,
  USDT: 1, USDC: 1, FDUSD: 1,
  LINK: 0, UNI: 0, GMX: 0, JOE: 0, QI: 0,
  JUP: 0, PYTH: 0, CAKE: 0,
  DOGE: 0, ZEC: 0,
};

let cache: { prices: Record<string, number>; timestamp: number } | null = null;

function mapExtraWalletResponse(data: Record<string, { price?: number }>): Record<string, number> {
  const prices: Record<string, number> = { ...defaultPrices };
  for (const [id, info] of Object.entries(data)) {
    const symbol = ID_TO_SYMBOL[id];
    if (symbol && info.price != null) prices[symbol] = info.price;
  }
  return prices;
}

function mapCoinGeckoResponse(data: Record<string, { usd?: number }>): Record<string, number> {
  const prices: Record<string, number> = { ...defaultPrices };
  for (const [id, info] of Object.entries(data)) {
    const symbol = ID_TO_SYMBOL[id];
    if (symbol && info.usd != null) prices[symbol] = info.usd;
  }
  return prices;
}

async function fetchFromExtraWallet(): Promise<Record<string, number>> {
  const ids = COINGECKO_IDS.join(",");
  const res = await fetch(`${EW_BASE}/price/coin?coin_ids=${ids}`, {
    headers: { ...(EW_KEY ? { "x-api-key": EW_KEY } : {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`ExtraWallet prices ${res.status}`);
  return mapExtraWalletResponse(await res.json());
}

async function fetchFromCoinGecko(): Promise<Record<string, number>> {
  const ids = COINGECKO_IDS.join(",");
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  return mapCoinGeckoResponse(await res.json());
}

export async function GET() {
  const now = Date.now();

  if (cache && now - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.prices, {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=30" },
    });
  }

  try {
    let prices: Record<string, number>;
    try {
      prices = await fetchFromExtraWallet();
    } catch {
      prices = await fetchFromCoinGecko();
    }
    cache = { prices, timestamp: now };
    return NextResponse.json(prices, {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=30" },
    });
  } catch {
    const fallback = cache?.prices ?? defaultPrices;
    return NextResponse.json(fallback, {
      status: cache ? 200 : 503,
      headers: { "Cache-Control": "public, max-age=30" },
    });
  }
}
