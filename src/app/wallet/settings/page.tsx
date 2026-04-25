"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/state/session";
import { useSettings } from "@/lib/wallet/settings";
import type { UiMode, PaymentAssetPref, PaymentNetworkPref, RoutingMode, CustomToken } from "@/lib/wallet/settings";
import { allNetworks, allNetworkKeys } from "@/lib/wallet/networks";
import { getAssetsForNetwork } from "@/lib/wallet/assets";
import { deriveAccount, incrementDerivationPath } from "@/lib/wallet/derive";
import { buildQrUrl } from "@/lib/compat/qrPayload";
import PasswordModal from "@/components/PasswordModal";
import QrCanvas from "@/components/QrCanvas";

type Tab = "recovery" | "payment" | "assets";

type ModalAction =
  | { type: "reveal" }
  | { type: "addNetwork"; key: string }
  | { type: "removeNetwork"; key: string }
  | { type: "addToken"; networkKey: string; symbol: string }
  | { type: "removeToken"; networkKey: string; symbol: string };

export default function SettingsPage() {
  const { mnemonic, password, isUnlocked } = useSession();
  const router = useRouter();
  const {
    settings,
    setMode,
    setPaymentAssetPref,
    setPaymentNetworkPref,
    setRoutingMode,
    addNetwork,
    removeNetwork,
    toggleNetworkVisible,
    addToken,
    removeToken,
    toggleTokenVisible,
    addCustomToken,
    removeCustomToken,
    setDerivationPath,
    getDerivationPath,
    getCustomTokensForNetwork,
  } = useSettings();

  const [tab, setTab] = useState<Tab>("payment");
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [modalAction, setModalAction] = useState<ModalAction | null>(null);
  const [expandedNets, setExpandedNets] = useState<Record<string, boolean>>({});
  const [addTokenNet, setAddTokenNet] = useState<string | null>(null);
  const [customAddr, setCustomAddr] = useState("");
  const [customSymbol, setCustomSymbol] = useState("");
  const [customName, setCustomName] = useState("");
  const [customDecimals, setCustomDecimals] = useState("18");
  const [editPathNet, setEditPathNet] = useState<string | null>(null);
  const [editPathValue, setEditPathValue] = useState("");

  useEffect(() => {
    if (!isUnlocked) router.push("/qr-to-wallet");
  }, [isUnlocked, router]);

  const toggleExpanded = useCallback((key: string) => {
    setExpandedNets((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const addresses = useMemo(() => {
    if (!mnemonic) return {};
    const result: Record<string, string> = {};
    for (const [key, net] of Object.entries(allNetworks)) {
      try {
        const path = settings.networks[key]?.derivationPath;
        result[key] = deriveAccount(mnemonic, net.chainType, path).address;
      } catch {
        result[key] = "—";
      }
    }
    return result;
  }, [mnemonic, settings]);

  const qrData = useMemo(() => {
    if (!showMnemonic || !mnemonic || !password) return null;
    return buildQrUrl(mnemonic, password);
  }, [showMnemonic, mnemonic, password]);

  const handleModalConfirm = useCallback(() => {
    if (!modalAction) return;
    switch (modalAction.type) {
      case "reveal":
        setShowMnemonic(true);
        break;
      case "addNetwork":
        addNetwork(modalAction.key);
        break;
      case "removeNetwork":
        removeNetwork(modalAction.key);
        break;
      case "addToken":
        addToken(modalAction.networkKey, modalAction.symbol);
        break;
      case "removeToken":
        removeToken(modalAction.networkKey, modalAction.symbol);
        break;
    }
    setModalAction(null);
  }, [modalAction, addNetwork, removeNetwork, addToken, removeToken]);

  const handleAddCustomToken = useCallback(() => {
    if (!addTokenNet || !customSymbol.trim() || !customAddr.trim()) return;
    const token: CustomToken = {
      symbol: customSymbol.trim().toUpperCase(),
      name: customName.trim() || customSymbol.trim().toUpperCase(),
      address: customAddr.trim(),
      decimals: parseInt(customDecimals, 10) || 18,
      coingeckoId: "",
      networkKey: addTokenNet,
    };
    addCustomToken(token);
    setCustomAddr("");
    setCustomSymbol("");
    setCustomName("");
    setCustomDecimals("18");
    setAddTokenNet(null);
  }, [addTokenNet, customSymbol, customAddr, customName, customDecimals, addCustomToken]);

  const handleSavePath = useCallback(() => {
    if (!editPathNet || !editPathValue.trim()) return;
    setDerivationPath(editPathNet, editPathValue.trim());
    setEditPathNet(null);
    setEditPathValue("");
  }, [editPathNet, editPathValue, setDerivationPath]);

  const handleAutoIncrement = useCallback(
    (key: string) => {
      const current = getDerivationPath(key);
      const next = incrementDerivationPath(current);
      setDerivationPath(key, next);
    },
    [getDerivationPath, setDerivationPath]
  );

  const activeKeys = allNetworkKeys.filter((k) => settings.networks[k]?.added);
  const availableKeys = allNetworkKeys.filter(
    (k) => !settings.networks[k]?.added
  );

  if (!isUnlocked || !mnemonic) return null;

  const maskedMnemonic = mnemonic
    .split(" ")
    .map((w) => "*".repeat(w.length))
    .join(" ");

  const isAdvanced = settings.mode === "advanced";

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/wallet")}
            className="text-blue-500 hover:text-blue-700 text-sm"
          >
            &larr; Back
          </button>
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {isAdvanced ? "Advanced" : "Simple"}
          </span>
          <button
            onClick={() => setMode(isAdvanced ? "simple" : "advanced")}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              isAdvanced ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                isAdvanced ? "left-5.5" : "left-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-600 mb-6 overflow-x-auto">
        {(
          [
            { key: "payment" as Tab, label: "Payment" },
            { key: "assets" as Tab, label: "Networks & Assets" },
            { key: "recovery" as Tab, label: "Recovery" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`py-2 px-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
              tab === t.key
                ? "border-blue-500 text-blue-500"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Payment Defaults tab */}
      {tab === "payment" && (
        <section className="space-y-6">
          <h2 className="text-lg font-bold">Payment Defaults</h2>
          <div className="bg-gray-50 dark:bg-m-blue-dark-3 rounded-lg p-4 space-y-4">
            <div>
              <label className="text-sm font-bold text-gray-600 dark:text-gray-300">
                Preferred Payment Asset
              </label>
              <select
                value={settings.preferredPaymentAsset}
                onChange={(e) => setPaymentAssetPref(e.target.value as PaymentAssetPref)}
                className="mt-1 px-2 py-1.5 border border-gray-300 rounded w-full dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 text-sm"
              >
                <option value="auto">Auto (system selects best)</option>
                <option value="USDT">USDT</option>
                <option value="USDC">USDC</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-bold text-gray-600 dark:text-gray-300">
                Preferred Payment Network
              </label>
              <select
                value={settings.preferredPaymentNetwork}
                onChange={(e) => setPaymentNetworkPref(e.target.value as PaymentNetworkPref)}
                className="mt-1 px-2 py-1.5 border border-gray-300 rounded w-full dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 text-sm"
              >
                <option value="auto">Auto (lowest fee)</option>
                {activeKeys
                  .filter((k) => k !== "bitcoin")
                  .map((k) => (
                    <option key={k} value={k}>{allNetworks[k]?.name}</option>
                  ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-bold text-gray-600 dark:text-gray-300">
                Routing Mode
              </label>
              <select
                value={settings.routingMode}
                onChange={(e) => setRoutingMode(e.target.value as RoutingMode)}
                className="mt-1 px-2 py-1.5 border border-gray-300 rounded w-full dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 text-sm"
              >
                <option value="lowest_fee">Lowest Fee</option>
                <option value="fastest">Fastest</option>
                <option value="best_liquidity">Best Liquidity</option>
                <option value="manual">Manual Confirmation</option>
              </select>
            </div>
          </div>
        </section>
      )}

      {/* Networks & Assets tab */}
      {tab === "assets" && (
        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-bold mb-3">Active Networks</h2>
            {activeKeys.length === 0 && (
              <p className="text-sm text-gray-400">No networks added. Add one below.</p>
            )}
            <div className="space-y-2">
              {activeKeys.map((key) => {
                const net = allNetworks[key];
                const ns = settings.networks[key];
                const assetDefs = getAssetsForNetwork(key);
                const customTokens = getCustomTokensForNetwork(key);
                const enabledCount = Object.values(ns.tokens).filter(
                  (t) => t.added && t.visible
                ).length;
                const isExpanded = expandedNets[key] ?? false;
                const currentPath = getDerivationPath(key);
                const isEditingPath = editPathNet === key;

                return (
                  <div
                    key={key}
                    className="bg-gray-50 dark:bg-m-blue-dark-3 rounded-lg overflow-hidden"
                  >
                    {/* Collapsible header */}
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer select-none"
                      onClick={() => toggleExpanded(key)}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-xs transition-transform ${isExpanded ? "rotate-90" : ""}`}>
                          &#9654;
                        </span>
                        <input
                          type="checkbox"
                          checked={ns.visible}
                          onChange={(e) => { e.stopPropagation(); toggleNetworkVisible(key); }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 cursor-pointer"
                          title="Show/hide in wallet"
                        />
                        <div>
                          <span className="font-bold">{net.name}</span>
                          <span className="text-xs text-gray-400 ml-2">
                            {net.nativeCurrency.symbol} &middot; {enabledCount} assets
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalAction({ type: "removeNetwork", key });
                        }}
                        className="text-xs bg-m-red hover:bg-red-700 text-white font-bold py-1 px-3 rounded"
                      >
                        Remove
                      </button>
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="px-4 pb-4">
                        {/* Derivation path */}
                        <div className="mb-3 p-2 bg-gray-100 dark:bg-m-blue-dark-4 rounded text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-gray-500">Derivation Path</span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAutoIncrement(key)}
                                className="text-blue-500 hover:text-blue-700 text-xs font-bold"
                                title="Auto-increment last index"
                              >
                                +1
                              </button>
                              <button
                                onClick={() => {
                                  setEditPathNet(key);
                                  setEditPathValue(currentPath);
                                }}
                                className="text-blue-500 hover:text-blue-700 text-xs"
                              >
                                Edit
                              </button>
                            </div>
                          </div>
                          {isEditingPath ? (
                            <div className="flex gap-1 mt-1">
                              <input
                                type="text"
                                value={editPathValue}
                                onChange={(e) => setEditPathValue(e.target.value)}
                                className="flex-1 px-1.5 py-0.5 border border-gray-300 rounded text-xs font-mono dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <button
                                onClick={handleSavePath}
                                className="text-xs bg-m-green hover:bg-green-600 text-white font-bold py-0.5 px-2 rounded"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditPathNet(null)}
                                className="text-xs text-gray-400 hover:text-gray-600"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <span className="font-mono">{currentPath}</span>
                          )}
                          <div className="mt-1 font-mono text-gray-400 break-all">
                            {addresses[key]}
                          </div>
                        </div>

                        {/* Token list */}
                        <div className="space-y-1 ml-2">
                          {Object.entries(ns.tokens).map(([symbol, ts]) => {
                            const isNative = symbol === net.nativeCurrency.symbol;
                            const def = assetDefs.find((a) => a.symbol === symbol);
                            const isCustom = customTokens.some((ct) => ct.symbol === symbol);
                            return (
                              <div
                                key={symbol}
                                className="flex items-center justify-between py-1"
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={ts.visible && ts.added}
                                    onChange={() => toggleTokenVisible(key, symbol)}
                                    disabled={!ts.added}
                                    className="w-3.5 h-3.5 cursor-pointer"
                                  />
                                  <span className="text-sm">
                                    {symbol}
                                    {isNative && (
                                      <span className="text-xs text-gray-400 ml-1">(gas)</span>
                                    )}
                                    {def?.isStablecoin && (
                                      <span className="text-xs text-green-500 ml-1">(stable)</span>
                                    )}
                                    {isCustom && (
                                      <span className="text-xs text-purple-500 ml-1">(custom)</span>
                                    )}
                                  </span>
                                </div>
                                {isCustom ? (
                                  <button
                                    onClick={() => removeCustomToken(key, symbol)}
                                    className="text-xs text-m-red hover:text-red-700"
                                  >
                                    Remove
                                  </button>
                                ) : ts.added && !isNative ? (
                                  <button
                                    onClick={() =>
                                      setModalAction({ type: "removeToken", networkKey: key, symbol })
                                    }
                                    className="text-xs text-m-red hover:text-red-700"
                                  >
                                    Remove
                                  </button>
                                ) : !ts.added ? (
                                  <button
                                    onClick={() =>
                                      setModalAction({ type: "addToken", networkKey: key, symbol })
                                    }
                                    className="text-xs text-blue-500 hover:text-blue-700"
                                  >
                                    Add
                                  </button>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>

                        {/* Add custom token */}
                        {net.chainType !== "bitcoin" && (
                          <div className="mt-3">
                            {addTokenNet === key ? (
                              <div className="p-3 border border-gray-200 dark:border-gray-600 rounded space-y-2">
                                <p className="text-xs font-bold text-gray-600 dark:text-gray-300">
                                  Add Custom Token
                                </p>
                                <input
                                  type="text"
                                  value={customAddr}
                                  onChange={(e) => setCustomAddr(e.target.value)}
                                  placeholder="Contract / Mint address"
                                  className="px-2 py-1 border border-gray-300 rounded w-full text-xs font-mono dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                                />
                                <div className="grid grid-cols-3 gap-2">
                                  <input
                                    type="text"
                                    value={customSymbol}
                                    onChange={(e) => setCustomSymbol(e.target.value)}
                                    placeholder="Symbol"
                                    className="px-2 py-1 border border-gray-300 rounded text-xs dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                                  />
                                  <input
                                    type="text"
                                    value={customName}
                                    onChange={(e) => setCustomName(e.target.value)}
                                    placeholder="Name"
                                    className="px-2 py-1 border border-gray-300 rounded text-xs dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                                  />
                                  <input
                                    type="number"
                                    value={customDecimals}
                                    onChange={(e) => setCustomDecimals(e.target.value)}
                                    placeholder="Decimals"
                                    className="px-2 py-1 border border-gray-300 rounded text-xs dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                                  />
                                </div>
                                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded p-2">
                                  <p className="text-[10px] text-yellow-700 dark:text-yellow-300">
                                    This token is not on the recommended list. Verify the contract address carefully.
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={handleAddCustomToken}
                                    disabled={!customAddr.trim() || !customSymbol.trim()}
                                    className="text-xs bg-m-green hover:bg-green-600 text-white font-bold py-1 px-3 rounded disabled:opacity-50"
                                  >
                                    Add Token
                                  </button>
                                  <button
                                    onClick={() => {
                                      setAddTokenNet(null);
                                      setCustomAddr("");
                                      setCustomSymbol("");
                                      setCustomName("");
                                      setCustomDecimals("18");
                                    }}
                                    className="text-xs text-gray-400 hover:text-gray-600"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setAddTokenNet(key)}
                                className="text-xs text-blue-500 hover:text-blue-700"
                              >
                                + Add custom token
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {availableKeys.length > 0 && (
            <section>
              <h2 className="text-lg font-bold mb-3">Available Networks</h2>
              <div className="space-y-2">
                {availableKeys.map((key) => {
                  const net = allNetworks[key];
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between bg-gray-50 dark:bg-m-blue-dark-3 rounded-lg p-4"
                    >
                      <div className="min-w-0 flex-1 mr-3">
                        <span className="font-bold">{net.name}</span>
                        {isAdvanced && (
                          <span className="text-xs text-gray-400 ml-2 font-mono">
                            {net.derivationPath}
                          </span>
                        )}
                        <div className="text-xs text-gray-400 mt-1">
                          Assets: {net.nativeCurrency.symbol}
                          {net.tokens.length > 0 &&
                            ", " + net.tokens.map((t) => t.symbol).join(", ")}
                        </div>
                      </div>
                      <button
                        onClick={() => setModalAction({ type: "addNetwork", key })}
                        className="text-xs bg-m-green hover:bg-green-600 text-white font-bold py-1 px-3 rounded flex-shrink-0"
                      >
                        Add
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Recovery tab */}
      {tab === "recovery" && (
        <section>
          <h2 className="text-lg font-bold mb-3">Mnemonic Phrase</h2>
          {!showMnemonic ? (
            <div className="bg-gray-50 dark:bg-m-blue-dark-3 rounded-lg p-4">
              <p className="font-mono text-sm break-all leading-relaxed">
                {maskedMnemonic}
              </p>
              <button
                onClick={() => setModalAction({ type: "reveal" })}
                className="mt-3 text-xs bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded"
              >
                Reveal
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-m-red/10 border border-m-red/30 rounded-lg p-3">
                <p className="text-m-red text-sm font-bold">Security Warning</p>
                <p className="text-m-red/80 text-xs mt-1">
                  Your mnemonic phrase and QR code grant full access to your
                  wallet. Never share them. Store backups offline in a secure
                  location.
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-m-blue-dark-3 rounded-lg p-4">
                <p className="font-mono text-sm break-all leading-relaxed">
                  {mnemonic}
                </p>
              </div>
              {qrData && (
                <div>
                  <h3 className="text-sm font-bold text-gray-600 dark:text-gray-300 mb-2">
                    Encrypted QR Code
                  </h3>
                  <p className="text-xs text-gray-400 mb-3">
                    Scan with wallet2qr to restore your wallet. Same format as
                    text2qr — fully compatible.
                  </p>
                  <QrCanvas data={qrData} />
                </div>
              )}
              <button
                onClick={() => setShowMnemonic(false)}
                className="text-xs bg-gray-300 hover:bg-gray-400 text-gray-700 font-bold py-1 px-3 rounded"
              >
                Hide
              </button>
            </div>
          )}
        </section>
      )}

      {modalAction && (
        <PasswordModal
          title={
            modalAction.type === "reveal"
              ? "Confirm to reveal mnemonic"
              : modalAction.type === "addNetwork"
                ? `Add ${allNetworks[modalAction.key]?.name}?`
                : modalAction.type === "removeNetwork"
                  ? `Remove ${allNetworks[modalAction.key]?.name}?`
                  : modalAction.type === "addToken"
                    ? `Add ${modalAction.symbol}?`
                    : `Remove ${modalAction.symbol}?`
          }
          onConfirm={handleModalConfirm}
          onCancel={() => setModalAction(null)}
        />
      )}
    </div>
  );
}
