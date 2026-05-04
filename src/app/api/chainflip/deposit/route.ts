import { NextResponse } from "next/server";
import BigNumber from "bignumber.js";

const CHAINFLIP_BACKEND = "https://chainflip-swap.chainflip.io";
const BLOCK_TIME_SECONDS = 6;
const BLOCKS_PER_MINUTE = 60 / BLOCK_TIME_SECONDS;

const ASSET_DECIMALS: Record<string, number> = {
  BTC: 8,
  ETH: 18,
  USDC: 6,
  USDT: 6,
  FLIP: 18,
};

function getPriceX128(
  price: string,
  srcAsset: string,
  destAsset: string
): string {
  const srcDec = ASSET_DECIMALS[srcAsset] ?? 18;
  const destDec = ASSET_DECIMALS[destAsset] ?? 18;
  return new BigNumber(price)
    .multipliedBy(new BigNumber(2).pow(128))
    .shiftedBy(destDec - srcDec)
    .toFixed(0);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      srcChain,
      srcAsset,
      destChain,
      destAsset,
      amount,
      destAddress,
      refundAddress,
      slippageTolerancePercent,
      retryDurationMinutes,
      quote: quoteData,
    } = body;

    if (!srcChain || !srcAsset || !destChain || !destAsset || !amount || !destAddress) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    let quote = quoteData;
    if (!quote) {
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
      const quoteRes = await fetch(`${CHAINFLIP_BACKEND}/v2/quote?${params}`);
      if (!quoteRes.ok) {
        const text = await quoteRes.text();
        return NextResponse.json(
          { error: text || "Failed to get quote" },
          { status: quoteRes.status }
        );
      }
      const quotes = await quoteRes.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      quote = Array.isArray(quotes) ? quotes.find((q: any) => q.type === "REGULAR") : quotes;
      if (!quote) {
        return NextResponse.json({ error: "No quote available" }, { status: 404 });
      }
    }

    const slippage = new BigNumber(slippageTolerancePercent ?? 2);
    const estimatedPrice = new BigNumber(quote.estimatedPrice);
    const minPrice = estimatedPrice
      .times(new BigNumber(100).minus(slippage).dividedBy(100))
      .toFixed(ASSET_DECIMALS[destAsset] ?? 18);

    const minPriceX128 = getPriceX128(minPrice, srcAsset, destAsset);
    const retryDurationBlocks = Math.max(
      Math.ceil((retryDurationMinutes ?? 10) * BLOCKS_PER_MINUTE),
      0
    );

    const depositBody = {
      srcAsset: { chain: srcChain, asset: srcAsset },
      destAsset: { chain: destChain, asset: destAsset },
      destAddress,
      amount: quote.depositAmount || amount,
      fillOrKillParams: {
        retryDurationBlocks,
        refundAddress: refundAddress || destAddress,
        minPriceX128,
      },
      quote,
      takeCommission: false,
    };

    const res = await fetch(`${CHAINFLIP_BACKEND}/api/openSwapDepositChannel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(depositBody),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Chainflip deposit error response:", text);
      return NextResponse.json(
        { error: text || `Chainflip API error ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    return NextResponse.json({
      depositAddress: data.depositAddress,
      depositChannelId: data.id,
      estimatedExpiryTime: data.estimatedExpiryTime ?? null,
    });
  } catch (e) {
    console.error("Chainflip deposit error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Deposit request failed" },
      { status: 500 }
    );
  }
}
