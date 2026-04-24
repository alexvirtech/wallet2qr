import { createConfig, EVM, Solana } from "@lifi/sdk";
import {
  createWalletClient,
  http,
  type Hex,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, arbitrum, avalanche } from "viem/chains";

const INTEGRATOR = process.env.NEXT_PUBLIC_LIFI_INTEGRATOR || "wallet2qr";

const chainMap: Record<number, Chain> = {
  1: mainnet,
  42161: arbitrum,
  43114: avalanche,
};

export function initLifi() {
  return createConfig({
    integrator: INTEGRATOR,
    providers: [EVM(), Solana()],
  });
}

export function initLifiWithSigner(privateKey: Hex, chainId: number) {
  const chain = chainMap[chainId] ?? mainnet;
  const account = privateKeyToAccount(privateKey);

  return createConfig({
    integrator: INTEGRATOR,
    providers: [
      EVM({
        getWalletClient: async () =>
          createWalletClient({
            account,
            chain,
            transport: http(),
          }),
        switchChain: async (reqChainId: number) => {
          const targetChain = chainMap[reqChainId];
          if (!targetChain) return undefined;
          return createWalletClient({
            account,
            chain: targetChain,
            transport: http(),
          });
        },
      }),
      Solana(),
    ],
  });
}

export function initLifiWithSolana(privateKey: string) {
  return createConfig({
    integrator: INTEGRATOR,
    providers: [
      EVM(),
      Solana({
        getWalletAdapter: async () => {
          const { KeypairWalletAdapter } = await import("@lifi/sdk");
          const adapter = new KeypairWalletAdapter(privateKey);
          await adapter.connect();
          return adapter;
        },
      }),
    ],
  });
}

export { INTEGRATOR };
