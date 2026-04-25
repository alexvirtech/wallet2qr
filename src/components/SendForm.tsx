"use client";

import { useState, useCallback } from "react";
import { isAddress, formatEther, type Address, type Hex } from "viem";
import { type NetworkConfig } from "@/lib/wallet/networks";
import { estimateGas, sendNative, sendToken } from "@/lib/wallet/send";

interface SendFormProps {
  network: NetworkConfig;
  address: Address;
  privateKey: Hex;
  onSuccess: (txHash: string) => void;
}

export default function SendForm({
  network,
  address,
  privateKey,
  onSuccess,
}: SendFormProps) {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState("native");
  const [gasEstimate, setGasEstimate] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assets = [
    { value: "native", label: network.nativeCurrency.symbol },
    ...network.tokens.map((t) => ({ value: t.symbol, label: t.symbol })),
  ];

  const selectedLabel = asset === "native" ? network.nativeCurrency.symbol : asset;

  const handleEstimate = useCallback(async () => {
    setError(null);
    if (!isAddress(to)) {
      setError("Invalid recipient address");
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setError("Enter a valid amount");
      return;
    }
    try {
      const est = await estimateGas(
        network,
        address,
        to as Address,
        BigInt(0)
      );
      setGasEstimate(formatEther(est.totalGasCost));
      setConfirming(true);
    } catch (e) {
      setError("Failed to estimate gas");
      console.error(e);
    }
  }, [network, address, to, amount]);

  const handleSend = useCallback(async () => {
    setSending(true);
    setError(null);
    try {
      let txHash: string;
      if (asset === "native") {
        txHash = await sendNative(network, privateKey, to as Address, amount);
      } else {
        const token = network.tokens.find((t) => t.symbol === asset)!;
        txHash = await sendToken(
          network,
          privateKey,
          token,
          to as Address,
          amount
        );
      }
      onSuccess(txHash);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transaction failed");
    } finally {
      setSending(false);
    }
  }, [network, privateKey, to, amount, asset, onSuccess]);

  return (
    <div className="bg-gray-50 dark:bg-m-blue-dark-3 rounded-xl p-5 space-y-5">
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Recipient
        </label>
        <input
          type="text"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="0x..."
          className="mt-1.5 px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg w-full dark:bg-m-blue-dark-2 dark:text-gray-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Amount
        </label>
        <div className="mt-1.5 flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/40">
          <input
            type="number"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="flex-1 px-3 py-2.5 dark:bg-m-blue-dark-2 dark:text-gray-200 font-mono text-sm focus:outline-none min-w-0 border-none"
          />
          <select
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
            className="px-3 py-2.5 bg-gray-100 dark:bg-m-blue-dark-2 dark:text-gray-200 text-sm font-bold border-l border-gray-300 dark:border-gray-600 cursor-pointer focus:outline-none"
          >
            {assets.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {gasEstimate && confirming && (
        <div className="bg-white dark:bg-m-blue-dark-2 border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">To</span>
            <span className="font-mono text-xs max-w-[60%] truncate">{to}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Amount</span>
            <span className="font-bold">{amount} {selectedLabel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Est. Gas</span>
            <span className="font-mono">{gasEstimate} {network.nativeCurrency.symbol}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Network</span>
            <span>{network.name}</span>
          </div>
        </div>
      )}

      {error && <p className="text-m-red text-sm">{error}</p>}

      <div className="flex gap-3">
        {!confirming ? (
          <button
            onClick={handleEstimate}
            className="flex-1 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-colors"
          >
            Review
          </button>
        ) : (
          <>
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex-1 bg-m-green hover:bg-green-600 text-white font-bold py-2.5 px-6 rounded-lg text-sm disabled:opacity-50 transition-colors"
            >
              {sending ? "Sending..." : "Confirm & Send"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold py-2.5 px-6 rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
