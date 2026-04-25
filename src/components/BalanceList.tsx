"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { type NetworkConfig } from "@/lib/wallet/networks";
import { getNativeBalance, getTokenBalance } from "@/lib/wallet/tokens";
import { getSolNativeBalance, getSplTokenBalance } from "@/lib/wallet/solana";
import { getBtcBalance } from "@/lib/wallet/bitcoin";
import { fetchPrices } from "@/lib/wallet/prices";
import { useSettings } from "@/lib/wallet/settings";
import { getAssetsForNetwork, type AssetCategory } from "@/lib/wallet/assets";
import type { Address } from "viem";

interface BalanceItem {
  symbol: string;
  name: string;
  balance: string;
  usdValue: string;
  usdNum: number;
  category: AssetCategory;
  address: string;
  tokenType: "native" | "token";
}

interface BalanceListProps {
  network: NetworkConfig;
  address: string;
  showTotalUsd?: boolean;
  networkKey: string;
}

const BORDER_COLORS: Record<AssetCategory, string> = {
  gas: "border-l-orange-500",
  stablecoin: "border-l-green-500",
  defi: "border-l-purple-500",
  ecosystem: "border-l-blue-500",
};

const AVATAR_COLORS: Record<AssetCategory, string> = {
  gas: "bg-orange-500",
  stablecoin: "bg-green-500",
  defi: "bg-purple-500",
  ecosystem: "bg-blue-500",
};

const CATEGORY_LABELS: Record<AssetCategory, string> = {
  gas: "Gas",
  stablecoin: "Stable",
  defi: "DeFi",
  ecosystem: "Eco",
};

export default function BalanceList({ network, address, showTotalUsd, networkKey }: BalanceListProps) {
  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<BalanceItem | null>(null);
  const { getVisibleTokens, getDerivationPath } = useSettings();

  const expectedCount = getVisibleTokens(networkKey).length;
  const prevKeyRef = useRef(networkKey);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const visibleSymbols = getVisibleTokens(networkKey);
      const prices = await fetchPrices();
      const assetDefs = getAssetsForNetwork(network.key);

      const items: BalanceItem[] = [];

      if (visibleSymbols.includes(network.nativeCurrency.symbol)) {
        let nativeBal: { formatted: string };
        if (network.chainType === "bitcoin") {
          nativeBal = await getBtcBalance(address);
        } else if (network.chainType === "solana") {
          nativeBal = await getSolNativeBalance(network, address);
        } else {
          nativeBal = await getNativeBalance(network, address as Address);
        }
        const nativePrice = prices[network.nativeCurrency.symbol] ?? 0;
        const nativeUsd = parseFloat(nativeBal.formatted) * nativePrice;
        const nativeDef = assetDefs.find((a) => a.symbol === network.nativeCurrency.symbol);
        items.push({
          symbol: network.nativeCurrency.symbol,
          name: network.nativeCurrency.name,
          balance: formatBalance(nativeBal.formatted),
          usdValue: formatUsd(nativeUsd),
          usdNum: nativeUsd,
          category: nativeDef?.category ?? "gas",
          address: "",
          tokenType: "native",
        });
      }

      for (const token of network.tokens) {
        if (!visibleSymbols.includes(token.symbol)) continue;
        let bal: { formatted: string };
        if (network.chainType === "solana") {
          bal = await getSplTokenBalance(network, address, token.address);
        } else {
          bal = await getTokenBalance(
            network,
            token.address as Address,
            address as Address,
            token.decimals
          );
        }
        const price = prices[token.symbol] ?? 0;
        const usd = parseFloat(bal.formatted) * price;
        const def = assetDefs.find((a) => a.symbol === token.symbol);
        items.push({
          symbol: token.symbol,
          name: token.name,
          balance: formatBalance(bal.formatted),
          usdValue: formatUsd(usd),
          usdNum: usd,
          category: def?.category ?? "ecosystem",
          address: token.address,
          tokenType: "token",
        });
      }

      setBalances(items);
    } catch (e) {
      setError("Failed to load balances");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [network, address, networkKey, getVisibleTokens]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (prevKeyRef.current !== networkKey) {
      prevKeyRef.current = networkKey;
      setBalances([]);
    }
  }, [networkKey]);

  const totalUsd = balances.reduce((sum, b) => sum + b.usdNum, 0);
  const derivationPath = getDerivationPath(networkKey);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm text-gray-600 dark:text-gray-300">
          Assets
        </h3>
        <button
          onClick={refresh}
          disabled={loading}
          className="text-xs text-blue-500 hover:text-blue-700 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {showTotalUsd && (
        <div className="h-9 mb-3 flex items-center">
          {loading ? (
            <div className="h-7 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ) : (
            <span className="text-2xl font-bold">{formatUsd(totalUsd)}</span>
          )}
        </div>
      )}

      {error && <p className="text-m-red text-xs mb-2">{error}</p>}

      <div className="space-y-2">
        {loading
          ? Array.from({ length: Math.max(expectedCount, 2) }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-lg border-l-4 border-l-gray-300 dark:border-l-gray-600 bg-white dark:bg-m-blue-dark-3 shadow-sm h-[68px]"
              >
                <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-600 animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-20 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                  <div className="h-3 w-12 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <div className="h-4 w-16 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                  <div className="h-3 w-12 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                </div>
              </div>
            ))
          : balances.length === 0 && !error
            ? (
              <p className="text-xs text-gray-400">No visible assets. Check Settings.</p>
            )
            : balances.map((b) => (
              <button
                key={b.symbol}
                onClick={() => setSelectedAsset(b)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border-l-4 ${BORDER_COLORS[b.category]} bg-white dark:bg-m-blue-dark-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer text-left h-[68px]`}
              >
                <div className={`w-9 h-9 rounded-full ${AVATAR_COLORS[b.category]} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                  {b.symbol[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm">{b.symbol}</span>
                    <span className="text-xs text-gray-400 truncate">{b.name}</span>
                  </div>
                  <span className="text-[10px] text-gray-400">{CATEGORY_LABELS[b.category]}</span>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold font-mono">{b.balance}</div>
                  <div className="text-xs text-gray-400">{b.usdValue}</div>
                </div>
              </button>
            ))
        }
      </div>

      {selectedAsset && (
        <AssetDetailModal
          asset={selectedAsset}
          networkName={network.name}
          blockExplorer={network.blockExplorer}
          walletAddress={address}
          derivationPath={derivationPath}
          chainType={network.chainType}
          onClose={() => setSelectedAsset(null)}
        />
      )}
    </div>
  );
}

function AssetDetailModal({
  asset,
  networkName,
  blockExplorer,
  walletAddress,
  derivationPath,
  chainType,
  onClose,
}: {
  asset: BalanceItem;
  networkName: string;
  blockExplorer: string;
  walletAddress: string;
  derivationPath: string;
  chainType: string;
  onClose: () => void;
}) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyText = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const explorerLink =
    asset.tokenType === "native"
      ? `${blockExplorer}/address/${walletAddress}`
      : chainType === "solana"
        ? `${blockExplorer}/address/${asset.address}`
        : `${blockExplorer}/token/${asset.address}`;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-m-blue-dark-2 rounded-xl w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${AVATAR_COLORS[asset.category]} flex items-center justify-center text-white font-bold`}>
              {asset.symbol[0]}
            </div>
            <div>
              <span className="font-bold text-lg">{asset.symbol}</span>
              <span className="text-sm text-gray-400 ml-2">{asset.name}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
          >
            x
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex justify-between items-baseline">
            <span className="text-2xl font-bold font-mono">{asset.balance}</span>
            <span className="text-sm text-gray-400">{asset.usdValue}</span>
          </div>

          <DetailRow label="Network" value={networkName} />

          <DetailRow
            label="Wallet Address"
            value={walletAddress}
            mono
            onCopy={() => copyText(walletAddress, "wallet")}
            copied={copiedField === "wallet"}
          />

          {asset.tokenType === "token" && asset.address && (
            <DetailRow
              label="Contract Address"
              value={asset.address}
              mono
              onCopy={() => copyText(asset.address, "contract")}
              copied={copiedField === "contract"}
            />
          )}

          <DetailRow label="Derivation Path" value={derivationPath} mono />

          <a
            href={explorerLink}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center text-sm text-blue-500 hover:text-blue-700 py-2 border border-blue-200 dark:border-blue-800 rounded-lg mt-2"
          >
            View on Explorer
          </a>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  mono?: boolean;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">{label}</p>
      <div className="flex items-center gap-2">
        <p className={`text-sm break-all ${mono ? "font-mono" : ""}`}>{value}</p>
        {onCopy && (
          <button
            onClick={onCopy}
            className="text-[10px] text-blue-500 hover:text-blue-700 whitespace-nowrap flex-shrink-0"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>
    </div>
  );
}

function formatBalance(val: string): string {
  const n = parseFloat(val);
  if (n === 0) return "0";
  if (n < 0.0001) return "<0.0001";
  return n.toFixed(4);
}

function formatUsd(val: number): string {
  if (val === 0) return "$0.00";
  return `$${val.toFixed(2)}`;
}
