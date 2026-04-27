"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useSession as useAuthSession, signIn as authSignIn } from "next-auth/react";
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
  const providerName = pep === "apple" ? "Apple" : "Google";

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
              This wallet is bound to a {providerName} account.
            </p>
            {!isSignedIn && (
              <div className="space-y-1">
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  Sign in with the original account to decrypt.
                </p>
                <button
                  type="button"
                  onClick={() => authSignIn("google", { callbackUrl: window.location.href })}
                  className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm font-bold text-gray-700 dark:text-gray-300 py-1 px-3 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Sign in with {providerName}
                </button>
              </div>
            )}
            {isSignedIn && (
              <p className="text-xs text-m-green">
                Signed in as {authSession?.user?.email}
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

function FlowInfographic() {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-2 py-4">
      {/* Mnemonic */}
      <div className="flex flex-col items-center gap-2 w-28">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 dark:bg-blue-400/10 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <line x1="7" y1="9" x2="17" y2="9" />
            <line x1="7" y1="13" x2="14" y2="13" />
            <line x1="7" y1="17" x2="11" y2="17" />
          </svg>
        </div>
        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Mnemonic</span>
      </div>

      <svg width="32" height="20" viewBox="0 0 32 20" className="text-gray-300 dark:text-gray-600 hidden sm:block flex-shrink-0">
        <line x1="0" y1="10" x2="24" y2="10" stroke="currentColor" strokeWidth="2" />
        <polyline points="20,4 28,10 20,16" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>

      {/* Lock / Encrypt */}
      <div className="flex flex-col items-center gap-2 w-28">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 dark:bg-amber-400/10 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 1 1 8 0v4" />
            <circle cx="12" cy="16" r="1.5" />
          </svg>
        </div>
        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Encrypt</span>
      </div>

      <svg width="32" height="20" viewBox="0 0 32 20" className="text-gray-300 dark:text-gray-600 hidden sm:block flex-shrink-0">
        <line x1="0" y1="10" x2="24" y2="10" stroke="currentColor" strokeWidth="2" />
        <polyline points="20,4 28,10 20,16" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>

      {/* QR Code */}
      <div className="flex flex-col items-center gap-2 w-28">
        <div className="w-16 h-16 rounded-2xl bg-purple-500/10 dark:bg-purple-400/10 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className="text-purple-500">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="3" height="3" rx="0.5" />
            <rect x="18" y="14" width="3" height="3" rx="0.5" />
            <rect x="14" y="18" width="3" height="3" rx="0.5" />
            <rect x="18" y="18" width="3" height="3" rx="0.5" />
            <rect x="5" y="5" width="3" height="3" rx="0.5" className="text-white dark:text-m-blue-dark-2" />
            <rect x="16" y="5" width="3" height="3" rx="0.5" className="text-white dark:text-m-blue-dark-2" />
            <rect x="5" y="16" width="3" height="3" rx="0.5" className="text-white dark:text-m-blue-dark-2" />
          </svg>
        </div>
        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">QR Code</span>
      </div>

      <svg width="32" height="20" viewBox="0 0 32 20" className="text-gray-300 dark:text-gray-600 hidden sm:block flex-shrink-0">
        <line x1="0" y1="10" x2="24" y2="10" stroke="currentColor" strokeWidth="2" />
        <polyline points="20,4 28,10 20,16" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>

      {/* Scan */}
      <div className="flex flex-col items-center gap-2 w-28">
        <div className="w-16 h-16 rounded-2xl bg-green-500/10 dark:bg-green-400/10 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
            <rect x="4" y="2" width="16" height="20" rx="3" />
            <line x1="4" y1="12" x2="20" y2="12" strokeDasharray="2 2" />
            <rect x="7" y="6" width="4" height="4" rx="0.5" />
            <rect x="13" y="6" width="4" height="4" rx="0.5" />
            <rect x="7" y="14" width="4" height="4" rx="0.5" />
          </svg>
        </div>
        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Scan</span>
      </div>

      <svg width="32" height="20" viewBox="0 0 32 20" className="text-gray-300 dark:text-gray-600 hidden sm:block flex-shrink-0">
        <line x1="0" y1="10" x2="24" y2="10" stroke="currentColor" strokeWidth="2" />
        <polyline points="20,4 28,10 20,16" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>

      {/* Wallet */}
      <div className="flex flex-col items-center gap-2 w-28">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 dark:bg-emerald-400/10 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
            <rect x="2" y="6" width="20" height="14" rx="2" />
            <path d="M2 10h20" />
            <circle cx="17" cy="15" r="1.5" />
            <path d="M6 6V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
          </svg>
        </div>
        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Wallet</span>
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
        <FlowInfographic />
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
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

      {/* Security & Audit — central position */}
      <SecuritySection />

      {/* Features */}
      <section className="pb-12 sm:pb-16">
        <h2 className="text-xl sm:text-2xl font-bold text-center mb-8">
          Features
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              title: "Multi-Chain Support",
              desc: "Bitcoin, Ethereum, Arbitrum, BNB Chain, Avalanche, and Solana. View balances, send, receive, and exchange across chains.",
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
