"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession as useAuthSession } from "next-auth/react";
import MnemonicInput from "@/components/MnemonicInput";
import QrCanvas from "@/components/QrCanvas";
import ProviderSelector from "@/components/ProviderSelector";
import { providerDisplayName } from "@/components/SignInButtons";
import { validateBip39Mnemonic } from "@/lib/wallet/derive";
import { validatePasswordStrength } from "@/lib/compat/crypto";
import { buildQrUrlV3 } from "@/lib/compat/qrPayload";
import { encryptV3 } from "@/lib/compat/cryptoV3";
import type { EncryptionMode } from "@/lib/compat/cryptoV3";
import { useSession } from "@/lib/state/session";
import StepIndicator from "@/components/StepIndicator";
import type { Step } from "@/components/StepIndicator";
import SecurityStatusPanel from "@/components/SecurityStatusPanel";
import OfflineModeBanner from "@/components/OfflineModeBanner";

const SS_PROVIDER_KEY = "w2q_encrypt_provider";

export default function WalletToQrPage() {
  const [mnemonic, setMnemonic] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [qrData, setQrData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [mode, setMode] = useState<EncryptionMode>("a");
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [encrypting, setEncrypting] = useState(false);
  const { setSession } = useSession();
  const router = useRouter();
  const { data: authSession, status: authStatus } = useAuthSession();

  const isSignedIn = authStatus === "authenticated";
  const sessionProvider = authSession?.provider ?? null;

  useEffect(() => {
    if (authStatus === "loading") return;
    const saved = sessionStorage.getItem(SS_PROVIDER_KEY);
    if (saved) {
      sessionStorage.removeItem(SS_PROVIDER_KEY);
      if (isSignedIn && sessionProvider === saved) {
        setSelectedProvider(saved);
        setMode("b");
      }
    }
  }, [authStatus, isSignedIn, sessionProvider]);

  const handleProviderToggle = useCallback(
    (id: string) => {
      if (selectedProvider === id) {
        setSelectedProvider(null);
        return;
      }
      if (isSignedIn && sessionProvider === id) {
        setSelectedProvider(id);
      } else {
        sessionStorage.setItem(SS_PROVIDER_KEY, id);
        signIn(id, { callbackUrl: "/wallet-to-qr" });
      }
    },
    [selectedProvider, isSignedIn, sessionProvider]
  );

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

      if (mode === "b") {
        if (!selectedProvider) {
          setError("Select a social account for two-factor encryption");
          return;
        }
        if (!isSignedIn || sessionProvider !== selectedProvider) {
          setError(`Please sign in with ${providerDisplayName(selectedProvider)} first`);
          return;
        }
      }

      setEncrypting(true);
      try {
        const providerStableId = authSession?.providerSub ?? authSession?.sub;

        const result = await encryptV3(trimmed, password, {
          mode,
          providerStableId: mode === "b" ? (providerStableId ?? undefined) : undefined,
          provider: mode === "b" ? (sessionProvider ?? undefined) : undefined,
        });

        const qrUrl = buildQrUrlV3(result);
        setQrData(qrUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Encryption failed");
      } finally {
        setEncrypting(false);
      }
    },
    [mnemonic, password, confirmPassword, mode, selectedProvider, isSignedIn, sessionProvider, authSession]
  );

  const handleReset = useCallback(() => {
    setMnemonic("");
    setPassword("");
    setConfirmPassword("");
    setQrData(null);
    setError(null);
    setTestResult(null);
    setMode("a");
    setSelectedProvider(null);
  }, []);

  const hasMnemonic = mnemonic.trim().length > 0
  const hasPassword = password.length > 0
  const socialVerified = mode === "b" && selectedProvider && isSignedIn && sessionProvider === selectedProvider

  const encryptSteps: Step[] = useMemo(() => {
    const steps: Step[] = []
    if (mode === "b") {
      steps.push({
        label: socialVerified ? `Social identity verified (${providerDisplayName(selectedProvider!)})` : "Social identity — select and sign in",
        status: socialVerified ? "complete" : selectedProvider ? "active" : "pending",
      })
    }
    steps.push({
      label: "Mnemonic entered locally",
      status: hasMnemonic ? "complete" : "pending",
    })
    steps.push({
      label: "Password entered",
      status: hasPassword ? "complete" : "pending",
    })
    steps.push({
      label: encrypting ? "Local Argon2id key derivation + AES-256-GCM encryption..." : qrData ? "Encrypted & QR generated locally" : "Local encryption ready",
      status: qrData ? "complete" : encrypting ? "active" : "pending",
    })
    return steps
  }, [mode, socialVerified, selectedProvider, hasMnemonic, hasPassword, encrypting, qrData])

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
          <div className="space-y-2">
            <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
              Encryption Mode
            </p>

            {/* Mode A: Password only */}
            <label
              className={`flex items-start gap-3 cursor-pointer rounded-lg border p-3 transition-colors ${
                mode === "a"
                  ? "border-blue-300 dark:border-blue-700 bg-blue-50/30 dark:bg-blue-950/20"
                  : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              <input
                type="radio"
                name="enc-mode"
                value="a"
                checked={mode === "a"}
                onChange={() => { setMode("a"); setSelectedProvider(null); }}
                className="mt-0.5 accent-blue-500"
              />
              <div className="flex-1">
                <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
                  Password only
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Basic single-factor encryption
                </p>
              </div>
            </label>

            {/* Mode B: Password + social account */}
            <div
              className={`rounded-lg border p-3 transition-colors ${
                mode === "b"
                  ? "border-blue-300 dark:border-blue-700 bg-blue-50/30 dark:bg-blue-950/20"
                  : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="enc-mode"
                  value="b"
                  checked={mode === "b"}
                  onChange={() => setMode("b")}
                  className="mt-0.5 accent-blue-500"
                />
                <div className="flex-1">
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
                    Password + social account
                  </span>
                  <span className="ml-2 text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded font-bold">
                    recommended
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Two-factor: password + Google/GitHub/Microsoft
                  </p>
                </div>
              </label>

              {mode === "b" && (
                <div className="mt-3 ml-6 space-y-3">
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
                    Select account to bind this QR
                  </p>

                  <ProviderSelector
                    selectedId={selectedProvider}
                    onToggle={handleProviderToggle}
                    sessionProviderId={sessionProvider ?? undefined}
                  />

                  {selectedProvider && isSignedIn && sessionProvider === selectedProvider && (
                    <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg py-2 px-3">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 dark:text-green-400 flex-shrink-0">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span className="text-xs text-green-700 dark:text-green-300">
                        Signed in as <strong>{authSession?.user?.email}</strong>
                        {" "}via {providerDisplayName(sessionProvider)}
                      </span>
                    </div>
                  )}

                  <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
                    Social login is used only to obtain a stable account identifier.
                    OAuth tokens and client secrets are not used for encryption.
                    To decrypt later, you must use the same password and the same social account.
                  </p>
                </div>
              )}
            </div>
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
                    {selectedProvider ? `, or lose access to your ${providerDisplayName(selectedProvider)} account` : ""}
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
              disabled={encrypting}
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

      {/* Security indicators */}
      <div className="mt-6 space-y-4">
        <OfflineModeBanner />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">Progress</p>
            <StepIndicator steps={encryptSteps} />
          </div>
          <SecurityStatusPanel />
        </div>
      </div>
    </div>
  );
}
