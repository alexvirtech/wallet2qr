const QUOTE_PROXY = "/api/thor-quote";

export const THORCHAIN_AFFILIATE = process.env.NEXT_PUBLIC_THOR_AFFILIATE || "";
export const THORCHAIN_AFFILIATE_BPS = process.env.NEXT_PUBLIC_THOR_AFFILIATE_BPS || "30";

interface ThorChainMapping {
  chain: string;
  symbol: string;
}

const NETWORK_TO_THOR: Record<string, ThorChainMapping> = {
  bitcoin: { chain: "BTC", symbol: "BTC" },
  ethereum: { chain: "ETH", symbol: "ETH" },
  bnb: { chain: "BSC", symbol: "BNB" },
  avalanche: { chain: "AVAX", symbol: "AVAX" },
};

export function isThorchainSupported(networkKey: string): boolean {
  return networkKey in NETWORK_TO_THOR;
}

export function getThorAsset(networkKey: string, tokenSymbol: string, tokenAddress?: string): string | null {
  const mapping = NETWORK_TO_THOR[networkKey];
  if (!mapping) return null;
  if (tokenSymbol === mapping.symbol || tokenSymbol === "ETH" && mapping.chain === "ETH") {
    return `${mapping.chain}.${mapping.symbol}`;
  }
  if (tokenAddress) {
    return `${mapping.chain}.${tokenSymbol}-${tokenAddress}`;
  }
  return null;
}

export function getThorSupportedNetworks(): string[] {
  return Object.keys(NETWORK_TO_THOR);
}

export interface ThorQuoteParams {
  fromAsset: string;
  toAsset: string;
  amount: string;
  destination: string;
  affiliate?: string;
  affiliateBps?: string;
  streamingInterval?: number;
}

export interface ThorQuoteFees {
  asset: string;
  affiliate: string;
  outbound: string;
  liquidity: string;
  total: string;
  slippage_bps: number;
  total_bps: number;
}

export interface ThorQuoteResponse {
  inbound_address: string;
  memo: string;
  expected_amount_out: string;
  fees: ThorQuoteFees;
  expiry: number;
  inbound_confirmation_blocks: number;
  inbound_confirmation_seconds: number;
  outbound_delay_blocks: number;
  outbound_delay_seconds: number;
  total_swap_seconds: number;
  router?: string;
  dust_threshold: string;
  recommended_min_amount_in: string;
  recommended_gas_rate: string;
  gas_rate_units: string;
  max_streaming_quantity: number;
}

export async function fetchThorQuote(params: ThorQuoteParams): Promise<ThorQuoteResponse> {
  const qs = new URLSearchParams();
  qs.set("from_asset", params.fromAsset);
  qs.set("to_asset", params.toAsset);
  qs.set("amount", params.amount);
  qs.set("destination", params.destination);

  if (params.affiliate) {
    qs.set("affiliate", params.affiliate);
  }
  if (params.affiliateBps) {
    qs.set("affiliate_bps", params.affiliateBps);
  }
  if (params.streamingInterval) {
    qs.set("streaming_interval", String(params.streamingInterval));
  }

  const res = await fetch(`${QUOTE_PROXY}?${qs.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    let msg = `THORChain API error (${res.status})`;
    try {
      const err = JSON.parse(text);
      if (err.error) msg = err.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export function thorAmountToHuman(amount: string, decimals: number): string {
  const n = Number(amount) / 1e8;
  return n.toFixed(Math.min(decimals, 8));
}

export function humanToThorAmount(amount: string, decimals: number): string {
  const n = parseFloat(amount);
  if (isNaN(n)) return "0";
  return Math.round(n * 1e8).toString();
}
