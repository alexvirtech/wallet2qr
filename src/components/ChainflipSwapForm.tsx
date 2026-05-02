"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { createWalletClient, http, parseUnits, type Address, type Hex, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, arbitrum } from "viem/chains";
import { allNetworks } from "@/lib/wallet/networks";
import { getNativeBalance, getTokenBalance } from "@/lib/wallet/tokens";
import { getBtcBalance } from "@/lib/wallet/bitcoin";
import { sendBtc } from "@/lib/wallet/btcSend";
import { fetchPrices } from "@/lib/wallet/prices";
import {
  getChainflipSupportedNetworks,
  getChainflipAsset,
  getChainflipQuote,
  requestChainflipDeposit,
  getChainflipStatus,
  getChainflipDecimals,
  formatChainflipAmount,
  isChainflipToken,
  type ChainflipQuoteResult,
} from "@/lib/chainflip/api";

interface ChainflipSwapFormProps {
  addresses: Record<string, string>;
  privateKeys: Record<string, string>;
}

interface TokenOption {
  symbol: string;
  label: string;
  address?: string;
  decimals: number;
}

function getTokensForNetwork(networkKey: string): TokenOption[] {
  const net = allNetworks[networkKey];
  if (!net) return [];
  const list: TokenOption[] = [
    { symbol: net.nativeCurrency.symbol, label: net.nativeCurrency.symbol, decimals: net.nativeCurrency.decimals },
  ];
  for (const t of net.tokens) {
    if (isChainflipToken(networkKey, t.symbol)) {
      list.push({ symbol: t.symbol, label: t.symbol, address: t.address, decimals: t.decimals });
    }
  }
  return list;
}

function logSwap(data: Record<string, unknown>) {
  fetch("/api/admin/log-swap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).catch(() => {});
}

const EVM_CHAINS: Record<number, Chain> = {
  [mainnet.id]: mainnet,
  [arbitrum.id]: arbitrum,
};

export default function ChainflipSwapForm({ addresses, privateKeys }: ChainflipSwapFormProps) {
  const supportedKeys = getChainflipSupportedNetworks();

  const [fromChain, setFromChain] = useState(supportedKeys.includes("bitcoin") ? "bitcoin" : supportedKeys[0]);
  const [toChain, setToChain] = useState(supportedKeys.includes("ethereum") ? "ethereum" : supportedKeys[1] ?? supportedKeys[0]);
  const [fromTokenIdx, setFromTokenIdx] = useState(0);
  const [toTokenIdx, setToTokenIdx] = useState(0);
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<ChainflipQuoteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [executing, setExecuting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [swapStep, setSwapStep] = useState<string | null>(null);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [swapState, setSwapState] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fromTokens = useMemo(() => getTokensForNetwork(fromChain), [fromChain]);
  const toTokens = useMemo(() => getTokensForNetwork(toChain), [toChain]);
  const fromToken = fromTokens[fromTokenIdx] ?? fromTokens[0];
  const toToken = toTokens[toTokenIdx] ?? toTokens[0];
  const isBtcSource = allNetworks[fromChain]?.chainType === "bitcoin";

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
          const tokens = getTokensForNetwork(fromChain);
          const info = tokens[fromTokenIdx] ?? tokens[0];
          if (!info) return;
          result = info.address
            ? await getTokenBalance(net, info.address as Address, addr as Address, info.decimals)
            : await getNativeBalance(net, addr as Address);
        }
        if (!cancelled && result) setBalance(result.formatted);
      } catch { if (!cancelled) setBalance(null); }
    })();
    return () => { cancelled = true; };
  }, [fromChain, fromTokenIdx, addresses]);

  useEffect(() => { fetchPrices().then(setPrices); }, []);

  const usdEstimate = useMemo(() => {
    const amt = parseFloat(amount);
    const price = prices[fromToken?.symbol ?? ""];
    if (!amt || !price) return null;
    const val = amt * price;
    return val >= 0.01 ? val.toFixed(2) : val.toPrecision(2);
  }, [amount, prices, fromToken?.symbol]);

  const startStatusPoll = useCallback((id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const status = await getChainflipStatus(id);
        setSwapState(status.state);
        switch (status.state) {
          case "WAITING":
            setSwapStep("Waiting for deposit confirmation...");
            break;
          case "RECEIVING":
            setSwapStep(`Deposit detected (${status.depositConfirmations ?? 0} confirmations)...`);
            break;
          case "SWAPPING":
            setSwapStep("Swap in progress...");
            break;
          case "SENDING":
            setSwapStep("Sending to destination...");
            break;
          case "SENT":
          case "COMPLETED":
            setSwapStep("Swap completed!");
            if (pollRef.current) clearInterval(pollRef.current);
            break;
          case "FAILED":
            setSwapStep("Swap failed" + (status.refundTxRef ? " - refund sent" : ""));
            setError("Swap failed. Funds will be refunded to your address.");
            if (pollRef.current) clearInterval(pollRef.current);
            break;
        }
      } catch { /* ignore poll errors */ }
    }, 15_000);
  }, []);

  const handleQuote = useCallback(async () => {
    setError(null);
    setQuote(null);
    setTxHash(null);
    setChannelId(null);
    setSwapState(null);
    if (!amount || parseFloat(amount) <= 0) {
      setError("Enter a valid amount");
      return;
    }

    const cfSrc = getChainflipAsset(fromChain, fromToken.symbol);
    const cfDest = getChainflipAsset(toChain, toToken.symbol);
    if (!cfSrc || !cfDest) {
      setError("Unsupported asset pair for Chainflip");
      return;
    }

    if (fromChain === toChain && fromToken.symbol === toToken.symbol) {
      setError("Source and destination must be different");
      return;
    }

    setLoading(true);
    try {
      const amountBase = parseUnits(amount, fromToken.decimals).toString();
      const result = await getChainflipQuote(
        fromChain, fromToken.symbol,
        toChain, toToken.symbol,
        amountBase
      );
      setQuote(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get quote");
    } finally {
      setLoading(false);
    }
  }, [fromChain, toChain, fromToken, toToken, amount]);

  const handleExecute = useCallback(async () => {
    if (!quote) return;
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
    setSwapStep("Requesting deposit address...");

    try {
      const amountBase = parseUnits(amount, fromToken.decimals).toString();
      const deposit = await requestChainflipDeposit(
        fromChain, fromToken.symbol,
        toChain, toToken.symbol,
        amountBase,
        destAddr,
        srcAddr,
        quote.recommendedSlippageTolerancePercent,
        quote.recommendedRetryDurationMinutes
      );

      setChannelId(deposit.depositChannelId);
      setSwapStep(`Sending ${fromToken.symbol} to deposit address...`);

      let hash: string;

      if (isBtcSource) {
        const amountSats = Math.round(parseFloat(amount) * 1e8);
        hash = await sendBtc(pk, srcAddr, deposit.depositAddress, amountSats, 4);
      } else {
        const net = allNetworks[fromChain];
        const chain = EVM_CHAINS[net.chainId] ?? {
          id: net.chainId,
          name: net.name,
          nativeCurrency: net.nativeCurrency,
          rpcUrls: { default: { http: [net.rpcUrl] } },
        };
        const account = privateKeyToAccount(pk as Hex);
        const client = createWalletClient({ account, chain, transport: http(net.rpcUrl) });
        const tokenAmount = parseUnits(amount, fromToken.decimals);

        if (!fromToken.address) {
          hash = await client.sendTransaction({
            to: deposit.depositAddress as Address,
            value: tokenAmount,
            chain,
          });
        } else {
          const { writeContract } = await import("viem/actions");
          const erc20 = (await import("viem")).erc20Abi;
          hash = await writeContract(client, {
            address: fromToken.address as Address,
            abi: erc20,
            functionName: "transfer",
            args: [deposit.depositAddress as Address, tokenAmount],
            chain,
          });
        }
      }

      setTxHash(hash);
      setSwapStep("Deposit sent! Waiting for confirmations...");
      startStatusPoll(deposit.depositChannelId);

      logSwap({
        provider: "chainflip",
        fromChain,
        toChain,
        fromToken: fromToken.symbol,
        toToken: toToken.symbol,
        fromAmount: amount,
        toAmount: formatChainflipAmount(quote.egressAmount, getChainflipDecimals(toToken.symbol)),
        txHash: hash,
        status: "pending",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transaction failed");
      setSwapStep(null);
    } finally {
      setExecuting(false);
    }
  }, [quote, addresses, privateKeys, fromChain, toChain, fromToken, toToken, amount, isBtcSource, startStatusPoll]);

  const outDecimals = getChainflipDecimals(toToken.symbol);
  const expectedOut = quote ? formatChainflipAmount(quote.egressAmount, outDecimals) : null;

  const resetForm = () => {
    setQuote(null);
    setTxHash(null);
    setChannelId(null);
    setSwapState(null);
    setSwapStep(null);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">From</label>
          <select
            value={fromChain}
            onChange={(e) => { setFromChain(e.target.value); setFromTokenIdx(0); resetForm(); }}
            className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 text-sm"
          >
            {supportedKeys.map((k) => (
              <option key={k} value={k}>{allNetworks[k].name}</option>
            ))}
          </select>
          <select
            value={fromTokenIdx}
            onChange={(e) => { setFromTokenIdx(Number(e.target.value)); resetForm(); }}
            className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 text-sm"
          >
            {fromTokens.map((t, i) => (
              <option key={t.symbol} value={i}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">To</label>
          <select
            value={toChain}
            onChange={(e) => { setToChain(e.target.value); setToTokenIdx(0); resetForm(); }}
            className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 text-sm"
          >
            {supportedKeys.map((k) => (
              <option key={k} value={k}>{allNetworks[k].name}</option>
            ))}
          </select>
          <select
            value={toTokenIdx}
            onChange={(e) => { setToTokenIdx(Number(e.target.value)); resetForm(); }}
            className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 text-sm"
          >
            {toTokens.map((t, i) => (
              <option key={t.symbol} value={i}>{t.label}</option>
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
            {fromToken.symbol}
          </span>
        </div>
        {usdEstimate && <p className="text-xs text-gray-400 mt-1">~${usdEstimate}</p>}
      </div>

      {quote && (
        <div className="bg-white dark:bg-m-blue-dark-2 border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Expected output</span>
            <span className="font-bold font-mono">{expectedOut} {toToken.symbol}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Rate</span>
            <span className="font-mono">{quote.estimatedPrice}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Est. time</span>
            <span>{Math.ceil(quote.estimatedDurationSeconds / 60)} min</span>
          </div>
          {quote.lowLiquidityWarning && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400 font-bold">Low liquidity warning</p>
          )}

          {txHash && (
            <div className="border-t border-gray-200 dark:border-gray-600 pt-3 mt-3">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded p-3">
                <p className="text-sm font-bold text-green-700 dark:text-green-300 mb-1">Deposit sent!</p>
                <p className="font-mono text-xs break-all text-green-600 dark:text-green-400">{txHash}</p>
              </div>
            </div>
          )}

          {swapStep && (
            <p className="text-xs text-blue-500 dark:text-blue-400 text-center font-medium animate-pulse">{swapStep}</p>
          )}

          {swapState && swapState !== "WAITING" && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Swap status</span>
              <span className={`font-bold text-xs px-1.5 py-0.5 rounded ${
                swapState === "COMPLETED" || swapState === "SENT"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : swapState === "FAILED"
                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              }`}>{swapState}</span>
            </div>
          )}

          {channelId && (
            <p className="text-[10px] text-gray-400 text-center break-all">
              Channel: {channelId}
            </p>
          )}

          {!txHash && (
            <div className="border-t border-gray-200 dark:border-gray-600 pt-3 mt-3">
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

      {!quote && (
        <button
          onClick={handleQuote}
          disabled={loading}
          className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          {loading ? "Getting Quote..." : "Get Chainflip Quote"}
        </button>
      )}
      {quote && !channelId && (
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
