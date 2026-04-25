"use client";

import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/state/session";
import { useSettings } from "@/lib/wallet/settings";
import { deriveAccount } from "@/lib/wallet/derive";
import { getNetwork, allNetworks } from "@/lib/wallet/networks";
import { buildPaymentRequest, encodePaymentQr } from "@/lib/wallet/paymentQr";
import NetworkSwitcher from "@/components/NetworkSwitcher";
import QRCode from "qrcode";

export default function ReceivePage() {
  const { mnemonic, isUnlocked } = useSession();
  const { settings, getActiveNetworkKeys } = useSettings();
  const router = useRouter();
  const activeKeys = getActiveNetworkKeys();
  const [networkKey, setNetworkKey] = useState(activeKeys[0] ?? "arbitrum");
  const [copied, setCopied] = useState(false);
  const [showPaymentQr, setShowPaymentQr] = useState(false);
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paymentCanvasRef = useRef<HTMLCanvasElement>(null);

  const isSimple = settings.mode === "simple";

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

  useEffect(() => {
    if (canvasRef.current && account) {
      QRCode.toCanvas(canvasRef.current, account.address, {
        width: 256,
        margin: 2,
      });
    }
  }, [account]);

  const paymentQrData = useMemo(() => {
    if (!showPaymentQr || !mnemonic) return null;

    const addresses: { networkId: string; address: string }[] = [];
    for (const key of activeKeys) {
      const net = allNetworks[key];
      if (!net) continue;
      try {
        const acc = deriveAccount(mnemonic, net.chainType);
        addresses.push({ networkId: key, address: acc.address });
      } catch {}
    }

    const req = buildPaymentRequest({
      addresses,
      amount: amount || undefined,
      currency: "USD",
      preferredAssets:
        settings.preferredPaymentAsset === "auto"
          ? ["USDT", "USDC"]
          : [settings.preferredPaymentAsset],
      preferredNetworkId:
        settings.preferredPaymentNetwork === "auto"
          ? "auto"
          : settings.preferredPaymentNetwork,
      memo: memo || undefined,
    });
    return encodePaymentQr(req);
  }, [
    showPaymentQr,
    mnemonic,
    activeKeys,
    amount,
    memo,
    settings.preferredPaymentAsset,
    settings.preferredPaymentNetwork,
  ]);

  useEffect(() => {
    if (paymentCanvasRef.current && paymentQrData) {
      QRCode.toCanvas(paymentCanvasRef.current, paymentQrData, {
        width: 256,
        margin: 2,
      });
    }
  }, [paymentQrData]);

  const copyAddress = useCallback(() => {
    if (!account) return;
    navigator.clipboard.writeText(account.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [account]);

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
          <h1 className="text-2xl font-bold">Receive</h1>
        </div>
        <NetworkSwitcher current={networkKey} onChange={setNetworkKey} />
      </div>

      {/* Simple address QR */}
      <div className="flex flex-col items-center gap-4 mb-8">
        <p className="text-sm text-gray-500">
          {isSimple
            ? `Share this address to receive funds`
            : `Share this address to receive ${network.nativeCurrency.symbol} on ${network.name}`}
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

      {/* Payment Request QR Builder */}
      <div className="border-t border-gray-200 dark:border-gray-600 pt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Payment Request QR</h2>
          <button
            onClick={() => setShowPaymentQr(!showPaymentQr)}
            className="text-xs bg-m-green hover:bg-green-600 text-white font-bold py-1 px-3 rounded"
          >
            {showPaymentQr ? "Hide" : "Create"}
          </button>
        </div>

        {showPaymentQr && (
          <div className="space-y-4">
            <p className="text-xs text-gray-400">
              Generate a QR with payment details. The payer scans it to send you
              the right amount on the right network.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-bold text-gray-600 dark:text-gray-300">
                  Amount (USD)
                </label>
                <input
                  type="number"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Optional"
                  className="mt-1 px-2 py-1.5 border border-gray-300 rounded w-full dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-bold text-gray-600 dark:text-gray-300">
                  Memo
                </label>
                <input
                  type="text"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Optional note"
                  className="mt-1 px-2 py-1.5 border border-gray-300 rounded w-full dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 text-sm"
                />
              </div>
            </div>

            {paymentQrData && (
              <div className="flex flex-col items-center gap-3">
                <div className="bg-white p-4 rounded-lg">
                  <canvas ref={paymentCanvasRef} />
                </div>
                <p className="text-xs text-gray-400 text-center max-w-sm">
                  This QR contains a payment request with your addresses on all
                  active networks. No private keys are included.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
