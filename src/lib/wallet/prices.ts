import { isProxyEnabled, fetchProxyPrices } from "./proxyClient";
import { rateLimitedFetch } from "./rateLimiter";

const CACHE_TTL = 60_000;
const LS_KEY = "w2q_prices";
const LS_ICONS_KEY = "w2q_icons";
const ICON_CLIENT_TTL = 24 * 60 * 60 * 1000;

interface PriceCache {
  prices: Record<string, number>;
  timestamp: number;
}

let cache: PriceCache | null = null;

function loadCachedPrices(): PriceCache | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveCachedPrices(c: PriceCache) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(c));
  } catch {}
}

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

async function fetchFromServer(): Promise<Record<string, number>> {
  const res = await fetch("/api/prices");
  if (!res.ok) throw new Error(`Server prices ${res.status}`);
  return res.json();
}

async function fetchFromCoinGecko(): Promise<Record<string, number>> {
  const ids = COINGECKO_IDS.join(",");
  const res = await rateLimitedFetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const data = await res.json();

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

export async function fetchPrices(): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return cache.prices;
  }

  if (!cache && typeof window !== "undefined") {
    const stored = loadCachedPrices();
    if (stored) {
      cache = stored;
      if (Date.now() - stored.timestamp < CACHE_TTL) {
        return stored.prices;
      }
    }
  }

  try {
    let prices: Record<string, number>;
    if (isProxyEnabled()) {
      try {
        prices = await fetchProxyPrices();
      } catch {
        try {
          prices = await fetchFromServer();
        } catch {
          prices = await fetchFromCoinGecko();
        }
      }
    } else {
      try {
        prices = await fetchFromServer();
      } catch {
        prices = await fetchFromCoinGecko();
      }
    }

    cache = { prices, timestamp: Date.now() };
    if (typeof window !== "undefined") saveCachedPrices(cache);
    return prices;
  } catch {
    return cache?.prices ?? { ...defaultPrices };
  }
}

let iconStore: Record<string, string> = {};
let iconsFetched = false;

function loadCachedIcons(): boolean {
  try {
    const raw = localStorage.getItem(LS_ICONS_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > ICON_CLIENT_TTL) return false;
    iconStore = parsed.icons;
    return true;
  } catch {
    return false;
  }
}

function saveCachedIcons(icons: Record<string, string>) {
  try {
    localStorage.setItem(LS_ICONS_KEY, JSON.stringify({ icons, timestamp: Date.now() }));
  } catch {}
}

export function getCachedIcon(networkKey: string, tokenAddress: string): string | null {
  return iconStore[`${networkKey}:${tokenAddress}`] || null;
}

export async function prefetchIcons(): Promise<void> {
  if (iconsFetched) return;
  if (typeof window !== "undefined" && loadCachedIcons()) {
    iconsFetched = true;
    return;
  }
  try {
    const res = await fetch("/api/icons");
    if (!res.ok) return;
    const icons: Record<string, string> = await res.json();
    iconStore = icons;
    iconsFetched = true;
    if (typeof window !== "undefined") saveCachedIcons(icons);
  } catch {}
}
