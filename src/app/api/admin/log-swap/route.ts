import { NextRequest, NextResponse } from "next/server";
import { appendSwapLog, type SwapLogEntry } from "@/lib/admin/swapLog";

export async function POST(req: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ ok: true, logged: false });
  }

  try {
    const body = await req.json();
    if (!body.provider || !body.fromChain || !body.fromToken || !body.fromAmount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const entry: SwapLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      provider: body.provider,
      fromChain: body.fromChain,
      toChain: body.toChain,
      fromToken: body.fromToken,
      toToken: body.toToken,
      fromAmount: body.fromAmount,
      toAmount: body.toAmount || "",
      txHash: body.txHash || "",
      status: body.status || "pending",
      feeBps: body.feeBps,
      feeAmount: body.feeAmount,
    };
    await appendSwapLog(entry);
    return NextResponse.json({ ok: true, logged: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to log swap" },
      { status: 500 }
    );
  }
}
