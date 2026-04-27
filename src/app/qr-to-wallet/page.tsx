"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession as useAuthSession, signIn as authSignIn } from "next-auth/react";
import QrScanner from "@/components/QrScanner";
import { decryptPayload, decryptPayloadV2, parseEnvelope } from "@/lib/compat/qrPayload";
import type { Envelope } from "@/lib/compat/qrPayload";
import { deterministicMnemonic } from "@/lib/compat/crypto";
import { validateBip39Mnemonic } from "@/lib/wallet/derive";
import { fetchPepper } from "@/lib/compat/fetchPepper";
import { useSession } from "@/lib/state/session";
import { sha256 } from "@noble/hashes/sha256";

function computeSubHash(sub: string): string {
  const hash = sha256(new TextEncoder().encode(sub));
  const truncated = hash.slice(0, 16);
  return btoa(String.fromCharCode(...truncated))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

type Mode = "wallet" | "mnemonic";

export default function QrToWalletPage() {
  const [rawQrUrl, setRawQrUrl] = useState<string | null>(null);
  const [envelope, setEnvelope] = useState<Envelope | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [mode, setMode] = useState<Mode>("wallet");
  const [readOnly, setReadOnly] = useState(false);
  const [revealedMnemonic, setRevealedMnemonic] = useState<string | null>(null);
  const [forceAccountBound, setForceAccountBound] = useState(false);
  const { setSession } = useSession();
  const router = useRouter();
  const { data: authSession, status: authStatus } = useAuthSession();

  const isSignedIn = authStatus === "authenticated";

  const isV2 = envelope?.v === 2;
  const needsLogin = isV2 || forceAccountBound;

  const accountMismatch = useMemo(() => {
    if (!isV2 || !isSignedIn || !authSession?.sub) return false;
    const env = envelope as { v: 2; sh: string };
    const currentHash = computeSubHash(authSession.sub);
    return currentHash !== env.sh;
  }, [isV2, isSignedIn, authSession?.sub, envelope]);

  const handleDecoded = useCallback((rawUrl: string) => {
    setRawQrUrl(rawUrl);
    const env = parseEnvelope(rawUrl);
    setEnvelope(env);
    setError(null);
  }, []);

  const handleDecrypt = useCallback(async () => {
    if (!envelope || !password) {
      setError("Upload a QR code and enter a password.");
      return;
    }
    if (needsLogin && !isSignedIn) {
      setError("Please sign in first.");
      return;
    }
    if (accountMismatch) {
      setError("This QR was bound to a different account.");
      return;
    }

    setDecrypting(true);
    setError(null);

    try {
      let mnemonic: string;

      if (needsLogin && isSignedIn) {
        const { pepper } = await fetchPepper();
        const decrypted = decryptPayloadV2(envelope.ds, password, pepper);
        if (decrypted) {
          const validation = validateBip39Mnemonic(decrypted);
          if (!validation.valid) {
            setError("Decryption produced invalid data — wrong password or wrong account.");
            setDecrypting(false);
            return;
          }
          mnemonic = decrypted;
        } else {
          if (isV2) {
            setError("Decryption failed — wrong password or wrong account.");
            setDecrypting(false);
            return;
          }
          mnemonic = deterministicMnemonic(password, envelope.ds);
        }
      } else {
        const decrypted = decryptPayload(envelope.ds, password);
        if (decrypted) {
          const validation = validateBip39Mnemonic(decrypted);
          if (!validation.valid) {
            mnemonic = deterministicMnemonic(password, envelope.ds);
          } else {
            mnemonic = decrypted;
          }
        } else {
          mnemonic = deterministicMnemonic(password, envelope.ds);
        }
      }

      if (mode === "wallet") {
        setSession(mnemonic, password, readOnly);
        router.push("/wallet");
      } else {
        setRevealedMnemonic(mnemonic);
        setDecrypting(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decryption failed");
      setDecrypting(false);
    }
  }, [envelope, password, mode, readOnly, setSession, router, needsLogin, isSignedIn, accountMismatch, isV2]);

  const handleReset = useCallback(() => {
    setRawQrUrl(null);
    setEnvelope(null);
    setPassword("");
    setError(null);
    setRevealedMnemonic(null);
    setMode("wallet");
    setReadOnly(false);
    setForceAccountBound(false);
  }, []);

  const canDecrypt = !decrypting && (!needsLogin || (isSignedIn && !accountMismatch));

  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold mb-2">QR &rarr; Wallet</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Scan or upload an encrypted QR code to unlock your wallet.
      </p>

      {!rawQrUrl ? (
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

          {isV2 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg p-3 space-y-2">
              <p className="text-sm font-bold text-blue-700 dark:text-blue-300">
                This QR is bound to a {(envelope as { pep: string }).pep === "google" ? "Google" : "Apple"} account.
              </p>
              {!isSignedIn && (
                <div className="space-y-1">
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    Sign in with the original account to decrypt.
                  </p>
                  <button
                    type="button"
                    onClick={() => authSignIn("google")}
                    className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm font-bold text-gray-700 dark:text-gray-300 py-1 px-3 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    Sign in with Google
                  </button>
                </div>
              )}
              {isSignedIn && accountMismatch && (
                <p className="text-sm text-red-600 dark:text-red-400 font-bold">
                  This QR was bound to a different account. Sign out and use the original account.
                </p>
              )}
              {isSignedIn && !accountMismatch && (
                <p className="text-xs text-m-green">
                  Signed in as {authSession?.user?.email} — account matches.
                </p>
              )}
            </div>
          )}

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
              onKeyDown={(e) => e.key === "Enter" && canDecrypt && handleDecrypt()}
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

          {!isV2 && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={forceAccountBound}
                onChange={(e) => setForceAccountBound(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Force account-bound decrypt (advanced)
              </span>
            </label>
          )}

          {error && <p className="text-m-red text-sm">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={handleDecrypt}
              disabled={!canDecrypt}
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

      {!rawQrUrl && error && <p className="text-m-red text-sm mt-4">{error}</p>}
    </div>
  );
}
