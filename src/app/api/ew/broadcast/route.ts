import { NextRequest, NextResponse } from "next/server";

const EW_BASE = process.env.EXTRAWALLET_API_URL || "https://api-staging.extrawallet.app";
const EW_KEY = process.env.EXTRAWALLET_API_KEY || "";

export async function POST(req: NextRequest) {
  const { chain, tx } = await req.json();

  const res = await fetch(
    `${EW_BASE}/utils/sendrawtransaction?chain=${encodeURIComponent(chain)}&tx=${encodeURIComponent(tx)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(EW_KEY ? { "x-api-key": EW_KEY } : {}),
      },
      signal: AbortSignal.timeout(30_000),
    }
  );

  const data = await res.text();
  return new NextResponse(data, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") || "text/plain" },
  });
}
