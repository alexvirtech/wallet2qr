import { NextResponse } from "next/server";

const CHAINFLIP_BACKEND = "https://chainflip-swap.chainflip.io";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const srcChain = searchParams.get("srcChain");
  const srcAsset = searchParams.get("srcAsset");
  const destChain = searchParams.get("destChain");
  const destAsset = searchParams.get("destAsset");
  const amount = searchParams.get("amount");

  if (!srcChain || !srcAsset || !destChain || !destAsset || !amount) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  try {
    const params = new URLSearchParams({
      srcChain,
      srcAsset,
      destChain,
      destAsset,
      amount,
    });

    const bps = process.env.CHAINFLIP_BROKER_COMMISSION_BPS;
    if (bps && parseInt(bps) > 0) {
      params.set("brokerCommissionBps", bps);
    }

    const res = await fetch(`${CHAINFLIP_BACKEND}/v2/quote?${params}`);

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: text || `Chainflip API error ${res.status}` },
        { status: res.status }
      );
    }

    const quotes = await res.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quote = Array.isArray(quotes) ? quotes.find((q: any) => q.type === "REGULAR") : quotes;
    if (!quote) {
      return NextResponse.json({ error: "No quote available for this pair" }, { status: 404 });
    }

    return NextResponse.json({
      egressAmount: quote.egressAmount,
      estimatedPrice: quote.estimatedPrice,
      estimatedDurationSeconds: quote.estimatedDurationSeconds,
      recommendedSlippageTolerancePercent: quote.recommendedSlippageTolerancePercent,
      recommendedRetryDurationMinutes: quote.recommendedRetryDurationMinutes,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      includedFees: (quote.includedFees ?? []).map((f: any) => ({
        type: f.type,
        amount: f.amount,
        asset: f.asset,
      })),
      lowLiquidityWarning: quote.lowLiquidityWarning ?? false,
      depositAmount: quote.depositAmount,
      srcAsset: quote.srcAsset,
      destAsset: quote.destAsset,
    });
  } catch (e) {
    console.error("Chainflip quote error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Quote request failed" },
      { status: 500 }
    );
  }
}
