"use client";

import { useMemo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/state/session";
import { useSettings } from "@/lib/wallet/settings";
import { deriveAccount } from "@/lib/wallet/derive";
import { getNetwork } from "@/lib/wallet/networks";
import NetworkSwitcher from "@/components/NetworkSwitcher";
import ExchangeForm from "@/components/ExchangeForm";
import type { Hex, Address } from "viem";

export default function ExchangePage() {
  const { mnemonic, isUnlocked } = useSession();
  const { getActiveNetworkKeys, getDerivationPath } = useSettings();
  const router = useRouter();
  const activeKeys = getActiveNetworkKeys().filter(
    (k) => getNetwork(k).chainType !== "bitcoin"
  );
  const [networkKey, setNetworkKey] = useState(activeKeys[0] ?? "ethereum");

  useEffect(() => {
    if (!isUnlocked) router.push("/qr-to-wallet");
  }, [isUnlocked, router]);

  const network = useMemo(() => getNetwork(networkKey), [networkKey]);
  const derivationPath = getDerivationPath(networkKey);

  const account = useMemo(() => {
    if (!mnemonic) return null;
    try {
      return deriveAccount(mnemonic, network.chainType, derivationPath);
    } catch {
      return null;
    }
  }, [mnemonic, network.chainType, derivationPath]);

  if (!isUnlocked || !account) return null;

  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <div className="text-xs text-gray-400 mb-1">
          <Link href="/wallet" className="hover:text-blue-500 transition-colors">Wallet</Link>
          <span className="mx-1">/</span>
          <span>Exchange</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Exchange</h1>
          <NetworkSwitcher current={networkKey} onChange={setNetworkKey} />
        </div>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Swap tokens across EVM chains and Solana via LI.FI. Bitcoin is not
        supported — use a dedicated bridge like THORChain or Chainflip for
        BTC swaps.
      </p>

      <ExchangeForm
        address={account.address as Address}
        privateKey={account.privateKey as Hex}
        currentNetwork={networkKey}
      />
    </div>
  );
}
