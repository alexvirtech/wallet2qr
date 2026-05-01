import { NextRequest, NextResponse } from "next/server";

const THORNODES = [
  "https://thornode.thorchain.liquify.com/thorchain/quote/swap",
  "https://thornode.ninerealms.com/thorchain/quote/swap",
  "https://thornode-v2.ninerealms.com/thorchain/quote/swap",
];

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams.toString();
  if (!params) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  for (const node of THORNODES) {
    try {
      const res = await fetch(`${node}?${params}`, {
        redirect: "follow",
        signal: AbortSignal.timeout(10_000),
      });
      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json(data, { status: res.status });
      }
      return NextResponse.json(data);
    } catch {
      continue;
    }
  }

  return NextResponse.json(
    { error: "All THORChain nodes unreachable" },
    { status: 502 }
  );
}
