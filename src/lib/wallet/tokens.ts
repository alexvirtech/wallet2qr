import { createPublicClient, http, erc20Abi, formatUnits, type Address } from "viem";
import { type NetworkConfig } from "./networks";

export function getPublicClient(network: NetworkConfig) {
  return createPublicClient({
    transport: http(network.rpcUrl),
    chain: {
      id: network.chainId,
      name: network.name,
      nativeCurrency: network.nativeCurrency,
      rpcUrls: { default: { http: [network.rpcUrl] } },
    },
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
