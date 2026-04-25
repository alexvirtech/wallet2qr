import AdminDashboard from "@/components/AdminDashboard";

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
    const res = await fetch(url, { cache: "no-store" });
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
  const lifiSwaps = await fetchLifiSwaps();

  return <AdminDashboard lifiSwaps={lifiSwaps} />;
}
