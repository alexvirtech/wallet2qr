"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession as useAuthSession } from "next-auth/react";
import QrScanner from "@/components/QrScanner";
import ProviderSelector from "@/components/ProviderSelector";
import { providerDisplayName } from "@/components/SignInButtons";
import { decryptPayload, decryptPayloadV2, parseEnvelope } from "@/lib/compat/qrPayload";
import type { Envelope, V3Envelope } from "@/lib/compat/qrPayload";
import { deterministicMnemonic } from "@/lib/compat/crypto";
import { validateBip39Mnemonic } from "@/lib/wallet/derive";
import { fetchPepper } from "@/lib/compat/fetchPepper";
import { decryptV3, computeProviderIdHash } from "@/lib/compat/cryptoV3";
import { useSession } from "@/lib/state/session";
import { sha256 } from "@noble/hashes/sha256";
import StepIndicator from "@/components/StepIndicator";
import type { Step } from "@/components/StepIndicator";
import SecurityStatusPanel from "@/components/SecurityStatusPanel";
import OfflineModeBanner from "@/components/OfflineModeBanner";

const SS_QR_KEY = "w2q_pending_qr";
const SS_PROVIDER_KEY = "w2q_decrypt_provider";

function computeSubHash(sub: string): string {
  const hash = sha256(new TextEncoder().encode(sub));
  const truncated = hash.slice(0, 16);
  return btoa(String.fromCharCode(...truncated))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

type Mode = "mnemonic" | "wallet2qr" | "extrasafe";

const EXTRASAFE_URL = "https://www.extrasafe.online";

export default function QrToWalletPage() {
  const [rawQrUrl, setRawQrUrl] = useState<string | null>(null);
  const [envelope, setEnvelope] = useState<Envelope | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [mode, setMode] = useState<Mode>("mnemonic");
  const [readOnly, setReadOnly] = useState(false);
  const [revealedMnemonic, setRevealedMnemonic] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const { setSession } = useSession();
  const router = useRouter();
  const { data: authSession, status: authStatus } = useAuthSession();

  const isSignedIn = authStatus === "authenticated";
  const sessionProvider = authSession?.provider ?? null;
  const providerSub = authSession?.providerSub ?? authSession?.sub;

  useEffect(() => {
    if (authStatus === "loading") return;
    const savedQr = sessionStorage.getItem(SS_QR_KEY);
    if (savedQr) {
      sessionStorage.removeItem(SS_QR_KEY);
      setRawQrUrl(savedQr);
      setEnvelope(parseEnvelope(savedQr));
    }
    const savedProvider = sessionStorage.getItem(SS_PROVIDER_KEY);
    if (savedProvider) {
      sessionStorage.removeItem(SS_PROVIDER_KEY);
      if (isSignedIn && sessionProvider === savedProvider) {
        setSelectedProvider(savedProvider);
      }
    }
  }, [authStatus, isSignedIn, sessionProvider]);

  const isV2 = envelope?.v === 2;
  const isV3 = envelope?.v === 3;
  const v3env = isV3 ? (envelope as V3Envelope) : null;

  const v3NeedsAccount = v3env && v3env.m === "b";
  const usesSocialFactor = selectedProvider && isSignedIn && sessionProvider === selectedProvider;

  const needsAccount = v3NeedsAccount || isV2;

  const accountMismatch = useMemo(() => {
    if (!usesSocialFactor || !providerSub) return false;
    if (isV2) {
      const env = envelope as { v: 2; sh: string };
      return computeSubHash(providerSub) !== env.sh;
    }
    if (isV3 && v3NeedsAccount && v3env?.ph) {
      return computeProviderIdHash(providerSub) !== v3env.ph;
    }
    return false;
  }, [isV2, isV3, usesSocialFactor, providerSub, envelope, v3env, v3NeedsAccount]);

  const handleDecoded = useCallback((rawUrl: string) => {
    setRawQrUrl(rawUrl);
    const env = parseEnvelope(rawUrl);
    setEnvelope(env);
    setError(null);
    setSelectedProvider(null);
  }, []);

  const handleProviderToggle = useCallback(
    (id: string) => {
      if (selectedProvider === id) {
        setSelectedProvider(null);
        return;
      }
      if (isSignedIn && sessionProvider === id) {
        setSelectedProvider(id);
      } else {
        if (rawQrUrl) sessionStorage.setItem(SS_QR_KEY, rawQrUrl);
        sessionStorage.setItem(SS_PROVIDER_KEY, id);
        signIn(id, { callbackUrl: "/qr-to-wallet" });
      }
    },
    [selectedProvider, isSignedIn, sessionProvider, rawQrUrl]
  );

  const handleDecrypt = useCallback(async () => {
    if (!envelope || !password) {
      setError("Upload a QR code and enter a password.");
      return;
    }

    // v3 decrypt
    if (isV3 && v3env) {
      if (v3NeedsAccount) {
        if (!selectedProvider) {
          setError(`This QR requires a social account (${providerDisplayName(v3env.p ?? "")}). Select the provider you used during encryption.`);
          return;
        }
        if (!isSignedIn || sessionProvider !== selectedProvider) {
          setError(`Please sign in with ${providerDisplayName(selectedProvider)} first`);
          return;
        }
        if (accountMismatch) {
          setError("This QR was bound to a different account. Sign out and use the original account.");
          return;
        }
      }

      setDecrypting(true);
      setError(null);

      try {
        const decrypted = await decryptV3(
          v3env.ds,
          password,
          v3env.s,
          {
            mode: v3env.m,
            providerStableId: v3NeedsAccount && usesSocialFactor && providerSub ? providerSub : undefined,
          }
        );

        if (!decrypted) {
          setError("Decryption failed — wrong password" + (v3NeedsAccount ? " or wrong account" : "") + ".");
          setDecrypting(false);
          return;
        }

        const validation = validateBip39Mnemonic(decrypted);
        if (!validation.valid) {
          setError("Decryption produced invalid data.");
          setDecrypting(false);
          return;
        }

        if (mode === "wallet2qr") {
          setSession(decrypted, password, readOnly);
          router.push("/wallet");
        } else if (mode === "extrasafe") {
          window.open(`${EXTRASAFE_URL}/#/import-wallet?m=${encodeURIComponent(decrypted)}`, '_blank');
        } else {
          setRevealedMnemonic(decrypted);
          setDecrypting(false);
        }
        return;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Decryption failed");
        setDecrypting(false);
        return;
      }
    }

    // v2 decrypt
    if (isV2) {
      if (!usesSocialFactor) {
        setError("This QR requires a social account. Select and sign in with the original provider.");
        return;
      }
      if (accountMismatch) {
        setError("This QR was bound to a different account.");
        return;
      }
    }

    setDecrypting(true);
    setError(null);

    try {
      let mnemonic: string;
      let isDet = false;

      if (isV2 && usesSocialFactor) {
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
          setError("Decryption failed — wrong password or wrong account.");
          setDecrypting(false);
          return;
        }
      } else {
        const decrypted = decryptPayload(envelope.ds, password);
        if (decrypted) {
          const validation = validateBip39Mnemonic(decrypted);
          if (!validation.valid) {
            mnemonic = deterministicMnemonic(password, envelope.ds);
            isDet = true;
          } else {
            mnemonic = decrypted;
          }
        } else {
          mnemonic = deterministicMnemonic(password, envelope.ds);
          isDet = true;
        }
      }

      if (mode === "wallet2qr") {
        setSession(mnemonic, password, readOnly, isDet);
        router.push("/wallet");
      } else if (mode === "extrasafe") {
        window.open(`${EXTRASAFE_URL}/#/import-wallet?m=${encodeURIComponent(mnemonic)}`, '_blank');
      } else {
        setRevealedMnemonic(mnemonic);
        setDecrypting(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decryption failed");
      setDecrypting(false);
    }
  }, [envelope, password, mode, readOnly, setSession, router, isV2, isV3, v3env, isSignedIn, sessionProvider, selectedProvider, usesSocialFactor, accountMismatch, v3NeedsAccount, providerSub]);

  const handleReset = useCallback(() => {
    setRawQrUrl(null);
    setEnvelope(null);
    setPassword("");
    setError(null);
    setRevealedMnemonic(null);
    setMode("mnemonic");
    setReadOnly(false);
    setSelectedProvider(null);
  }, []);

  const v3ModeLabel = v3env
    ? v3env.m === "a" ? "Password only"
      : "Password + social account"
    : "";

  const decryptSteps: Step[] = useMemo(() => {
    if (!rawQrUrl) return []
    const steps: Step[] = [
      { label: "QR scanned — encrypted payload loaded", status: "complete" },
    ]
    if (needsAccount) {
      steps.push({
        label: usesSocialFactor
          ? `Social identity verified (${providerDisplayName(selectedProvider!)})`
          : "Social identity — select and sign in",
        status: usesSocialFactor ? "complete" : selectedProvider ? "active" : "pending",
      })
      if (usesSocialFactor && !accountMismatch) {
        steps.push({ label: "Stable identity factor matched", status: "complete" })
      }
      if (accountMismatch) {
        steps.push({ label: "Account mismatch — wrong account", status: "failed" })
      }
    }
    steps.push({
      label: "Password entered",
      status: password.length > 0 ? "complete" : "pending",
    })
    steps.push({
      label: decrypting ? "Local decryption in progress..." : revealedMnemonic ? "Decrypted locally" : "Local decryption ready",
      status: revealedMnemonic ? "complete" : decrypting ? "active" : "pending",
    })
    return steps
  }, [rawQrUrl, needsAccount, usesSocialFactor, selectedProvider, accountMismatch, password, decrypting, revealedMnemonic])

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
            QR code detected!
            {isV3 && (
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-2">
                v3 &middot; {v3ModeLabel}
              </span>
            )}
            {isV2 && (
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-2">
                v2 &middot; account-bound (legacy)
              </span>
            )}
            {!isV2 && !isV3 && (
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-2">
                v1 &middot; password only (legacy)
              </span>
            )}
          </div>

          {/* Password input */}
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
              onKeyDown={(e) => e.key === "Enter" && !decrypting && handleDecrypt()}
              autoFocus
            />
          </div>

          {/* Social account selector (only for account-bound QRs) */}
          {needsAccount && (
            <div className="space-y-2">
              <p className="text-sm font-bold text-gray-600 dark:text-m-gray-light-1">
                Social account
                {v3NeedsAccount && (
                  <span className="text-xs font-normal text-amber-600 dark:text-amber-400 ml-2">
                    required — encrypted with {providerDisplayName(v3env?.p ?? "")}
                  </span>
                )}
                {isV2 && (
                  <span className="text-xs font-normal text-amber-600 dark:text-amber-400 ml-2">
                    required — account-bound (legacy)
                  </span>
                )}
              </p>

              <ProviderSelector
                selectedId={selectedProvider}
                onToggle={handleProviderToggle}
                sessionProviderId={sessionProvider ?? undefined}
              />

              {selectedProvider && isSignedIn && sessionProvider === selectedProvider && !accountMismatch && (
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 dark:text-green-400 flex-shrink-0">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="text-xs text-green-700 dark:text-green-300">
                    Signed in as <strong>{authSession?.user?.email}</strong>
                  </span>
                </div>
              )}

              {accountMismatch && (
                <p className="text-xs text-red-600 dark:text-red-400 font-bold">
                  This QR was bound to a different account. Sign out and use the original account.
                </p>
              )}
            </div>
          )}

          {/* Mode selection */}
          <div className="space-y-2">
            <p className="text-sm font-bold text-gray-600 dark:text-m-gray-light-1">
              After decryption
            </p>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "mnemonic"}
                  onChange={() => setMode("mnemonic")}
                  className="accent-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">View Mnemonic</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "wallet2qr"}
                  onChange={() => setMode("wallet2qr")}
                  className="accent-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Open in Wallet2QR</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "extrasafe"}
                  onChange={() => setMode("extrasafe")}
                  className="accent-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Open in ExtraSafe</span>
              </label>
            </div>
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

      {!rawQrUrl && error && <p className="text-m-red text-sm mt-4">{error}</p>}

      {/* Security indicators */}
      {rawQrUrl && !revealedMnemonic && (
        <div className="mt-6 space-y-4">
          <OfflineModeBanner />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">Progress</p>
              <StepIndicator steps={decryptSteps} />
            </div>
            <SecurityStatusPanel />
          </div>
        </div>
      )}
    </div>
  );
}
