import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const thorAffiliate =
    process.env.THOR_AFFILIATE || process.env.NEXT_PUBLIC_THOR_AFFILIATE || "";

  const result: Record<string, unknown> = {
    thorAffiliate: thorAffiliate || "(empty)",
    thorAffiliateLength: thorAffiliate.length,
    hasTHOR_AFFILIATE: !!process.env.THOR_AFFILIATE,
    hasNEXT_PUBLIC: !!process.env.NEXT_PUBLIC_THOR_AFFILIATE,
  };

  if (!thorAffiliate) {
    result.error = "No affiliate configured";
    return NextResponse.json(result);
  }

  try {
    const url = `https://gateway.liquify.com/chain/thorchain_midgard/v2/actions?address=${thorAffiliate}&type=swap&limit=10`;
    const res = await fetch(url, { cache: "no-store" });
    result.midgardStatus = res.status;
    result.midgardOk = res.ok;

    if (res.ok) {
      const data = await res.json();
      const actions = data.actions ?? [];
      result.totalActions = actions.length;
      result.affiliateMatches = actions.filter(
        (a: { metadata?: { swap?: { affiliateAddress?: string } } }) =>
          a.metadata?.swap?.affiliateAddress === thorAffiliate
      ).length;
      if (actions.length > 0) {
        result.firstActionAffiliate =
          actions[0]?.metadata?.swap?.affiliateAddress ?? "(none)";
      }
    } else {
      result.midgardBody = await res.text();
    }
  } catch (e) {
    result.fetchError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(result);
}
