interface ChainflipAsset {
  chain: "Bitcoin" | "Ethereum" | "Arbitrum";
  asset: "BTC" | "ETH" | "USDC" | "USDT" | "FLIP";
}

const NETWORK_ASSET_MAP: Record<string, Record<string, ChainflipAsset>> = {
  bitcoin: {
    BTC: { chain: "Bitcoin", asset: "BTC" },
  },
  ethereum: {
    ETH: { chain: "Ethereum", asset: "ETH" },
    USDC: { chain: "Ethereum", asset: "USDC" },
    USDT: { chain: "Ethereum", asset: "USDT" },
  },
  arbitrum: {
    ETH: { chain: "Arbitrum", asset: "ETH" },
    USDC: { chain: "Arbitrum", asset: "USDC" },
    USDT: { chain: "Arbitrum", asset: "USDT" },
  },
};

export function getChainflipSupportedNetworks(): string[] {
  return Object.keys(NETWORK_ASSET_MAP);
}

export function getChainflipAsset(
  networkKey: string,
  tokenSymbol: string
): ChainflipAsset | null {
  return NETWORK_ASSET_MAP[networkKey]?.[tokenSymbol] ?? null;
}

export function isChainflipToken(networkKey: string, tokenSymbol: string): boolean {
  return !!NETWORK_ASSET_MAP[networkKey]?.[tokenSymbol];
}

export interface ChainflipQuoteResult {
  egressAmount: string;
  estimatedPrice: string;
  estimatedDurationSeconds: number;
  recommendedSlippageTolerancePercent: number;
  recommendedRetryDurationMinutes: number;
  includedFees: { type: string; amount: string; asset: string }[];
  lowLiquidityWarning?: boolean;
}

export async function getChainflipQuote(
  srcNetwork: string,
  srcToken: string,
  destNetwork: string,
  destToken: string,
  amountBaseUnits: string
): Promise<ChainflipQuoteResult> {
  const src = getChainflipAsset(srcNetwork, srcToken);
  const dest = getChainflipAsset(destNetwork, destToken);
  if (!src || !dest) throw new Error("Unsupported asset pair for Chainflip");

  const params = new URLSearchParams({
    srcChain: src.chain,
    srcAsset: src.asset,
    destChain: dest.chain,
    destAsset: dest.asset,
    amount: amountBaseUnits,
  });

  const res = await fetch(`/api/chainflip/quote?${params}`);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Quote failed (${res.status})`);
  }

  return data;
}

export interface ChainflipDepositResult {
  depositAddress: string;
  depositChannelId: string;
  estimatedExpiryTime?: number;
}

export async function requestChainflipDeposit(
  srcNetwork: string,
  srcToken: string,
  destNetwork: string,
  destToken: string,
  amountBaseUnits: string,
  destAddress: string,
  refundAddress: string,
  slippagePercent: number,
  retryMinutes: number
): Promise<ChainflipDepositResult> {
  const src = getChainflipAsset(srcNetwork, srcToken);
  const dest = getChainflipAsset(destNetwork, destToken);
  if (!src || !dest) throw new Error("Unsupported asset pair for Chainflip");

  const res = await fetch("/api/chainflip/deposit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      srcChain: src.chain,
      srcAsset: src.asset,
      destChain: dest.chain,
      destAsset: dest.asset,
      amount: amountBaseUnits,
      destAddress,
      refundAddress,
      slippageTolerancePercent: slippagePercent,
      retryDurationMinutes: retryMinutes,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Deposit request failed (${res.status})`);
  }

  return {
    depositAddress: data.depositAddress,
    depositChannelId: data.depositChannelId,
    estimatedExpiryTime: data.estimatedExpiryTime ?? undefined,
  };
}

export interface ChainflipStatus {
  state: string;
  depositTxRef?: string;
  depositConfirmations?: number;
  egressTxRef?: string;
  egressAmount?: string;
  refundTxRef?: string;
}

export async function getChainflipStatus(
  channelId: string
): Promise<ChainflipStatus> {
  const res = await fetch(`/api/chainflip/status?id=${encodeURIComponent(channelId)}`);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Status request failed (${res.status})`);
  }

  return {
    state: data.state,
    depositTxRef: data.deposit?.txRef,
    depositConfirmations: data.deposit?.txConfirmations,
    egressTxRef: data.swapEgress?.txRef,
    egressAmount: data.swapEgress?.amount,
    refundTxRef: data.refundEgress?.txRef,
  };
}

const DECIMALS: Record<string, number> = {
  BTC: 8,
  ETH: 18,
  USDC: 6,
  USDT: 6,
  FLIP: 18,
};

export function getChainflipDecimals(asset: string): number {
  return DECIMALS[asset] ?? 18;
}

export function formatChainflipAmount(
  baseUnits: string,
  decimals: number
): string {
  const n = BigInt(baseUnits);
  const d = BigInt(10 ** decimals);
  const whole = n / d;
  const frac = n % d;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}
