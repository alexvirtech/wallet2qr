import { readSwapLog, type SwapLogEntry } from "@/lib/admin/swapLog";
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
  const affiliate = process.env.NEXT_PUBLIC_THOR_AFFILIATE;
  if (!affiliate) return [];
  try {
    const url = `https://midgard.ninerealms.com/v2/actions?affiliate=${affiliate}&type=swap&limit=100`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    return parseMidgard(data.actions ?? []);
  } catch {
    return [];
  }
}

async function fetchLifiSwaps(): Promise<SwapLogEntry[]> {
  try {
    return await readSwapLog();
  } catch {
    return [];
  }
}

export default async function AdminPage() {
  const [thorSwaps, lifiSwaps] = await Promise.all([
    fetchThorchainSwaps(),
    fetchLifiSwaps(),
  ]);

  return (
    <AdminDashboard thorSwaps={thorSwaps} lifiSwaps={lifiSwaps} />
  );
}
