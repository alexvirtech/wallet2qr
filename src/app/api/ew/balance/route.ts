import { NextRequest, NextResponse } from "next/server";

const EW_BASE = process.env.EXTRAWALLET_API_URL || "https://api-staging.extrawallet.app";
const EW_KEY = process.env.EXTRAWALLET_API_KEY || "";

export async function POST(req: NextRequest) {
  const body = await req.text();

  const res = await fetch(`${EW_BASE}/balance`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(EW_KEY ? { "x-api-key": EW_KEY } : {}),
    },
    body,
    signal: AbortSignal.timeout(9_000),
  });

  const data = await res.text();
  return new NextResponse(data, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
