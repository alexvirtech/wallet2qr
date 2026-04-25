import { mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { HDKey } from "@scure/bip32";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import { deriveSolanaAccount } from "./solana";
import { deriveBitcoinAccount } from "./bitcoin";
import type { ChainType } from "./networks";

const EVM_PATH = "m/44'/60'/0'/0/0";

export function validateBip39Mnemonic(phrase: string): {
  valid: boolean;
  error?: string;
} {
  const words = phrase.trim().split(/\s+/);
  const validCounts = [12, 15, 18, 21, 24];

  if (!validCounts.includes(words.length)) {
    return {
      valid: false,
      error: `Expected 12, 15, 18, 21, or 24 words, got ${words.length}`,
    };
  }

  const invalidWords = words.filter((w) => !wordlist.includes(w));
  if (invalidWords.length > 0) {
    return {
      valid: false,
      error: `Invalid words: ${invalidWords.join(", ")}`,
    };
  }

  if (!validateMnemonic(phrase.trim().toLowerCase(), wordlist)) {
    return { valid: false, error: "Invalid BIP-39 checksum" };
  }

  return { valid: true };
}

export function deriveEvmAccount(mnemonic: string, path?: string) {
  const seed = mnemonicToSeedSync(mnemonic.trim().toLowerCase());
  const hd = HDKey.fromMasterSeed(seed);
  const child = hd.derive(path || EVM_PATH);
  if (!child.privateKey) throw new Error("Failed to derive private key");

  const privateKeyHex = `0x${Buffer.from(child.privateKey).toString("hex")}` as Hex;
  const account = privateKeyToAccount(privateKeyHex);

  return {
    address: account.address,
    privateKey: privateKeyHex,
    account,
  };
}

export function deriveAccount(mnemonic: string, chainType: ChainType, path?: string) {
  if (chainType === "solana") {
    const sol = deriveSolanaAccount(mnemonic, path);
    return { address: sol.address, privateKey: sol.privateKey };
  }
  if (chainType === "bitcoin") {
    const btc = deriveBitcoinAccount(mnemonic, path);
    return { address: btc.address, privateKey: btc.privateKey };
  }
  const evm = deriveEvmAccount(mnemonic, path);
  return { address: evm.address as string, privateKey: evm.privateKey as string };
}

export function incrementDerivationPath(path: string): string {
  const parts = path.replace(/'/g, "'").split("/");
  const last = parts[parts.length - 1];
  const isHardened = last.endsWith("'");
  const index = parseInt(last.replace("'", ""), 10);
  parts[parts.length - 1] = `${index + 1}${isHardened ? "'" : ""}`;
  return parts.join("/");
}
