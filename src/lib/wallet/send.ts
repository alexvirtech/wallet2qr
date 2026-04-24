import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
  erc20Abi,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { NetworkConfig, TokenConfig } from "./networks";

function buildChain(network: NetworkConfig) {
  return {
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
  const client = createPublicClient({
    transport: http(network.rpcUrl),
    chain: buildChain(network),
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
  const chain = buildChain(network);
  const account = privateKeyToAccount(privateKey);
  const client = createWalletClient({
    account,
    transport: http(network.rpcUrl),
    chain,
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
  const chain = buildChain(network);
  const account = privateKeyToAccount(privateKey);
  const client = createWalletClient({
    account,
    transport: http(network.rpcUrl),
    chain,
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
