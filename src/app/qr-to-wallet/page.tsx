"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import QrScanner from "@/components/QrScanner";
import { decryptPayload } from "@/lib/compat/qrPayload";
import { deterministicMnemonic } from "@/lib/compat/crypto";
import { validateBip39Mnemonic } from "@/lib/wallet/derive";
import { useSession } from "@/lib/state/session";

type Mode = "wallet" | "mnemonic";

export default function QrToWalletPage() {
  const [payload, setPayload] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [mode, setMode] = useState<Mode>("wallet");
  const [readOnly, setReadOnly] = useState(false);
  const [revealedMnemonic, setRevealedMnemonic] = useState<string | null>(null);
  const { setSession } = useSession();
  const router = useRouter();

  const handleDecoded = useCallback((p: string) => {
    setPayload(p);
    setError(null);
  }, []);

  const handleDecrypt = useCallback(() => {
    if (!payload || !password) {
      setError("Upload a QR code and enter a password.");
      return;
    }
    setDecrypting(true);
    setError(null);

    let mnemonic: string;
    const decrypted = decryptPayload(payload, password);
    if (decrypted) {
      const validation = validateBip39Mnemonic(decrypted);
      if (!validation.valid) {
        mnemonic = deterministicMnemonic(password, payload);
      } else {
        mnemonic = decrypted;
      }
    } else {
      mnemonic = deterministicMnemonic(password, payload);
    }

    if (mode === "wallet") {
      setSession(mnemonic, password, readOnly);
      router.push("/wallet");
    } else {
      setRevealedMnemonic(mnemonic);
      setDecrypting(false);
    }
  }, [payload, password, mode, readOnly, setSession, router]);

  const handleReset = useCallback(() => {
    setPayload(null);
    setPassword("");
    setError(null);
    setRevealedMnemonic(null);
    setMode("wallet");
    setReadOnly(false);
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold mb-2">QR → Wallet</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Scan or upload an encrypted QR code to unlock your wallet.
      </p>

      {!payload ? (
        <QrScanner
          onDecoded={handleDecoded}
          onError={(msg) => setError(msg)}
        />
      ) : revealedMnemonic ? (
        <div className="space-y-4">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4">
            <p className="text-xs text-yellow-600 dark:text-yellow-400 font-bold mb-2">
              Keep this secret — never share your mnemonic!
            </p>
            <p className="font-mono text-sm text-gray-800 dark:text-gray-200 break-words select-all">
              {revealedMnemonic}
            </p>
          </div>
          <button
            onClick={handleReset}
            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
          >
            Scan another QR code
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-m-green/10 border border-m-green/30 rounded-lg p-3 text-sm text-m-green font-bold">
            QR code detected! Enter your password to decrypt.
          </div>

          <div>
            <label className="text-sm font-bold text-gray-600 dark:text-m-gray-light-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password to decrypt"
              className="mt-1 px-2 py-1 border border-gray-300 rounded w-full dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
              onKeyDown={(e) => e.key === "Enter" && handleDecrypt()}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-bold text-gray-600 dark:text-m-gray-light-1">
              After decryption
            </p>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "wallet"}
                  onChange={() => setMode("wallet")}
                  className="accent-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Open Wallet
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "mnemonic"}
                  onChange={() => setMode("mnemonic")}
                  className="accent-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  View Mnemonic
                </span>
              </label>
            </div>

            {mode === "wallet" && (
              <label className="flex items-center gap-2 cursor-pointer ml-6">
                <input
                  type="checkbox"
                  checked={readOnly}
                  onChange={(e) => setReadOnly(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  Read-only mode
                </span>
                <span className="text-xs text-gray-400">
                  (view balances only, no transactions)
                </span>
              </label>
            )}
          </div>

          {error && <p className="text-m-red text-sm">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={handleDecrypt}
              disabled={decrypting}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1.5 px-4 rounded-md text-sm disabled:opacity-50"
            >
              {decrypting ? "Decrypting..." : "Decrypt"}
            </button>
            <button
              onClick={handleReset}
              className="bg-gray-300 hover:bg-gray-400 text-gray-700 font-bold py-1.5 px-4 rounded-md text-sm"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {!payload && error && <p className="text-m-red text-sm mt-4">{error}</p>}
    </div>
  );
}
