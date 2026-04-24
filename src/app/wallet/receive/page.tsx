"use client";

import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/state/session";
import { deriveEvmAccount } from "@/lib/wallet/derive";
import { getNetwork, defaultNetwork } from "@/lib/wallet/networks";
import NetworkSwitcher from "@/components/NetworkSwitcher";
import QRCode from "qrcode";

export default function ReceivePage() {
  const { mnemonic, isUnlocked } = useSession();
  const router = useRouter();
  const [networkKey, setNetworkKey] = useState(defaultNetwork);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  useEffect(() => {
    if (canvasRef.current && account) {
      QRCode.toCanvas(canvasRef.current, account.address, {
        width: 256,
        margin: 2,
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
          <h1 className="text-2xl font-bold">Receive</h1>
        </div>
        <NetworkSwitcher current={networkKey} onChange={setNetworkKey} />
      </div>

      <div className="flex flex-col items-center gap-4">
        <p className="text-sm text-gray-500">
          Share this address to receive {network.nativeCurrency.symbol} on{" "}
          {network.name}
        </p>
        <div className="bg-white p-4 rounded-lg">
          <canvas ref={canvasRef} />
        </div>
        <p className="font-mono text-sm break-all text-center max-w-sm">
          {account.address}
        </p>
        <button
          onClick={copyAddress}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1.5 px-6 rounded-md text-sm"
        >
          {copied ? "Copied!" : "Copy Address"}
        </button>
      </div>
    </div>
  );
}
