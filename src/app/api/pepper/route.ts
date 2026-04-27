import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { derivePepper, subHash, isPremium } from "@/lib/pepper";

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  if (!token) {
    return NextResponse.json({ error: "Not signed in — no token" }, { status: 401 });
  }

  const provider = (token.oauthProvider ?? token.provider ?? null) as string | null;
  const sub = (token.oauthSub ?? token.sub ?? null) as string | null;

  if (!provider || !sub) {
    return NextResponse.json(
      { error: `Token missing provider/sub — sign out and sign back in (keys: ${Object.keys(token).join(",")})` },
      { status: 401 }
    );
  }

  if (!isPremium({ provider, sub })) {
    return NextResponse.json({ error: "Premium required" }, { status: 402 });
  }

  try {
    // eslint-disable-next-line no-restricted-syntax -- pepper is intentionally returned, never logged
    const pepper = derivePepper(provider, sub);
    const sh = subHash(sub);

    return NextResponse.json({
      provider,
      sub_hash: sh,
      pepper,
    });
  } catch {
    return NextResponse.json(
      { error: "Pepper master secret misconfigured" },
      { status: 500 }
    );
  }
}
