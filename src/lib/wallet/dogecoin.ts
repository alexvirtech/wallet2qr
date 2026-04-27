import { mnemonicToSeedSync } from "@scure/bip39";
import { HDKey } from "@scure/bip32";
import { sha256 } from "@noble/hashes/sha256";
import { ripemd160 } from "@noble/hashes/ripemd160";
import { base58check } from "@scure/base";
import { rateLimitedFetch } from "./rateLimiter";

const DOGE_PATH = "m/44'/3'/0'/0/0";
const DOGE_VERSION = 0x1e;

const b58c = base58check(sha256);

export function deriveDogecoinAccount(mnemonic: string, path?: string) {
  const seed = mnemonicToSeedSync(mnemonic.trim().toLowerCase());
  const hd = HDKey.fromMasterSeed(seed);
  const child = hd.derive(path || DOGE_PATH);

  if (!child.publicKey) throw new Error("Failed to derive Dogecoin public key");

  const hash = ripemd160(sha256(child.publicKey));
  const payload = new Uint8Array(21);
  payload[0] = DOGE_VERSION;
  payload.set(hash, 1);
  const address = b58c.encode(payload);

  const privateKey = Buffer.from(child.privateKey!).toString("hex");

  return { address, privateKey };
}

export async function getDogeBalance(
  address: string
): Promise<{ raw: bigint; formatted: string }> {
  try {
    const res = await rateLimitedFetch(
      `https://blockchair.com/dogecoin/dashboards/address/${address}?limit=0`
    );
    if (!res.ok) throw new Error(`Blockchair DOGE ${res.status}`);
    const data = await res.json();
    const info = data?.data?.[address];
    const satoshis = BigInt(info?.address?.balance ?? 0);
    const formatted = (Number(satoshis) / 1e8).toFixed(8);
    return { raw: satoshis, formatted };
  } catch {
    return { raw: BigInt(0), formatted: "0.00000000" };
  }
}
