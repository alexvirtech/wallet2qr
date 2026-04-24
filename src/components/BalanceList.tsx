"use client";

import { useState, useEffect, useCallback } from "react";
import { type NetworkConfig } from "@/lib/wallet/networks";
import { getNativeBalance, getTokenBalance } from "@/lib/wallet/tokens";
import { fetchPrices } from "@/lib/wallet/prices";
import type { Address } from "viem";

interface BalanceItem {
  symbol: string;
  name: string;
  balance: string;
  usdValue: string;
}

interface BalanceListProps {
  network: NetworkConfig;
  address: Address;
}

export default function BalanceList({ network, address }: BalanceListProps) {
  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prices, nativeBal] = await Promise.all([
        fetchPrices(),
        getNativeBalance(network, address),
      ]);

      const tokenBals = await Promise.all(
        network.tokens.map(async (token) => {
          const bal = await getTokenBalance(
            network,
            token.address as Address,
            address,
            token.decimals
          );
          const price = prices[token.symbol] ?? 0;
          const usd = parseFloat(bal.formatted) * price;
          return {
            symbol: token.symbol,
            name: token.name,
            balance: formatBalance(bal.formatted),
            usdValue: formatUsd(usd),
          };
        })
      );

      const nativePrice = prices[network.nativeCurrency.symbol] ?? 0;
      const nativeUsd = parseFloat(nativeBal.formatted) * nativePrice;

      setBalances([
        {
          symbol: network.nativeCurrency.symbol,
          name: network.nativeCurrency.name,
          balance: formatBalance(nativeBal.formatted),
          usdValue: formatUsd(nativeUsd),
        },
        ...tokenBals,
      ]);
    } catch (e) {
      setError("Failed to load balances");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [network, address]);

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
