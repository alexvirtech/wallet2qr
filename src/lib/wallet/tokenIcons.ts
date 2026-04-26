const TW = "https://assets-cdn.trustwallet.com/blockchains";

const CHAIN_MAP: Record<string, string> = {
  arbitrum: "arbitrum",
  ethereum: "ethereum",
  bnb: "smartchain",
  avalanche: "avalanchec",
  solana: "solana",
  bitcoin: "bitcoin",
};

export function getTokenIconUrl(
  networkKey: string,
  symbol: string,
  tokenAddress: string
): string {
  const chain = CHAIN_MAP[networkKey];
  if (!chain) return "";
  if (!tokenAddress) {
    return `${TW}/${chain}/info/logo.png`;
  }
  return `${TW}/${chain}/assets/${tokenAddress}/logo.png`;
}
