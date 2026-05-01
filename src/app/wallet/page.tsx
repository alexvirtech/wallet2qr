"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/state/session";
import { useSettings } from "@/lib/wallet/settings";
import { deriveAccount } from "@/lib/wallet/derive";
import { getNetwork } from "@/lib/wallet/networks";
import { prefetchIcons } from "@/lib/wallet/prices";
import NetworkSwitcher from "@/components/NetworkSwitcher";
import BalanceList from "@/components/BalanceList";
import QRCode from "qrcode";

export default function WalletPage() {
  const { mnemonic, isUnlocked, isDeterministic } = useSession();
  const { settings, getActiveNetworkKeys, getDerivationPath } = useSettings();
  const router = useRouter();

  const activeKeys = getActiveNetworkKeys();
  const [networkKey, setNetworkKey] = useState(() => {
    if (isDeterministic) return "ethereum";
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("w2q_network");
      if (stored && (stored === "all" || activeKeys.includes(stored))) return stored;
    }
    return "all";
  });
  const [hideZero, setHideZero] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("w2q_hideZero");
      return stored === null ? true : stored === "true";
    }
    return true;
  });
  const [totalUsd, setTotalUsd] = useState(0);
  const [copied, setCopied] = useState(false);
  const addressQrRef = useRef<HTMLCanvasElement>(null);

  const isAllNetworks = networkKey === "all";

  const handleNetworkChange = useCallback((key: string) => {
    setNetworkKey(key);
    try { localStorage.setItem("w2q_network", key); } catch {}
  }, []);

  const handleHideZeroChange = useCallback((val: boolean) => {
    setHideZero(val);
    try { localStorage.setItem("w2q_hideZero", String(val)); } catch {}
  }, []);

  useEffect(() => { prefetchIcons(); }, []);

  useEffect(() => {
    if (!isUnlocked) router.push("/qr-to-wallet");
  }, [isUnlocked, router]);

  useEffect(() => {
    if (networkKey !== "all" && !activeKeys.includes(networkKey) && activeKeys.length > 0) {
      handleNetworkChange("all");
    }
  }, [activeKeys, networkKey, handleNetworkChange]);

  const allAccounts = useMemo(() => {
    if (!mnemonic) return [];
    return activeKeys.map((key) => {
      const network = getNetwork(key);
      const derivationPath = getDerivationPath(key);
      try {
        const acc = deriveAccount(mnemonic, network.chainType, derivationPath);
        return { network, address: acc.address, networkKey: key };
      } catch {
        return null;
      }
    }).filter(Boolean) as Array<{ network: ReturnType<typeof getNetwork>; address: string; networkKey: string }>;
  }, [mnemonic, activeKeys, getDerivationPath]);

  const currentAccount = useMemo(() => {
    if (isAllNetworks) return null;
    return allAccounts.find((a) => a.networkKey === networkKey) ?? null;
  }, [allAccounts, networkKey, isAllNetworks]);

  const balanceAccounts = useMemo(() => {
    if (isAllNetworks) return allAccounts;
    return currentAccount ? [currentAccount] : [];
  }, [isAllNetworks, allAccounts, currentAccount]);

  const network = useMemo(() => isAllNetworks ? null : getNetwork(networkKey), [networkKey, isAllNetworks]);
  const accounts = settings.networks[networkKey]?.accounts ?? [];
  const activeIdx = settings.networks[networkKey]?.activeAccountIndex ?? 0;

  useEffect(() => {
    if (addressQrRef.current && currentAccount) {
      QRCode.toCanvas(addressQrRef.current, currentAccount.address, {
        width: 120,
        margin: 1,
      });
    }
  }, [currentAccount]);

  const copyAddress = useCallback(() => {
    if (!currentAccount) return;
    navigator.clipboard.writeText(currentAccount.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [currentAccount]);

  if (!isUnlocked || allAccounts.length === 0) {
    if (!isUnlocked) return null;
    return (
      <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 text-center">
        <h1 className="text-2xl font-bold mb-4">Wallet</h1>
        <p className="text-gray-500 mb-4">
          No networks added. Go to Settings to add a network.
        </p>
        <button
          onClick={() => router.push("/wallet/settings")}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg text-sm"
        >
          Open Settings
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">Wallet</h1>
        <NetworkSwitcher current={networkKey} onChange={handleNetworkChange} showAll />
      </div>

      {/* Total balance */}
      <div className="h-10 mb-4 flex items-center justify-between">
        <span className="text-2xl font-bold">
          {totalUsd > 0
            ? totalUsd >= 1e9 ? `$${(totalUsd / 1e9).toFixed(2)}B`
              : totalUsd >= 1e6 ? `$${(totalUsd / 1e6).toFixed(2)}M`
              : `$${totalUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : "$0.00"}
        </span>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-gray-400">Non-zero</span>
          <div
            onClick={() => handleHideZeroChange(!hideZero)}
            className={`relative w-9 h-5 rounded-full transition-colors ${
              hideZero ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"
            }`}
          >
            <div
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                hideZero ? "translate-x-4" : ""
              }`}
            />
          </div>
        </label>
      </div>

      {/* Address card (single network only) */}
      {!isAllNetworks && currentAccount && network && (
        <div className="bg-gray-50 dark:bg-m-blue-dark-3 rounded-lg p-4 mb-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <canvas ref={addressQrRef} className="rounded flex-shrink-0" />
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
                <p className="text-xs text-gray-400">{network.name}</p>
                {accounts.length > 1 && (
                  <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-bold">
                    {accounts[activeIdx]?.label ?? `Account ${activeIdx + 1}`}
                  </span>
                )}
              </div>
              <p className="font-mono text-xs sm:text-sm break-all">{currentAccount.address}</p>
              <p className="text-[10px] text-gray-400 font-mono mt-1">{getDerivationPath(networkKey)}</p>
              <button
                onClick={copyAddress}
                className="mt-2 text-xs text-blue-500 hover:text-blue-700"
              >
                {copied ? "Copied!" : "Copy Address"}
              </button>
            </div>
          </div>
        </div>
      )}

      <BalanceList
        accounts={balanceAccounts}
        hideZero={hideZero}
        onTotalChange={setTotalUsd}
        isDeterministic={isDeterministic}
      />

      <p className="text-xs text-gray-400 mt-4 text-center">
        Tap an asset for details, send, receive, or exchange.
      </p>
    </div>
  );
}
