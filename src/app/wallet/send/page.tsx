"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/state/session";
import { useSettings } from "@/lib/wallet/settings";
import { deriveAccount } from "@/lib/wallet/derive";
import { getNetwork } from "@/lib/wallet/networks";
import { getBestRoute, getRouteSummaryText } from "@/lib/wallet/routing";
import NetworkSwitcher from "@/components/NetworkSwitcher";
import SendForm from "@/components/SendForm";
import BtcSendForm from "@/components/BtcSendForm";
import type { Hex } from "viem";

export default function SendPage() {
  const { mnemonic, isUnlocked, readOnly } = useSession();
  const { settings, getActiveNetworkKeys, getDerivationPath } = useSettings();
  const router = useRouter();
  const activeKeys = getActiveNetworkKeys().filter(
    (k) => {
      const ct = getNetwork(k).chainType;
      return ct === "evm" || ct === "bitcoin";
    }
  );
  const [networkKey, setNetworkKey] = useState(activeKeys[0] ?? "arbitrum");
  const [txHash, setTxHash] = useState<string | null>(null);

  const isSimple = settings.mode === "simple";
  const derivationPath = getDerivationPath(networkKey);

  useEffect(() => {
    if (!isUnlocked) router.push("/qr-to-wallet");
    else if (readOnly) router.push("/wallet");
  }, [isUnlocked, readOnly, router]);

  const account = useMemo(() => {
    if (!mnemonic) return null;
    try {
      return deriveAccount(mnemonic, getNetwork(networkKey).chainType, derivationPath);
    } catch {
      return null;
    }
  }, [mnemonic, networkKey, derivationPath]);

  const network = useMemo(() => getNetwork(networkKey), [networkKey]);
  const isBtc = network.chainType === "bitcoin";

  const evmKeys = activeKeys.filter((k) => getNetwork(k).chainType === "evm");
  const bestRoute = useMemo(
    () => getBestRoute(evmKeys, settings.routingMode, 50),
    [evmKeys, settings.routingMode]
  );

  if (!isUnlocked || !account) return null;

  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <div className="text-xs text-gray-400 mb-1">
          <Link href="/wallet" className="hover:text-blue-500 transition-colors">Wallet</Link>
          <span className="mx-1">/</span>
          <span>Send</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Send</h1>
          <NetworkSwitcher current={networkKey} onChange={(k) => { setNetworkKey(k); setTxHash(null); }} />
        </div>
      </div>

      {!isBtc && isSimple && bestRoute && (
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
      ) : isBtc ? (
        <BtcSendForm
          address={account.address}
          privateKey={account.privateKey}
          onSuccess={setTxHash}
        />
      ) : (
        <SendForm
          network={network}
          address={account.address as `0x${string}`}
          privateKey={account.privateKey as Hex}
          onSuccess={setTxHash}
        />
      )}
    </div>
  );
}
