"use client";

import { useMemo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/state/session";
import { useSettings } from "@/lib/wallet/settings";
import { deriveAccount } from "@/lib/wallet/derive";
import { getNetwork, allNetworks } from "@/lib/wallet/networks";
import { getThorSupportedNetworks } from "@/lib/thorchain/api";
import NetworkSwitcher from "@/components/NetworkSwitcher";
import ExchangeForm from "@/components/ExchangeForm";
import ThorSwapForm from "@/components/ThorSwapForm";
import type { Hex, Address } from "viem";

type SwapProvider = "lifi" | "thorchain";

export default function ExchangePage() {
  const { mnemonic, isUnlocked, readOnly } = useSession();
  const { getActiveNetworkKeys, getDerivationPath } = useSettings();
  const router = useRouter();
  const allActiveKeys = getActiveNetworkKeys();
  const evmKeys = allActiveKeys.filter(
    (k) => getNetwork(k).chainType !== "bitcoin"
  );
  const [networkKey, setNetworkKey] = useState(evmKeys[0] ?? "ethereum");
  const [provider, setProvider] = useState<SwapProvider>("lifi");

  useEffect(() => {
    if (!isUnlocked) router.push("/qr-to-wallet");
    else if (readOnly) router.push("/wallet");
  }, [isUnlocked, readOnly, router]);

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

  const thorData = useMemo(() => {
    if (!mnemonic) return { addresses: {} as Record<string, string>, privateKeys: {} as Record<string, string> };
    const addresses: Record<string, string> = {};
    const privateKeys: Record<string, string> = {};
    for (const key of getThorSupportedNetworks()) {
      const net = allNetworks[key];
      if (!net) continue;
      try {
        const path = getDerivationPath(key);
        const acc = deriveAccount(mnemonic, net.chainType, path);
        addresses[key] = acc.address;
        privateKeys[key] = acc.privateKey;
      } catch {}
    }
    return { addresses, privateKeys };
  }, [mnemonic, getDerivationPath]);

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
          {provider === "lifi" && (
            <NetworkSwitcher current={networkKey} onChange={setNetworkKey} />
          )}
        </div>
      </div>

      <div className="flex border-b border-gray-200 dark:border-gray-600 mb-4">
        <button
          onClick={() => setProvider("lifi")}
          className={`py-2 px-4 text-sm font-bold border-b-2 transition-colors ${
            provider === "lifi"
              ? "border-blue-500 text-blue-500"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          LI.FI
        </button>
        <button
          onClick={() => setProvider("thorchain")}
          className={`py-2 px-4 text-sm font-bold border-b-2 transition-colors ${
            provider === "thorchain"
              ? "border-blue-500 text-blue-500"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          THORChain
        </button>
      </div>

      {provider === "lifi" && (
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Swap tokens across EVM chains and Solana. For BTC swaps, use the THORChain tab.
          </p>
          <ExchangeForm
            address={account.address as Address}
            privateKey={account.privateKey as Hex}
            currentNetwork={networkKey}
          />
        </>
      )}

      {provider === "thorchain" && (
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Cross-chain swaps via THORChain. Supports Bitcoin, Ethereum, BNB Chain, and Avalanche.
          </p>
          <ThorSwapForm addresses={thorData.addresses} privateKeys={thorData.privateKeys} />
        </>
      )}
    </div>
  );
}
