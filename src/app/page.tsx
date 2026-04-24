"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { decryptPayload } from "@/lib/compat/qrPayload";
import { validateBip39Mnemonic } from "@/lib/wallet/derive";
import { useSession } from "@/lib/state/session";

function DeepLinkHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setSession } = useSession();
  const ds = searchParams.get("ds");
  const pw = searchParams.get("pw");

  const [password, setPassword] = useState(pw ?? "");
  const [error, setError] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [autoAttempted, setAutoAttempted] = useState(false);

  const handleDecrypt = useCallback((pwd?: string) => {
    const pass = pwd ?? password;
    if (!ds || !pass) {
      setError("Enter your password to decrypt.");
      return;
    }
    setDecrypting(true);
    setError(null);

    const decrypted = decryptPayload(ds, pass);
    if (!decrypted) {
      setError("Wrong password or corrupted data.");
      setDecrypting(false);
      return;
    }

    const validation = validateBip39Mnemonic(decrypted);
    if (!validation.valid) {
      setError(
        `Decrypted text is not a valid BIP-39 mnemonic: ${validation.error}`
      );
      setDecrypting(false);
      return;
    }

    setSession(decrypted, pass);
    router.push("/wallet");
  }, [ds, password, setSession, router]);

  useEffect(() => {
    if (ds && pw && !autoAttempted) {
      setAutoAttempted(true);
      handleDecrypt(pw);
    }
  }, [ds, pw, autoAttempted, handleDecrypt]);

  if (!ds) return null;

  return (
    <div className="w-full max-w-md mx-auto px-4 py-12">
      <div className="bg-gray-50 dark:bg-m-blue-dark-3 rounded-xl p-6 space-y-4">
        <h2 className="text-xl font-bold text-center">Unlock Wallet</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          An encrypted wallet was detected in this link. Enter your password to
          decrypt and open it.
        </p>

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
            onKeyDown={(e) => { if (e.key === "Enter") handleDecrypt(); }}
            autoFocus
          />
        </div>

        {error && <p className="text-m-red text-sm">{error}</p>}

        <button
          onClick={() => handleDecrypt()}
          disabled={decrypting}
          className="w-full bg-m-green hover:bg-green-600 text-white font-bold py-2.5 px-4 rounded-lg text-sm disabled:opacity-50"
        >
          {decrypting ? "Decrypting..." : "Decrypt & Open Wallet"}
        </button>
      </div>
    </div>
  );
}

function LandingContent() {
  const searchParams = useSearchParams();
  const ds = searchParams.get("ds");

  if (ds) return <DeepLinkHandler />;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6">
      {/* Hero */}
      <section className="py-12 sm:py-20 text-center">
        <h1 className="text-3xl sm:text-5xl font-bold mb-4 leading-tight">
          Your crypto wallet,
          <br />
          <span className="text-m-blue-light-5 dark:text-m-blue-light-4">
            sealed in a QR code
          </span>
        </h1>
        <p className="text-base sm:text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto mb-8">
          Encrypt any BIP-39 mnemonic into a password-protected QR code.
          Scan it back anytime to access a lightweight multi-chain wallet —
          no installs, no extensions, no secrets stored.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
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
              Enter your BIP-39 mnemonic and a password. wallet2qr encrypts it
              with AES-256-CBC and renders a QR code.
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-m-blue-dark-3 rounded-xl p-6 text-center">
            <div className="text-3xl mb-3">2</div>
            <h3 className="font-bold mb-2">Store</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Print the QR code or save the image. The encrypted data is
              self-contained — no server, no cloud, no account needed.
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-m-blue-dark-3 rounded-xl p-6 text-center">
            <div className="text-3xl mb-3">3</div>
            <h3 className="font-bold mb-2">Scan & Use</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Scan the QR with your phone camera to open wallet2qr with
              your encrypted wallet. Enter your password to unlock.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="pb-12 sm:pb-16">
        <h2 className="text-xl sm:text-2xl font-bold text-center mb-8">
          Features
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              title: "Multi-Chain Support",
              desc: "Ethereum, Arbitrum, Avalanche, and Solana. View balances, send, receive, and exchange across chains.",
            },
            {
              title: "Cross-Chain Exchange",
              desc: "Swap tokens across supported chains via LI.FI aggregation — directly from your browser wallet.",
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
              title: "Offline Encryption",
              desc: "AES-256-CBC encryption runs entirely in your browser. Compatible with the text2qr family of tools.",
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
