import { SwapSDK } from "@chainflip/sdk/swap";

let sdkInstance: SwapSDK | null = null;

function getSDK(): SwapSDK {
  if (!sdkInstance) {
    sdkInstance = new SwapSDK({ network: "mainnet" });
  }
  return sdkInstance;
}

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any;
}

export async function getChainflipQuote(
  srcNetwork: string,
  srcToken: string,
  destNetwork: string,
  destToken: string,
  amountBaseUnits: string
): Promise<ChainflipQuoteResult> {
  const sdk = getSDK();
  const src = getChainflipAsset(srcNetwork, srcToken);
  const dest = getChainflipAsset(destNetwork, destToken);
  if (!src || !dest) throw new Error("Unsupported asset pair for Chainflip");

  const response = await sdk.getQuoteV2({
    srcChain: src.chain,
    srcAsset: src.asset,
    destChain: dest.chain,
    destAsset: dest.asset,
    amount: amountBaseUnits,
  });

  const quote = response.quotes.find((q: { type: string }) => q.type === "REGULAR");
  if (!quote) throw new Error("No quote available for this pair");

  return {
    egressAmount: quote.egressAmount,
    estimatedPrice: quote.estimatedPrice,
    estimatedDurationSeconds: quote.estimatedDurationSeconds,
    recommendedSlippageTolerancePercent: quote.recommendedSlippageTolerancePercent,
    recommendedRetryDurationMinutes: quote.recommendedRetryDurationMinutes,
    includedFees: (quote.includedFees ?? []).map(
      (f: { type: string; amount: string; asset: string }) => ({
        type: f.type,
        amount: f.amount,
        asset: f.asset,
      })
    ),
    lowLiquidityWarning: quote.lowLiquidityWarning ?? false,
    raw: quote,
  };
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
  const sdk = getSDK();
  const src = getChainflipAsset(srcNetwork, srcToken);
  const dest = getChainflipAsset(destNetwork, destToken);
  if (!src || !dest) throw new Error("Unsupported asset pair for Chainflip");

  const quoteResponse = await sdk.getQuoteV2({
    srcChain: src.chain,
    srcAsset: src.asset,
    destChain: dest.chain,
    destAsset: dest.asset,
    amount: amountBaseUnits,
  });

  const quote = quoteResponse.quotes.find((q: { type: string }) => q.type === "REGULAR");
  if (!quote) throw new Error("No quote available");

  const deposit = await sdk.requestDepositAddressV2({
    quote: quote,
    destAddress,
    fillOrKillParams: {
      slippageTolerancePercent: String(slippagePercent),
      refundAddress,
      retryDurationMinutes: retryMinutes,
    },
  });

  return {
    depositAddress: deposit.depositAddress,
    depositChannelId: deposit.depositChannelId,
    estimatedExpiryTime: deposit.estimatedDepositChannelExpiryTime ?? undefined,
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
  const sdk = getSDK();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const status: any = await sdk.getStatusV2({ id: channelId });

  return {
    state: status.state,
    depositTxRef: status.deposit?.txRef,
    depositConfirmations: status.deposit?.txConfirmations,
    egressTxRef: status.swapEgress?.txRef,
    egressAmount: status.swapEgress?.amount,
    refundTxRef: status.refundEgress?.txRef,
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
