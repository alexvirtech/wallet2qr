import type { ChainType } from "./networks";

export interface DerivationScheme {
  id: string;
  name: string;
  template: string;
  chainTypes: ChainType[];
}

export const DERIVATION_SCHEMES: DerivationScheme[] = [
  { id: "bip44-standard", name: "BIP-44 Standard (MetaMask, Coinomi, Trezor)", template: "m/44'/60'/0'/0/{i}", chainTypes: ["evm"] },
  { id: "ledger-live", name: "Ledger Live", template: "m/44'/60'/{i}'/0/0", chainTypes: ["evm"] },
  { id: "ledger-legacy", name: "Ledger Legacy / MEW", template: "m/44'/60'/0'/{i}", chainTypes: ["evm"] },
  { id: "bip84-segwit", name: "BIP-84 Native SegWit", template: "m/84'/0'/0'/0/{i}", chainTypes: ["bitcoin"] },
  { id: "bip84-account", name: "BIP-84 Account-level", template: "m/84'/0'/{i}'/0/0", chainTypes: ["bitcoin"] },
  { id: "bip44-btc", name: "BIP-44 Legacy", template: "m/44'/0'/0'/0/{i}", chainTypes: ["bitcoin"] },
  { id: "solana-standard", name: "Phantom / Solflare", template: "m/44'/501'/{i}'/0'", chainTypes: ["solana"] },
  { id: "solana-bip44", name: "Solana BIP-44", template: "m/44'/501'/{i}'/0/0", chainTypes: ["solana"] },
];

export function getSchemesForChainType(chainType: ChainType): DerivationScheme[] {
  return DERIVATION_SCHEMES.filter((s) => s.chainTypes.includes(chainType));
}

export function getScheme(id: string): DerivationScheme | undefined {
  return DERIVATION_SCHEMES.find((s) => s.id === id);
}

export function resolveTemplate(template: string, index: number): string {
  return template.replace("{i}", String(index));
}

export function getDefaultSchemeId(chainType: ChainType): string {
  if (chainType === "bitcoin") return "bip84-segwit";
  if (chainType === "solana") return "solana-standard";
  return "bip44-standard";
}

export function getNextIndex(template: string, existingPaths: string[]): number {
  let maxIndex = -1;
  for (const path of existingPaths) {
    for (let i = 0; i < 1000; i++) {
      if (resolveTemplate(template, i) === path) {
        maxIndex = Math.max(maxIndex, i);
        break;
      }
    }
  }
  return maxIndex + 1;
}
