"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  createWalletClient,
  http,
  parseUnits,
  stringToHex,
  erc20Abi,
  type Address,
  type Hex,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, avalanche, bsc } from "viem/chains";
import { allNetworks } from "@/lib/wallet/networks";
import { getNativeBalance, getTokenBalance } from "@/lib/wallet/tokens";
import { getBtcBalance } from "@/lib/wallet/bitcoin";
import { sendBtcWithMemo } from "@/lib/wallet/btcSend";
import { fetchPrices } from "@/lib/wallet/prices";
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
    list.push({ symbol: t.symbol, label: t.symbol, address: t.address, decimals: t.decimals });
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
  [avalanche.id]: avalanche,
  [bsc.id]: bsc,
};

const THOR_ROUTER_ABI = [
  {
    inputs: [
      { name: "vault", type: "address" },
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "memo", type: "string" },
      { name: "expiry", type: "uint256" },
    ],
    name: "depositWithExpiry",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
] as const;

export default function ThorSwapForm({ addresses, privateKeys }: ThorSwapFormProps) {
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
  const [balance, setBalance] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [executing, setExecuting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [swapStep, setSwapStep] = useState<string | null>(null);

  const fromTokens = useMemo(() => getTokensForNetwork(fromChain), [fromChain]);
  const toTokens = useMemo(() => getTokensForNetwork(toChain), [toChain]);

  const fromToken = fromTokens[fromTokenIdx] ?? fromTokens[0];
  const toToken = toTokens[toTokenIdx] ?? toTokens[0];

  const isEvmSource = allNetworks[fromChain]?.chainType === "evm";

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

  const handleQuote = useCallback(async () => {
    setError(null);
    setQuote(null);
    setTxHash(null);
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

  const handleExecute = useCallback(async () => {
    if (!quote || !isEvmSource) return;
    const net = allNetworks[fromChain];
    const pk = privateKeys[fromChain];
    if (!net || !pk) return;

    setExecuting(true);
    setError(null);
    setTxHash(null);
    setSwapStep("Preparing wallet...");
    try {
      const chain = EVM_CHAINS[net.chainId] ?? {
        id: net.chainId,
        name: net.name,
        nativeCurrency: net.nativeCurrency,
        rpcUrls: { default: { http: [net.rpcUrl] } },
      };
      const account = privateKeyToAccount(pk as Hex);
      const client = createWalletClient({ account, chain, transport: http(net.rpcUrl) });
      const tokenAmount = parseUnits(amount, fromToken.decimals);

      let hash: Hex;
      if (!fromToken.address) {
        setSwapStep("Sending native token to THORChain vault...");
        hash = await client.sendTransaction({
          to: quote.inbound_address as Address,
          value: tokenAmount,
          data: stringToHex(quote.memo),
          chain,
        });
      } else {
        const router = quote.router as Address;
        if (!router) throw new Error("No router address in quote — cannot execute ERC20 swap");
        setSwapStep("Approving token spend...");
        await client.writeContract({
          address: fromToken.address as Address,
          abi: erc20Abi,
          functionName: "approve",
          args: [router, tokenAmount],
          chain,
        });
        setSwapStep("Depositing to THORChain router...");
        hash = await client.writeContract({
          address: router,
          abi: THOR_ROUTER_ABI,
          functionName: "depositWithExpiry",
          args: [
            quote.inbound_address as Address,
            fromToken.address as Address,
            tokenAmount,
            quote.memo,
            BigInt(quote.expiry),
          ],
          chain,
        });
      }
      setSwapStep("Transaction confirmed!");
      setTxHash(hash);
      logSwap({
        provider: "thorchain",
        fromChain,
        toChain,
        fromToken: fromToken.symbol,
        toToken: toToken.symbol,
        fromAmount: amount,
        toAmount: quote.expected_amount_out ? thorAmountToHuman(quote.expected_amount_out, toToken.decimals) : "",
        txHash: hash,
        status: "pending",
        feeBps: Number(THORCHAIN_AFFILIATE_BPS),
        feeAmount: quote.fees?.total ? thorAmountToHuman(quote.fees.total, toToken.decimals) : "",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transaction failed");
    } finally {
      setExecuting(false);
      setSwapStep(null);
    }
  }, [quote, isEvmSource, fromChain, toChain, privateKeys, amount, fromToken, toToken]);

  const handleExecuteBtc = useCallback(async () => {
    if (!quote || isEvmSource) return;
    const addr = addresses[fromChain];
    const pk = privateKeys[fromChain];
    if (!addr || !pk) return;

    setExecuting(true);
    setError(null);
    setTxHash(null);
    setSwapStep("Starting BTC swap...");
    try {
      const amountSats = Math.round(parseFloat(amount) * 1e8);
      const feeRate = parseInt(quote.recommended_gas_rate) || 10;
      const hash = await sendBtcWithMemo(
        pk,
        addr,
        quote.inbound_address,
        amountSats,
        feeRate,
        quote.memo,
        setSwapStep
      );
      setSwapStep("Transaction confirmed!");
      setTxHash(hash);
      logSwap({
        provider: "thorchain",
        fromChain,
        toChain,
        fromToken: fromToken.symbol,
        toToken: toToken.symbol,
        fromAmount: amount,
        toAmount: quote.expected_amount_out ? thorAmountToHuman(quote.expected_amount_out, toToken.decimals) : "",
        txHash: hash,
        status: "pending",
        feeBps: Number(THORCHAIN_AFFILIATE_BPS),
        feeAmount: quote.fees?.total ? thorAmountToHuman(quote.fees.total, toToken.decimals) : "",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transaction failed");
    } finally {
      setExecuting(false);
      setSwapStep(null);
    }
  }, [quote, isEvmSource, addresses, privateKeys, amount, fromChain, toChain, fromToken, toToken]);

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
            onChange={(e) => { setFromChain(e.target.value); setFromTokenIdx(0); setQuote(null); setTxHash(null); }}
            className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 text-sm"
          >
            {supportedKeys.map((k) => (
              <option key={k} value={k}>{allNetworks[k].name}</option>
            ))}
          </select>
          <select
            value={fromTokenIdx}
            onChange={(e) => { setFromTokenIdx(Number(e.target.value)); setQuote(null); setTxHash(null); }}
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
            onChange={(e) => { setToChain(e.target.value); setToTokenIdx(0); setQuote(null); setTxHash(null); }}
            className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 text-sm"
          >
            {supportedKeys.map((k) => (
              <option key={k} value={k}>{allNetworks[k].name}</option>
            ))}
          </select>
          <select
            value={toTokenIdx}
            onChange={(e) => { setToTokenIdx(Number(e.target.value)); setQuote(null); setTxHash(null); }}
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
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Amount
          </label>
          {balance !== null && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Available: <span className="font-mono">{parseFloat(balance).toFixed(6)}</span>{" "}
              <button type="button" onClick={() => { setAmount(parseFloat(balance).toString()); setQuote(null); setTxHash(null); }} className="text-blue-500 hover:text-blue-700 font-bold ml-1">Max</button>
            </span>
          )}
        </div>
        <div className="mt-1 flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/40">
          <input
            type="number"
            step="any"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setQuote(null); setTxHash(null); }}
            placeholder="0.0"
            className="flex-1 px-3 py-2.5 dark:bg-m-blue-dark-2 dark:text-gray-200 font-mono text-sm focus:outline-none min-w-0 border-none"
          />
          <span className="px-3 py-2.5 bg-gray-100 dark:bg-m-blue-dark-2 dark:text-gray-200 text-sm font-bold border-l border-gray-300 dark:border-gray-600">
            {fromToken.symbol}
          </span>
        </div>
        {usdEstimate && (
          <p className="text-xs text-gray-400 mt-1">~${usdEstimate}</p>
        )}
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

          {txHash && (
            <div className="border-t border-gray-200 dark:border-gray-600 pt-3 mt-3">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded p-3">
                <p className="text-sm font-bold text-green-700 dark:text-green-300 mb-1">Transaction sent!</p>
                <p className="font-mono text-xs break-all text-green-600 dark:text-green-400">{txHash}</p>
              </div>
            </div>
          )}

          {isEvmSource && !txHash && (
            <div className="border-t border-gray-200 dark:border-gray-600 pt-3 mt-3">
              <button
                onClick={handleExecute}
                disabled={executing}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {executing ? "Executing Swap..." : "Execute Swap"}
              </button>
              {swapStep && (
                <p className="text-xs text-blue-500 dark:text-blue-400 mt-2 text-center font-medium animate-pulse">{swapStep}</p>
              )}
              <p className="text-[10px] text-gray-400 mt-2 text-center">
                Quote expires at {new Date(quote.expiry * 1000).toLocaleTimeString()}
              </p>
            </div>
          )}

          {!isEvmSource && !txHash && (
            <div className="border-t border-gray-200 dark:border-gray-600 pt-3 mt-3 space-y-3">
              <button
                onClick={handleExecuteBtc}
                disabled={executing}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {executing ? "Executing Swap..." : "Execute Swap"}
              </button>
              {swapStep && (
                <p className="text-xs text-blue-500 dark:text-blue-400 mt-1 text-center font-medium animate-pulse">{swapStep}</p>
              )}
              <p className="text-[10px] text-gray-400 text-center">
                Quote expires at {new Date(quote.expiry * 1000).toLocaleTimeString()}
              </p>

              <details className="text-xs">
                <summary className="cursor-pointer text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                  Manual send details
                </summary>
                <div className="mt-2 space-y-2">
                  <p className="font-bold text-gray-600 dark:text-gray-300">
                    Vault address:
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
                  <p className="font-bold text-gray-600 dark:text-gray-300">
                    Memo (OP_RETURN):
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
              </details>
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
          {loading ? "Getting Quote..." : "Get THORChain Quote"}
        </button>
      )}
      {quote && (
        <button
          onClick={() => { setQuote(null); setTxHash(null); }}
          className="w-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold py-2.5 px-6 rounded-lg text-sm transition-colors"
        >
          New Quote
        </button>
      )}
    </div>
  );
}
