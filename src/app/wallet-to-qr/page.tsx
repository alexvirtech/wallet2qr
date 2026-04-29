"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession as useAuthSession } from "next-auth/react";
import MnemonicInput from "@/components/MnemonicInput";
import QrCanvas from "@/components/QrCanvas";
import SignInButtons, { providerDisplayName } from "@/components/SignInButtons";
import { validateBip39Mnemonic } from "@/lib/wallet/derive";
import { validatePasswordStrength } from "@/lib/compat/crypto";
import { buildQrUrlV3 } from "@/lib/compat/qrPayload";
import { encryptV3 } from "@/lib/compat/cryptoV3";
import type { EncryptionMode } from "@/lib/compat/cryptoV3";
import { useSession } from "@/lib/state/session";

const MODE_OPTIONS: { value: EncryptionMode; label: string; desc: string; badge?: string }[] = [
  { value: "a", label: "Password only", desc: "Basic single-factor encryption" },
  { value: "b", label: "Password + social account", desc: "Two-factor: password + Google/Apple/GitHub/Microsoft", badge: "recommended" },
];

export default function WalletToQrPage() {
  const [mnemonic, setMnemonic] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [qrData, setQrData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [mode, setMode] = useState<EncryptionMode>("b");
  const [encrypting, setEncrypting] = useState(false);
  const { setSession } = useSession();
  const router = useRouter();
  const { data: authSession, status: authStatus } = useAuthSession();

  const isSignedIn = authStatus === "authenticated";
  const needsAccount = mode === "b";

  const handleEncrypt = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setTestResult(null);

      const pwError = validatePasswordStrength(password);
      if (pwError) {
        setError(pwError);
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }

      const trimmed = mnemonic.trim();
      const validation = validateBip39Mnemonic(trimmed);
      if (!validation.valid) {
        setError(validation.error ?? "Invalid mnemonic");
        return;
      }

      if (needsAccount && !isSignedIn) {
        setError("Please sign in with a provider first");
        return;
      }

      setEncrypting(true);
      try {
        const providerStableId = authSession?.providerSub ?? authSession?.sub;
        const provider = authSession?.provider;

        const result = await encryptV3(trimmed, password, {
          mode,
          providerStableId: needsAccount ? (providerStableId ?? undefined) : undefined,
          provider: needsAccount ? (provider ?? undefined) : undefined,
        });

        const qrUrl = buildQrUrlV3(result);
        setQrData(qrUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Encryption failed");
      } finally {
        setEncrypting(false);
      }
    },
    [mnemonic, password, confirmPassword, mode, needsAccount, isSignedIn, authSession]
  );

  const handleReset = useCallback(() => {
    setMnemonic("");
    setPassword("");
    setConfirmPassword("");
    setQrData(null);
    setError(null);
    setTestResult(null);
    setMode("b");
  }, []);

  const canSubmit = !encrypting && (!needsAccount || isSignedIn);

  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold mb-2">Wallet &rarr; QR Code</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Encrypt your BIP-39 mnemonic phrase into a QR code for secure storage.
      </p>

      <form onSubmit={handleEncrypt} className="space-y-4">
        <MnemonicInput
          value={mnemonic}
          onChange={setMnemonic}
          disabled={!!qrData}
        />

        <div>
          <label className="text-sm font-bold text-gray-600 dark:text-m-gray-light-1">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password for encryption"
            required
            disabled={!!qrData}
            className="mt-1 px-2 py-1 border border-gray-300 rounded w-full dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="text-sm font-bold text-gray-600 dark:text-m-gray-light-1">
            Confirm Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            required
            disabled={!!qrData}
            className="mt-1 px-2 py-1 border border-gray-300 rounded w-full dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 disabled:opacity-50"
          />
        </div>

        {/* Encryption mode selector */}
        {!qrData && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
              Encryption Mode
            </p>
            <div className="space-y-2">
              {MODE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 cursor-pointer rounded-lg border p-3 transition-colors ${
                    mode === opt.value
                      ? "border-blue-300 dark:border-blue-700 bg-blue-50/30 dark:bg-blue-950/20"
                      : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <input
                    type="radio"
                    name="enc-mode"
                    value={opt.value}
                    checked={mode === opt.value}
                    onChange={() => setMode(opt.value)}
                    className="mt-0.5 accent-blue-500"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
                      {opt.label}
                    </span>
                    {opt.badge && (
                      <span className="ml-2 text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded font-bold">
                        {opt.badge}
                      </span>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {opt.desc}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            {/* Social sign-in area */}
            {needsAccount && (
              <div className="ml-2 sm:ml-7 space-y-3 pt-2">
                {!isSignedIn ? (
                  <>
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
                      Sign in to bind this QR to your account
                    </p>
                    <SignInButtons activeProviderId={null} />
                  </>
                ) : (
                  <>
                    <SignInButtons activeProviderId={authSession?.provider} />
                    <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg py-2 px-3">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 dark:text-green-400 flex-shrink-0">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span className="text-xs text-green-700 dark:text-green-300">
                        Signed in as <strong>{authSession?.user?.email}</strong>
                        {authSession?.provider && (
                          <span className="text-green-600 dark:text-green-400"> via {providerDisplayName(authSession.provider)}</span>
                        )}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}

            <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed mt-2">
              Social login is used only to verify your identity.
              OAuth tokens are not used as encryption keys — only your account&apos;s
              stable identifier (which never changes) is mixed into the key derivation.
            </p>
          </div>
        )}

        {error && <p className="text-m-red text-sm">{error}</p>}

        {/* QR output */}
        {qrData && (
          <>
            <div className="mt-4">
              <QrCanvas data={qrData} />
            </div>

            {/* Warning */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl p-4">
              <div className="flex items-start gap-2.5">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed space-y-1">
                  <p className="font-bold">Save this QR code securely and remember your password.</p>
                  <p>
                    If you lose your password
                    {needsAccount ? `, or lose access to your ${providerDisplayName(authSession?.provider ?? "")} account` : ""}
                    , Wallet2QR cannot restore your wallet.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {testResult && (
          <p
            className={`text-sm font-bold ${
              testResult.startsWith("Round-trip") ? "text-m-green" : "text-m-red"
            }`}
          >
            {testResult}
          </p>
        )}

        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {!qrData ? (
            <button
              type="submit"
              disabled={!canSubmit}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1.5 px-6 rounded-md disabled:opacity-50"
            >
              {encrypting ? "Encrypting..." : "Encrypt"}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setSession(mnemonic.trim(), password);
                  router.push("/wallet");
                }}
                className="bg-m-green hover:bg-green-600 text-white font-bold py-1.5 px-4 rounded-md text-sm"
              >
                Open Wallet
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 font-bold py-1.5 px-4 rounded-md text-sm"
              >
                Reset
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
