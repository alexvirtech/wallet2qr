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

export default function WalletPage() {
  const { mnemonic, isUnlocked } = useSession();
  const { getActiveNetworkKeys } = useSettings();
  const router = useRouter();

  const activeKeys = getActiveNetworkKeys();
  const [networkKey, setNetworkKey] = useState(activeKeys[0] ?? "ethereum");
  const [copied, setCopied] = useState(false);
  const addressQrRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isUnlocked) router.push("/qr-to-wallet");
  }, [isUnlocked, router]);

  useEffect(() => {
    if (!activeKeys.includes(networkKey) && activeKeys.length > 0) {
      setNetworkKey(activeKeys[0]);
    }
  }, [activeKeys, networkKey]);

  const network = useMemo(() => getNetwork(networkKey), [networkKey]);

  const account = useMemo(() => {
    if (!mnemonic) return null;
    try {
      return deriveAccount(mnemonic, network.chainType);
    } catch {
      return null;
    }
  }, [mnemonic, network.chainType]);

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
      <div className="w-full max-w-2xl mx-auto px-6 py-6 text-center">
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
    <div className="w-full max-w-2xl mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Wallet</h1>
        <NetworkSwitcher current={networkKey} onChange={setNetworkKey} />
      </div>

      <div className="bg-gray-50 dark:bg-m-blue-dark-3 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-4">
          <canvas ref={addressQrRef} className="rounded" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 mb-1">Your Address ({network.name})</p>
            <p className="font-mono text-sm break-all">{account.address}</p>
            <button
              onClick={copyAddress}
              className="mt-2 text-xs text-blue-500 hover:text-blue-700"
            >
              {copied ? "Copied!" : "Copy Address"}
            </button>
          </div>
        </div>
      </div>

      <BalanceList network={network} address={account.address} />

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
