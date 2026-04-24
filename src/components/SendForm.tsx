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
    <div className="space-y-4">
      <div>
        <label className="text-sm font-bold text-gray-600 dark:text-gray-300">
          Recipient Address
        </label>
        <input
          type="text"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="0x..."
          className="mt-1 px-2 py-1.5 border border-gray-300 rounded w-full dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 font-mono text-sm"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1">
          <label className="text-sm font-bold text-gray-600 dark:text-gray-300">
            Amount
          </label>
          <input
            type="number"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="mt-1 px-2 py-1.5 border border-gray-300 rounded w-full dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 font-mono text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-bold text-gray-600 dark:text-gray-300">
            Asset
          </label>
          <select
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
            className="mt-1 px-2 py-1.5 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 text-sm"
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
        <div className="bg-gray-50 dark:bg-m-blue-dark-3 p-3 rounded-lg text-sm space-y-1">
          <p>
            <span className="font-bold">To:</span>{" "}
            <span className="font-mono text-xs">{to}</span>
          </p>
          <p>
            <span className="font-bold">Amount:</span> {amount}{" "}
            {asset === "native" ? network.nativeCurrency.symbol : asset}
          </p>
          <p>
            <span className="font-bold">Est. Gas:</span> {gasEstimate}{" "}
            {network.nativeCurrency.symbol}
          </p>
          <p>
            <span className="font-bold">Network:</span> {network.name}
          </p>
        </div>
      )}

      {error && <p className="text-m-red text-sm">{error}</p>}

      <div className="flex gap-2">
        {!confirming ? (
          <button
            onClick={handleEstimate}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1.5 px-4 rounded-md text-sm"
          >
            Review
          </button>
        ) : (
          <>
            <button
              onClick={handleSend}
              disabled={sending}
              className="bg-m-green hover:bg-green-600 text-white font-bold py-1.5 px-4 rounded-md text-sm disabled:opacity-50"
            >
              {sending ? "Sending..." : "Confirm & Send"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="bg-gray-300 hover:bg-gray-400 text-gray-700 font-bold py-1.5 px-4 rounded-md text-sm"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
