import { NextResponse } from "next/server";

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

const defaultPrices: Record<string, number> = {
  ETH: 0, AVAX: 0, ARB: 0, SOL: 0, BTC: 0, BNB: 0,
  USDT: 1, USDC: 1, FDUSD: 1,
  LINK: 0, UNI: 0, GMX: 0, JOE: 0, QI: 0,
  JUP: 0, PYTH: 0, CAKE: 0,
  DOGE: 0, ZEC: 0,
};

let cache: { prices: Record<string, number>; timestamp: number } | null = null;

function mapCoinGeckoResponse(data: Record<string, { usd?: number }>): Record<string, number> {
  return {
    ETH: data.ethereum?.usd ?? 0,
    AVAX: data["avalanche-2"]?.usd ?? 0,
    ARB: data.arbitrum?.usd ?? 0,
    USDT: data.tether?.usd ?? 1,
    SOL: data.solana?.usd ?? 0,
    USDC: data["usd-coin"]?.usd ?? 1,
    BTC: data.bitcoin?.usd ?? 0,
    BNB: data.binancecoin?.usd ?? 0,
    LINK: data.chainlink?.usd ?? 0,
    UNI: data.uniswap?.usd ?? 0,
    GMX: data.gmx?.usd ?? 0,
    JOE: data.joe?.usd ?? 0,
    QI: data.benqi?.usd ?? 0,
    JUP: data["jupiter-exchange-solana"]?.usd ?? 0,
    PYTH: data["pyth-network"]?.usd ?? 0,
    CAKE: data["pancakeswap-token"]?.usd ?? 0,
    FDUSD: data["first-digital-usd"]?.usd ?? 1,
    DOGE: data.dogecoin?.usd ?? 0,
    ZEC: data.zcash?.usd ?? 0,
  };
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
    const prices = await fetchFromCoinGecko();
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
