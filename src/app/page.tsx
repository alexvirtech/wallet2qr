"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useSession as useAuthSession } from "next-auth/react";
import SignInButtons from "@/components/SignInButtons";
import { providerDisplayName } from "@/components/SignInButtons";
import { decryptPayload, decryptPayloadV2 } from "@/lib/compat/qrPayload";
import { deterministicMnemonic } from "@/lib/compat/crypto";
import { validateBip39Mnemonic } from "@/lib/wallet/derive";
import { fetchPepper } from "@/lib/compat/fetchPepper";
import { useSession } from "@/lib/state/session";

function DeepLinkHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setSession } = useSession();
  const { data: authSession, status: authStatus } = useAuthSession();
  const ds = searchParams.get("ds");
  const pw = searchParams.get("pw");
  const roParam = searchParams.get("readOnly");
  const v = searchParams.get("v");
  const pep = searchParams.get("pep");

  const isV2 = v === "2";
  const isSignedIn = authStatus === "authenticated";

  const [password, setPassword] = useState(pw ?? "");
  const [error, setError] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [autoAttempted, setAutoAttempted] = useState(false);
  const [readOnly, setReadOnly] = useState(roParam === "1");

  const handleDecrypt = useCallback(async (pwd?: string) => {
    const pass = pwd ?? password;
    if (!ds || !pass) {
      setError("Enter your password to decrypt.");
      return;
    }
    if (isV2 && !isSignedIn) {
      setError("Please sign in first.");
      return;
    }
    setDecrypting(true);
    setError(null);

    try {
      let mnemonic: string;

      if (isV2 && isSignedIn) {
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
          mnemonic = validation.valid ? decrypted : deterministicMnemonic(pass, ds);
        } else {
          mnemonic = deterministicMnemonic(pass, ds);
        }
      }

      setSession(mnemonic, pass, readOnly);
      router.push("/wallet");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decryption failed");
      setDecrypting(false);
    }
  }, [ds, password, readOnly, isV2, isSignedIn, setSession, router]);

  useEffect(() => {
    if (ds && pw && !autoAttempted && !isV2) {
      setAutoAttempted(true);
      handleDecrypt(pw);
    }
  }, [ds, pw, autoAttempted, isV2, handleDecrypt]);

  if (!ds) return null;

  const canDecrypt = !decrypting && (!isV2 || isSignedIn);

  return (
    <div className="w-full max-w-md mx-auto px-4 py-12">
      <div className="bg-gray-50 dark:bg-m-blue-dark-3 rounded-xl p-6 space-y-4">
        <h2 className="text-xl font-bold text-center">Unlock Wallet</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          An encrypted wallet was detected in this link. Enter your password to
          decrypt and open it.
        </p>

        {isV2 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg p-3 space-y-2">
            <p className="text-sm font-bold text-blue-700 dark:text-blue-300">
              This wallet is bound to a {providerDisplayName(pep ?? "google")} account.
            </p>
            {!isSignedIn && (
              <div className="space-y-2">
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  Sign in with the original account to decrypt.
                </p>
                <SignInButtons callbackUrl={typeof window !== "undefined" ? window.location.href : "/"} compact />
              </div>
            )}
            {isSignedIn && (
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 dark:text-green-400 flex-shrink-0">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-xs text-green-700 dark:text-green-300">
                  Signed in as <strong>{authSession?.user?.email}</strong>
                </span>
              </div>
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
            className="mt-1 px-3 py-2 border border-gray-300 rounded-lg w-full dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
            onKeyDown={(e) => { if (e.key === "Enter" && canDecrypt) handleDecrypt(); }}
            autoFocus
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
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
            (view balances only)
          </span>
        </label>

        {error && <p className="text-m-red text-sm">{error}</p>}

        <button
          onClick={() => handleDecrypt()}
          disabled={!canDecrypt}
          className="w-full bg-m-green hover:bg-green-600 text-white font-bold py-2.5 px-4 rounded-lg text-sm disabled:opacity-50"
        >
          {decrypting ? "Decrypting..." : "Decrypt & Open Wallet"}
        </button>
      </div>
    </div>
  );
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
              <p className="text-[11px] text-gray-400">AES-256-CBC encryption</p>
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
              <p className="text-[11px] text-gray-400">HKDF-SHA256 second factor</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            A unique cryptographic key is derived from your Google, Apple, GitHub, or Microsoft
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

function FlowInfographic() {
  return (
    <div className="py-3 max-w-2xl mx-auto space-y-3">
      {/* Row 1: Encrypt */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-50 via-white to-green-50 dark:from-blue-950/30 dark:via-m-blue-dark-3 dark:to-green-950/30 border border-gray-200 dark:border-gray-700/50 p-3 sm:p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2 sm:gap-0">
          {/* Mnemonic */}
          <div className="flex flex-col items-center gap-1 min-w-[52px] sm:min-w-[72px]">
            <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl bg-blue-500 shadow-lg shadow-blue-500/25 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="sm:w-7 sm:h-7">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <line x1="7" y1="9" x2="17" y2="9" />
                <line x1="7" y1="13" x2="14" y2="13" />
              </svg>
            </div>
            <span className="text-[9px] sm:text-[11px] font-bold text-gray-600 dark:text-gray-300">Mnemonic</span>
          </div>

          {/* Arrow */}
          <svg width="20" height="12" viewBox="0 0 20 12" className="text-blue-300 dark:text-blue-700 flex-shrink-0">
            <line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="2" />
            <polyline points="10,2 18,6 10,10" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>

          {/* Two-layer lock */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <div className="flex flex-col items-center gap-0.5">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-blue-500/15 dark:bg-blue-400/15 border-2 border-blue-300 dark:border-blue-700 flex items-center justify-center shadow-sm">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600 dark:text-blue-400 sm:w-6 sm:h-6">
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 1 1 8 0v4" />
                </svg>
              </div>
              <span className="text-[8px] sm:text-[10px] font-bold text-blue-600 dark:text-blue-400">Password</span>
            </div>

            <div className="text-gray-300 dark:text-gray-600 text-lg font-light select-none">+</div>

            <div className="flex flex-col items-center gap-0.5">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-purple-500/15 dark:bg-purple-400/15 border-2 border-purple-300 dark:border-purple-700 flex items-center justify-center shadow-sm">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-600 dark:text-purple-400 sm:w-6 sm:h-6">
                  <path d="M12 2l7 4v5c0 5.25-3.5 9.74-7 11-3.5-1.26-7-5.75-7-11V6l7-4z" />
                </svg>
              </div>
              <span className="text-[8px] sm:text-[10px] font-bold text-purple-600 dark:text-purple-400">Account</span>
              <div className="flex gap-0.5">
                <svg width="8" height="8" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" className="text-gray-500 dark:text-gray-400"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" className="text-gray-500 dark:text-gray-400"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.1.39-1.99 1.02-2.69-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02.8-.22 1.65-.33 2.5-.33.85 0 1.7.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.02 1.6 1.02 2.69 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/></svg>
                <svg width="8" height="8" viewBox="0 0 24 24"><rect x="2" y="2" width="9.5" height="9.5" fill="#F25022"/><rect x="12.5" y="2" width="9.5" height="9.5" fill="#7FBA00"/><rect x="2" y="12.5" width="9.5" height="9.5" fill="#00A4EF"/><rect x="12.5" y="12.5" width="9.5" height="9.5" fill="#FFB900"/></svg>
              </div>
            </div>
          </div>

          {/* Arrow */}
          <svg width="20" height="12" viewBox="0 0 20 12" className="text-green-300 dark:text-green-700 flex-shrink-0">
            <line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="2" />
            <polyline points="10,2 18,6 10,10" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>

          {/* QR Code */}
          <div className="flex flex-col items-center gap-1 min-w-[52px] sm:min-w-[72px]">
            <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl bg-green-500 shadow-lg shadow-green-500/25 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white" className="sm:w-7 sm:h-7">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="3" height="3" rx="0.5" />
                <rect x="18" y="14" width="3" height="3" rx="0.5" />
                <rect x="14" y="18" width="3" height="3" rx="0.5" />
                <rect x="18" y="18" width="3" height="3" rx="0.5" />
                <rect x="5" y="5" width="3" height="3" rx="0.5" fill="#22c55e" />
                <rect x="16" y="5" width="3" height="3" rx="0.5" fill="#22c55e" />
                <rect x="5" y="16" width="3" height="3" rx="0.5" fill="#22c55e" />
              </svg>
            </div>
            <span className="text-[9px] sm:text-[11px] font-bold text-gray-600 dark:text-gray-300">QR Code</span>
          </div>
        </div>
        <div className="text-[9px] sm:text-[10px] text-center text-gray-400 mt-2 font-bold uppercase tracking-widest">Encrypt &amp; Store</div>
      </div>

      {/* Row 2: Decrypt */}
      <div className="rounded-2xl bg-gradient-to-r from-green-50 via-white to-emerald-50 dark:from-green-950/30 dark:via-m-blue-dark-3 dark:to-emerald-950/30 border border-gray-200 dark:border-gray-700/50 p-3 sm:p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2 sm:gap-0">
          {/* Scan QR */}
          <div className="flex flex-col items-center gap-1 min-w-[52px] sm:min-w-[72px]">
            <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl bg-green-500 shadow-lg shadow-green-500/25 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="sm:w-7 sm:h-7">
                <rect x="4" y="2" width="16" height="20" rx="3" />
                <rect x="7" y="6" width="4" height="4" rx="0.5" fill="white" fillOpacity="0.5" />
                <rect x="13" y="6" width="4" height="4" rx="0.5" fill="white" fillOpacity="0.5" />
                <rect x="7" y="12" width="4" height="4" rx="0.5" fill="white" fillOpacity="0.5" />
              </svg>
            </div>
            <span className="text-[9px] sm:text-[11px] font-bold text-gray-600 dark:text-gray-300">Scan QR</span>
          </div>

          {/* Arrow */}
          <svg width="20" height="12" viewBox="0 0 20 12" className="text-green-300 dark:text-green-700 flex-shrink-0">
            <line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="2" />
            <polyline points="10,2 18,6 10,10" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>

          {/* Two-layer lock */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <div className="flex flex-col items-center gap-0.5">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-blue-500/15 dark:bg-blue-400/15 border-2 border-blue-300 dark:border-blue-700 flex items-center justify-center shadow-sm">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600 dark:text-blue-400 sm:w-6 sm:h-6">
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 1 1 8 0v4" />
                </svg>
              </div>
              <span className="text-[8px] sm:text-[10px] font-bold text-blue-600 dark:text-blue-400">Password</span>
            </div>

            <div className="text-gray-300 dark:text-gray-600 text-lg font-light select-none">+</div>

            <div className="flex flex-col items-center gap-0.5">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-purple-500/15 dark:bg-purple-400/15 border-2 border-purple-300 dark:border-purple-700 flex items-center justify-center shadow-sm">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-600 dark:text-purple-400 sm:w-6 sm:h-6">
                  <path d="M12 2l7 4v5c0 5.25-3.5 9.74-7 11-3.5-1.26-7-5.75-7-11V6l7-4z" />
                </svg>
              </div>
              <span className="text-[8px] sm:text-[10px] font-bold text-purple-600 dark:text-purple-400">Account</span>
              <div className="flex gap-0.5">
                <svg width="8" height="8" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" className="text-gray-500 dark:text-gray-400"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" className="text-gray-500 dark:text-gray-400"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.1.39-1.99 1.02-2.69-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02.8-.22 1.65-.33 2.5-.33.85 0 1.7.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.02 1.6 1.02 2.69 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/></svg>
                <svg width="8" height="8" viewBox="0 0 24 24"><rect x="2" y="2" width="9.5" height="9.5" fill="#F25022"/><rect x="12.5" y="2" width="9.5" height="9.5" fill="#7FBA00"/><rect x="2" y="12.5" width="9.5" height="9.5" fill="#00A4EF"/><rect x="12.5" y="12.5" width="9.5" height="9.5" fill="#FFB900"/></svg>
              </div>
            </div>
          </div>

          {/* Arrow */}
          <svg width="20" height="12" viewBox="0 0 20 12" className="text-emerald-300 dark:text-emerald-700 flex-shrink-0">
            <line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="2" />
            <polyline points="10,2 18,6 10,10" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>

          {/* Wallet */}
          <div className="flex flex-col items-center gap-1 min-w-[52px] sm:min-w-[72px]">
            <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl bg-emerald-500 shadow-lg shadow-emerald-500/25 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="sm:w-7 sm:h-7">
                <rect x="2" y="6" width="20" height="14" rx="2" />
                <path d="M2 10h20" />
                <circle cx="17" cy="15" r="1.5" />
              </svg>
            </div>
            <span className="text-[9px] sm:text-[11px] font-bold text-gray-600 dark:text-gray-300">Wallet</span>
          </div>
        </div>
        <div className="text-[9px] sm:text-[10px] text-center text-gray-400 mt-2 font-bold uppercase tracking-widest">Scan &amp; Unlock</div>
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
  const ds = searchParams.get("ds");

  if (ds) return <DeepLinkHandler />;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6">
      {/* Hero */}
      <section className="pt-6 sm:pt-10 pb-8 sm:pb-12 text-center">
        <h1 className="text-xl sm:text-3xl font-bold mb-2 leading-tight whitespace-nowrap">
          Your crypto wallet, <span className="text-m-blue-light-5 dark:text-m-blue-light-4">double-locked in a QR&nbsp;code</span>
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-3">
          Encrypt your mnemonic with a password and bind it to your
          Google, Apple, GitHub, or Microsoft account &mdash; two layers of protection.
        </p>
        <FlowInfographic />
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-5">
          <a
            href="/wallet-to-qr"
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg text-sm"
          >
            Create Encrypted QR
          </a>
          <a
            href="/qr-to-wallet"
            className="bg-m-green hover:bg-green-600 text-white font-bold py-3 px-8 rounded-lg text-sm"
          >
            Open Wallet from QR
          </a>
        </div>
      </section>

      {/* Two layers — security-first */}
      <TwoLayerSection />

      {/* How it works */}
      <section className="pb-12 sm:pb-16">
        <h2 className="text-xl sm:text-2xl font-bold text-center mb-8">
          How It Works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-gray-50 dark:bg-m-blue-dark-3 rounded-xl p-6 text-center">
            <div className="text-3xl mb-3">1</div>
            <h3 className="font-bold mb-2">Encrypt</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter your mnemonic, set a password, and sign in with your account.
              Wallet2QR encrypts with AES-256 using both factors and renders a QR code.
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
              Scan the QR with your phone camera. Sign in with the same account,
              enter your password — both are required to unlock the wallet.
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
              title: "Zero Storage",
              desc: "Your mnemonic lives only in memory during the session. Nothing is written to localStorage or sent to any server.",
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
              title: "Auto-Lock",
              desc: "Wallet automatically locks after 5 minutes of inactivity. Your mnemonic is cleared from memory.",
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
