"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/state/session";
import { useSettings } from "@/lib/wallet/settings";
import type { UiMode, CustomToken } from "@/lib/wallet/settings";
import { allNetworks, allNetworkKeys } from "@/lib/wallet/networks";
import { getAssetsForNetwork } from "@/lib/wallet/assets";
import { deriveAccount } from "@/lib/wallet/derive";
import { getSchemesForChainType } from "@/lib/wallet/derivationSchemes";
import { buildQrUrl } from "@/lib/compat/qrPayload";
import PasswordModal from "@/components/PasswordModal";
import QrCanvas from "@/components/QrCanvas";

type Tab = "recovery" | "assets";

type ModalAction =
  | { type: "reveal" }
  | { type: "addNetwork"; key: string }
  | { type: "removeNetwork"; key: string }
  | { type: "addToken"; networkKey: string; symbol: string }
  | { type: "removeToken"; networkKey: string; symbol: string };

export default function SettingsPage() {
  const { mnemonic, password, isUnlocked, readOnly } = useSession();
  const router = useRouter();
  const {
    settings,
    setMode,
    addNetwork,
    removeNetwork,
    toggleNetworkVisible,
    addToken,
    removeToken,
    toggleTokenVisible,
    addCustomToken,
    removeCustomToken,
    addAccount,
    removeAccount,
    setActiveAccount,
    setScheme,
    getDerivationPath,
    getCustomTokensForNetwork,
  } = useSettings();

  const [tab, setTab] = useState<Tab>("assets");
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [modalAction, setModalAction] = useState<ModalAction | null>(null);
  const [expandedNets, setExpandedNets] = useState<Record<string, boolean>>({});
  const [addTokenNet, setAddTokenNet] = useState<string | null>(null);
  const [customAddr, setCustomAddr] = useState("");
  const [customSymbol, setCustomSymbol] = useState("");
  const [customName, setCustomName] = useState("");
  const [customDecimals, setCustomDecimals] = useState("18");
  const [customPathNet, setCustomPathNet] = useState<string | null>(null);
  const [customPathValue, setCustomPathValue] = useState("");

  useEffect(() => {
    if (!isUnlocked) router.push("/qr-to-wallet");
  }, [isUnlocked, router]);

  const toggleExpanded = useCallback((key: string) => {
    setExpandedNets((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const resolveAddress = useCallback(
    (networkKey: string, path: string) => {
      if (!mnemonic) return "—";
      try {
        const net = allNetworks[networkKey];
        return deriveAccount(mnemonic, net.chainType, path).address;
      } catch {
        return "—";
      }
    },
    [mnemonic]
  );

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

  const handleAddCustomPath = useCallback(() => {
    if (!customPathNet || !customPathValue.trim()) return;
    addAccount(customPathNet, customPathValue.trim());
    setCustomPathNet(null);
    setCustomPathValue("");
  }, [customPathNet, customPathValue, addAccount]);

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
        <div>
          <div className="text-xs text-gray-400 mb-1">
            <Link href="/wallet" className="hover:text-blue-500 transition-colors">Wallet</Link>
            <span className="mx-1">/</span>
            <span>Settings</span>
          </div>
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

      {readOnly && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4 text-sm text-yellow-700 dark:text-yellow-400">
          Read-only mode — network and asset changes are disabled.
        </div>
      )}

      <div className="flex border-b border-gray-200 dark:border-gray-600 mb-6 overflow-x-auto">
        {(
          [
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
                const accounts = ns.accounts ?? [];
                const activeAccIdx = ns.activeAccountIndex ?? 0;
                const schemes = getSchemesForChainType(net.chainType);
                const currentSchemeId = ns.schemeId || schemes[0]?.id;

                return (
                  <div
                    key={key}
                    className="bg-gray-50 dark:bg-m-blue-dark-3 rounded-lg overflow-hidden"
                  >
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
                          disabled={readOnly}
                          className="w-4 h-4 cursor-pointer"
                          title="Show/hide in wallet"
                        />
                        <div>
                          <span className="font-bold">{net.name}</span>
                          <span className="text-xs text-gray-400 ml-2">
                            {net.nativeCurrency.symbol} &middot; {enabledCount} assets
                            {accounts.length > 1 && ` &middot; ${accounts.length} accounts`}
                          </span>
                        </div>
                      </div>
                      {!readOnly && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setModalAction({ type: "removeNetwork", key });
                          }}
                          className="text-xs bg-m-red hover:bg-red-700 text-white font-bold py-1 px-3 rounded"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-4">
                        {/* Derivation scheme + accounts */}
                        <div className="p-3 bg-gray-100 dark:bg-m-blue-dark-4 rounded-lg space-y-3">
                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                              Derivation Scheme
                            </label>
                            <select
                              value={currentSchemeId}
                              onChange={(e) => setScheme(key, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              disabled={readOnly}
                              className="mt-1 px-2 py-1.5 border border-gray-300 rounded w-full text-xs dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                            >
                              {schemes.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                              Accounts
                            </label>
                            <div className="mt-1 space-y-1">
                              {accounts.map((acc, idx) => (
                                <div
                                  key={idx}
                                  className={`flex items-center gap-2 p-2 rounded text-xs cursor-pointer transition-colors ${
                                    idx === activeAccIdx
                                      ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                                      : "hover:bg-gray-200 dark:hover:bg-gray-700"
                                  }`}
                                  onClick={(e) => { e.stopPropagation(); setActiveAccount(key, idx); }}
                                >
                                  <span className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                                    idx === activeAccIdx
                                      ? "border-blue-500 bg-blue-500"
                                      : "border-gray-400"
                                  }`} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold">{acc.label}</span>
                                      <span className="font-mono text-gray-400">{acc.path}</span>
                                    </div>
                                    <p className="font-mono text-gray-400 truncate">
                                      {resolveAddress(key, acc.path)}
                                    </p>
                                  </div>
                                  {idx > 0 && !readOnly && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); removeAccount(key, idx); }}
                                      className="text-gray-400 hover:text-m-red text-sm flex-shrink-0"
                                      title="Remove account"
                                    >
                                      &times;
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {!readOnly && (
                            <div className="flex gap-3">
                              <button
                                onClick={(e) => { e.stopPropagation(); addAccount(key); }}
                                className="text-xs text-blue-500 hover:text-blue-700 font-bold"
                              >
                                + Add Account
                              </button>
                              {customPathNet === key ? (
                                <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="text"
                                    value={customPathValue}
                                    onChange={(e) => setCustomPathValue(e.target.value)}
                                    placeholder="m/44'/60'/0'/0/5"
                                    className="flex-1 px-1.5 py-0.5 border border-gray-300 rounded text-xs font-mono dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                                  />
                                  <button
                                    onClick={handleAddCustomPath}
                                    disabled={!customPathValue.trim()}
                                    className="text-xs bg-m-green hover:bg-green-600 text-white font-bold py-0.5 px-2 rounded disabled:opacity-50"
                                  >
                                    Add
                                  </button>
                                  <button
                                    onClick={() => setCustomPathNet(null)}
                                    className="text-xs text-gray-400 hover:text-gray-600"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setCustomPathNet(key); }}
                                  className="text-xs text-purple-500 hover:text-purple-700 font-bold"
                                >
                                  + Custom Path
                                </button>
                              )}
                            </div>
                          )}
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
                                    disabled={!ts.added || readOnly}
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
                                {!readOnly && (
                                  isCustom ? (
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
                                  ) : null
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Add custom token */}
                        {!readOnly && net.chainType === "evm" && (
                          <div>
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
                        <span className="text-xs text-gray-400 ml-2 font-mono">
                          {net.derivationPath}
                        </span>
                        <div className="text-xs text-gray-400 mt-1">
                          Assets: {net.nativeCurrency.symbol}
                          {net.tokens.length > 0 &&
                            ", " + net.tokens.map((t) => t.symbol).join(", ")}
                        </div>
                      </div>
                      {!readOnly && (
                        <button
                          onClick={() => setModalAction({ type: "addNetwork", key })}
                          className="text-xs bg-m-green hover:bg-green-600 text-white font-bold py-1 px-3 rounded flex-shrink-0"
                        >
                          Add
                        </button>
                      )}
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
