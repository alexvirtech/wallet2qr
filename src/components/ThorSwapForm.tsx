"use client";

import { useState, useCallback, useMemo } from "react";
import { allNetworks } from "@/lib/wallet/networks";
import {
  fetchThorQuote,
  getThorAsset,
  getThorSupportedNetworks,
  thorAmountToHuman,
  humanToThorAmount,
  THORCHAIN_AFFILIATE,
  THORCHAIN_AFFILIATE_BPS,
  type ThorQuoteResponse,
} from "@/lib/thorchain/api";

interface ThorSwapFormProps {
  addresses: Record<string, string>;
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
    list.push({ symbol: t.symbol, label: t.symbol, address: t.address, decimals: t.decimals });
  }
  return list;
}

export default function ThorSwapForm({ addresses }: ThorSwapFormProps) {
  const supportedKeys = getThorSupportedNetworks();

  const [fromChain, setFromChain] = useState(supportedKeys.includes("bitcoin") ? "bitcoin" : supportedKeys[0]);
  const [toChain, setToChain] = useState(supportedKeys.includes("ethereum") ? "ethereum" : supportedKeys[1] ?? supportedKeys[0]);
  const [fromTokenIdx, setFromTokenIdx] = useState(0);
  const [toTokenIdx, setToTokenIdx] = useState(0);
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<ThorQuoteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const fromTokens = useMemo(() => getTokensForNetwork(fromChain), [fromChain]);
  const toTokens = useMemo(() => getTokensForNetwork(toChain), [toChain]);

  const fromToken = fromTokens[fromTokenIdx] ?? fromTokens[0];
  const toToken = toTokens[toTokenIdx] ?? toTokens[0];

  const handleQuote = useCallback(async () => {
    setError(null);
    setQuote(null);
    if (!amount || parseFloat(amount) <= 0) {
      setError("Enter a valid amount");
      return;
    }

    const fromAsset = getThorAsset(fromChain, fromToken.symbol, fromToken.address);
    const toAsset = getThorAsset(toChain, toToken.symbol, toToken.address);
    if (!fromAsset || !toAsset) {
      setError("Unsupported asset pair for THORChain");
      return;
    }

    const destination = addresses[toChain];
    if (!destination) {
      setError("No destination address for target network");
      return;
    }

    setLoading(true);
    try {
      const thorAmount = humanToThorAmount(amount, fromToken.decimals);
      const result = await fetchThorQuote({
        fromAsset,
        toAsset,
        amount: thorAmount,
        destination,
        affiliate: THORCHAIN_AFFILIATE || undefined,
        affiliateBps: THORCHAIN_AFFILIATE ? THORCHAIN_AFFILIATE_BPS : undefined,
      });
      setQuote(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get quote");
    } finally {
      setLoading(false);
    }
  }, [fromChain, toChain, fromToken, toToken, amount, addresses]);

  const copyText = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const expectedOut = quote ? thorAmountToHuman(quote.expected_amount_out, toToken.decimals) : null;
  const totalFee = quote ? thorAmountToHuman(quote.fees.total, toToken.decimals) : null;
  const minAmount = quote ? thorAmountToHuman(quote.recommended_min_amount_in, fromToken.decimals) : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            From
          </label>
          <select
            value={fromChain}
            onChange={(e) => { setFromChain(e.target.value); setFromTokenIdx(0); setQuote(null); }}
            className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 text-sm"
          >
            {supportedKeys.map((k) => (
              <option key={k} value={k}>{allNetworks[k].name}</option>
            ))}
          </select>
          <select
            value={fromTokenIdx}
            onChange={(e) => { setFromTokenIdx(Number(e.target.value)); setQuote(null); }}
            className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 text-sm"
          >
            {fromTokens.map((t, i) => (
              <option key={t.symbol} value={i}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            To
          </label>
          <select
            value={toChain}
            onChange={(e) => { setToChain(e.target.value); setToTokenIdx(0); setQuote(null); }}
            className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 text-sm"
          >
            {supportedKeys.map((k) => (
              <option key={k} value={k}>{allNetworks[k].name}</option>
            ))}
          </select>
          <select
            value={toTokenIdx}
            onChange={(e) => { setToTokenIdx(Number(e.target.value)); setQuote(null); }}
            className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 text-sm"
          >
            {toTokens.map((t, i) => (
              <option key={t.symbol} value={i}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Amount
        </label>
        <div className="mt-1 flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/40">
          <input
            type="number"
            step="any"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setQuote(null); }}
            placeholder="0.0"
            className="flex-1 px-3 py-2.5 dark:bg-m-blue-dark-2 dark:text-gray-200 font-mono text-sm focus:outline-none min-w-0 border-none"
          />
          <span className="px-3 py-2.5 bg-gray-100 dark:bg-m-blue-dark-2 dark:text-gray-200 text-sm font-bold border-l border-gray-300 dark:border-gray-600">
            {fromToken.symbol}
          </span>
        </div>
      </div>

      {quote && (
        <div className="bg-white dark:bg-m-blue-dark-2 border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Expected output</span>
            <span className="font-bold font-mono">{expectedOut} {toToken.symbol}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Total fees</span>
            <span className="font-mono">{totalFee} {toToken.symbol}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Slippage</span>
            <span>{quote.fees.slippage_bps} bps</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Est. time</span>
            <span>{Math.ceil(quote.total_swap_seconds / 60)} min</span>
          </div>
          {minAmount && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Min amount</span>
              <span className="font-mono">{minAmount} {fromToken.symbol}</span>
            </div>
          )}

          <div className="border-t border-gray-200 dark:border-gray-600 pt-3 mt-3 space-y-3">
            <p className="text-xs font-bold text-gray-600 dark:text-gray-300">
              Send {amount} {fromToken.symbol} to this address:
            </p>
            <div className="bg-gray-50 dark:bg-m-blue-dark-3 rounded p-2">
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-xs break-all">{quote.inbound_address}</p>
                <button
                  onClick={() => copyText(quote.inbound_address, "addr")}
                  className="text-[10px] text-blue-500 hover:text-blue-700 whitespace-nowrap flex-shrink-0"
                >
                  {copiedField === "addr" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                With memo:
              </p>
              <div className="bg-gray-50 dark:bg-m-blue-dark-3 rounded p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-xs break-all">{quote.memo}</p>
                  <button
                    onClick={() => copyText(quote.memo, "memo")}
                    className="text-[10px] text-blue-500 hover:text-blue-700 whitespace-nowrap flex-shrink-0"
                  >
                    {copiedField === "memo" ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded p-2">
              <p className="text-[10px] text-yellow-700 dark:text-yellow-300">
                The memo is required for the swap to be processed. Send from a wallet that supports OP_RETURN (BTC) or
                transaction memos. Quote expires at {new Date(quote.expiry * 1000).toLocaleTimeString()}.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-m-red text-sm">{error}</p>}

      {!quote && (
        <button
          onClick={handleQuote}
          disabled={loading}
          className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          {loading ? "Getting Quote..." : "Get THORChain Quote"}
        </button>
      )}
      {quote && (
        <button
          onClick={() => setQuote(null)}
          className="w-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold py-2.5 px-6 rounded-lg text-sm transition-colors"
        >
          New Quote
        </button>
      )}
    </div>
  );
}
