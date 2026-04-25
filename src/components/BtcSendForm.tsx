"use client";

import { useState, useCallback, useEffect } from "react";
import {
  fetchFeeRates,
  prepareBtcSend,
  buildAndSignTx,
  broadcastTx,
  getFeeRate,
  type FeeSpeed,
  type BtcTxPlan,
} from "@/lib/wallet/btcSend";
import { getBtcBalance } from "@/lib/wallet/bitcoin";

interface BtcSendFormProps {
  address: string;
  privateKey: string;
  onSuccess: (txHash: string) => void;
}

const SPEED_LABELS: Record<FeeSpeed, string> = {
  fast: "Fast (~10 min)",
  medium: "Medium (~30 min)",
  slow: "Slow (~1 hr)",
};

function validateBtcAddress(addr: string): boolean {
  return /^(bc1[a-z0-9]{25,90}|[13][a-zA-HJ-NP-Z1-9]{25,34})$/.test(addr);
}

export default function BtcSendForm({
  address,
  privateKey,
  onSuccess,
}: BtcSendFormProps) {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [speed, setSpeed] = useState<FeeSpeed>("medium");
  const [feeRates, setFeeRates] = useState<Awaited<ReturnType<typeof fetchFeeRates>> | null>(null);
  const [plan, setPlan] = useState<BtcTxPlan | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);

  useEffect(() => {
    fetchFeeRates().then(setFeeRates).catch(() => {});
    getBtcBalance(address).then((b) => setBalance(b.formatted));
  }, [address]);

  const handleReview = useCallback(async () => {
    setError(null);
    setPlan(null);

    if (!validateBtcAddress(to)) {
      setError("Invalid Bitcoin address");
      return;
    }

    const btcAmount = parseFloat(amount);
    if (!btcAmount || btcAmount <= 0) {
      setError("Enter a valid amount");
      return;
    }

    const sats = Math.round(btcAmount * 1e8);
    if (!feeRates) {
      setError("Fee rates not loaded yet");
      return;
    }

    try {
      const feeRate = getFeeRate(feeRates, speed);
      const txPlan = await prepareBtcSend(address, sats, feeRate);
      setPlan(txPlan);
      setConfirming(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to prepare transaction");
    }
  }, [to, amount, speed, feeRates, address]);

  const handleSend = useCallback(async () => {
    if (!plan) return;
    setSending(true);
    setError(null);
    try {
      const rawTx = await buildAndSignTx(privateKey, address, to, plan);
      const txHash = await broadcastTx(rawTx);
      onSuccess(txHash);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transaction failed");
    } finally {
      setSending(false);
    }
  }, [plan, privateKey, address, to, onSuccess]);

  const feeRate = feeRates ? getFeeRate(feeRates, speed) : null;

  return (
    <div className="bg-gray-50 dark:bg-m-blue-dark-3 rounded-xl p-5 space-y-5">
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Recipient
        </label>
        <input
          type="text"
          value={to}
          onChange={(e) => { setTo(e.target.value); setConfirming(false); }}
          placeholder="bc1q..."
          className="mt-1.5 px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg w-full dark:bg-m-blue-dark-2 dark:text-gray-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
      </div>

      <div>
        <div className="flex justify-between items-center">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Amount (BTC)
          </label>
          {balance !== null && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Available: <span className="font-mono">{parseFloat(balance).toFixed(8)}</span>{" "}
              <button
                type="button"
                onClick={() => { setAmount(parseFloat(balance).toString()); setConfirming(false); }}
                className="text-blue-500 hover:text-blue-700 font-bold ml-1"
              >
                Max
              </button>
            </span>
          )}
        </div>
        <div className="mt-1.5 flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/40">
          <input
            type="number"
            step="any"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setConfirming(false); }}
            placeholder="0.0"
            className="flex-1 px-3 py-2.5 dark:bg-m-blue-dark-2 dark:text-gray-200 font-mono text-sm focus:outline-none min-w-0 border-none"
          />
          <span className="px-3 py-2.5 bg-gray-100 dark:bg-m-blue-dark-2 dark:text-gray-200 text-sm font-bold border-l border-gray-300 dark:border-gray-600">
            BTC
          </span>
        </div>
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Fee Speed
        </label>
        <div className="mt-1.5 flex gap-2">
          {(["slow", "medium", "fast"] as FeeSpeed[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { setSpeed(s); setConfirming(false); }}
              className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold transition-colors ${
                speed === s
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 dark:bg-m-blue-dark-2 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              {SPEED_LABELS[s]}
            </button>
          ))}
        </div>
        {feeRate && (
          <p className="text-xs text-gray-400 mt-1">{feeRate} sat/vB</p>
        )}
      </div>

      {confirming && plan && (
        <div className="bg-white dark:bg-m-blue-dark-2 border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">To</span>
            <span className="font-mono text-xs max-w-[60%] truncate">{to}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Amount</span>
            <span className="font-bold">{(plan.sendAmount / 1e8).toFixed(8)} BTC</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Fee</span>
            <span className="font-mono">{(plan.fee / 1e8).toFixed(8)} BTC ({plan.fee} sats)</span>
          </div>
          {plan.change > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Change</span>
              <span className="font-mono">{(plan.change / 1e8).toFixed(8)} BTC</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Inputs</span>
            <span>{plan.inputs.length} UTXO{plan.inputs.length > 1 ? "s" : ""}</span>
          </div>
        </div>
      )}

      {error && <p className="text-m-red text-sm">{error}</p>}

      <div className="flex gap-3">
        {!confirming ? (
          <button
            onClick={handleReview}
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
