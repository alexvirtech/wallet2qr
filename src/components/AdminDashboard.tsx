"use client";

import { useState } from "react";
import type { ThorSwapRow } from "@/app/admin/page";
import type { SwapLogEntry } from "@/lib/admin/swapLog";

interface Props {
  thorSwaps: ThorSwapRow[];
  lifiSwaps: SwapLogEntry[];
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleString();
}

function shortenHash(hash: string) {
  if (!hash || hash.length < 16) return hash || "—";
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

function assetLabel(asset: string) {
  const parts = asset.split(".");
  return parts.length > 1 ? parts[1].split("-")[0] : asset;
}

type Tab = "thorchain" | "lifi";

export default function AdminDashboard({ thorSwaps, lifiSwaps }: Props) {
  const [tab, setTab] = useState<Tab>("thorchain");

  const thorCount = thorSwaps.length;
  const thorFeeTotal = thorSwaps.reduce((sum, s) => sum + s.affiliateFeeBps, 0);
  const thorAvgFee = thorCount > 0 ? (thorFeeTotal / thorCount).toFixed(0) : "0";

  const lifiCount = lifiSwaps.length;
  const lifiFeeSwaps = lifiSwaps.filter((s) => s.feeBps);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="THORChain Swaps" value={String(thorCount)} />
        <StatCard label="Avg Affiliate Fee" value={`${thorAvgFee} bps`} />
        <StatCard label="LI.FI Swaps" value={String(lifiCount)} />
        <StatCard
          label="LI.FI Fee Swaps"
          value={String(lifiFeeSwaps.length)}
        />
      </div>

      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setTab("thorchain")}
          className={`py-2 px-4 text-sm font-bold border-b-2 transition-colors ${
            tab === "thorchain"
              ? "border-blue-500 text-blue-500"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          THORChain ({thorCount})
        </button>
        <button
          onClick={() => setTab("lifi")}
          className={`py-2 px-4 text-sm font-bold border-b-2 transition-colors ${
            tab === "lifi"
              ? "border-blue-500 text-blue-500"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          LI.FI ({lifiCount})
        </button>
      </div>

      {tab === "thorchain" && (
        <div className="overflow-x-auto">
          {thorCount === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">
              No THORChain affiliate swaps yet. Swaps will appear once users trade via the THORChain tab.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">From</th>
                  <th className="py-2 pr-4">To</th>
                  <th className="py-2 pr-4">Aff. Fee</th>
                  <th className="py-2 pr-4">Liq. Fee</th>
                  <th className="py-2">Tx</th>
                </tr>
              </thead>
              <tbody>
                {thorSwaps.map((s, i) => (
                  <tr
                    key={i}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="py-2 pr-4 whitespace-nowrap">{formatDate(s.date)}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          s.status === "success"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">
                      {s.fromAmount} {assetLabel(s.fromAsset)}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">
                      {s.toAmount} {assetLabel(s.toAsset)}
                    </td>
                    <td className="py-2 pr-4">{s.affiliateFeeBps} bps</td>
                    <td className="py-2 pr-4 font-mono text-xs">{s.liquidityFee}</td>
                    <td className="py-2 font-mono text-xs">
                      {s.inTxHash ? (
                        <a
                          href={`https://viewblock.io/thorchain/tx/${s.inTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-700"
                        >
                          {shortenHash(s.inTxHash)}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "lifi" && (
        <div className="overflow-x-auto">
          {lifiCount === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">
                No LI.FI swaps recorded yet.
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Swap logging requires <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">BLOB_READ_WRITE_TOKEN</code> and{" "}
                <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">SWAP_LOG_SECRET</code> environment variables.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">From</th>
                  <th className="py-2 pr-4">To</th>
                  <th className="py-2 pr-4">Fee</th>
                  <th className="py-2">Tx</th>
                </tr>
              </thead>
              <tbody>
                {lifiSwaps.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="py-2 pr-4 whitespace-nowrap">{formatDate(s.timestamp)}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          s.status === "completed"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : s.status === "failed"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">
                      {s.fromAmount} {s.fromToken} ({s.fromChain})
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">
                      {s.toAmount} {s.toToken} ({s.toChain})
                    </td>
                    <td className="py-2 pr-4">
                      {s.feeBps ? `${s.feeBps} bps` : "—"}
                      {s.feeAmount && <span className="text-gray-400 ml-1">({s.feeAmount})</span>}
                    </td>
                    <td className="py-2 font-mono text-xs">
                      {shortenHash(s.txHash)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
