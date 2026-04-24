"use client";

import { useMemo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/state/session";
import { deriveEvmAccount } from "@/lib/wallet/derive";
import { defaultNetwork } from "@/lib/wallet/networks";
import NetworkSwitcher from "@/components/NetworkSwitcher";
import ExchangeForm from "@/components/ExchangeForm";
import type { Hex } from "viem";

export default function ExchangePage() {
  const { mnemonic, isUnlocked } = useSession();
  const router = useRouter();
  const [networkKey, setNetworkKey] = useState(defaultNetwork);

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

  if (!isUnlocked || !account) return null;

  return (
    <div className="w-full max-w-2xl mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-6">
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
        Swap tokens across Ethereum, Arbitrum, and Avalanche via LI.FI.
        A 0.5% integrator fee is included in quotes.
      </p>

      <ExchangeForm
        address={account.address}
        privateKey={account.privateKey as Hex}
        currentNetwork={networkKey}
      />
    </div>
  );
}
