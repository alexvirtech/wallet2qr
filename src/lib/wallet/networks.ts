export interface NetworkConfig {
  key: string;
  name: string;
  chainId: number;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrl: string;
  blockExplorer: string;
  tokens: TokenConfig[];
}

export interface TokenConfig {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  coingeckoId: string;
}

const ARB_RPC =
  process.env.NEXT_PUBLIC_ARB_RPC_URL || "https://arb1.arbitrum.io/rpc";
const ETH_RPC =
  process.env.NEXT_PUBLIC_ETH_RPC_URL || "https://eth.llamarpc.com";
const AVAX_RPC =
  process.env.NEXT_PUBLIC_AVAX_RPC_URL || "https://api.avax.network/ext/bc/C/rpc";

export const networks: Record<string, NetworkConfig> = {
  arbitrum: {
    key: "arbitrum",
    name: "Arbitrum One",
    chainId: 42161,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrl: ARB_RPC,
    blockExplorer: "https://arbiscan.io",
    tokens: [
      {
        symbol: "ARB",
        name: "Arbitrum",
        address: "0x912CE59144191C1204E64559FE8253a0e49E6548",
        decimals: 18,
        coingeckoId: "arbitrum",
      },
      {
        symbol: "USDT",
        name: "Tether USD",
        address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
        decimals: 6,
        coingeckoId: "tether",
      },
    ],
  },
  ethereum: {
    key: "ethereum",
    name: "Ethereum Mainnet",
    chainId: 1,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrl: ETH_RPC,
    blockExplorer: "https://etherscan.io",
    tokens: [
      {
        symbol: "USDT",
        name: "Tether USD",
        address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        decimals: 6,
        coingeckoId: "tether",
      },
    ],
  },
  avalanche: {
    key: "avalanche",
    name: "Avalanche C-Chain",
    chainId: 43114,
    nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
    rpcUrl: AVAX_RPC,
    blockExplorer: "https://snowtrace.io",
    tokens: [
      {
        symbol: "USDT",
        name: "Tether USD",
        address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
        decimals: 6,
        coingeckoId: "tether",
      },
    ],
  },
};

export const defaultNetwork = process.env.NEXT_PUBLIC_DEFAULT_NETWORK || "arbitrum";

export function getNetwork(key: string): NetworkConfig {
  return networks[key] ?? networks.arbitrum;
}

export const networkKeys = Object.keys(networks);
