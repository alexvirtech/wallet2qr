# wallet2qr

[![CodeQL](https://github.com/alexvirtech/wallet2qr/actions/workflows/codeql.yml/badge.svg)](https://github.com/alexvirtech/wallet2qr/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/alexvirtech/wallet2qr/badge)](https://scorecard.dev/viewer/?uri=github.com/alexvirtech/wallet2qr)

> Your crypto wallet, sealed in a QR code.

Convert a BIP-39 mnemonic phrase into an encrypted QR code and back. Includes a lightweight multi-chain crypto wallet (Ethereum, Arbitrum, Avalanche) with send, receive, and cross-chain exchange via LI.FI.

## Quick Start

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Features

- **Wallet → QR**: Encrypt a BIP-39 mnemonic into a QR code (compatible with text2qr family)
- **QR → Wallet**: Scan/upload encrypted QR, decrypt, and open wallet
- **Wallet Dashboard**: View balances, send, receive, exchange across EVM chains
- **Cross-chain Exchange**: Swap via LI.FI with 0.5% integrator fee

## Compatibility

QR codes produced by wallet2qr are fully compatible with text2qr, text2qrApp, text2qrD, and text2qrM. See `COMPAT_NOTES.md` for cryptographic details.

## Tech Stack

- Next.js 15 (App Router) + TypeScript (strict)
- Tailwind CSS v4
- viem (EVM interactions)
- @scure/bip39 + @scure/bip32 (key derivation)
- Argon2id via hash-wasm (v3 key derivation)
- AES-256-GCM via WebCrypto (v3 encryption)
- CryptoJS (AES-CBC — legacy v1/v2 compatibility)
- qrcode + jsqr + qr-scanner (QR encode/decode)
- @lifi/sdk (cross-chain swaps)
- NextAuth v5 with Google, Apple, GitHub, Microsoft Entra ID

## Encryption Architecture

### v3 (current) — Argon2id + AES-256-GCM

v3 uses client-side key derivation with **Argon2id** (64 MB, 3 iterations) and **AES-256-GCM** via the WebCrypto API. OAuth tokens are **never** used as encryption keys — only stable provider identifiers (Google `sub`, GitHub numeric `id`, Microsoft `oid`) are mixed into the key derivation. These identifiers never change, regardless of OAuth token or client secret expiration.

**Four encryption modes:**

| Mode | Factors | Description |
|------|---------|-------------|
| A | Password | Basic single-factor |
| B | Password + social account | Two-factor with provider stable ID |
| C | Password + backup code | Two-factor with recovery code |
| D | Password + social + backup | Strongest — social login with backup fallback |

**Mode D (recommended)** uses DEK-wrapping: a random Data Encryption Key encrypts the mnemonic, then the DEK is wrapped with two independent keys — one derived from `password + providerStableId`, one from `password + backupCode`. Either path can unwrap the DEK and decrypt the wallet.

**Recovery scenarios:**
- Social account available → sign in + password → decrypt
- Social account lost → backup code + password → decrypt
- Both backup code and social account lost → **unrecoverable** (by design)

### QR payload metadata (v3)

Each v3 QR code encodes a URL with these parameters:
- `v=3` — encryption version
- `ds` — AES-256-GCM ciphertext (base64url)
- `s` — random 16-byte Argon2id salt (base64url)
- `m` — encryption mode (a/b/c/d)
- `p` — provider name (google, github, etc.) — modes b/d only
- `ph` — SHA-256 hash of provider stable ID, truncated — for account verification
- `w1`, `w2` — wrapped DEK blobs — mode d only
- `ct` — creation timestamp

Raw provider IDs are never stored in the QR. Only a truncated hash is included for verification.

### Legacy versions (v1, v2)

- **v1** (no `v` param): CryptoJS AES-256-CBC, password-only. Compatible with text2qr family.
- **v2** (`v=2`): CryptoJS AES-256-CBC with server-side HKDF pepper. Requires `WALLET2QR_PEPPER_MASTER` env var.

Both legacy formats remain fully supported for decryption.

### Threat model

| Threat | Mitigation |
|--------|------------|
| QR code stolen | Encrypted with Argon2id-derived key — useless without password (+ account/backup) |
| Password guessed | Argon2id with 64 MB memory makes brute-force impractical |
| OAuth token/secret expires | Not used for encryption — stable provider IDs persist indefinitely |
| Social account compromised | Attacker still needs QR code + password |
| QR + password + wrong account | Provider ID hash mismatch blocks decryption |
| Backup code leaked | Attacker still needs QR code + password |

## UX Trust Model

Wallet2QR is built around the idea that users should understand — and be able to verify — exactly what happens to their mnemonic. The UI communicates this through:

- **Real-time security indicators**: Both the encrypt and decrypt pages show live step-by-step progress (StepIndicator) alongside a security status panel that confirms what stays local and what never leaves the browser.
- **Online/offline awareness**: An OfflineModeBanner shows current connectivity status and encourages users to disconnect after social identity verification, before entering sensitive data.
- **Browser-only local encryption**: All cryptographic operations (Argon2id key derivation, AES-256-GCM encrypt/decrypt) execute in the browser via WebCrypto and WebAssembly. The server provides the web application and facilitates OAuth sign-in — it never sees your mnemonic, password, or private keys.
- **Social identity role**: Social login (Google, GitHub, Microsoft) provides only a **stable user identifier** (Google `sub`, GitHub numeric `id`, Microsoft `oid`). This ID is mixed into Argon2id key derivation as a second factor. OAuth tokens, refresh tokens, emails, and client secrets are never used as encryption keys. OAuth credential expiration does not affect existing QR codes.
- **Offline-after-verification flow**: On a new device, social login requires internet to verify identity. After that, all sensitive operations (entering mnemonic, password, encryption, decryption) can happen offline. For maximum security: sign in → disconnect internet → enter mnemonic and password → encrypt or decrypt → close browser.

## Security

Wallet2QR is designed as a **non-custodial** wallet-access tool. The project does not store user mnemonics, passwords, or private keys on any server. All cryptographic operations run entirely in the browser.

The repository uses continuous security checks including [CodeQL](https://github.com/alexvirtech/wallet2qr/actions/workflows/codeql.yml), [Dependabot](https://github.com/alexvirtech/wallet2qr/security/dependabot) dependency monitoring, and [OpenSSF Scorecard](https://scorecard.dev/viewer/?uri=github.com/alexvirtech/wallet2qr). A formal third-party audit is planned after the core architecture is feature-stable.

See [SECURITY.md](SECURITY.md) for the full security policy, vulnerability reporting, and details on the non-custodial model. See [docs/security-checklist.md](docs/security-checklist.md) for the pre-audit checklist.

Key safeguards:
- Mnemonic and private keys live only in React state (never persisted or transmitted)
- Auto-lock after 5 minutes of inactivity
- Content-Security-Policy headers configured
- Password strength requirements enforced on encryption
- Argon2id with OWASP-recommended parameters (64 MB, 3 iterations)
- AES-256-GCM authenticated encryption (tamper detection)
- Sensitive key material wiped from memory after use
