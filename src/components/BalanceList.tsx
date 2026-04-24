"use client";

import { useState, useEffect, useCallback } from "react";
import { type NetworkConfig } from "@/lib/wallet/networks";
import { getNativeBalance, getTokenBalance } from "@/lib/wallet/tokens";
import { getSolNativeBalance, getSplTokenBalance } from "@/lib/wallet/solana";
import { fetchPrices } from "@/lib/wallet/prices";
import { useSettings } from "@/lib/wallet/settings";
import type { Address } from "viem";

interface BalanceItem {
  symbol: string;
  name: string;
  balance: string;
  usdValue: string;
}

interface BalanceListProps {
  network: NetworkConfig;
  address: string;
}

export default function BalanceList({ network, address }: BalanceListProps) {
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

      const items: BalanceItem[] = [];

      if (visibleSymbols.includes(network.nativeCurrency.symbol)) {
        let nativeBal: { formatted: string };
        if (network.chainType === "solana") {
          nativeBal = await getSolNativeBalance(network, address);
        } else {
          nativeBal = await getNativeBalance(network, address as Address);
        }
        const nativePrice = prices[network.nativeCurrency.symbol] ?? 0;
        const nativeUsd = parseFloat(nativeBal.formatted) * nativePrice;
        items.push({
          symbol: network.nativeCurrency.symbol,
          name: network.nativeCurrency.name,
          balance: formatBalance(nativeBal.formatted),
          usdValue: formatUsd(nativeUsd),
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
        items.push({
          symbol: token.symbol,
          name: token.name,
          balance: formatBalance(bal.formatted),
          usdValue: formatUsd(usd),
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
            <div>
              <span className="font-bold text-sm">{b.symbol}</span>
              <span className="text-xs text-gray-400 ml-2">{b.name}</span>
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
