"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/state/session";
import { useSettings } from "@/lib/wallet/settings";
import { deriveEvmAccount } from "@/lib/wallet/derive";
import { getNetwork } from "@/lib/wallet/networks";
import { getBestRoute, getRouteSummaryText } from "@/lib/wallet/routing";
import NetworkSwitcher from "@/components/NetworkSwitcher";
import SendForm from "@/components/SendForm";
import type { Hex } from "viem";

export default function SendPage() {
  const { mnemonic, isUnlocked } = useSession();
  const { settings, getActiveNetworkKeys } = useSettings();
  const router = useRouter();
  const activeKeys = getActiveNetworkKeys().filter(
    (k) => getNetwork(k).chainType === "evm"
  );
  const [networkKey, setNetworkKey] = useState(activeKeys[0] ?? "arbitrum");
  const [txHash, setTxHash] = useState<string | null>(null);

  const isSimple = settings.mode === "simple";

  useEffect(() => {
    if (!isUnlocked) router.push("/qr-to-wallet");
  }, [isUnlocked, router]);

  const account = useMemo(() => {
    if (!mnemonic) return null;
    try {
      return deriveEvmAccount(mnemonic);
    } catch {
      return null;
    }
  }, [mnemonic]);

  const network = useMemo(() => getNetwork(networkKey), [networkKey]);

  const bestRoute = useMemo(
    () => getBestRoute(activeKeys, settings.routingMode, 50),
    [activeKeys, settings.routingMode]
  );

  if (!isUnlocked || !account) return null;

  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <button
          onClick={() => router.push("/wallet")}
          className="text-blue-500 hover:text-blue-700 text-sm mb-3 inline-block"
        >
          &larr; Back to Wallet
        </button>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Send</h1>
          <NetworkSwitcher current={networkKey} onChange={setNetworkKey} />
        </div>
      </div>

      {isSimple && bestRoute && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            {getRouteSummaryText(bestRoute)}
          </p>
        </div>
      )}

      {networkKey === "ethereum" && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-3 mb-4">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            Ethereum network fees may be high. A cheaper network may be available.
          </p>
        </div>
      )}

      {txHash ? (
        <div className="space-y-4">
          <div className="bg-m-green/10 border border-m-green/30 rounded-lg p-4">
            <p className="text-m-green font-bold mb-1">Transaction Sent!</p>
            <a
              href={`${network.blockExplorer}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-700 text-sm font-mono break-all"
            >
              {txHash}
            </a>
          </div>
          <button
            onClick={() => router.push("/wallet")}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg text-sm"
          >
            Back to Wallet
          </button>
        </div>
      ) : (
        <SendForm
          network={network}
          address={account.address}
          privateKey={account.privateKey as Hex}
          onSuccess={setTxHash}
        />
      )}
    </div>
  );
}
