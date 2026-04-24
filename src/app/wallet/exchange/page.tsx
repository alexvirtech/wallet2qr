"use client";

import { useMemo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/state/session";
import { useSettings } from "@/lib/wallet/settings";
import { deriveAccount } from "@/lib/wallet/derive";
import { getNetwork } from "@/lib/wallet/networks";
import NetworkSwitcher from "@/components/NetworkSwitcher";
import ExchangeForm from "@/components/ExchangeForm";
import type { Hex, Address } from "viem";

export default function ExchangePage() {
  const { mnemonic, isUnlocked } = useSession();
  const { getActiveNetworkKeys } = useSettings();
  const router = useRouter();
  const activeKeys = getActiveNetworkKeys();
  const [networkKey, setNetworkKey] = useState(activeKeys[0] ?? "ethereum");

  useEffect(() => {
    if (!isUnlocked) router.push("/qr-to-wallet");
  }, [isUnlocked, router]);

  const network = useMemo(() => getNetwork(networkKey), [networkKey]);

  const account = useMemo(() => {
    if (!mnemonic) return null;
    try {
      return deriveAccount(mnemonic, network.chainType);
    } catch {
      return null;
    }
  }, [mnemonic, network.chainType]);

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
          <h1 className="text-2xl font-bold">Exchange</h1>
        </div>
        <NetworkSwitcher current={networkKey} onChange={setNetworkKey} />
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Swap tokens across Ethereum, Arbitrum, Avalanche, and Solana via LI.FI.
      </p>

      <ExchangeForm
        address={account.address as Address}
        privateKey={account.privateKey as Hex}
        currentNetwork={networkKey}
      />
    </div>
  );
}
