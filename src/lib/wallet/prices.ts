const CACHE_TTL = 60_000; // 60 seconds

interface PriceCache {
  prices: Record<string, number>;
  timestamp: number;
}

let cache: PriceCache | null = null;

const COINGECKO_IDS = ["ethereum", "avalanche-2", "arbitrum", "tether"];

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
    };

    cache = { prices, timestamp: Date.now() };
    return prices;
  } catch {
    return cache?.prices ?? { ETH: 0, AVAX: 0, ARB: 0, USDT: 1 };
  }
}
