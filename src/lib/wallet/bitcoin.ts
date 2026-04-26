import { mnemonicToSeedSync } from "@scure/bip39";
import { HDKey } from "@scure/bip32";
import { sha256 } from "@noble/hashes/sha256";
import { ripemd160 } from "@noble/hashes/ripemd160";
import { bech32 } from "@scure/base";

const BTC_PATH = "m/84'/0'/0'/0/0";

export function deriveBitcoinAccount(mnemonic: string, path?: string) {
  const seed = mnemonicToSeedSync(mnemonic.trim().toLowerCase());
  const hd = HDKey.fromMasterSeed(seed);
  const child = hd.derive(path || BTC_PATH);

  if (!child.publicKey) throw new Error("Failed to derive Bitcoin public key");

  const hash = ripemd160(sha256(child.publicKey));
  const words = bech32.toWords(hash);
  words.unshift(0);
  const address = bech32.encode("bc", words);

  const privateKey = Buffer.from(child.privateKey!).toString("hex");

  return { address, privateKey };
}

import { rateLimitedFetch } from "./rateLimiter";

export async function getBtcBalance(
  address: string
): Promise<{ raw: bigint; formatted: string }> {
  try {
    const res = await rateLimitedFetch(`https://mempool.space/api/address/${address}`);
    if (!res.ok) throw new Error(`Mempool API ${res.status}`);
    const data = await res.json();
    const funded = BigInt(data.chain_stats?.funded_txo_sum ?? 0);
    const spent = BigInt(data.chain_stats?.spent_txo_sum ?? 0);
    const mempoolFunded = BigInt(data.mempool_stats?.funded_txo_sum ?? 0);
    const mempoolSpent = BigInt(data.mempool_stats?.spent_txo_sum ?? 0);
    const satoshis = funded - spent + mempoolFunded - mempoolSpent;
    const formatted = (Number(satoshis) / 1e8).toFixed(8);
    return { raw: satoshis, formatted };
  } catch {
    return { raw: BigInt(0), formatted: "0.00000000" };
  }
}
