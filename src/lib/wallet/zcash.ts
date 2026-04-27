import { mnemonicToSeedSync } from "@scure/bip39";
import { HDKey } from "@scure/bip32";
import { sha256 } from "@noble/hashes/sha256";
import { ripemd160 } from "@noble/hashes/ripemd160";
import { base58check } from "@scure/base";
import { rateLimitedFetch } from "./rateLimiter";

const ZEC_PATH = "m/44'/133'/0'/0/0";
const ZEC_VERSION = new Uint8Array([0x1c, 0xb8]);

const b58c = base58check(sha256);

export function deriveZcashAccount(mnemonic: string, path?: string) {
  const seed = mnemonicToSeedSync(mnemonic.trim().toLowerCase());
  const hd = HDKey.fromMasterSeed(seed);
  const child = hd.derive(path || ZEC_PATH);

  if (!child.publicKey) throw new Error("Failed to derive Zcash public key");

  const hash = ripemd160(sha256(child.publicKey));
  const payload = new Uint8Array(22);
  payload.set(ZEC_VERSION, 0);
  payload.set(hash, 2);
  const address = b58c.encode(payload);

  const privateKey = Buffer.from(child.privateKey!).toString("hex");

  return { address, privateKey };
}

export async function getZecBalance(
  address: string
): Promise<{ raw: bigint; formatted: string }> {
  try {
    const res = await rateLimitedFetch(
      `https://blockchair.com/zcash/dashboards/address/${address}?limit=0`
    );
    if (!res.ok) throw new Error(`Blockchair ZEC ${res.status}`);
    const data = await res.json();
    const info = data?.data?.[address];
    const satoshis = BigInt(info?.address?.balance ?? 0);
    const formatted = (Number(satoshis) / 1e8).toFixed(8);
    return { raw: satoshis, formatted };
  } catch {
    return { raw: BigInt(0), formatted: "0.00000000" };
  }
}
