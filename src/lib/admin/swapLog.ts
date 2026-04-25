import { put, head } from "@vercel/blob";

const BLOB_KEY = "wallet2qr-swap-log.json";

export interface SwapLogEntry {
  id: string;
  timestamp: number;
  provider: "lifi" | "thorchain";
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  txHash: string;
  status: string;
  feeBps?: number;
  feeAmount?: string;
}

export async function readSwapLog(): Promise<SwapLogEntry[]> {
  try {
    const blob = await head(BLOB_KEY);
    if (!blob) return [];
    const res = await fetch(blob.url);
    return res.json();
  } catch {
    return [];
  }
}

export async function appendSwapLog(entry: SwapLogEntry): Promise<void> {
  const existing = await readSwapLog();
  existing.unshift(entry);
  if (existing.length > 1000) existing.length = 1000;
  await put(BLOB_KEY, JSON.stringify(existing), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
  });
}
