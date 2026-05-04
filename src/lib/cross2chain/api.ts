const API_BASE = "https://api.cross2chain.com";

export interface SwapQuote {
  quoteId: string;
  provider: string;
  direction: "BTC_TO_ETH" | "ETH_TO_BTC";
  sourceAmount: string;
  expectedOutput: string;
  minimumOutput: string;
  networkFees: string;
  protocolFees: string;
  affiliateFees: string;
  estimatedTimeSeconds: number;
  slippagePercent: number;
  priceImpactPercent: number;
  expiresAt: number;
  depositAddress: string;
  memo: string;
  requiresMemo: boolean;
  recommended: boolean;
  recommendedGasRate: number;
  routeLabel: string;
}

export interface QuoteResponse {
  quoteId: string;
  recommendedRoute: SwapQuote;
  routes: SwapQuote[];
  protectionScore: number;
  warnings: string[];
  expiresAt: string;
  estimatedTimeMinutes: number;
}

export interface SwapResult {
  id: string;
  status: string;
  depositAddress: string;
  memo: string;
  sourceAmount: string;
  expectedOutput: string;
  recommendedGasRate: number;
  protectionScore: number;
  expiresAt: number;
}

export interface SwapStatus {
  swapId: string;
  status: string;
  sourceTxHash?: string;
  destinationTxHash?: string;
  refundTxHash?: string;
  actualOutput?: string;
  updatedAt: number;
}

export const TERMINAL_STATUSES = ["completed", "failed", "refunded"];

export function getCross2ChainSupportedNetworks(): string[] {
  return ["bitcoin", "ethereum"];
}

function toAsset(networkKey: string): string {
  if (networkKey === "bitcoin") return "BTC.BTC";
  if (networkKey === "ethereum") return "ETH.ETH";
  throw new Error(`Unsupported network: ${networkKey}`);
}

export async function getCross2ChainQuote(
  fromNetwork: string,
  toNetwork: string,
  amount: string,
  destinationAddress: string,
  refundAddress: string
): Promise<QuoteResponse> {
  const res = await fetch(`${API_BASE}/v1/quotes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fromAsset: toAsset(fromNetwork),
      toAsset: toAsset(toNetwork),
      amount,
      destinationAddress,
      refundAddress,
      partnerId: process.env.NEXT_PUBLIC_CROSS2CHAIN_PARTNER_ID || undefined,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 503) throw new Error("Cross2Chain is under maintenance. Try again later.");
    if (res.status === 502) throw new Error("No swap routes available right now. Try again later.");
    throw new Error(data.error || `Quote failed (${res.status})`);
  }

  return res.json();
}

export async function createCross2ChainSwap(
  quote: SwapQuote,
  destinationAddress: string,
  refundAddress: string
): Promise<SwapResult> {
  const res = await fetch(`${API_BASE}/v1/swaps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quote, destinationAddress, refundAddress }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Swap creation failed (${res.status})`);
  }

  const data = await res.json();
  return data.swap;
}

export async function getCross2ChainStatus(swapId: string): Promise<SwapStatus> {
  const res = await fetch(`${API_BASE}/v1/swaps/${encodeURIComponent(swapId)}/status`);

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Status check failed (${res.status})`);
  }

  return res.json();
}
