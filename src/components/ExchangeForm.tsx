"use client";

import { useState, useCallback, useEffect } from "react";
import { parseUnits, type Address, type Hex } from "viem";
import { allNetworks, allNetworkKeys } from "@/lib/wallet/networks";
import { useSettings } from "@/lib/wallet/settings";
import { initLifi } from "@/lib/lifi/client";
import { fetchQuote } from "@/lib/lifi/quote";
import type { LiFiStep, Route } from "@lifi/sdk";

interface ExchangeFormProps {
  address: Address;
  privateKey: Hex;
  currentNetwork: string;
}

const NATIVE_ADDRESS = "0x0000000000000000000000000000000000000000";
const SOL_NATIVE = "So11111111111111111111111111111111111111112";

function getAllTokens(networkKey: string) {
  const net = allNetworks[networkKey];
  if (!net) return [];
  const nativeAddr =
    net.chainType === "solana" ? SOL_NATIVE : NATIVE_ADDRESS;
  return [
    {
      symbol: net.nativeCurrency.symbol,
      address: nativeAddr,
      decimals: net.nativeCurrency.decimals,
      chainId: net.chainId,
    },
    ...net.tokens.map((t) => ({
      symbol: t.symbol,
      address: t.address,
      decimals: t.decimals,
      chainId: net.chainId,
    })),
  ];
}

export default function ExchangeForm({
  address,
  currentNetwork,
}: ExchangeFormProps) {
  const { getActiveNetworkKeys } = useSettings();
  const activeKeys = getActiveNetworkKeys();
  const exchangeKeys = allNetworkKeys;

  const [fromChain, setFromChain] = useState(currentNetwork);
  const [toChain, setToChain] = useState(
    currentNetwork === "ethereum" ? "arbitrum" : "ethereum"
  );
  const [fromToken, setFromToken] = useState("");
  const [toToken, setToToken] = useState("");
  const [amount, setAmount] = useState("");
  const [quoteResult, setQuoteResult] = useState<{
    step: LiFiStep;
    route: Route;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [txStatus, setTxStatus] = useState<string | null>(null);

  useEffect(() => {
    initLifi();
  }, []);

  const fromTokens = getAllTokens(fromChain);
  const toTokens = getAllTokens(toChain);

  useEffect(() => {
    if (fromTokens.length > 0 && !fromTokens.find((t) => t.address === fromToken)) {
      setFromToken(fromTokens[0].address);
    }
  }, [fromChain, fromTokens, fromToken]);

  useEffect(() => {
    if (toTokens.length > 0 && !toTokens.find((t) => t.address === toToken)) {
      setToToken(toTokens[0].address);
    }
  }, [toChain, toTokens, toToken]);

  const handleQuote = useCallback(async () => {
    setError(null);
    setQuoteResult(null);
    if (!amount || parseFloat(amount) <= 0) {
      setError("Enter a valid amount");
      return;
    }
    setLoading(true);
    try {
      const fromTokenInfo = fromTokens.find((t) => t.address === fromToken)!;
      const fromAmount = parseUnits(amount, fromTokenInfo.decimals).toString();
      const result = await fetchQuote({
        fromChain: allNetworks[fromChain].chainId,
        toChain: allNetworks[toChain].chainId,
        fromToken,
        toToken,
        fromAmount,
        fromAddress: address,
      });
      setQuoteResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get quote");
    } finally {
      setLoading(false);
    }
  }, [fromChain, toChain, fromToken, toToken, amount, address, fromTokens]);

  const handleExecute = useCallback(async () => {
    if (!quoteResult) return;
    setExecuting(true);
    setTxStatus("Executing swap...");
    setError(null);
    try {
      const { executeLifiRoute } = await import("@/lib/lifi/execute");
      await executeLifiRoute(quoteResult.route, (updated) => {
        const step = updated.steps?.[0];
        if (step?.execution?.status) {
          setTxStatus(`Status: ${step.execution.status}`);
        }
      });
      setTxStatus("Swap completed!");
      setQuoteResult(null);
      setAmount("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Swap failed");
      setTxStatus(null);
    } finally {
      setExecuting(false);
    }
  }, [quoteResult]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-bold text-gray-600 dark:text-gray-300">
            From Chain
          </label>
          <select
            value={fromChain}
            onChange={(e) => {
              setFromChain(e.target.value);
              setQuoteResult(null);
            }}
            className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 text-sm"
          >
            {exchangeKeys.map((k) => (
              <option key={k} value={k}>
                {allNetworks[k].name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-bold text-gray-600 dark:text-gray-300">
            To Chain
          </label>
          <select
            value={toChain}
            onChange={(e) => {
              setToChain(e.target.value);
              setQuoteResult(null);
            }}
            className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 text-sm"
          >
            {exchangeKeys.map((k) => (
              <option key={k} value={k}>
                {allNetworks[k].name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-bold text-gray-600 dark:text-gray-300">
            From Token
          </label>
          <select
            value={fromToken}
            onChange={(e) => {
              setFromToken(e.target.value);
              setQuoteResult(null);
            }}
            className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 text-sm"
          >
            {fromTokens.map((t) => (
              <option key={t.address} value={t.address}>
                {t.symbol}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-bold text-gray-600 dark:text-gray-300">
            To Token
          </label>
          <select
            value={toToken}
            onChange={(e) => {
              setToToken(e.target.value);
              setQuoteResult(null);
            }}
            className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 text-sm"
          >
            {toTokens.map((t) => (
              <option key={t.address} value={t.address}>
                {t.symbol}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-sm font-bold text-gray-600 dark:text-gray-300">
          Amount
        </label>
        <input
          type="number"
          step="any"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setQuoteResult(null);
          }}
          placeholder="0.0"
          className="mt-1 px-2 py-1.5 border border-gray-300 rounded w-full dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 font-mono text-sm"
        />
      </div>

      {quoteResult && (
        <div className="bg-gray-50 dark:bg-m-blue-dark-3 p-3 rounded-lg text-sm space-y-1">
          <p>
            <span className="font-bold">Estimated output:</span>{" "}
            {quoteResult.step.estimate?.toAmountMin
              ? (
                  Number(quoteResult.step.estimate.toAmountMin) /
                  10 ** (quoteResult.step.action?.toToken?.decimals ?? 18)
                ).toFixed(6)
              : "N/A"}{" "}
            {quoteResult.step.action?.toToken?.symbol}
          </p>
          <p>
            <span className="font-bold">Fee (incl. 0.5% integrator):</span>{" "}
            included in quote
          </p>
        </div>
      )}

      {error && <p className="text-m-red text-sm">{error}</p>}
      {txStatus && (
        <p className="text-m-green text-sm font-bold">{txStatus}</p>
      )}

      <div className="flex gap-2">
        {!quoteResult ? (
          <button
            onClick={handleQuote}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1.5 px-4 rounded-md text-sm disabled:opacity-50"
          >
            {loading ? "Getting Quote..." : "Get Quote"}
          </button>
        ) : (
          <button
            onClick={handleExecute}
            disabled={executing}
            className="bg-m-green hover:bg-green-600 text-white font-bold py-1.5 px-4 rounded-md text-sm disabled:opacity-50"
          >
            {executing ? "Executing..." : "Confirm Swap"}
          </button>
        )}
      </div>
    </div>
  );
}
