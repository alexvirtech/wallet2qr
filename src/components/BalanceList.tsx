"use client";

import { useState, useEffect, useCallback } from "react";
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
}

interface BalanceListProps {
  network: NetworkConfig;
  address: string;
  showTotalUsd?: boolean;
}

export default function BalanceList({ network, address, showTotalUsd }: BalanceListProps) {
  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getVisibleTokens } = useSettings();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const visibleSymbols = getVisibleTokens(network.key);
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
        });
      }

      setBalances(items);
    } catch (e) {
      setError("Failed to load balances");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [network, address, getVisibleTokens]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const totalUsd = balances.reduce((sum, b) => sum + b.usdNum, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-sm text-gray-600 dark:text-gray-300">
          Balances
        </h3>
        <button
          onClick={refresh}
          disabled={loading}
          className="text-xs text-blue-500 hover:text-blue-700 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {showTotalUsd && !loading && (
        <div className="text-2xl font-bold mb-3">{formatUsd(totalUsd)}</div>
      )}

      {error && <p className="text-m-red text-xs mb-2">{error}</p>}
      {balances.length === 0 && !loading && !error && (
        <p className="text-xs text-gray-400">No visible assets. Check Settings.</p>
      )}
      <div className="space-y-2">
        {balances.map((b) => (
          <div
            key={b.symbol}
            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-m-blue-dark-3 rounded-lg"
          >
            <div className="flex items-center gap-2">
              <div>
                <span className="font-bold text-sm">{b.symbol}</span>
                <span className="text-xs text-gray-400 ml-2">{b.name}</span>
              </div>
              <CategoryBadge category={b.category} />
            </div>
            <div className="text-right">
              <div className="text-sm font-mono">{b.balance}</div>
              <div className="text-xs text-gray-400">{b.usdValue}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryBadge({ category }: { category: AssetCategory }) {
  const colors: Record<AssetCategory, string> = {
    gas: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    stablecoin: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    defi: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    ecosystem: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  };
  const labels: Record<AssetCategory, string> = {
    gas: "Gas",
    stablecoin: "Stable",
    defi: "DeFi",
    ecosystem: "Eco",
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${colors[category]}`}>
      {labels[category]}
    </span>
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
