import { NextResponse } from "next/server";
import { readSwapLog } from "@/lib/admin/swapLog";

export const dynamic = "force-dynamic";

interface MidgardAction {
  date: string;
  status: string;
  in: { coins: { asset: string; amount: string }[]; txID: string }[];
  out: { coins: { asset: string; amount: string }[]; txID: string }[];
  metadata?: {
    swap?: {
      affiliateAddress?: string;
      affiliateFee?: string;
      liquidityFee?: string;
    };
  };
}

async function fetchMidgardSwaps(affiliate: string) {
  const url = `https://gateway.liquify.com/chain/thorchain_midgard/v2/actions?address=${affiliate}&type=swap&limit=50`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return [];
  const data = await res.json();
  const actions = (data.actions ?? []) as MidgardAction[];
  return actions.filter(
    (a) => a.metadata?.swap?.affiliateAddress === affiliate
  );
}

export async function GET() {
  const affiliate =
    process.env.THOR_AFFILIATE || process.env.NEXT_PUBLIC_THOR_AFFILIATE || "";

  const [midgardActions, logEntries] = await Promise.all([
    affiliate ? fetchMidgardSwaps(affiliate).catch(() => []) : Promise.resolve([]),
    readSwapLog().catch(() => []),
  ]);

  const thorLogEntries = logEntries.filter((e) => e.provider === "thorchain");

  const midgardByHash = new Map<string, MidgardAction>();
  for (const a of midgardActions) {
    const txId = a.in?.[0]?.txID;
    if (txId) midgardByHash.set(txId.toUpperCase(), a);
  }

  const seen = new Set<string>();
  const swaps: Record<string, unknown>[] = [];

  for (const a of midgardActions) {
    const inCoins = a.in?.[0]?.coins?.[0];
    const outCoins = a.out?.[0]?.coins?.[0];
    const hash = a.in?.[0]?.txID ?? "";
    seen.add(hash.toUpperCase());
    swaps.push({
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
      inTxHash: hash,
      outTxHash: a.out?.[0]?.txID ?? "",
      source: "midgard" as const,
    });
  }

  for (const e of thorLogEntries) {
    if (e.txHash && seen.has(e.txHash.toUpperCase())) continue;
    seen.add(e.txHash?.toUpperCase() ?? e.id);
    swaps.push({
      date: e.timestamp,
      status: e.status || "pending",
      fromAsset: `${e.fromChain}.${e.fromToken}`.toUpperCase(),
      fromAmount: e.fromAmount,
      toAsset: `${e.toChain}.${e.toToken}`.toUpperCase(),
      toAmount: e.toAmount || "0",
      affiliateFeeBps: e.feeBps ?? 0,
      liquidityFee: e.feeAmount || "0",
      inTxHash: e.txHash || "",
      outTxHash: "",
      source: "app-log" as const,
    });
  }

  swaps.sort((a, b) => (b.date as number) - (a.date as number));

  return NextResponse.json({ swaps, affiliate });
}
