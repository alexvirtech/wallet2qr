import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { derivePepper, subHash, isPremium } from "@/lib/pepper";

export async function POST() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Not signed in — no session" }, { status: 401 });
  }
  const provider = session.provider;
  const sub = session.providerSub ?? session.sub;
  if (!provider || !sub) {
    return NextResponse.json(
      { error: `Session missing provider/sub — please sign out and sign back in (provider=${provider ?? "none"}, sub=${sub ? "present" : "none"})` },
      { status: 401 }
    );
  }

  if (!isPremium(session)) {
    // TODO(QRT): return 402 when QRT ledger check is wired up
    return NextResponse.json({ error: "Premium required" }, { status: 402 });
  }

  try {
    // eslint-disable-next-line no-restricted-syntax -- pepper is intentionally returned, never logged
    const pepper = derivePepper(provider, sub);
    const sh = subHash(sub);

    return NextResponse.json({
      provider: session.provider,
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
