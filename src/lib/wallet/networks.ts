export type ChainType = "evm" | "solana";

export interface NetworkConfig {
  key: string;
  name: string;
  chainId: number;
  chainType: ChainType;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrl: string;
  blockExplorer: string;
  derivationPath: string;
  isDefault: boolean;
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
  process.env.NEXT_PUBLIC_ARB_RPC_URL || "https://arbitrum-one-rpc.publicnode.com";
const ETH_RPC =
  process.env.NEXT_PUBLIC_ETH_RPC_URL || "https://ethereum-rpc.publicnode.com";
const AVAX_RPC =
  process.env.NEXT_PUBLIC_AVAX_RPC_URL || "https://avalanche-c-chain-rpc.publicnode.com";
const SOL_RPC =
  process.env.NEXT_PUBLIC_SOL_RPC_URL || "https://api.mainnet-beta.solana.com";

export const allNetworks: Record<string, NetworkConfig> = {
  ethereum: {
    key: "ethereum",
    name: "Ethereum Mainnet",
    chainId: 1,
    chainType: "evm",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrl: ETH_RPC,
    blockExplorer: "https://etherscan.io",
    derivationPath: "m/44'/60'/0'/0/0",
    isDefault: true,
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
  arbitrum: {
    key: "arbitrum",
    name: "Arbitrum One",
    chainId: 42161,
    chainType: "evm",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrl: ARB_RPC,
    blockExplorer: "https://arbiscan.io",
    derivationPath: "m/44'/60'/0'/0/0",
    isDefault: false,
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
  avalanche: {
    key: "avalanche",
    name: "Avalanche C-Chain",
    chainId: 43114,
    chainType: "evm",
    nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
    rpcUrl: AVAX_RPC,
    blockExplorer: "https://snowtrace.io",
    derivationPath: "m/44'/60'/0'/0/0",
    isDefault: true,
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
  solana: {
    key: "solana",
    name: "Solana",
    chainId: 1151111081099710,
    chainType: "solana",
    nativeCurrency: { name: "Solana", symbol: "SOL", decimals: 9 },
    rpcUrl: SOL_RPC,
    blockExplorer: "https://explorer.solana.com",
    derivationPath: "m/44'/501'/0'/0'",
    isDefault: false,
    tokens: [
      {
        symbol: "USDT",
        name: "Tether USD",
        address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
        decimals: 6,
        coingeckoId: "tether",
      },
    ],
  },
};

export function getNetwork(key: string): NetworkConfig {
  return allNetworks[key] ?? allNetworks.ethereum;
}

export const allNetworkKeys = Object.keys(allNetworks);
