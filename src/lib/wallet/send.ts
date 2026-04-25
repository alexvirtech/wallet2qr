import {
  createWalletClient,
  createPublicClient,
  http,
  fallback,
  parseUnits,
  erc20Abi,
  type Address,
  type Hex,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum, mainnet, avalanche, bsc } from "viem/chains";
import type { NetworkConfig, TokenConfig } from "./networks";

const chainMap: Record<number, Chain> = {
  [arbitrum.id]: arbitrum,
  [mainnet.id]: mainnet,
  [avalanche.id]: avalanche,
  [bsc.id]: bsc,
};

function getChain(network: NetworkConfig): Chain {
  return chainMap[network.chainId] ?? {
    id: network.chainId,
    name: network.name,
    nativeCurrency: network.nativeCurrency,
    rpcUrls: { default: { http: [network.rpcUrl] } },
  };
}

export async function estimateGas(
  network: NetworkConfig,
  from: Address,
  to: Address,
  value: bigint
) {
  const chain = getChain(network);
  const client = createPublicClient({
    chain,
    transport: fallback([http(network.rpcUrl), http()]),
  });
  const gasEstimate = await client.estimateGas({ account: from, to, value });
  const gasPrice = await client.getGasPrice();
  return { gasEstimate, gasPrice, totalGasCost: gasEstimate * gasPrice };
}

export async function sendNative(
  network: NetworkConfig,
  privateKey: Hex,
  to: Address,
  amount: string
): Promise<Hex> {
  const chain = getChain(network);
  const account = privateKeyToAccount(privateKey);
  const client = createWalletClient({
    account,
    chain,
    transport: http(network.rpcUrl),
  });
  const value = parseUnits(amount, network.nativeCurrency.decimals);
  return client.sendTransaction({ to, value, chain });
}

export async function sendToken(
  network: NetworkConfig,
  privateKey: Hex,
  token: TokenConfig,
  to: Address,
  amount: string
): Promise<Hex> {
  const chain = getChain(network);
  const account = privateKeyToAccount(privateKey);
  const client = createWalletClient({
    account,
    chain,
    transport: http(network.rpcUrl),
  });
  const value = parseUnits(amount, token.decimals);
  return client.writeContract({
    address: token.address as Address,
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, value],
    chain,
  });
}
