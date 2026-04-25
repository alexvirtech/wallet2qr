import AdminDashboard from "@/components/AdminDashboard";

interface MidgardAction {
  date: string;
  type: string;
  status: string;
  in: { address: string; coins: { asset: string; amount: string }[]; txID: string }[];
  out: { address: string; coins: { asset: string; amount: string }[]; txID: string }[];
  metadata?: {
    swap?: {
      affiliateAddress?: string;
      affiliateFee?: string;
      liquidityFee?: string;
      swapSlip?: string;
      memo?: string;
    };
  };
}

export interface ThorSwapRow {
  date: number;
  status: string;
  fromAsset: string;
  fromAmount: string;
  toAsset: string;
  toAmount: string;
  affiliateFeeBps: number;
  liquidityFee: string;
  inTxHash: string;
  outTxHash: string;
}

function parseMidgard(actions: MidgardAction[]): ThorSwapRow[] {
  return actions.map((a) => {
    const inCoins = a.in?.[0]?.coins?.[0];
    const outCoins = a.out?.[0]?.coins?.[0];
    return {
      date: Math.floor(Number(a.date) / 1e6),
      status: a.status,
      fromAsset: inCoins?.asset ?? "—",
      fromAmount: inCoins ? (Number(inCoins.amount) / 1e8).toFixed(8) : "0",
      toAsset: outCoins?.asset ?? "—",
      toAmount: outCoins ? (Number(outCoins.amount) / 1e8).toFixed(8) : "0",
      affiliateFeeBps: Number(a.metadata?.swap?.affiliateFee ?? 0),
      liquidityFee: a.metadata?.swap?.liquidityFee
        ? (Number(a.metadata.swap.liquidityFee) / 1e8).toFixed(8)
        : "0",
      inTxHash: a.in?.[0]?.txID ?? "",
      outTxHash: a.out?.[0]?.txID ?? "",
    };
  });
}

async function fetchThorchainSwaps(): Promise<ThorSwapRow[]> {
  const affiliate =
    process.env.THOR_AFFILIATE || process.env.NEXT_PUBLIC_THOR_AFFILIATE;
  if (!affiliate) return [];
  try {
    const url = `https://gateway.liquify.com/chain/thorchain_midgard/v2/actions?address=${affiliate}&type=swap&limit=100`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    const actions = (data.actions ?? []) as MidgardAction[];
    const filtered = actions.filter(
      (a) => a.metadata?.swap?.affiliateAddress === affiliate
    );
    return parseMidgard(filtered);
  } catch {
    return [];
  }
}

export interface LifiSwapRow {
  date: number;
  status: string;
  fromChain: number;
  fromToken: string;
  fromAmount: string;
  fromAmountUsd: string;
  toChain: number;
  toToken: string;
  toAmount: string;
  toAmountUsd: string;
  tool: string;
  feeAmountUsd: string;
  txHash: string;
  txLink: string;
  explorerLink: string;
}

interface LifiTransfer {
  sending: {
    token: { symbol: string; chainId: number; decimals: number };
    amount: string;
    amountUSD: string;
    txHash: string;
    txLink: string;
    timestamp: number;
  };
  receiving: {
    token: { symbol: string; chainId: number; decimals: number };
    amount: string;
    amountUSD: string;
  };
  tool: string;
  status: string;
  lifiExplorerLink: string;
  feeCosts?: { amountUSD: string }[];
}

async function fetchLifiSwaps(): Promise<LifiSwapRow[]> {
  const integrator = process.env.NEXT_PUBLIC_LIFI_INTEGRATOR || "wallet2qr";
  try {
    const url = `https://li.quest/v1/analytics/transfers?integrator=${integrator}&limit=100`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.transfers ?? []).map((t: LifiTransfer): LifiSwapRow => {
      const totalFeeUsd = (t.feeCosts ?? []).reduce(
        (sum: number, f: { amountUSD: string }) => sum + parseFloat(f.amountUSD || "0"),
        0
      );
      return {
        date: t.sending.timestamp * 1000,
        status: t.status,
        fromChain: t.sending.token.chainId,
        fromToken: t.sending.token.symbol,
        fromAmount: (Number(t.sending.amount) / 10 ** t.sending.token.decimals).toFixed(6),
        fromAmountUsd: t.sending.amountUSD,
        toChain: t.receiving.token.chainId,
        toToken: t.receiving.token.symbol,
        toAmount: (Number(t.receiving.amount) / 10 ** t.receiving.token.decimals).toFixed(6),
        toAmountUsd: t.receiving.amountUSD,
        tool: t.tool,
        feeAmountUsd: totalFeeUsd > 0 ? `$${totalFeeUsd.toFixed(4)}` : "—",
        txHash: t.sending.txHash,
        txLink: t.sending.txLink,
        explorerLink: t.lifiExplorerLink,
      };
    });
  } catch {
    return [];
  }
}

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const thorAffiliate =
    process.env.THOR_AFFILIATE || process.env.NEXT_PUBLIC_THOR_AFFILIATE || "";

  const [thorSwaps, lifiSwaps] = await Promise.all([
    fetchThorchainSwaps(),
    fetchLifiSwaps(),
  ]);

  return (
    <AdminDashboard
      thorSwaps={thorSwaps}
      lifiSwaps={lifiSwaps}
      thorAffiliate={thorAffiliate}
    />
  );
}
