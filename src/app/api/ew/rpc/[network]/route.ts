import { NextRequest, NextResponse } from "next/server";

const EW_BASE = process.env.EXTRAWALLET_API_URL || "https://api-staging.extrawallet.app";
const EW_KEY = process.env.EXTRAWALLET_API_KEY || "";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ network: string }> }
) {
  const { network } = await params;
  const body = await req.text();

  const res = await fetch(`${EW_BASE}/utils/rpc/${network}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(EW_KEY ? { "x-api-key": EW_KEY } : {}),
    },
    body,
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });

  const data = await res.text();
  return new NextResponse(data, {
    status: res.status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
