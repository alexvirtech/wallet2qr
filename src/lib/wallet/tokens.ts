import { createPublicClient, http, fallback, erc20Abi, formatUnits, type Address, type Chain } from "viem";
import { arbitrum, mainnet, avalanche } from "viem/chains";
import { type NetworkConfig } from "./networks";

const chainMap: Record<number, Chain> = {
  [arbitrum.id]: arbitrum,
  [mainnet.id]: mainnet,
  [avalanche.id]: avalanche,
};

export function getPublicClient(network: NetworkConfig) {
  const chain = chainMap[network.chainId];
  const transports = [http(network.rpcUrl)];

  if (chain) {
    for (const url of chain.rpcUrls.default.http) {
      if (url !== network.rpcUrl) {
        transports.push(http(url));
      }
    }
  }

  return createPublicClient({
    chain,
    transport: fallback(transports),
    batch: { multicall: true },
  });
}

export async function getNativeBalance(
  network: NetworkConfig,
  address: Address
): Promise<{ raw: bigint; formatted: string }> {
  const client = getPublicClient(network);
  const balance = await client.getBalance({ address });
  return {
    raw: balance,
    formatted: formatUnits(balance, network.nativeCurrency.decimals),
  };
}

export async function getTokenBalance(
  network: NetworkConfig,
  tokenAddress: Address,
  walletAddress: Address,
  decimals: number
): Promise<{ raw: bigint; formatted: string }> {
  const client = getPublicClient(network);
  const balance = await client.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [walletAddress],
  });
  return {
    raw: balance,
    formatted: formatUnits(balance, decimals),
  };
}
