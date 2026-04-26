import { rateLimitedFetch } from "./rateLimiter";

const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL || "";

export function isProxyEnabled(): boolean {
  return !!PROXY_URL;
}

export async function fetchProxyPrices(): Promise<Record<string, number>> {
  const res = await rateLimitedFetch(`${PROXY_URL}/api/prices`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Proxy prices ${res.status}`);
  const data = await res.json();
  return data.prices;
}

export interface ProxyBalanceAsset {
  blockchain: string;
  symbol: string;
  name: string;
  balance: string;
  balanceUsd: number;
  price: number;
  decimals: number;
  tokenType: string;
  contractAddress: string;
}

export interface ProxyBalanceResponse {
  assets: ProxyBalanceAsset[];
  btc?: { balance: string; balanceSat: number };
}

export async function fetchProxyBalances(
  evmAddress?: string,
  solAddress?: string,
  btcAddress?: string,
): Promise<ProxyBalanceResponse> {
  const params = new URLSearchParams();
  if (evmAddress) params.set("address", evmAddress);
  if (solAddress) params.set("solAddress", solAddress);
  if (btcAddress) params.set("btcAddress", btcAddress);

  const res = await rateLimitedFetch(`${PROXY_URL}/api/balances?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Proxy balances ${res.status}`);
  return res.json();
}

const ANKR_TO_NETWORK: Record<string, string> = {
  eth: "ethereum",
  arbitrum: "arbitrum",
  avalanche: "avalanche",
  bsc: "bnb",
  solana: "solana",
};

export function buildBalanceLookup(
  response: ProxyBalanceResponse
): Map<string, { balance: string; price: number }> {
  const map = new Map<string, { balance: string; price: number }>();

  for (const asset of response.assets) {
    const networkKey = ANKR_TO_NETWORK[asset.blockchain];
    if (!networkKey) continue;

    const key = asset.contractAddress
      ? `${networkKey}:${asset.contractAddress.toLowerCase()}`
      : `${networkKey}:NATIVE`;

    map.set(key, { balance: asset.balance, price: asset.price });
  }

  if (response.btc) {
    map.set("bitcoin:NATIVE", { balance: response.btc.balance, price: 0 });
  }

  return map;
}

export function lookupBalance(
  balanceMap: Map<string, { balance: string; price: number }>,
  networkKey: string,
  tokenAddress: string,
): { balance: string; price: number } | undefined {
  const key = tokenAddress
    ? `${networkKey}:${tokenAddress.toLowerCase()}`
    : `${networkKey}:NATIVE`;
  return balanceMap.get(key);
}
