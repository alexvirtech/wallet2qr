"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/state/session";
import { useSettings } from "@/lib/wallet/settings";
import { deriveAccount } from "@/lib/wallet/derive";
import { getNetwork } from "@/lib/wallet/networks";
import NetworkSwitcher from "@/components/NetworkSwitcher";
import BalanceList from "@/components/BalanceList";
import QRCode from "qrcode";

const SHORT_NAMES: Record<string, string> = {
  arbitrum: "Arbitrum",
  ethereum: "Ethereum",
  bnb: "BNB",
  avalanche: "Avalanche",
  solana: "Solana",
  bitcoin: "Bitcoin",
};

export default function WalletPage() {
  const { mnemonic, isUnlocked } = useSession();
  const { settings, getActiveNetworkKeys, getDerivationPath } = useSettings();
  const router = useRouter();

  const activeKeys = getActiveNetworkKeys();
  const [networkKey, setNetworkKey] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("w2q_network");
      if (stored && activeKeys.includes(stored)) return stored;
    }
    return activeKeys[0] ?? "arbitrum";
  });
  const [copied, setCopied] = useState(false);
  const addressQrRef = useRef<HTMLCanvasElement>(null);

  const isSimple = settings.mode === "simple";

  const handleNetworkChange = useCallback((key: string) => {
    setNetworkKey(key);
    try { localStorage.setItem("w2q_network", key); } catch {}
  }, []);

  useEffect(() => {
    if (!isUnlocked) router.push("/qr-to-wallet");
  }, [isUnlocked, router]);

  useEffect(() => {
    if (!activeKeys.includes(networkKey) && activeKeys.length > 0) {
      const fallback = activeKeys[0];
      setNetworkKey(fallback);
      try { localStorage.setItem("w2q_network", fallback); } catch {}
    }
  }, [activeKeys, networkKey]);

  const network = useMemo(() => getNetwork(networkKey), [networkKey]);
  const derivationPath = getDerivationPath(networkKey);
  const accounts = settings.networks[networkKey]?.accounts ?? [];
  const activeIdx = settings.networks[networkKey]?.activeAccountIndex ?? 0;

  const account = useMemo(() => {
    if (!mnemonic) return null;
    try {
      return deriveAccount(mnemonic, network.chainType, derivationPath);
    } catch {
      return null;
    }
  }, [mnemonic, network.chainType, derivationPath]);

  useEffect(() => {
    if (addressQrRef.current && account) {
      QRCode.toCanvas(addressQrRef.current, account.address, {
        width: 120,
        margin: 1,
      });
    }
  }, [account]);

  const copyAddress = useCallback(() => {
    if (!account) return;
    navigator.clipboard.writeText(account.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [account]);

  if (!isUnlocked || !account) return null;

  if (activeKeys.length === 0) {
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">Wallet</h1>
        {!isSimple && (
          <NetworkSwitcher current={networkKey} onChange={handleNetworkChange} />
        )}
      </div>

      {isSimple && activeKeys.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {activeKeys.map((k) => (
            <button
              key={k}
              onClick={() => handleNetworkChange(k)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                k === networkKey
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 dark:bg-m-blue-dark-3 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {SHORT_NAMES[k] ?? k}
            </button>
          ))}
        </div>
      )}

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
            <p className="font-mono text-xs sm:text-sm break-all">{account.address}</p>
            <p className="text-[10px] text-gray-400 font-mono mt-1">{derivationPath}</p>
            <button
              onClick={copyAddress}
              className="mt-2 text-xs text-blue-500 hover:text-blue-700"
            >
              {copied ? "Copied!" : "Copy Address"}
            </button>
          </div>
        </div>
      </div>

      <BalanceList
        network={network}
        address={account.address}
        showTotalUsd={isSimple}
        networkKey={networkKey}
      />

      <div className="flex gap-3 mt-6">
        {network.chainType === "evm" && (
          <button
            onClick={() => router.push("/wallet/send")}
            className="flex-1 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg text-sm"
          >
            Send
          </button>
        )}
        <button
          onClick={() => router.push("/wallet/receive")}
          className="flex-1 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg text-sm"
        >
          Receive
        </button>
        <button
          onClick={() => router.push("/wallet/exchange")}
          className="flex-1 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg text-sm"
        >
          Exchange
        </button>
      </div>
    </div>
  );
}
