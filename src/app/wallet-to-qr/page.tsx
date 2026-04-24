"use client";

import { useState, useRef, useCallback } from "react";
import MnemonicInput from "@/components/MnemonicInput";
import QrCanvas from "@/components/QrCanvas";
import { validateBip39Mnemonic } from "@/lib/wallet/derive";
import { buildQrUrl, decryptPayload } from "@/lib/compat/qrPayload";
import { extractPayloadFromQrData } from "@/lib/compat/qrDecoder";

export default function WalletToQrPage() {
  const [mnemonic, setMnemonic] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [qrData, setQrData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleEncrypt = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setTestResult(null);

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

      const qrUrl = buildQrUrl(trimmed, password);
      setQrData(qrUrl);
    },
    [mnemonic, password, confirmPassword]
  );

  const handleTestDecode = useCallback(() => {
    if (!qrData) return;
    const payload = extractPayloadFromQrData(qrData);
    const decrypted = decryptPayload(payload, password);
    if (decrypted) {
      setTestResult(
        decrypted === mnemonic.trim()
          ? "Round-trip successful — decrypted mnemonic matches!"
          : "WARNING: Decrypted text does not match original mnemonic."
      );
    } else {
      setTestResult("ERROR: Decryption failed.");
    }
  }, [qrData, password, mnemonic]);

  const handleReset = useCallback(() => {
    setMnemonic("");
    setPassword("");
    setConfirmPassword("");
    setQrData(null);
    setError(null);
    setTestResult(null);
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto px-6 py-6">
      <h1 className="text-3xl font-bold mb-2">Wallet → QR Code</h1>
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

        <div className="flex justify-center gap-2 pt-2">
          {!qrData ? (
            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1.5 px-6 rounded-md"
            >
              Encrypt
            </button>
          ) : (
            <>
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
