const CACHE_TTL = 60_000;

interface PriceCache {
  prices: Record<string, number>;
  timestamp: number;
}

let cache: PriceCache | null = null;

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
];

const defaultPrices: Record<string, number> = {
  ETH: 0, AVAX: 0, ARB: 0, SOL: 0, BTC: 0, BNB: 0,
  USDT: 1, USDC: 1, FDUSD: 1,
  LINK: 0, UNI: 0, GMX: 0, JOE: 0, QI: 0,
  JUP: 0, PYTH: 0, CAKE: 0,
};

export async function fetchPrices(): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return cache.prices;
  }

  try {
    const ids = COINGECKO_IDS.join(",");
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const data = await res.json();

    const prices: Record<string, number> = {
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
    };

    cache = { prices, timestamp: Date.now() };
    return prices;
  } catch {
    return cache?.prices ?? { ...defaultPrices };
  }
}
