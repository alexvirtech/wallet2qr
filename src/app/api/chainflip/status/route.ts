import { NextResponse } from "next/server";

const CHAINFLIP_BACKEND = "https://chainflip-swap.chainflip.io";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${CHAINFLIP_BACKEND}/v2/swaps/${encodeURIComponent(id)}`
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: text || `Chainflip API error ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Status request failed" },
      { status: 500 }
    );
  }
}
