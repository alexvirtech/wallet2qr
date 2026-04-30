export default function AboutPage() {
  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">About Wallet2QR</h1>

      <div className="space-y-8 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
        {/* What it does */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">What is Wallet2QR?</h2>
          <p>
            Wallet2QR encrypts your BIP-39 mnemonic phrase into a QR code and decrypts it back
            when needed. It also provides a lightweight multi-chain wallet for viewing balances,
            sending, receiving, and exchanging crypto — all from your browser.
          </p>
        </section>

        {/* Why it exists */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Why does it exist?</h2>
          <p>
            Mnemonic phrases are the master key to your crypto assets. Storing them safely is hard —
            paper can be lost, metal plates can be stolen, and password managers can be breached.
            Wallet2QR offers an alternative: encrypt your mnemonic with a password and your social
            account identity, then store the result as a compact QR code.
          </p>
        </section>

        {/* The fear problem */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            &ldquo;Why should I type my mnemonic into a website?&rdquo;
          </h2>
          <p className="mb-3">
            This is the right question to ask. Most security-conscious users would never enter their
            seed phrase into a web page — and they shouldn&apos;t, unless they understand exactly what
            happens to it. Here is what Wallet2QR does differently:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-green-50 dark:bg-green-950/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
              <h4 className="font-bold text-green-700 dark:text-green-400 mb-1 text-xs">What happens</h4>
              <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                <li>Your mnemonic is encrypted in the browser using WebCrypto</li>
                <li>Key derivation uses Argon2id (64 MB, 3 iterations)</li>
                <li>The encrypted result is rendered as a QR code on your screen</li>
                <li>Your mnemonic exists only in browser memory during the session</li>
              </ul>
            </div>
            <div className="bg-red-50 dark:bg-red-950/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
              <h4 className="font-bold text-red-600 dark:text-red-400 mb-1 text-xs">What never happens</h4>
              <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                <li>Your mnemonic is never sent to any server</li>
                <li>Your password is never transmitted over the network</li>
                <li>Your private keys are never stored anywhere</li>
                <li>No analytics or telemetry captures sensitive data</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Local encryption */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">What does &ldquo;local encryption&rdquo; mean?</h2>
          <p>
            All cryptographic operations — key derivation (Argon2id), encryption (AES-256-GCM),
            and decryption — execute inside your browser using the WebCrypto API and WebAssembly.
            No server-side processing is involved. The encrypted QR code is generated on your device
            and never uploaded.
          </p>
        </section>

        {/* Social login role */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">What is social login used for?</h2>
          <p className="mb-3">
            When you sign in with Google, GitHub, or Microsoft, the app receives a
            <strong> stable user identifier</strong> — a permanent ID that never changes for your account.
            This ID is mixed into the Argon2id key derivation alongside your password, creating a
            two-factor encryption key. Nothing else from your social account is used.
          </p>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div>
                <div className="font-bold text-blue-500">Google</div>
                <div className="font-mono text-gray-400 mt-0.5">sub</div>
              </div>
              <div>
                <div className="font-bold text-gray-700 dark:text-gray-300">GitHub</div>
                <div className="font-mono text-gray-400 mt-0.5">id</div>
              </div>
              <div>
                <div className="font-bold text-cyan-600">Microsoft</div>
                <div className="font-mono text-gray-400 mt-0.5">oid</div>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 text-center mt-3">
              OAuth tokens, refresh tokens, emails, usernames, and client secrets are never used as encryption keys.
              OAuth secret expiration does not break old QR decryption.
            </p>
          </div>
        </section>

        {/* Self-custodial */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Is this still self-custodial?</h2>
          <p>
            Yes. Wallet2QR follows a <strong>non-custodial architecture</strong>. Your mnemonic phrase,
            private keys, and password never leave your browser. The server provides the web application
            and facilitates OAuth sign-in, but it never has access to your wallet data. If Wallet2QR
            disappears tomorrow, your QR code and password (plus your social account) are all you need —
            the encryption is standard and can be reproduced from the open-source code.
          </p>
        </section>

        {/* Security & audit */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Security posture</h2>
          <p className="mb-3">
            Wallet2QR is open-source and uses continuous automated security scanning:
          </p>
          <ul className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
            <li><strong>CodeQL</strong> — static code analysis on every push</li>
            <li><strong>Dependabot</strong> — dependency vulnerability monitoring</li>
            <li><strong>OpenSSF Scorecard</strong> — supply-chain security assessment</li>
            <li><strong>Manual review</strong> — crypto flow audit of encryption/decryption paths</li>
          </ul>
          <p className="mt-3 text-xs text-gray-400">
            A formal third-party audit is planned after the core wallet architecture is stabilized.
            The project does not overpromise — no system is perfectly secure. We aim for transparency
            and best practices.
          </p>
        </section>

        {/* Links */}
        <div className="flex flex-wrap gap-3 pt-2">
          <a
            href="https://github.com/alexvirtech/wallet2qr"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-blue-500 hover:text-blue-700 font-bold border border-blue-200 dark:border-blue-800 rounded-lg py-2 px-4 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" /></svg>
            Source code
          </a>
          <a
            href="https://github.com/alexvirtech/wallet2qr/blob/main/SECURITY.md"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 font-bold border border-gray-200 dark:border-gray-700 rounded-lg py-2 px-4 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l7 4v5c0 5.25-3.5 9.74-7 11-3.5-1.26-7-5.75-7-11V6l7-4z" /></svg>
            Security policy
          </a>
        </div>
      </div>
    </div>
  )
}
