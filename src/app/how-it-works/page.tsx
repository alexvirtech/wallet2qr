import React from "react"

export default function HowItWorksPage() {
  const encryptSteps = [
    { num: "1", title: "Open Wallet2QR", desc: "Open wallet2qr.com in any browser — desktop or mobile. No download or install required.", icon: "globe" },
    { num: "2", title: "Sign in with your account", desc: "Authenticate with Google, GitHub, or Microsoft. The app receives only your stable provider user ID.", icon: "user" },
    { num: "3", title: "Disconnect internet (optional)", desc: "After identity verification, you may go offline. All remaining operations happen locally in the browser.", icon: "wifi-off" },
    { num: "4", title: "Enter mnemonic and password", desc: "Type your BIP-39 mnemonic and choose a strong password. Both stay in browser memory only.", icon: "key" },
    { num: "5", title: "Local key derivation", desc: "Argon2id derives an encryption key from your password + stable provider ID + random salt. This runs entirely in your browser via WebAssembly.", icon: "cpu" },
    { num: "6", title: "Local encryption", desc: "Your mnemonic is encrypted with AES-256-GCM using the derived key. The ciphertext never leaves your device.", icon: "lock" },
    { num: "7", title: "QR code generated", desc: "The encrypted payload is rendered as a QR code on your screen. Print it, save the image, or copy it.", icon: "qr" },
  ]

  const decryptSteps = [
    { num: "1", title: "Open Wallet2QR", desc: "Open wallet2qr.com or scan the QR code directly with your phone camera — the URL is embedded in the QR.", icon: "globe" },
    { num: "2", title: "Scan or upload QR", desc: "Upload the QR image or use your camera. The app reads the encrypted payload and its metadata.", icon: "scan" },
    { num: "3", title: "Sign in with the required provider", desc: "The QR metadata indicates which provider was used. Sign in with the same account to obtain your stable ID.", icon: "user" },
    { num: "4", title: "Stable ID matched", desc: "The app verifies your provider ID hash matches the one stored in the QR metadata.", icon: "check" },
    { num: "5", title: "Disconnect internet (optional)", desc: "After identity verification, you may go offline for maximum security.", icon: "wifi-off" },
    { num: "6", title: "Enter password", desc: "Enter the same password you used during encryption.", icon: "key" },
    { num: "7", title: "Local key derivation", desc: "Argon2id re-derives the same encryption key from your password + provider ID + salt from the QR.", icon: "cpu" },
    { num: "8", title: "Local decryption", desc: "AES-256-GCM decrypts your mnemonic locally. If the password or account is wrong, decryption fails safely.", icon: "unlock" },
    { num: "9", title: "Wallet opens", desc: "Your mnemonic is loaded into the browser wallet. View balances, send, receive, or exchange across chains.", icon: "wallet" },
  ]

  const icons: Record<string, React.JSX.Element> = {
    globe: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>,
    user: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
    "wifi-off": <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23" /><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" /><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" /><path d="M10.71 5.05A16 16 0 0 1 22.56 9" /><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><line x1="12" y1="20" x2="12.01" y2="20" /></svg>,
    key: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>,
    cpu: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" /><line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" /><line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" /></svg>,
    lock: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>,
    unlock: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></svg>,
    qr: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="3" height="3" /><rect x="18" y="14" width="3" height="3" /><rect x="14" y="18" width="3" height="3" /><rect x="18" y="18" width="3" height="3" /></svg>,
    scan: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><line x1="7" y1="12" x2="17" y2="12" /></svg>,
    check: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>,
    wallet: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="6" width="22" height="15" rx="2" /><path d="M1 10h22" /><circle cx="18" cy="15" r="1.5" /></svg>,
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h1 className="text-2xl sm:text-3xl font-bold mb-2">How It Works</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">
        A step-by-step walkthrough of both encryption and decryption flows.
        All sensitive operations happen locally in your browser.
      </p>

      {/* Flow A: Encrypt */}
      <section className="mb-14">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          </div>
          <div>
            <h2 className="text-lg font-bold">Wallet &rarr; QR</h2>
            <p className="text-xs text-gray-400">Encrypt your mnemonic into a protected QR code</p>
          </div>
        </div>

        <div className="space-y-0">
          {encryptSteps.map((step, i) => (
            <div key={i} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-9 h-9 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {step.num}
                </div>
                {i < encryptSteps.length - 1 && <div className="w-0.5 flex-1 bg-blue-200 dark:bg-blue-800 my-1" />}
              </div>
              <div className="pb-6 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-blue-500">{icons[step.icon]}</span>
                  <h3 className="font-bold text-sm">{step.title}</h3>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{step.desc}</p>
                {step.icon === "wifi-off" && (
                  <div className="mt-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 text-[11px] text-green-700 dark:text-green-400">
                    Sensitive data is processed locally. The app does not intentionally transmit your mnemonic or password.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Flow B: Decrypt */}
      <section className="mb-14">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></svg>
          </div>
          <div>
            <h2 className="text-lg font-bold">QR &rarr; Wallet</h2>
            <p className="text-xs text-gray-400">Scan QR, verify identity, decrypt locally, open wallet</p>
          </div>
        </div>

        <div className="space-y-0">
          {decryptSteps.map((step, i) => (
            <div key={i} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {step.num}
                </div>
                {i < decryptSteps.length - 1 && <div className="w-0.5 flex-1 bg-emerald-200 dark:bg-emerald-800 my-1" />}
              </div>
              <div className="pb-6 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-emerald-500">{icons[step.icon]}</span>
                  <h3 className="font-bold text-sm">{step.title}</h3>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{step.desc}</p>
                {step.icon === "wifi-off" && (
                  <div className="mt-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 text-[11px] text-green-700 dark:text-green-400">
                    Sensitive data is processed locally. The app does not intentionally transmit your mnemonic or password.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Important note */}
      <section className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/10 p-6">
        <h3 className="font-bold text-sm mb-2">About internet connectivity</h3>
        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
          On a new device, social login requires internet to verify your identity.
          After identity verification, all sensitive mnemonic and password operations
          can happen locally in the browser — no outgoing network requests are needed
          for encryption or decryption. For maximum security, disconnect your internet
          after signing in and before entering your mnemonic or password.
        </p>
      </section>
    </div>
  )
}
