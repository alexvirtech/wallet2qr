"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { type NetworkConfig, allNetworks } from "@/lib/wallet/networks";
import { getNativeBalance, getTokenBalance } from "@/lib/wallet/tokens";
import { getSolNativeBalance, getSplTokenBalance } from "@/lib/wallet/solana";
import { getBtcBalance } from "@/lib/wallet/bitcoin";
import { getDogeBalance } from "@/lib/wallet/dogecoin";
import { getZecBalance } from "@/lib/wallet/zcash";
import { fetchPrices } from "@/lib/wallet/prices";
import {
  isProxyEnabled,
  fetchProxyBalances,
  buildBalanceLookup,
  lookupBalance,
} from "@/lib/wallet/proxyClient";
import { useSettings } from "@/lib/wallet/settings";
import { useSession } from "@/lib/state/session";
import { getAssetsForNetwork, type AssetCategory } from "@/lib/wallet/assets";
import TokenIcon from "@/components/TokenIcon";
import type { Address } from "viem";

const FETCH_TIMEOUT = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

export interface BalanceItem {
  symbol: string;
  name: string;
  balance: string;
  rawBalance: number;
  usdValue: string;
  usdNum: number;
  category: AssetCategory;
  address: string;
  tokenType: "native" | "token";
  networkKey: string;
  networkName: string;
}

interface NetworkAccount {
  network: NetworkConfig;
  address: string;
  networkKey: string;
}

interface BalanceListProps {
  accounts: NetworkAccount[];
  hideZero: boolean;
  onTotalChange?: (total: number) => void;
  isDeterministic?: boolean;
}

const BORDER_COLORS: Record<AssetCategory, string> = {
  gas: "border-l-orange-500",
  stablecoin: "border-l-green-500",
  defi: "border-l-purple-500",
  ecosystem: "border-l-blue-500",
};

const CATEGORY_LABELS: Record<AssetCategory, string> = {
  gas: "Gas",
  stablecoin: "Stable",
  defi: "DeFi",
  ecosystem: "Eco",
};

const LS_BALANCES_KEY = "w2q_balances";
const REFRESH_INTERVAL = 60_000;

function loadCachedBalances(): Record<string, BalanceItem[]> {
  try {
    const raw = localStorage.getItem(LS_BALANCES_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveCachedBalances(data: Record<string, BalanceItem[]>) {
  try {
    localStorage.setItem(LS_BALANCES_KEY, JSON.stringify(data));
  } catch {}
}

function cacheKeyFor(accounts: NetworkAccount[]): string {
  return accounts.map((a) => `${a.networkKey}:${a.address}`).join("|");
}

async function refreshViaProxy(
  accounts: NetworkAccount[],
  getVisibleTokens: (key: string) => string[],
): Promise<BalanceItem[]> {
  const evmAccount = accounts.find((a) => a.network.chainType === "evm");
  const solAccount = accounts.find((a) => a.network.chainType === "solana");
  const btcAccount = accounts.find((a) => a.network.chainType === "bitcoin");

  const [prices, proxyResponse] = await Promise.all([
    fetchPrices(),
    fetchProxyBalances(
      evmAccount?.address,
      solAccount?.address,
      btcAccount?.address,
    ),
  ]);

  const balanceMap = buildBalanceLookup(proxyResponse);
  const items: BalanceItem[] = [];

  for (const { network, networkKey } of accounts) {
    const visibleSymbols = getVisibleTokens(networkKey);
    const assetDefs = getAssetsForNetwork(network.key);

    const nativeDecimals = network.nativeCurrency.decimals === 8 ? 8 : 4;

    if (visibleSymbols.includes(network.nativeCurrency.symbol)) {
      const entry = lookupBalance(balanceMap, networkKey, "");
      const raw = entry ? parseFloat(entry.balance) : 0;
      const price = prices[network.nativeCurrency.symbol] ?? 0;
      const usd = raw * price;
      const nativeDef = assetDefs.find((a) => a.symbol === network.nativeCurrency.symbol);
      items.push({
        symbol: network.nativeCurrency.symbol,
        name: network.nativeCurrency.name,
        balance: formatBalance(raw === 0 ? "0" : entry?.balance ?? "0", nativeDecimals),
        rawBalance: raw,
        usdValue: formatUsd(usd),
        usdNum: usd,
        category: nativeDef?.category ?? "gas",
        address: "",
        tokenType: "native",
        networkKey,
        networkName: network.name,
      });
    }

    for (const token of network.tokens) {
      if (!visibleSymbols.includes(token.symbol)) continue;
      const entry = lookupBalance(balanceMap, networkKey, token.address);
      const raw = entry ? parseFloat(entry.balance) : 0;
      const price = prices[token.symbol] ?? 0;
      const usd = raw * price;
      const def = assetDefs.find((a) => a.symbol === token.symbol);
      items.push({
        symbol: token.symbol,
        name: token.name,
        balance: formatBalance(raw === 0 ? "0" : entry?.balance ?? "0"),
        rawBalance: raw,
        usdValue: formatUsd(usd),
        usdNum: usd,
        category: def?.category ?? "ecosystem",
        address: token.address,
        tokenType: "token",
        networkKey,
        networkName: network.name,
      });
    }
  }

  return items;
}

interface BalanceTask {
  symbol: string;
  name: string;
  category: AssetCategory;
  tokenAddress: string;
  tokenType: "native" | "token";
  networkKey: string;
  networkName: string;
  decimals: number;
  fetch: () => Promise<{ formatted: string }>;
}

async function refreshDirect(
  accounts: NetworkAccount[],
  getVisibleTokens: (key: string) => string[],
): Promise<BalanceItem[]> {
  const tasks: BalanceTask[] = [];

  for (const { network, address, networkKey } of accounts) {
    const visibleSymbols = getVisibleTokens(networkKey);
    const assetDefs = getAssetsForNetwork(network.key);
    const nativeDecimals = network.nativeCurrency.decimals === 8 ? 8 : 4;

    if (visibleSymbols.includes(network.nativeCurrency.symbol)) {
      const nativeDef = assetDefs.find((a) => a.symbol === network.nativeCurrency.symbol);
      tasks.push({
        symbol: network.nativeCurrency.symbol,
        name: network.nativeCurrency.name,
        category: nativeDef?.category ?? "gas",
        tokenAddress: "",
        tokenType: "native",
        networkKey,
        networkName: network.name,
        decimals: nativeDecimals,
        fetch: () => {
          if (network.chainType === "bitcoin") return getBtcBalance(address);
          if (network.chainType === "dogecoin") return getDogeBalance(address);
          if (network.chainType === "zcash") return getZecBalance(address);
          if (network.chainType === "solana") return getSolNativeBalance(network, address);
          return getNativeBalance(network, address as Address);
        },
      });
    }

    for (const token of network.tokens) {
      if (!visibleSymbols.includes(token.symbol)) continue;
      const def = assetDefs.find((a) => a.symbol === token.symbol);
      tasks.push({
        symbol: token.symbol,
        name: token.name,
        category: def?.category ?? "ecosystem",
        tokenAddress: token.address,
        tokenType: "token",
        networkKey,
        networkName: network.name,
        decimals: 4,
        fetch: () => {
          if (network.chainType === "solana") return getSplTokenBalance(network, address, token.address);
          return getTokenBalance(network, token.address as Address, address as Address, token.decimals);
        },
      });
    }
  }

  const [priceResult, ...balanceResults] = await Promise.allSettled([
    fetchPrices(),
    ...tasks.map((t) => withTimeout(t.fetch(), FETCH_TIMEOUT)),
  ]);

  const prices = priceResult.status === "fulfilled" ? priceResult.value : {};
  const items: BalanceItem[] = [];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const result = balanceResults[i];
    const formatted = result.status === "fulfilled" ? result.value.formatted : "0";
    const raw = parseFloat(formatted);
    const price = prices[task.symbol] ?? 0;
    const usd = raw * price;
    items.push({
      symbol: task.symbol,
      name: task.name,
      balance: formatBalance(formatted, task.decimals),
      rawBalance: raw,
      usdValue: formatUsd(usd),
      usdNum: usd,
      category: task.category,
      address: task.tokenAddress,
      tokenType: task.tokenType,
      networkKey: task.networkKey,
      networkName: task.networkName,
    });
  }

  return items;
}

export default function BalanceList({ accounts, hideZero, onTotalChange, isDeterministic }: BalanceListProps) {
  const { getVisibleTokens, getDerivationPath } = useSettings();
  const { readOnly } = useSession();

  const zeroBalances = useMemo(() => {
    if (!isDeterministic) return null;
    const items: BalanceItem[] = [];
    for (const { network, networkKey } of accounts) {
      const nativeDef = getAssetsForNetwork(network.key).find((a) => a.symbol === network.nativeCurrency.symbol);
      items.push({
        symbol: network.nativeCurrency.symbol,
        name: network.nativeCurrency.name,
        balance: "0",
        rawBalance: 0,
        usdValue: "$0.00",
        usdNum: 0,
        category: nativeDef?.category ?? "gas",
        address: "",
        tokenType: "native",
        networkKey,
        networkName: network.name,
      });
    }
    return items;
  }, [isDeterministic, accounts]);

  const [balances, setBalances] = useState<BalanceItem[]>(() => {
    if (zeroBalances) return zeroBalances;
    if (typeof window === "undefined") return [];
    const cached = loadCachedBalances();
    return cached[cacheKeyFor(accounts)] ?? [];
  });
  const [loading, setLoading] = useState(() => {
    if (isDeterministic) return false;
    if (typeof window === "undefined") return true;
    const cached = loadCachedBalances();
    return !cached[cacheKeyFor(accounts)];
  });
  const [error, setError] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<BalanceItem | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const accountsRef = useRef(cacheKeyFor(accounts));
  const lastRefreshRef = useRef(0);

  const expectedCount = accounts.reduce(
    (sum, a) => sum + getVisibleTokens(a.networkKey).length,
    0
  );

  const refresh = useCallback(async (silent = false) => {
    if (isDeterministic) return;
    const now = Date.now();
    if (!silent && now - lastRefreshRef.current < 10_000) return;
    lastRefreshRef.current = now;
    if (!silent) setLoading(true);
    setError(null);
    try {
      let items: BalanceItem[];
      if (isProxyEnabled()) {
        try {
          items = await refreshViaProxy(accounts, getVisibleTokens);
        } catch {
          items = await refreshDirect(accounts, getVisibleTokens);
        }
      } else {
        items = await refreshDirect(accounts, getVisibleTokens);
      }

      setBalances(items);
      const cached = loadCachedBalances();
      cached[cacheKeyFor(accounts)] = items;
      saveCachedBalances(cached);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(`Failed to load balances: ${msg}`);
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [accounts, getVisibleTokens, isDeterministic]);

  useEffect(() => {
    if (isDeterministic) {
      if (zeroBalances) setBalances(zeroBalances);
      setLoading(false);
      return;
    }
    const key = cacheKeyFor(accounts);
    if (accountsRef.current !== key) {
      accountsRef.current = key;
      const cached = loadCachedBalances();
      if (cached[key]) {
        setBalances(cached[key]);
        setLoading(false);
        refresh(true);
        return;
      } else {
        setBalances([]);
      }
    }
    refresh(balances.length > 0);
  }, [refresh, isDeterministic, zeroBalances]);

  useEffect(() => {
    if (isDeterministic) return;
    intervalRef.current = setInterval(() => refresh(true), REFRESH_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh, isDeterministic]);

  const filtered = hideZero ? balances.filter((b) => b.rawBalance > 0) : balances;
  const totalUsd = balances.reduce((sum, b) => sum + (isNaN(b.usdNum) ? 0 : b.usdNum), 0);
  const isMultiNetwork = accounts.length > 1;

  useEffect(() => {
    onTotalChange?.(totalUsd);
  }, [totalUsd, onTotalChange]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm text-gray-600 dark:text-gray-300">
          Assets
        </h3>
        <button
          onClick={() => refresh()}
          disabled={loading}
          className="text-xs text-blue-500 hover:text-blue-700 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && <p className="text-red-500 text-xs mb-2">{error}</p>}

      <div className="space-y-2">
        {loading && balances.length === 0
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
          : filtered.length === 0 && !error
            ? (
              <p className="text-xs text-gray-400">
                {hideZero ? "No assets with balance." : "No visible assets. Check Settings."}
              </p>
            )
            : filtered.map((b) => (
              <button
                key={`${b.networkKey}:${b.symbol}`}
                onClick={() => setSelectedAsset(b)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border-l-4 ${BORDER_COLORS[b.category]} bg-white dark:bg-m-blue-dark-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer text-left h-[68px]`}
              >
                <TokenIcon symbol={b.symbol} category={b.category} networkKey={b.networkKey} tokenAddress={b.address} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm">{b.symbol}</span>
                    <span className="text-xs text-gray-400 truncate">{b.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-400">{CATEGORY_LABELS[b.category]}</span>
                    {isMultiNetwork && (
                      <span className="text-[10px] text-gray-400 truncate">{b.networkName}</span>
                    )}
                  </div>
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
          networkName={selectedAsset.networkName}
          blockExplorer={allNetworks[selectedAsset.networkKey]?.blockExplorer ?? ""}
          walletAddress={accounts.find((a) => a.networkKey === selectedAsset.networkKey)?.address ?? ""}
          derivationPath={getDerivationPath(selectedAsset.networkKey)}
          chainType={allNetworks[selectedAsset.networkKey]?.chainType ?? "evm"}
          readOnly={readOnly}
          networkKey={selectedAsset.networkKey}
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
  networkKey,
  readOnly,
  onClose,
}: {
  asset: BalanceItem;
  networkName: string;
  blockExplorer: string;
  walletAddress: string;
  derivationPath: string;
  chainType: string;
  networkKey: string;
  readOnly: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
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

  const canSend = !readOnly && (chainType === "evm" || chainType === "bitcoin");
  const canExchange = !readOnly && chainType === "evm";

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-m-blue-dark-2 rounded-xl w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <TokenIcon symbol={asset.symbol} category={asset.category} networkKey={networkKey} tokenAddress={asset.address} size={40} />
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

          <div className="flex gap-2">
            {canSend && (
              <button
                onClick={() => router.push("/wallet/send")}
                className="flex-1 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg text-sm transition-colors"
              >
                Send
              </button>
            )}
            <button
              onClick={() => router.push("/wallet/receive")}
              className="flex-1 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg text-sm transition-colors"
            >
              Receive
            </button>
            {canExchange && (
              <button
                onClick={() => router.push("/wallet/exchange")}
                className="flex-1 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg text-sm transition-colors"
              >
                Exchange
              </button>
            )}
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

function formatBalance(val: string, decimals = 4): string {
  const n = parseFloat(val);
  if (isNaN(n) || n === 0) return "0";
  const threshold = 1 / Math.pow(10, decimals);
  if (n < threshold) return `<${threshold.toFixed(decimals)}`;
  return n.toFixed(decimals);
}

function formatUsd(val: number): string {
  if (isNaN(val) || val === 0) return "$0.00";
  if (val < 0.01) return "<$0.01";
  return `$${val.toFixed(2)}`;
}
