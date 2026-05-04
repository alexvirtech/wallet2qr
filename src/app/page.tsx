"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { signIn, useSession as useAuthSession } from "next-auth/react";
import ProviderSelector from "@/components/ProviderSelector";
import { providerDisplayName } from "@/components/SignInButtons";
import { decryptPayload, decryptPayloadV2 } from "@/lib/compat/qrPayload";
import { deterministicMnemonic } from "@/lib/compat/crypto";
import { validateBip39Mnemonic } from "@/lib/wallet/derive";
import { fetchPepper } from "@/lib/compat/fetchPepper";
import { decryptV3, computeProviderIdHash } from "@/lib/compat/cryptoV3";
import type { EncryptionMode } from "@/lib/compat/cryptoV3";
import { useSession } from "@/lib/state/session";
import StepIndicator from "@/components/StepIndicator";
import type { Step } from "@/components/StepIndicator";
import SecurityStatusPanel from "@/components/SecurityStatusPanel";
import OfflineModeBanner from "@/components/OfflineModeBanner";

type DeepLinkMode = "mnemonic" | "wallet2qr" | "extrasafe" | "tinywallet";

const EXTRASAFE_URL = "https://www.extrasafe.online";
const TINYWALLET_URL = "https://www.tiny-wallet.com";

function getRawParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  const match = window.location.search.match(new RegExp(`[?&]${name}=([^&]*)`));
  return match ? match[1] : null;
}

function DeepLinkHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setSession } = useSession();
  const { data: authSession, status: authStatus } = useAuthSession();
  // Use raw extraction for ds to avoid + → space conversion by searchParams
  const ds = getRawParam("ds") || searchParams.get("ds");
  const pw = searchParams.get("pw");
  const roParam = searchParams.get("readOnly");
  const v = searchParams.get("v");
  const pep = searchParams.get("pep");
  const salt = searchParams.get("s");
  const encMode = searchParams.get("m") as EncryptionMode | null;
  const provider = searchParams.get("p");
  const ph = searchParams.get("ph");
  const w1 = searchParams.get("w1");
  const w2 = searchParams.get("w2");

  const isV2 = v === "2";
  const isV3 = v === "3";
  const isSignedIn = authStatus === "authenticated";
  const providerSub = authSession?.providerSub ?? authSession?.sub;

  const [password, setPassword] = useState(pw ?? "");
  const [backupCode, setBackupCode] = useState("");
  const [useBackup, setUseBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [autoAttempted, setAutoAttempted] = useState(false);
  const [readOnly, setReadOnly] = useState(roParam === "1");
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [revealedMnemonic, setRevealedMnemonic] = useState<string | null>(null);

  const sessionProvider = authSession?.provider ?? null;
  const v3NeedsAccount = isV3 && (encMode === "b" || encMode === "d") && !useBackup;
  const v3NeedsBackup = isV3 && (encMode === "c" || (encMode === "d" && useBackup));
  const usesSocialFactor = selectedProvider && isSignedIn && sessionProvider === selectedProvider;
  const needsAccount = v3NeedsAccount || isV2;
  const v3AccountMismatch = v3NeedsAccount && usesSocialFactor && providerSub && ph
    ? computeProviderIdHash(providerSub) !== ph
    : false;

  const handleProviderToggle = useCallback((id: string) => {
    if (selectedProvider === id) {
      setSelectedProvider(null);
    } else if (isSignedIn && sessionProvider === id) {
      setSelectedProvider(id);
    } else {
      signIn(id, { callbackUrl: typeof window !== "undefined" ? window.location.href : "/" });
    }
  }, [selectedProvider, isSignedIn, sessionProvider]);

  const handleDecrypt = useCallback(async (targetMode: DeepLinkMode, pwd?: string) => {
    const pass = pwd ?? password;
    if (!ds || !pass) {
      setError("Enter your password to decrypt.");
      return;
    }

    // v3 decrypt
    if (isV3 && salt && encMode) {
      if (v3NeedsAccount && !usesSocialFactor) {
        if (!selectedProvider) {
          setError(`This QR requires a social account (${providerDisplayName(provider ?? "")}). Select the provider.`);
        } else {
          setError(`Please sign in with ${providerDisplayName(selectedProvider)} first`);
        }
        return;
      }
      if (v3NeedsBackup && !backupCode.trim()) {
        setError("Enter your backup recovery code.");
        return;
      }

      setDecrypting(true);
      setError(null);

      try {
        const decrypted = await decryptV3(ds, pass, salt, {
          mode: encMode,
          providerStableId: v3NeedsAccount && usesSocialFactor && providerSub ? providerSub : undefined,
          backupCode: v3NeedsBackup ? backupCode.trim() : undefined,
          wrappedKey1B64: w1 ?? undefined,
          wrappedKey2B64: w2 ?? undefined,
        });

        if (!decrypted) {
          setError("Decryption failed — wrong password" +
            (v3NeedsAccount ? ", wrong account" : "") +
            (v3NeedsBackup ? ", or wrong backup code" : "") + ".");
          setDecrypting(false);
          return;
        }

        const validation = validateBip39Mnemonic(decrypted);
        if (!validation.valid) {
          setError("Decryption produced invalid data.");
          setDecrypting(false);
          return;
        }

        if (targetMode === "wallet2qr") {
          setSession(decrypted, pass, readOnly);
          router.push("/wallet");
        } else if (targetMode === "extrasafe") {
          window.open(`${EXTRASAFE_URL}/#/import-wallet?m=${encodeURIComponent(decrypted)}`, '_blank');
          setDecrypting(false);
        } else if (targetMode === "tinywallet") {
          window.open(`${TINYWALLET_URL}/?m=${encodeURIComponent(decrypted)}`, '_blank');
          setDecrypting(false);
        } else {
          setRevealedMnemonic(decrypted);
          setDecrypting(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Decryption failed");
        setDecrypting(false);
      }
      return;
    }

    // v2 decrypt
    if (isV2 && !usesSocialFactor) {
      if (!selectedProvider) {
        setError("This QR requires a social account. Select the provider you used during encryption.");
      } else {
        setError(`Please sign in with ${providerDisplayName(selectedProvider)} first`);
      }
      return;
    }
    setDecrypting(true);
    setError(null);

    try {
      let mnemonic: string;
      let isDet = false;

      if (isV2 && usesSocialFactor) {
        const { pepper } = await fetchPepper();
        const decrypted = decryptPayloadV2(ds, pass, pepper);
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
        const decrypted = decryptPayload(ds, pass);
        if (decrypted) {
          const validation = validateBip39Mnemonic(decrypted);
          if (validation.valid) {
            mnemonic = decrypted;
          } else {
            mnemonic = deterministicMnemonic(pass, ds);
            isDet = true;
          }
        } else {
          mnemonic = deterministicMnemonic(pass, ds);
          isDet = true;
        }
      }

      if (targetMode === "wallet2qr") {
        setSession(mnemonic, pass, readOnly, isDet);
        router.push("/wallet");
      } else if (targetMode === "extrasafe") {
        window.open(`${EXTRASAFE_URL}/#/import-wallet?m=${encodeURIComponent(mnemonic)}`, '_blank');
        setDecrypting(false);
      } else if (targetMode === "tinywallet") {
        window.open(`${TINYWALLET_URL}/?m=${encodeURIComponent(mnemonic)}`, '_blank');
        setDecrypting(false);
      } else {
        setRevealedMnemonic(mnemonic);
        setDecrypting(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decryption failed");
      setDecrypting(false);
    }
  }, [ds, password, readOnly, isV2, isV3, isSignedIn, salt, encMode, providerSub, backupCode, v3NeedsAccount, v3NeedsBackup, usesSocialFactor, selectedProvider, provider, w1, w2, setSession, router]);

  useEffect(() => {
    if (ds && pw && !autoAttempted && !isV2 && !isV3) {
      setAutoAttempted(true);
      handleDecrypt("mnemonic", pw);
    }
  }, [ds, pw, autoAttempted, isV2, isV3, handleDecrypt]);

  const v3ModeLabel = isV3
    ? encMode === "a" ? "Password only"
      : "Password + social account"
    : "";

  const decryptSteps: Step[] = useMemo(() => {
    if (!ds) return [];
    const steps: Step[] = [
      { label: "Encrypted payload loaded from URL", status: "complete" },
    ];
    if (needsAccount) {
      steps.push({
        label: usesSocialFactor
          ? `Social identity verified (${providerDisplayName(selectedProvider!)})`
          : "Social identity — select and sign in",
        status: usesSocialFactor ? "complete" : selectedProvider ? "active" : "pending",
      });
      if (usesSocialFactor && !v3AccountMismatch) {
        steps.push({ label: "Stable identity factor matched", status: "complete" });
      }
      if (v3AccountMismatch) {
        steps.push({ label: "Account mismatch — wrong account", status: "failed" });
      }
    }
    steps.push({
      label: "Password entered",
      status: password.length > 0 ? "complete" : "pending",
    });
    steps.push({
      label: decrypting ? "Local decryption in progress..." : revealedMnemonic ? "Decrypted locally" : "Local decryption ready",
      status: revealedMnemonic ? "complete" : decrypting ? "active" : "pending",
    });
    return steps;
  }, [ds, needsAccount, usesSocialFactor, selectedProvider, v3AccountMismatch, password, decrypting, revealedMnemonic]);

  if (!ds) return null;

  const canDecrypt = !decrypting;

  if (revealedMnemonic) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-12 space-y-4">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4">
          <p className="text-xs text-yellow-600 dark:text-yellow-400 font-bold mb-2">
            Keep this secret — never share your mnemonic!
          </p>
          <p className="font-mono text-sm text-gray-800 dark:text-gray-200 break-words select-all">
            {revealedMnemonic}
          </p>
        </div>
        <button
          onClick={() => {
            setSession(revealedMnemonic, password, readOnly);
            router.push("/wallet");
          }}
          className="bg-m-green hover:bg-green-600 text-white font-bold py-1.5 px-4 rounded-md text-sm"
        >
          Open Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto px-4 py-12">
      <div className="bg-gray-50 dark:bg-m-blue-dark-3 rounded-xl p-6 space-y-4">
        <h2 className="text-xl font-bold text-center">Unlock Wallet</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          An encrypted wallet was detected in this link.
          {isV3 && (
            <span className="text-xs text-gray-400 ml-1">
              v3 &middot; {v3ModeLabel}
            </span>
          )}
          {isV2 && (
            <span className="text-xs text-gray-400 ml-1">
              v2 &middot; account-bound (legacy)
            </span>
          )}
          {!isV2 && !isV3 && (
            <span className="text-xs text-gray-400 ml-1">
              v1 &middot; password only (legacy)
            </span>
          )}
        </p>

        {/* Password */}
        <div>
          <label className="text-sm font-bold text-gray-600 dark:text-m-gray-light-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password to decrypt"
            className="mt-1 px-3 py-2 border border-gray-300 rounded-lg w-full dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
            onKeyDown={(e) => { if (e.key === "Enter" && canDecrypt) handleDecrypt("mnemonic"); }}
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
                  required — encrypted with {providerDisplayName(provider ?? "")}
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
            {usesSocialFactor && !v3AccountMismatch && (
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 dark:text-green-400 flex-shrink-0"><polyline points="20 6 9 17 4 12" /></svg>
                <span className="text-xs text-green-700 dark:text-green-300">Signed in as <strong>{authSession?.user?.email}</strong></span>
              </div>
            )}
            {v3AccountMismatch && (
              <p className="text-xs text-red-600 dark:text-red-400 font-bold">This QR was bound to a different account. Sign out and use the original account.</p>
            )}
          </div>
        )}

        {/* Backup code input for v3 */}
        {v3NeedsBackup && (
          <div>
            <label className="text-sm font-bold text-gray-600 dark:text-m-gray-light-1">Backup Recovery Code</label>
            <input
              type="text"
              value={backupCode}
              onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
              className="mt-1 px-3 py-2 border border-gray-300 rounded-lg w-full font-mono text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
            />
          </div>
        )}

        {error && <p className="text-m-red text-sm">{error}</p>}

        {/* Decryption actions */}
        <div className="space-y-2">
          <p className="text-sm font-bold text-gray-600 dark:text-m-gray-light-1">
            Decryption
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleDecrypt("mnemonic")}
              disabled={!canDecrypt}
              className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg text-sm disabled:opacity-50"
            >
              {decrypting ? "Decrypting..." : "Mnemonic"}
            </button>
            <button
              onClick={() => handleDecrypt("wallet2qr")}
              disabled={!canDecrypt}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg text-sm disabled:opacity-50"
            >
              Wallet2QR
            </button>
            <button
              onClick={() => handleDecrypt("extrasafe")}
              disabled={!canDecrypt}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg text-sm disabled:opacity-50"
            >
              ExtraSafe
            </button>
            <button
              onClick={() => handleDecrypt("tinywallet")}
              disabled={!canDecrypt}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg text-sm disabled:opacity-50"
            >
              TinyWallet
            </button>
          </div>
        </div>
      </div>

      {/* Security indicators */}
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
    </div>
  );
}

function TrustSlogans() {
  const items = [
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
          <path d="M12 2l7 4v5c0 5.25-3.5 9.74-7 11-3.5-1.26-7-5.75-7-11V6l7-4z" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
      ),
      title: "Your mnemonic never leaves your device",
      desc: "Encryption and decryption happen entirely in your browser. The server never sees your mnemonic, password, or private keys.",
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      ),
      title: "Verify online. Encrypt offline.",
      desc: "Social login verifies your identity. After that, you can disconnect — all sensitive operations run locally in the browser.",
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500">
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 7V5a4 4 0 0 0-8 0v2" />
          <circle cx="12" cy="15" r="1.5" />
        </svg>
      ),
      title: "No installs. No custody. No server access.",
      desc: "Works from any device with a browser. We never store or transmit your wallet data. You remain in full control.",
    },
  ]

  return (
    <section className="pb-12 sm:pb-16">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {items.map((it) => (
          <div key={it.title} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gradient-to-b from-white to-gray-50/50 dark:from-m-blue-dark-3 dark:to-m-blue-dark-2 p-5 text-center">
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
              {it.icon}
            </div>
            <h3 className="font-bold text-sm mb-1">{it.title}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{it.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function TwoLayerSection() {
  return (
    <section className="pb-12 sm:pb-16">
      <div className="text-center mb-8">
        <h2 className="text-xl sm:text-2xl font-bold mb-3">
          Two Layers of Protection
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
          Wallet2QR secures your mnemonic with dual-layer encryption.
          Both layers must be present to unlock your wallet.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
        <div className="rounded-2xl border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-b from-blue-50/50 to-white dark:from-blue-950/20 dark:to-m-blue-dark-2 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 1 1 8 0v4" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-sm">Layer 1: Password</h3>
              <p className="text-[11px] text-gray-400">Argon2id + AES-256-GCM</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Your mnemonic is encrypted with a password you choose. The QR code contains
            only encrypted data — it&apos;s meaningless without the password.
          </p>
        </div>

        <div className="rounded-2xl border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-b from-purple-50/50 to-white dark:from-purple-950/20 dark:to-m-blue-dark-2 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500">
                <path d="M12 2l7 4v5c0 5.25-3.5 9.74-7 11-3.5-1.26-7-5.75-7-11V6l7-4z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-sm">Layer 2: Account Binding</h3>
              <p className="text-[11px] text-gray-400">Stable provider identity</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            A unique cryptographic key is derived from your Google, GitHub, or Microsoft
            account. Even with the QR and password, decryption requires your account.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 mt-6 text-xs text-gray-400">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-500">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span>QR code + Password + Account = maximum security</span>
      </div>
    </section>
  );
}

function SocialLoginSection() {
  const items = [
    { provider: "Google", field: "sub", color: "text-blue-500" },
    { provider: "GitHub", field: "id", color: "text-gray-700 dark:text-gray-300" },
    { provider: "Microsoft", field: "oid", color: "text-cyan-600" },
  ]

  return (
    <section className="pb-12 sm:pb-16">
      <div className="rounded-2xl border border-purple-200 dark:border-purple-800 bg-gradient-to-b from-purple-50/30 to-white dark:from-purple-950/10 dark:to-m-blue-dark-2 p-6 sm:p-8">
        <h2 className="text-lg sm:text-xl font-bold mb-2 text-center">
          What Social Login Is (and Isn&apos;t) Used For
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xl mx-auto mb-6">
          Social login provides a <strong className="text-gray-700 dark:text-gray-200">stable identity factor</strong> for key derivation.
          It is never used to access, store, or transmit your wallet data.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {items.map((p) => (
            <div key={p.provider} className="bg-white dark:bg-m-blue-dark-3 rounded-xl p-4 text-center border border-gray-100 dark:border-gray-700">
              <div className={`text-sm font-bold ${p.color}`}>{p.provider}</div>
              <div className="text-[11px] text-gray-400 mt-1 font-mono">{p.field}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">stable user identifier</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <h4 className="font-bold text-green-600 dark:text-green-400 mb-2 flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              Used for encryption
            </h4>
            <ul className="space-y-1 text-gray-500 dark:text-gray-400">
              <li>Stable provider user ID (never changes)</li>
              <li>Mixed into Argon2id key derivation</li>
              <li>Acts as a second factor alongside your password</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-red-500 mb-2 flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              Never used
            </h4>
            <ul className="space-y-1 text-gray-500 dark:text-gray-400">
              <li>OAuth access tokens, refresh tokens</li>
              <li>Email, username, profile data</li>
              <li>Client secrets or app credentials</li>
            </ul>
          </div>
        </div>

        <p className="text-[11px] text-gray-400 text-center mt-5 max-w-lg mx-auto leading-relaxed">
          OAuth client secret expiration or token renewal does not affect your ability to decrypt old QR codes —
          as long as you can sign in again and the provider returns the same stable user ID.
        </p>
      </div>
    </section>
  )
}

function FlowRow({ mode }: { mode: "encrypt" | "decrypt" }) {
  const isEncrypt = mode === "encrypt";
  return (
    <div className="flex items-start justify-between">
      <div className="flex flex-col items-center">
        <div className="w-[60px] h-[60px] sm:w-[76px] sm:h-[76px] rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
          {isEncrypt ? (
            <svg viewBox="-2 -2 40 52" className="w-8 h-11 sm:w-10 sm:h-[52px]" fill="none" shapeRendering="geometricPrecision">
              <rect width="36" height="48" rx="4" stroke="#34d399" strokeWidth="2.5" />
              <line x1="7" y1="14" x2="29" y2="14" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="7" y1="23" x2="29" y2="23" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="7" y1="32" x2="22" y2="32" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="-2 -2 52 52" className="w-10 h-10 sm:w-12 sm:h-12" fill="none" shapeRendering="geometricPrecision">
              <rect x="0" y="0" width="20" height="20" rx="3" stroke="#34d399" strokeWidth="2.5" />
              <rect x="28" y="0" width="20" height="20" rx="3" stroke="#34d399" strokeWidth="2.5" />
              <rect x="0" y="28" width="20" height="20" rx="3" stroke="#34d399" strokeWidth="2.5" />
              <rect x="6" y="6" width="8" height="8" rx="1.5" fill="#34d399" />
              <rect x="34" y="6" width="8" height="8" rx="1.5" fill="#34d399" />
              <rect x="6" y="34" width="8" height="8" rx="1.5" fill="#34d399" />
              <rect x="29" y="29" width="8" height="8" rx="1.5" fill="#34d399" />
              <rect x="40" y="29" width="8" height="8" rx="1.5" fill="#34d399" />
              <rect x="29" y="40" width="8" height="8" rx="1.5" fill="#34d399" />
              <rect x="40" y="40" width="8" height="8" rx="1.5" fill="#34d399" />
            </svg>
          )}
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-1.5">{isEncrypt ? "Mnemonic" : "QR Code"}</span>
      </div>

      <div className="flex h-[60px] sm:h-[76px] items-center">
        <svg viewBox="0 0 24 14" className="w-6 sm:w-7 h-auto text-gray-300 dark:text-gray-600" fill="none">
          <path d="M0 7h18m-6-6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="flex flex-col items-center">
        <div className="flex gap-1">
          <div className="w-[52px] h-[52px] sm:w-16 sm:h-16 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
            <svg viewBox="-2 -6 36 44" className="w-8 h-9 sm:w-9 sm:h-10" fill="none" shapeRendering="geometricPrecision">
              <rect x="0" y="14" width="32" height="22" rx="3" stroke="#3b82f6" strokeWidth="2.5" />
              <path d="M5 14V8a11 11 0 0 1 22 0v6" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="16" cy="25" r="3" fill="#3b82f6" />
            </svg>
          </div>
          <div className="w-[52px] h-[52px] sm:w-16 sm:h-16 rounded-xl bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center">
            <svg viewBox="-2 -1 36 45" className="w-8 h-10 sm:w-9 sm:h-11" fill="none" shapeRendering="geometricPrecision">
              <path d="M16 2l14 9v10c0 10-6.5 18.5-14 21C7.5 39.5 1 31 1 21V11L16 2z" stroke="#a855f7" strokeWidth="2.5" />
              <polyline points="10,23 14,27 22,19" stroke="#a855f7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
        </div>
        <div className="flex gap-1 mt-1">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium w-[52px] sm:w-16 text-center">Password</span>
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium w-[52px] sm:w-16 text-center">Account</span>
        </div>
        <div className="flex items-center gap-1 mt-1">
          <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-5 sm:h-5"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700 dark:text-gray-300"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.1.39-1.99 1.02-2.69-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02.8-.22 1.65-.33 2.5-.33.85 0 1.7.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.02 1.6 1.02 2.69 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z" fill="currentColor"/></svg>
          <svg viewBox="0 0 13 13" className="w-4 h-4 sm:w-5 sm:h-5"><rect x="0" y="0" width="6" height="6" fill="#F25022"/><rect x="7" y="0" width="6" height="6" fill="#7FBA00"/><rect x="0" y="7" width="6" height="6" fill="#00A4EF"/><rect x="7" y="7" width="6" height="6" fill="#FFB900"/></svg>
        </div>
        <span className="text-xs font-bold tracking-[0.15em] text-gray-400 dark:text-gray-500 mt-0.5">{isEncrypt ? "ENCRYPT" : "DECRYPT"}</span>
      </div>

      <div className="flex h-[60px] sm:h-[76px] items-center">
        <svg viewBox="0 0 24 14" className="w-6 sm:w-7 h-auto text-gray-300 dark:text-gray-600" fill="none">
          <path d="M0 7h18m-6-6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="flex flex-col items-center">
        <div className="w-[60px] h-[60px] sm:w-[76px] sm:h-[76px] rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
          {isEncrypt ? (
            <svg viewBox="-2 -2 52 52" className="w-10 h-10 sm:w-12 sm:h-12" fill="none" shapeRendering="geometricPrecision">
              <rect x="0" y="0" width="20" height="20" rx="3" stroke="#34d399" strokeWidth="2.5" />
              <rect x="28" y="0" width="20" height="20" rx="3" stroke="#34d399" strokeWidth="2.5" />
              <rect x="0" y="28" width="20" height="20" rx="3" stroke="#34d399" strokeWidth="2.5" />
              <rect x="6" y="6" width="8" height="8" rx="1.5" fill="#34d399" />
              <rect x="34" y="6" width="8" height="8" rx="1.5" fill="#34d399" />
              <rect x="6" y="34" width="8" height="8" rx="1.5" fill="#34d399" />
              <rect x="29" y="29" width="8" height="8" rx="1.5" fill="#34d399" />
              <rect x="40" y="29" width="8" height="8" rx="1.5" fill="#34d399" />
              <rect x="29" y="40" width="8" height="8" rx="1.5" fill="#34d399" />
              <rect x="40" y="40" width="8" height="8" rx="1.5" fill="#34d399" />
            </svg>
          ) : (
            <svg viewBox="-1 -2 50 46" className="w-10 h-9 sm:w-12 sm:h-11" fill="none" shapeRendering="geometricPrecision">
              <rect x="1" y="10" width="46" height="31" rx="4" stroke="#34d399" strokeWidth="2.5" />
              <line x1="1" y1="18" x2="47" y2="18" stroke="#34d399" strokeWidth="2.5" />
              <circle cx="38" cy="28" r="3" fill="#34d399" />
              <path d="M7 10V5a3 3 0 0 1 3-3h28" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          )}
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-1.5">{isEncrypt ? "QR Code" : "Wallet"}</span>
      </div>
    </div>
  );
}

function FlowDiagram() {
  return (
    <div className="w-full max-w-md mx-auto my-6 space-y-6">
      <div className="space-y-3">
        <FlowRow mode="encrypt" />
        <a
          href="/wallet-to-qr"
          className="block w-48 mx-auto text-center bg-blue-500 hover:bg-blue-600 text-white font-bold py-2.5 rounded-lg text-sm transition-colors"
        >
          Encrypt to QR
        </a>
      </div>
      <div className="space-y-3">
        <FlowRow mode="decrypt" />
        <a
          href="/qr-to-wallet"
          className="block w-48 mx-auto text-center bg-blue-500 hover:bg-blue-600 text-white font-bold py-2.5 rounded-lg text-sm transition-colors"
        >
          Decrypt from QR
        </a>
      </div>
    </div>
  );
}

function SecuritySection() {
  const checks = [
    { label: "CodeQL", desc: "Static code analysis", color: "text-blue-500" },
    { label: "Dependabot", desc: "Dependency monitoring", color: "text-amber-500" },
    { label: "Scorecard", desc: "Supply-chain security", color: "text-purple-500" },
    { label: "Manual review", desc: "Crypto flow audit", color: "text-emerald-500" },
  ];

  return (
    <section className="pb-12 sm:pb-16">
      <div className="rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-gradient-to-b from-blue-50/50 to-white dark:from-blue-950/20 dark:to-m-blue-dark-2 overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
              <path d="M12 2l7 4v5c0 5.25-3.5 9.74-7 11-3.5-1.26-7-5.75-7-11V6l7-4z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
            <h2 className="text-xl sm:text-2xl font-bold">
              Security & Transparency
            </h2>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xl mx-auto mb-6 leading-relaxed">
            Wallet2QR follows a <strong className="text-gray-700 dark:text-gray-200">non-custodial</strong> architecture.
            Your mnemonic, password, and private keys never leave your browser.
            The public repository uses continuous automated security scanning.
            A <strong className="text-gray-700 dark:text-gray-200">formal third-party audit</strong> is planned
            after the core wallet architecture is stabilized.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {checks.map((c) => (
              <div key={c.label} className="bg-white dark:bg-m-blue-dark-3 rounded-xl p-3 text-center shadow-sm">
                <div className={`text-sm font-bold ${c.color}`}>{c.label}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">{c.desc}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="https://github.com/alexvirtech/wallet2qr/blob/main/SECURITY.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 text-sm text-blue-500 hover:text-blue-700 font-bold border border-blue-200 dark:border-blue-800 rounded-lg py-2.5 px-5 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l7 4v5c0 5.25-3.5 9.74-7 11-3.5-1.26-7-5.75-7-11V6l7-4z" />
              </svg>
              Security policy
            </a>
            <a
              href="https://github.com/alexvirtech/wallet2qr/actions/workflows/codeql.yml"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 font-bold border border-gray-200 dark:border-gray-700 rounded-lg py-2.5 px-5 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
              </svg>
              View scan results
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function LandingContent() {
  const searchParams = useSearchParams();
  const ds = getRawParam("ds") || searchParams.get("ds");

  if (ds) return <DeepLinkHandler />;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6">
      {/* Hero */}
      <section className="pt-6 sm:pt-10 pb-8 sm:pb-12 text-center">
        <h1 className="text-[clamp(1rem,4.5vw,1.875rem)] font-bold mb-2 leading-tight break-words">
          Your crypto wallet,{" "}
          <span className="text-m-blue-light-5 dark:text-m-blue-light-4">
            double-locked in a QR code
          </span>
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-3">
          Encrypt your mnemonic with a password and bind it to your
          Google, GitHub, or Microsoft account &mdash; two layers of protection.
        </p>
        <FlowDiagram />
      </section>

      {/* Trust slogans */}
      <TrustSlogans />

      {/* Two layers — security-first */}
      <TwoLayerSection />

      {/* Social login explanation */}
      <SocialLoginSection />

      {/* How it works */}
      <section className="pb-12 sm:pb-16">
        <div className="flex items-center justify-center gap-3 mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-center">
            How It Works
          </h2>
          <a href="/how-it-works" className="text-[10px] text-blue-500 hover:text-blue-700 font-bold border border-blue-200 dark:border-blue-800 rounded px-2 py-0.5">
            detailed view
          </a>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-gray-50 dark:bg-m-blue-dark-3 rounded-xl p-6 text-center">
            <div className="text-3xl mb-3">1</div>
            <h3 className="font-bold mb-2">Encrypt</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter your mnemonic, set a password, and optionally bind to your social account.
              Everything is encrypted locally with Argon2id + AES-256-GCM.
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-m-blue-dark-3 rounded-xl p-6 text-center">
            <div className="text-3xl mb-3">2</div>
            <h3 className="font-bold mb-2">Store</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Print the QR code or save the image. The encrypted data is
              self-contained — no server stores your mnemonic or keys.
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-m-blue-dark-3 rounded-xl p-6 text-center">
            <div className="text-3xl mb-3">3</div>
            <h3 className="font-bold mb-2">Scan & Unlock</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Scan the QR with any phone camera. Sign in with the same account,
              enter your password — decryption happens locally in the browser.
            </p>
          </div>
        </div>
      </section>

      {/* Security & Audit */}
      <SecuritySection />

      {/* Features */}
      <section className="pb-12 sm:pb-16">
        <h2 className="text-xl sm:text-2xl font-bold text-center mb-8">
          Features
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              title: "Two-Factor QR Encryption",
              desc: "Password + account binding. Your QR can't be decrypted without both — even if someone finds it and guesses your password.",
            },
            {
              title: "Multi-Chain Support",
              desc: "Bitcoin, Ethereum, Arbitrum, BNB Chain, Avalanche, and Solana. View balances, send, receive, and exchange across chains.",
            },
            {
              title: "Browser-Only Encryption",
              desc: "All cryptography runs in your browser via WebCrypto and Argon2id. Your mnemonic and password are never transmitted to any server.",
            },
            {
              title: "QR Deep Links",
              desc: "Each QR encodes a URL. Scan it with any phone camera to open wallet2qr and decrypt — no app install required.",
            },
            {
              title: "Cross-Chain Exchange",
              desc: "Swap tokens across supported chains via LI.FI aggregation — directly from your browser wallet.",
            },
            {
              title: "Manual Lock",
              desc: "Lock your wallet with one tap when you're done. Your mnemonic is cleared from memory on lock.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-gray-50 dark:bg-m-blue-dark-3 rounded-xl p-5"
            >
              <h3 className="font-bold mb-1">{f.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense>
      <LandingContent />
    </Suspense>
  );
}
