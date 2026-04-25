import { NextResponse } from "next/server";

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

export async function GET() {
  const affiliate =
    process.env.THOR_AFFILIATE || process.env.NEXT_PUBLIC_THOR_AFFILIATE || "";
  if (!affiliate) {
    return NextResponse.json({ swaps: [], affiliate: "" });
  }

  try {
    const url = `https://gateway.liquify.com/chain/thorchain_midgard/v2/actions?address=${affiliate}&type=swap&limit=50`;
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ swaps: [], affiliate, error: `Midgard ${res.status}` });
    }
    const data = await res.json();
    const actions = (data.actions ?? []) as MidgardAction[];
    const filtered = actions.filter(
      (a) => a.metadata?.swap?.affiliateAddress === affiliate
    );

    const swaps = filtered.map((a) => {
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

    return NextResponse.json({ swaps, affiliate });
  } catch (e) {
    return NextResponse.json({
      swaps: [],
      affiliate,
      error: e instanceof Error ? e.message : "fetch failed",
    });
  }
}
