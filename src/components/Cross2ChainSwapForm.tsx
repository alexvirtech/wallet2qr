"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { createWalletClient, http, parseEther, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { allNetworks } from "@/lib/wallet/networks";
import { getNativeBalance } from "@/lib/wallet/tokens";
import { getBtcBalance } from "@/lib/wallet/bitcoin";
import { sendBtcWithMemo, sendBtc, fetchFeeRates, getFeeRate, type FeeSpeed } from "@/lib/wallet/btcSend";
import { fetchPrices } from "@/lib/wallet/prices";
import {
  getCross2ChainSupportedNetworks,
  getCross2ChainQuote,
  createCross2ChainSwap,
  getCross2ChainStatus,
  TERMINAL_STATUSES,
  type QuoteResponse,
  type SwapQuote,
  type SwapResult,
} from "@/lib/cross2chain/api";

interface Cross2ChainSwapFormProps {
  addresses: Record<string, string>;
  privateKeys: Record<string, string>;
}

const LIMITS: Record<string, { min: number; max: number }> = {
  bitcoin: { min: 0.0001, max: 10 },
  ethereum: { min: 0.01, max: 100 },
};

const SYMBOLS: Record<string, string> = {
  bitcoin: "BTC",
  ethereum: "ETH",
};

function logSwap(data: Record<string, unknown>) {
  fetch("/api/admin/log-swap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).catch(() => {});
}

const STATUS_LABELS: Record<string, string> = {
  waiting_for_deposit: "Waiting for deposit",
  deposit_detected: "Deposit detected",
  confirming_source: "Confirming on source chain",
  swap_executing: "Swap in progress",
  destination_prepared: "Funds ready on destination",
  completed: "Completed",
  failed: "Failed",
  refunded: "Refunded",
};

export default function Cross2ChainSwapForm({ addresses, privateKeys }: Cross2ChainSwapFormProps) {
  const supportedKeys = getCross2ChainSupportedNetworks();

  const [fromChain, setFromChain] = useState(supportedKeys.includes("bitcoin") ? "bitcoin" : supportedKeys[0]);
  const [toChain, setToChain] = useState(supportedKeys.includes("ethereum") ? "ethereum" : supportedKeys[1] ?? supportedKeys[0]);
  const [amount, setAmount] = useState("");
  const [quoteResponse, setQuoteResponse] = useState<QuoteResponse | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<SwapQuote | null>(null);
  const [swap, setSwap] = useState<SwapResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [executing, setExecuting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [swapStep, setSwapStep] = useState<string | null>(null);
  const [swapStatus, setSwapStatus] = useState<string | null>(null);
  const [destTxHash, setDestTxHash] = useState<string | null>(null);
  const [feeSpeed, setFeeSpeed] = useState<FeeSpeed | "custom">("fast");
  const [customFeeRate, setCustomFeeRate] = useState("");
  const [feeRates, setFeeRates] = useState<{ fastestFee: number; halfHourFee: number; hourFee: number; minimumFee: number } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isBtcSource = fromChain === "bitcoin";
  const fromSymbol = SYMBOLS[fromChain] ?? fromChain.toUpperCase();
  const toSymbol = SYMBOLS[toChain] ?? toChain.toUpperCase();

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setBalance(null);
    const net = allNetworks[fromChain];
    const addr = addresses[fromChain];
    if (!net || !addr) return;
    (async () => {
      try {
        let result;
        if (net.chainType === "bitcoin") {
          result = await getBtcBalance(addr);
        } else if (net.chainType === "evm") {
          result = await getNativeBalance(net, addr as Address);
        }
        if (!cancelled && result) setBalance(result.formatted);
      } catch { if (!cancelled) setBalance(null); }
    })();
    return () => { cancelled = true; };
  }, [fromChain, addresses]);

  useEffect(() => { fetchPrices().then(setPrices); }, []);

  useEffect(() => {
    fetchFeeRates().then(setFeeRates).catch(() => {});
  }, []);

  const usdEstimate = useMemo(() => {
    const amt = parseFloat(amount);
    const price = prices[fromSymbol];
    if (!amt || !price) return null;
    const val = amt * price;
    return val >= 0.01 ? val.toFixed(2) : val.toPrecision(2);
  }, [amount, prices, fromSymbol]);

  const activeFeeRate = useMemo(() => {
    if (feeSpeed === "custom") return parseInt(customFeeRate) || 20;
    if (!feeRates) return feeSpeed === "fast" ? 50 : feeSpeed === "medium" ? 30 : 15;
    return getFeeRate(feeRates, feeSpeed);
  }, [feeSpeed, customFeeRate, feeRates]);

  const startStatusPoll = useCallback((swapId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const status = await getCross2ChainStatus(swapId);
        setSwapStatus(status.status);
        setSwapStep(STATUS_LABELS[status.status] ?? status.status);
        if (status.destinationTxHash) setDestTxHash(status.destinationTxHash);
        if (TERMINAL_STATUSES.includes(status.status)) {
          if (pollRef.current) clearInterval(pollRef.current);
          if (status.status === "failed") {
            setError("Swap failed. Funds will be refunded to your address.");
          }
        }
      } catch { /* ignore poll errors */ }
    }, 20_000);
  }, []);

  const handleQuote = useCallback(async () => {
    setError(null);
    setQuoteResponse(null);
    setSelectedRoute(null);
    setSwap(null);
    setTxHash(null);
    setSwapStatus(null);
    setSwapStep(null);
    setDestTxHash(null);

    const amt = parseFloat(amount);
    if (!amount || !amt || amt <= 0) {
      setError("Enter a valid amount");
      return;
    }

    const limits = LIMITS[fromChain];
    if (limits) {
      if (amt < limits.min) { setError(`Minimum amount is ${limits.min} ${fromSymbol}`); return; }
      if (amt > limits.max) { setError(`Maximum amount is ${limits.max} ${fromSymbol}`); return; }
    }

    if (fromChain === toChain) {
      setError("Source and destination must be different");
      return;
    }

    const destAddr = addresses[toChain];
    const refundAddr = addresses[fromChain];
    if (!destAddr || !refundAddr) {
      setError("Missing wallet addresses");
      return;
    }

    setLoading(true);
    try {
      const resp = await getCross2ChainQuote(fromChain, toChain, amount, destAddr, refundAddr);
      setQuoteResponse(resp);
      setSelectedRoute(resp.recommendedRoute);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get quote");
    } finally {
      setLoading(false);
    }
  }, [fromChain, toChain, amount, addresses, fromSymbol]);

  const handleExecute = useCallback(async () => {
    if (!selectedRoute) return;
    const srcAddr = addresses[fromChain];
    const destAddr = addresses[toChain];
    const pk = privateKeys[fromChain];
    if (!srcAddr || !destAddr || !pk) {
      setError("Missing address or key");
      return;
    }

    setExecuting(true);
    setError(null);
    setTxHash(null);
    setSwapStep("Creating swap...");

    try {
      const swapResult = await createCross2ChainSwap(selectedRoute, destAddr, srcAddr);
      setSwap(swapResult);

      setSwapStep(`Sending ${fromSymbol} to deposit address...`);

      let hash: string;

      if (isBtcSource) {
        const amountSats = Math.round(parseFloat(amount) * 1e8);
        const feeRate = swapResult.recommendedGasRate || activeFeeRate;
        if (swapResult.memo) {
          hash = await sendBtcWithMemo(pk, srcAddr, swapResult.depositAddress, amountSats, feeRate, swapResult.memo, setSwapStep);
        } else {
          hash = await sendBtc(pk, srcAddr, swapResult.depositAddress, amountSats, feeRate);
        }
      } else {
        const net = allNetworks[fromChain];
        const account = privateKeyToAccount(pk as Hex);
        const client = createWalletClient({
          account,
          chain: mainnet,
          transport: http(net.rpcUrl),
        });
        const ethAmount = parseEther(amount);
        hash = await client.sendTransaction({
          to: swapResult.depositAddress as Address,
          value: ethAmount,
          chain: mainnet,
        });
      }

      setTxHash(hash);
      setSwapStep("Deposit sent! Waiting for confirmations...");
      startStatusPoll(swapResult.id);

      logSwap({
        provider: "cross2chain",
        fromChain,
        toChain,
        fromToken: fromSymbol,
        toToken: toSymbol,
        fromAmount: amount,
        toAmount: swapResult.expectedOutput,
        txHash: hash,
        status: "pending",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transaction failed");
      setSwapStep(null);
    } finally {
      setExecuting(false);
    }
  }, [selectedRoute, addresses, privateKeys, fromChain, toChain, fromSymbol, toSymbol, amount, isBtcSource, activeFeeRate, startStatusPoll]);

  const resetForm = () => {
    setQuoteResponse(null);
    setSelectedRoute(null);
    setSwap(null);
    setTxHash(null);
    setSwapStatus(null);
    setSwapStep(null);
    setDestTxHash(null);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">From</label>
          <select
            value={fromChain}
            onChange={(e) => { setFromChain(e.target.value); resetForm(); }}
            className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 text-sm"
          >
            {supportedKeys.map((k) => (
              <option key={k} value={k}>{allNetworks[k]?.name ?? k}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">To</label>
          <select
            value={toChain}
            onChange={(e) => { setToChain(e.target.value); resetForm(); }}
            className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 text-sm"
          >
            {supportedKeys.map((k) => (
              <option key={k} value={k}>{allNetworks[k]?.name ?? k}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Amount</label>
          {balance !== null && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Available: <span className="font-mono">{parseFloat(balance).toFixed(6)}</span>{" "}
              <button type="button" onClick={() => { setAmount(parseFloat(balance).toString()); resetForm(); }} className="text-blue-500 hover:text-blue-700 font-bold ml-1">Max</button>
            </span>
          )}
        </div>
        <div className="mt-1 flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/40">
          <input
            type="number"
            step="any"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); resetForm(); }}
            placeholder="0.0"
            className="flex-1 px-3 py-2.5 dark:bg-m-blue-dark-2 dark:text-gray-200 font-mono text-sm focus:outline-none min-w-0 border-none"
          />
          <span className="px-3 py-2.5 bg-gray-100 dark:bg-m-blue-dark-2 dark:text-gray-200 text-sm font-bold border-l border-gray-300 dark:border-gray-600">
            {fromSymbol}
          </span>
        </div>
        {usdEstimate && <p className="text-xs text-gray-400 mt-1">~${usdEstimate}</p>}
      </div>

      {isBtcSource && (
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">BTC Fee Rate</label>
          <div className="mt-1 grid grid-cols-4 gap-1.5">
            {(["fast", "medium", "slow", "custom"] as const).map((speed) => (
              <button
                key={speed}
                type="button"
                onClick={() => setFeeSpeed(speed)}
                className={`py-1.5 px-2 text-xs font-bold rounded border transition-colors ${
                  feeSpeed === speed
                    ? "border-blue-500 bg-blue-500 text-white"
                    : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-blue-400"
                }`}
              >
                {speed === "fast" ? "Fast" : speed === "medium" ? "Medium" : speed === "slow" ? "Slow" : "Custom"}
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            {feeSpeed === "custom" ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="1"
                  value={customFeeRate}
                  onChange={(e) => setCustomFeeRate(e.target.value)}
                  placeholder="sat/vB"
                  className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-gray-300 text-xs font-mono"
                />
                <span>sat/vB</span>
              </div>
            ) : (
              <span>
                {feeRates ? `${activeFeeRate} sat/vB` : "Loading rates..."}
              </span>
            )}
            <span>
              {feeSpeed === "fast" ? "~10 min" : feeSpeed === "medium" ? "~30 min" : feeSpeed === "slow" ? "~60 min" : ""}
            </span>
          </div>
        </div>
      )}

      {quoteResponse && selectedRoute && (
        <div className="bg-white dark:bg-m-blue-dark-2 border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Expected output</span>
            <span className="font-bold font-mono">{selectedRoute.expectedOutput} {toSymbol}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Minimum output</span>
            <span className="font-mono text-gray-400">{selectedRoute.minimumOutput} {toSymbol}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Provider</span>
            <span className="capitalize">{selectedRoute.provider}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Est. time</span>
            <span>{quoteResponse.estimatedTimeMinutes} min</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Protection score</span>
            <span className={`font-bold ${quoteResponse.protectionScore >= 70 ? "text-green-500" : quoteResponse.protectionScore >= 50 ? "text-yellow-500" : "text-red-500"}`}>
              {quoteResponse.protectionScore}/100
            </span>
          </div>
          {selectedRoute.slippagePercent > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Slippage</span>
              <span className="font-mono">{selectedRoute.slippagePercent}%</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Fees</span>
            <span className="font-mono text-xs text-gray-400">
              net: {selectedRoute.networkFees} / proto: {selectedRoute.protocolFees}
            </span>
          </div>

          {quoteResponse.protectionScore < 50 && (
            <p className="text-xs text-red-500 font-bold">Low protection score — proceed with caution</p>
          )}
          {quoteResponse.warnings.length > 0 && (
            <div className="space-y-0.5">
              {quoteResponse.warnings.map((w, i) => (
                <p key={i} className="text-xs text-yellow-600 dark:text-yellow-400">{w}</p>
              ))}
            </div>
          )}

          {quoteResponse.routes.length > 1 && !swap && (
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Route</label>
              <select
                value={selectedRoute.quoteId}
                onChange={(e) => {
                  const route = quoteResponse.routes.find((r) => r.quoteId === e.target.value);
                  if (route) setSelectedRoute(route);
                }}
                className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 text-sm"
              >
                {quoteResponse.routes.map((r) => (
                  <option key={r.quoteId} value={r.quoteId}>
                    {r.provider} — {r.expectedOutput} {toSymbol} ({r.routeLabel})
                  </option>
                ))}
              </select>
            </div>
          )}

          {txHash && (
            <div className="border-t border-gray-200 dark:border-gray-600 pt-3 mt-3">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded p-3">
                <p className="text-sm font-bold text-green-700 dark:text-green-300 mb-1">Deposit sent!</p>
                <p className="font-mono text-xs break-all text-green-600 dark:text-green-400">{txHash}</p>
              </div>
            </div>
          )}

          {destTxHash && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded p-3">
              <p className="text-sm font-bold text-green-700 dark:text-green-300 mb-1">Destination TX</p>
              <p className="font-mono text-xs break-all text-green-600 dark:text-green-400">{destTxHash}</p>
            </div>
          )}

          {swapStep && (
            <p className="text-xs text-blue-500 dark:text-blue-400 text-center font-medium animate-pulse">{swapStep}</p>
          )}

          {swapStatus && swapStatus !== "waiting_for_deposit" && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Status</span>
              <span className={`font-bold text-xs px-1.5 py-0.5 rounded ${
                swapStatus === "completed"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : swapStatus === "failed"
                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    : swapStatus === "refunded"
                      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              }`}>{STATUS_LABELS[swapStatus] ?? swapStatus}</span>
            </div>
          )}

          {swap && (
            <p className="text-[10px] text-gray-400 text-center break-all">
              Swap ID: {swap.id}
            </p>
          )}

          {!txHash && (
            <div className="border-t border-gray-200 dark:border-gray-600 pt-3 mt-3">
              {isBtcSource && selectedRoute.requiresMemo && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-2">
                  This swap requires an OP_RETURN memo — it will be included automatically.
                </p>
              )}
              <button
                onClick={handleExecute}
                disabled={executing}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {executing ? "Executing Swap..." : "Execute Swap"}
              </button>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-m-red text-sm">{error}</p>}

      {!quoteResponse && (
        <button
          onClick={handleQuote}
          disabled={loading}
          className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          {loading ? "Getting Quote..." : "Get Quote"}
        </button>
      )}
      {quoteResponse && !swap && (
        <button
          onClick={resetForm}
          className="w-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold py-2.5 px-6 rounded-lg text-sm transition-colors"
        >
          New Quote
        </button>
      )}
    </div>
  );
}
