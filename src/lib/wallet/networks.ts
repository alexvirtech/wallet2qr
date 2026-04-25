export type ChainType = "evm" | "solana" | "bitcoin";

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
const BNB_RPC =
  process.env.NEXT_PUBLIC_BNB_RPC_URL || "https://bsc-rpc.publicnode.com";

export const allNetworks: Record<string, NetworkConfig> = {
  arbitrum: {
    key: "arbitrum",
    name: "Arbitrum One",
    chainId: 42161,
    chainType: "evm",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrl: ARB_RPC,
    blockExplorer: "https://arbiscan.io",
    derivationPath: "m/44'/60'/0'/0/0",
    isDefault: true,
    tokens: [
      { symbol: "ARB", name: "Arbitrum", address: "0x912CE59144191C1204E64559FE8253a0e49E6548", decimals: 18, coingeckoId: "arbitrum" },
      { symbol: "USDT", name: "Tether USD", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6, coingeckoId: "tether" },
      { symbol: "USDC", name: "USD Coin", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6, coingeckoId: "usd-coin" },
      { symbol: "GMX", name: "GMX", address: "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a", decimals: 18, coingeckoId: "gmx" },
    ],
  },
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
      { symbol: "USDT", name: "Tether USD", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6, coingeckoId: "tether" },
      { symbol: "USDC", name: "USD Coin", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6, coingeckoId: "usd-coin" },
      { symbol: "LINK", name: "Chainlink", address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", decimals: 18, coingeckoId: "chainlink" },
      { symbol: "UNI", name: "Uniswap", address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", decimals: 18, coingeckoId: "uniswap" },
    ],
  },
  bnb: {
    key: "bnb",
    name: "BNB Chain",
    chainId: 56,
    chainType: "evm",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrl: BNB_RPC,
    blockExplorer: "https://bscscan.com",
    derivationPath: "m/44'/60'/0'/0/0",
    isDefault: true,
    tokens: [
      { symbol: "USDT", name: "Tether USD", address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18, coingeckoId: "tether" },
      { symbol: "USDC", name: "USD Coin", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18, coingeckoId: "usd-coin" },
      { symbol: "CAKE", name: "PancakeSwap", address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", decimals: 18, coingeckoId: "pancakeswap-token" },
      { symbol: "FDUSD", name: "First Digital USD", address: "0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409", decimals: 18, coingeckoId: "first-digital-usd" },
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
      { symbol: "USDT", name: "Tether USD", address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", decimals: 6, coingeckoId: "tether" },
      { symbol: "USDC", name: "USD Coin", address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", decimals: 6, coingeckoId: "usd-coin" },
      { symbol: "JOE", name: "Trader Joe", address: "0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd", decimals: 18, coingeckoId: "joe" },
      { symbol: "QI", name: "BENQI", address: "0x8729438EB15e2C8B576fCc6AeCdA6A148776C0F5", decimals: 18, coingeckoId: "benqi" },
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
    isDefault: true,
    tokens: [
      { symbol: "USDT", name: "Tether USD", address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6, coingeckoId: "tether" },
      { symbol: "USDC", name: "USD Coin", address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6, coingeckoId: "usd-coin" },
      { symbol: "JUP", name: "Jupiter", address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", decimals: 6, coingeckoId: "jupiter-exchange-solana" },
      { symbol: "PYTH", name: "Pyth Network", address: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", decimals: 6, coingeckoId: "pyth-network" },
    ],
  },
  bitcoin: {
    key: "bitcoin",
    name: "Bitcoin",
    chainId: 0,
    chainType: "bitcoin",
    nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 8 },
    rpcUrl: "",
    blockExplorer: "https://mempool.space",
    derivationPath: "m/84'/0'/0'/0/0",
    isDefault: true,
    tokens: [],
  },
};

export function getNetwork(key: string): NetworkConfig {
  return allNetworks[key] ?? allNetworks.arbitrum;
}

export const allNetworkKeys = Object.keys(allNetworks);
