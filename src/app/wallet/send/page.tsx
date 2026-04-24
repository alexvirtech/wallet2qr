"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/state/session";
import { useSettings } from "@/lib/wallet/settings";
import { deriveEvmAccount } from "@/lib/wallet/derive";
import { getNetwork } from "@/lib/wallet/networks";
import NetworkSwitcher from "@/components/NetworkSwitcher";
import SendForm from "@/components/SendForm";
import type { Hex } from "viem";

export default function SendPage() {
  const { mnemonic, isUnlocked } = useSession();
  const { getActiveNetworkKeys } = useSettings();
  const router = useRouter();
  const activeKeys = getActiveNetworkKeys().filter(
    (k) => getNetwork(k).chainType === "evm"
  );
  const [networkKey, setNetworkKey] = useState(activeKeys[0] ?? "ethereum");
  const [txHash, setTxHash] = useState<string | null>(null);

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

  if (!isUnlocked || !account) return null;

  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/wallet")}
            className="text-blue-500 hover:text-blue-700 text-sm"
          >
            &larr; Back
          </button>
          <h1 className="text-2xl font-bold">Send</h1>
        </div>
        <NetworkSwitcher current={networkKey} onChange={setNetworkKey} />
      </div>

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
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1.5 px-4 rounded-md text-sm"
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
