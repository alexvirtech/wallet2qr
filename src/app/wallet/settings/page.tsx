"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/state/session";
import { useSettings } from "@/lib/wallet/settings";
import { allNetworks, allNetworkKeys } from "@/lib/wallet/networks";
import { deriveAccount } from "@/lib/wallet/derive";
import PasswordModal from "@/components/PasswordModal";

type ModalAction =
  | { type: "reveal" }
  | { type: "addNetwork"; key: string }
  | { type: "removeNetwork"; key: string }
  | { type: "addToken"; networkKey: string; symbol: string }
  | { type: "removeToken"; networkKey: string; symbol: string };

export default function SettingsPage() {
  const { mnemonic, isUnlocked } = useSession();
  const router = useRouter();
  const {
    settings,
    addNetwork,
    removeNetwork,
    toggleNetworkVisible,
    addToken,
    removeToken,
    toggleTokenVisible,
  } = useSettings();

  const [showMnemonic, setShowMnemonic] = useState(false);
  const [modalAction, setModalAction] = useState<ModalAction | null>(null);

  useEffect(() => {
    if (!isUnlocked) router.push("/qr-to-wallet");
  }, [isUnlocked, router]);

  const addresses = useMemo(() => {
    if (!mnemonic) return {};
    const result: Record<string, string> = {};
    for (const [key, net] of Object.entries(allNetworks)) {
      try {
        result[key] = deriveAccount(mnemonic, net.chainType).address;
      } catch {
        result[key] = "—";
      }
    }
    return result;
  }, [mnemonic]);

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

  const activeKeys = allNetworkKeys.filter((k) => settings.networks[k]?.added);
  const availableKeys = allNetworkKeys.filter(
    (k) => !settings.networks[k]?.added
  );

  if (!isUnlocked || !mnemonic) return null;

  const maskedMnemonic = mnemonic
    .split(" ")
    .map((w) => "*".repeat(w.length))
    .join(" ");

  return (
    <div className="w-full max-w-3xl mx-auto px-6 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/wallet")}
          className="text-blue-500 hover:text-blue-700 text-sm"
        >
          &larr; Back
        </button>
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      {/* Mnemonic section */}
      <section className="mb-8">
        <h2 className="text-lg font-bold mb-3">Mnemonic Phrase</h2>
        <div className="bg-gray-50 dark:bg-m-blue-dark-3 rounded-lg p-4">
          <p className="font-mono text-sm break-all leading-relaxed">
            {showMnemonic ? mnemonic : maskedMnemonic}
          </p>
          <div className="mt-3">
            {showMnemonic ? (
              <button
                onClick={() => setShowMnemonic(false)}
                className="text-xs bg-gray-300 hover:bg-gray-400 text-gray-700 font-bold py-1 px-3 rounded"
              >
                Hide
              </button>
            ) : (
              <button
                onClick={() => setModalAction({ type: "reveal" })}
                className="text-xs bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded"
              >
                Reveal
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Active networks */}
      <section className="mb-8">
        <h2 className="text-lg font-bold mb-3">Active Networks</h2>
        {activeKeys.length === 0 && (
          <p className="text-sm text-gray-400">
            No networks added. Add one from the available list below.
          </p>
        )}
        <div className="space-y-4">
          {activeKeys.map((key) => {
            const net = allNetworks[key];
            const ns = settings.networks[key];
            return (
              <div
                key={key}
                className="bg-gray-50 dark:bg-m-blue-dark-3 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={ns.visible}
                      onChange={() => toggleNetworkVisible(key)}
                      className="w-4 h-4 cursor-pointer"
                      title="Show/hide in wallet"
                    />
                    <div>
                      <span className="font-bold">{net.name}</span>
                      <span className="text-xs text-gray-400 ml-2">
                        Chain {net.chainId}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setModalAction({ type: "removeNetwork", key })
                    }
                    className="text-xs bg-m-red hover:bg-red-700 text-white font-bold py-1 px-3 rounded"
                  >
                    Remove
                  </button>
                </div>

                <div className="ml-7 text-xs text-gray-500 mb-2">
                  <span className="font-mono">{net.derivationPath}</span>
                  <span className="mx-2">|</span>
                  <span className="font-mono text-xs break-all">
                    {addresses[key]}
                  </span>
                </div>

                {/* Tokens */}
                <div className="ml-7 space-y-1">
                  {Object.entries(ns.tokens).map(([symbol, ts]) => {
                    const isNative =
                      symbol === net.nativeCurrency.symbol;
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
                              <span className="text-xs text-gray-400 ml-1">
                                (native)
                              </span>
                            )}
                          </span>
                        </div>
                        {ts.added && !isNative && (
                          <button
                            onClick={() =>
                              setModalAction({
                                type: "removeToken",
                                networkKey: key,
                                symbol,
                              })
                            }
                            className="text-xs text-m-red hover:text-red-700"
                          >
                            Remove
                          </button>
                        )}
                        {!ts.added && (
                          <button
                            onClick={() =>
                              setModalAction({
                                type: "addToken",
                                networkKey: key,
                                symbol,
                              })
                            }
                            className="text-xs text-blue-500 hover:text-blue-700"
                          >
                            Add
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Available networks */}
      {availableKeys.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-bold mb-3">Available Networks</h2>
          <div className="space-y-2">
            {availableKeys.map((key) => {
              const net = allNetworks[key];
              return (
                <div
                  key={key}
                  className="flex items-center justify-between bg-gray-50 dark:bg-m-blue-dark-3 rounded-lg p-4"
                >
                  <div>
                    <span className="font-bold">{net.name}</span>
                    <span className="text-xs text-gray-400 ml-2">
                      Chain {net.chainId} &middot;{" "}
                      <span className="font-mono">{net.derivationPath}</span>
                    </span>
                    <div className="text-xs text-gray-400 mt-1">
                      Assets: {net.nativeCurrency.symbol}
                      {net.tokens.length > 0 &&
                        ", " + net.tokens.map((t) => t.symbol).join(", ")}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setModalAction({ type: "addNetwork", key })
                    }
                    className="text-xs bg-m-green hover:bg-green-600 text-white font-bold py-1 px-3 rounded"
                  >
                    Add
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Password modal */}
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
