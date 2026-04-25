import { NextRequest, NextResponse } from "next/server";

const THORNODE = "https://thornode.ninerealms.com/thorchain/quote/swap";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams.toString();
  if (!params) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  try {
    const res = await fetch(`${THORNODE}?${params}`, { redirect: "follow" });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "THORChain API unreachable" },
      { status: 502 }
    );
  }
}
