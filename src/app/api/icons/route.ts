import { NextResponse } from "next/server";
import { allNetworks } from "@/lib/wallet/networks";

const ICON_CACHE_TTL = 24 * 60 * 60 * 1000;
const TW = "https://assets-cdn.trustwallet.com/blockchains";
const CHAIN_MAP: Record<string, string> = {
  arbitrum: "arbitrum",
  ethereum: "ethereum",
  bnb: "smartchain",
  avalanche: "avalanchec",
  solana: "solana",
  bitcoin: "bitcoin",
};

let iconCache: { icons: Record<string, string>; timestamp: number } | null = null;

function buildIconEntries(): { key: string; url: string }[] {
  const entries: { key: string; url: string }[] = [];
  for (const [networkKey, network] of Object.entries(allNetworks)) {
    const chain = CHAIN_MAP[networkKey];
    if (!chain) continue;
    entries.push({ key: `${networkKey}:`, url: `${TW}/${chain}/info/logo.png` });
    for (const token of network.tokens) {
      entries.push({
        key: `${networkKey}:${token.address}`,
        url: `${TW}/${chain}/assets/${token.address}/logo.png`,
      });
    }
  }
  return entries;
}

async function fetchIconAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const contentType = res.headers.get("content-type") || "image/png";
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

async function fetchAllIcons(): Promise<Record<string, string>> {
  const entries = buildIconEntries();
  const results = await Promise.allSettled(
    entries.map(async (entry) => {
      const dataUrl = await fetchIconAsBase64(entry.url);
      return { key: entry.key, dataUrl };
    })
  );
  const icons: Record<string, string> = {};
  for (const result of results) {
    if (result.status === "fulfilled" && result.value.dataUrl) {
      icons[result.value.key] = result.value.dataUrl;
    }
  }
  return icons;
}

export async function GET() {
  const now = Date.now();
  if (iconCache && now - iconCache.timestamp < ICON_CACHE_TTL) {
    return NextResponse.json(iconCache.icons, {
      headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600" },
    });
  }
  try {
    const icons = await fetchAllIcons();
    iconCache = { icons, timestamp: now };
    return NextResponse.json(icons, {
      headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600" },
    });
  } catch {
    const fallback = iconCache?.icons ?? {};
    return NextResponse.json(fallback, {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  }
}
