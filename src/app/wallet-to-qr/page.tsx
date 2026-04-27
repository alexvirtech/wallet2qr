"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession as useAuthSession } from "next-auth/react";
import MnemonicInput from "@/components/MnemonicInput";
import QrCanvas from "@/components/QrCanvas";
import SignInButtons, { providerDisplayName } from "@/components/SignInButtons";
import { validateBip39Mnemonic } from "@/lib/wallet/derive";
import { validatePasswordStrength } from "@/lib/compat/crypto";
import { buildQrUrl, buildQrUrlV2, decryptPayload, decryptPayloadV2 } from "@/lib/compat/qrPayload";
import { extractPayloadFromQrData } from "@/lib/compat/qrDecoder";
import { fetchPepper } from "@/lib/compat/fetchPepper";
import { useSession } from "@/lib/state/session";

export default function WalletToQrPage() {
  const [mnemonic, setMnemonic] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [qrData, setQrData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [bindAccount, setBindAccount] = useState(false);
  const [encrypting, setEncrypting] = useState(false);
  const { setSession } = useSession();
  const router = useRouter();
  const { data: authSession, status: authStatus } = useAuthSession();

  const isSignedIn = authStatus === "authenticated";
  const pepperRef = { current: "" };

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

      if (bindAccount) {
        if (!isSignedIn) {
          setError("Please sign in first");
          return;
        }
        setEncrypting(true);
        try {
          const { provider, sub_hash, pepper } = await fetchPepper();
          pepperRef.current = pepper;
          const qrUrl = buildQrUrlV2(trimmed, password, pepper, provider, sub_hash);
          setQrData(qrUrl);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to get account pepper");
        } finally {
          setEncrypting(false);
        }
      } else {
        const qrUrl = buildQrUrl(trimmed, password);
        setQrData(qrUrl);
      }
    },
    [mnemonic, password, confirmPassword, bindAccount, isSignedIn]
  );

  const handleTestDecode = useCallback(() => {
    if (!qrData) return;
    const payload = extractPayloadFromQrData(qrData);

    let decrypted: string | null;
    if (bindAccount && pepperRef.current) {
      decrypted = decryptPayloadV2(payload, password, pepperRef.current);
    } else {
      decrypted = decryptPayload(payload, password);
    }

    if (decrypted) {
      setTestResult(
        decrypted === mnemonic.trim()
          ? "Round-trip successful — decrypted mnemonic matches!"
          : "WARNING: Decrypted text does not match original mnemonic."
      );
    } else {
      setTestResult("ERROR: Decryption failed.");
    }
  }, [qrData, password, mnemonic, bindAccount]);

  const handleReset = useCallback(() => {
    setMnemonic("");
    setPassword("");
    setConfirmPassword("");
    setQrData(null);
    setError(null);
    setTestResult(null);
    setBindAccount(false);
    pepperRef.current = "";
  }, []);

  const canSubmit = !encrypting && (!bindAccount || isSignedIn);

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

        {!qrData && (
          <div className={`rounded-xl border transition-colors ${bindAccount ? "border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/20" : "border-gray-200 dark:border-gray-700"} p-4 space-y-3`}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={bindAccount}
                onChange={(e) => setBindAccount(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 mt-0.5"
              />
              <div>
                <span className="text-sm font-bold text-gray-700 dark:text-gray-200 block">
                  Bind to my account
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Adds a second factor — only your account + password can decrypt this QR.
                </span>
              </div>
            </label>

            {bindAccount && (
              <div className="ml-7 space-y-3">
                {!isSignedIn ? (
                  <>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Choose a provider to bind this QR to your account:
                    </p>
                    <SignInButtons />
                  </>
                ) : (
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
                )}
              </div>
            )}
          </div>
        )}

        {error && <p className="text-m-red text-sm">{error}</p>}

        {qrData && (
          <div className="mt-4">
            <QrCanvas data={qrData} />
          </div>
        )}

        {testResult && (
          <p
            className={`text-sm font-bold ${
              testResult.startsWith("Round-trip")
                ? "text-m-green"
                : "text-m-red"
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
                onClick={handleTestDecode}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1.5 px-4 rounded-md text-sm"
              >
                Test Decode
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
