import { hmac } from "@noble/hashes/hmac";
import { sha512 } from "@noble/hashes/sha512";
import { ed25519 } from "@noble/curves/ed25519";
import { base58 } from "@scure/base";
import { mnemonicToSeedSync } from "@scure/bip39";
import type { NetworkConfig, TokenConfig } from "./networks";
import { rateLimitedFetch } from "./rateLimiter";

const DEFAULT_SOLANA_PATH = "m/44'/501'/0'/0'";

function parsePath(path: string): number[] {
  return path
    .replace("m/", "")
    .split("/")
    .map((seg) => {
      const hardened = seg.endsWith("'");
      const idx = parseInt(seg.replace("'", ""), 10);
      return hardened ? idx + 0x80000000 : idx;
    });
}

function slip0010Derive(seed: Uint8Array, indices: number[]): Uint8Array {
  let I = hmac(sha512, "ed25519 seed", seed);
  let il = I.slice(0, 32);
  let ir = I.slice(32);

  for (const index of indices) {
    const data = new Uint8Array(37);
    data[0] = 0x00;
    data.set(il, 1);
    data[33] = (index >>> 24) & 0xff;
    data[34] = (index >>> 16) & 0xff;
    data[35] = (index >>> 8) & 0xff;
    data[36] = index & 0xff;
    I = hmac(sha512, ir, data);
    il = I.slice(0, 32);
    ir = I.slice(32);
  }

  return il;
}

export function deriveSolanaAccount(mnemonic: string, path?: string) {
  const seed = mnemonicToSeedSync(mnemonic.trim().toLowerCase());
  const indices = parsePath(path || DEFAULT_SOLANA_PATH);
  const privateKey = slip0010Derive(seed, indices);
  const publicKey = ed25519.getPublicKey(privateKey);
  const address = base58.encode(publicKey);

  return {
    address,
    privateKey: Buffer.from(privateKey).toString("hex"),
    publicKeyBytes: publicKey,
  };
}

export async function getSolNativeBalance(
  network: NetworkConfig,
  address: string
): Promise<{ raw: bigint; formatted: string }> {
  const res = await rateLimitedFetch(network.rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getBalance",
      params: [address],
    }),
  });
  const data = await res.json();
  const lamports = BigInt(data.result?.value ?? 0);
  const formatted = (Number(lamports) / 1e9).toFixed(4);
  return { raw: lamports, formatted };
}

export async function getSplTokenBalance(
  network: NetworkConfig,
  ownerAddress: string,
  mintAddress: string,
): Promise<{ raw: bigint; formatted: string }> {
  const res = await rateLimitedFetch(network.rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenAccountsByOwner",
      params: [
        ownerAddress,
        { mint: mintAddress },
        { encoding: "jsonParsed" },
      ],
    }),
  });
  const data = await res.json();
  const accounts = data.result?.value ?? [];
  if (accounts.length === 0) return { raw: BigInt(0), formatted: "0" };

  const info = accounts[0].account.data.parsed.info;
  const amount = info.tokenAmount;
  return {
    raw: BigInt(amount.amount),
    formatted: amount.uiAmountString ?? "0",
  };
}
