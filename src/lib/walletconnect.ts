import { Core } from "@walletconnect/core";
import { WalletKit, type WalletKitTypes } from "@reown/walletkit";
import { type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, http } from "viem";
import { allNetworks } from "@/lib/wallet/networks";
import { deriveEvmAccount } from "@/lib/wallet/derive";

export type SessionProposal = WalletKitTypes.SessionProposal;
export type SessionRequest = WalletKitTypes.SessionRequest;

const PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

let walletKit: InstanceType<typeof WalletKit> | null = null;
let initPromise: Promise<InstanceType<typeof WalletKit>> | null = null;

export async function getWalletKit(): Promise<InstanceType<typeof WalletKit>> {
  if (walletKit) return walletKit;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const core = new Core({ projectId: PROJECT_ID });
    walletKit = await WalletKit.init({
      core,
      metadata: {
        name: "wallet2qr",
        description: "Your crypto wallet, sealed in a QR code.",
        url: "https://wallet2qr.com",
        icons: ["https://wallet2qr.com/logo.png"],
      },
    });
    return walletKit;
  })();
  return initPromise;
}

const EVM_CHAINS = [
  { key: "ethereum", chainId: 1 },
  { key: "arbitrum", chainId: 42161 },
  { key: "bnb", chainId: 56 },
  { key: "avalanche", chainId: 43114 },
];

export function getEvmAddress(mnemonic: string): string {
  const { address } = deriveEvmAccount(mnemonic);
  return address;
}

export function buildApprovalNamespaces(
  proposal: SessionProposal,
  evmAddress: string
) {
  const required = proposal.params.requiredNamespaces;
  const optional = proposal.params.optionalNamespaces;

  const supportedChainIds = EVM_CHAINS.map((c) => c.chainId);
  const supportedCaip2 = supportedChainIds.map((id) => `eip155:${id}`);

  const requestedChains = [
    ...(required?.eip155?.chains ?? []),
    ...(optional?.eip155?.chains ?? []),
  ];

  const approvedChains = requestedChains.length > 0
    ? requestedChains.filter((c) => supportedCaip2.includes(c))
    : supportedCaip2;

  if (approvedChains.length === 0) {
    return null;
  }

  const accounts = approvedChains.map((c) => `${c}:${evmAddress}`);

  const methods = [
    "eth_sendTransaction",
    "personal_sign",
    "eth_sign",
    "eth_signTransaction",
    "eth_signTypedData",
    "eth_signTypedData_v4",
  ];

  const events = ["chainChanged", "accountsChanged"];

  return {
    eip155: {
      chains: approvedChains,
      accounts,
      methods,
      events,
    },
  };
}

function getChainIdFromRequest(chainId: string): number {
  const parts = chainId.split(":");
  return parseInt(parts[1], 10);
}

function getNetworkByChainId(chainId: number) {
  return Object.values(allNetworks).find(
    (n) => n.chainId === chainId && n.chainType === "evm"
  );
}

export async function handleSessionRequest(
  request: SessionRequest,
  mnemonic: string
): Promise<unknown> {
  const { method, params } = request.params.request;
  const chainId = getChainIdFromRequest(request.params.chainId);
  const { privateKey } = deriveEvmAccount(mnemonic);
  const account = privateKeyToAccount(privateKey);

  switch (method) {
    case "personal_sign": {
      const [message] = params as [string, string];
      return account.signMessage({ message: { raw: message as Hex } });
    }

    case "eth_sign": {
      const [, message] = params as [string, string];
      return account.signMessage({ message: { raw: message as Hex } });
    }

    case "eth_signTypedData":
    case "eth_signTypedData_v4": {
      const [, typedDataStr] = params as [string, string];
      const typedData = typeof typedDataStr === "string"
        ? JSON.parse(typedDataStr)
        : typedDataStr;
      return account.signTypedData({
        domain: typedData.domain,
        types: typedData.types,
        primaryType: typedData.primaryType,
        message: typedData.message,
      });
    }

    case "eth_sendTransaction": {
      const [tx] = params as [Record<string, string>];
      const network = getNetworkByChainId(chainId);
      if (!network) throw new Error(`Unsupported chain ${chainId}`);
      const client = createWalletClient({
        account,
        chain: {
          id: network.chainId,
          name: network.name,
          nativeCurrency: network.nativeCurrency,
          rpcUrls: { default: { http: [network.rpcUrl] } },
        },
        transport: http(network.rpcUrl),
      });
      return client.sendTransaction({
        to: tx.to as Hex,
        value: tx.value ? BigInt(tx.value) : BigInt(0),
        data: (tx.data || tx.input || "0x") as Hex,
        gas: tx.gas ? BigInt(tx.gas) : undefined,
        gasPrice: tx.gasPrice ? BigInt(tx.gasPrice) : undefined,
      });
    }

    case "eth_signTransaction": {
      const [txToSign] = params as [Record<string, string>];
      return account.signTransaction({
        to: txToSign.to as Hex,
        value: txToSign.value ? BigInt(txToSign.value) : BigInt(0),
        data: (txToSign.data || "0x") as Hex,
        gas: txToSign.gas ? BigInt(txToSign.gas) : undefined,
        gasPrice: txToSign.gasPrice ? BigInt(txToSign.gasPrice) : undefined,
        chainId,
      });
    }

    default:
      throw new Error(`Unsupported method: ${method}`);
  }
}

export function formatChainId(caip2: string): string {
  const id = getChainIdFromRequest(caip2);
  const network = getNetworkByChainId(id);
  return network?.name ?? `Chain ${id}`;
}

export function describeRequest(method: string): string {
  switch (method) {
    case "personal_sign":
    case "eth_sign":
      return "Sign Message";
    case "eth_signTypedData":
    case "eth_signTypedData_v4":
      return "Sign Typed Data";
    case "eth_sendTransaction":
      return "Send Transaction";
    case "eth_signTransaction":
      return "Sign Transaction";
    default:
      return method;
  }
}
